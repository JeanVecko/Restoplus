# Catalogue persistant — conception et état

Mis à jour le 21 octobre 2026.

## État

Le schéma Prisma, les routes et le service du catalogue sont préparés. La migration candidate `20261021100000_persistent_menu_catalog` est strictement gardée pour `restoplus_test_disposable` et n'a pas été exécutée. Aucune donnée de `restoplus_dev` n'a été lue ou modifiée pour ce travail.

Le cahier des charges PDF dont le nom porte `v1.2` contient, dans le texte extrait, des mentions internes `v1.1` et décrit le poste de préparation via la catégorie. Pour cette implémentation, la décision métier plus récente s'applique : le poste `CUISINE` ou `BAR` appartient au produit. Le document source n'a pas été modifié.

## Modèle

- `MenuCategory` organise les articles par restaurant et ordre d'affichage.
- `MenuProduct` stocke catégorie, nom, description, poste, devise CDF/USD, prix Standard, disponibilité, menu du jour, ordre et statut actif.
- `MenuProductVariant` stocke un format et son prix Standard explicite.
- `MenuProductOption` stocke les accompagnements inclus ou suppléments payants, dans la devise du produit.
- `MenuProductZonePrice` stocke les tarifs explicites TERRACE/VIP pour un produit ou une variante. STANDARD est porté par le prix Standard correspondant.

Toutes les lignes sont tenantées, ont des clés étrangères composites, des contraintes de montants/devise et RLS `ENABLE` + `FORCE`. Les privilèges runtime n'incluent pas DELETE; l'interface désactive logiquement les produits. La migration SQL ajoute des index uniques partiels sur les tarifs de zone (un index pour produit sans variante et un pour variante); Prisma ne sait pas exprimer ces index partiels, ils restent documentés dans le SQL et les tests statiques.

## Prix et historique

- Produit sans variante : tarif explicite de la zone; à défaut, prix Standard du produit.
- Variante en Standard : prix Standard de la variante.
- Variante en Terrasse/VIP : tarif explicite de la variante; sinon tarif du produit dans cette zone; sinon prix Standard du produit. Aucun taux de majoration ni conversion n'est calculé.
- Emporter : Standard.
- Une seule option incluse est permise par ligne; elle coûte zéro. Les suppléments sont positifs et dans la devise du produit.
- Les prix, devise, nom affiché (variante comprise), poste et options sont relus côté serveur et copiés dans les instantanés de ligne. Le navigateur ne peut transmettre ni prix, ni devise, ni poste.

Les calculs de caisse, règles fiscales, arrondis, conversion et encaissements restent hors périmètre et bloqués par `FINANCIAL_POLICY_PENDING`.

## Accès et parcours

`GET /api/menu` exige une session serveur et ne reçoit pas de tenant du navigateur. OWNER/MANAGER peuvent créer et modifier catégories/produits; OWNER, MANAGER et KITCHEN peuvent changer la disponibilité. Les routes valident l'origine des mutations et les corps avec Zod. Le contexte restaurant est posé dans la transaction Prisma via le wrapper tenant.

La création d'une commande accepte uniquement les identifiants UUID, quantités, sélections d'options et notes. Le serveur vérifie le catalogue actif/disponible et enregistre les instantanés. Une commande attend toujours la validation de caisse avant l'émission des tickets Cuisine/Bar.

## Validation requise avant usage

Les tests unitaires/statique ne prouvent pas l'exécution RLS. Avant d'activer le catalogue en développement, il faut appliquer la migration seulement sur la base jetable dont l'identité est revérifiée, lancer `npm run test:postgres:orders`, préparer les fixtures HTTP sur cette même base, puis lancer `npm run test:http:menu` et `npm run test:http:orders`. Les tests ne doivent jamais cibler `restoplus_dev`.

La migration initiale et la migration commandes sont des prérequis distincts. Aucun test HTTP/PostgreSQL ni aucune migration n'a été exécuté pour le catalogue dans cette étape.
