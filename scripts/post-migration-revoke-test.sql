-- ==============================================================================
-- Resto+ — Révocation des appartenances temporaires post-migration
-- Cible : instance PostgreSQL contenant restoplus_test_disposable
-- À exécuter par un administrateur PostgreSQL (ex. postgres) immédiatement après migration
-- ==============================================================================

\set ON_ERROR_STOP on

REVOKE restoplus_bootstrap_owner FROM restoplus_migrator;
REVOKE restoplus_account_ops FROM restoplus_migrator;

\echo '------------------------------------------------------------------------------'
\echo 'Appartenances temporaires révoquées avec succès de restoplus_migrator.'
\echo 'restoplus_migrator ne possède plus aucun droit d élévation de rôle.'
\echo '------------------------------------------------------------------------------'
