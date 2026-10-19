# Resto+

Socle technique de l’application web Resto+ pour les restaurants en RDC. Le cahier des charges v1.2 et les ressources de conception restent dans `docs/` et `design/`.

## Prérequis

- Node.js 20.9 ou supérieur (le poste utilisé pour préparer ce squelette dispose de Node.js 24.19.0).
- npm.

## Lancer sous Windows

Dans PowerShell, depuis ce dossier :

```powershell
npm ci
npm run dev
```

Ouvrir ensuite `http://localhost:3000`. Pour exécuter les contrôles :

```powershell
npm run lint
npm run typecheck
npm run format:check
```

`npm run format` applique le formatage. Le fichier `package-lock.json` verrouille les dépendances ; après toute modification des dépendances, conserver ses mises à jour avec `package.json`.

## Documentation technique

- [Architecture](docs/architecture.md)
- [Sécurité multi-restaurant et RLS](docs/security-multitenancy.md)
- [Stratégie de recette RLS](docs/acceptance-security.md)
- [Environnements et exploitation](docs/environments.md)

Le Jalon 1 ne contient aucun module métier et ne configure aucune connexion PostgreSQL. Voir les limites décrites dans les documents ci-dessus.
