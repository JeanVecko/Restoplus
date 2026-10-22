-- ==============================================================================
-- Resto+ — Audit en lecture seule de la base de test isolée
-- Cible : restoplus_test_disposable uniquement.
-- Exécuter avec : psql -U restoplus_migrator -d restoplus_test_disposable -f scripts/audit-test-database.sql
-- Ce script ne modifie aucun objet ni privilège.
-- ==============================================================================

\set ON_ERROR_STOP on
\pset pager off

BEGIN READ ONLY;

-- 1. Vérification que nous sommes bien sur une base de test isolée
SELECT current_database() = 'restoplus_test_disposable' AS is_valid_test_db \gset
\if :is_valid_test_db
\else
\echo 'ERREUR: Ce script doit UNIQUEMENT s executer sur restoplus_test_disposable.'
\quit 3
\endif

\echo '=== 1. Identité de connexion et version serveur ==='
SELECT current_database() AS database_name,
       session_user,
       current_user,
       inet_server_addr() AS server_address,
       inet_server_port() AS server_port,
       version() AS server_version;

\echo '=== 2. Vérification des rôles requis et attributs de sécurité ==='
WITH required(role_name) AS (
    VALUES ('restoplus_migrator'),
           ('restoplus_app'),
           ('restoplus_auth'),
           ('restoplus_bootstrap_owner'),
           ('restoplus_account_ops')
)
SELECT required.role_name,
       roles.oid IS NOT NULL AS role_exists,
       roles.rolcanlogin AS can_login,
       roles.rolinherit AS inherit,
       roles.rolsuper AS superuser,
       roles.rolbypassrls AS bypassrls
FROM required
LEFT JOIN pg_roles AS roles ON roles.rolname = required.role_name
ORDER BY required.role_name;

\echo '=== 3. Vérification de l absence d élévation de rôle temporaire sur restoplus_migrator ==='
-- Doit être VIDE après post-migration-revoke-test.sql !
SELECT granted.rolname AS granted_role,
       member.rolname AS member_role,
       membership.set_option
FROM pg_auth_members AS membership
JOIN pg_roles AS granted ON granted.oid = membership.roleid
JOIN pg_roles AS member ON member.oid = membership.member
WHERE member.rolname = 'restoplus_migrator'
  AND granted.rolname IN ('restoplus_bootstrap_owner', 'restoplus_account_ops');

\echo '=== 4. Vérification de l activation et forçage de RLS sur les tables ==='
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       pg_get_userbyid(c.relowner) AS owner_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'restaurants', 'users', 'auth_credentials', 'memberships', 'sessions',
    'membership_invitations', 'security_audit_events', 'dining_tables',
    'orders', 'order_lines', 'kitchen_bar_tickets', 'receipts', 'payments',
    'order_audit_events'
  )
ORDER BY c.relname;

\echo '=== 5. Propriétaires des fonctions sécurisées du schéma privé ==='
SELECT n.nspname, p.proname, pg_get_userbyid(p.proowner) AS owner_name, p.prosecdef
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'restoplus_private'
ORDER BY p.proname;

COMMIT;
