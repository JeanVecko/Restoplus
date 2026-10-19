# Environnements et exploitation

## Développement local

- Node.js et npm installés localement.
- Dépendances installées de façon reproductible avec `npm ci` à partir du manifeste et du fichier `package-lock.json`.
- `npm run dev` démarre le serveur Next.js local avec Webpack. Ce choix évite le plantage observé de Turbopack lors du lancement d’un processus fils dans l’environnement de préparation.
- Le build utilise un seul worker Next.js (`experimental.cpus: 1`) après des erreurs Windows de création de répertoires avec le rendu statique parallèle. Cela peut rallonger les builds ; réévaluer le réglage sur l’environnement de développement/CI cible. Il n’altère pas le comportement des modules métier à l’exécution.
- Aucun service externe ni base de production n’est requis par le squelette.

## Test

L’environnement de test devra être isolé de la production et utiliser des données synthétiques. Les tests futurs d’intégration PostgreSQL devront utiliser un compte applicatif soumis à RLS et un compte de migration distinct. Les secrets seront injectés par l’environnement d’exécution, jamais copiés dans le dépôt.

## Production

Le fournisseur et la région restent à choisir. Avant mise en production, documenter HTTPS, sauvegardes quotidiennes, procédure de restauration testée, supervision, gestion des secrets et plan de reprise. Aucun déploiement ou accès de production n’est configuré par le Jalon 1.

## Variables d’environnement

Aucune variable n’est requise pour afficher le squelette ; aucun `.env.example` n’est donc ajouté. Lorsque PostgreSQL sera introduit, un exemple sans valeur réelle documentera les noms requis. Les fichiers `.env*` sont ignorés par Git.
