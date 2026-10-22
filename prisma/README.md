# PostgreSQL et Prisma

Le schéma contient les entités d'identité, les commandes/caisse et le catalogue préparé. Les comptes sont indépendants par restaurant. Les références composites incluent le restaurant. Les paiements persistants restent désactivés par `FINANCIAL_POLICY_PENDING`.

## Configuration locale

Prisma CLI utilise `MIGRATION_DATABASE_URL`; le client serveur métier utilisera `APP_DATABASE_URL`, et les opérations pré-session/session utiliseront `AUTH_DATABASE_URL`. Ces connexions correspondent respectivement à `restoplus_migrator`, `restoplus_app` et `restoplus_auth`. Ne jamais utiliser le compte migrateur dans le serveur. Les valeurs réelles restent dans `.env` ignoré par Git; ne jamais les afficher ou versionner.

## Migration initiale en attente

`20261019000000_initial_technical_isolation` décrit les entités d'identité, invitation et audit, contraintes et index, policies RLS et fonctions protégées. Elle suppose que `restoplus_app`, `restoplus_auth`, `restoplus_migrator`, `restoplus_bootstrap_owner` et `restoplus_account_ops` sont provisionnés hors bande. Le détail des attributs et de la procédure de propriétaire est dans [postgres-role-provisioning.md](../docs/postgres-role-provisioning.md).

La fonction bootstrap `restoplus_private.bootstrap_restaurant_owner` est détenue par `restoplus_bootstrap_owner`, qui a uniquement les droits d'insertion nécessaires soumis à RLS. `restoplus_auth` peut l'exécuter, sans accès direct d'insertion aux tables d'identité. Le migrateur doit recevoir temporairement l'appartenance permettant `SET ROLE` pendant la création de la fonction; cette appartenance doit être révoquée immédiatement après. Si cette étape ne peut être contrôlée, ne pas exécuter la migration et faire approuver une autre procédure administrateur.

La migration n'a pas été appliquée. `restoplus_migrator` n'a pas de DML par défaut; une migration de données exige une procédure distincte, à privilèges temporaires minimaux, documentée et approuvée. Aucun `BYPASSRLS` n'est prévu.

La migration candidate `20261021100000_persistent_menu_catalog` ajoute catégories, produits, variantes, options et tarifs TERRACE/VIP, ainsi que `orders.pricingZone`. Elle est gardée pour `restoplus_test_disposable` et n'a pas été exécutée. Voir [la conception du catalogue](../docs/catalog-persistence-design.md).

## RLS et tests

Les politiques utilisent des paramètres PostgreSQL transactionnels locaux. Le wrapper Prisma tenant-aware est présent; les tests d'isolation et de réutilisation du pool sont décrits dans [acceptance-security.md](../docs/acceptance-security.md) et préparés, mais non exécutés sur PostgreSQL.

`npm run db:generate` génère le client dans `src/generated/prisma/`; `npm run db:validate` valide le schéma. Ces scripts ne prouvent ni l'application de la migration, ni l'efficacité des ACL/RLS. Les tests PostgreSQL et l'application de la migration nécessitent une autorisation distincte.

La révision statique ajoute `MembershipInvitation` et `SecurityAuditEvent`, et les fonctions limitées pour inviter/inscrire un membre, gérer rôle/statut, protéger le dernier OWNER actif et désactiver/réactiver un restaurant. `restoplus_account_ops` est un prérequis NOLOGIN/NOBYPASSRLS, défini et possédé hors bande; cette révision n'a créé aucun rôle PostgreSQL et ne lui a accordé aucun privilège sur une base existante. Les fonctions mutantes appartiennent à ce rôle et sont seules exécutables par les rôles runtime selon leur usage.

`withTenantTransaction` définit maintenant le contexte local à une transaction Prisma, à partir d'une session serveur validée. Les modules auth utilisent un client Prisma séparé. La migration est toujours en attente; aucune policy, fonction ni ACL n'est opérationnelle ou testée sur PostgreSQL.
