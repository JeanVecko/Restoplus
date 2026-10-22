# Stratégie de recette sécurité multi-restaurant

Cette stratégie décrit les contrôles à exécuter. La migration RLS est encore en attente : aucune de ces vérifications n'est réputée réussie et RLS n'est pas opérationnel.

## Préconditions

- Base de test isolée, sans données réelles.
- Migration appliquée uniquement après autorisation distincte.
- `restoplus_app`, `restoplus_auth`, `restoplus_migrator` et `restoplus_bootstrap_owner` provisionnés séparément; aucun n'est `BYPASSRLS`.
- Exécuter les tests d'accès avec le rôle applicatif réel, non avec le propriétaire de tables ni un compte privilégié.
- Capturer le résultat des tests sans imprimer de variables d'environnement ou secrets.

## Modèle synthétique

Créer les restaurants A et B, des profils, des credentials, memberships et sessions synthétiques. Utiliser le même e-mail normalisé dans A et B, puis tenter un doublon dans A. Chaque fixture et nettoyage doit être reproductible; le rôle applicatif ne doit pas disposer de suppression physique.

## Tests bloquants

### Contraintes et relations

1. Le code public généré est unique; une collision est rejetée et le code d'un restaurant désactivé reste réservé.
2. Les espaces extérieurs et majuscules d'un e-mail sont normalisés côté serveur avant écriture.
3. Même e-mail admis dans deux restaurants, doublon normalisé refusé dans le même restaurant.
4. Un credential, membership ou session dont le `restaurantId` ne correspond pas au profil est rejeté par clé étrangère composite.
5. Une seule adhésion/rôle principal par utilisateur est imposée.
6. Échec d'une étape de création atomique entraîne le rollback de toute la transaction bootstrap; aucun restaurant/profil/credential/membership partiel ne subsiste.

### Isolation RLS

1. A lit ses propres lignes dans chaque table accessible; B lit les siennes.
2. A ne lit ni ne modifie une ligne de B même en connaissant son UUID.
3. Insertion sous A avec `restaurantId` de B refusée; mise à jour de A vers B refusée par `WITH CHECK`.
4. Relation inter-restaurant refusée par contraintes composites.
5. Sans `app.restaurant_id`, SELECT retourne zéro ligne et les écritures sont refusées.
6. Session d'un autre utilisateur refusée même dans le même restaurant; contexte user manquant échoue fermé.
7. `restoplus_app` ne peut pas accéder à `auth_credentials` ou `sessions`, ni créer un restaurant.
8. `restoplus_auth` ne retrouve qu'un restaurant par code exact, qu'un credential par code/email exacts, et ne peut effectuer aucune écriture directe d'identité.
9. Le bootstrap appelé par `restoplus_auth` crée le propriétaire OWNER atomiquement; entrées invalides, doublons et erreurs ne laissent aucune donnée partielle.
10. `restoplus_auth` ne peut détourner le `search_path` pour substituer un objet à la fonction ni aux tables qualifiées.

### Pool, rôles et sessions

1. Dans un pool réduit à une connexion, transaction A puis transaction B voient uniquement leurs lignes respectives.
2. Après transaction A, une transaction sans contexte sur la connexion réutilisée voit zéro ligne et ne peut écrire.
3. Erreur/rollback pendant une transaction avec contexte ne laisse aucun état accessible à la transaction suivante.
4. Le rôle applicatif ne peut supprimer physiquement, modifier le schéma, faire `TRUNCATE`, changer de rôle, désactiver RLS ni hériter des droits migrateur.
5. Compte désactivé, session révoquée, plus de 30 minutes d'inactivité et plus de 12 heures absolues sont refusés. Le code serveur devra appliquer ces délais; les politiques RLS seules ne les garantissent pas.
6. `restoplus_auth` ne peut lire/écrire hors des opérations explicitement accordées et n'a ni `BYPASSRLS`, ni privilèges généraux.
7. Une empreinte de session inconnue ou absente ne révèle aucune ligne; une révocation est constatée à la validation suivante. Une requête déjà engagée peut finir.
8. Le rôle bootstrap n'a que des droits d'insertion ciblés, ne lit ni ne modifie/supprime les tables, et RLS refuse l'insertion sans contexte tenant.
9. Le migrateur sous `FORCE RLS` n'effectue pas de DML ordinaire; son appartenance temporaire au rôle bootstrap est révoquée après installation.

## Tests d'autorisation serveur à venir

Pour chaque route ou action future, comparer permissions autorisées/refusées par rôle. Le catalogue existe, mais la matrice des droits métier non financiers n'est pas encore validée. Aucun test de remboursement, annulation, clôture de caisse ou droit financier ne doit être inventé dans cette étape.

## Critères de sortie

- Zéro accès croisé; tout accès inter-restaurant réussi bloque le jalon.
- Zéro contexte résiduel entre transactions et aucune opération tenant hors wrapper.
- Tous les tests passent sur PostgreSQL réel avec les rôles d'exécution dédiés.
- Privilèges effectifs vérifiés, y compris héritage et privilèges par défaut.
- Migration et schéma concordants, sans test exécutant ou appliquant la migration implicitement.
- Les décisions de bootstrap/authentification sont approuvées avant d'annoncer le flux d'inscription ou de connexion.

Le runner natif Node est utilisé pour les tests unitaires; aucun runner externe n'est installé. La suite PostgreSQL reste à exécuter sur une base jetable autorisée.

## Tests des opérations de comptes préparés

`tests/unit/authorization.test.mjs` utilise `node:test` pour la matrice pure. `tests/postgres/account-security.integration.test.mjs` utilise `node:test` et `pg`, déjà présents; aucun Vitest ni autre dépendance n'est requis. La suite PostgreSQL refuse de démarrer sans `RESTOPLUS_TEST_DATABASE_CONFIRMATION=isolated-disposable`, vérifie le rôle `restoplus_app` et le nom de base `restoplus_test...`, et ne charge pas dotenv. Les variables `RESTOPLUS_TEST_APP_DATABASE_URL` et `RESTOPLUS_TEST_AUTH_DATABASE_URL` doivent viser une base jetable distincte de `restoplus_dev`. Les données synthétiques ne sont pas supprimées par les tests : la base jetable doit être détruite après autorisation explicite.

Avant de clore le jalon, compléter les essais de révocation simultanée, d'acceptation concurrente d'une invitation, de réactivation avec anciennes sessions invalides, de rollback complet et des ACL/fonctions via catalogues PostgreSQL. Aucun test d'intégration n'a été exécuté pendant l'implémentation.
