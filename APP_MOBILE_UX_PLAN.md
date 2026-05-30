# Plan UX app mobile Chez Olive

Date: 2026-05-26

Objectif: alleger l'experience de l'app mobile, surtout les ecrans client connecte, pour que chaque page respire davantage et que l'action utile arrive plus vite.

Portee principale: l'app mobile et les parcours mobiles autour de `/app`, `/account/*`, `/cart`, `/checkout` et `/products/*`.

Hors portee immediate: refonte complete du site marketing, refonte desktop avancee, changements admin, changements fonctionnels lourds.

## Constat general

L'interface est visuellement riche, mais plusieurs pages mobiles empilent trop de blocs de reassurance, raccourcis, cartes et explications avant l'action utile.

Le probleme principal n'est pas seulement la longueur des pages. C'est que plusieurs sections ont le meme role:

- orienter l'utilisateur;
- rassurer;
- donner des raccourcis;
- expliquer le fonctionnement;
- proposer une aide.

Sur mobile, ces sections deviennent une longue pile verticale. L'utilisateur doit scroller avant de trouver ce qu'il voulait faire.

## Priorites

### Priorite 1: simplifier `/app`

`/app` doit devenir le vrai tableau de bord mobile client. Aujourd'hui, la page fait trop de choses en meme temps:

- accueil;
- prochaine action;
- raccourcis boutique/panier/commandes/support/chiens/profil;
- installation de l'app;
- centre de notifications;
- resume du compte;
- autre grille "Tout pour ton compte";
- acces livreur.

Plan propose:

- garder un seul bloc principal "prochaine action";
- garder 4 raccourcis maximum visibles en premier;
- deplacer notifications, installation et acces livreur dans des zones secondaires;
- supprimer les doublons entre "raccourcis premium", "resume du compte" et "Tout pour ton compte";
- faire remonter les actions utiles dans le premier ecran mobile.

### Priorite 2: simplifier la navigation compte mobile

Les pages `/account/*` affichent trop de navigation avant leur contenu. Le header boutique et le gros menu "Mon Chez Olive" prennent presque tout le premier ecran mobile.

Plan propose:

- rendre le menu compte compact sur mobile;
- afficher le contenu de la page plus haut;
- garder seulement le lien actif et les actions essentielles visibles;
- mettre les autres destinations dans un bouton ou une section "Plus".

### Priorite 3: compacter le checkout mobile

Le checkout explique beaucoup avant de permettre l'action. Il faut garder la clarte, mais reduire les blocs introductifs.

Plan propose:

- afficher recapitulatif et action principale plus tot;
- reduire les 4 etapes a une ligne compacte;
- deplacer les messages d'aide dans une zone repliee;
- separer clairement les etapes: infos, livraison, paiement, confirmation.

### Priorite 4: optimiser la page produit mobile

La page produit est belle, mais l'achat rapide arrive trop bas.

Plan propose:

- reduire la hauteur image mobile;
- afficher nom, prix, variante et ajout panier plus tot;
- descendre les details secondaires;
- eviter que le bouton support flottant concurrence le CTA achat.

### Priorite 5: alleger le panier mobile

Le panier fonctionne, mais ses promesses et etapes prennent de la place avant les articles.

Plan propose:

- reduire les promesses a une ligne;
- transformer les etapes en mini barre de progression;
- faire arriver articles et total estime plus vite.

## Detail priorite 1: `/app` mobile

### Role souhaite de `/app`

Sur mobile, `/app` doit repondre a une question:

"Qu'est-ce que je peux faire maintenant, rapidement?"

La page ne doit pas essayer de tout expliquer. Elle doit etre un lanceur d'actions rapide.

### Structure cible proposee

1. Header app compact
   - Logo Chez Olive.
   - Panier.
   - Compte.

2. Bloc principal
   - Bonjour, Gary.
   - Une seule prochaine action.
   - Exemple: "Magasiner", "Suivre ma commande", "Completer mon profil chien", selon le contexte.

3. Raccourcis essentiels
   - Boutique.
   - Commandes.
   - Chiens QR.
   - Support.

4. Resume utile tres court
   - Derniere commande si presente.
   - Profil chien incomplet si pertinent.
   - Notification importante si pertinente.

5. Plus
   - Installation de l'app.
   - Notifications.
   - Profil et securite.
   - Acces livreur.

### Ce qu'on retirerait du premier niveau

- La grande hero "Bienvenue" si elle repete deja le header.
- Les 6 cartes premium visibles en pile.
- La section complete "Tout pour ton compte" si les raccourcis essentiels existent deja.
- Le bloc installation visible en permanence.
- Le centre de notifications complet visible en permanence.
- L'acces livreur visible pour tous les clients, sauf si un lien chauffeur est deja utilise sur ce telephone.

### Resultat attendu

Avant:

- environ 5 ecrans de contenu sur mobile connecte;
- plusieurs grilles de raccourcis;
- notifications, installation et acces livreur visibles meme quand ils ne sont pas l'action principale.

Apres:

- premier ecran centre sur l'action utile;
- moins de cartes;
- moins de texte explicatif;
- page plus courte;
- les fonctions secondaires restent disponibles, mais ne prennent pas toute la place.

### Questions a valider avant implementation

- Les 4 raccourcis essentiels sont-ils bien: Boutique, Commandes, Chiens QR, Support?
- L'acces "Profil et securite" doit-il rester visible en premier niveau ou passer dans "Plus"?
- L'acces livreur doit-il etre cache par defaut pour les clients ordinaires?
- Le centre de notifications doit-il etre une petite pastille/bouton plutot qu'une grande section?

### Statut implementation priorite 1

Statut: realise le 2026-05-26.

Changements appliques:

- `/app` connecte ouvre maintenant sur "Bonjour, [prenom]" au lieu d'une hero generique.
- Le premier niveau garde une seule prochaine action et 4 raccourcis: Boutique, Commandes, Support, Chiens QR.
- Panier, Profil et securite, FAQ, notifications, installation et acces livreur sont regroupes dans "Plus dans l'app".
- Le resume compte affiche seulement des signaux utiles: commande active, profil chien incomplet, support ouvert ou adresse manquante.
- La section dupliquee "Tout pour ton compte" a ete retiree.
- Le panneau "Plus" est ferme par defaut sur mobile et son contenu reste disponible sans encombrer le premier ecran.

Verification:

- ESLint cible: OK.
- Tests PWA cibles: OK.
- Verification Playwright mobile Pixel 5 connecte: 4 actions principales, aucun debordement horizontal, panneau "Plus" ferme par defaut.

## Statut implementation priorites 2 a 6

### Priorite 2: navigation compte mobile

Statut: realise.

Changements appliques:

- Les pages `/account/*` utilisent un chrome app compact sur mobile.
- La navigation compte mobile est reduite a trois onglets principaux et un menu "Plus compte".
- Le header boutique et la grande sidebar compte restent disponibles sur desktop.

Verification:

- Tests compte cibles: OK.
- Verification mobile `/account`, `/account/orders`, `/account/dogs`, `/account/profile`: contenu plus haut, pas de debordement horizontal.

### Priorite 3: checkout mobile compact

Statut: realise.

Changements appliques:

- `/checkout` mobile affiche un resume court en haut et un CTA paiement sticky en bas.
- L'aide checkout, l'aide paiement et les rassurances longues sont repliees ou rendues secondaires.
- En native, le CTA checkout se place au-dessus de la tabbar et le header local est masque.

Verification:

- Tests checkout cibles: OK.
- Playwright checkout mobile web/native: OK.

### Priorite 4: produit mobile achat rapide

Statut: realise le 2026-05-27.

Changements appliques:

- La page produit mobile est plus compacte: header produit, image, titre, prix, quantite et ajout panier arrivent dans le premier ecran.
- Le CTA sticky produit reste actif apres scroll et se place au-dessus de la tabbar native.
- Les liens d'aide produit restent accessibles via "Livraison locale", "Paiement securise" et "Retour / probleme".
- Le support flottant est masque sur mobile produit pour ne pas concurrencer le CTA achat.

Verification:

- Test React add-to-cart/sticky CTA: OK.
- Playwright produit mobile web/native: OK, aucun debordement horizontal.

### Priorite 5: panier mobile direct vers checkout

Statut: realise le 2026-05-27.

Changements appliques:

- `/cart` mobile utilise un chrome app compact avec resume haut: total, nombre d'articles, etat stock et mini etapes.
- Le bouton existant "Passer a la caisse" devient le CTA sticky mobile unique.
- En native, le CTA panier se place au-dessus de la tabbar.
- Les notes longues, trust rows et prochaines etapes sont compacts ou secondaires; l'aide reste accessible dans une zone repliee.

Verification:

- Tests panier cibles: OK.
- Playwright panier mobile web/native: OK, aucun debordement horizontal, CTA visible immediatement.

### Priorite 6: stabilisation client mobile

Statut: realise localement, non deploye.

Verification finale locale:

- ESLint cible TS/TSX: OK; `globals.css` est ignore par la config ESLint actuelle.
- Vitest cible `account-sidebar`, `checkout-stripe-status`, `public-cart-checkout-flow`: OK, 23 tests.
- Playwright mobile publique complete: OK, 15 tests passes, 1 skip attendu.
- Smoke metriques mobile/native produit + panier + checkout: OK.
- Captures locales ciblees: `test-results/mobile-product-step4.png`, `test-results/mobile-cart-step5.png`, `test-results/mobile-checkout-step5.png`.

## Fermeture du 2026-05-28

Statut: iterations mobile client fermees localement.

Pages validees:

- `/app`
- `/account`, `/account/orders`, `/account/dogs`, `/account/profile`, `/account/subscriptions`, `/account/support`
- `/products/lit-douillet-anti-stress`
- `/cart`
- `/checkout`
- variantes native: `/products/lit-douillet-anti-stress?native=1`, `/cart?native=1`, `/checkout?native=1`

Corrections de fermeture:

- Les tests E2E reconnaissent maintenant `/terms` comme page legale canonique au lieu d'une redirection FAQ.
- Le sitemap accepte `/terms` et continue d'exclure `/shipping` et `/returns`.
- Le test boutique ne depend plus de l'ancien `.catalog-conversion-strip`; il verifie les liens produits et les CTA existants.
- Les captures E2E conservees sont limitees a produit, panier et checkout mobile.

Tests executes:

- `eslint` cible UX mobile: OK, avec l'avertissement connu sur `globals.css`.
- `vitest` cible compte/checkout/panier-produit: OK, 23 tests.
- `playwright mobile-public`: OK, 15 passes, 1 skip.
- smoke Playwright metriques web/native produit, panier, checkout: OK, aucun debordement horizontal.

Hors scope:

- Aucun deploiement production.
- Aucune refonte admin mobile.
- Aucun changement API, DB, auth, paiement ou payload commande.
