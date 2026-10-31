# Tickets — guide pour Claude Code

Appli de suivi des dépenses d'un foyer (tickets de caisse, comptes, frais fixes, commun, épargne, bourse), écrite par et pour Benoît, en route vers une version Play Store gratuite avec fonctions payantes (« Tickets Plus »).

## Règles de travail avec Benoît

- **Lire `JOURNAL.md` en début de session** (état actuel, en cours, décisions) au lieu de relire les conversations. **Le tenir à jour à chaque modification, dans le même commit** : une entrée datée en haut de l'Historique, plus les sections Décisions, État actuel et En cours si elles changent.
- Répondre **en français**, court et concret.
- « Ne fais rien », « comment tu vois ça », « montre-moi » → donner un avis ou une maquette, **ne pas modifier l'appli**. Par défaut, montrer la proposition avant de modifier ; il dit « tu peux intégrer directement » quand il veut qu'on le fasse.
- On travaille dans `beta/index.html`. Le `index.html` à la racine est l'ancienne version stable : ne pas y toucher sans demande.
- Avant chaque commit, mettre à jour l'étiquette de version (heure de Paris) :
  `sed -i "s#<meta name=\"build\" content=\"[^\"]*\" />#<meta name=\"build\" content=\"$(TZ=Europe/Paris date +'%d/%m %H:%M')\" />#" beta/index.html`
- Commits en français, préfixés « β » quand ils touchent la β, poussés directement sur `main`.
- Exigences permanentes : marcher sans bug pour une grande famille (10 personnes et plus, plus de 10 comptes, affichage lisible) ; rien à configurer pour l'utilisateur ; aucune source de données payante ; le relais ne doit jamais pouvoir lire les données du foyer ; **marcher sans réseau** (la version Store est une appli complète, sans aucune connexion pour l'usage normal : seuls le foyer partagé et l'achat de Plus en ont besoin).

## Dépôt

| Chemin | Rôle |
|---|---|
| `beta/index.html` | **L'appli** (≈ 9 700 lignes) : HTML + CSS + JS dans un seul fichier. Servie par GitHub Pages (`/Tickets-/beta/`). |
| `index.html`, `sw.js`, `manifest.webmanifest` | Ancienne version stable à la racine + service worker (réseau d'abord), qui sert aussi la β dans un navigateur. |
| `relais/cours-worker.js` | Worker Cloudflare : cours Yahoo / CoinGecko (`/search`, `/quote`, `/chart`, `/crypto/*`), inflation INSEE (`/inflation`) et routage `/foyer`. |
| `relais/foyer.js` | Foyer partagé : un Durable Object SQLite par foyer (classe `Foyer`). |
| `wrangler.jsonc` | Config du Worker ; déployé par Workers Builds à chaque push sur `main`. |
| `app-android/` | Appli Android Capacitor 7, code natif dans `native/`. **Perso** : charge la β en ligne (`server.url`) et en garde une copie pour marcher sans réseau (`TkOfflineClient`). **Store** : la β est dans l'APK (copiée à la compilation avec pdf.js et `insee.json`), mises à jour par le Store. |
| `.github/workflows/apk-beta.yml` | Compile deux APK (Perso et Store) quand `app-android/**` ou `beta/**` change ; publiés dans la release `apk-beta`. |

## Code de `beta/index.html`

- **ES5 uniquement** : `var`, `function`, pas de `let`/`const`, de flèches, de gabarits ni d'`async`. Tout le JS est dans un seul `<script>` (IIFE).
- Méthode d'édition qui marche bien : script Python qui remplace un extrait exact avec `assert s.count(old)==1`, en écrivant les vrais caractères Unicode (pas d'échappements `\u`).
- Vérifier la syntaxe après chaque modification :
  `node -e "const h=require('fs').readFileSync('beta/index.html','utf8');const m=h.match(/<script>\n  \(function\(\)\{[\s\S]*?<\/script>/);new Function(m[0].replace(/^<script>/,'').replace(/<\/script>$/,''));console.log('OK')"`
- Repères : les sections sont annoncées par `// ---------- Titre ----------` (Comptes, Éditions, Budgets, Filtre par personne, Analyse, Appli Android, Foyer partagé, Widgets…).
- Outils internes :
  - `store.read(k, def)` / `store.write(k, v)` : JSON dans localStorage.
  - `render()` : redessine tout ; il remet aussi les mémos à zéro (`pvMemo`, `fsMemo`). `renderView()` choisit l'écran selon `state.view`.
  - `uiForm({title, fields}, cb)`, `uiChoice`, `uiToast`, `uiUndoToast(msg, "Annuler", annuler, fin)` : fenêtres intégrées. Les champs de `uiForm` sont de type `seg`, `select`, `money`… ; `api.show/get/set` dans `onChange`.
  - `num(x)` : lit un montant tapé (virgule ou point, espaces — le clavier Android en met après la virgule —, €, « 1 234,56 »). Toujours l'utiliser, jamais `parseFloat` directement.
  - `fmt`, `fmtK`, `fmtS` : montants. **Tout texte inséré en HTML passe par `esc()`.**
- Écran mobile, thème sombre (variables CSS `--bg`, `--card`, `--ink`, `--accent`…). Tester à 412 px de large.
- **Connexions** : aucune pour l'usage normal. `appLocal()` = appli Store (page dans l'APK, `https://localhost`) : pdf.js pris dans `./pdfjs/`, inflation dans `./insee.json`, ni vérification de version ni service worker. Tesseract (lecture des tickets dans un navigateur) n'est chargé qu'au besoin par `loadTesseract()`, jamais dans l'appli Store. Pas de service worker dans l'appli Android (Store, ou Perso avec `TkOff/1` dans son identifiant de navigateur) ; dans un navigateur, `swTidy` retire de sa copie les `index.html?v=…` des vérifications de version. Toute nouvelle connexion doit être justifiée et avoir un repli sans réseau.

## Données (clés localStorage)

- `entries` : tickets `{id, date, marchand, montant, categorie, payePar, compte?, articles[]}`.
- `comptes` : `{key, nom, payer, main}` (un compte principal).
- `personnes` : `{nom, archived?}`.
- `fraisCommuns` : frais fixes `{id, label, montant, personne ("Commun" ou un prénom), recurrent, month, startMonth?, endMonth?, compte?, split?, amounts?, parts?, doneMonths, skipMonths?}`.
  - `skipMonths` : mois où un frais récurrent est retiré pour ce mois seulement (« Rétablir » dans la liste).
  - `startMonth` : premier mois d'un frais récurrent (sinon déduit par `fraisStart`). `amounts` et `parts` sont indexés par mois de début (« à partir de »).
  - `parts` : `{"AAAA-MM": {prénom: %} ou null}` = parts propres au frais ; toujours passer par `fraisPct(f, qui, mois)`.
- Données venues d'un relevé importé : `imp` (n° de l'import), `impKey` (tickets, virements) ou `impKeys` (frais fixes), `src:"releve"` (tickets). `lastImport` (localStorage, non synchronisé) permet « Annuler le dernier import ».
- `virements`, `epargne`, `provisions`, `bourse`.
  - Épargne `bourseLink` : la ligne « Bourse » automatique (une seule, valeur = portefeuille, mise à jour par `syncBourseEpargne`, créée par `ensureBourseEp`). La Bourse compte ainsi une fois dans tous les totaux d'épargne ; `bourseEpAt(mois)` donne sa part. Pas de virement ni de provision vers elle.
  - Provision `ou` : où est l'argent (`ep:<id épargne>`, `cpt` = compte principal, `cpt:<clé>` = autre compte bancaire, `ext`) ; toujours passer par `provWhere(p)` (défaut : premier compte épargne de la personne). Sur l'épargne ou le compte, elle est déjà dans leur solde : ne pas l'ajouter une 2e fois.
- `factures` : factures importées `{id, four, type ("elec"|"gaz"|"eau"|"net"|"autre"), date, montant, prelev? | aPayer?, due?, du?, au?, conso?, next?, regul?, src, fraisId?, prId?}` ; série = même `factKey(f)` (type + nom normalisé). `factAlias` : nom de fournisseur corrigé à la main.
  - Frais fixe créé par une facture : `fact` (clé de la série), `factNom`, `est` (prochaine facture estimée, remplacée à l'import de la vraie), `aPayer`. Provision liée à une série : `fact`.
- `budgets` (budgets du foyer par catégorie), `budgetsP` (`{personne: {catégorie: montant}}`).
- `communParts` (part de chacun dans le commun, en %), `argentMois`, `liquideMois`, `soldeInit`, `devise`.
- Taxonomie : `cats`, `familles`, `produits`, `appris`, `familleDe`.

## Notions métier à connaître

- **Accueil** : graphiques choisis par l'utilisateur (`homeCharts`, bouton ⚙ Choisir, appui long sur une carte), grande carte du haut au choix (`homeTop`, hauteur fixe 300 px) ; puces ✍️ Saisie et 🧾 Tickets (page Tickets, `state.listSub="tickets"`) ; bouton personne en haut à droite. Rien sous les graphiques.
- **Compte** : la page principale est la liste des opérations du mois (`cptOps(compte, mois)` → `{done, todo}`, `opsBodyHTML`) : tickets, frais fixes et virements par jour, solde du soir, « À venir » avec le rond « fait ». Filtre `state.cptF` (`tout`, `in`, `out`, `av`), recherche `state.cptQ`. Les graphiques sont sur la page `state.view="comptedet"`, `cptPage="graph"` (plein écran) ; les cartes « Compte » de l'Accueil sont prises là.
- **Jour d'une opération** : ticket = sa date ; virement = `virDay(v)` (`v.day`, sinon la note d'un ancien import) ; frais fixe = `fraisDay(f, mois)` (`f.doneDays[mois]`, sinon `f.jour`). Noté quand on coche « fait » ce mois-ci (`toggleFraisDone`, `toggleVirementDone`) et par l'import ; 0 = rangé au 1er.
- **Appui long sur un ticket** (toute ligne `.entry[data-id]` ou `.ops-open[data-k="t"]`, branché après chaque `render()` par `wireTicketLongPress`) : Ouvrir / Supprimer, suppression annulable (`delEntryUndo`).
- **Fiche d'un ticket** (`renderForm`, `saveDraft`) : les articles sont comparés au montant (`artChkOf`, `artChkPaint`, tolérance `CHK_TOL`) ; s'il reste un écart à l'enregistrement, une question propose de vérifier, compléter (« Divers ») ou enregistrer quand même (`saveDraft(true)`). La photo est une vignette à côté du montant. Produit vide = orange ; produit rempli avec le dernier que la personne du ticket (`payerOf`) a donné à cet article (`apprisOf`, `lookupAppris(libellé, personne)`), cloisonné par personne.
- **Lecture d'un ticket** (`mlkitRows` puis `parseTicket`) : ML Kit rend des morceaux regroupés en lignes ; le total est le plus grand montant d'une ligne de total (sinon le montant payé). Pas des articles : tableau de TVA, numéros de version, volume de carburant. Remise (« -0,73 ») = article « Remise ». Prix mal lus réparés sur les lignes d'article (« 142 EUR », « A84 EUR », pesée calculée) ; un article sans prix lisible est gardé avec le prix vide (orange, proposé à l'enregistrement). Enseigne : le haut du ticket, sinon une grande enseigne écrite plus bas (`matchMerchant`). Catégorie : `ticketCat`. « Copier la lecture » (`ocrRawSheet`) donne les lignes et les morceaux ML Kit avec leurs coins : de quoi rejouer `mlkitRows` et `parseTicket` hors du téléphone. Tests : textes de tickets passés dans `parseTicket` extrait du fichier (jamais de vrais tickets dans le dépôt).
- **Onglet Factures** (`state.view` = `factures`, `factlue`, `factserie` ; section `// ---------- Factures`) : `renderFactures` (12 prochains mois `factYear`, « À payer bientôt » `factSoon`, cartes par série `factSeries` et provisions), `renderFactLue` (facture lue, effets à cocher `factEffects`, `factApply`), `renderFactSerie`. Import : `factImportChooser` → PDF (`readPdfText`, pdf.js chargé par `loadPdfJs`, `pdfLines`) ou photos (`ocrBillPage`), puis `parseBill`. Estimation : `factEstimate(série, date)`, moyenne `factMonthly`, rythme `factRythme`. Plus dans la version Store (`canUse("factures")`).
- **Début d'utilisation** : `acctStart` (mois de départ d'un compte) ; avant ce mois, pas de solde, de provision (`provBalance`) ni de mensualité (`mensuelAt`).
- **Ticket ↔ compte** : le compte choisi sur le ticket, sinon celui dont le `payer` est égal à `payePar` (`ticketInAcct`). Un `payePar` vide compte pour le propriétaire (`payerOf`).
- **Commun** : `communModel(month)` calcule les parts. Les parts **ne changent pas les soldes des comptes**. Un frais « Commun » est retiré :
  - en entier du compte principal (ou de `f.compte`) par défaut ;
  - avec `f.split` (« chacun sa part ») : la part de chacun sur son propre compte (`payAcctOf`).
  
  Toujours passer par `fraisKind(f, compte)` et `fraisAcctAmt(f, compte, mois)` pour les soldes.
- **Filtre par personne** (Accueil, Articles, Analyse, Commun) : `pvCur()` vaut `moi`, un prénom ou `all` ; utiliser `vEntries()` et `inView()`. Dans Commun, il choisit seulement la part affichée en grand et dans les bulles. « Qui a payé » (Analyse) montre toujours tout le foyer. Il ne s'applique ni aux comptes, ni au Bilan, ni aux widgets.
- **Import d'un relevé** (section `// ---------- Import d'un relevé`, `state.view="import"`) :
  - `impParse` lit l'OFX, le QIF ou le CSV, tout sur le téléphone. Montants avec `impNum`, dates avec `impDate` + `impDateOrder` (jj/mm ou mm/jj).
  - `impBuild` range les opérations :
    - carte → tickets sans articles, à la date d'achat ;
    - prélèvements → frais fixes regroupés (« chaque mois » ou « une fois ») ;
    - le reste → virements faits.
  - `impBuild` repère aussi les doublons :
    - `importedKeys` : seulement dans le compte visé ;
    - puis, pour chaque dépense, `fraisHit` (frais fixe du compte, même montant ce mois-là), `virHit` et `ticketHit` ;
    - même nom = sûr, autre nom = « peut-être » ;
    - un ticket saisi sur un autre compte peut y être déplacé.
  - `S.kind` change le type d'une ligne (ticket, frais fixe, virement).
  - Un frais fixe retrouvé et laissé de côté est marqué payé (`lastImport.paid`) ; un frais ou virement déjà là reçoit le jour du relevé s'il n'en avait pas (`lastImport.dayed`).
  - Un virement envoyé égal aux provisions du mois gardées hors de ce compte (toutes, ou une seule) devient « Provisions du mois » ou « Provision · nom » (`provHit`, sauf épargne programmée).
  - S'il reste un écart avec la banque, `impGapHints` cherche ce qui a exactement ce montant : ligne décochée ou vue comme déjà présente, ticket, frais fixe payé ou virement de l'appli absent du relevé.
  - `impOpening` calcule le solde de départ ; `impApply` crée les données ; `impUndo` annule.
  - Le résultat se compare à `acctFigures(compte, mois).banque` (ce qui est fait), comme la carte « banque estimée ».
  - Accessible si `impCan()` (un vrai compte et, dans un foyer, l'onglet Compte en modification).
- **Analyse « + Frais fixes »** : `fraisLines(mois, qui)` donne ce qui sort réellement du compte de la personne. `anFraisLines` limite le calcul aux mois qui ont des tickets.
- **Éditions** : `EDITION` vaut `perso` ou `store`. L'appli Android l'annonce par `TicketsApp/<édition>` dans son identifiant de navigateur (plus ` TkOff/1` pour la Perso qui garde elle-même sa copie hors ligne) ; dans un navigateur, ajouter `?edition=store`.
  - La version Store n'a pas la Bourse.
  - `PLUS_FEATURES = ["widgets","foyer","avancee","factures"]` sont réservées à Tickets Plus dans la version Store ; vérifier avec `canUse()`.
- **Analyse avancée** (`state.view="avancee"`, `renderAvancee`, `avData`) : inflation perso, année / année précédente, alertes, épargne et reste à vivre, pistes d'économies, projection, simulateur, résumé à coller dans une IA. Tout est calculé sur le téléphone ; seule l'inflation INSEE (publique) vient du relais (`/inflation`, gardée 24 h dans `inseeIpc`) ; dans l'appli Store, elle est lue dans `insee.json` de l'APK.
  - Rejoindre un foyer est gratuit.

## Foyer partagé (modèle « le propriétaire est le centre »)

- Le téléphone du propriétaire a toutes les données. Il publie sur le relais une copie **chiffrée** (AES-GCM, gzip, format `g1.`) pour chaque membre, filtrée par `fyFilter(m)` selon les onglets, les comptes et `tk`.
- Un membre en **modification** envoie ses changements dans `/inbox`. Le propriétaire les fusionne fiche par fiche (le plus récent l'emporte), les contrôle avec `fyAllowed` et les remet en forme avec `fyFromMember`, puis republie.
- `FY_KEYS` liste les données synchronisées. Chaque fiche a pour chemin `clé + "\u001f" + id`.
- Droits par onglet : `m.ed` = onglets en modification (Masqué / Lecture / Modif. dans « Droits de … »). `role` vaut `edit` dès qu'un onglet est en modification. Chaque donnée est rattachée à un onglet (`FY_KEY_TAB` : tickets → Accueil, taxonomie et budgets → Articles, frais et parts → Commun, comptes / virements / épargne → Compte, provisions et factures → Factures) ; `fyAllowed` refuse un changement dont l'onglet n'est pas en modification. Côté membre : `fyTabEd(t)`, et `fyRO()` dépend de l'onglet affiché. Ancien membre sans `ed` : tous ses onglets visibles en modification s'il est `edit`.
- Accueil d'un membre : toujours visible (`fyTabOn(m,"list")` vrai), personnel (`pvLockMe` force « moi », pas de Moi/Foyer) ; encadrés Banque · Ma part du commun · Mes tickets.
- Membre (`fyCfg` : `{role: owner|view|edit, fid, tok, km, me, tabs, ed, accts, tk}`) :
  - `accts: null` = tous les comptes ; `[]` = « Aucun · ses tickets » (compte fictif `__tickets`) ;
  - Commun et Bourse ne dépendent pas des comptes choisis : avec Commun visible, il reçoit les frais communs, les parts et ses frais perso (pas ceux des autres) ; les produits partagés des autres seulement avec `tk: "all"` ;
  - `tk: "all"` = tous les tickets et tous les frais fixes du foyer, ceux des autres en lecture seule (`fyCanEdit`, `fyFraisCanEdit`).
- Invitation par QR code `TK1.<fid>.<mid>.<inv>.<km>`, sans dépendance externe (`qrMatrix`).
- Code à 6 chiffres + empreinte obligatoires sur tous les téléphones du foyer. Code de récupération du propriétaire : 26 caractères.
- Retirer un membre ou changer une clé coupe son accès. Un enfant est en consultation seulement.

## Appli Android (`app-android/native`)

- `TicketsNativePlugin` : sauvegarde, partage, widgets, `scanQr` (Google code scanner).
- `TicketOcrPlugin` : lecture des tickets par ML Kit (modèle dans l'APK, hors ligne). Dans le navigateur, c'est Tesseract.js.
- `TkOfflineClient` (Perso seulement, branché dans `MainActivity`) : sert la page de l'appli depuis le réseau (avec un délai court) et en garde une copie dans `tk-offline-page.html` ; sans réseau, ou si le chargement échoue, il sert la copie à la même adresse (mêmes données). Le pont Capacitor est ajouté par le WebView (DOCUMENT_START_SCRIPT), copie comprise. Permission `ACCESS_NETWORK_STATE` ajoutée par `patch-manifest.js`.
- Widgets (`TkWidgets.java` + layouts `tk_*`) :
  - masqués par défaut ; on touche le montant → `TkUnlockActivity` (empreinte ou code de l'appareil) ;
  - remasqués au bout de 2 min ou quand l'écran s'éteint ;
  - réglages par appui long (`TkWidgetConfig`).
- `patch-manifest.js` et `tickets.gradle` sont appliqués par le workflow. Le widget Bourse n'existe que dans l'édition Perso.

## Tests

Il n'y a pas de tests dans le dépôt. Ceux qui ont servi sont des scripts Playwright en Python :
- l'appli Store se teste en servant une copie de `beta/` (+ pdf.js, `insee.json`) sur `https://localhost/` par une route, avec l'identifiant `TicketsApp/store` et un faux `window.Capacitor` : aucune requête ne doit partir ailleurs ;
- Chromium sans interface, viewport 412×900 ;
- données injectées dans localStorage puis `reload()` ;
- plusieurs contextes de navigateur pour simuler le propriétaire et les membres ;
- une imitation locale du relais (Node + `node:sqlite`, sur `localhost:8787`, adresse injectée par la clé `foyerApi`) ;
- QR codes relus avec OpenCV.

Le réseau étant souvent restreint dans les environnements de Claude, bloquer toute requête hors `file:` et du relais local.

## Encore à décider (ne pas trancher seul)

- Répartition gratuit / Plus et prix de Plus (décidé le 31/10 : le futur onglet « Factures » sera dans Plus).
- Nom définitif de l'appli et identifiant Store.
- Type de compte Google Play.
- Lecture des tickets par une IA (mise de côté le 28/10/2026) : en ligne seulement en option Plus, avec accord. Prévue plus tard : « Lire avec mon IA » (l'IA déjà sur le téléphone, par le partage Android) ; voir JOURNAL.md, « Améliorations prévues ».
- Lien avec la banque (mis de côté le 22/10/2026) : pistes dans l'ordre — bouton « Ouvrir ma banque », import de relevé CSV/OFX sur le téléphone, synchro DSP2 via un agrégateur payant (seulement Plus, à décider).
- Avant la sortie Store :
  - QR code lisible par l'appareil photo (lien Play Store + install referrer) ;
  - offre Workers Paid ;
  - WebSocket à la place de l'interrogation régulière ;
  - protection contre les abus à la création de foyer ;
  - copies différentielles ;
  - domaine propre en juridiction UE.
