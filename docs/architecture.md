# Architecture du socle Resto+

## Stack validée

- Next.js avec App Router et TypeScript strict.
- Tailwind CSS pour l’interface responsive.
- Zod pour valider les entrées aux frontières de l’application.
- PostgreSQL et Prisma seront ajoutés dans un jalon ultérieur.
- L’application évoluera vers une PWA installable ; le service worker et la synchronisation hors ligne ne sont pas encore implémentés.

## Structure

```text
src/
  app/          Routes et layouts Next.js ; API sous app/api/.
  components/   Composants d’interface partagés.
  features/     Modules métier isolés par domaine.
  lib/          Utilitaires sans accès privilégié aux données.
  server/       Cas d’usage serveur, accès aux données et politiques.
docs/           Architecture, exploitation, sécurité et décisions.
prisma/         Schéma et migrations à ajouter avec le jalon base de données.
```

Les dossiers métier restent vides au Jalon 1. Les données de production, routes métier, schémas de base et migrations ne font pas partie du squelette.

## Conventions d’accès serveur

Les composants client ne décident ni de l’établissement actif autorisé ni des permissions. Une route ou action serveur authentifie l’utilisateur, résout son appartenance et son rôle, valide les entrées avec Zod, puis appelle un cas d’usage serveur. Les identifiants d’établissement fournis par le navigateur ne sont jamais une preuve d’autorisation.

Les opérations métier futures seront atomiques et auditées. Une vente validée ne sera jamais effacée silencieusement ; une annulation ou un remboursement produira une écriture liée et une trace d’audit.

## PWA et localisation

La page initiale est responsive et localisée en français RDC (`fr-CD`). La localisation produit utilisera `Africa/Kinshasa`, le FC/CDF et l’USD selon le cahier des charges et les tokens existants. Le manifeste, le service worker, le cache local et la file de synchronisation restent à implémenter dans leurs jalons dédiés.
