# PostgreSQL et Prisma

Ce dossier accueillera le schéma Prisma et les migrations après validation du modèle métier et des règles fiscales. Le Jalon 1 ne contient ni `schema.prisma`, ni migration, ni connexion à une base.

Les migrations futures utiliseront un rôle PostgreSQL dédié, distinct du rôle d’exécution. Les politiques RLS devront être présentes et testées avec le rôle applicatif avant qu’une fonctionnalité métier soit livrée.
