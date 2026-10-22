-- ==============================================================================
-- Resto+ — Suppression propre et sécurisée de la base de test isolée
-- Cible stricte : restoplus_test_disposable (NE PEUT SUPPRIMER AUCUNE AUTRE BASE)
-- Exécution : psql -U postgres -d restoplus_test_disposable -f scripts/teardown-test-database.sql
-- ==============================================================================

\set ON_ERROR_STOP on

-- 1. Contrôle préalable : refuser impérativement si la base courante n'est pas exactement restoplus_test_disposable
SELECT current_database() = 'restoplus_test_disposable' AS is_target_disposable_db \gset
\if :is_target_disposable_db
    \echo 'Validation de sécurité : connexion confirmée sur restoplus_test_disposable.'
\else
    \echo 'SÉCURITÉ BLOQUANTE: teardown-test-database.sql refuse de s exécuter si la base courante n est pas exactement restoplus_test_disposable.'
    \echo 'La base courante est protégée et ne sera pas modifiée.'
    \quit 3
\endif

-- 2. Basculer sur la base de maintenance postgres pour permettre le DROP
\connect postgres

DO $$
BEGIN
    IF current_database() NOT IN ('postgres', 'template1') THEN
        RAISE EXCEPTION 'SÉCURITÉ: Reconnexion échouée, base active inattendue: %', current_database();
    END IF;
END $$;

-- 3. Déconnecter exclusivement les sessions actives sur restoplus_test_disposable
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'restoplus_test_disposable'
  AND pid <> pg_backend_pid();

-- 4. Suppression stricte de restoplus_test_disposable uniquement (nom codé en dur, aucun paramètre dynamique)
DROP DATABASE restoplus_test_disposable;

\echo '------------------------------------------------------------------------------'
\echo 'Succès: Base restoplus_test_disposable supprimée.'
\echo 'Garantie: restoplus_dev et toutes les autres bases sont restées intactes.'
\echo '------------------------------------------------------------------------------'
