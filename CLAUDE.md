# Tickets — guide pour Claude Code

Appli de suivi des dépenses d'un foyer (tickets de caisse, comptes, frais fixes, commun, épargne, bourse), écrite par et pour Benoît, en route vers une version Play Store gratuite avec fonctions payantes (« Tickets Plus »).

## Règles de travail avec Benoît

- Répondre **en français**, court et concret.
- « Ne fais rien », « comment tu vois ça », « montre-moi » → donner un avis ou une maquette, **ne pas modifier l'appli**. Par défaut, montrer la proposition avant de modifier ; il dit « tu peux intégrer directement » quand il veut qu'on le fasse.
- On travaille dans `beta/index.html`. Le `index.html` à la racine est l'ancienne version stable : ne pas y toucher sans demande.
- Avant chaque commit, mettre à jour l'étiquette de version (heure de Paris) :
  `sed -i "s#<meta name=\"build\" content=\"[^\"]*\" />#<meta name=\"build\" content=\"$(TZ=Europe/Paris date +'%d/%m %H:%M')\" />#" beta/index.html`
- Commits en français, préfixés « β » quand ils touchent la β, poussés directement sur `main`.
- Exigences permanentes : marcher sans bug pour une grande famille (10 personnes et plus, plus de 10 comptes, affichage lisible) ; rien à configurer pour l'utilisateur ; aucune source de données payante ; le relais ne doit jamais pouvoir lire les données du foyer.

## Dépôt

| Chemin | Rôle |
|---|---|
| `beta/index.html` | **L'appli** (≈ 6 800 lignes) : HTML + CSS + JS dans un seul fichier. Servie par GitHub Pages (`/Tickets-/beta/`). |
| `index.html`, `sw.js`, `manifest.webmanifest` | Ancienne version stable à la racine + service worker (réseau d'abord). |
| `relais/cours-worker.js` | Worker Cloudflare : cours Yahoo / CoinGecko (`/search`, `/quote`, `/chart`, `/crypto/*`), inflation INSEE (`/inflation`) et routage `/foyer`. |
| `relais/foyer.js` | Foyer partagé : un Durable Object SQLite par foyer (classe `Foyer`). |
| `wrangler.jsonc` | Config du Worker ; déployé par Workers Builds à chaque push sur `main`. |
| `app-android/` | Appli Android Capacitor 7 qui charge la β en ligne (`server.url`), plus le code natif dans `native/`. |
| `.github/workflows/apk-beta.yml` | Compile deux APK (Perso et Store) quand `app-android/**` change ; publiés dans la release `apk-beta`. |

## Code de `beta/index.html`

- **ES5 uniquement** : `var`, `function`, pas de `let`/`const`, de flèches, de gabarits ni d'`async`. Tout le JS est dans un seul `<script>` (IIFE).
- Méthode d'édition qui marche bien : script Python qui remplace un extrait exact avec `assert s.count(old)==1`, en écrivant les vrais caractères Unicode (pas d'échappements `\u`).
- Vérifier la syntaxe après chaque modification :
  `node -e "const h=require('fs').readFileSync('beta/index.html','utf8');const m=h.match(/<script>\n  \(function\(\)\{[\s\S]*?<\/script>/);new Function(m[0].replace(/^<script>/,'').replace(/<\/script>$/,''));console.log('OK')"`
- Repères : les sections sont annoncées par `// ---------- Titre ----------` (Comptes, Éditions, Budgets, Filtre par personne, Analyse, Appli Android, Foyer partagé, Widgets…).
- Outils internes :
  - `store.read(k, def)` / `store.write(k, v)` : JSON dans localStorage.
  - `render()` : redessine tout ; il remet aussi les mémos à zéro (`pvMemo`, `fsMemo`). `renderView()` choisit l'écran selon `state.view`.
  - `uiForm({title, fields}, cb)`, `uiChoice`, `uiToast` : fenêtres intégrées. Les champs de `uiForm` sont de type `seg`, `select`, `money`… ; `api.show/get/set` dans `onChange`.
  - `num(x)` : lit un montant tapé (virgule ou point, espaces — le clavier Android en met après la virgule —, €, « 1 234,56 »). Toujours l'utiliser, jamais `parseFloat` directement.
  - `fmt`, `fmtK`, `fmtS` : montants. **Tout texte inséré en HTML passe par `esc()`.**
- Écran mobile, thème sombre (variables CSS `--bg`, `--card`, `--ink`, `--accent`…). Tester à 412 px de large.

## Données (clés localStorage)

- `entries` : tickets `{id, date, marchand, montant, categorie, payePar, compte?, articles[]}`.
- `comptes` : `{key, nom, payer, main}` (un compte principal).
- `personnes` : `{nom, archived?}`.
- `fraisCommuns` : frais fixes `{id, label, montant, personne ("Commun" ou un prénom), recurrent, month, startMonth?, endMonth?, compte?, split?, amounts?, parts?, doneMonths, skipMonths?}`.
  - `skipMonths` : mois où un frais récurrent est retiré pour ce mois seulement (« Rétablir » dans la liste).
  - `startMonth` : premier mois d'un frais récurrent (sinon déduit par `fraisStart`). `amounts` et `parts` sont indexés par mois de début (« à partir de »).
  - `parts` : `{"AAAA-MM": {prénom: %} ou null}` = parts propres au frais ; toujours passer par `fraisPct(f, qui, mois)`.
- `virements`, `epargne`, `provisions`, `bourse`.
  - Provision `ou` : où est l'argent (`ep:<id épargne>`, `cpt` = compte principal, `cpt:<clé>` = autre compte bancaire, `ext`) ; toujours passer par `provWhere(p)` (défaut : premier compte épargne de la personne). Sur l'épargne ou le compte, elle est déjà dans leur solde : ne pas l'ajouter une 2e fois.
- `budgets` (budgets du foyer par catégorie), `budgetsP` (`{personne: {catégorie: montant}}`).
- `communParts` (part de chacun dans le commun, en %), `argentMois`, `liquideMois`, `soldeInit`, `devise`.
- Taxonomie : `cats`, `familles`, `produits`, `appris`, `familleDe`.

## Notions métier à connaître

- **Accueil** : graphiques choisis par l'utilisateur (`homeCharts`, bouton ⚙ Choisir, appui long sur une carte), grande carte du haut au choix (`homeTop`, hauteur fixe 300 px) ; puces ✍️ Saisie et 🧾 Tickets (page Tickets, `state.listSub="tickets"`) ; bouton personne en haut à droite. Rien sous les graphiques.
- **Début d'utilisation** : `acctStart` (mois de départ d'un compte) ; avant ce mois, pas de solde, de provision (`provBalance`) ni de mensualité (`mensuelAt`).
- **Ticket ↔ compte** : le compte choisi sur le ticket, sinon celui dont le `payer` est égal à `payePar` (`ticketInAcct`). Un `payePar` vide compte pour le propriétaire (`payerOf`).
- **Commun** : `communModel(month)` calcule les parts. Les parts **ne changent pas les soldes des comptes**. Un frais « Commun » est retiré :
  - en entier du compte principal (ou de `f.compte`) par défaut ;
  - avec `f.split` (« chacun sa part ») : la part de chacun sur son propre compte (`payAcctOf`).
  
  Toujours passer par `fraisKind(f, compte)` et `fraisAcctAmt(f, compte, mois)` pour les soldes.
- **Filtre par personne** (Accueil, Articles, Analyse, Commun) : `pvCur()` vaut `moi`, un prénom ou `all` ; utiliser `vEntries()` et `inView()`. Dans Commun, il choisit seulement la part affichée en grand et dans les bulles. « Qui a payé » (Analyse) montre toujours tout le foyer. Il ne s'applique ni aux comptes, ni au Bilan, ni aux widgets.
- **Analyse « + Frais fixes »** : `fraisLines(mois, qui)` donne ce qui sort réellement du compte de la personne. `anFraisLines` limite le calcul aux mois qui ont des tickets.
- **Éditions** : `EDITION` vaut `perso` ou `store`. L'appli Android l'annonce par `TicketsApp/<édition>` dans son identifiant de navigateur ; dans un navigateur, ajouter `?edition=store`.
  - La version Store n'a pas la Bourse.
  - `PLUS_FEATURES = ["widgets","foyer","avancee"]` sont réservées à Tickets Plus dans la version Store ; vérifier avec `canUse()`.
- **Analyse avancée** (`state.view="avancee"`, `renderAvancee`, `avData`) : inflation perso, année / année précédente, alertes, épargne et reste à vivre, pistes d'économies, projection, simulateur, résumé à coller dans une IA. Tout est calculé sur le téléphone ; seule l'inflation INSEE (publique) vient du relais (`/inflation`, gardée 24 h dans `inseeIpc`).
  - Rejoindre un foyer est gratuit.

## Foyer partagé (modèle « le propriétaire est le centre »)

- Le téléphone du propriétaire a toutes les données. Il publie sur le relais une copie **chiffrée** (AES-GCM, gzip, format `g1.`) pour chaque membre, filtrée par `fyFilter(m)` selon les onglets, les comptes et `tk`.
- Un membre en **modification** envoie ses changements dans `/inbox`. Le propriétaire les fusionne fiche par fiche (le plus récent l'emporte), les contrôle avec `fyAllowed` et les remet en forme avec `fyFromMember`, puis republie.
- `FY_KEYS` liste les données synchronisées. Chaque fiche a pour chemin `clé + "\u001f" + id`.
- Droits par onglet : `m.ed` = onglets en modification (Masqué / Lecture / Modif. dans « Droits de … »). `role` vaut `edit` dès qu'un onglet est en modification. Chaque donnée est rattachée à un onglet (`FY_KEY_TAB` : tickets → Accueil, taxonomie et budgets → Articles, frais et parts → Commun, comptes / virements / épargne / provisions → Compte) ; `fyAllowed` refuse un changement dont l'onglet n'est pas en modification. Côté membre : `fyTabEd(t)`, et `fyRO()` dépend de l'onglet affiché. Ancien membre sans `ed` : tous ses onglets visibles en modification s'il est `edit`.
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
- `TicketOcrPlugin` : lecture des tickets par ML Kit. Dans le navigateur, c'est Tesseract.js.
- Widgets (`TkWidgets.java` + layouts `tk_*`) :
  - masqués par défaut ; on touche le montant → `TkUnlockActivity` (empreinte ou code de l'appareil) ;
  - remasqués au bout de 2 min ou quand l'écran s'éteint ;
  - réglages par appui long (`TkWidgetConfig`).
- `patch-manifest.js` et `tickets.gradle` sont appliqués par le workflow. Le widget Bourse n'existe que dans l'édition Perso.

## Tests

Il n'y a pas de tests dans le dépôt. Ceux qui ont servi sont des scripts Playwright en Python :
- Chromium sans interface, viewport 412×900 ;
- données injectées dans localStorage puis `reload()` ;
- plusieurs contextes de navigateur pour simuler le propriétaire et les membres ;
- une imitation locale du relais (Node + `node:sqlite`, sur `localhost:8787`, adresse injectée par la clé `foyerApi`) ;
- QR codes relus avec OpenCV.

Le réseau étant souvent restreint dans les environnements de Claude, bloquer toute requête hors `file:` et du relais local.

## Encore à décider (ne pas trancher seul)

- Répartition gratuit / Plus et prix de Plus.
- Nom définitif de l'appli et identifiant Store.
- Type de compte Google Play.
- Lien avec la banque (mis de côté le 22/10/2026) : pistes dans l'ordre — bouton « Ouvrir ma banque », import de relevé CSV/OFX sur le téléphone, synchro DSP2 via un agrégateur payant (seulement Plus, à décider).
- Avant la sortie Store :
  - QR code lisible par l'appareil photo (lien Play Store + install referrer) ;
  - offre Workers Paid ;
  - WebSocket à la place de l'interrogation régulière ;
  - protection contre les abus à la création de foyer ;
  - copies différentielles ;
  - domaine propre en juridiction UE.
