# Resto+ — Audit final consolidé

**Date :** 20 octobre 2026
**Décision : AUDIT NON CLÔTURÉ**

## 1. Résumé exécutif

Le socle de sécurité des comptes a été testé sur `restoplus_test_disposable`, selon le rapport fourni par le développeur : migration initiale appliquée à cette base, RLS activé et forcé sur sept tables, et neuf tests PostgreSQL de sécurité rapportés réussis. L'audit présent n'a ni reconnecté PostgreSQL, ni relancé ces tests, ni touché à `restoplus_dev`.

Les contrôles statiques et unitaires exécutés ici réussissent. Cependant, le lot Commandes n'est pas prêt à l'usage réel : le SQL actif ne crée aucune table Commandes/paiements, le test PostgreSQL des commandes ne vérifie pas réellement l'isolation des données de commande, et le service financier contient des hypothèses non validées. Des défauts confirmés doivent être traités avant toute migration métier ou mise en service.

## 2. État du dépôt et périmètre

- Dépôt local : commit de base `d68e291`; nombreux changements non commités préexistants. Ils ont été préservés.
- Les fichiers `docs/Resto-plus-cahier-des-charges-v1.2.pdf` et `design/` ne figurent pas parmi les changements Git observés.
- `.env` existe localement, est ignoré par `.gitignore` et n'est pas suivi par Git. Son contenu n'a pas été lu.
- Aucune migration, requête SQL, modification de privilège, installation ou opération sur `restoplus_dev` n'a été effectuée pendant cet audit.
- Le périmètre Commandes comprend désormais des pages de démonstration, des routes HTTP et des services serveur. La page interactive `src/features/orders/` demeure explicitement limitée au `sessionStorage` de l'onglet; elle ne consomme pas les routes API.

## 3. Matrice consolidée

| Contrôle                                                                        | Statut                                      | Preuve et limite                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration initiale, RLS forcé sur les sept tables techniques de la base jetable | **RÉUSSI — rapport développeur**            | Résultat fourni; non réexécuté. Ne prouve rien sur `restoplus_dev` ou la production.                                                                                                                                                    |
| Tests PostgreSQL de sécurité des comptes                                        | **RÉUSSI — rapport développeur**            | Le développeur rapporte 9 réussites, 0 échec, 0 ignoré. `security-test-results.txt` contient les neuf noms de cas; le fichier seul ne contient pas le résumé final ni l'identité de la base.                                            |
| Tests unitaires exécutables localement                                          | **RÉUSSI**                                  | `npm run test:unit`: 14 réussites, 0 échec, 0 ignoré. Avertissements Node de reparsing ESM seulement.                                                                                                                                   |
| Contrôles statiques sécurité                                                    | **RÉUSSI**                                  | `npm run test:static:security`: 3 réussites. Ils contrôlent le schéma de base et la migration initiale, pas le schéma Commandes ajouté séparément.                                                                                      |
| ESLint et TypeScript                                                            | **RÉUSSI**                                  | `npm run lint` et `npm run typecheck` terminés avec code 0.                                                                                                                                                                             |
| Formatage et espaces                                                            | **RÉUSSI**                                  | `npm run format:check` et `git diff --check` réussis.                                                                                                                                                                                   |
| `.env` non versionné                                                            | **RÉUSSI**                                  | `git ls-files --error-unmatch .env` ne trouve pas le fichier; `git check-ignore -v .env` confirme la règle `.env*`. Contenu non consulté.                                                                                               |
| Tests HTTP de sécurité et Commandes                                             | **À VÉRIFIER**                              | Non lancés : ils nécessitent un serveur local, des fixtures et des connexions à la base jetable. Leur exécution peut créer/révoquer des sessions et d'autres fixtures.                                                                  |
| Tests PostgreSQL Commandes                                                      | **À CORRIGER**                              | La suite comporte deux cas. Le cas nommé isolation ne lit ni n'écrit aucune table Commandes : il vérifie uniquement la valeur de `current_setting('app.restaurant_id')`. Ce n'est pas une preuve RLS.                                   |
| Modèles et migration Commandes                                                  | **À CORRIGER — bloquant**                   | `migration.sql` ne crée que les sept tables techniques. Aucun `orders`, `order_lines`, `kitchen_bar_tickets`, `receipts` ou `payments` n'y existe. Le code serveur exécute pourtant des requêtes sur ces tables.                        |
| Validation Prisma complète                                                      | **À VÉRIFIER**                              | Non exécutée : la configuration `prisma.config.ts` importe `dotenv/config`; le contrôle CLI chargerait `.env`, interdit par le périmètre de cet audit. Le test statique courant ne lit que `schema.prisma`, pas `schema.orders.prisma`. |
| Build Next.js                                                                   | **À VÉRIFIER**                              | Non exécuté : le build Next peut charger automatiquement les fichiers `.env*`. Aucun contrôle du build qui pourrait consulter ces valeurs n'a été lancé.                                                                                |
| Inscription HTTP initiale du propriétaire                                       | **À VÉRIFIER — bloquant pour l'onboarding** | La documentation et l'inventaire des routes n'indiquent pas de route HTTP bootstrap du premier propriétaire. La fonction SQL seule ne fournit pas le parcours d'inscription.                                                            |
| Essais hors ligne réels et impression sur imprimante                            | **À VÉRIFIER avant production**             | Pas de preuve d'essais sur appareils, de fonctionnement 72 h, de reprise de file d'impression ou de pilote thermique.                                                                                                                   |
| Mise en production                                                              | **NON APPLICABLE à cette étape**            | Aucun déploiement n'était demandé ni effectué.                                                                                                                                                                                          |

## 4. Défauts confirmés et corrections

### 4.1 Schéma Commandes absent du SQL actif

Les routes et services dans `src/app/api/orders/` et `src/server/orders/service.ts` utilisent `public.orders`, `public.order_lines`, `public.kitchen_bar_tickets`, `public.receipts` et `public.payments`. La migration initiale active ne crée aucune de ces tables ni leurs enums/policies RLS. `prisma/schema.orders.prisma` n'est pas couvert par le test statique actuel et sa compatibilité/génération complète n'a pas été vérifiée.

**Impact :** les appels persistants Commandes ne peuvent pas fonctionner avec la migration actuellement décrite; aucune isolation RLS des lignes Commandes n'est démontrée.
**Correction nécessaire :** concevoir et faire approuver le schéma complet et une migration métier distincte, puis ajouter des tests RLS portant réellement sur ces tables. Ne pas modifier la migration initiale déjà appliquée à la base jetable sans décision séparée.

### 4.2 Entrées de commande contrôlées par le navigateur

`POST /api/orders` accepte du client le nom, le poste, le prix, la devise et les suppléments de chaque ligne. Le serveur persiste ces valeurs telles quelles. Il ne les recalcule ni ne les compare à un produit et à un prix du catalogue du restaurant.

**Impact :** un client authentifié pourrait falsifier prix, devise ou routage de poste si la persistance était provisionnée.
**Correction nécessaire :** charger les produits et prix depuis le catalogue tenant-aware côté serveur; ne persister comme entrée que des identifiants, choix de variantes et quantités validés.

### 4.3 Transitions des tickets et encaissement

- `updateTicketStatusService` accepte les transitions `PENDING → READY` et `READY → IN_PREPARATION` si elles sont demandées directement; le service ne vérifie pas une transition autorisée.
- `settleOrderPaymentService` ne vérifie pas que la commande est `READY` avant l'encaissement et ne contrôle pas que les paiements couvrent le montant dû.
- Le numéro provisoire de reçu est `REC-` suivi d'une tranche de `Date.now()`, pas la numérotation séquentielle définitive ou la stratégie provisoire approuvée.
- La référence de paiement est facultative même pour les méthodes Mobile Money, alors que la phase 1 prévoit la saisie manuelle d'une référence.

**Impact :** transitions métier contournables, règlements prématurés/incomplets et reçus non conformes au processus validé. Ces fonctions échoueraient actuellement faute de tables, mais deviennent bloquantes dès l'ajout de la persistance.

### 4.4 Règles financières non validées

`docs/orders-persistence-design.md` contenait des formules TVA, arrondis, taux, numérotation de reçu et remboursement formulés comme règles établies, tandis que `docs/points-a-valider-fiscalite.md` laisse ces sujets ouverts. J'ai corrigé uniquement le statut documentaire : ces éléments sont explicitement des propositions non validées et ne doivent pas être codés sans approbation fiscale/métier.

### 4.5 État de la migration selon les environnements

Les documents de sécurité affirmaient globalement que la migration n'avait été appliquée nulle part. Selon les résultats remis par le développeur, elle a été appliquée à la base jetable. J'ai précisé que l'application et les tests réussis concernent cette base seulement; l'état de développement et de production reste distinct.

## 5. Réserves et risques connus

- Les neuf tests PostgreSQL fournis portent sur les comptes, les adhésions, les sessions, le bootstrap et leurs politiques. Ils ne prouvent pas l'isolation Commandes.
- La suite `tests/postgres/orders-security.integration.test.mjs` est actuellement trop faible pour son nom; elle ne crée ni n'interroge de commande.
- `tests/http/orders.test.mjs` ne couvre que refus sans session, origine étrangère et tentative de validation par WAITER; ce n'est pas la recette complète du circuit.
- La démonstration `/commandes` → `/caisse` → `/cuisine` utilise des données fictives dans l'onglet et ne consomme pas le backend. Elle ne doit pas être présentée comme persistante.
- Le limiteur de tentatives est documenté comme mémoire locale, pas distribué; un canal d'e-mail n'est pas configuré; la récupération de compte et le bootstrap HTTP initial restent ouverts.
- Les tests unitaires émettent des avertissements `MODULE_TYPELESS_PACKAGE_JSON`; ils ne font pas échouer les tests.
- L'audit antérieur du PDF a relevé des pieds de page v1.1 dans un document nommé v1.2; le document a été préservé et ce point éditorial n'a pas été modifié.

## 6. État de préparation

Le socle de sécurité des comptes possède des résultats de test sur une base jetable, selon les éléments fournis. Cela ne vaut pas validation indépendante, certification, ni autorisation de migration de développement.

Le projet **n'est pas prêt pour une mise en service des commandes, paiements ou reçus**, ni pour une migration métier. Il reste un écart bloquant entre le code, le schéma proposé et le SQL; le serveur fait confiance à des données tarifaires envoyées par le client; les règles fiscales et le numéro de reçu ne sont pas finalisés.

## 7. Corrections documentaires de cet audit

- `docs/security-multitenancy.md` : distinction entre la base jetable testée et les environnements développement/production.
- `docs/account-management-security.md` : même clarification du périmètre de la migration appliquée.
- `docs/orders-persistence-design.md` : qualification des règles financières comme propositions non validées.

Aucune base, migration, permission, dépendance, document de référence ou fichier de `design/` n'a été modifié.

## 8. Actions restantes strictement nécessaires

1. Faire approuver et intégrer un modèle Commandes complet, ses tables, contraintes, policies RLS, grants et migration métier isolée.
2. Remplacer les prix/postes fournis par le navigateur par une résolution tenant-aware du catalogue côté serveur.
3. Fixer les transitions autorisées, les conditions d'encaissement et le comportement de référence Mobile Money; maintenir TVA, arrondis, conversion et numérotation fiscale bloqués jusqu'à validation compétente.
4. Écrire puis exécuter des tests HTTP et PostgreSQL qui prouvent les accès/refus sur les vraies tables Commandes, la concurrence, l'idempotence des bons et les erreurs d'impression/synchronisation.
5. Vérifier séparément l'état de `restoplus_dev` et toute configuration de déploiement avant une demande de migration ou de mise en service.

**Décision finale : AUDIT NON CLÔTURÉ.** Les contrôles statiques et de sécurité des comptes sont documentés, mais plusieurs défauts élevés et bloquants du parcours Commandes persistent. La clôture nécessitera leur résolution et des tests ciblés sur les tables Commandes réelles; les validations fiscales externes peuvent rester réservées tant que l'encaissement/reçu n'est pas exposé en production.
