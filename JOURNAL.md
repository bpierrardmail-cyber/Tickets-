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

## État actuel (31/10/2026)

**Versions**
- β web : `beta/index.html`, étiquette `31/10 15:26`, environ 9 700 lignes.
- APK de test « Tickets Perso » (avec la Bourse) et « Tickets Store » (sans la Bourse), release `apk-beta`, recompilés quand la β ou l'appli Android change.
  - **Perso** : charge la β en ligne (chaque correction arrive tout de suite) et en garde une copie : sans réseau, elle ouvre la dernière version, avec les mêmes données.
  - **Store** : appli complète, la β est dans l'APK (avec le lecteur PDF et l'inflation INSEE du moment) ; aucune connexion pour l'usage normal, mises à jour par le Store.

**Onglets**
- **Accueil** : graphiques choisis par l'utilisateur (⚙ Choisir, appui long pour changer, déplacer ou masquer), grande carte du haut au choix. Pastilles ✍️ Saisie et 🧾 Tickets. Filtre par personne en haut à droite. Rien sous les graphiques.
- **Articles** : produits et prix (Mes produits, Hausses, Magasins, Familles, Budgets). Fiche produit avec tous les achats. Bouton « Produits partagés ».
- **Commun** : parts du commun en % et parts propres à chaque frais. Frais fixes « en entier » ou « chacun sa part », frais retirés pour un mois. Graphique Mois (6, 12, 12 à venir, Tout). Bandeau des personnes.
- **Compte** :
  - s'ouvre sur la **liste des opérations du mois**, comme un relevé de banque : solde estimé, Entrées / Sorties / Fin de mois, filtres Tout · Entrées · Sorties · À venir, recherche (nom ou montant, avec le total), bloc « À venir » avec un rond pour marquer « fait », puis les opérations par jour (le plus récent en haut) avec le solde du soir, et le report en bas ;
  - les graphiques d'avant sont sur la page « Graphiques » (bouton), en plein écran ;
  - plusieurs comptes par personne, sur une rangée qui défile (la carte des comptes garde la même hauteur) ;
  - page Configuration par compte (provisions, toujours gratuites ; épargne ; **Importer un relevé** ; « Annuler le dernier import ») ;
  - bouton « Liquide » ;
  - rien avant le début du suivi ;
  - mois à venir = solde prévu.
- **Factures** (Tickets Plus dans la version Store) :
  - les 12 prochains mois : frais fixes, factures reçues ou estimées, échéances des provisions ; un mois en jaune s'il manquera de l'argent dans une provision ; toucher un mois donne le détail ;
  - « À payer bientôt » (30 jours, tous comptes) ;
  - une carte par fournisseur (prochaine facture estimée, moyenne par mois, provision : « prête pour … » ou « il manquera … »), puis les provisions sans facture ;
  - « Importer une facture » : un ou plusieurs PDF (texte lu sur le téléphone par pdf.js ; avec plusieurs PDF, les plus anciens vont dans l'historique et la plus récente est à vérifier), ou des photos page par page (ML Kit, « + Page suivante », page tournée remise droite) ;
  - la facture lue : champs modifiables, comparaison avec l'an dernier, et trois effets à cocher : le prélèvement (ou « à payer ») dans « À venir » à la place du frais fixe estimé ce mois-là, la prochaine facture estimée, la provision (créer, ou payer la facture avec) ;
  - détail d'un fournisseur : provision, factures en barres avec la prochaine estimée, moyenne par mois, consommation sur 12 mois, prix moyen, liste (toucher pour supprimer).
- **Bourse** (Perso seulement) : cours Yahoo et CoinGecko via le relais, courbe 1J. Comptée une fois dans l'épargne, comme une ligne automatique (« dont Bourse » sur l'Accueil et dans Épargne).
- **Analyse** :
  - graphiques Mois, Répartition, Récurrentes et Qui a payé ;
  - bouton « + Frais fixes » ;
  - détail d'un mois ;
  - **Analyse avancée** (Plus) : inflation perso (INSEE), année / an dernier, alertes, reste à vivre, projection, simulateur, résumé pour une IA.

**Menu** : 3 blocs sans titres et sans défilement. Foyer partagé, Personnes, Sauvegarder · Importer un relevé, Exporter en PDF, Galerie · Réglages (devise, code et empreinte, restaurer une sauvegarde).

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

**Import d'un relevé** (menu et Compte › Configuration) : OFX/QFX, QIF, CSV lus sur le téléphone, aperçu à cocher, import en une fois, annulable. Détails dans `CLAUDE.md`.

**Version Store** : `PLUS_FEATURES = widgets, foyer, avancee, factures`. L'achat de Plus n'est pas encore branché. L'import de relevé est gratuit pour l'instant.

## En cours / à reprendre

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

- **31/10** : estimation des factures selon la saison (l'hiver consomme plus), pour les deux applis.
- **31/10** : l'appli doit marcher sans réseau. La version Store est une appli standard : entièrement dans l'APK, mises à jour par le Store comme les autres applis, aucune connexion nécessaire pour l'usage normal. La version Perso reste chargée en ligne (corrections tout de suite) avec une copie gardée pour marcher sans réseau.
- **31/10** : onglet « Factures » intégré (« tu peux intégrer ») : Plus dans la version Store ; les provisions passent de l'onglet Compte à l'onglet Factures pour les droits du foyer (elles restent visibles et gratuites dans Compte › Configuration).
- **31/10** : « Mes factures » sera un onglet, réservé à Tickets Plus dans la version Store.
- **31/10** : import de factures : effets proposés « à cocher » ; une page « Mes factures » qui sert d'accueil aux provisions et réunit le prévisionnel.
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

### 31/10
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
