# Resto+

Resto+ est actuellement une maquette frontend interactive. Elle permet de parcourir le tableau de bord, la carte, les commandes, les tables, les stocks, les rapports, les paramètres et l’administration de démonstration.

## Démarrer

Dans PowerShell, depuis ce dossier :

```powershell
npm ci
npm run dev
```

Ouvrez ensuite [http://localhost:3000](http://localhost:3000). Les écrans de connexion proposent une ouverture de la démonstration sans identifiants serveur.

## Données de démonstration

Les données affichées sont fictives. Les ajouts, modifications d’état et suppressions sont stockés dans le `localStorage` du navigateur utilisé. Le bouton **Réinitialiser la démo** restaure les exemples initiaux. Ces données ne sont ni partagées entre appareils ni sauvegardées sur un serveur.

## État du projet

Cette version ne contient plus d’API applicative, de connexion PostgreSQL, de schéma/migrations Prisma, ni de comptes utilisateurs réels. L’authentification, les invitations, la synchronisation en ligne et la persistance multi-appareils ne sont donc pas actives. La reconnexion d’un backend devra être conçue après validation des parcours frontend.
