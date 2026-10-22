# Gestion sécurisée des comptes Resto+

## État de cette révision

Les fichiers applicatifs, le schéma Prisma et la migration initiale ont été préparés. Selon le rapport d'audit remis par le développeur, la migration a été appliquée uniquement à `restoplus_test_disposable`; RLS y a été activé et les tests PostgreSQL de sécurité y ont réussi. Cela ne prouve pas l'état de `restoplus_dev` ou de la production. Aucune migration de ces environnements n'est réputée autorisée ou appliquée ici.

## Matrice autorisée

| Opération                                                       |                                        OWNER actif |               MANAGER actif |          Autres rôles |
| --------------------------------------------------------------- | -------------------------------------------------: | --------------------------: | --------------------: |
| Lister les profils et adhésions du restaurant                   |                                                Oui |                         Oui |                   Non |
| Créer une invitation pour un rôle différent de OWNER            |                                                Oui |                         Oui |                   Non |
| Annuler une invitation en attente                               |                                                Oui |                         Oui |                   Non |
| Accepter une invitation valide                                  |                              Le détenteur du token |       Le détenteur du token | Le détenteur du token |
| Attribuer/modifier un rôle autre que OWNER                      |                                                Oui |                         Oui |                   Non |
| Promouvoir un autre membre actif en OWNER                       |                                                Oui |                         Non |                   Non |
| Modifier le compte d'un OWNER                                   |                                                Oui |                         Non |                   Non |
| Se promouvoir soi-même en OWNER                                 |                                                Non |                         Non |                   Non |
| Désactiver/activer profil ou adhésion                           |                                                Oui |             Oui, sauf OWNER |                   Non |
| Désactiver le restaurant                                        |                                                Oui |                         Non |                   Non |
| Réactiver le restaurant                                         | OWNER authentifié par code, e-mail et mot de passe |                         Non |                   Non |
| Désactiver/démarrer des sessions ciblées                        |                        Fonction sensible seulement | Fonction sensible seulement |                   Non |
| Supprimer physiquement comptes, restaurant, invitation ou audit |                                                Non |                         Non |                   Non |

L'attribution de `MANAGER` par un autre MANAGER est permise dans la présente matrice comme rôle non-OWNER. Cette interprétation est un point à confirmer avant production si « rôles opérationnels » devait exclure MANAGER.

## Contrôles serveur et SQL

Chaque route contrôle l'origine de la requête, valide les paramètres avec Zod et authentifie le cookie opaque `HttpOnly`, `SameSite=Lax`, `Secure` en production. Le serveur ne prend aucun `restaurantId` client pour construire le contexte. Le wrapper Prisma applique `app.restaurant_id`/`app.user_id` par `set_config(..., true)` à l'intérieur de chaque transaction.

Les routes effectuent un contrôle de rôle préalable. Les fonctions PostgreSQL effectuent un second contrôle d'acteur actif, de restaurant actif, de rôle et de cible. Les mises à jour sensibles ne sont jamais directement accordées à `restoplus_app`. `restoplus_account_ops` est un rôle requis NOLOGIN/NOBYPASSRLS, propriétaire des fonctions dédiées, non membre des rôles runtime. Il doit être créé et provisionné par une étape d'administration séparée; aucune instruction de création de rôle n'est incluse dans la migration.

`manage_member` prend un advisory transaction lock par restaurant; les changements de rôle/statut et le contrôle du dernier OWNER actif sont atomiques. La même transaction révoque les sessions en cas de désactivation. L'invitation stocke une empreinte SHA-256 d'un secret de 256 bits, interdit le rôle OWNER, et son acceptation crée profil/identifiant/adhésion atomiquement. Délai configuré : sept jours, à confirmer avant production.

Les événements d'audit enregistrent acteur, type d'opération, cible et changements de rôle/statut. Ils excluent les emails et secrets. Le runtime n'a pas de droit de lecture, modification ou suppression sur l'audit dans cette révision.

## Réactivation sécurisée du restaurant

La désactivation OWNER met `isActive=false`, révoque toutes les sessions et écrit un audit dans une seule transaction. Les anciens cookies ne sont pas réactivés. La route de réactivation reçoit code public, email et mot de passe, normalise code/e-mail, récupère le hash avec le rôle auth, vérifie le mot de passe et confirme le profil et l'adhésion OWNER actifs. La fonction SQL revalide l'adhésion avant de réactiver dans une transaction auth séparée. Une nouvelle session est créée dans une transaction suivante. Une requête déjà engagée au moment de la révocation peut se terminer.

Le limiteur de tentatives mémoire n'est pas distribué. Avant production, un contrôle partagé à la périphérie (proxy/WAF ou service équivalent) est impératif. Il n'y a aucun service d'envoi d'e-mail; le token d'invitation n'est retourné qu'une fois à l'appelant autorisé et ne doit être remis que par un canal approuvé.

## Tests préparés et exécution future

Les tests unitaires passent par `node --test tests/unit/authorization.test.mjs`. Les tests PostgreSQL utilisent `node --test tests/postgres/account-security.integration.test.mjs` avec `pg` déjà installé. La suite requiert `RESTOPLUS_TEST_DATABASE_CONFIRMATION=isolated-disposable`, `RESTOPLUS_TEST_APP_DATABASE_URL` et `RESTOPLUS_TEST_AUTH_DATABASE_URL`, configurées localement sans les partager. Elle vérifie le rôle effectif, refuse toute base qui ne ressemble pas à `restoplus_test...`, utilise uniquement des données synthétiques et ne supprime aucune donnée. Ne les lancer qu'après provisionnement autorisé et migration appliquée sur une base jetable distincte de `restoplus_dev`.

Tests obligatoires : tenants A/B et absence de contexte; réutilisation d'une connexion pool; contrôle direct des privilèges; OWNER autorisé à promouvoir un membre différent et actif; MANAGER autorisé aux changements non-OWNER mais refusé pour OWNER; auto-promotion refusée; compte inactif refusé; restauration du restaurant uniquement après authentification OWNER; sessions antérieures toujours révoquées; dernier OWNER protégé; invocations concurrentes de démotion; acceptation d'un token une seule fois même en concurrence; rollback sans écritures partielles; catalogues des rôles, policies, fonctions, propriétaires et ACL. Les tests d'acceptation concurrente et de réactivation doivent être ajoutés à la suite avant de déclarer le jalon complet.
