# Tickets : dossier de passation

*État au 01/11/2026, étiquette `01/11 17:27`. Le fichier sert à reprendre le projet dans une autre conversation Claude.*

> **À Claude qui reprend le projet**
>
> 1. Lis d'abord ce fichier.
> 2. Lis ensuite `CLAUDE.md` puis `JOURNAL.md` dans le dépôt. Ils sont tenus à jour à chaque modification et font foi s'ils diffèrent de ce document.
> 3. Réponds à Benoît **en français**, court et concret.
> 4. **Ne modifie rien sans lui avoir montré la proposition**. Une maquette suffit. Il dit « tu peux intégrer » ou « tu peux y aller » quand il est d'accord.

---

## 1. Le projet en bref

**Tickets** est une appli de suivi des dépenses d'un foyer, écrite par et pour Benoît Pierrard. Elle couvre :
- les tickets de caisse scannés et leurs articles ;
- les comptes, les frais fixes, le commun entre conjoints ;
- l'épargne, les provisions, les factures ;
- la Bourse.

Il l'utilise sur son téléphone Android, en foyer partagé avec sa femme.

**Objectif** : une version sur le Play Store, gratuite, avec des fonctions payantes appelées « Tickets Plus ». Ce n'est pas une appli payante d'office.

**Deux éditions, un seul code :**

| Édition | Pour qui | Bourse | Comment elle se charge | Mises à jour |
|---|---|---|---|---|
| **Perso** (`Tickets Perso`, `fr.bpierrard.tickets.beta`) | Benoît | oui | charge la β en ligne et garde une copie pour marcher sans réseau | immédiates à chaque push |
| **Store** (`Tickets Store`, `fr.bpierrard.tickets.store`, identifiant provisoire) | public | non | l'appli entière est dans l'APK, aucune connexion pour l'usage normal | par le Play Store |

**Exigences permanentes de Benoît :**
- marcher sans bug pour une grande famille : 10 personnes et plus, plus de 10 comptes, affichage lisible ;
- rien à configurer pour l'utilisateur ;
- aucune source de données payante ;
- **marcher sans réseau** : seuls le foyer partagé, l'achat de Plus et la Bourse (Perso) utilisent le réseau ;
- le relais ne doit **jamais** pouvoir lire les données du foyer, car elles sont chiffrées sur le téléphone ;
- les données restent sur le téléphone.

---

## 2. Liens

| Quoi | Lien |
|---|---|
| Dépôt GitHub (public) | https://github.com/bpierrardmail-cyber/Tickets- |
| **Appli β (web)**, servie par GitHub Pages | https://bpierrardmail-cyber.github.io/Tickets-/beta/ |
| Appli β, version Store dans un navigateur | https://bpierrardmail-cyber.github.io/Tickets-/beta/?edition=store |
| Ancienne version stable (ne pas toucher) | https://bpierrardmail-cyber.github.io/Tickets-/ |
| Page des APK de test (release `apk-beta`) | https://github.com/bpierrardmail-cyber/Tickets-/releases/tag/apk-beta |
| **APK Perso** (avec Bourse) | https://github.com/bpierrardmail-cyber/Tickets-/releases/download/apk-beta/Tickets-perso.apk |
| **APK Store** (sans Bourse) | https://github.com/bpierrardmail-cyber/Tickets-/releases/download/apk-beta/Tickets-store.apk |
| Relais Cloudflare (Worker `tickets`) | https://tickets.bpierrard-mail.workers.dev |
| `CLAUDE.md`, texte brut | https://raw.githubusercontent.com/bpierrardmail-cyber/Tickets-/main/CLAUDE.md |
| `JOURNAL.md`, texte brut | https://raw.githubusercontent.com/bpierrardmail-cyber/Tickets-/main/JOURNAL.md |
| Fichier de l'appli, texte brut | https://raw.githubusercontent.com/bpierrardmail-cyber/Tickets-/main/beta/index.html |

**Accès au dépôt depuis un autre abonnement :**
- **Avec Claude Code**, relier le compte GitHub `bpierrardmail-cyber`, ou un compte ajouté comme collaborateur avec droit d'écriture. Claude peut alors lire, modifier, committer et pousser sur `main`.
- **Avec Claude en simple conversation**, les liens bruts ci-dessus suffisent pour lire. Pour modifier, il faut une connexion GitHub ; sinon Benoît applique lui-même les changements.

**Comptes externes (seul Benoît y a accès) :**
- Cloudflare : le Worker `tickets` est redéployé tout seul par Workers Builds à chaque push sur `main`.
- GitHub Pages et GitHub Actions : la β est publiée et les APK compilés à chaque push.

Les maquettes (canevas « Tickets — Plan de l'appli » et autres) sont des artefacts de l'abonnement actuel. Elles ne sont pas visibles ailleurs, sauf si Benoît les partage.

---

## 3. Architecture

### Fichiers du dépôt

| Chemin | Rôle |
|---|---|
| `beta/index.html` | **L'appli** : environ 9 800 lignes, HTML, CSS et JS dans un seul fichier. On travaille **uniquement ici**. |
| `index.html`, `sw.js`, `manifest.webmanifest`, `icon.svg` | Ancienne version stable et service worker (réseau d'abord), qui sert aussi la β dans un navigateur. Ne pas toucher sans demande. |
| `relais/cours-worker.js` | Worker Cloudflare, voir les routes ci-dessous. |
| `relais/foyer.js` | Foyer partagé : un Durable Object SQLite par foyer (classe `Foyer`), dans l'offre gratuite. |
| `wrangler.jsonc` | Configuration du Worker. |
| `app-android/` | Appli Android Capacitor 7 : `capacitor.config.json`, et le code natif dans `native/`. |
| `app-android/beta-test.keystore` | Clé de signature **de test** (mot de passe dans `tickets.gradle`). Ne convient pas au Store : il faudra une vraie clé d'envoi, gardée secrète hors du dépôt. |
| `.github/workflows/apk-beta.yml` | Compile les deux APK quand `beta/**` ou `app-android/**` change, puis les publie dans la release `apk-beta`. Durée : environ 3 minutes. |
| `tests/` | Tests Playwright en Python, avec données fictives, plus le relais local et `run.sh`. Mode d'emploi dans `tests/README.md`. |
| `CLAUDE.md` | Guide technique détaillé : fonctions clés, données, règles. |
| `JOURNAL.md` | État actuel, en cours, décisions datées, historique. |

**Routes du relais** (`relais/cours-worker.js`) :
- cours Yahoo et CoinGecko : `/search`, `/quote`, `/chart`, `/crypto/*` ;
- inflation INSEE : `/inflation` ;
- foyer partagé : `/foyer`.

### Code de l'appli (règles strictes)
- **ES5 uniquement** : `var` et `function`. Pas de `let`/`const`, de fonctions flèches, de gabarits `` ` `` ni d'`async`. Tout le JS tient dans un seul `<script>` (IIFE).
- Sections repérées par `// ---------- Titre ----------`.
- Outils internes :
  - `store.read(k, def)` et `store.write(k, v)` : JSON dans localStorage ;
  - `render()` et `renderView()` ;
  - fenêtres intégrées : `uiForm`, `uiChoice`, `uiToast`, `uiUndoToast` ;
  - `num(x)` pour lire un montant, **jamais `parseFloat`** ;
  - `fmt`, `fmtK`, `fmtS` pour afficher un montant ;
  - **tout texte inséré en HTML passe par `esc()`**.
- Thème sombre, écran mobile, à tester à 412 px de large.
- Éditions :
  - `EDITION` vaut `perso` ou `store`. L'appli Android l'annonce par `TicketsApp/<édition>` dans son identifiant de navigateur ; dans un navigateur, on ajoute `?edition=store`.
  - `PLUS_FEATURES = ["widgets","foyer","avancee","factures"]`, à vérifier avec `canUse()`.
  - `appLocal()` est vrai quand c'est l'appli Store : la page est dans l'APK, à l'adresse `https://localhost`.

### Sans réseau
- **Store** : `beta/`, pdf.js et `insee.json` sont copiés dans l'APK à la compilation. Ni vérification de version, ni service worker.
- **Perso** : `TkOfflineClient.java` sert la page depuis le réseau, avec un délai court, et en garde une copie (`tk-offline-page.html`). Sans réseau, il sert la copie à la même adresse, donc avec les mêmes données.
- Tesseract (lecture des tickets dans un navigateur) n'est chargé qu'au besoin, jamais dans l'appli Store. Sur Android, la lecture passe par **ML Kit**, inclus dans l'APK et hors ligne.

### Android (`app-android/native`)
- `TicketsNativePlugin` : sauvegarde, partage, widgets, lecture de QR code.
- `TicketOcrPlugin` : ML Kit.
- Widgets `TkWidget*` : Scan, Solde, Commun, Mois, Foyer, Bourse. Ils sont masqués par défaut et se déverrouillent par empreinte (`TkUnlockActivity`).
- `patch-manifest.js` et `tickets.gradle` sont appliqués par le workflow.

### Foyer partagé : le propriétaire est le centre
- Le téléphone du propriétaire a toutes les données. Il publie sur le relais une copie **chiffrée** pour chaque membre : AES-GCM, gzip, format `g1.`, filtrée selon ses droits.
- Un membre qui a le droit de modifier envoie ses changements dans `/inbox`. Le propriétaire les fusionne fiche par fiche, en gardant la plus récente, puis republie.
- Invitation par QR code. Un code à 6 chiffres et l'empreinte sont obligatoires sur chaque téléphone.
- Droits par onglet : Masqué / Lecture / Modif.

---

## 4. Ce que fait l'appli aujourd'hui

**Barre du bas** : Accueil · Dépenses · Compte · À venir · Commun · Bourse. La version Store n'a pas la Bourse. Chaque onglet a ses sous-onglets sous forme de boutons sous le titre. ✦ = Tickets Plus : la fonction reste visible, seul le bouton demande Plus.

- **Accueil** : graphiques choisis par l'utilisateur, grande carte du haut au choix, puces ✍️ Saisie et 🧾 Tickets, filtre par personne.
- **Dépenses**, sous-onglets Tickets · Produits · Budgets · Analyse :
  - Tickets : liste du mois et galerie de photos ;
  - Produits : prix, hausses, magasins, familles ;
  - Budgets : budgets par catégorie ;
  - Analyse : graphiques et ✦ Analyse avancée (inflation perso INSEE, comparaison avec l'an dernier, alertes, pistes d'économies, résumé à coller dans une IA).
- **Compte**, sous-onglets Opérations · Épargne · Graphiques, plus la roue du compte :
  - Opérations : la liste du mois comme un relevé de banque, avec « ＋ Ajouter » (virement reçu ou envoyé, « ↻ Reprendre des virements » du mois d'avant, frais fixe, ticket) ;
  - « ↻ Reprendre des virements » : dans le mois suivant, un mois choisi, une période, ou chaque mois (série qui crée le virement de chaque mois, 12 mois à l'avance ; modifier à partir d'un mois, retirer un mois, arrêter) ;
  - toucher un virement : Modifier, « ↻ Reprendre ce virement », et pour un virement envoyé (pas vers l'épargne) « 📅 Passer en frais fixe » (commun ou perso à choisir ; un mois, plusieurs mois ou sans fin ; le virement est remplacé, le solde ne bouge pas, les mêmes virements des mois couverts partent aussi, « Annuler » possible) ;
  - frais fixe : « Prélevé sur » ne montre que les comptes, celui par défaut déjà choisi (compte principal pour un frais commun, compte de la personne sinon) ;
  - roue du compte : modifier, solde reporté, **import d'un relevé** OFX, QIF ou CSV lu sur le téléphone (un virement déjà dans l'appli et retrouvé devient « fait »), annuler le dernier import.
- **À venir**, sous-onglets 12 mois · Frais fixes · Provisions · Factures :
  - 12 mois : les 12 prochains mois, « À payer bientôt », et ✦ « Tes comptes dans 12 mois » (projection et simulateur) ;
  - Factures (✦ en Store) : import de factures PDF ou photos, et estimation de la prochaine facture selon la saison ; dans le détail d'un fournisseur, toucher une facture pour la modifier, appui long pour la supprimer (annulable) ; appui long sur la carte d'un fournisseur pour le supprimer avec ses factures (provision gardée) ; une facture récente gardée sans ses effets est signalée « Pas dans tes comptes · Ajouter » ; une facture payée par une provision se règle en un seul geste (elle va dans le compte et sort de la provision, avec en option le virement du livret vers le compte), depuis la provision, le fournisseur ou la facture ;
  - Provisions : graphique « De côté » ou « Avec les factures prévues » (solde de chaque mois recalculé après les factures à venir : montant prévu, factures estimées du fournisseur suivi, sinon le même mois l'an dernier), liste des factures prévues avec ce qui manquera et « Passer à X € / mois » ;
  - Provisions : la mise de côté de chaque mois est un frais fixe « Provision · nom » relié (« Remplie par » : Commun, chacun sa part, une personne, ou pas dans les frais fixes) ; elle compte dans les parts du Commun et l'Analyse, et sort du compte qui paie sauf si l'argent y reste ; une facture payée par la provision sort du compte mais ne compte pas une 2ᵉ fois dans les parts ;
  - plusieurs factures d'un coup (plusieurs PDF, ou plusieurs factures en photos, recto et verso, même dans le désordre) : un écran de contrôle « 6 photos · 6 lues · 3 factures trouvées » liste les factures ; la plus récente est vérifiée en entier, les plus anciennes se contrôlent une par une ou se décochent ; une photo illisible se reprend ; rien n'est enregistré avant « Appliquer ».
- **Commun** : part de chacun dans le commun, en %, et parts propres à chaque frais ; frais communs du mois ; produits partagés.
- **Bourse** (Perso seulement) : cours Yahoo et CoinGecko via le relais. Elle compte une fois dans l'épargne.
- **Menu** : Foyer partagé, Personnes, Sauvegarder · Exporter en PDF, Réglages.
- **Scan d'un ticket** : ML Kit, puis `parseTicket`. L'appli compare les articles au total et propose les produits appris, chaque personne ayant les siens. « Copier la lecture » sert à déboguer un ticket mal lu.

---

## 5. Avancement : la semaine du 31/10

Fait et poussé le 01/11 :
1. **Factures** : modifier, supprimer (une facture ou tout un fournisseur, annulable), nombre de factures par fournisseur ; une facture gardée sans ses effets peut être mise dans les comptes (« Pas dans tes comptes · Ajouter »).
2. **Provisions reliées aux frais fixes, au Commun et aux comptes** : la mise de côté est un frais fixe « Provision · nom » (les anciens frais « Eau 20 € », « Amazon 6 € » sont reliés, pas doublés) ; une facture payée par une provision va dans le compte et sort de la provision en un seul geste, sans compter deux fois dans les parts du Commun.
3. **Provisions avec les factures prévues** : graphique « De côté » / « Avec les factures prévues », liste de ce qui manquera, « Passer à X € / mois » ; carte du fournisseur « prête pour mai · il restera 28 € ». Corrigé : un mois futur repartait de 0.
4. **Compte** : plus d'onglet Virements, « ＋ Ajouter » dans les Opérations ; reprendre des virements du mois d'avant (mois suivant, un mois, une période, chaque mois) ; passer un virement en frais fixe, avec « Frais commun ou perso ? » à choisir à chaque fois (rien de coché d'avance, l'appli le redemande si on oublie) ; « Prélevé sur » sans « Automatique ».
5. **Tests indépendants de la date** (`tests/horloge.py`).
6. **Accueil** : la petite carte « Compte · Épargne » n'est plus réduite dans un coin. Sa courbe était prise pour un anneau ; elle prend maintenant toute la largeur de la carte comme les barres de « Compte · Solde », montants au-dessus, mois en dessous, Bourse en pointillés, sans les petits points (`enrichMiniCharts` reconnaît les `polyline`). Test t97 complété.

Fait et poussé le 31/10 :
1. **Sans réseau** pour les deux éditions. L'APK Store est autonome ; la Perso garde une copie.
2. **Estimation saisonnière des factures** : profil du foyer appris sur 12 mois, sinon un coefficient de saison par type d'énergie.
3. **Réorganisation complète de la navigation, en 4 étapes** :
   - étape 1 : l'onglet Factures devient « À venir » ;
   - étape 2 : Compte en sous-onglets, avec la roue du compte ;
   - étape 3 : l'onglet Dépenses ;
   - étape 4 : finitions (menu allégé, Projection dans À venir, présentation des fonctions Plus au lieu des écrans verrouillés).
4. **Factures d'eau en photos**, d'après une vraie lecture envoyée par Benoît (3 factures, 6 photos) :
   - les factures prises d'un coup sont séparées ;
   - les dates mal lues par le téléphone sont réparées ;
   - le fournisseur écrit sur deux lignes est retrouvé ;
   - « site Internet » ne fait plus une facture internet.
5. **Écran de contrôle de plusieurs factures**, à sa demande : nombre de pages lues sur le nombre de photos, « LA PLUS RÉCENTE », contrôle des plus anciennes, « Reprendre » une photo illisible, rien d'enregistré avant « Appliquer ». Même écran pour plusieurs PDF.
6. **Accueil** : la page des petits graphiques (« 3 / 8 ») est gardée même quand l'appli se redessine au démarrage. **Commun** : Frais communs et Produits partagés se replient de la même façon en touchant leur titre, et le graphique reprend alors sa place ; « Modifier dans À venir » dans la liste des frais communs (01/11).

**À faire valider par Benoît sur son téléphone :**
- la nouvelle navigation, et les retours éventuels ;
- le mode avion avec les nouveaux APK :
  - Perso : l'ouvrir une fois avec le réseau, puis passer en mode avion ;
  - Store : l'appli repart vide, donc faire une sauvegarde avant et la restaurer après ;
- l'import de relevé avec ses exports BoursoBank (OFX, QIF, CSV) ;
- les factures d'eau en photo : réimporter ses 6 photos d'un coup, après avoir supprimé l'ancienne mauvaise facture si elle a été enregistrée ; en cas de souci, il enverra « Copier la lecture » ;
- les provisions reliées (01/11) : ses frais « Eau » et « Amazon » doivent être devenus « Provision · Eau » / « Provision · Amazon » sans doublon ; les autres provisions ont un frais à partir de novembre (sinon « Remplie par » → « Pas dans les frais fixes ») ; la facture Région Minière du 02/11 : « Ajouter » la met dans le compte et la retire de « Eau » ;
- les virements repris ou « chaque mois » (CAF, Sylvette…), et « Passer en frais fixe » (Claude ia…) ; pour MAAF RC SBPI, déjà passé en frais fixe avant le choix commun / perso : le remettre en « Commun » dans À venir › Frais fixes › Modifier › « Pour qui » ;
- la petite carte « Compte · Épargne » de l'Accueil.

**Tests automatiques** : les 25 tests de `tests/` passent (t96 : écran de contrôle des factures ; t97 : page gardée des petits graphiques ; t98 : modifier ou supprimer une facture ; t99 : mettre dans les comptes une facture gardée sans ses effets ; t100 : payer une facture avec une provision ; t101 : provisions reliées aux frais fixes, au Commun et aux comptes ; t102 : graphique des provisions avec les factures prévues ; t103 : reprendre des virements, virements « chaque mois » ; t104 : « Prélevé sur » d'un frais fixe ; t105 : passer un virement en frais fixe). t93 (foyer) attend parfois le relais local : en cas d'échec isolé, le relancer seul. La date du navigateur est fixée au 30/10/2026 par `tests/horloge.py`, car les données inventées sont en octobre 2026. Les tests sur de vraies données (relevés BoursoBank, factures EDF et d'eau, vrais tickets) sont restés hors du dépôt, qui est public. Pour un nouveau cas, écrire des données inventées qui reproduisent le problème.

---

## 6. Axes d'amélioration

### Prévus par Benoît (montrer une maquette avant de coder)
- **« Lire avec mon IA »** : sur un ticket scanné, un bouton envoie la photo et une consigne prête à l'emploi à l'IA déjà installée sur le téléphone (Claude, Gemini, ChatGPT…), par le menu de partage d'Android.
  - La consigne contient la liste des produits de l'utilisateur.
  - Elle demande une réponse dans un format fixe : `TICKET` / `enseigne | date | total` / une ligne `nom | prix | produit` par article / `FIN`.
  - La réponse est collée dans Tickets, qui remplit les articles et vérifie le total.
  - Deux niveaux : sans nouvel APK (partage et copier-coller), puis avec un nouvel APK (Tickets apparaît dans « Partager » de l'appli IA).
  - Cela s'ajoute à la lecture actuelle, sans la remplacer. Aucun coût pour nous, rien ne passe par notre relais.
- **Retrait au distributeur** scanné : le proposer comme argent liquide plutôt que comme dépense.
- **Lecture des tickets** : pour chaque ticket mal lu, demander la photo et « Copier la lecture », puis corriger `mlkitRows` et `parseTicket`.
- **Factures d'eau** : vérifier ce que ML Kit lit, quand Benoît enverra « Copier la lecture ».
- **Import de relevé** : pistes possibles.
  - Lire les fichiers Grisbi (`.gsb`, du XML).
  - Rapprocher un remboursement de l'achat correspondant.

### Avant la sortie sur le Play Store
- Paquet signé (AAB) avec une vraie clé, envoyé à la Play Console : à la main d'abord, puis depuis GitHub Actions.
- **Brancher l'achat de Tickets Plus**, qui n'est pas encore fait. Aujourd'hui `plusUnlocked` n'est qu'un drapeau local.
- QR code d'invitation lisible par l'appareil photo (lien Play Store et install referrer).
- Relais :
  - offre Workers Paid ;
  - WebSocket au lieu d'interroger régulièrement ;
  - protection contre les abus à la création de foyer ;
  - copies différentielles ;
  - domaine propre hébergé dans l'UE.

### À décider par Benoît (ne pas trancher seul)
- **Gratuit ou Plus, et prix de Plus.** Le 31/10, il a décidé :
  - gratuit : l'onglet À venir, avec 12 mois, Frais fixes et Provisions ;
  - dans Plus : les factures, leurs estimations, l'Analyse avancée, la projection, les widgets, et la création d'un foyer (le rejoindre reste gratuit) ;
  - reste à décider : l'import de relevé (gratuit pour l'instant).
- Nom définitif de l'appli et identifiant Store.
- Type de compte Google Play.
- Lecture des tickets par une IA en ligne : mise de côté le 28/10. Si elle revient, seulement en option Plus et avec l'accord de l'utilisateur.
- Lien direct avec la banque : mis de côté le 22/10. Pistes dans l'ordre : bouton « Ouvrir ma banque », import de relevé (fait), synchro DSP2 par un agrégateur payant (Plus seulement).

---

## 7. Comment travailler sur le projet

1. **Avant de modifier** : montrer une proposition ou une maquette. « Ne fais rien », « comment tu vois ça » ou « montre-moi » appellent un avis, pas une modification.
2. **Modifier** `beta/index.html`. La méthode qui marche bien : un script Python qui remplace un extrait exact, avec `assert s.count(old)==1`, en écrivant les vrais caractères Unicode.
3. **Vérifier la syntaxe** après chaque modification :
   ```
   node -e "const h=require('fs').readFileSync('beta/index.html','utf8');const m=h.match(/<script>\n  \(function\(\)\{[\s\S]*?<\/script>/);new Function(m[0].replace(/^<script>/,'').replace(/<\/script>$/,''));console.log('OK')"
   ```
4. **Mettre à jour l'étiquette de version** (heure de Paris) avant chaque commit :
   ```
   sed -i "s#<meta name=\"build\" content=\"[^\"]*\" />#<meta name=\"build\" content=\"$(TZ=Europe/Paris date +'%d/%m %H:%M')\" />#" beta/index.html
   ```
   Reporter cette étiquette dans `JOURNAL.md`, section « État actuel ».
5. **Tenir `JOURNAL.md` à jour dans le même commit** : une entrée datée en haut de l'Historique, plus Décisions, État actuel et En cours si nécessaire. Mettre aussi `CLAUDE.md` à jour si une notion technique change.
6. **Commit en français**, préfixé « β » quand il touche la β, poussé directement sur `main`. Le push met en ligne la β et la Perso, et recompile les deux APK.
7. **Tester** avec les tests de `tests/` (mode d'emploi dans `tests/README.md`) :
   - `sh tests/run.sh` lance les 25 tests ; `python3 tests/t95.py` en lance un seul ;
   - ce sont des scripts Playwright en Python : Chromium sans interface, écran de 412×900, données injectées dans localStorage, relais local (Node et `node:sqlite` sur `localhost:8787`) ;
   - aucune requête réseau extérieure pendant les tests ;
   - ajouter un test pour chaque nouvelle fonction, **toujours avec des données inventées**.

---

## 8. Pièges connus
- `state.avSub` est réservé à l'Analyse avancée. Les sous-onglets d'À venir utilisent `state.avnSub`.
- Pour les soldes, toujours passer par `fraisKind(f, compte)` et `fraisAcctAmt(f, compte, mois)`. Les parts du commun **ne changent pas** les soldes des comptes.
- Pour une provision, toujours passer par `provWhere(p)`. Si elle est déjà sur l'épargne ou le compte, ne pas la compter deux fois.
- La mise de côté d'une provision est un frais fixe relié (`f.prov`, `f.provFrom`) recalculé par `provFraisSync()` à chaque affichage : c'est la provision qui décide (nom, montant, mois sautés) ; ne pas modifier ces champs sur le frais, passer par la provision. Une facture payée par une provision : frais `f.pp`, hors parts du Commun et de l'Analyse (`fraisPartV`).
- Les virements « chaque mois » sont des séries (`virRec`, sur le téléphone du propriétaire) que `virRecSync()` transforme en vrais virements mois par mois ; un mois déjà créé n'est jamais recréé (`made`), même supprimé.
- « Prélevé sur » d'un frais : enregistrer par `acctPicked(r, qui)`, qui ne force pas le compte quand c'est celui par défaut.
- La Bourse compte une seule fois dans l'épargne, par la ligne automatique `bourseLink`.
- Le filtre par personne ne s'applique ni aux comptes, ni au Bilan, ni aux widgets.
- Le clavier Android met des espaces dans les montants : utiliser `num()`.
- Les montants affichés contiennent des espaces fines insécables (U+202F). Il faut en tenir compte dans les tests qui comparent du texte.
- Toute nouvelle connexion réseau doit être justifiée et avoir un repli sans réseau.

---

## 9. Données personnelles
- **Ne jamais mettre dans le dépôt** les vrais relevés bancaires, photos de tickets ou factures de Benoît. Le dépôt est public.
- Les tests et les maquettes utilisent des données inventées.
