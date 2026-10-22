# Resto+ — Bilan Technique et Validation du Module Commandes

**Date :** 20 octobre 2026  
**Projet :** Resto+ (Application multi-restaurants — RDC)  
**Auteur :** Antigravity (Assistant d'ingénierie et d'audit)  
**Statut :** **PRÉPARATION TERMINÉE — MIGRATION 2 ET TESTS PRÊTS POUR BASE JETABLE**

---

## 1. Synthèse de la mission

Conformément aux directives de finalisation et de validation du module Commandes de Resto+ :

1. **Modèle de données et persistance** : Le schéma Prisma principal (`prisma/schema.prisma`) intègre l'intégralité des 14 modèles (7 modèles d'identité/sécurité + 7 modèles métier Commandes/Caisse). La migration SQL 2 (`prisma/migrations/20261021000000_orders_and_cashier/migration.sql`) a été rédigée avec garde-fous stricts, politiques RLS complètes, déclencheurs d'état et principe du moindre privilège.
2. **Protection du catalogue et intégrité financière** : Le serveur ne fait confiance à aucun prix, poste ou nom d'article transmis par le client. Toute requête cliente tentant de fournir un prix est rejetée avec HTTP 400 (`zod.strict()`). En l'absence de catalogue serveur persistant, le service applique le principe _fail-closed_ et lève une exception documentée `OrderPrerequisiteError("CATALOG_NOT_CONFIGURED")` (HTTP 503).
3. **Respect strict des devises natives** : CDF et USD sont traitées nativement sans conversion implicite ni taux imposé arbitrairement. Aucune règle fiscale non validée (ex. TVA 16 % ou arrondi forcé à 50 FC) n'a été insérée dans le code actif.
4. **Validation des acquis et barrières de sécurité** :
   - Base `restoplus_dev` : **strictement intacte** (0 connexion, 0 modification).
   - Secrets et mots de passe : `.env` n'a pas été lu, aucun secret n'est exposé.
   - Cahier des charges v1.2 et dossier `design/` : préservés sans altération.

---

## 2. Distinction des tests exécutés vs préparés

### 2.1 Tests réellement exécutés par l'agent (Succès 100 %)

| Suite de test / Outil           | Commande exécutée                        |           Résultat            | Couverture                                                                                                                                                                                       |
| :------------------------------ | :--------------------------------------- | :---------------------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tests Unitaires**             | `npm run test:unit`                      |    **18 passés, 0 échec**     | Autorisations des 6 rôles sur le cycle des commandes, hash scrypt, calculs multi-devises stricts CDF/USD, rejet des devises mixtes sur les extras, validation des requêtes d'articles sans prix. |
| **Tests Statiques de Sécurité** | `npm run test:static:security`           |     **4 passés, 0 échec**     | Vérification de la correspondance exacte entre les 14 modèles Prisma et les 2 migrations SQL, présence des contraintes d'unicité, forçage RLS sur les 14 tables, garde-fous de cible.            |
| **Typage TypeScript**           | `npm run typecheck` (`tsc --noEmit`)     |         **0 erreur**          | Typage strict de l'ensemble du projet sans `any` implicite.                                                                                                                                      |
| **Qualité ESLint**              | `npm run lint` (`eslint .`)              | **0 erreur, 0 avertissement** | Conformité stricte aux règles de linter Next.js et TypeScript.                                                                                                                                   |
| **Formatage Prettier**          | `npm run format:check`                   |      **100 % conforme**       | Tous les fichiers TypeScript, JSON, SQL et Markdown sont formatés.                                                                                                                               |
| **Compilation de production**   | `npm run build` (`next build --webpack`) |      **Succès (code 0)**      | 16 routes compilées avec succès (4 statiques, 12 API dynamiques).                                                                                                                                |

### 2.2 Tests d'intégration préparés (En attente de déploiement sur base jetable)

| Suite de test            | Fichier                                               |        Statut        | Objet vérifié                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| :----------------------- | :---------------------------------------------------- | :------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL Commandes** | `tests/postgres/orders-security.integration.test.mjs` | **5 tests préparés** | - Rôles et transitions d'état du cycle de commande.<br/>- RLS : étanchéité stricte entre Tenant A et Tenant B.<br/>- Contraintes DB : rejet devises hors CDF/USD, quantités hors 1..99, prix négatifs.<br/>- Mobile Money : obligation stricte d'un numéro de référence non vide au niveau de la contrainte CHECK.<br/>- Immutabilité comptable : `restoplus_app` n'a aucun droit `DELETE` sur `orders`, `order_lines`, `kitchen_bar_tickets`, `receipts`, `payments` et `order_audit_events`. |
| **HTTP Commandes**       | `tests/http/orders.test.mjs`                          | **5 tests préparés** | - Rejet 401 sur requêtes non authentifiées.<br/>- Rejet 403 sur origine cross-site invalide.<br/>- Interdiction pour un serveur de valider en caisse (400/403).<br/>- Rejet 400 des prix/postes fournis par le navigateur.<br/>- Rejet 503 explicite tant que le catalogue serveur n'est pas actif.                                                                                                                                                                                            |

---

## 3. Détail de la Migration 2 (`20261021000000_orders_and_cashier`)

### 3.1 Garde-fou de sécurité initial

Le script refuse immédiatement l'exécution si la base active n'est pas `restoplus_test_disposable` :

```sql
DO $$
BEGIN
    IF current_database() <> 'restoplus_test_disposable' THEN
        RAISE EXCEPTION 'SÉCURITÉ: migration Commandes autorisée uniquement sur restoplus_test_disposable (base actuelle: %)', current_database();
    END IF;
END $$;
```

### 3.2 Objets créés

1. **4 types énumérés** :
   - `order_status` : `WAITING_CASHIER`, `IN_PREPARATION`, `READY`, `COMPLETED`, `CANCELLED`
   - `order_station` : `CUISINE`, `BAR`
   - `ticket_status` : `PENDING`, `IN_PREPARATION`, `READY`
   - `payment_method` : `CASH_CDF`, `CASH_USD`, `MPESA`, `ORANGE_MONEY`, `AIRTEL_MONEY`, `CARD`

2. **7 tables métier** :
   - `dining_tables` : tables de salle rattachées au restaurant.
   - `orders` : commandes avec numéro unique par restaurant, statut initial `WAITING_CASHIER`, validation caisse obligatoire.
   - `order_lines` : lignes de commande rattachées compositement à `(restaurantId, orderId)`. Contraintes CHECK sur devise (`CDF` ou `USD`), quantité (1..99) et prix positif.
   - `kitchen_bar_tickets` : bons de préparation scindés par poste (`CUISINE` ou `BAR`).
   - `receipts` : reçus de caisse avec numéro séquentiel et gestion des remises autorisées.
   - `payments` : encaissements multi-moyens dans leur devise d'origine avec référence obligatoire pour Mobile Money.
   - `order_audit_events` : journal d'audit append-only traçant chaque transition, annulation ou encaissement.

3. **Déclencheurs d'état et d'intégrité** :
   - `orders_status_transition_guard` : empêche tout saut d'état illégal (ex: passer directement de `WAITING_CASHIER` à `READY`).
   - `tickets_status_transition_guard` : interdit les retours en arrière sur les bons Cuisine/Bar.
   - `orders_ticket_consistency_guard` : garantit qu'une commande en préparation possède bien ses bons et que tous les bons sont `READY` avant que la commande ne devienne `READY`.

4. **Row Level Security (RLS)** :
   - `ENABLE ROW LEVEL SECURITY` et `FORCE ROW LEVEL SECURITY` sur les 7 tables.
   - Politiques d'isolation tenant pour `restoplus_app` basées sur `current_setting('app.restaurant_id', true)::uuid`.
   - Pour `order_audit_events`, vérification conjointe de `restaurantId` et de `actorUserId`.

5. **Privilèges minimaux accordés à `restoplus_app`** :
   - `SELECT` sur `dining_tables`.
   - `SELECT, INSERT, UPDATE` sur `orders`, `kitchen_bar_tickets`, `receipts`, `payments`.
   - `SELECT, INSERT` sur `order_lines`, `order_audit_events`.
   - **Aucun privilège `DELETE`** n'est accordé à l'application sur ces tables.

---

## 4. Procédure d'exécution pour le développeur

Pour déployer la migration 2 sur `restoplus_test_disposable` et lancer les tests d'intégration, exécuter dans une fenêtre PowerShell :

```powershell
$ErrorActionPreference = "Stop"

# 1. Détection de psql
$psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
$psql = if ($psqlCmd) { $psqlCmd.Source } elseif (Test-Path "C:\Program Files\PostgreSQL\18\bin\psql.exe") { "C:\Program Files\PostgreSQL\18\bin\psql.exe" } else { $null }

# 2. Application de la Migration 2 par restoplus_migrator sur la base jetable
& $psql -U restoplus_migrator -d restoplus_test_disposable -f prisma/migrations/20261021000000_orders_and_cashier/migration.sql
if ($LASTEXITCODE -ne 0) { throw "Échec de l'application de la Migration 2." }

# 3. Audit en lecture seule des 14 tables sous RLS
& $psql -U restoplus_migrator -d restoplus_test_disposable -f scripts/audit-test-database.sql

# 4. Exécution des tests d'intégration PostgreSQL (Comptes + Commandes)
$env:RESTOPLUS_TEST_DATABASE_CONFIRMATION = "isolated-disposable"
# Définir vos URLs de connexion confirmées sans les consigner dans Git :
# $env:RESTOPLUS_TEST_APP_DATABASE_URL = "postgresql://restoplus_app:<secret>@127.0.0.1:5432/restoplus_test_disposable?schema=public"
# $env:RESTOPLUS_TEST_AUTH_DATABASE_URL = "postgresql://restoplus_auth:<secret>@127.0.0.1:5432/restoplus_test_disposable?schema=public"

npm run test:postgres:security
npm run test:postgres:orders
```

---

## 5. Bilan et prochaines étapes

1. **Socle Commandes** : Entièrement sécurisé au niveau architecture, schéma, types, autorisation et validation statique.
2. **Qualité de code** : 18/18 tests unitaires, 4/4 tests statiques, 0 erreur de typage/linter, build Next.js 16.4.2 validé avec code 0.
3. **Prérequis pour la phase suivante** :
   - Valider la migration 2 sur `restoplus_test_disposable` via les commandes ci-dessus.
   - Implémenter la persistance du module Catalogue/Menu (`menu_items`, `menu_categories`) pour lever l'erreur `OrderPrerequisiteError` et permettre la création effective de commandes réelles de bout en bout.
