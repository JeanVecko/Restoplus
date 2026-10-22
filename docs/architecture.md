# Architecture du socle Resto+

## Stack validée

- Next.js avec App Router et TypeScript strict.
- Tailwind CSS pour l’interface responsive.
- Zod pour valider les entrées aux frontières de l’application.
- PostgreSQL et Prisma sont préparés dans le socle technique; le modèle technique et la migration initiale RLS sont en attente d'application.
- L’application évoluera vers une PWA installable ; le service worker et la synchronisation hors ligne ne sont pas encore implémentés.

## Structure

```text
src/
  app/          Routes et layouts Next.js ; API sous app/api/.
  components/   Composants d’interface partagés.
  features/     Modules métier isolés par domaine.
  lib/          Utilitaires sans accès privilégié aux données.
  server/       Cas d’usage serveur, accès aux données et politiques.
prisma/         Schéma Prisma et migrations PostgreSQL.
docs/           Architecture, exploitation, sécurité et décisions.
```

Le tableau de bord et l'interface de démonstration Menus existent. Les routes serveur de gestion de comptes sont ajoutées dans ce jalon; les routes produits, commandes et autres modules métier restent hors périmètre.

## Conventions d’accès serveur

Les composants client ne décident ni de l’établissement actif autorisé ni des permissions. Une route ou action serveur authentifie l’utilisateur, résout son appartenance et son rôle, valide les entrées avec Zod, puis appelle un cas d’usage serveur. Les identifiants d’établissement fournis par le navigateur ne sont jamais une preuve d’autorisation.

Les accès tenant passent par `withTenantTransaction`, avec contexte RLS local à la transaction; le tenant vient de la session validée. La gestion des comptes applique la règle OWNER/MANAGER : MANAGER gère les membres et rôles non-OWNER, seul un OWNER actif peut promouvoir un autre membre actif, sans auto-promotion; le dernier OWNER actif est protégé. Les invitations utilisent un token haché et les opérations sensibles écrivent un journal d'audit. Les fonctions PostgreSQL seront possédées par `restoplus_account_ops` (NOLOGIN/NOBYPASSRLS, à provisionner hors bande), jamais par un runtime. La migration n'est pas appliquée.

## PWA et localisation

La page initiale est responsive et localisée en français RDC (`fr-CD`). La localisation produit utilisera `Africa/Kinshasa`, le FC/CDF et l’USD selon le cahier des charges et les tokens existants. Le manifeste, le service worker, le cache local et la file de synchronisation restent à implémenter dans leurs jalons dédiés.
