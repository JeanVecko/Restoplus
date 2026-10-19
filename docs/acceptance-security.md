# Stratégie de recette sécurité multi-restaurant

Cette stratégie est préparatoire. Elle ne signifie pas que PostgreSQL RLS est opérationnel.

## Jeu de test

Créer deux restaurants synthétiques A et B, chacun avec des utilisateurs, tables et lignes appartenant à son propre tenant. Utiliser les rôles d’exécution applicatif et de migration séparément.

## Cas d’acceptation

1. A ne peut pas lire ni modifier une ligne de B, même en connaissant son UUID.
2. A ne peut pas insérer une ligne avec le `restaurant_id` de B.
3. Une relation de A ne peut pas référencer une ligne de B.
4. Une requête sans contexte tenant échoue fermé.
5. Une transaction sous A puis une autre sous B sur une connexion réutilisée ne fuit pas le contexte.
6. Chaque route API est testée avec un utilisateur de A tentant d’accéder aux données de B.
7. Le rôle applicatif ne peut désactiver RLS ni prendre le rôle propriétaire des tables.

Tout accès croisé réussi est un échec bloquant. Les tests ne seront considérés comme passés qu’après implémentation et exécution sur PostgreSQL avec RLS activé.
