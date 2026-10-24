# Journal de Tickets

Ce journal sert à reprendre le travail sans relire les conversations. **À lire en premier** : « État actuel », puis « En cours ».

Après chaque modification, dans le même commit :
1. ajouter une entrée datée en haut de l'**Historique** : ce qui a changé, et pourquoi si ce n'est pas évident ;
2. noter toute décision de Benoît dans **Décisions**, avec sa date ;
3. mettre à jour **État actuel** et **En cours** si nécessaire.

### Reprendre le travail ailleurs
- **Claude Code ouvert sur le dépôt** : rien à faire, `CLAUDE.md` est lu automatiquement et renvoie vers ce journal.
- **Autre conversation Claude** : demander « Lis CLAUDE.md puis JOURNAL.md du dépôt GitHub bpierrardmail-cyber/Tickets- ». Si l'accès à GitHub n'est pas branché, donner les liens directs :
  - https://raw.githubusercontent.com/bpierrardmail-cyber/Tickets-/main/CLAUDE.md
  - https://raw.githubusercontent.com/bpierrardmail-cyber/Tickets-/main/JOURNAL.md
- Si le dépôt devient privé, ces liens ne marchent plus : joindre les deux fichiers à la conversation.

---

## État actuel (24/10/2026)

**Versions**
- β web : `beta/index.html`, étiquette `24/10 19:33
([^`, environ 7 900 lignes.
- APK de test « Tickets Perso » (avec la Bourse) et « Tickets Store » (sans la Bourse), release `apk-beta`.

**Onglets**
- **Accueil** : graphiques choisis par l'utilisateur (⚙ Choisir, appui long pour changer, déplacer ou masquer), grande carte du haut au choix. Pastilles ✍️ Saisie et 🧾 Tickets. Filtre par personne en haut à droite. Rien sous les graphiques.
- **Articles** : produits et prix (Mes produits, Hausses, Magasins, Familles, Budgets). Fiche produit avec tous les achats. Bouton « Produits partagés ».
- **Commun** : parts du commun en % et parts propres à chaque frais. Frais fixes « en entier » ou « chacun sa part », frais retirés pour un mois. Graphique Mois (6, 12, 12 à venir, Tout). Bandeau des personnes.
- **Compte** :
  - plusieurs comptes par personne, graphique plein écran ;
  - page Configuration par compte (provisions, épargne) ;
  - bouton « Liquide » ;
  - rien avant le début du suivi ;
  - mois à venir = solde prévu.
- **Bourse** (Perso seulement) : cours Yahoo et CoinGecko via le relais, courbe 1J.
- **Analyse** :
  - graphiques Mois, Répartition, Récurrentes et Qui a payé ;
  - bouton « + Frais fixes » ;
  - détail d'un mois ;
  - **Analyse avancée** (Plus) : inflation perso (INSEE), année / an dernier, alertes, reste à vivre, projection, simulateur, résumé pour une IA.

**Foyer partagé**
- Invitation par QR code. Copies chiffrées sur le relais, que le relais ne peut pas lire. Code + empreinte obligatoires.
- Droits par onglet : Masqué / Lecture / Modif.
- Comptes choisis ou « Aucun · ses tickets ». Option « Tickets visibles : tout le foyer ».
- L'Accueil des membres est personnel.

**Appli Android**
- Lecture des tickets par ML Kit, sauvegarde dans Documents/Tickets.
- Empreinte native, Bilan PDF, geste retour.
- Widgets (Scan, Solde, Commun, Mois, Foyer, Bourse), masqués par défaut.

**Version Store** : `PLUS_FEATURES = widgets, foyer, avancee`. L'achat de Plus n'est pas encore branché.

## En cours / à reprendre

- **Import d'un relevé pour démarrer un compte** : à l'étude, en attente d'un fichier d'exemple de Benoît, puis maquette de l'écran d'import avant de coder.
  - Formats visés : OFX/QFX (banques, Money, Quicken, iCompta), QIF (Money, Quicken, Grisbi, HomeBank…) et CSV (banques, Bankin', Linxo, tableurs).
  - Import en une fois, sur le téléphone, limité aux mois passés pour éviter les doublons avec les tickets. Il propose : solde de départ, revenus, prélèvements qui reviennent (frais fixes à cocher) et dépenses par carte (historique de l'Analyse, sans articles).
- Reportés à la sortie Store :
  - QR code lisible par l'appareil photo ;
  - Workers Paid ;
  - WebSocket ;
  - protection contre les abus à la création de foyer ;
  - copies différentielles ;
  - domaine UE.
- À décider par Benoît : répartition gratuit / Plus et prix, nom de l'appli, type de compte Google Play, lien avec la banque.
- À surveiller : l'option « Ajouter au foyer » (verser ses anciennes données en rejoignant) sera retirée si personne ne s'en sert.

## Décisions de Benoît

- **24/10**
  - Tenir ce journal à jour à chaque modification.
  - Étudier un import de relevé pour remplir un nouveau compte ; il doit aussi accepter les fichiers de Money, de Quicken et des autres logiciels de comptes connus.
- **22/10** : le lien avec la banque est mis de côté. Pistes, dans l'ordre :
  - bouton « Ouvrir ma banque » ;
  - import de relevé CSV/OFX ;
  - synchro DSP2 via un agrégateur payant, seulement dans Plus, à décider.
- **23/10** : l'Analyse avancée fait partie de Tickets Plus.
- **18/10**
  - Foyer : code + empreinte obligatoires sur chaque téléphone. Rejoindre un foyer est gratuit ; en créer un est réservé à Plus dans la version Store.
  - Un enfant est en consultation seulement.
  - Le QR code lisible par l'appareil photo est reporté à la sortie Store.
  - Analyse : en vue « Moi », un frais commun payé en entier depuis son compte compte pour son montant complet, avec « dont X pour les autres » en petit. Avec « chacun sa part », seule sa part compte.
- **17/10**
  - Deux applis à partir du même code : **Perso**, avec la Bourse, hors store ; **Store**, gratuite avec fonctions payantes « Plus », sans la Bourse.
  - Dans la version Store, les widgets sont réservés à Plus.
  - Exigence : marcher pour une famille nombreuse (10 personnes et plus, plus de 10 comptes) avec un affichage lisible.
- **16/10**
  - Modèle visé : appli gratuite avec fonctions payantes dès le départ. Pas d'appli payante d'office.
  - La lecture des tickets se fait par ML Kit sur le téléphone, plutôt que Tesseract ou OCR.space.
- **Octobre**
  - Plus de connexion eToro : trop fragile pour une appli payante.
  - Aucune source de données payante.
  - Rien à configurer pour l'utilisateur.

---

## Historique (le plus récent en haut)

### 24/10
- Accueil, petites cartes : montants courts (427 · 4,3k · 43k · 1,2M), étiquettes qui se chevauchent masquées (le mois en cours et les plus gros montants d'abord), ramenées dans la carte au bord, libellés trop longs sur deux lignes (`enrichMiniCharts`, `miniNum`, `miniDeclutter`). Avant, les montants à 4 ou 5 chiffres se chevauchaient.
- Montants : virgule, espaces (clavier Android) et symbole € acceptés du premier coup, via `num()` (`aa7e3de`).
- Guide `CLAUDE.md` complété (lecture des montants, Accueil, frais retirés pour un mois). Création de ce journal.

### 23/10
- **Foyer : droits par onglet** (Masqué / Lecture / Modif.), contrôlés sur le téléphone du propriétaire (`d294283`). Analyse et Bourse sont toujours en Lecture. Commun et Bourse sont possibles même avec des comptes choisis. L'Accueil des membres est personnel.
- **Analyse avancée (Plus)** (`01a6022`) :
  - inflation perso par article et par magasin (INSEE base 2025, sans carburant, écarts de plus de 30 % écartés) ;
  - reste à vivre sur 1, 6, 12 mois ou tout ;
  - provisions comprises dans l'épargne, sans les compter deux fois ;
  - relais : route `/inflation`.
- Provisions : « Où est l'argent ? » (épargne, compte principal ou un autre compte, ailleurs). Provisions et Épargne dans la Configuration de chaque compte.
- Commun · Mois : 6 mois, 12 mois, 12 à venir ou Tout ; montants sur les barres ; toucher une barre ouvre les frais du mois ; frais perso compris.
- Compte : montants empilés sur les barres Entrées-sorties ; encadrés qui suivent le graphique ; bouton « Liquide ».

### 22/10
- **Accueil refait** :
  - graphiques choisis (⚙ Choisir, appui long), grande carte du haut au choix (⇄) à taille fixe ;
  - pastilles Saisie et Tickets, page Tickets, Galerie déplacée dans le menu ;
  - « Dépenses qui reviennent » retiré.
- Filtre par personne : un bouton en haut à droite remplace la barre.
- **Articles recentré sur les produits et les prix** :
  - Mes produits, Hausses, Magasins, Familles, Budgets ;
  - fiche produit avec tous les achats ;
  - l'essai « Moins cher » a été retiré.
- Commun et Articles : bouton « Produits partagés » pour les compter ou non.
- Compte :
  - graphique plein écran, « Ce mois » mène à la Configuration ;
  - rien avant le début du suivi ;
  - mois à venir = solde prévu, les mois sans ticket comptent leurs frais fixes.
- Frais fixes : retirer un frais pour un seul mois, et le rétablir.
- Graphiques : 6 mois / 12 mois / Tout en haut à droite ; graphiques touchables partout ; encadrés réduits au titre et à la valeur.
- Lien avec la banque mis de côté (voir Décisions).

### 21/10
- **Analyse** :
  - nouveaux graphiques « Récurrentes » (catégories, familles, magasins, articles avec l'évolution du prix ; ce qui revient au moins 2 mois) et « Qui a payé » (toujours tout le foyer) ;
  - détail d'un mois en une carte ;
  - « Par mois » sur les 12 derniers mois.
- **Commun** :
  - parts propres à chaque frais ;
  - sous-pages Frais communs / Produits partagés / Frais perso ;
  - frais créés au mois affiché, pour un mois, plusieurs mois ou sans fin ;
  - bandeau des personnes.
- Frais récurrents comptés à partir de leur mois de début ; graphiques sans les mois d'avant les premières données.
- Mise en page :
  - graphiques plein écran, à la même hauteur dans un onglet ;
  - « Voir la suite » quand le contenu dépasse ;
  - actions en haut des onglets, icônes sans couleur.
- Bourse : page principale avec « Mes comptes » et « Gérer ».
- Android : le geste retour est transmis à la page.

### 19/10
- Création de `CLAUDE.md`, le guide pour Claude Code.

### 18/10
- **Frais communs « Payé : un compte, en entier / chacun sa part »** ; Analyse « + Frais fixes » ; un membre « tout le foyer » reçoit tous les frais, ceux des autres en consultation (`d095ce0`).
- **Foyer partagé** (`1daad63`) :
  - invitation par QR code, en consultation ou en modification ;
  - copies chiffrées, la dernière modification l'emporte ;
  - code + empreinte, code de secours ;
  - « Ajouter au foyer » pour verser ses anciennes données ;
  - un membre peut scanner sans l'onglet Accueil ;
  - accès « Aucun · ses tickets » et « Tickets visibles : tout le foyer » ;
  - un membre est ajouté (ou rétabli) dans les Personnes.
- **Filtre par personne** (Moi · chaque personne · Tout le foyer) dans Accueil, Articles et Analyse ; budgets du foyer ou personnels ; testé au-delà de 10 personnes.
- **Widgets** : on touche le montant pour l'afficher (empreinte ou code), remasqués après 2 min ou écran éteint ; réglages par appui long ; tailles réductibles.

### 17/10
- **Deux éditions** à partir du même code, Perso et Store, avec la compilation des deux APK (`e8ff803`).
- Android : Bilan PDF par l'impression Android, empreinte native.
- Widgets Android : Scan, Solde, Commun, Mois en cours, Foyer, Bourse du jour.
- Famille / colocation : parts du commun en %, pages à glisser ; épargne et provisions rattachées à une personne.
- Accueil : petites cartes plus riches.

### 16/10
- **Appli Android β** : ML Kit, sauvegarde dans Documents/Tickets, APK automatique (`3eb04d4`).
- Scan : seulement les articles avant le total, date tolérante aux erreurs de lecture, enseigne reconnue.
- Le prénom est demandé à la première ouverture (plus de prénom par défaut).
- Mise à jour automatique au retour dans l'appli.
- Analyse : Historique et Graphes réunis ; graphique par défaut ★ ; Articles et Accueil refaits sur le modèle des autres onglets.

### 15/10
- Bourse : courbe 1J, barres mois par mois, liseré de plus-value.
- Provisions : graphique des 12 prochains mois.
- Compte : rubriques regroupées, glisser pour changer de graphique.
- Commun refait. Menu : gestion des personnes.

### Avant le 15/10 (résumé)
- **Juillet** :
  - provisions ;
  - descriptions de virements, épargne liée ;
  - classement des produits (taxoV2, rapprochement approximatif) ;
  - navigation par mois dans chaque onglet ;
  - virements et frais fixes faits / pas faits ;
  - « Solde bancaire estimé ».
- **Août** : cours de bourse automatiques via le relais Cloudflare ; service worker qui recharge la nouvelle version.
- **Début octobre** : comptes bancaires multiples (migration le 14/10) ; devise principale réglable ; fin de la connexion eToro.
