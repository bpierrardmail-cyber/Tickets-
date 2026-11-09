# Tickets : dossier de passation

*État au 09/11/2026. Le fichier sert à reprendre le projet dans une autre conversation Claude.*

> **À Claude qui reprend le projet**
>
> 1. Lis d'abord ce fichier.
> 2. Lis ensuite `CLAUDE.md` puis `JOURNAL.md` dans le dépôt. Ils sont tenus à jour à chaque modification et font foi s'ils diffèrent de ce document.
> 3. Réponds à Benoît **en français**, court et concret.
> 4. **Ne modifie rien sans lui avoir montré la proposition**. Une maquette suffit. Il dit « tu peux intégrer » quand il est d'accord. « Ne fais rien », « comment tu vois ça », « montre-moi », « tu en penses quoi » appellent un avis ou une maquette, pas une modification.

---

## 1. Le projet en bref

**Tickets** (nom provisoire ; **Copek** retenu le 04/11, à confirmer) est une appli de suivi des dépenses d'un foyer, écrite par et pour Benoît Pierrard :
- tickets de caisse scannés et leurs articles, catégories en arbre, budgets ;
- comptes, opérations du mois, frais fixes, virements chaque mois, import de relevé ;
- commun entre les membres du foyer, qui doit combien à qui, groupes ponctuels ;
- épargne, provisions, factures (lecture et estimation) ;
- la Bourse (version Perso seulement).

Il l'utilise sur son téléphone Android, en **foyer partagé** avec sa femme Sylvette (elle a la version Store).

**Objectif** : une version sur le Play Store, gratuite, avec des fonctions payantes « Tickets Plus » (✦).

**Deux éditions, un seul code :**

| Édition | Identifiant | Pour qui | Bourse | Chargement | Mises à jour |
|---|---|---|---|---|---|
| **Perso** | `fr.bpierrard.budget.perso` | Benoît | oui | charge la β en ligne et en garde une copie pour marcher sans réseau | à chaque push |
| **Store** | `fr.bpierrard.budget` (définitif) | public | non | l'appli entière est dans l'APK, aucune connexion pour l'usage normal | par le Play Store |

**Exigences permanentes :**
- marcher sans bug pour une grande famille (10 personnes et plus, plus de 10 comptes, affichage lisible) ;
- rien à configurer ; aucune source de données payante ;
- **marcher sans réseau** (seuls le foyer partagé, l'achat de Plus, la sauvegarde Drive et la Bourse utilisent le réseau) ;
- le relais ne doit **jamais** pouvoir lire les données du foyer (chiffrées sur le téléphone) ;
- sécurité au maximum : « tout ce qui a été remonté, même mineur, doit être corrigé » (08/11).

---

## 2. Liens

| Quoi | Lien |
|---|---|
| Dépôt GitHub (public) | https://github.com/bpierrardmail-cyber/Tickets- |
| **Appli β (web)** | https://bpierrardmail-cyber.github.io/Tickets-/beta/ |
| β, version Store dans un navigateur | https://bpierrardmail-cyber.github.io/Tickets-/beta/?edition=store |
| β en mode démo (foyer inventé) | https://bpierrardmail-cyber.github.io/Tickets-/beta/?demo |
| **APK Perso** | https://github.com/bpierrardmail-cyber/Tickets-/releases/download/apk-beta/Tickets-perso.apk |
| **APK Store** | https://github.com/bpierrardmail-cyber/Tickets-/releases/download/apk-beta/Tickets-store.apk |
| `CLAUDE.md` / `JOURNAL.md` (texte brut) | https://raw.githubusercontent.com/bpierrardmail-cyber/Tickets-/main/CLAUDE.md · …/JOURNAL.md |

**Accès au dépôt** : avec Claude Code, relier le compte GitHub `bpierrardmail-cyber` (ou un collaborateur avec droit d'écriture) ; Claude peut alors committer et pousser sur `main`. En simple conversation, les liens bruts suffisent pour lire.

**Comptes externes (seul Benoît y a accès)** : GitHub (Pages, Actions, secrets de signature ; validation en deux étapes, branche `main` protégée contre la suppression et le force-push), Cloudflare (Worker `tickets`, redéployé à chaque push), Google Cloud (projet `app-budget-sbpi`, accès Drive). **La clé de signature et son mot de passe ne sont que dans les secrets GitHub et chez Benoît** : jamais dans le dépôt ni dans une conversation.

Les maquettes et la page « Tickets · À faire » sont des artefacts claude.ai de Benoît.

---

## 3. Architecture

| Chemin | Rôle |
|---|---|
| `beta/index.html` | **L'appli** (≈ 14 000 lignes) : HTML, CSS et JS dans un seul fichier. On travaille **uniquement ici**. |
| `index.html`, `sw.js`, `manifest.webmanifest` | Racine : renvoi vers la β + service worker (réseau d'abord) pour le navigateur. |
| `relais/cours-worker.js`, `relais/foyer.js` | Worker Cloudflare : cours, inflation INSEE, foyer partagé (un Durable Object SQLite par foyer), limites par adresse. |
| `outils/csp.py` | Met à jour l'**empreinte du script dans la CSP** (obligatoire après toute modification du script, sinon l'appli ne démarre plus). |
| `app-android/` | Appli Capacitor 7 ; code natif dans `native/` (ML Kit, scanner de documents, widgets, Drive, rappels, copie hors ligne). |
| `.github/workflows/apk-beta.yml` | Compile les deux APK sans clé, puis les signe dans un job à part (secrets `TK_KEYSTORE_B64` / `TK_KEYSTORE_PASS`). |
| `tests/` | ≈ 75 tests Playwright (Python), données inventées, relais local. |
| `guide/` | Guide du propriétaire et du membre (`*.md`) ; `python3 guide/maj.py` les met dans l'appli. |
| `PLAN.md`, `legal/` | Plan des chantiers ; textes légaux à relire. |

**Code** : ES5 uniquement (`var`, `function`), un seul `<script>` (IIFE) ; sections `// ---------- Titre ----------` ; `store.read/write` (jamais `localStorage` direct), `num()` pour lire un montant, `esc()` pour tout texte inséré en HTML. Détails : `CLAUDE.md`.

**Sécurité (revue du 08/11, tout corrigé)** : CSP par empreinte, `Object.prototype` figé, contrôle de tout ce qui vient d'un autre téléphone, d'une sauvegarde ou d'un fichier (`fyPathOk`, `phSafe`, `fyAllowed`), code du téléphone en PBKDF2, écran privé, sauvegarde fichier chiffrée au choix, relais limité et sans lecture possible.

**Foyer partagé** : le téléphone du propriétaire a tout et publie pour chaque membre une copie chiffrée filtrée par ses droits (onglet par onglet : Masqué / Lecture / Modif.) ; un membre envoie ses changements, le propriétaire les contrôle et les fusionne. Invitation par QR code ; code et empreinte conseillés, choisis par chaque téléphone. Le foyer est dans la sauvegarde (Drive ou fichier), pas sur le relais.

---

## 4. Ce que fait l'appli (09/11)

**Barre du bas** : Accueil · Opérations · Budget · À venir · Foyer (+ Bourse en Perso), un seul bouton **＋** (scanner, saisir, virement, frais fixe, importer un relevé). Chaque onglet a ses sous-onglets en boutons. ✦ = Plus : la fonction reste visible, seul le bouton demande Plus.

- **Accueil = Résumé** (le tableau de bord à graphiques est retiré le 09/11) :
  - propriétaire : « Il te reste … jusqu'au 31 », alertes (budget, découvert, prélèvement proche), dernières opérations, ligne Foyer ;
  - membre : sa part du commun (ou ses tickets s'il n'a pas de part), qui doit quoi, cases Mon compte · Fin du mois · Mes tickets selon ses droits, prochaines dépenses communes avec sa part, ses derniers tickets.
- **Opérations** : Opérations (le mois comme un relevé, « À venir » à cocher, recherche, roue du compte : modifier, solde reporté, import de relevé OFX/QIF/CSV, annuler l'import) · Tickets (liste du mois, galerie, corbeille) · Épargne · Graphiques.
- **Budget** : Budgets · Analyse (✦ Analyse avancée) · Produits.
- **À venir** : 12 mois (✦ projection) · Frais fixes · Provisions · Factures ✦ (import PDF ou photos, estimation saisonnière, factures payées par une provision).
- **Foyer** : parts du commun, frais communs, produits partagés, ✦ qui doit combien à qui, ✦ groupes ponctuels.
- **Menu (☰)**, page à 4 sous-onglets avec recherche « Chercher un réglage… » :
  - **Gérer** : ligne « Créer » (＋ Compte, Frais fixe, Provision, Livret, Catégorie, Virement mensuel, Personne) qui n'ouvre **que** le formulaire, en plein écran ; chaque ligne ouvre sa page de gestion (liste complète, « ＋ Nouveau », toucher pour modifier) : comptes, épargne, frais fixes, virements chaque mois, provisions, catégories ; et budgets, personnes, produits, factures, foyer, groupes, corbeille ;
  - **Sauvegarde** : état, Google Drive (gratuit, automatique, chiffré), sauvegarde complète ZIP ou données seules, restaurer, **code de secours**, stockage, export PDF ou tableur ;
  - **Réglages** : affichage simple / détaillé, monnaie, code et empreinte, écran privé, rappels, widgets, mode démo ;
  - **Aide** : guide (propriétaire / membre), revoir l'accueil, Tickets Plus, à propos.
- **Icônes sans couleur** (09/11) : tous les emojis de l'interface sont dessinés au trait, couleur du texte (`icoMono`).
- **Fiche d'un ticket** : scan par ML Kit (scanner de documents Google), articles comparés au total, produits appris par personne, catégorie obligatoire en tuiles, ticket sans article annoncé, partage « Qui paie ce ticket ? », retrait d'espèces reconnu.
- **Android** : marche sans réseau, widgets masqués par défaut (empreinte pour voir), rappels locaux, sauvegarde Drive en arrière-plan, relevé partagé depuis l'appli de la banque.

---

## 5. En cours / à faire

- **Tests à faire par Benoît sur son téléphone** : chapitre 1 de la page « Tickets · À faire » (claude.ai). À y ajouter : le nouveau menu (Gérer, création directe), les icônes sans couleur, l'Accueil sans tableau de bord (le sien et celui de Sylvette).
- **Améliorations notées** :
  - widget Bourse en économie d'énergie : afficher « mise à jour en pause » au lieu d'une vieille heure ;
  - « Lire avec mon IA » (photo + consigne envoyées à l'IA du téléphone par le partage Android, réponse collée dans Tickets) ;
  - Benoît a une autre liste d'améliorations à donner.
- **Avant la sortie Store** : brancher l'achat de Plus (Play Billing, aujourd'hui un drapeau local) ; paquet AAB signé ; écran Licences et « Source : INSEE » ; suppression du foyer ; politique de confidentialité et fiche « Sécurité des données » ; QR code lisible par l'appareil photo ; **domaine propre en Europe** (nom définitif) pour l'appli et le relais.
- **Comptes** : validation en deux étapes Google possible à partir du 15/11 (Benoît).

**À décider par Benoît (ne pas trancher seul)** : répartition gratuit / Plus et prix (piste 4,99 €/an ou 9,99 € à vie) ; nom définitif (Copek, à vérifier INPI et domaines) ; type de compte Google Play ; lecture des tickets par une IA en ligne (mise de côté) ; lien direct avec la banque (mis de côté).

---

## 6. Comment travailler sur le projet

1. **Montrer une maquette** avant de modifier (artefact HTML, thème sombre de l'appli).
2. **Modifier** `beta/index.html` par un script Python qui remplace un extrait exact (`assert s.count(old)==1`), avec les vrais caractères Unicode.
3. **Vérifier la syntaxe** :
   ```
   node -e "const h=require('fs').readFileSync('beta/index.html','utf8');const m=h.match(/<script>\n  \(function\(\)\{[\s\S]*?<\/script>/);new Function(m[0].replace(/^<script>/,'').replace(/<\/script>$/,''));console.log('OK')"
   ```
4. **Avant chaque commit** :
   ```
   sed -i "s#<meta name=\"build\" content=\"[^\"]*\" />#<meta name=\"build\" content=\"$(TZ=Europe/Paris date +'%d/%m %H:%M')\" />#" beta/index.html
   python3 outils/csp.py && python3 outils/csp.py --check
   ```
   (après `python3 guide/maj.py` aussi : il modifie le script).
5. **`JOURNAL.md`** (entrée datée en haut de l'Historique, Décisions, État actuel, En cours) et **`CLAUDE.md`** si une notion technique change, **dans le même commit**.
6. **Commit en français**, préfixé « β », poussé sur `main` (met en ligne la β et la Perso, recompile les APK en ~4 min).
7. **Tester** : `sh tests/run.sh` (≈ 45 min, tout), `sh tests/run.sh t132 t156` (quelques-uns). Le relais local se lance seul. Date du navigateur fixée au 30/10/2026 (`tests/horloge.py`). Un nouveau test pour chaque fonction, **avec des données inventées**.

---

## 7. Pièges connus

- Oublier `python3 outils/csp.py` : l'appli affiche « ne démarre pas ».
- `fitTexts`, `render()` et d'autres appels sont protégés par `try…catch` : une fonction supprimée par erreur ne lève pas d'erreur visible ; vérifier avec `grep` qu'aucun appel ne reste.
- Les icônes au trait remplacent les emojis après coup dans le DOM ; l'emoji reste dans `.ico-t` (les tests qui cherchent « 📅 … » marchent toujours). Un nouvel emoji : lui ajouter un dessin dans `EMO_ICO`.
- Soldes : toujours `fraisKind(f, compte)` et `fraisAcctAmt(f, compte, mois)` ; les parts du commun **ne changent pas** les soldes.
- Provisions : `provWhere(p)` ; la mise de côté est un frais relié (`f.prov`) recalculé par `provFraisSync()` : passer par la provision.
- Virements « chaque mois » : séries `virRec` transformées par `virRecSync()` ; un mois déjà créé n'est jamais recréé.
- Catégories : toujours `catIn` / `catRoll` pour comparer à un budget ou un filtre.
- Montants affichés avec des espaces fines insécables (U+202F) : en tenir compte dans les tests.
- Toute nouvelle connexion réseau : l'ajouter à la CSP, la justifier, prévoir un repli sans réseau, la couper en mode démo.

---

## 8. Données personnelles

- **Jamais dans le dépôt** (public) : vrais relevés, tickets, factures, sauvegardes, clé de signature, adresse mail de Benoît.
- Tests et maquettes avec des données inventées. Une vraie sauvegarde ne se lit qu'en lecture seule (`python3 -I`), sans la recopier.
