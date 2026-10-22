# Points Financiers et Fiscaux à Valider

Ce document recense les points financiers, fiscaux et réglementaires nécessitant une validation formelle par un fiscaliste et la direction du restaurant avant la mise en production du module d'encaissement de Resto+.

Conformément aux directives, **aucune règle fiscale n'est codée en dur dans l'application** tant que ces points ne sont pas arrêtés. Les montants sont conservés dans leur devise d'origine (CDF ou USD).

---

## 1. Régime d'Imposition et TVA

- [ ] **Assujettissement à la TVA (16 %)** :
  - Déterminer si l'établissement relève du régime général de la TVA (chiffre d'affaires annuel supérieur au seuil légal en RDC) ou du régime de l'impôt synthétique / forfaitaire.
  - Si assujetti : confirmer la formule d'extraction sur les prix TTC affichés à la carte :
    $$\text{TVA} = \text{round}\left(\frac{\text{TTC} \times 16}{116}\right)$$
  - Valider si certains articles bénéficient d'exonérations spécifiques.

- [ ] **Frais de service (pourcentage de service)** :
  - Modalité de calcul : les frais de service sont-ils intégrés à l'assiette soumise à la TVA ou calculés après TVA ?
  - Statut juridique et comptable de la redistribution du service au personnel de salle.

---

## 2. Numérotation et Mentions Légales des Reçus

- [ ] **Séquence de numérotation** :
  - Confirmer si la loi fiscale impose une série continue stricte sans trou au niveau de l'établissement ou par caisse/terminal.
  - Valider la gestion du mode hors-ligne : acceptation d'un numéro provisoire d'appareil (ex. `A1-00045`) rattaché lors de la synchronisation au numéro fiscal définitif sans rupture de séquence.

- [ ] **Mentions obligatoires sur les tickets de caisse** :
  - Numéro Impôt (NIF), Numéro RCCM, Numéro d'Identification Nationale (Id. Nat.).
  - Indication de la devise, des modalités de paiement et du détail des taxes.

---

## 3. Double Monnaie (CDF / USD) et Taux de Change

- [ ] **Taux de change appliqué aux transactions** :
  - Fixation du taux : saisie manuelle quotidienne par le gérant ou application d'un taux de référence (BCC / marché) ?
  - Règle de figement : confirmation qu'une transaction enregistrée conserve son taux d'origine sans réévaluation rétroactive en cas de fluctuation du cours.

- [ ] **Règle de rendu de monnaie** :
  - Rendu en Francs congolais (CDF) obligatoire ou possibilité de rendu en USD selon disponibilité en caisse.
  - Pratique commerciale pour les centimes USD (absence de pièces physiques en circulation en RDC).

- [ ] **Règle d'arrondi sur les espèces** :
  - Valider le palier d'arrondi sur les espèces en Francs congolais (ex. multiple de 50 FC, 100 FC ou franc exact).

---

## 4. Annulations, Remises et Remboursements

- [ ] **Procédure d'annulation après validation** :
  - Validation obligatoire par le gérant avec motif enregistré.
  - Modalités de conservation dans le journal d'audit (exigence légale OHADA de non-suppression des écritures).

- [ ] **Notes de crédit et remboursements** :
  - Émission d'une note de crédit numérotée rattachée au reçu d'origine.
  - Devise du remboursement : obligation de rembourser dans la devise initiale de paiement.
