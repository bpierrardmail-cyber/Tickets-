# Journal de Tickets

Ce journal sert à reprendre le travail sans relire les conversations. **À lire en premier** : « État actuel », puis « En cours ».

Après chaque modification, dans le même commit :
1. ajouter une entrée datée en haut de l'**Historique** : ce qui a changé, et pourquoi si ce n'est pas évident ;
2. noter toute décision de Benoît dans **Décisions**, avec sa date ;
3. mettre à jour **État actuel** et **En cours** si nécessaire.

### Reprendre le travail ailleurs
- **Claude Code ouvert sur le dépôt** : rien à faire, `CLAUDE.md` est lu automatiquement et renvoie vers ce journal.
- **Autre abonnement ou conversation Claude** : joindre `PASSATION.md` (vue d'ensemble, liens, avancement, pistes ; https://raw.githubusercontent.com/bpierrardmail-cyber/Tickets-/main/PASSATION.md), ou demander « Lis CLAUDE.md puis JOURNAL.md du dépôt GitHub bpierrardmail-cyber/Tickets- ». Si l'accès à GitHub n'est pas branché, donner les liens directs :
  - https://raw.githubusercontent.com/bpierrardmail-cyber/Tickets-/main/CLAUDE.md
  - https://raw.githubusercontent.com/bpierrardmail-cyber/Tickets-/main/JOURNAL.md
- Si le dépôt devient privé, ces liens ne marchent plus : joindre les deux fichiers à la conversation.

---

## État actuel (31/10/2026)

**Versions**
- β web : `beta/index.html`, étiquette `02/11 14:50`, environ 9 800 lignes.
- APK de test « Tickets Perso » (avec la Bourse) et « Tickets Store » (sans la Bourse), release `apk-beta`, recompilés quand la β ou l'appli Android change.
  - **Perso** : charge la β en ligne (chaque correction arrive tout de suite) et en garde une copie : sans réseau, elle ouvre la dernière version, avec les mêmes données.
  - **Store** : appli complète, la β est dans l'APK (avec le lecteur PDF et l'inflation INSEE du moment) ; aucune connexion pour l'usage normal, mises à jour par le Store.

**Onglets**
- **Accueil** : graphiques choisis par l'utilisateur (⚙ Choisir, appui long pour changer, déplacer ou masquer), grande carte du haut au choix. Pastilles ✍️ Saisie et 🧾 Tickets. Filtre par personne en haut à droite. Rien sous les graphiques.
- Barre du bas : **Accueil · Dépenses · Compte · À venir · Commun · Bourse** (pas de Bourse en Store). Chaque onglet a ses sous-onglets en boutons sous le titre ; ✦ = Plus, on voit la fonction et seul le bouton demande Plus.
- **Dépenses** : 4 sous-onglets **Tickets · Produits · Budgets · Analyse** ;
  - Tickets : la liste du mois (recherche, calendrier) et « Photos des tickets » (la galerie) ;
  - Produits : produits et prix (Mes produits, Hausses, Magasins, Familles), fiche produit avec tous les achats ;
  - Budgets : budgets par catégorie ;
  - Analyse : graphiques Mois, Répartition, Récurrentes et Qui a payé, bouton « + Frais fixes », détail d'un mois, bouton ✦ Analyse avancée (inflation perso INSEE, année / an dernier, alertes, reste à vivre, résumé pour une IA).
- **Commun** : parts du commun en % et parts propres à chaque frais, bouton « Produits partagés ». Graphique Mois (6, 12, 12 à venir, Tout). Bandeau des personnes. Les frais communs du mois y sont à voir ; ils se modifient dans À venir › Frais fixes.
- **Compte** : 3 sous-onglets **Opérations · Épargne · Graphiques** (bouton « ＋ Ajouter » dans Opérations : virement reçu ou envoyé, frais fixe, ticket), et la **roue du compte** en haut à droite (modifier le compte, solde reporté, importer un relevé, annuler le dernier import, compte principal, supprimer) ;
  - toucher un virement : Modifier, « ↻ Reprendre ce virement », « 📅 Passer en frais fixe » (virement envoyé) ;
  - Opérations : « ＋ Ajouter › ↻ Reprendre des virements » du mois d'avant (mois suivant, un mois, une période ou chaque mois ; les virements « chaque mois » se créent seuls, 12 mois à l'avance) ;
  - Opérations : la **liste des opérations du mois**, comme un relevé de banque : solde estimé, Entrées / Sorties / Fin de mois, filtres Tout · Entrées · Sorties · À venir, recherche (nom ou montant, avec le total), bloc « À venir » avec un rond pour marquer « fait », puis les opérations par jour (le plus récent en haut) avec le solde du soir, et le report en bas ;
  - Graphiques : les 6 graphiques (Ce mois, Dépenses, Solde, Entrées-sorties, Épargne, Provisions), touchables (une barre ouvre Virements ou les Opérations filtrées) ;
  - plusieurs comptes par personne, sur une rangée qui défile (la carte des comptes garde la même hauteur) ;
  - Épargne : comptes épargne et objectifs, avec la ligne Provisions qui ouvre À venir › Provisions ; plus de page « Configuration », ni de pages Dépenses et Solde bancaire ;
  - bouton « Liquide » ;
  - rien avant le début du suivi ;
  - mois à venir = solde prévu.
- **À venir** (ex Factures, ouvert à tous ; seule la partie Factures est dans Tickets Plus en Store) : sous-onglets **12 mois · Frais fixes · Provisions · Factures** ;
  - Frais fixes : tous (communs et perso), comme l'ancienne page de Commun, dont la mise de côté des provisions (« Provision · nom ») ; Provisions : l'ancienne page de Compte › Configuration, avec « Remplie par » et « facture pas encore retirée · Retirer », un graphique « De côté » / « Avec les factures prévues » et la liste des factures prévues sur 12 mois (ce qui manquera, « Passer à X € / mois ») ;
  - une facture payée par une provision va dans le compte et sort de la provision en un seul geste (virement du livret en option), hors parts du Commun ;
  - les 12 prochains mois : frais fixes, factures reçues ou estimées, échéances des provisions ; un mois en jaune s'il manquera de l'argent dans une provision ; toucher un mois donne le détail ; en dessous, ✦ « Tes comptes dans 12 mois » (projection et simulateur, ex Analyse avancée) ;
  - « À payer bientôt » (30 jours, tous comptes) ;
  - Factures : une carte par fournisseur (prochaine facture estimée, moyenne par mois, provision : « prête pour … » ou « il manquera … ») ; en Store sans Plus, ce que Plus apporte et un seul bouton ✦ ;
  - « Importer une facture » : un ou plusieurs PDF (texte lu sur le téléphone par pdf.js), ou des photos page par page (ML Kit, « + Page suivante », page tournée remise droite) ; plusieurs factures d'un coup (PDF, ou photos recto et verso même dans le désordre) → écran de contrôle « 6 photos · 6 lues · 3 factures trouvées » : la plus récente vérifiée en entier, les plus anciennes à contrôler ou décocher, photo illisible à reprendre, rien d'enregistré avant « Appliquer » ;
  - la facture lue : champs modifiables, comparaison avec l'an dernier, et trois effets à cocher : le prélèvement (ou « à payer ») dans « À venir » à la place du frais fixe estimé ce mois-là, la prochaine facture estimée, la provision (créer, ou payer la facture avec) ;
  - détail d'un fournisseur : provision, factures en barres avec la prochaine estimée, moyenne par mois, consommation sur 12 mois, prix moyen, liste (toucher une facture pour la modifier, appui long pour Modifier / Supprimer, suppression annulable) ; la carte du fournisseur dit combien de factures il a.
- **Bourse** (Perso seulement) : cours Yahoo et CoinGecko via le relais, courbe 1J. Comptée une fois dans l'épargne, comme une ligne automatique (« dont Bourse » sur l'Accueil et dans Épargne).

**Menu** : 3 blocs sans titres et sans défilement. Foyer partagé, Personnes, Sauvegarder (complète en ZIP, ou données seules), Stockage · Exporter en PDF, Aide (revoir l'accueil ; le guide est à écrire), Réglages (devise, code et empreinte, restaurer une sauvegarde JSON ou ZIP).

**Accueil en diapos** : au premier démarrage 3 diapos (Bienvenue, Bien scanner, Pour aller plus loin) puis le choix « Je commence / Rejoindre un foyer » ; une fois sur un téléphone déjà utilisé ; un membre a ses 2 diapos (« Tu as rejoint le foyer de … », « Ajouter tes tickets »). Menu › Aide › « Revoir l'accueil ».

**Photos des tickets** : gardées en qualité d'origine (toutes les pages) en plus de la petite photo des listes ; galerie rangée par mois (⋯ : supprimer les photos d'un mois ou d'une année) ; Menu › Stockage (place utilisée, années / mois, « Garder les photos d'origine » Toujours / 5 ans / 2 ans). Les tickets restent toujours, la galerie du téléphone n'est jamais touchée.

**Foyer partagé**
- Invitation par QR code. Copies chiffrées sur le relais, que le relais ne peut pas lire. Code + empreinte obligatoires.
- Droits par onglet : Masqué / Lecture / Modif.
- Comptes choisis ou « Aucun · ses tickets ». Option « Tickets visibles : tout le foyer ».
- L'Accueil des membres est personnel.

**Appli Android**
- Marche sans réseau : tickets, scan (ML Kit est dans l'APK), comptes, commun, factures, analyse. Seuls le foyer partagé (changements envoyés au retour du réseau) et la Bourse (Perso) en ont besoin.
- Lecture des tickets par ML Kit, sauvegarde dans Documents/Tickets.
- Empreinte native, Bilan PDF, geste retour.
- Widgets (Scan, Solde, Commun, Mois, Foyer, Bourse), masqués par défaut.

**Tests** : `tests/` (Playwright, données fictives), `sh tests/run.sh`.

**Import d'un relevé** (roue du compte) : OFX/QFX, QIF, CSV lus sur le téléphone, aperçu à cocher, import en une fois, annulable. Détails dans `CLAUDE.md`.

**Version Store** : `PLUS_FEATURES = widgets, foyer, avancee, factures` (« factures » = importer et suivre ses factures ; le reste d'À venir est gratuit). L'achat de Plus n'est pas encore branché. L'import de relevé est gratuit pour l'instant.

## En cours / à reprendre
- **Guide de l'appli (Menu › Aide)**, à écrire avec Benoît : un guide du propriétaire (pour commencer, scanner, Dépenses, Compte, À venir, Commun, foyer, photos et sauvegardes, questions fréquentes) et un guide du membre (ce que tu vois, ton accueil, ajouter un ticket, ce que tu peux modifier, questions fréquentes), dans l'appli, sans réseau ; le membre ne voit que les parties de ses onglets.

- **Réorganisation de l'appli** (31/10) : il trouve l'organisation et l'accès aux fonctions peu clairs. Plan proposé dans la maquette « Tickets — Plan de l'appli » : un onglet = une question, chaque chose à un seul endroit, sous-onglets visibles au lieu de « Configuration », ✦ partout pareil (on voit la fonction, seul le bouton demande Plus). Onglets proposés : Accueil · Dépenses (Articles + Analyse) · Compte (Opérations · Virements · Épargne · Graphiques, roue du compte) · À venir (ex Factures, ouvert à tous : 12 mois · Frais fixes · Provisions gratuits, Factures ✦, Projection ✦) · Commun (parts seulement) · Bourse. En 4 étapes, À venir d'abord (sa question : les provisions dans Factures). Décidé le 31/10 : nom « À venir », 12 mois gratuits. **Les 4 étapes sont intégrées (31/10).** À essayer par Benoît sur son téléphone ; à revoir selon ses retours.

- **Provisions reliées** (01/11) : à vérifier par Benoît sur ses données : ses frais « Eau » et « Amazon » doivent être devenus « Provision · Eau » / « Provision · Amazon » (pas de doublon) ; les autres provisions ont un nouveau frais à partir de novembre (sinon « Remplie par » → « Pas dans les frais fixes ») ; la facture Région Minière du 02/11 : « Ajouter » la met dans le compte et la retire de « Eau ».

- **Factures d'eau en photos** (31/10) : à réimporter par Benoît (ses 6 photos d'un coup), après avoir supprimé la mauvaise facture « Région » à 304,06 € si elle a été enregistrée.

- **Sans réseau** (31/10) : à essayer par Benoît en mode avion avec les nouveaux APK.
  - Perso : installer le nouvel APK, l'ouvrir une fois avec du réseau (la copie s'enregistre), puis en mode avion.
  - Store : l'appli de test repart vide (ses données étaient rattachées à l'adresse en ligne) ; pour garder ses essais, faire une sauvegarde avant et la restaurer après.

- **Import d'un relevé** : fait le 25/10, à essayer par Benoît sur son téléphone avec ses 3 exports BoursoBank (comptes « Compte OFX », « Compte QIF », « Compte CSV »).
  - À décider : gratuit ou réservé à Plus.
  - Pistes si besoin : lire directement les fichiers propres à Grisbi (`.gsb`, du XML) ; rapprocher un remboursement d'un achat (ex. virement de 77,41 € pour un Brico Dépôt de 77,41 €).
- Reportés à la sortie Store :
  - paquet signé (AAB) pour la Play Console, envoyé à la main puis automatiquement depuis GitHub ;
  - QR code lisible par l'appareil photo ;
  - Workers Paid ;
  - WebSocket ;
  - protection contre les abus à la création de foyer ;
  - copies différentielles ;
  - domaine UE.
- À décider par Benoît : répartition gratuit / Plus et prix, nom de l'appli, type de compte Google Play, lien avec la banque.
- **Lecture des tickets** : sur le vrai ticket Intermarché, ML Kit perdait encore 4 ou 5 articles (sur 31) que le texte idéal donne bien ; il faut le texte lu par le téléphone pour trouver pourquoi. « Copier la lecture » est en place (28/10) et a servi pour le ticket Intermarché (corrigé). Pour tout ticket mal lu : photo + lecture copiée.
- **Lecture des tickets par une IA** : mise de côté le 28/10 par Benoît. Pistes étudiées : Gemini Nano dans le téléphone (API Prompt de ML Kit, photo + texte, encore en essai et seulement sur quelques téléphones récents) ; modèle libre embarqué (Gemma, 1 à 3 Go, lent) ; IA en ligne (environ 0,3 centime par ticket avec Gemini Flash-Lite, mais la photo sort du téléphone et il faut une clé payante, via le relais ou par utilisateur). Si on la reprend : option Plus « Relire avec l'IA » seulement quand le ticket ne tombe pas juste, avec accord la première fois. Gain principal attendu : les produits rangés tout seuls et des noms propres, plus que les montants.
- **Améliorations prévues** (liste de Benoît, à faire plus tard ; montrer une maquette avant) :
  - **« Lire avec mon IA »** (ajouté le 28/10) : sur un ticket scanné, un bouton envoie la photo et une consigne toute prête à l'IA déjà installée sur le téléphone (Claude, Gemini, ChatGPT, Kimi…) par le menu de partage d'Android. C'est l'abonnement de l'utilisateur qui travaille : ni relais, ni clé, ni coût pour nous. La consigne contient la liste des produits de l'utilisateur, pour que l'IA range chaque article dans **ses** produits ; elle demande une réponse dans un format fixe (`TICKET` / `enseigne | date | total` / une ligne `nom | prix | produit` par article / `FIN`). Retour : on copie la réponse et on la colle dans Tickets, qui remplit articles, prix et produits puis fait la vérification habituelle avec le total. Deux niveaux :
    - sans nouvel APK : partage de la photo (+ consigne aussi copiée dans le presse-papiers) et champ « Colle la réponse de l'IA » ;
    - avec un nouvel APK : Tickets apparaît dans « Partager » de l'appli IA, la réponse revient sans copier-coller.
    Limites à dire à l'utilisateur : la photo part chez le fournisseur de l'IA qu'il a choisi ; 3 ou 4 gestes de plus ; lire la réponse avec souplesse (une IA ne respecte pas toujours le format). En plus de la lecture actuelle, pas à la place.
  - ~~Importer ses factures~~ et ~~onglet Factures~~ : faits le 31/10 (voir État actuel). Notes de l'étude : PDF (texte lu sur le téléphone, plusieurs pages) ou photos page par page (« + Page suivante »). On en tire fournisseur, montant, date de prélèvement ou « à payer à réception », période, consommation (kWh, m³), prix, prochaine facture. Effets proposés, à cocher : le prélèvement exact dans « À venir » (à la place de l'estimation du frais fixe), la prochaine facture estimée (même période l'an dernier corrigée de l'évolution de la consommation), une provision qui lisse les factures de l'année ; page « Mes factures » (factures par période, 12 mois, prix, prochaine). Essai sur de vraies factures : les PDF EDF donnent ces informations à coup sûr par des règles simples ; les factures d'eau papier sont lisibles mais certaines photos sont tournées (à remettre droites). Jamais de vraies factures dans le dépôt.
  - Page « Mes factures » (étude) : les 12 prochains mois (frais fixes + factures reçues ou estimées, alerte s'il manque dans une provision), « À payer bientôt », une carte par facture avec sa provision (de côté, mensualité, « prête pour … » ou « il manquera … »), boutons Importer une facture et + Provision. Elle reprendrait la page Provisions actuelle (Compte › Configuration) ; le graphique « 12 à venir » du Commun et les « prochains mois » de l'Analyse avancée y seraient réunis. Maquette : écran 1 du canevas. Décidé le 31/10 : **un onglet « Factures »** (entre Compte et Analyse ; 7 onglets en Perso, 6 en Store, écran 6) et **une option Tickets Plus** (`PLUS_FEATURES` + "factures" ; écran d'accès comme l'Analyse avancée, écran 7). Pour ne rien retirer aux gratuits, les provisions restent aussi dans Compte › Configuration. Foyer : l'onglet aura ses droits (Masqué / Lecture / Modif.) ; les provisions y seraient rattachées (aujourd'hui à Compte dans `FY_KEY_TAB`). Intégré le 31/10.
  - **Retrait au distributeur** scanné : le proposer comme « argent liquide » plutôt qu'en dépense (Benoît : « on verra après »).
- À surveiller : l'option « Ajouter au foyer » (verser ses anciennes données en rejoignant) sera retirée si personne ne s'en sert.

## Décisions de Benoît

- **02/11** : pour la sortie Store, dans l'ordre : stockage sans limite (fait), écran « Licences » et mention INSEE, suppression du foyer, politique de confidentialité et fiche « Sécurité des données » (statistiques ML Kit).
- **02/11** : scan des tickets amélioré de façon générique (scanner de documents, total recoupé, total appris par enseigne, jeu d'essai), d'après la maquette ; le partage d'informations entre utilisateurs est laissé de côté pour l'instant (pistes : envoi volontaire puis tables livrées à la mise à jour, ou table commune par le relais avec accord et seuil de plusieurs utilisateurs).
- **02/11** : rapprochement avec le relevé, contrôles de cohérence, lecture par voisinage et Factur-X pour les factures, d'après la maquette ; les mêmes idées (relevé, contrôles) pour le scan des tickets.
- **01/11** : la lecture s'améliore après la 1re facture d'un fournisseur, et l'appli le dit (maquette validée) ; elle retient aussi la 1re facture enregistrée sans correction.
- **01/11** : lecture des factures rendue plus tolérante (lecture générale) et apprentissage par fournisseur à la première correction ; « Lire avec mon IA » pour les factures plus tard, avec celle des tickets ; la lecture en ligne par une IA reste de côté.
- **01/11** : passer un virement envoyé en frais fixe (un mois, plusieurs mois, sans fin), d'après la proposition (« tu peux intégrer ») ; mettre à jour `PASSATION.md`.
- **01/11** : reprendre des virements du mois d'avant (mois suivant, un mois, une période, chaque mois), d'après la maquette (« tu peux intégrer »).
- **01/11** : graphique des provisions avec les factures prévues, d'après la maquette (« tu peux intégrer ») : onglets De côté / Avec les factures prévues, liste des factures prévues avec ce qui manquera.
- **01/11** : provisions reliées aux frais fixes, au Commun et aux comptes, d'après la maquette (« va y ») : la mise de côté est un frais fixe relié, une facture payée par une provision va dans le compte et sort de la provision en un seul geste, sans compter deux fois dans les parts.
- **01/11** : l'onglet Virements de Compte est retiré ; un bouton « ＋ Ajouter » (virement reçu, envoyé, frais fixe, ticket) va dans l'écran Opérations.
- **31/10** : écran de contrôle de plusieurs factures (photos ou PDF) intégré d'après la maquette (« tu peux intégrer ») : nombre de pages lues sur le nombre de photos, « LA PLUS RÉCENTE », contrôle des plus anciennes, rien d'enregistré avant « Appliquer » ; et mettre à jour `PASSATION.md`.
- **31/10** : étapes 3 et 4 de la réorganisation intégrées sans maquette (« tu peux passer à la 3 et aux autres ») : onglet Dépenses, finitions.
- **31/10** : étape 2 de la réorganisation intégrée (« tu peux y aller ») : Compte en sous-onglets, roue du compte, import seulement dans la roue.
- **31/10** : étape 1 de la réorganisation intégrée (« tu peux intégrer ») : onglet À venir.
- **31/10** : réorganisation de l'appli : l'onglet Factures s'appellera « À venir » ; dans la version Store, les 12 prochains mois y sont gratuits (seules les factures, et leurs estimations, sont dans Plus).
- **31/10** : estimation des factures selon la saison (l'hiver consomme plus), pour les deux applis.
- **31/10** : l'appli doit marcher sans réseau. La version Store est une appli standard : entièrement dans l'APK, mises à jour par le Store comme les autres applis, aucune connexion nécessaire pour l'usage normal. La version Perso reste chargée en ligne (corrections tout de suite) avec une copie gardée pour marcher sans réseau.
- **31/10** : onglet « Factures » intégré (« tu peux intégrer ») : Plus dans la version Store ; les provisions passent de l'onglet Compte à l'onglet Factures pour les droits du foyer (elles restent visibles et gratuites dans Compte › Configuration).
- **31/10** : « Mes factures » sera un onglet, réservé à Tickets Plus dans la version Store.
- **31/10** : import de factures : effets proposés « à cocher » ; une page « Mes factures » qui sert d'accueil aux provisions et réunit le prévisionnel.
- **02/11** : accueil au premier démarrage avec une explication du scan et où trouver le guide ; le guide est à écrire ensemble ; pour un membre du foyer, accueil et guide faits autrement (« pour un membre du foyer le guide doit être fait autrement ») ; maquette de base retenue : 3 diapos propriétaire, 2 diapos membre (« pars sur ce que tu as prévu à la base », « tu peux intégrer »).
- **02/11** : photos des tickets en qualité d'origine (« il faut garder la meilleure qualité pour la meilleure lecture ») ; sauvegarde complète (données + photos) et possibilité de supprimer dans la galerie les photos d'un mois ou d'une année ; place utilisée indiquée dans le menu (maquette, « oui tu peux intégrer »). Les tickets restent ; seules les photos partent ; la galerie du téléphone est à part.
- **28/10** : « Lire avec mon IA » (partage vers l'IA déjà sur le téléphone, réponse collée dans Tickets) ajouté à la liste des améliorations ; la lecture par une IA en ligne payée par nous reste de côté.
- **28/10** : « Copier la lecture » sous un ticket scanné, pour envoyer à Claude ce que le téléphone a lu. Le retrait au distributeur → liquide : plus tard.
- **28/10** : appui long sur un ticket → Ouvrir / Supprimer, suppression annulable.
- **28/10** : produit d'un article vide = en orange ; rempli avec le dernier produit que la personne du ticket a donné à cet article, cloisonné par personne.
- **28/10** : ticket scanné : bandeau d'écart articles / total, question à l'enregistrement s'il reste un écart, photo en vignette (les 3 points de la maquette).
- **28/10** : la Bourse est toujours comptée une fois dans l'épargne, comme une ligne automatique qui suit l'onglet Bourse (maquette « Tickets — Bourse dans l'épargne ») ; plus de liaison manuelle.

- **27/10** : l'onglet Compte s'ouvre sur la liste des opérations (comme un relevé de banque), d'après la maquette « Tickets — Relevé du compte » ; un bouton « Graphiques » suffit pour les graphiques. Le jour des frais fixes et des virements se note tout seul (coché « fait », import), sinon le 1er du mois ; modifiable dans la fiche.

- **24/10**
  - Tenir ce journal à jour à chaque modification.
  - Étudier un import de relevé pour remplir un nouveau compte ; il doit aussi accepter les fichiers de Money, de Quicken et des autres logiciels de comptes connus.
- **25/10**
  - Menu raccourci comme sur la maquette, avec « Personnes » gardé dans le menu, sous « Foyer partagé ».
  - Accord sur la maquette de l'import : paiements par carte → tickets sans articles, prélèvements → frais fixes (« chaque mois » ou « une fois »), virements reçus et envoyés → virements, solde de départ calculé.
  - Les comptes d'une même page se suivent sur une rangée au lieu de s'empiler.
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

### 02/11
- **Accueil en diapos et Menu › Aide** (maquette ; « tu peux intégrer ») : `welcomeShow(after)` (plein écran `.wlc`, points, Passer / Suivant / ‹ Retour / Commencer, glisser), `welcomeSlides()` : propriétaire 3 diapos, membre 2 diapos ; premier démarrage : diapos puis `fyWelcome` (sauf si déjà vues) ; téléphone déjà utilisé ou membre : `welcomeAuto` une fois, après le code (`welcomeSeen`, `welcomeFy`) ; Menu › Aide (`openAide`) : « Revoir l'accueil », le guide « arrive bientôt ». Tests : `horloge.py` pose `window.__tkNoWelcome` pour que l'accueil ne s'ouvre pas tout seul (sauf avec `window.__wlcTest`, script de contexte), t72 et t95 (ligne Aide), nouveau `t115`.
- **Photos en qualité d'origine, Stockage, sauvegarde complète** (maquette ; « oui tu peux intégrer ») :
  - IndexedDB `ticketsdb` passe en version 2 avec le store `orig` : `{b:[Blob, …], s:taille}` par ticket (toutes les pages scannées, ou la photo ajoutée), écrit à l'enregistrement (`draft.photoFiles`, `origPut`), retiré avec la photo ou le ticket (`origDel`) ; tailles seules chargées au démarrage (`ORIGSZ`, `origSizes`) ; la petite photo (600 px) reste dans `photos` / `PHOTOS` pour les listes ; `navigator.storage.persist()` demandé ;
  - visionneuse : la photo d'origine (toutes les pages, « photo d'origine · 2 pages · 224 Ko »), toucher pour zoomer ; la fiche du ticket montre aussi l'origine ;
  - galerie rangée par mois, ⋯ ou appui long sur le mois → supprimer les photos du mois ou de l'année (`photosMenu`, `photosAskDelete` : avertit « jamais fait de sauvegarde complète » ou « Dernière sauvegarde complète : … » ; `photosDelete` annulable 7 s, `PHDEL`) ;
  - Menu › Stockage (`renderStockage`, vue `stockage`) : total, barre Photos / Données (`photosBytes`, `dataBytes`), place encore libre (`navigator.storage.estimate`), « Garder les photos d'origine » Toujours / 5 ans / 2 ans (`photoKeep`, dans la sauvegarde ; `photoKeepApply` au démarrage : au-delà, l'origine est retirée, la petite photo et le ticket restent), sauvegarde complète, années repliables puis mois avec « Supprimer » ;
  - Sauvegarder → « Sauvegarde complète · données + N photos » (ZIP sans compression écrit en JS : `zipBuild`, CRC par morceaux de 4 Mo ; `data.json` + `photos/AAAA-MM/<ticket>-<page>.jpg`, liste `_zip` ; Android : écrit par morceaux de 3 Mo `writeFile` / `appendFile`, Documents/Tickets ou partage ; `lastBackupFull`) ou « Données seules » (JSON sans photos) ; au-delà de 3,9 Go ou 65 000 fichiers : refus avec conseil ;
  - restaurer : JSON (anciennes sauvegardes avec petites photos, toujours lues) ou ZIP (`zipRead`, `restoreZip` : données, puis petites photos refaites et photos d'origine remises) ; `restoreApply` commun ;
  - menu : ligne « Stockage » (tests t72 et t95 mis à jour) ; test `t114`.
- **Stockage sans limite de 5 Mo** (« Il faut que toutes les fonctions soient légales et sans problème sur le long terme (espace de stockage…) » ; « oui commence par 1 ») : `store` écrit toujours dans localStorage tant qu'il y a de la place ; une écriture refusée (mémoire pleine) part dans IndexedDB (`tickets-kv`, `kvPut`) et la clé est notée dans `__idbOnly` (localStorage) ; au démarrage, s'il y en a, l'appli charge IndexedDB (`kvLoadAll`, 4 s au plus) puis se relance (même script, `window.__tkKV`) ; une donnée qui retient de nouveau revient dans localStorage ; plus de bandeau « mémoire pleine » ni de perte si IndexedDB est là ; `store.remove` remplace les `localStorage.removeItem` directs. Les photos étaient déjà dans IndexedDB (`ticketsdb`). Test `t113` (mémoire pleine imitée).
- **Scan des tickets : scanner de documents, total recoupé, total appris par enseigne, jeu d'essai** (« il faut que les systèmes de scan fonctionnent du mieux possible tout en étant génériques » ; maquette puis « oui » ; partage entre utilisateurs laissé de côté) :
  - scanner de documents de Google Play (ML Kit, `play-services-mlkit-document-scanner:16.0.0`) : `TicketsNative.scanDoc({pages})` → `{images}` (JPEG base64), lancé par `startIntentSenderForResult` et rendu par `handleOnActivityResult` (`requestCodes = {9741}`) ; « 📷 Prendre une photo » d'un ticket (3 pages max), le widget Scan et les photos de factures (12 pages) passent par `docScan` ; absent ou en échec (navigateur, téléphone sans le module) → « Scanner indisponible · Prendre une photo » (l'appareil photo comme avant). **Nouvel APK.** ;
  - total recoupé : `parseTicket` rend aussi `carte` (ligne de paiement CB / carte / sans contact, pas espèces ni fidélité) et `tva` (somme des TTC du tableau de TVA) ; la fiche montre les sources (Articles · Carte · TVA, ✓ si égales au total) et, si deux sources sont d'accord contre le total lu, « ⚠ Lu X, mais … disent Y » avec « Prendre Y » / « Garder X » (`tkSrcPaint`, `draft.scan`) ;
  - total appris par enseigne (`tkAppris`, sur le téléphone, dans la sauvegarde) : à l'enregistrement d'un ticket scanné (1er ticket de ce magasin, ou total corrigé), les mots avant le total (ligne de total de préférence, sinon la dernière qui porte ce montant : un article seul n'est pas pris) (`tkAnchorOf`) ; au scan suivant, le total est relu au même endroit (`factAnchorFind` avec `tamt`) et sa ligne retirée des articles ; « ✓ Total lu comme tes tickets … », « Ticket enregistré · total retenu pour … » ;
  - « Somme due » et « à régler » reconnus comme lignes de total ;
  - jeu d'essai `tests/donnees/tickets_fictifs.json` (4 tickets inventés, lus 4 sur 4) et test `t112`.
- **Factures et tickets vérifiés par le relevé, contrôles, lecture par voisinage, Factur-X** (« un autre moyen pour améliorer la lecture » ; maquette ; « oui et tu peux faire les améliorations sur le scan Tickets aussi ») :
  - le relevé importé est gardé (clé `releve` : date, libellé, montant, compte, n° d'import ; retiré par « Annuler le dernier import » ; avant, `bankLines` le retrouve dans les tickets « relevé » et les frais fixes importés) ; `bankFind` cherche un paiement au même nom (`bankNameMatch`), dans la période, montant égal ou proche ;
  - facture lue : retrouvée sur le relevé → « 🏦 Retrouvée sur ton relevé… » et le jour du prélèvement pris sur le relevé ; montant un peu différent → « Sur ton relevé : … » avec « Prendre le relevé » / « Garder la facture » (`factBankMatch`) ; détail d'un fournisseur : « Prélevé le … sur ton relevé, mais pas de facture de … · Importer la facture » ;
  - contrôles (`factChecks`) : montant 3 fois plus ou moins que d'habitude chez ce fournisseur, prélèvement avant la facture, date dans le futur, « ✓ HT + TVA = TTC » ou « c'est le montant hors taxes » ; en orange sous le champ ;
  - lecture apprise par voisinage (`factAnchorFind`) : mêmes derniers mots, sinon le libellé n'importe où avant la valeur, sinon ses 2 derniers mots ;
  - Factur-X / ZUGFeRD : données XML jointes au PDF lues (`factFxRead`, `factFxParse`, ligne « [Factur-X] » ajoutée au texte), elles l'emportent ; pdf.js 6 rend une `Map` et le contenu par `getAttachmentContent` ;
  - tickets : fiche → paiement par carte déjà là (ticket « relevé » sans articles) : « Ce paiement est déjà dans tes comptes (relevé) » et « Compléter ce paiement » (même fiche, montant du relevé, plus de doublon, `mergeInto`) ; ligne du relevé gardée : « Retrouvé sur ton relevé » ou « Prendre le relevé » ; date dans le futur signalée (`tkBankPaint`) ; import d'un relevé : ticket au même nom avec un total un peu différent → « total corrigé : X → Y », le ticket prend le montant du relevé (annulable) ;
  - tests `t110` (factures, PDF Factur-X fictif fait par `donnees/facture_mobile_fictive.py`) et `t111` (tickets).
- **Abonnement dont le prix change** (Free Mobile : « le prix mensuel a changé, c'est bien 15,99 par mois, pas 10 € » ; l'appli affichait « tous les 2 mois », 6 €/mois en moyenne, prochaine ≈ 10 € vers le 27/12) : série sans consommation (`factNoConso`) → prochaine facture = montant de la dernière (`how:"prix"`, affichée exacte, « Même montant que ta dernière facture ») et « Par mois · au prix actuel » au lieu de la moyenne sur 12 mois ; rythme tiré de l'historique dès 3 factures, une « prochaine facture » annoncée ne passe devant que si elle s'accorde avec lui (`factRythme`, `factNextDate`) ; l'estimation déjà dans À venir suit le montant et le mois recalculés (`factEstRefresh`). Test `t109`.

### 01/11
- **Factures : dire que la lecture s'améliore après la 1re facture** (« il faudrait indiquer que la détection fonctionne mieux après le 1er import manuel ou automatique » ; maquette puis « oui ») : Factures, au-dessus de « Importer une facture » : « La lecture s'améliore avec l'usage… » (`.fct-tip`) ; fiche de la facture lue : fournisseur sans lecture retenue → « 1re facture de ce fournisseur : vérifie la date et le montant… » et champs vides en orange, lecture retenue appliquée → « ✓ Lue comme les précédentes factures de ce fournisseur » (`.fct-hint`, `factKnown`, `r.learnt`) ; corriger la plus récente d'un import → « N plus anciennes complétées avec ta correction » ; la 1re facture d'un fournisseur enregistrée sans correction est aussi retenue (sa date et son montant validés). Tests `t107`, `t108` complétés.
- **Factures : libellés relevés en ligne** (« tu pourras ajouter les données de factures récupérées sur internet ? ») : les guides « comprendre ma facture » (EDF, Engie, TotalEnergies, Veolia, Suez, Saur, Bouygues, La Poste Mobile) donnent peu de libellés exacts et pas la mise en page ; les libellés trouvés vont dans la lecture générale plutôt que dans une table par fournisseur : « date limite de règlement » (= à payer, échéance), « facture éditée le », « date de fin d'engagement » écartée ; 3 factures inventées avec ces libellés ajoutées au corpus (12 lues sur 12). La table de lectures par fournisseur attend des libellés tirés de vraies factures.
- **Factures : lecture générale et apprentissage par fournisseur** (« le système fonctionne mal, les utilisateurs ne pourront pas ou peu importer de facture » ; « OK pour 1 et 2 ») :
  - lecture générale : quand les règles ne trouvent pas la date ou le montant, chaque montant et chaque date reçoit une note selon les mots de sa ligne (ou de la ligne au-dessus si la valeur est seule) et le mieux noté l'emporte (`factGuessAmt`, `factAmtScore` : « à payer », « TTC », « total », « prélevé »… contre « HT », « TVA », « dont », « capital »… ; `factGuessDate`, `factDateScore` : « date de facture », « émise le », « Date : », « Le … » contre échéance, période, contrat, prochaine) ; prélèvement sur une ligne « prélèv… » (`factGuessPrelev`) ; toutes les dates d'une ligne avec leur position (`factDatesIdx` : chiffres, lettres, AAAA-MM-JJ) ; « Prélèvement à partir du » ; « Règlement à réception » = à payer ; « date limite de paiement » sans date (conditions générales) ne veut plus dire « à payer » ;
  - apprentissage : à « Appliquer », une date ou un montant corrigé est retenu pour ce fournisseur (nom lu à l'origine) : les 4 derniers mots avant la valeur, ou la ligne au-dessus (`factLearn`, `factAnchorOf`, clé `factAppris`, gardée sur le téléphone et dans la sauvegarde, pas synchronisée dans le foyer) ; la facture suivante est relue au même endroit (`factLearntApply`, prioritaire sur les règles) ; dans un import de plusieurs factures, corriger la plus récente remplit aussitôt les plus anciennes du même fournisseur (`factFillOthers`) ; message « lecture retenue pour … » ;
  - corpus de 9 factures inventées (`tests/donnees/factures_fictives.json`) : 5 ratées avant, 9 lues après ; les 12 Free de Benoît toujours justes. Test `t108`.
- **Factures Free Mobile en PDF : rien de lu** (12 PDF : « Date ? », montant vide, « à payer à réception ») : ces PDF (faits avec LaTeX) ont les accents détachés (« pr ´elev ´ee », « `a payer »), des montants « 15.99 e » et la date en lettres (« du 27 octobre 2026 »). `factTxtFix` répare le texte avant `parseBill` et `factPayAmt` (accent recollé à sa lettre, l'espace gardé pour « à » seul et devant un mot qui commence par un accent, `FACT_INIT` ; « N◦ » ; « 15.99 e » → « 15,99 € ») ; `factDate` lit aussi les dates en lettres (`FACT_MOISRE`) ; « Facture no … du » ; « sera prélevée sur votre carte bancaire le … ». Les 12 factures de Benoît : date, montant (9,99 / 15,99 €) et prélèvement justes (testé hors du dépôt). Test `t107` avec deux PDF fictifs au même format (`tests/donnees/facture_mobile_fictive.py`).
- **Provisions : « Total provisions » partout** (« confusion possible avec ce qu'on a mis de côté, le mois ou le total » ; « il faut que ça soit identique partout ») : grand montant d'À venir › Provisions (au lieu de « Total mis de côté »), Compte › Graphiques › Provisions (au lieu de « Provisions mises de côté », note « Total provisions, sur 6 mois »). Sur l'Accueil, les cartes gardent leur nom « Provisions » / « Compte · Provisions ». « De côté » reste pour le solde d'une enveloppe et l'onglet du graphique, « Mis de côté chaque mois » pour la mensualité. Tests `t92`, `t93`, `t106`.
- **Accueil : petite carte « Compte · Épargne » mal affichée** (« le graphique épargne est mal affiché ») : la courbe était prise pour un anneau (ses points sont des cercles) et réduite dans un coin. `enrichMiniCharts` reconnaît maintenant une courbe (`polyline`) : elle prend la largeur de la carte comme les barres, chiffres et mois lisibles, sans les points (qui seraient étirés en ovales), traits d'épaisseur constante. Test `t97` complété.
- **Passer en frais fixe : commun ou perso à choisir** (« MAAF RC en frais fixe n'apparaît pas dans Commun » puis « il faut pouvoir choisir ») : le frais avait été enregistré pour le titulaire du compte (frais perso, compté dans « Ta part » mais pas dans « Frais communs »). La fenêtre demande maintenant « Frais commun ou perso ? » (Commun (partagé) / Perso), sans rien de choisi d'avance ; « Pour qui » n'apparaît que pour Perso (le titulaire d'abord), « Payé » que pour Commun ; sans choix : « Choisis : frais commun ou perso. ». Test `t105` complété.
- **Passer un virement en frais fixe** (« passer un virement en frais fixe pour 1 ou plusieurs mois » ; proposition puis « tu peux intégrer ») : toucher un virement envoyé (pas un virement reçu, ni un virement vers l'épargne) → « 📅 Passer en frais fixe » ; fenêtre de « Nouveau frais fixe » déjà remplie (nom, montant, pour le titulaire du compte, ce compte, jour, à partir du mois du virement) et durée **Un mois** / **Plusieurs mois** / **Sans fin** ; le virement est remplacé (déjà fait → le frais est fait le même jour, le solde ne bouge pas) ; « Les mêmes virements des mois suivants (N) : Les retirer / Les garder » pour ceux des mois couverts (une série « chaque mois » s'arrête) ; venu d'un relevé, le frais garde sa clé d'import ; « Annuler » remet tout (`virToFrais`). Test `t105`. `PASSATION.md` mis à jour (avancement du 01/11, à faire valider, pièges).
- **Frais fixe : « Prélevé sur » plus clair** (« Automatique et compte courant c'est pareil, et pas clair ») : plus d'option « Automatique » ; la liste ne montre que les comptes, celui par défaut déjà choisi (compte principal pour un frais commun, compte de la personne pour un frais perso) ; il suit « Pour qui » tant qu'on n'y touche pas. Enregistré sur le compte par défaut, le frais ne force rien (il suit le compte habituel, comme avant « Automatique ») ; un autre compte est gardé (`acctDefKey`, `acctPicked`). Test `t104`.
- **Reprendre des virements du mois d'avant** (« reprendre des virements du mois dernier et choisir : mois suivant, un mois précis, une période ou récurrent » ; maquette puis « tu peux intégrer ») :
  - Compte › Opérations, « ＋ Ajouter › ↻ Reprendre des virements d'octobre » (le mois avant celui affiché) : on coche les virements (ceux déjà vus le mois d'avant sont cochés d'office, ceux déjà dans le mois visé sont signalés), puis **Mois suivant**, **Un mois**, **Une période** (de… à…) ou **Chaque mois** (à partir de…, avec ou sans fin) ; au même jour, à venir, à cocher « fait » ; un virement vers un livret le reste ;
  - toucher un virement ouvre maintenant un petit menu : Modifier, « ↻ Reprendre ce virement » (et « Pas encore passé » s'il est fait) ;
  - « Chaque mois » = une série (`virRec`) : l'appli crée le virement de chaque mois jusqu'à 12 mois à l'avance (« ↻ chaque mois » dans la liste) ; toucher l'un d'eux : modifier ce mois-ci seulement, modifier à partir de ce mois, retirer seulement ce mois (pas recréé, annulable), arrêter à partir de ce mois ;
  - import d'un relevé : un virement déjà dans l'appli et laissé de côté devient « fait », au jour du relevé (annulé avec l'import), comme les frais fixes.
  - Test `t103`.
- **Factures : ce qui restera dans la provision** (« eau prête pour mai, mais il restera combien ») : la carte du fournisseur dit « prête pour mai · il restera 28 € » (ou « il manquera X en mai »), son détail « prête · il restera 28 € après celle de mai ». Le calcul (`factProvAt`) suit maintenant la projection des provisions : les factures prévues d'ici là sont déjà retirées. Test `t102` complété.
- **Provisions : graphique « Avec les factures prévues »** (« un bouton pour afficher un graphique où les factures prévues sont prises en compte, recalcul du solde » ; maquette puis « tu peux intégrer ») :
  - dans la carte du haut de À venir › Provisions, deux onglets : **De côté** (ce qui est mis de côté, moins les prélèvements enregistrés) et **Avec les factures prévues** (solde de chaque mois recalculé après les factures à venir ; légende Après factures · Facture prévue · Il manquera ; chiffres Factures prévues · Le plus bas · À compléter ; un total négatif est dit « pas assez de côté pour tout payer ») ; choix gardé avec ★ ;
  - montant d'une facture prévue (`provPlanned`) : le montant prévu de la provision (✎) le mois de son échéance ; sinon le fournisseur qu'elle suit (facture reçue pas encore payée par elle, puis prochaines estimées, `provFactPlan`) ; sinon ce qu'elle a payé le même mois l'an dernier ; une échéance sans rien de tout ça est « montant non indiqué » (plus « tout le solde ») ;
  - liste « Factures prévues sur 12 mois » : ✓ couverte (· reste X) ou ⚠ il manquera X, d'où vient le montant, et « Passer à X € / mois » (à partir du mois suivant) ; les 12 mois d'À venir comptent aussi ces factures (mois en jaune) ;
  - corrigé : en regardant un mois futur, le graphique repartait de 0 au lieu des sommes déjà de côté (« Fin décembre : 166 € » au lieu de 693 €). Test `t102`.
- **Provisions reliées aux frais fixes, au Commun et aux comptes** (« il n'y a pas de lien entre une provision, les frais fixes et frais commun… ce n'est pas retiré des provisions quand j'ajoute la facture dans les comptes » ; maquette puis « va y ») :
  - la mise de côté de chaque mois est un **frais fixe « Provision · nom »** relié à la provision (étiquette « mise de côté », « vers Livret A » ou « reste sur Compte courant ») : il compte dans les parts du Commun et l'Analyse ; il sort du compte qui paie, sauf si l'argent de la provision reste sur ce compte ;
  - un ancien frais de même nom et même montant (« Eau 20 € », « Amazon 6 € ») est **relié au lieu de faire doublon**, et garde son passé ; s'il avait été retiré ce mois-ci par une facture, il revient ;
  - la provision décide : changer le montant ou le nom du frais, « Sauter ce mois » / « Rétablir » d'un côté ou de l'autre restent d'accord ; supprimer le frais propose « Sauter », « Ne plus la compter dans les frais fixes » ou « Supprimer la provision » ; la provision a un champ **« Remplie par »** (Commun, chacun sa part, une personne, pas dans les frais fixes) ;
  - **facture payée par une provision = un seul geste** : une feuille avec « dans le compte » (le prélèvement, comme sur le relevé), « retirée de la provision » (solde avant → après) et, si l'argent est sur un livret, « virement livret → compte » en option ; même feuille depuis le bandeau du fournisseur (« Pas dans tes comptes ni retirée de « Eau » · Ajouter », ou « Pas retirée de la provision · Retirer »), la fiche de la facture, « Lier », « + Prélèvement » ; sur la provision, « 1 facture pas encore retirée · Retirer » ;
  - cette facture sort du compte mais **ne compte pas une 2ᵉ fois** dans les parts du Commun ni dans l'Analyse (« hors parts ») : c'est la mise de côté qui y compte ; elle ne remplace plus la mise de côté du mois ;
  - import d'un relevé : un virement égal à plusieurs mises de côté d'un coup est reconnu (« Déjà en frais fixes (tes 2 provisions du mois) ») et elles sont marquées faites.
  - Test `t101` ; `t92`, `t93` et `t100` suivent (la mise de côté est un frais commun ; la même feuille partout).
- **Une facture payée par une provision** (« pouvoir mettre une facture dans les provisions, ex. l'eau de ce mois ») :
  - provision : « + Prélèvement (facture payée) » propose d'abord les factures importées récentes (moins de 120 jours, pas encore payées par une provision ; celles de son fournisseur ou de son type, « Eau », en premier), puis « Autre montant… » (l'ancien formulaire) ;
  - détail d'un fournisseur sans provision : « Lier » une provision qui existe (elle suit ce fournisseur), qui propose de payer sa dernière facture ;
  - fiche d'une facture : « ✓ Payée par la provision « Eau » » ou « Payer avec une provision » ; la liste marque « payée par « Eau » » ;
  - le prélèvement est mis le mois où la facture est payée (prélèvement, sinon date limite, sinon date), lié à la facture (`f.prId`, `provPayBill`), et la provision suit ce fournisseur (`p.fact`) pour les prochaines ; supprimer la facture retire le prélèvement. Test `t100`.
- **Compte : plus d'onglet Virements, bouton « ＋ Ajouter » dans les Opérations** (idée de Benoît, « va y ») : la page Virements faisait doublon (les virements sont dans les Opérations, jour par jour, et s'y modifient ; le graphique entrées-sorties est dans Graphiques). Sous-onglets : **Opérations · Épargne · Graphiques**. « ＋ Ajouter », à côté de la recherche, propose Virement reçu, Virement envoyé (le sens déjà choisi), Frais fixe, Ticket (sur ce compte) ; caché en consultation. Les liens des graphiques vers les virements ouvrent les Opérations filtrées (Reçu → Entrées, Envoyé → Sorties, À faire → À venir). Recherche : « Nom ou montant ». Tests t94 et t76 mis à jour.
- **Facture d'eau pas dans les comptes** (« pas prise en compte dans les comptes, ni dans les frais fixes ») : rien n'était cassé à l'enregistrement (« Appliquer » la met bien dans À venir et le compte, vérifié) ; elle a dû être gardée sans ses effets (« Garder seulement la facture »), et rien ne permettait de rattraper. Maintenant :
  - dans le détail du fournisseur, un bandeau « Pas dans tes comptes · Facture du … · Ajouter » pour une facture récente qui n'y est pas (prélèvement de ce mois ou plus tard, sinon facture de moins de 75 jours) ;
  - la fiche d'une facture dit « ✓ Dans tes comptes : À venir de novembre », ou propose « Ajouter à mes comptes » ;
  - la liste marque « dans tes comptes » ;
  - l'ajout (`factAddToAccounts`) crée son « à payer » ou prélèvement dans le mois, à la place du frais fixe qui l'estimait (ex. « Eau » 20 €) et de l'estimation de ce mois. Test `t99`.
- **Supprimer un fournisseur (groupe de factures)** : appui long sur sa carte (À venir › Factures) → Ouvrir / Supprimer « EDF » (8 factures), ou bouton en bas de son détail ; confirmation avec le nombre de factures, puis « Annuler » pendant quelques secondes (`factSeriesDelete`). Partent avec lui : ses factures, leurs prélèvements à venir, l'estimation de la prochaine ; sa provision est gardée (l'argent mis de côté reste), seulement détachée. Le nombre de factures est sur chaque carte. Test t98 complété.
- **Factures d'un fournisseur : modifier, supprimer, nombre de factures** (demande de Benoît, capture à l'appui) :
  - carte du fournisseur (À venir › Factures) : « 3 factures » ;
  - dans son détail, toucher une facture ouvre sa fiche (fournisseur, montant, date, paiement, prélevée le / à payer avant, m³ ou kWh, période ; Supprimer / Enregistrer, `factEditSheet`) ; appui long → Modifier / Supprimer (`onLongPress`, comme les tickets) ; suppression annulable (`factDeleteUndo`, avec son « à payer » ou prélèvement à venir et son paiement par la provision) ;
  - le montant changé suit dans le prélèvement à venir et la provision ; renommer le fournisseur demande « Toutes ses factures » (la série, sa provision et ses prélèvements suivent, et les prochaines factures lues prennent ce nom) ou « Seulement celle-ci » ;
  - montants affichés avec deux décimales dans les fiches (121,90 et non 121,9) ;
  - appui long plutôt que glisser à gauche : c'est déjà le geste des tickets. Test `t98`.
- **Commun : Frais communs et Produits partagés se replient pareil** (« l'un se replie, l'autre ouvre un menu ; Frais communs n'a plus accès à son menu ») : toucher le titre de l'une ou l'autre la replie ou la déplie (choix gardé : `comFcOpen`, ouvert d'abord ; `comPpOpen`, fermé d'abord) ; dépliée, Frais communs montre ses frais et le lien « Modifier dans À venir › Frais fixes », Produits partagés montre ses articles et ta part (ce qu'affichait sa page). Test t92 complété.
- **Accueil : la page des petits graphiques est gardée** (« garder en mémoire la dernière page, ex 3/8 ») : elle l'était déjà en principe, mais un défilement dû à la mise en page (appli dessinée avant d'avoir sa taille, largeur qui change) la remettait à 1 et l'enregistrait. Maintenant la page n'est enregistrée que sur un geste (glisser, flèches, puces), tout de suite, et la page voulue est remise quand la largeur arrive ou change (`wirePagers`). Test `t97`.
- **Tests indépendants de la date** : on est passé en novembre et 6 tests (données en octobre) échouaient ; `tests/horloge.py` fixe la date du navigateur au 30/10/2026 (t76 au 27/10 : ses deux vérifications « Hier » et « le 28 » passent enfin ; foyer à l'heure réelle). Tous les tests passent.
- **Commun : le graphique reprend sa taille** quand on replie les frais communs (« le graphique ne reprend pas sa taille ») : replier ou déplier redessine la page, la carte du haut est recalculée (`fitHero`). Test t92 : la carte grandit en repliant, se resserre en dépliant.
- **Commun › Frais communs se replie** (« ne se replie pas ») : toucher le titre replie ou déplie la liste (flèche qui tourne, choix gardé sur le téléphone, `comFcOpen`) ; toucher un frais ouvre toujours À venir › Frais fixes. Test t92 complété.

### 31/10
- **Écran de contrôle de plusieurs factures** (photos ou PDF ; d'après la maquette, « tu peux intégrer ») :
  - en haut « 6 photos · 6 lues · 3 factures trouvées » ; une photo illisible en jaune (« Photo 4 illisible », « Reprendre » relit la photo et regroupe tout à nouveau, « Ignorer ») ; « 3 PDF · 2 lus » pour les PDF (pas de « Reprendre ») ;
  - la liste : les plus anciennes (date, photos, m³, montant, case à cocher, « À VÉRIFIER » si lue sur moins de pages que les autres ou sans date ni montant), puis « LA PLUS RÉCENTE », vérifiée dessous comme avant ;
  - toucher une ancienne : sa fiche (fournisseur, montant, date, m³, paiement, période, Copier la lecture, Précédente / Suivante, « Ne pas la garder » / OK) ;
  - **rien n'est enregistré avant « Appliquer · 3 factures »** (avant, les anciennes allaient tout de suite dans l'historique) ; « Garder seulement les factures » les garde aussi ; l'estimation de la prochaine facture et la comparaison avec l'an dernier comptent déjà les anciennes ;
  - fournisseur nouveau : le nom le mieux écrit parmi les factures lues (« Région Minière » plutôt que « Région Miniere ») ;
  - essayé sur la vraie lecture de Benoît (3 factures trouvées, bons montants, dates, m³ et périodes) ; `tests/t96.py` refait avec des données inventées (photos, désordre, photo illisible, 3 PDF dont un sans texte) ;
  - `PASSATION.md` mis à jour.
- **Factures d'eau en photos** (lecture envoyée par Benoît : 3 factures, recto et verso, 6 photos d'un coup ; « rien n'est bon ») :
  - plusieurs factures photographiées d'un coup sont séparées (`factSplitPages` : une page rejoint la facture qui a sa date, sinon son montant à payer ; une autre date = une autre facture ; une page sans rien suit la précédente) ; comme pour plusieurs PDF, les plus anciennes vont dans l'historique (`factToHistory`) et la plus récente est à vérifier ; marche aussi avec les photos dans le désordre ;
  - dates mal lues corrigées (`factDateFix` : « O04/03 », « 02/11I2026 », « 02/1 1/2026 », « 0408/2026 », « 202s ») ;
  - fournisseur : nom en tête sur deux lignes séparées (« RÉGION » … « MINIÈRE ») et créancier du TIP mal lu (« SVOM … MINIERE- TIP ») ;
  - type : « notre site Internet » ne fait plus une facture internet ; l'eau est reconnue sans « m3 » (« consommation d'eau », « eau potable ») ;
  - consommation : plus le « 3 » de « (m3) » ; « deau » accepté ; période : plus la date de la facture elle-même ;
  - test `tests/t96.py` avec 3 fausses factures d'eau qui reproduisent ces erreurs.
- **`PASSATION.md`** à la racine : le dossier de passation (projet, liens, architecture, avancement, tests à faire, pistes, méthode), pour reprendre le projet dans un autre abonnement Claude. C'est une photo au 31/10 : `CLAUDE.md` et `JOURNAL.md` font foi.
- **Tests dans le dépôt** (`tests/`, « ok » de Benoît) : les 15 tests Playwright à jour (import, Compte, liquide, Bourse, tickets, hors ligne, À venir, foyer, Dépenses), le relais local, `run.sh` et un mode d'emploi. Chemins rendus relatifs ; données toutes fictives (relevés inventés, factures EDF inventées) ; les tests qui lisaient de vrais relevés, factures ou tickets sont restés hors du dépôt. 
- **Réorganisation, étapes 3 et 4 : Dépenses et finitions** :
  - Articles et Analyse réunis dans l'onglet **Dépenses** : Tickets · Produits · Budgets · Analyse (`depSubs`, `depView`, `depTabsHTML`, vue `tickets`) ; la puce 🧾 Tickets de l'Accueil y mène ; la galerie est la ligne « Photos des tickets » de Tickets (plus dans le menu) ;
  - barre du bas : Accueil · Dépenses · Compte · À venir · Commun · Bourse ;
  - Analyse avancée : la vue d'ensemble seule depuis Dépenses › Analyse ; Projection et Simuler passent dans À venir › 12 mois (« Tes comptes dans 12 mois », retour vers À venir) ;
  - sans Plus (Store) : la présentation de la fonction et un seul bouton ✦, au lieu de l'écran flouté ;
  - foyer : droits « Dépenses : produits » et « Dépenses : analyse » ; Dépenses toujours visible (Tickets suit l'Accueil) ;
  - Produits partagés reste dans Commun (c'est « qui paie quoi », pas une dépense) ;
  - Produits n'a que « Produits & catégories », Budgets que « Fixer des budgets » ; Budgets marche aussi quand aucun article n'est rangé (les budgets suivent les catégories des tickets).
- **Réorganisation, étape 2 : Compte** (d'après la maquette) :
  - sous-onglets Opérations · Virements · Épargne · Graphiques (`state.cptPage` : null, `es`, `ep`, `graph` ; la vue `comptedet` revient à `compte`) ; plus de bouton retour ni de page « Configuration » ;
  - roue du compte (`cptWheel`, `#cptGear`) : modifier, solde reporté, importer un relevé, annuler le dernier import, compte principal, supprimer (`acctMenuItems`) ; cachée en consultation sans import ;
  - les pages Dépenses et Solde bancaire disparaissent : un lien vers Dépenses ouvre les Opérations filtrées sur les sorties, un lien vers le Solde ouvre les Opérations (`goSub`) ; le détail du liquide reste au bouton « Liquide » et dans Graphiques › Solde ;
  - Épargne garde la ligne Provisions (→ À venir › Provisions) ;
  - le menu n'a plus « Importer un relevé » : l'import se fait depuis la roue du compte visé ;
  - essais : sous-onglets, roue, graphiques touchables, import et annulation par la roue (relevés, foyer), liquide, épargne, cartes de l'Accueil.
- **Étape 2 (Compte)** : maquette ajoutée au canevas « Tickets — Plan de l'appli ».
- **Réorganisation, étape 1 : onglet À venir** (d'après la maquette) :
  - l'onglet Factures devient « À venir », ouvert à tous, avec 4 sous-onglets (`state.avnSub` : `mois`, `frais`, `prov`, `fact` ; `avTabsHTML`, `wireAvTabs`) ;
  - Frais fixes = l'ancienne page Frais fixes de Commun (`renderCommunes` en mode À venir) ; Provisions = l'ancienne page Provisions (`renderProvisions`, la vue `provisions` y mène) ;
  - Commun : plus de « + Frais fixe » ; une section « Frais communs » à voir, qui ouvre À venir › Frais fixes ; une barre du graphique y mène aussi ;
  - Compte › Configuration › Provisions et le graphique Provisions ouvrent À venir › Provisions ;
  - version Store sans Plus : 12 mois, Frais fixes et Provisions gratuits ; Factures montre ce que Plus apporte, seul le bouton demande Plus (`factPlusAsk`) ; plus d'écran bloquant ;
  - foyer : l'onglet À venir apparaît si le membre a À venir ou Commun ; ses Frais fixes suivent les droits de Commun (`fyCurTab`), le reste ceux d'À venir (`avSubs`, `avTabOn`). Rien n'est ouvert en plus à un membre ;
  - essais : onglets, 4 sous-onglets, liens depuis Commun et Compte, Store sans Plus, deux membres aux droits différents.
  - corrigé dans la foulée : le sous-onglet d'À venir partageait sa mémoire avec celui de l'Analyse avancée (qui s'ouvrait alors sur « Simuler ») ; il a maintenant la sienne (`state.avnSub`).
- **Étape 1 (À venir)** : maquette ajoutée au canevas « Tickets — Plan de l'appli ».
- **Plan de l'appli** : maquette « Tickets — Plan de l'appli » (aujourd'hui / proposé / ce qui bouge / étapes, écrans Compte et À venir). Rien de changé dans l'appli.
- **Estimation des factures selon la saison** (Benoît : l'estimation EDF de décembre, ≈ 75 €, baissait alors que l'hiver arrive) : l'ancien calcul prenait l'an dernier à la même période (854 kWh) et lui appliquait la baisse vue sur la dernière facture (−65 % en septembre-octobre, avec du soleil pour les panneaux) ; or l'an dernier la consommation avait baissé de l'automne à l'hiver (changement chez Benoît). Maintenant (`factEstInfo`) :
  - avec au moins 4 factures sur 8 mois ou plus dans les 12 derniers mois, le **profil du foyer** est appris (`factProfil`) : consommation par jour ≈ niveau × (1 + A·cos), au plus haut mi-janvier, les factures récentes comptant plus ; A est appris (fort avec des panneaux solaires, négatif avec une clim) ;
  - sinon : la dernière facture par jour, corrigée d'une saison type (`FACT_SAISON` : électricité 0,35, gaz 0,6, eau 0), mêlée à l'an dernier corrigé seulement si la consommation a peu changé ;
  - puis le prix (part fixe + prix du kWh) tiré des factures, comme avant ;
  - texte sous l'estimation : « D'après tes factures des 12 derniers mois, selon la saison. » ;
  - la prochaine facture estimée déjà dans « À venir » suit le nouveau calcul à l'ouverture (`factEstRefresh`, pas chez un membre du foyer, pas si elle est cochée « fait »).
  Sur les factures EDF de Benoît : ≈ 108 € fin décembre (l'hiver dernier : 104,86 € pour décembre-mars), puis ≈ 121 € en février, 93 € en avril, 58 € en juin, 46 € en août. Eau : inchangée (≈ 154 à 158 €). Essais sur des foyers fictifs (chauffage électrique, sans saison, clim, gaz) : à quelques euros près.
- **Sans réseau** (Benoît n'avait pas pu ouvrir l'appli sans réseau ; l'appli Android chargeait la β en ligne et s'arrêtait sur « Pas de connexion ») :
  - **Store** : la β est copiée dans l'APK à la compilation, avec pdf.js (`./pdfjs/`) et l'inflation INSEE du moment (`insee.json`, prise au relais par la compilation) ; plus de `server.url`. Dans la page, `appLocal()` : ni vérification de version, ni service worker, ni Tesseract. Essai (appli servie sur `https://localhost`) : onglets, Analyse avancée, facture PDF, scan : aucune requête hors de l'APK ;
  - **Perso** : `TkOfflineClient` (natif) sert la page depuis le réseau avec un délai court, en garde une copie, et la sert sans réseau ou si le chargement échoue (même adresse, mêmes données). Le nouvel APK s'annonce `TkOff/1` : la page retire alors le service worker et ses copies, devenus inutiles ;
  - Tesseract n'est plus chargé au démarrage (seulement au premier scan dans un navigateur) ; la lecture en ligne OCR.space (sans bouton depuis longtemps) est retirée, comme l'ancien bouton « préparer hors ligne » ;
  - navigateur : chaque vérification de version (`index.html?v=…`) restait dans la copie du service worker (près de 1 Mo à chaque retour dans l'appli) ; `swTidy` les retire ;
  - le workflow des APK se lance aussi quand la β change.
- **Onglet Factures** (intégré à la demande de Benoît, d'après la maquette « Tickets — Importer une facture ») :
  - nouvel onglet entre Compte et Bourse ; `PLUS_FEATURES` + "factures" (écran Tickets Plus dans la version Store, provisions gratuites dans Compte › Configuration) ;
  - données : `factures` (une facture : fournisseur, type, date, montant, prélèvement ou « à payer », période, consommation, prochaine facture, régularisation) et `factAlias` (nom de fournisseur corrigé à la main, réutilisé) ; frais fixes créés par une facture : `fact` (clé de la série), `factNom`, `est` (estimée), `aPayer` ; provision liée : `fact` ;
  - lecture (`parseBill`) : grands fournisseurs, sinon créancier du TIP ou nom en tête ; « Le montant de … sera prélevé le … », « Montant total à payer », « Facture du / réelle du », « Prochaine facture vers le », « Consommation du … au … », « Total Consommation … kWh », « … m3 » ; essai sur les 8 factures EDF (PDF) et 3 factures d'eau (photos) de Benoît : tout est retrouvé ;
  - estimation de la prochaine facture (`factEstimate`) : avec au moins 3 factures et leur consommation, part fixe + prix × consommation attendue (celle de l'an dernier à la même période, corrigée de l'évolution) ; sinon même période l'an dernier ; sinon moyenne des dernières. Sur les factures EDF : ≈ 75 € pour fin décembre (147,89 € l'an dernier, consommation −65 %) ; eau : ≈ 162 € en mai ;
  - PDF : pdf.js 6.2.108 (version « legacy ») chargé depuis jsDelivr à la première facture ; un PDF sans texte (scan) → proposer les photos ;
  - ML Kit : une page tournée d'un quart de tour ou à l'envers est remise droite (`mlkitRows` n'ignore plus les grands angles) ; si la lecture est trop courte, la photo est relue tournée ;
  - foyer : onglet Factures dans les droits ; `factures` synchronisées (seulement si l'onglet est visible) ; provisions et factures se modifient avec l'onglet Factures ; les membres qui avaient Compte reçoivent Factures avec les mêmes droits (une fois, `fyCfg.factMig`) ;
  - même facture importée deux fois : signalée, pas ajoutée.
- **Mes factures** : maquette de la page qui réunit factures, provisions et prévisionnel (écran 1 du canevas « Tickets — Importer une facture »). Rien de changé dans l'appli.
- **Import de factures** : étudié sur les factures de Benoît (EDF en PDF, eau en photos) et maquette « Tickets — Importer une facture » (chiffres d'exemple) ; ajouté aux améliorations prévues. Rien de changé dans l'appli.

### 28/10
- **Lecture par une IA** : étudiée puis mise de côté ; l'idée « Lire avec mon IA » (l'IA déjà sur le téléphone, via le partage) est ajoutée aux améliorations prévues (voir En cours). Rien de changé dans l'appli.
- **Lecture des tickets, d'après la vraie lecture du ticket Intermarché** (collée par Benoît avec « Copier la lecture ») : les lignes étaient bien regroupées ; les 4 articles perdus venaient de prix mal lus.
  - « 142 EUR » (virgule perdue) = 1,42 ; « A84 EUR » (4 lu A) = 4,84 : seulement sur une ligne d'article sans autre montant ;
  - article pesé dont le prix est illisible (« 0,5 EUR A ») : prix calculé, poids × prix au kilo (0,170 × 2,99 = 0,51) ; aussi quand seul le prix au kilo a été lu ;
  - article dont le prix n'a pas été lu du tout (« *AIGUILLETTE POULET EUR A ») : gardé avec le prix vide, encadré en orange ; le bandeau dit « 1 sans prix » ;
  - à l'enregistrement, s'il manque de l'argent et qu'un seul article n'a pas de prix : « Mettre 7,59 € sur « AIGUILLETTE POULET » » (en plus de « Divers ») ;
  - noms : « 4ETREZ » (« * » lu 4), « ELUR » / « EUAR » (EUR mal lu), « IGP 0C » → « IGP OC ».
  - Résultat sur ce ticket : 33 lignes, 90,69 € lus ; il ne manque que l'aiguillette (7,59 €), proposée à l'enregistrement.
- **« Copier la lecture »** (demande de Benoît) : sous un ticket scanné, à côté de « Lu sur le téléphone… » (et aussi après une « Lecture vide »), un lien ouvre « Lecture du ticket » : les lignes lues, puis chaque morceau rendu par ML Kit avec ses 4 coins, et la taille de la photo. Boutons Copier / Partager… / Fermer ; l'appli n'envoie rien elle-même. Gardé seulement pendant la saisie du ticket scanné (`state.ocrRaw`, `ocrRawText`, `ocrRawSheet`) : pour un ticket déjà enregistré, il faut le rescanner. Benoît colle ce texte à Claude avec la photo ; les morceaux suffisent à refaire exactement le regroupement des lignes (`mlkitRows`) et la lecture. Au passage, ouvrir un ancien ticket n'affiche plus la note du dernier scan.
- **Lecture des tickets, 4 tickets envoyés par Benoît** (retrait, TotalEnergies, Grand Frais, Intermarché ; recopiés comme tests dans l'espace de travail de Claude, jamais dans le dépôt) :
  - retrait au distributeur : « RETRAIT : 50 EUR » sans centimes était une lecture vide ; un montant rond suivi de EUR / € est lu sur une ligne retrait / montant / total ;
  - TotalEnergies : « 7.19.15-sp5-hf1 » (numéro de version) et « 24,33 lit » (volume) n'étaient pas des articles ; « SP95E5 » est reconnu (le seul article = le total) ;
  - Grand Frais : la ligne du tableau de TVA (« A 5,5% 42,15 € 2,32 € 44,47 € ») doublait le total ; « A IX * » (le « 1x » mal lu) est retiré du nom ;
  - Intermarché : « CARTES MAXI TRAD » était pris pour un paiement par carte (« carte » en mot entier seulement) ; les remises « -0,73 » sont lues en moins (produit « Remise ») ; « EURA » retiré du nom ;
  - enseigne : si le haut du ticket ne donne pas d'enseigne connue (« GIE LE SAINT JACQUES », « SAS SURISAL »), une grande enseigne écrite plus bas est prise (« VOTRE MAGASIN GRAND FRAIS », « Votre INTERMARCHE est ouvert ») ;
  - catégorie (`ticketCat`) : celle de tes tickets dans ce magasin, sinon d'après l'enseigne, sinon le texte. « total » seul n'est plus un mot du Carburant (tout ticket a un TOTAL : Grand Frais tombait en Carburant), ni « station » ;
  - produit rempli tout seul : mot entier seulement (« eur », appris sur un ticket de parking, mettait « Parking » sur « PATE SABLEE AU BEURRE ») ;
  - aussi : « 48 ,42 » (espace lue) et « 1.234,56 » sont des montants ; prix des articles toujours avec 2 décimales ; si le total est illisible, le montant payé par carte sert de total et la lecture s'arrête là.
- **Lecture des tickets, correction** : depuis ce matin, « NET 0,980 kg » (poids net d'un article pesé) était pris pour « Net à payer » : la lecture s'arrêtait au premier article (ticket Grand Frais de 15 articles). « Net » n'est un total que hors ligne de pesée. Les articles pesés sont lus : le nom sur la ligne du dessus, le prix sur la ligne de pesée (« NET 0,980 kg x 1,99 €/kg 1,95 € »). Les noms perdent le code TVA et la quantité du début (« A 1x *… »). Le ticket donne ses 15 articles, somme = total.
- **Appui long sur un ticket** (Sylvette cherchait à supprimer un ticket ainsi) : partout où des tickets sont listés (page Tickets, liste du Compte, Analyse, Articles), un appui long ouvre « ✎ Ouvrir le ticket » / « 🗑 Supprimer » (`wireTicketLongPress`, `ticketMenu`), avec une petite vibration ; le simple toucher ouvre toujours le ticket. Supprimer se fait tout de suite avec « Ticket supprimé · Annuler » pendant 6 s (`delEntryUndo`, `uiUndoToast`) ; la photo n'est effacée qu'à la fin du délai. Pas de « Supprimer » en consultation seulement.
- **Produit des articles, propre à chaque personne** (demande de Benoît : Sylvette enregistrait sans produit) :
  - champ « Produit » vide d'un article : encadré en orange ; le bandeau dit « N sans produit à ranger » ; on peut toujours enregistrer ;
  - le produit se remplit avec le dernier que **la personne du ticket** (« Payé par ») a donné à cet article (`apprisOf(personne)` tiré de ses tickets, `lookupAppris(libellé, personne)`) : au scan, quand on tape un article, et quand on change « Payé par » (les produits vides ou remplis tout seuls changent, ceux tapés à la main restent) ;
  - cloisonné : ce que Benoît a rangé ne remplit plus les tickets de Sylvette, et inversement. La liste des produits reste commune.
- **Lecture des tickets, suite** : sur le téléphone de Sylvette la lecture coupe les mots (« Vo lume e 21,45 »). Chaque ligne est aussi testée sans ses espaces : « Volume » en début de ligne est une quantité (jamais un article), « TOT TIC » / « N et » sont des totaux. Une ligne de volume ou une station connue (TotalEnergies, Total Access, Esso…) suffit pour faire du ticket un plein : un seul article (le carburant lu, sinon « CARBURANT ») au montant total. Un produit nommé « … VOLUME » (mascara) reste un article.
- **Ticket : vérifier les articles** (maquette « Tickets — Vérifier un ticket scanné ») : on voyait le montant en haut du scan sans vérifier les articles en bas.
  - bandeau sous le montant (`artChkPaint`) : orange « 3 articles · 110,72 € ≠ 48,69 € · écart 62,03 € · Vérifier ↓ » (descend aux articles), vert « ✓ 4 articles = total » ; mis à jour pendant la saisie ; rappel « 110,72 € sur 48,69 € » au titre des articles, cartes d'articles en orange tant que ça ne colle pas ; remises déduites, 5 centimes d'arrondi tolérés (`CHK_TOL`) ;
  - « Enregistrer » avec un écart (`saveDraft`) : Articles / Ticket / Il manque (ou En trop), puis « Vérifier les articles », « Ajouter X en « Divers » » (ou « Mettre le montant à X ») et « Enregistrer quand même » ; sans écart ou sans article, pas de question ;
  - photo du ticket en vignette à côté du montant ; la toucher l'affiche en grand avec Changer / Supprimer.
- **Lecture des tickets (`parseTicket`)**, retour sur un ticket de carburant de Sylvette (date en octobre 2025, articles « Volume », « TOT TIC », « Net ») :
  - « TOT TTC » (lu « TOT TIC »), « Net » en début de ligne, volume, prix au litre (€/L, prix unitaire) ne sont plus des articles ; « TOT » et « Net » comptent comme le total ;
  - ticket de carburant sans article : un seul article, le carburant (GAZOLE, SP95-E10…), pour le total ;
  - date : la plus récente du ticket ; si elle tombe à plus de 45 jours mais que le même jour de cette année est récent, l'année a été mal lue (« 25 » pour « 26 ») et elle est corrigée, avec « année de la date corrigée » dans le message ;
  - un mot court comme « Net » ne trouve plus un produit qui le contient (« Pain ») (`lookupAppris`).
- **Bourse dans l'épargne** : avant, seule une épargne liée à la main (🔗) comptait la Bourse, et la dissocier la faisait disparaître des totaux en laissant une valeur figée. Maintenant :
  - une seule épargne `bourseLink` = la ligne « Bourse » automatique, créée dès qu'il y a un compte Bourse, avec l'historique du portefeuille mois par mois (`ensureBourseEp`, au démarrage et à chaque mise à jour des cours) ; une épargne déjà liée garde ce rôle et son nom ;
  - s'il y en avait plusieurs, les autres reprennent leur valeur d'avant la liaison ;
  - plus de bouton 🔗 ni de choix « Suit la Bourse » pour un nouveau compte épargne ; la ligne est marquée « automatique · suit l'onglet Bourse », la toucher ouvre l'onglet Bourse ;
  - « dont Bourse X » sous l'épargne de l'Accueil et dans la page Épargne, avec la Bourse en pointillés sur le graphique (`compteLineSVG` : 2e courbe `v2`) ;
  - foyer : un membre sans l'onglet Bourse ne reçoit pas cette ligne (`fyFilter`) ;
  - version Store : rien ne change.

### 27/10
- **Compte, bouton « 💶 Liquide »** dans la carte du haut (à côté de « Estimé, sans le liquide ») : montre le liquide (« · non compté » s'il n'est pas compté) ; le toucher permet de changer le montant (`liqEdit`) ou de le compter / ne plus le compter dans les soldes (`cptLiq`). Sans liquide : « ＋ Liquide » ouvre la saisie. « Fin de mois » compte le liquide quand il est compté, comme l'Accueil.
- **Compte, décocher** : une opération déjà passée (frais fixe, virement) ne pouvait plus être remise « à venir » (le rond n'existe que dans « À venir »). La toucher propose maintenant « ↩ Pas encore passé à la banque » ou « ✎ Modifier » (`opsOpen`). Le jour mis en cochant un virement (`dayAuto`) est oublié quand on décoche.
- **Compte : liste des opérations du mois** (`cptOps`, `opsBodyHTML`, `opsOpen` ; la page principale de l'onglet, les graphiques passent sur `cptPage="graph"`) :
  - en haut : solde estimé, Entrées et Sorties passées, Fin de mois prévue (toucher filtre la liste), boutons Graphiques et Configuration ;
  - filtres Tout · Entrées · Sorties · À venir (`state.cptF`) et recherche par nom ou montant avec le total trouvé (`state.cptQ`, la liste se refait sans perdre le clavier) ;
  - « À venir ce mois-ci » (« Pas encore passé à la banque » pour un mois passé, « Prévu en … » pour un mois à venir) : frais fixes et virements pas faits, un rond pour les marquer faits ;
  - les opérations par jour, la plus récente en haut, avec le solde du soir ; ligne touchée = sa fiche (ticket, frais fixe, virement) ; report du mois précédent en bas, touchable ;
  - un membre en lecture voit la liste sans rond ni fiche modifiable ;
  - les cartes « Compte » de l'Accueil viennent de la page Graphiques, et la toucher ouvre ce graphique.
- **Jour des frais fixes et des virements** (ils n'avaient que le mois) :
  - virement : `day` ; frais fixe : `doneDays` (jour où il est passé, par mois) et `jour` (jour habituel, champ « Jour du prélèvement » dans la fiche) ;
  - noté tout seul quand on coche « fait » ce mois-ci, et par l'import (y compris pour les frais et virements déjà là repérés comme doublons ; retiré si on annule l'import) ; les anciens imports gardent la date de leur note « 05/10 · relevé » ;
  - sans jour : rangé au 1er du mois.

### 25/10
- **Bouton « Liquide » de l'onglet Compte** (`liqCounted()`, clé `cptLiq`) : décoché, le liquide n'était retiré que du graphique de l'onglet Compte. L'Accueil le comptait toujours (−16,59 au lieu de −52,55), la page Solde bancaire affichait « Argent liquide 0,00 € » et son graphique l'ajoutait quand même. Maintenant :
  - décoché, il n'est compté nulle part : Accueil (sans colonne Liquide, « · sans le liquide »), page Solde bancaire, comptes du foyer, widgets, Bilan PDF ;
  - le liquide saisi reste affiché dans le détail (35,96 €, « non compté ») ;
  - le bouton est aussi sur la page Solde bancaire.
- **Import, provisions et écart expliqué** (les −26 € de Benoît étaient le virement de ses provisions, jamais noté dans ses virements) :
  - un virement envoyé du montant des provisions du mois (celles qui ne sont pas sur ce compte, sans les mois sautés ; d'abord celles du titulaire, puis tout le foyer) s'appelle « Provisions du mois » avec « = tes N provisions d'octobre (X €) » ; une seule provision du même montant → « Provision · nom ». L'épargne programmée n'est jamais prise pour une provision ;
  - quand le solde ne tombe pas comme la banque, le résultat dit « L'écart de X € correspond peut-être à : » la ligne décochée, ou le ticket, le frais fixe payé ou le virement de l'appli absent du relevé qui a exactement ce montant ; sinon l'explication générale d'avant.
- **Import, doublons mieux repérés** (retour de Benoît sur son vrai compte) :
  - chaque dépense est comparée aux frais fixes du compte (même montant ce mois-là), aux virements du compte et aux tickets (même montant à 3 jours près) ;
  - même nom = « Déjà … » ; autre nom = « Peut-être déjà … (X, même montant) » : Active Assurances 115,55 ↔ Mutuelle, Bouygues 4,99 ↔ CDiscount mobile, paiement AlloVoisins ↔ frais fixe AlloVoisins, Anthropic ↔ virements ;
  - un frais fixe retrouvé et laissé de côté est marqué payé pour ce mois (annulé avec l'import) ;
  - pastille de type sur chaque dépense (Ticket / Frais fixe / Virement) pour changer son rangement.
- **Menu raccourci** (`openMenu`, `openSettings`) : 7 lignes en 3 blocs, l'état à droite (« 2 personnes », « hier », « OFX · QIF · CSV »), plus de titres de rubrique. Il tient sans défiler, même sur un écran de 360×640. Devise, code et empreinte, et Restaurer passent dans « Réglages » ; Restaurer n'est plus à côté de Sauvegarder.
- Âge de la sauvegarde compté en jours de calendrier (`backupAge`) : une sauvegarde de la veille au soir affichait « aujourd'hui ».
- **Import d'un relevé** (`impParse`, `impBuild`, `renderImport`, `impApply`, `impUndo`, `state.view="import"`) :
  - Lecture sur le téléphone :
    - OFX 2 (XML) et OFX 1 (SGML), plusieurs comptes, LEDGERBAL ou AVAILBAL ;
    - QIF de Money ou Quicken : comptes `!Account`, solde d'ouverture, virements `[Compte]`, dates jj/mm ou mm/jj'aa, montants « 1 234,56 » ou « 1,086.00 » ;
    - CSV : séparateur et ligne d'en-tête devinés, débit / crédit, colonnes « Changer » à la main, piège « Solde » de BoursoBank ;
    - encodage UTF-8 ou Windows-1252.
  - Rangement :
    - carte → tickets sans articles, à la date d'achat ;
    - prélèvements → frais fixes regroupés : « chaque mois » s'ils reviennent presque tous les mois (montant qui change, mois sautés, arrêté), sinon « une fois » ; impôts « une fois » ;
    - virements reçus, envoyés et retraits → virements faits, avec un lien possible vers l'épargne ;
    - noms nettoyés : prénoms des personnes reconnus, enseignes déjà connues dans les tickets ;
    - catégories : d'abord celles des tickets, puis l'enseigne, puis la banque.
  - Doublons :
    - déjà importé dans ce compte ;
    - ticket déjà saisi (sur un autre compte, on peut le déplacer ici) ;
    - virement ou frais fixe déjà présent.
  - Solde de départ calculé pour que le compte affiche le solde de la banque. Le résultat le vérifie et explique un éventuel écart.
  - Anciens tests (t52 à t68) : mêmes résultats avant et après ces changements du 24 et 25/10. Plusieurs sont périmés depuis les refontes des 21–23/10 (pastilles de personnes, droits du foyer par onglet, épargne dans Configuration) et sont à réécrire.
  - Tests : 3 exports BoursoBank (même résultat), Crédit Mutuel OFX SGML, Money multi-comptes, Quicken US, Crédit Agricole CSV, CSV sans en-tête, fichier de 3 ans (1 244 opérations en 0,2 s), foyer (un membre en modification importe, le propriétaire reçoit ; un membre en lecture n'a pas l'import).
- Compte : les comptes d'une page (une personne, Comptes partagés, Foyer) se suivent sur une rangée qui défile au lieu de s'empiler. La carte garde la même hauteur quel que soit leur nombre, le graphique en dessous n'est plus écrasé. Le compte choisi reste visible, fondu sur le bord quand la rangée continue ; avec 1 ou 2 comptes ils prennent toute la largeur (`acctPagerHTML`, `.ap-strip`).

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
