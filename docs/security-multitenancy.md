# Sécurité et isolation multi-restaurant

Ce document décrit la stratégie prévue ; PostgreSQL, Prisma et RLS ne sont pas encore configurés dans le code.

## Contexte tenant

Chaque donnée métier portera un `restaurant_id` non nul. Le serveur déduira l’établissement actif d’une session authentifiée et vérifiera l’appartenance et le rôle avant l’action. Les clés étrangères entre données métier devront inclure l’établissement afin d’interdire les associations inter-restaurant.

## Prisma et Row Level Security

Chaque unité de travail utilisera une transaction Prisma. Au début de la transaction, le serveur définira le contexte d’établissement avec un paramètre PostgreSQL local à la transaction (`SET LOCAL` ou équivalent paramétré). Les requêtes métier de l’unité seront exécutées dans cette même transaction. L’absence de contexte doit échouer fermé.

RLS sera activé et forcé sur les tables métier, avec des politiques de lecture et d’écriture qui comparent `restaurant_id` au contexte transactionnel. Le rôle d’exécution applicatif sera distinct du rôle de migration, ne sera propriétaire d’aucune table et ne disposera pas de `BYPASSRLS`. Les migrations ne seront jamais exécutées avec les identifiants applicatifs.

## Tests bloquants prévus

- Utilisateurs de deux restaurants : lecture, insertion, modification et suppression croisées refusées.
- Tentatives par UUID connu d’une ligne appartenant à un autre restaurant.
- Écriture dont le `restaurant_id` ne correspond pas au contexte RLS.
- Jointures et clés étrangères inter-restaurant refusées.
- Requête sans contexte tenant refusée.
- Réutilisation d’une connexion du pool entre deux contextes sans fuite d’état.
- Tests de routes API pour chaque ressource exposée, avec rôle applicatif réel.

Un échec d’isolation bloque la livraison. Cette stratégie n’est pas une preuve de sécurité tant que les politiques et tests ne sont pas implémentés puis exécutés.

## Hors ligne

Les rôles et permissions seront vérifiés côté serveur lorsque connecté. La politique du PIN gérant hors ligne, la durée d’autorisation locale et la révocation restent à décider ; aucun droit sensible hors ligne n’est implémenté par le Jalon 1.
