# Circuit Commandes — état actuel

Les routes `/commandes`, `/caisse` et `/cuisine` présentent un parcours interactif de démonstration aligné sur les écrans 04 à 07 du kit UX/UI.

## Limite de persistance

Les données et transitions sont fictives. Elles sont conservées dans `sessionStorage` pour le seul onglet courant afin de pouvoir passer entre les routes. Elles ne sont ni envoyées au serveur, ni enregistrées dans PostgreSQL, ni partagées entre utilisateurs ou appareils; elles disparaissent avec la session de l’onglet. Les commandes de démonstration sont préchargées et signalées comme telles.

Le contrôle de caisse est une étape obligatoire dans l’état de démonstration : une commande en attente ne possède aucun bon et n’est pas visible dans les postes; la validation par la caisse crée un bon distinct par poste Cuisine/Bar. Les postes font évoluer les bons de « Nouveau bon » à « En préparation » puis « Prête »; la commande est prête quand tous ses bons sont prêts.

« Aperçu / imprimer » ouvre la boîte d’impression du navigateur avec une mise en page de bon 80 mm. Cela ne vérifie ni ne garantit une imprimante thermique, son pilote, le papier ou une file de réimpression durable.

## Éléments requis avant persistance réelle

1. Faire valider les décisions métier de commande, routage des produits vers les postes, modification après validation, annulation, statut de table, reçus et règles fiscales.
2. Concevoir et faire approuver les modèles Prisma de commandes, lignes, bons par poste, historique de transitions et file d’impression idempotente, avec contraintes de tenant, RLS, droits et journal d’audit.
3. Créer une base PostgreSQL jetable dédiée (`restoplus_test_*`) sur une instance de test, après confirmation de son identité. Les rôles PostgreSQL sont au niveau de l’instance : ne pas créer ni modifier de rôle avant autorisation séparée.
4. Provisionner les schémas et droits de la base jetable uniquement selon le guide approuvé; vérifier l’identité de la base et les privilèges effectifs avant toute migration.
5. Appliquer la migration exclusivement sur cette base après autorisation distincte, puis tester les contraintes, transitions concurrentes, isolation RLS, droits directs de `restoplus_app`, pannes de l’imprimante et reprise hors ligne sur appareils réels.
6. Implémenter les routes serveur et validations Zod avec tenant tiré de la session; le navigateur ne sera jamais la source d’autorisation. Les actions doivent être transactionnelles/idempotentes et les changements d’état audités.
7. Exécuter les tests PostgreSQL et HTTP sur la base jetable. Une suite navigateur/integration dédiée sera nécessaire pour contrôler les parcours opérateur, la sortie imprimée et la synchronisation multi-appareils.

La base de développement `restoplus_dev` reste hors de ces étapes et ne doit pas être modifiée par la préparation des tests isolés.
