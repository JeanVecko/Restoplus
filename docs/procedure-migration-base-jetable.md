# Procédure de Migration et Recette sur Base Jetable

Ce document décrit la procédure pas-à-pas pour tester et valider la migration initiale PostgreSQL et les politiques d'isolation Row Level Security (RLS) sur une base de données de test isolée et jetable (`restoplus_test_disposable`), **sans impacter la base de développement `restoplus_dev`**.

Toutes les commandes ci-dessous sont validées pour **Windows PowerShell 5.1** et gèrent la détection automatique de l'exécutable `psql.exe` sous `C:\Program Files\PostgreSQL\18\bin`.

---

## Vue d'ensemble du cycle de vie

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrateur PostgreSQL (postgres)
    actor Migrator as Migrateur DDL (restoplus_migrator)
    actor Dev as Développeur / Suite de tests
    participant DB as PostgreSQL (restoplus_test_disposable)

    Note over Admin,DB: Étape 1 — Provisionnement isolé
    Admin->>DB: Exécution de scripts/provision-test-database.sql
    Note right of DB: Base restoplus_test_disposable créée<br/>5 rôles vérifiés/créés<br/>Appartenances temporaires accordées

    Note over Migrator,DB: Étape 2 — Déploiement de la migration
    Migrator->>DB: Application de migration.sql
    Note right of DB: Tables créées, RLS forcé, fonctions créées

    Note over Admin,DB: Étape 3 — Révocation des privilèges temporaires
    Admin->>DB: Exécution de scripts/post-migration-revoke-test.sql
    Note right of DB: Appartenances temporaires révoquées

    Note over Dev,DB: Étape 4 — Audit & Vérification RLS
    Dev->>DB: Audit en lecture seule (scripts/audit-test-database.sql)

    Note over Dev,DB: Étape 5 — Tests d'intégration PostgreSQL & HTTP
    Dev->>DB: Exécution tests PostgreSQL (test:postgres:security & test:postgres:orders)
    Dev->>DB: Amorçage fixtures HTTP (seed-http-test-fixtures.mjs)
    Dev->>DB: Exécution tests HTTP (test:http:security & test:http:orders)

    Note over Admin,DB: Étape 6 — Nettoyage propre
    Admin->>DB: Exécution de scripts/teardown-test-database.sql
    Note right of DB: Base restoplus_test_disposable supprimée<br/>restoplus_dev intacte
```

---

## Initialisation de la session PowerShell

Dans une fenêtre PowerShell exécutée en tant qu'administrateur :

```powershell
$ErrorActionPreference = "Stop"

# Détection automatique de psql sous Windows
$psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
$psql = if ($psqlCmd) { $psqlCmd.Source } elseif (Test-Path "C:\Program Files\PostgreSQL\18\bin\psql.exe") { "C:\Program Files\PostgreSQL\18\bin\psql.exe" } else { $null }
if (-not $psql) {
    throw "psql.exe introuvable. Installez PostgreSQL 18 ou ajoutez son dossier bin au PATH."
}
```

---

## Étape 1 : Provisionnement administratif (Compte `postgres`)

```powershell
& $psql -U postgres -f scripts/provision-test-database.sql
if ($LASTEXITCODE -ne 0) { throw "Échec de l'étape 1 (Provisionnement)." }
```

**Garanties de ce script :**

- Vérifie et crée uniquement les rôles manquants parmi les 5 requis (`restoplus_migrator`, `restoplus_app`, `restoplus_auth`, `restoplus_bootstrap_owner`, `restoplus_account_ops`).
- Ne modifie aucun rôle existant et n'accorde aucun privilège `SUPERUSER` ou `BYPASSRLS`.
- Crée la base isolée `restoplus_test_disposable` (propriétaire `restoplus_migrator`).
- Refuse catégoriquement de s'exécuter s'il est connecté sur `restoplus_dev`.
- Accorde temporairement les appartenances `SET ROLE` au migrateur (`WITH INHERIT FALSE, SET TRUE, ADMIN FALSE`).

---

## Étape 2 : Déploiement des migrations (Compte `restoplus_migrator`)

Les migrations doivent être appliquées successivement et exclusivement par le rôle `restoplus_migrator` sur la base jetable :

1. **Migration 1 — Socle technique et isolation des comptes** :

   ```powershell
   & $psql -U restoplus_migrator -d restoplus_test_disposable -f prisma/migrations/20261019000000_initial_technical_isolation/migration.sql
   if ($LASTEXITCODE -ne 0) { throw "Échec de l'étape 2 (Migration 1 - Socle)." }
   ```

2. **Migration 2 — Module Commandes, Caisse, Bons Cuisine/Bar et RLS** :
   ```powershell
   & $psql -U restoplus_migrator -d restoplus_test_disposable -f prisma/migrations/20261021000000_orders_and_cashier/migration.sql
   if ($LASTEXITCODE -ne 0) { throw "Échec de l'étape 2 (Migration 2 - Commandes)." }
   ```

---

## Étape 3 : Révocation immédiate des appartenances temporaires (Compte `postgres`)

Immédiatement après le déploiement réussi, refermer la fenêtre d'élévation :

```powershell
& $psql -U postgres -d restoplus_test_disposable -f scripts/post-migration-revoke-test.sql
if ($LASTEXITCODE -ne 0) { throw "Échec de l'étape 3 (Révocation)." }
```

Ce script retire `restoplus_bootstrap_owner` et `restoplus_account_ops` de `restoplus_migrator`.

---

## Étape 4 : Audit de conformité RLS (Lecture seule)

Vérifier la bonne configuration de la base jetable :

```powershell
& $psql -U restoplus_migrator -d restoplus_test_disposable -f scripts/audit-test-database.sql
if ($LASTEXITCODE -ne 0) { throw "Échec de l'étape 4 (Audit RLS)." }
```

**Critères de conformité attendus :**

- [ ] La base de connexion est bien `restoplus_test_disposable`.
- [ ] Les appartenances de `restoplus_migrator` à `restoplus_bootstrap_owner` et `restoplus_account_ops` sont **vides** (0 ligne retournée).
- [ ] `relrowsecurity` = `true` et `relforcerowsecurity` = `true` sur toutes les tables.
- [ ] Les fonctions privées appartiennent à leurs propriétaires dédiés (`restoplus_bootstrap_owner` et `restoplus_account_ops`).

---

## Étape 5 : Exécution des tests d'intégration

1. **Tests d'intégration PostgreSQL (Comptes & Commandes)** :

   ```powershell
   $env:RESTOPLUS_TEST_DATABASE_CONFIRMATION = "isolated-disposable"
   $env:RESTOPLUS_TEST_APP_DATABASE_URL = "postgresql://restoplus_app:CHANGEME_APP_SECRET@127.0.0.1:5432/restoplus_test_disposable?schema=public"
   $env:RESTOPLUS_TEST_AUTH_DATABASE_URL = "postgresql://restoplus_auth:CHANGEME_AUTH_SECRET@127.0.0.1:5432/restoplus_test_disposable?schema=public"

   npm run test:postgres:security
   if ($LASTEXITCODE -ne 0) { throw "Échec des tests PostgreSQL comptes." }

   npm run test:postgres:orders
   if ($LASTEXITCODE -ne 0) { throw "Échec des tests PostgreSQL commandes." }
   ```

2. **Amorçage des fixtures et tests HTTP** :

   **Terminal 1 — Amorçage puis serveur Next.js de test sur la base jetable :**

   ```powershell
   $ErrorActionPreference = "Stop"

   # A. Définir les URL de session vers la base jetable
   $env:RESTOPLUS_TEST_DATABASE_CONFIRMATION = "isolated-disposable"
   $env:RESTOPLUS_TEST_APP_DATABASE_URL = "postgresql://restoplus_app:CHANGEME_APP_SECRET@127.0.0.1:5432/restoplus_test_disposable?schema=public"
   $env:RESTOPLUS_TEST_AUTH_DATABASE_URL = "postgresql://restoplus_auth:CHANGEME_AUTH_SECRET@127.0.0.1:5432/restoplus_test_disposable?schema=public"

   # B. Amorcer les comptes de test (affiche le bloc des variables HTTP à copier)
   node tests/fixtures/seed-http-test-fixtures.mjs
   if ($LASTEXITCODE -ne 0) { throw "Échec de l'amorçage des fixtures." }

   # C. Configurer Next.js pour pointer impérativement sur la base jetable
   $env:APP_DATABASE_URL = $env:RESTOPLUS_TEST_APP_DATABASE_URL
   $env:AUTH_DATABASE_URL = $env:RESTOPLUS_TEST_AUTH_DATABASE_URL
   $env:PORT = "3000" # Si le port 3000 est déjà occupé, libérez-le ou utilisez 3001 (en ajustant RESTOPLUS_HTTP_BASE_URL)

   # D. Lancer le serveur Next.js de test
   npm run dev
   ```

   **Terminal 2 — Exécution des suites de tests HTTP :**

   ```powershell
   $ErrorActionPreference = "Stop"

   # A. Définir les URL de base et de test (identiques au Terminal 1)
   $env:RESTOPLUS_TEST_DATABASE_CONFIRMATION = "isolated-disposable"
   $env:RESTOPLUS_TEST_APP_DATABASE_URL = "postgresql://restoplus_app:CHANGEME_APP_SECRET@127.0.0.1:5432/restoplus_test_disposable?schema=public"
   $env:RESTOPLUS_TEST_AUTH_DATABASE_URL = "postgresql://restoplus_auth:CHANGEME_AUTH_SECRET@127.0.0.1:5432/restoplus_test_disposable?schema=public"
   $env:APP_DATABASE_URL = $env:RESTOPLUS_TEST_APP_DATABASE_URL
   $env:AUTH_DATABASE_URL = $env:RESTOPLUS_TEST_AUTH_DATABASE_URL

   # B. Coller le bloc $env:RESTOPLUS_HTTP_* généré par l'étape 1B

   # C. Lancer les tests HTTP de bout en bout
   npm run test:http:security
   if ($LASTEXITCODE -ne 0) { throw "Échec des tests HTTP sécurité." }

   npm run test:http:orders
   if ($LASTEXITCODE -ne 0) { throw "Échec des tests HTTP commandes." }
   ```

---

## Étape 6 : Nettoyage propre et sécurisé (Suppression de la base jetable)

Une fois la recette terminée :

```powershell
# Le script vérifie impérativement qu'il est connecté sur restoplus_test_disposable avant de procéder
& $psql -U postgres -d restoplus_test_disposable -f scripts/teardown-test-database.sql
if ($LASTEXITCODE -ne 0) { throw "Échec de l'étape 6 (Nettoyage)." }
```

**Garanties de suppression :**

- Le script refuse immédiatement de s'exécuter si la base initiale n'est pas exactement `restoplus_test_disposable`.
- Il ne peut cibler ni supprimer aucune autre base. `restoplus_dev` reste 100 % intacte.
