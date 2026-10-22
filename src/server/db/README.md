# Accès aux données

Le client Prisma métier est centralisé dans `prisma.ts` et utilise `APP_DATABASE_URL`; le client auth distinct est dans `auth-prisma.ts` et utilise `AUTH_DATABASE_URL`. La CLI Prisma utilise `MIGRATION_DATABASE_URL`. Ces connexions correspondent à `restoplus_app`, `restoplus_auth` et `restoplus_migrator`. `withTenantTransaction` définit le contexte local à la transaction et ne transmet que le client transactionnel. Les valeurs proviennent de la session serveur validée, jamais du navigateur.

Le rôle applicatif est distinct du rôle d'authentification et du rôle migrateur, ne doit pas être propriétaire des tables, ne contourne pas RLS et n'a pas de droit de suppression physique. `restoplus_account_ops` devra être provisionné hors bande en NOLOGIN/NOBYPASSRLS et ne peut être membre d'aucun runtime. Le schéma et la migration initiaux sont encore en attente; RLS n'est pas opérationnel et aucun test PostgreSQL d'isolation n'a été exécuté.
