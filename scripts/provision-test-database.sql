-- ==============================================================================
-- Resto+ — Script administratif de provisionnement de la base de test isolée
-- Cible : restoplus_test_disposable (NE MODIFIE PAS restoplus_dev)
-- À exécuter par un administrateur PostgreSQL (ex. postgres ou superutilisateur)
-- ==============================================================================

\set ON_ERROR_STOP on

-- Garde-fou strict : Interdiction d'exécuter ce script connecté sur restoplus_dev
DO $$
BEGIN
    IF current_database() = 'restoplus_dev' THEN
        RAISE EXCEPTION 'SÉCURITÉ: Ce script de test ne doit pas être exécuté connecté à restoplus_dev !';
    END IF;
END $$;

-- 1. Vérification / Création des rôles requis au niveau de l'instance
-- ------------------------------------------------------------------

-- restoplus_migrator (Connexion DDL de migration)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'restoplus_migrator') THEN
        CREATE ROLE restoplus_migrator WITH LOGIN PASSWORD 'CHANGEME_MIGRATOR_SECRET'
            NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
        RAISE NOTICE 'Rôle restoplus_migrator créé.';
    ELSE
        RAISE NOTICE 'Rôle restoplus_migrator déjà présent.';
    END IF;
END $$;

-- restoplus_app (Connexion runtime du tenant)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'restoplus_app') THEN
        CREATE ROLE restoplus_app WITH LOGIN PASSWORD 'CHANGEME_APP_SECRET'
            NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
        RAISE NOTICE 'Rôle restoplus_app créé.';
    ELSE
        RAISE NOTICE 'Rôle restoplus_app déjà présent.';
    END IF;
END $$;

-- restoplus_auth (Connexion runtime de l'authentification)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'restoplus_auth') THEN
        CREATE ROLE restoplus_auth WITH LOGIN PASSWORD 'CHANGEME_AUTH_SECRET'
            NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
        RAISE NOTICE 'Rôle restoplus_auth créé.';
    ELSE
        RAISE NOTICE 'Rôle restoplus_auth déjà présent.';
    END IF;
END $$;

-- restoplus_bootstrap_owner (Propriétaire NOLOGIN de la fonction bootstrap)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'restoplus_bootstrap_owner') THEN
        CREATE ROLE restoplus_bootstrap_owner WITH NOLOGIN
            NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
        RAISE NOTICE 'Rôle restoplus_bootstrap_owner créé.';
    ELSE
        RAISE NOTICE 'Rôle restoplus_bootstrap_owner déjà présent.';
    END IF;
END $$;

-- restoplus_account_ops (Propriétaire NOLOGIN des fonctions de gestion de comptes)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'restoplus_account_ops') THEN
        CREATE ROLE restoplus_account_ops WITH NOLOGIN
            NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
        RAISE NOTICE 'Rôle restoplus_account_ops créé.';
    ELSE
        RAISE NOTICE 'Rôle restoplus_account_ops déjà présent.';
    END IF;
END $$;

-- 2. Création de la base de test isolée restoplus_test_disposable
-- -------------------------------------------------------------
SELECT 'CREATE DATABASE restoplus_test_disposable OWNER restoplus_migrator'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'restoplus_test_disposable')\gexec

-- Autoriser la connexion aux rôles applicatifs sur cette base de test
GRANT CONNECT ON DATABASE restoplus_test_disposable TO restoplus_migrator, restoplus_app, restoplus_auth;

-- 3. Initialisation des schémas dans restoplus_test_disposable
-- -----------------------------------------------------------
\connect restoplus_test_disposable

-- Schéma privé possédé par le migrateur
CREATE SCHEMA IF NOT EXISTS restoplus_private AUTHORIZATION restoplus_migrator;

-- Droits minimaux sur le schéma public
GRANT USAGE, CREATE ON SCHEMA public TO restoplus_migrator;
GRANT USAGE ON SCHEMA public TO restoplus_app, restoplus_auth;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, restoplus_app, restoplus_auth;

-- 4. Appartenances temporaires pour la migration
-- ----------------------------------------------
-- Nécessaire pour permettre les "SET ROLE restoplus_bootstrap_owner" et
-- "SET ROLE restoplus_account_ops" exécutés par migration.sql
GRANT restoplus_bootstrap_owner TO restoplus_migrator WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;
GRANT restoplus_account_ops TO restoplus_migrator WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;

\echo '------------------------------------------------------------------------------'
\echo 'Base restoplus_test_disposable provisionnée avec succès.'
\echo 'Les appartenances temporaires de migration sont accordées à restoplus_migrator.'
\echo ''
\echo 'Prochaine étape :'
\echo '1. Appliquer la migration avec restoplus_migrator sur restoplus_test_disposable :'
\echo '   psql -U restoplus_migrator -d restoplus_test_disposable -f prisma/migrations/20261019000000_initial_technical_isolation/migration.sql'
\echo '2. Exécuter immédiatement le script de clôture :'
\echo '   psql -U postgres -d restoplus_test_disposable -f scripts/post-migration-revoke-test.sql'
\echo '------------------------------------------------------------------------------'
