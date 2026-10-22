-- Read-only PostgreSQL 18 catalog audit for Resto+ development.
-- Run with psql -X -W -v ON_ERROR_STOP=1 -f this-file.
-- This script does not create, alter, grant, revoke, or drop any object.

\set ON_ERROR_STOP on
\pset pager off

BEGIN READ ONLY;

SELECT current_database() = 'restoplus_dev'
   AND current_user = 'restoplus_migrator' AS audit_connection_ok \gset
\if :audit_connection_ok
\else
\echo 'Audit aborted: expected restoplus_migrator connected to restoplus_dev.'
\quit 3
\endif

\echo '=== Server and connection identity (expected database: restoplus_dev) ==='
SELECT current_database() AS database_name,
       current_database() = 'restoplus_dev' AS is_expected_database,
       session_user,
       current_user,
       inet_server_addr() AS server_address,
       inet_server_port() AS server_port,
       version() AS server_version;

\echo '=== Required roles and attributes ==='
WITH required(role_name) AS (
    VALUES ('restoplus_migrator'),
           ('restoplus_app'),
           ('restoplus_auth'),
           ('restoplus_bootstrap_owner'),
           ('restoplus_account_ops')
)
SELECT required.role_name,
       roles.oid IS NOT NULL AS role_exists,
       roles.rolcanlogin AS login,
       roles.rolinherit AS inherit,
       roles.rolsuper AS superuser,
       roles.rolcreatedb AS createdb,
       roles.rolcreaterole AS createrole,
       roles.rolreplication AS replication,
       roles.rolbypassrls AS bypassrls
FROM required
LEFT JOIN pg_roles AS roles ON roles.rolname = required.role_name
ORDER BY required.role_name;

\echo '=== Resto+ role memberships and INHERIT/SET/ADMIN options ==='
SELECT granted.rolname AS granted_role,
       member.rolname AS member_role,
       membership.inherit_option,
       membership.set_option,
       membership.admin_option
FROM pg_auth_members AS membership
JOIN pg_roles AS granted ON granted.oid = membership.roleid
JOIN pg_roles AS member ON member.oid = membership.member
WHERE granted.rolname LIKE 'restoplus_%'
   OR member.rolname LIKE 'restoplus_%'
ORDER BY granted_role, member_role;

\echo '=== Database ACL, including PUBLIC ==='
SELECT db.datname,
       COALESCE(grantee.rolname, 'PUBLIC') AS grantee,
       acl.privilege_type,
       acl.is_grantable
FROM pg_database AS db
CROSS JOIN LATERAL aclexplode(
    COALESCE(db.datacl, acldefault('d', db.datdba))
) AS acl
LEFT JOIN pg_roles AS grantee ON grantee.oid = acl.grantee
WHERE db.datname = current_database()
ORDER BY grantee, acl.privilege_type;

\echo '=== Effective database privileges for required roles ==='
WITH required(role_name) AS (
    VALUES ('restoplus_migrator'),
           ('restoplus_app'),
           ('restoplus_auth'),
           ('restoplus_bootstrap_owner'),
           ('restoplus_account_ops')
)
SELECT required.role_name,
       roles.oid IS NOT NULL AS role_exists,
       has_database_privilege(roles.oid, db.oid, 'CONNECT') AS can_connect,
       has_database_privilege(roles.oid, db.oid, 'CREATE') AS can_create,
       has_database_privilege(roles.oid, db.oid, 'TEMPORARY') AS can_create_temp
FROM required
CROSS JOIN pg_database AS db
LEFT JOIN pg_roles AS roles ON roles.rolname = required.role_name
WHERE db.datname = current_database()
ORDER BY required.role_name;

\echo '=== Schema owners, direct ACLs including PUBLIC, and effective role privileges ==='
WITH expected(schema_name) AS (
    VALUES ('public'), ('restoplus_private')
)
SELECT expected.schema_name,
       namespace.oid IS NOT NULL AS schema_exists,
       pg_get_userbyid(namespace.nspowner) AS owner_name
FROM expected
LEFT JOIN pg_namespace AS namespace ON namespace.nspname = expected.schema_name
ORDER BY expected.schema_name;

SELECT namespace.nspname AS schema_name,
       namespace.nspowner::regrole AS owner_name,
       COALESCE(grantee.rolname, 'PUBLIC') AS grantee,
       acl.privilege_type,
       acl.is_grantable
FROM pg_namespace AS namespace
CROSS JOIN LATERAL aclexplode(
    COALESCE(namespace.nspacl, acldefault('n', namespace.nspowner))
) AS acl
LEFT JOIN pg_roles AS grantee ON grantee.oid = acl.grantee
WHERE namespace.nspname IN ('public', 'restoplus_private')
ORDER BY namespace.nspname, grantee, acl.privilege_type;

WITH required(role_name) AS (
    VALUES ('restoplus_migrator'),
           ('restoplus_app'),
           ('restoplus_auth'),
           ('restoplus_bootstrap_owner'),
           ('restoplus_account_ops')
)
SELECT namespace.nspname AS schema_name,
       required.role_name,
       roles.oid IS NOT NULL AS role_exists,
       has_schema_privilege(roles.oid, namespace.oid, 'USAGE') AS can_use,
       has_schema_privilege(roles.oid, namespace.oid, 'CREATE') AS can_create
FROM pg_namespace AS namespace
CROSS JOIN required
LEFT JOIN pg_roles AS roles ON roles.rolname = required.role_name
WHERE namespace.nspname IN ('public', 'restoplus_private')
ORDER BY namespace.nspname, required.role_name;

\echo '=== Explicit global and schema default privileges for Resto+ roles ==='
\echo 'If this query returns no rows, no explicit default ACL rows exist; normal PostgreSQL defaults still apply.'
SELECT defaults.defaclrole::regrole AS object_creator,
       COALESCE(namespace.nspname, '(global)') AS schema_name,
       defaults.defaclobjtype AS object_type,
       COALESCE(grantee.rolname, 'PUBLIC') AS grantee,
       acl.privilege_type,
       acl.is_grantable
FROM pg_default_acl AS defaults
LEFT JOIN pg_namespace AS namespace ON namespace.oid = defaults.defaclnamespace
CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS acl
LEFT JOIN pg_roles AS grantee ON grantee.oid = acl.grantee
WHERE defaults.defaclrole IN (
    SELECT oid FROM pg_roles
    WHERE rolname IN (
        'restoplus_migrator', 'restoplus_app', 'restoplus_auth',
        'restoplus_bootstrap_owner', 'restoplus_account_ops'
    )
)
  AND (defaults.defaclnamespace = 0 OR namespace.nspname IN ('public', 'restoplus_private'))
ORDER BY schema_name, object_creator, object_type, grantee, acl.privilege_type;

\echo '=== Expected Prisma tables, owner, and RLS state ==='
WITH expected(table_name) AS (
    VALUES ('restaurants'),
           ('users'),
           ('auth_credentials'),
           ('memberships'),
           ('sessions'),
           ('membership_invitations'),
           ('security_audit_events'),
           ('_prisma_migrations')
)
SELECT 'public' AS schema_name,
       expected.table_name,
       relation.oid IS NOT NULL AS object_exists,
       relation.relkind AS relation_kind,
       pg_get_userbyid(relation.relowner) AS owner_name,
       relation.relrowsecurity AS rls_enabled,
       relation.relforcerowsecurity AS rls_forced
FROM expected
LEFT JOIN pg_namespace AS namespace ON namespace.nspname = 'public'
LEFT JOIN pg_class AS relation
       ON relation.relnamespace = namespace.oid
      AND relation.relname = expected.table_name
ORDER BY expected.table_name;

\echo '=== Other objects in restoplus_private ==='
SELECT namespace.nspname AS schema_name,
       relation.relname AS object_name,
       relation.relkind AS object_kind,
       pg_get_userbyid(relation.relowner) AS owner_name,
       relation.relrowsecurity AS rls_enabled,
       relation.relforcerowsecurity AS rls_forced
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'restoplus_private'
ORDER BY relation.relkind, relation.relname;

\echo '=== Expected Prisma enums and values ==='
SELECT namespace.nspname AS schema_name,
       typ.typname AS enum_name,
       pg_get_userbyid(typ.typowner) AS owner_name,
       e.enumlabel AS enum_value,
       e.enumsortorder
FROM pg_type AS typ
JOIN pg_namespace AS namespace ON namespace.oid = typ.typnamespace
LEFT JOIN pg_enum AS e ON e.enumtypid = typ.oid
WHERE namespace.nspname = 'public'
  AND typ.typname IN ('membership_role', 'membership_invitation_status')
ORDER BY typ.typname, e.enumsortorder;

\echo '=== Existing functions in restoplus_private ==='
SELECT namespace.nspname AS schema_name,
       proc.proname AS function_name,
       pg_get_function_identity_arguments(proc.oid) AS arguments,
       pg_get_userbyid(proc.proowner) AS owner_name,
       proc.prosecdef AS security_definer,
       proc.proconfig AS function_settings,
       COALESCE(grantee.rolname, 'PUBLIC') AS grantee,
       function_acl.privilege_type,
       function_acl.is_grantable
FROM pg_proc AS proc
JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
CROSS JOIN LATERAL aclexplode(
    COALESCE(proc.proacl, acldefault('f', proc.proowner))
) AS function_acl
LEFT JOIN pg_roles AS grantee ON grantee.oid = function_acl.grantee
WHERE namespace.nspname = 'restoplus_private'
ORDER BY proc.proname, grantee, function_acl.privilege_type;

\echo '=== Effective EXECUTE privileges on existing private functions ==='
WITH required(role_name) AS (
    VALUES ('restoplus_migrator'),
           ('restoplus_app'),
           ('restoplus_auth'),
           ('restoplus_bootstrap_owner'),
           ('restoplus_account_ops')
)
SELECT proc.proname AS function_name,
       pg_get_function_identity_arguments(proc.oid) AS arguments,
       required.role_name,
       roles.oid IS NOT NULL AS role_exists,
       has_function_privilege(roles.oid, proc.oid, 'EXECUTE') AS can_execute
FROM pg_proc AS proc
JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
CROSS JOIN required
LEFT JOIN pg_roles AS roles ON roles.rolname = required.role_name
WHERE namespace.nspname = 'restoplus_private'
ORDER BY proc.proname, required.role_name;

\echo '=== Effective table privileges on existing Prisma tables ==='
WITH required(role_name) AS (
    VALUES ('restoplus_migrator'),
           ('restoplus_app'),
           ('restoplus_auth'),
           ('restoplus_bootstrap_owner'),
           ('restoplus_account_ops')
),
privs(privilege_name) AS (
    VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
           ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
)
SELECT namespace.nspname AS schema_name,
       relation.relname AS table_name,
       required.role_name,
       privs.privilege_name,
       has_table_privilege(roles.oid, relation.oid, privs.privilege_name) AS effective
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
CROSS JOIN required
CROSS JOIN privs
LEFT JOIN pg_roles AS roles ON roles.rolname = required.role_name
WHERE relation.relkind IN ('r', 'p')
  AND namespace.nspname = 'public'
  AND relation.relname IN (
      'restaurants', 'users', 'auth_credentials', 'memberships', 'sessions',
      'membership_invitations', 'security_audit_events', '_prisma_migrations'
  )
ORDER BY relation.relname, required.role_name, privs.privilege_name;

\echo '=== Effective column-level privileges on existing Prisma tables ==='
WITH required(role_name) AS (
    VALUES ('restoplus_migrator'),
           ('restoplus_app'),
           ('restoplus_auth'),
           ('restoplus_bootstrap_owner'),
           ('restoplus_account_ops')
),
column_privs(privilege_name) AS (
    VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')
)
SELECT namespace.nspname AS schema_name,
       relation.relname AS table_name,
       attribute.attname AS column_name,
       required.role_name,
       column_privs.privilege_name,
       has_column_privilege(
           roles.oid,
           relation.oid,
           attribute.attnum,
           column_privs.privilege_name
       ) AS effective
FROM pg_attribute AS attribute
JOIN pg_class AS relation ON relation.oid = attribute.attrelid
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
CROSS JOIN required
CROSS JOIN column_privs
LEFT JOIN pg_roles AS roles ON roles.rolname = required.role_name
WHERE namespace.nspname = 'public'
  AND relation.relkind IN ('r', 'p')
  AND relation.relname IN (
      'restaurants', 'users', 'auth_credentials', 'memberships', 'sessions',
      'membership_invitations', 'security_audit_events', '_prisma_migrations'
  )
  AND attribute.attnum > 0
  AND NOT attribute.attisdropped
  AND has_column_privilege(
      roles.oid,
      relation.oid,
      attribute.attnum,
      column_privs.privilege_name
  )
ORDER BY relation.relname, attribute.attnum, required.role_name, column_privs.privilege_name;

\echo '=== Existing constraints and indexes on Prisma objects ==='
SELECT namespace.nspname AS schema_name,
       relation.relname AS table_name,
       constraint_info.conname AS object_name,
       constraint_info.contype AS constraint_type,
       pg_get_constraintdef(constraint_info.oid, true) AS definition
FROM pg_constraint AS constraint_info
JOIN pg_class AS relation ON relation.oid = constraint_info.conrelid
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relname IN (
      'restaurants', 'users', 'auth_credentials', 'memberships', 'sessions',
      'membership_invitations', 'security_audit_events', '_prisma_migrations'
  )
ORDER BY relation.relname, constraint_info.conname;

SELECT schemaname AS schema_name,
       tablename AS table_name,
       indexname AS index_name,
       indexdef AS definition
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
      'restaurants', 'users', 'auth_credentials', 'memberships', 'sessions',
      'membership_invitations', 'security_audit_events', '_prisma_migrations'
  )
ORDER BY tablename, indexname;

\echo '=== Existing triggers on expected Prisma tables ==='
SELECT namespace.nspname AS schema_name,
       relation.relname AS table_name,
       trg.tgname AS trigger_name,
       pg_get_triggerdef(trg.oid, true) AS definition
FROM pg_trigger AS trg
JOIN pg_class AS relation ON relation.oid = trg.tgrelid
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE NOT trg.tgisinternal
  AND namespace.nspname = 'public'
  AND relation.relname IN (
      'restaurants', 'users', 'auth_credentials', 'memberships', 'sessions',
      'membership_invitations', 'security_audit_events', '_prisma_migrations'
  )
ORDER BY relation.relname, trg.tgname;

\echo '=== Existing RLS policies on expected Prisma tables ==='
SELECT schemaname,
       tablename,
       policyname,
       roles,
       cmd,
       qual,
       with_check
FROM pg_policies
WHERE schemaname IN ('public', 'restoplus_private')
ORDER BY schemaname, tablename, policyname;

\echo '=== Prisma migration ledger state ==='
SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS audit_has_migration_ledger \gset
\if :audit_has_migration_ledger
SELECT migration_name,
       started_at,
       finished_at,
       rolled_back_at,
       CASE
           WHEN rolled_back_at IS NOT NULL THEN 'rolled back'
           WHEN finished_at IS NOT NULL THEN 'finished'
           ELSE 'unfinished'
       END AS recorded_state
FROM public."_prisma_migrations"
ORDER BY started_at, migration_name;
\else
\echo 'No public._prisma_migrations table exists.'
\endif

COMMIT;
