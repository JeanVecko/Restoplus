# Sécurité et isolation multi-restaurant

## État

Selon l'audit remis par le développeur, la migration initiale a été appliquée uniquement sur la base jetable `restoplus_test_disposable`; les sept tables techniques y ont RLS activé et forcé, et les neuf tests PostgreSQL de sécurité rapportés ont réussi. Cette preuve concerne cette base de test seulement. Aucune migration n'est autorisée ni réputée appliquée sur `restoplus_dev` ou en production par le présent audit. RLS et les privilèges effectifs de ces environnements restent à vérifier avant leur usage.

Le contexte de menace visé est la prévention des erreurs applicatives et des oublis de filtres. Cette conception ne résiste pas à un serveur applicatif compromis : une application compromise utilisant `restoplus_app` peut définir des paramètres PostgreSQL personnalisés.

Toute migration destinée à `restoplus_dev` ou à la production nécessite une autorisation distincte, la vérification des prérequis et une procédure dédiée.

## Modèle d'identité et de tenant

- `Restaurant.publicCode` est généré côté serveur, unique, stable et jamais réutilisé. L'archivage/désactivation conserve l'enregistrement et son code.
- `User` représente un profil appartenant à un seul restaurant.
- `AuthCredential` sépare l'e-mail normalisé et le hash de mot de passe du profil. L'e-mail est normalisé côté serveur par suppression des espaces extérieurs puis conversion en minuscules; l'unicité est `(restaurantId, emailNormalized)`.
- `Membership` porte l'un des six rôles `OWNER`, `MANAGER`, `CASHIER`, `WAITER`, `KITCHEN`, `STOCK_MANAGER`. L'unicité de `userId` interdit plusieurs adhésions/rôles principaux pour un même compte.
- `Session` stocke une empreinte de jeton, un restaurant et un utilisateur, avec révocation, suivi d'activité et échéance absolue. Le serveur impose au plus 30 minutes d'inactivité et 12 heures de durée absolue.
- Les références profil/adhésion/identifiant/session utilisent des clés étrangères composites comprenant `restaurantId` afin d'interdire une association inter-restaurant.

La base impose actuellement le format minuscule sans espaces extérieurs avec `lower(btrim(...))`, l'unicité et l'absence de suppression via privilèges/policies et trigger. La génération aléatoire et la garantie de non-réutilisation dans les opérations d'administration restent une responsabilité de l'application et de la procédure opératoire. La correspondance exacte entre `String.trim().toLowerCase()` et les fonctions/collations PostgreSQL pour les caractères Unicode doit être validée avant de figer les adresses admises.

Les rôles sont un catalogue technique approuvé; leurs autorisations métier restent à valider côté serveur. Aucune permission financière n'est définie dans ce document. Les droits concernant remboursements, annulations, clôtures de caisse et rapports financiers attendent les validations métier et fiscales.

## Rôles PostgreSQL et bootstrap

`restoplus_migrator` est réservé au DDL contrôlé; il n'a pas de DML par défaut et n'est pas `BYPASSRLS`. `restoplus_app` est non propriétaire, `NOSUPERUSER`, `NOBYPASSRLS`, sans appartenance au migrateur ni droits DDL, `DELETE`, `TRUNCATE`, `REFERENCES` ou `TRIGGER`. Il n'a aucun accès à `auth_credentials` ou `sessions`. Les droits restants sont limités à des colonnes explicites et aux policies du tenant.

`restoplus_auth` est un rôle runtime séparé, non propriétaire, sans DDL ni `BYPASSRLS`. Il peut rechercher un restaurant par code exact, un credential par restaurant et e-mail normalisé, lire le profil/membership courant, et lire/insérer/mettre à jour des sessions selon des colonnes autorisées et des policies. Il ne peut pas écrire directement dans les tables d'identité ni supprimer. Ses fonctions autorisées sont le bootstrap, l'acceptation/inspection d'une invitation et la réactivation après vérification serveur du mot de passe OWNER.

Les rôles ont des privilèges `SELECT` par colonne. Les requêtes Prisma d'authentification doivent donc projeter explicitement les champs requis, notamment lors du chargement du credential; aucun accès implicite global aux credentials ne doit être ajouté.

La fonction `restoplus_private.bootstrap_restaurant_owner` est détenue par `restoplus_bootstrap_owner` (`NOLOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`). Ce rôle reçoit `INSERT` sur les quatre tables techniques et le journal initial d'audit, toujours sous RLS. La création de membres ultérieurs passe par les fonctions possédées par `restoplus_account_ops`. Le runtime auth reçoit seulement `EXECUTE` aux fonctions explicitement nécessaires, pas d'accès direct `INSERT` aux tables d'identité. Le provisionnement de chacun des deux propriétaires de fonctions nécessite une appartenance temporaire contrôlée du migrateur à révoquer aussitôt. Voir `postgres-role-provisioning.md`.

Les privilèges effectifs doivent être inspectés sur la base et testés après application. Les instructions `GRANT`/`REVOKE` du fichier de migration ne prouvent pas à elles seules l'absence de droits hérités de rôles ou de privilèges par défaut.

## Politiques RLS prévues

La migration active et force RLS sur les cinq tables. Ses politiques `SELECT`, `INSERT` et `UPDATE` sont ciblées sur `restoplus_app` et comparent le tenant au paramètre transactionnel `app.restaurant_id`. Les politiques d'écriture utilisent `WITH CHECK` pour interdire qu'une insertion ou mise à jour déplace une ligne vers un autre restaurant. Une valeur de contexte absente donne `NULL` et ne correspond à aucune ligne. `sessions` exige en plus `app.user_id` pour limiter ses lignes au compte courant.

Résumé opérationnel :

| Table              | SELECT                                                                           | INSERT                                                 | UPDATE                                                 | DELETE                                  |
| ------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------- |
| `restaurants`      | app: tenant; auth: code exact actif                                              | fonction bootstrap seulement                           | app: tenant; auth: aucun                               | Aucun droit runtime                     |
| `users`            | app: tenant; auth: utilisateur courant                                           | app: tenant; fonction bootstrap: tenant courant        | app: tenant; auth: aucun                               | Aucun droit runtime                     |
| `auth_credentials` | auth: restaurant + e-mail normalisé exact; app: aucun                            | fonction bootstrap seulement                           | Aucun droit runtime                                    | Aucun droit runtime                     |
| `memberships`      | app: tenant; auth: membership courant                                            | app: tenant; fonction bootstrap: tenant + rôle `OWNER` | app: tenant; auth: aucun                               | Aucun droit runtime                     |
| `sessions`         | auth: empreinte exacte du jeton avant contexte, ou tenant + utilisateur courants | auth: tenant + utilisateur courants                    | auth: tenant + utilisateur courants, colonnes limitées | Aucun droit runtime; révocation logique |

Les policies sont proposées dans la migration non appliquée. Les politiques ne réalisent pas les contrôles métier de rôle; ces contrôles restent obligatoires côté serveur. La recherche de session est exacte par empreinte; les délais, la révocation et l'état actif restent des contrôles applicatifs. Une révocation prend effet à la prochaine validation; une requête déjà engagée peut se terminer. `FORCE ROW LEVEL SECURITY` ne neutralise ni les superusers ni un rôle `BYPASSRLS`.

## Accès Prisma et contexte de transaction

Chaque unité tenant devra utiliser une transaction Prisma interactive courte. Le serveur valide d'abord la session et l'adhésion, puis passe à une fonction de dépôt le restaurant et l'utilisateur issus de cette session validée, jamais des seuls champs du navigateur. Dans le callback de transaction, le wrapper définit de manière paramétrée `app.restaurant_id` et `app.user_id` avec une portée locale à la transaction (`set_config(..., true)` ou `SET LOCAL`), puis ne transmet aux dépôts que le client `tx`.

Interdictions : paramètre défini au niveau session/connexion, concaténation SQL, requête tenant via le client global, fuite du client transactionnel hors callback, ou requête métier avant la validation du contexte. L'absence de contexte doit échouer fermé. Le wrapper applicatif définit le contexte seulement avec `set_config(..., true)` dans une transaction interactive. Le bootstrap, l'acceptation et la création de session sont des transactions distinctes.

Le contexte GUC n'est pas une preuve cryptographique de l'identité. Tout code serveur ayant accès à `restoplus_app` peut tenter de changer ce contexte; la stratégie réduit les erreurs de programmation et ne protège pas contre la compromission de l'application.

## Sessions et récupération

Le cookie de session devra être `HttpOnly`, `Secure` en production et doté d'un `SameSite` explicite. La base ne stocke que l'empreinte du jeton. Le serveur vérifie `revokedAt`, l'activité, l'expiration d'inactivité (30 minutes maximum) et l'échéance absolue (12 heures maximum) à chaque validation. Déconnexion et révocation sont logiques; aucune suppression physique n'est nécessaire.

Le canal de récupération de compte n'est pas décidé ni implémenté. La politique de rotation et d'invalidation globale des sessions reste à préciser. La limitation des tentatives de connexion/réactivation en mémoire est locale au processus et ne remplace pas une protection distribuée; les routes ne doivent pas être exposées en production avant qu'un contrôle à l'edge/WAF soit établi.

## Validation obligatoire

Voir [acceptance-security.md](acceptance-security.md). RLS ne sera considéré opérationnel qu'après application autorisée de la migration, vérification des privilèges réels et réussite des tests sur PostgreSQL avec les rôles dédiés. Toute lecture/écriture croisée ou fuite de contexte est bloquante.

## Gestion des membres, invitations et audit

La matrice appliquée aux opérations de compte est : OWNER et MANAGER gèrent les membres; MANAGER peut attribuer un rôle différent de OWNER et modifier les statuts; seul un OWNER actif peut promouvoir un autre membre actif en OWNER. L'auto-promotion est refusée et MANAGER ne peut modifier aucun compte OWNER. Désactiver l'adhésion ou le profil révoque les sessions de la personne. La fonction PostgreSQL vérifie de nouveau tenant, rôle, acteur et états.

La dernière adhésion OWNER active ne peut être rétrogradée ou désactivée, et le dernier profil OWNER actif ne peut être désactivé. `manage_member` prend un verrou transactionnel par restaurant avant de compter les OWNER actifs afin de sérialiser les changements concurrents. Aucune écriture directe de gestion n'est accordée à `restoplus_app`. Les fonctions ciblées appartiennent à `restoplus_account_ops`, rôle NOLOGIN/NOBYPASSRLS non accordé aux rôles runtime; ce rôle n'est pas provisionné par cette étape.

`MembershipInvitation` n'accepte que des rôles différents de OWNER. Le token aléatoire de 256 bits n'est stocké que sous forme SHA-256 et l'acceptation crée profil, identifiant et adhésion dans une transaction atomique. La durée technique préparée est de sept jours; la durée métier reste à confirmer avant production. Aucun fournisseur d'e-mail n'est configuré : le token est retourné une seule fois au demandeur autorisé et doit être livré par un canal approuvé.

`SecurityAuditEvent` journalise les invitations, les changements de rôle/statut et l'activation/désactivation du restaurant, sans mot de passe, hash de mot de passe, token ni e-mail. Le runtime ne peut ni modifier ni supprimer les événements; leur consultation n'est pas encore exposée.

### Désactivation et réactivation du restaurant

Seul un OWNER actif peut désactiver le restaurant. Cette opération révoque les sessions dans la même transaction et inscrit l'événement d'audit. La réactivation n'accepte pas une session existante : le parcours dédié demande code public, e-mail normalisé et mot de passe, vérifie le hash, le profil actif et l'adhésion OWNER active par le client auth, puis appelle la fonction SQL qui revalide l'adhésion et réactive le restaurant dans une transaction distincte. Après commit, une nouvelle session est créée dans une autre transaction auth. Les sessions précédentes restent révoquées; une requête déjà engagée peut se terminer.

Le limiteur actuellement en mémoire (cinq tentatives par restaurant/e-mail sur quinze minutes) ne résiste pas à plusieurs processus et n'est qu'un garde-fou local. Un contrôle distribué par proxy/WAF est obligatoire avant toute exposition publique. Le fournisseur d'e-mail, le canal de livraison des invitations, la durée métier d'expiration et la consultation des journaux restent ouverts. Aucune permission financière n'est définie.
