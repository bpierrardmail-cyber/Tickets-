# Tests de Tickets

Ce sont des scripts Playwright en Python. Ils ouvrent `beta/index.html` dans Chromium sans interface, sur un écran de 412×900, injectent des données **fictives** dans localStorage, puis vérifient l'affichage et les calculs.

**Aucune vraie donnée ici.** Le dépôt est public : n'y mettez jamais de relevé bancaire, de ticket, de facture ou de lecture de ticket réels.

## Lancer

```
sh tests/run.sh            # tous les tests
sh tests/run.sh t94 t95    # seulement ceux-là
python3 tests/t95.py       # un seul test, avec le détail OK / FAIL
```

Chaque test affiche `OK` ou `FAIL` pour chaque vérification, puis le nombre d'échecs.

Les captures d'écran sont écrites dans `tests/` et ne sont pas versionnées. Pour les écrire ailleurs, donner ce dossier en argument : `python3 tests/t95.py /tmp/sortie`.

## Il faut

- **Python 3** avec :
  - `playwright` et son Chromium (`pip install playwright` puis `playwright install chromium`) ;
  - `numpy` et `opencv-python`, pour relire les QR codes du foyer (t93).
- **Node 22.5 ou plus**, pour `node:sqlite` : le relais local en a besoin.
- **pdf.js**, pour t90 seulement (il lit `donnees/facture_edf_fictive.pdf`) : le test cherche `pdf.min.mjs` et `pdf.worker.min.mjs` dans `/opt/npm-tools/node_modules/pdfjs-dist/legacy/build/`. Sinon, indiquer le dossier par `PDFJS_DIR=…`.

Pendant les tests, aucune requête ne sort : tout ce qui n'est pas `file:` ou le relais local est bloqué.

## Le relais local (`relais-local/`)

`server.mjs` fait tourner le vrai code du relais (`relais/cours-worker.js` et `relais/foyer.js`) sur `http://localhost:8787`, avec SQLite en mémoire. Les tests du foyer y envoient l'appli par la clé `foyerApi`.

`run.sh` le démarre s'il ne répond pas déjà. Pour le lancer à la main :

```
node tests/relais-local/server.mjs relais
```

## Les tests

| Test | Ce qu'il vérifie |
|---|---|
| t70 | Import de relevé : Money multi-comptes, OFX SGML, CSV aux colonnes inconnues, CSV Crédit Agricole, gros fichier de 3 ans, petit écran. Utilise `imp_base.py` et `donnees/releves/`. |
| t72 | Menu court : il tient sans défiler, chaque ligne ouvre la bonne chose, Réglages, âge de la sauvegarde. |
| t75 | Bouton « Liquide » décoché : le liquide n'est compté nulle part, mais reste affiché dans le détail. |
| t76 | Compte › Opérations : la liste du mois, les filtres, la recherche, « fait », les jours, les graphiques. |
| t79 | Une opération déjà passée peut être remise dans « À venir ». |
| t80 | Le bouton « Liquide » dans la carte du haut du compte. |
| t81 | La Bourse : une ligne automatique de l'épargne, comptée une fois. |
| t83 | Ticket : articles comparés au montant, question à l'enregistrement, photo en vignette. |
| t84 | Produit d'un article : vide = orange ; sinon rempli avec le dernier produit de la personne, chacun le sien. |
| t85 | Appui long sur un ticket : Ouvrir / Supprimer, avec « Annuler ». |
| t90 | Hors ligne : l'appli Store servie en `https://localhost` sans aucune requête ailleurs ; l'appli Perso sans service worker. |
| t92 | Onglet À venir : 12 mois · Frais fixes · Provisions · Factures, et Store sans Plus. Utilise `donnees/edf_fictif.json`. |
| t93 | Foyer : droits sur l'onglet À venir, selon Commun ou À venir. Utilise `foyer_base.py` (relais local, verrou, invitation par QR code). |
| t94 | Compte : 3 sous-onglets (Opérations · Épargne · Graphiques), « ＋ Ajouter » (virement reçu ou envoyé, frais fixe, ticket), roue du compte, graphiques touchables. |
| t95 | Onglet Dépenses (Tickets · Produits · Budgets · Analyse), menu allégé, projection dans À venir, Plus visible. |
| t98 | Factures d'un fournisseur : « 3 factures » sur sa carte ; toucher une facture la modifie (le « à payer » suit) ; appui long → Modifier / Supprimer ; suppression annulable ; renommer toutes ses factures ou seulement celle-ci ; supprimer tout un fournisseur (carte ou détail), provision gardée, « Annuler ». |
| t99 | Facture gardée sans ses effets : « Pas dans tes comptes · Ajouter » dans le détail du fournisseur et dans sa fiche ; l'ajout la met dans « À venir » du compte, à la place du frais fixe qui l'estimait ; les factures passées ne sont pas proposées. |
| t100 | Facture payée par une provision : depuis la provision (« + Prélèvement » propose les factures récentes), le détail du fournisseur (« Lier ») ou la fiche de la facture, toujours par la même feuille (compte + provision) ; supprimer la facture retire le prélèvement. |
| t101 | Provisions reliées : la mise de côté devient un frais fixe « Provision · nom » (un ancien frais « Eau 20 € » est relié, pas doublé) ; l'argent qui reste sur le compte courant n'en sort pas ; facture payée par la provision en un seul geste (compte + provision, virement du livret en option), hors parts du Commun ; « Sauter ce mois », montant, « Remplie par », « Ne plus la compter », suppression de la provision ; import : le virement de 2 provisions d'un coup est reconnu. |
| t102 | Provisions : graphique « De côté » / « Avec les factures prévues » (un mois futur ne repart plus de 0) ; factures prévues (montant prévu, factures estimées du fournisseur suivi, même mois l'an dernier, « montant non indiqué ») ; ce qui manquera et « Passer à … / mois » ; les 12 mois d'À venir en jaune ; carte du fournisseur « prête pour … · il restera … ». |
| t103 | Reprendre des virements du mois d'avant : cochés d'office s'ils étaient déjà là le mois d'avant, « déjà en … » ; mois suivant, une période (virement vers un livret), chaque mois (série : un virement par mois 12 mois à l'avance, modifier à partir d'un mois, retirer un mois sans qu'il revienne, arrêter) ; « Reprendre ce virement » ; import : le virement déjà là devient fait, annulable. |
| t104 | Frais fixe : « Prélevé sur » sans « Automatique », le compte par défaut déjà choisi et qui suit « Pour qui » ; un compte choisi à la main est gardé. |
| t105 | Passer un virement envoyé en frais fixe : pas pour un virement reçu ni vers l'épargne ; fenêtre remplie ; « Sans fin » retire les mêmes virements des mois suivants ; déjà fait → frais fait le même jour, solde inchangé ; clé d'import gardée ; « Annuler » ; « Plusieurs mois » en frais commun. |
| t106 | Provisions : le total s'appelle « Total provisions » dans À venir › Provisions et Compte › Graphiques. |
| t107 | Factures de mobile au format Free (PDF fictifs `facture_mobile_fictive_09/10.pdf`, faits par `donnees/facture_mobile_fictive.py`) : accents détachés, montants « 15.99 e », date en lettres, prélèvement sur la carte. |
| t108 | Factures : corpus de factures inventées (`donnees/factures_fictives.json`) passé dans `parseBill` ; fournisseur au format inconnu (`facture_inconnue_09/10/11.pdf`) : corriger la plus récente remplit la plus ancienne, « Appliquer » retient la lecture, la suivante est lue toute seule. |
| t109 | Abonnement dont le prix change (9,99 € puis 15,99 €, sans consommation) : prochaine facture et « par mois » au prix actuel, rythme tiré des factures, estimation déjà dans À venir déplacée et mise à jour. |
| t110 | Factures : PDF Factur-X fictif (`facture_facturx_fictive.pdf`), facture retrouvée sur le relevé (égal / différent, « Prendre le relevé »), contrôles (montant inhabituel, HT + TVA), prélevé sans facture, lecture apprise par voisinage. |
| t111 | Tickets et relevé : « Compléter ce paiement » (ticket « relevé » complété, sans doublon), « Retrouvé sur ton relevé » / « Prendre le relevé », date dans le futur, import qui corrige le total d'un ticket (et son annulation). |
| t112 | Scan des tickets : jeu d'essai `donnees/tickets_fictifs.json` (ML Kit imité, taux de bonne lecture), total recoupé (articles, carte, TVA) et « Prendre … », total appris par enseigne, scanner de documents (`scanDoc` imité) et son repli. |
| t113 | Stockage : mémoire locale pleine (imitée) → les tickets passent dans IndexedDB, retrouvés après redémarrage, puis reviennent dans localStorage quand la place se libère. |
| t114 | Photos d'origine (2 pages scannées, photo ajoutée) gardées telles quelles, visionneuse, galerie par mois et ⋯ (annulable), Menu › Stockage (années, mois, « Garder 2 ans »), sauvegarde complète ZIP (CRC, photos identiques) et données seules, restauration du ZIP et d'une ancienne sauvegarde JSON |
| t115 | Accueil : 4 cartes illustrées (captures de beta/vitrine) au premier démarrage ; Menu › Aide : guide du propriétaire (9 parties, déplier, recherche) et du membre puis « Je commence / Rejoindre un foyer », une fois sur un téléphone déjà utilisé (Passer), Menu › Aide › « Revoir l'accueil », 2 diapos du membre après le code. Dans les autres tests, l'accueil ne s'ouvre pas tout seul (`horloge.py`) |
| t116 | Commun › Qui doit combien à qui : couple (« Marie te doit 470,00 € »), Remboursé avec virements puis Annuler, sans virement (400 €), historique et suppression, report sur le mois suivant, famille de 4 (3 remboursements au plus), Store sans Plus (présentation, bouton ✦) |
| t117 | Ticket « Partagé avec » : choisir les personnes (Tom et Lou décochés, 33,33 % chacun), total ≠ 100 % refusé, articles en « Dépense commune », dessert décoché, enregistré avec share ; Commun : seules Marie et Léa doivent leur part, « · avec Toi, … » ; retour à « Tout le foyer » ; « Tout le ticket en commun » (article Divers) |
| t118 | Version Store : « ✦ Découvrir Tickets Plus » sur les 4 cartes de l'accueil, carrousel Plus (6 cartes, captures chargées), « Plus tard » ramène à la carte de l'accueil, « Prendre » (bientôt), menu « ✦ Tickets Plus », boutons ✦ de Commun et Factures, avec Plus : plus de lien ni de ligne |
| t119 | Foyer : retirer un membre pas à jour depuis 3 jours → « n'est pas à jour depuis le … : … sera perdu », nouveau QR code proposé ; à jour → pas d'avertissement |
| t120 | Foyer : espace perso d'un membre (« Mes comptes ») : ses données d'avant le foyer, pastille, ticket perso jamais envoyé, retour au foyer tel quel, données perso gardées de côté et retrouvées |
| t97 | Accueil : la page des petits graphiques (« 3 / 8 ») est gardée : changement d'onglet, relance, et quand la mise en page fait défiler sans geste (Accueil dessiné avant d'avoir sa taille, largeur qui change). |
| t96 | Plusieurs factures d'un coup : 3 factures d'eau en photos (recto et verso, avec les erreurs de lecture du téléphone, aussi dans le désordre) et 3 PDF dont un sans texte. Écran de contrôle « 6 photos · 6 lues », la plus récente, fiche d'une ancienne (Précédente / Suivante), décocher, photo illisible puis « Reprendre », rien d'enregistré avant « Appliquer ». La partie PDF a besoin de pdf.js (voir t90). |

**À savoir**
- **Date des tests** : les données inventées sont en octobre 2026. `horloge.py` (une ligne `import horloge` dans chaque test) fait croire au navigateur qu'on est le 30/10/2026 à 10 h ; l'heure avance normalement à partir de là. t76 se place au 27/10 ; les tests du foyer (t93) gardent la vraie heure, que le relais local compare. Pour essayer un autre jour : `TICKETS_NOW=2026-10-31T09:00:00 python3 tests/t95.py`.
- t93 attend parfois le relais : en cas d'échec isolé, relancer le test une fois avant de chercher un bug.

**Non inclus**, parce qu'ils utilisent de vraies données :
- import des relevés BoursoBank ;
- import de factures EDF et d'eau ;
- vrais tickets lus par ML Kit.

Pour un nouveau cas, écrire des données inventées qui reproduisent le problème.

## Écrire un test

- Partir d'un test proche, par exemple t95 : fonctions `check`, `ctx`, `tabs`…
- Données : un dictionnaire de clés localStorage (voir « Données » dans `CLAUDE.md`), injecté puis `reload()`.
- Version Store : ouvrir `beta/index.html?edition=store`, et ajouter `{"plusUnlocked": true}` pour avoir Plus.
- Les montants affichés contiennent des espaces fines insécables (U+202F). Il faut les normaliser avant de comparer du texte.
