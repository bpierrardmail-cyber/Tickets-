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
| t94 | Compte en sous-onglets, roue du compte, graphiques touchables. |
| t95 | Onglet Dépenses (Tickets · Produits · Budgets · Analyse), menu allégé, projection dans À venir, Plus visible. |
| t96 | Factures d'eau en photos : 3 factures (recto et verso) prises d'un coup, avec les erreurs de lecture du téléphone ; la plus récente à vérifier, les autres dans l'historique, même dans le désordre. |

**À savoir**
- t76 contient deux vérifications qui dépendent de la date du jour (« Hier », « habituellement le 28 ») : elles peuvent échouer certains jours sans que l'appli soit en cause.
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
