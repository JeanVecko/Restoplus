# Accès aux données

Les futurs adaptateurs Prisma et fonctions transactionnelles seront centralisés ici. Les cas d’usage ne devront pas créer de clients Prisma dispersés. Chaque opération métier devra fournir son contexte d’établissement dans une transaction et être testée sous le rôle PostgreSQL applicatif soumis à RLS.

Ce jalon ne crée aucun client Prisma, schéma, migration, compte de base ou accès réseau PostgreSQL.
