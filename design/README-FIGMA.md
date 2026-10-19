# Resto+ — Kit UX/UI pour la RDC (version finalisée du prototype)

## Contenu
- `prototype-interactif.html` : prototype web navigable avec données fictives.
- `figma-svg/` : 10 écrans SVG à importer dans Figma comme références vectorielles.
- `restop-design-tokens.json` : tokens visuels et paramètres de localisation fr-CD.
- `README-FIGMA.md` : guide d’importation dans Figma.

## Localisation et conventions
- Langue : français (RDC).
- Devise principale : franc congolais, affiché `FC` (code ISO `CDF`).
- Devise secondaire : dollar américain (`USD`).
- Moyens de paiement à prévoir : espèces en FC ou USD, M-Pesa, Orange Money, Airtel Money, carte bancaire si le terminal est disponible et paiement mixte.
- Les intégrations Mobile Money sont des emplacements d’interface uniquement. Aucune transaction réelle n’est effectuée.
- Exemples de produits : poulet braisé, poisson grillé, chikwangue, frites, jus naturel, brochette.

## Écrans inclus
1. Connexion
2. Choix du rôle
3. Plan des tables
4. Prise de commande
5. Détail de commande
6. Paiement
7. Cuisine / Bar
8. Produits
9. Stocks
10. Tableau de bord web

Le prototype contient aussi des vues de démonstration pour les rapports et les paramètres.

## Tester le prototype
Ouvrir `prototype-interactif.html` dans un navigateur récent. Naviguer depuis le menu latéral, choisir une table, ajouter des produits, ajuster les quantités et ouvrir l’écran de paiement. Le sélecteur Mobile Money affiche les opérateurs prévus.

## Importation dans Figma
1. Décompresser le ZIP.
2. Dans Figma, créer un fichier puis importer ou glisser-déposer les SVG de `figma-svg/` dans la page.
3. Utiliser les SVG comme références pour reconstruire les composants natifs Figma, les variantes, Auto Layout et les liens de prototype.
4. Les tokens JSON servent de référence de couleurs et de localisation.

## Limites à respecter
Ce livrable est un prototype UX/UI, pas une application prête pour la production. Les données sont fictives. Les actions d’ajout de produits, de mouvements de stock, d’encaissement et de passage en cuisine sont simulées ou signalées comme démonstration. Il n’y a pas encore de backend, d’authentification réelle, de base de données, d’impression de ticket, de synchronisation hors ligne réelle, de gestion sécurisée des rôles ni de connexion aux API Mobile Money. Ces éléments doivent être développés et testés avant usage opérationnel.
