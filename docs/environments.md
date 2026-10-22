# Environnements et exploitation

## Développement local

- Node.js et npm installés localement.
- Dépendances installées de façon reproductible avec `npm ci` à partir du manifeste et du fichier `package-lock.json`.
- `npm run dev` démarre le serveur Next.js local avec Webpack. Ce choix évite le plantage observé de Turbopack lors du lancement d’un processus fils dans l’environnement de préparation.
- Le build utilise un seul worker Next.js (`experimental.cpus: 1`) après des erreurs Windows de création de répertoires avec le rendu statique parallèle. Cela peut rallonger les builds ; réévaluer le réglage sur l’environnement de développement/CI cible. Il n’altère pas le comportement des modules métier à l’exécution.
- Le développement Prisma utilise les comptes distincts `restoplus_migrator`, `restoplus_app` et `restoplus_auth`. La migration technique initiale RLS reste en attente; aucun accès de production n'est configuré. `restoplus_account_ops` est requis par la révision de la migration, mais n'est pas provisionné; sa création et les appartenances temporaires de migration relèvent d'une autorisation administrative distincte.

## Test

L’environnement de test devra être isolé de la production et utiliser des données synthétiques. Des tests d'intégration PostgreSQL sont préparés pour les rôles runtime; ils restent à exécuter sur une base jetable explicitement autorisée. RLS n'est pas opérationnel tant que la migration n'est pas appliquée et les tests n'ont pas réussi. Les secrets seront injectés par l'environnement d'exécution, jamais copiés dans le dépôt. Le test runner natif Node et le paquet `pg` déjà installé sont utilisés; aucune dépendance n'a été ajoutée.

## Production

Le fournisseur et la région restent à choisir. Avant mise en production, documenter HTTPS, sauvegardes quotidiennes, procédure de restauration testée, supervision, gestion des secrets et plan de reprise. Aucun déploiement ou accès de production n’est configuré par le Jalon 1.

## Variables d’environnement

La configuration PostgreSQL locale utilise `MIGRATION_DATABASE_URL`, `APP_DATABASE_URL` et `AUTH_DATABASE_URL`, documentées dans `.env.example`; les valeurs réelles résident uniquement dans le `.env` local ignoré par Git. Ne pas afficher ni versionner les secrets. Aucune connexion de production n'est configurée.
