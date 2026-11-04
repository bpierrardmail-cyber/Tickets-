# Tickets — plan à partir du 6 novembre 2026

*Rédigé le 04/11/2026 avec Benoît. `JOURNAL.md` fait foi pour l'avancement ; ce fichier garde le plan détaillé.*

On commence le 6 novembre par la sauvegarde sur Google Drive, puis le Plus partagé dans le foyer et les droits des membres dans les groupes, l'import du relevé en un geste et la monnaie de l'appli.

## Ordre des chantiers

Cinq étapes, chacune livrée et testée avant la suivante.

| Étape | Contenu | Gratuit / Plus | Nouvel APK | Durée estimée |
|---|---|---|---|---|
| 1 | Sauvegarde Drive : activation, clé, envoi appli fermée, conservation, alertes | ✦ Plus | Oui | 2 à 3 séances |
| 2 | Sauvegarde Drive : restaurer, annuler la restauration, vérifier, nouveau téléphone | ✦ Plus | Oui | 1 à 2 séances |
| 3 | Plus du propriétaire pour tout le foyer ; droits des membres dans les groupes | — | Non | 1 séance |
| 4 | Import du relevé en un geste (Partager depuis l'appli de la banque) | Gratuit | Oui (ouvrir un fichier partagé) | 1 séance |
| 5 | « Monnaie de l'appli », note sur le réseau et carte du relevé dans la présentation, guide | Gratuit | Non | 1 séance |

Une séance = une session de travail. L'étape 4 peut partir dans le même APK que les étapes 1 et 2.

La sauvegarde Drive est dans les **deux éditions**, Perso et Store (décidé le 04/11).

## Avant de commencer (Benoît)

### Google Cloud : autoriser l'appli à utiliser Google Drive

Gratuit, environ 20 minutes, guidé écran par écran. De préférence avec un compte Google dédié à l'appli (le même servira pour la console Play).

- [ ] Créer un projet « Tickets » sur console.cloud.google.com.
- [ ] Activer « Google Drive API ».
- [ ] Écran de consentement : nom « Tickets », adresse de contact, lien vers la politique de confidentialité sur bpierrard.fr, accès demandé `drive.file` seulement.
- [ ] Deux identifiants OAuth de type Android (un par édition), avec l'empreinte SHA-1 de la clé de signature des APK de test `39:71:91:8B:B4:6E:90:5D:1B:8F:CA:1C:FF:15:02:A7:D2:B3:78:D2` :
  - Perso : `fr.bpierrard.tickets.beta` ;
  - Store : `fr.bpierrard.tickets.store` (provisoire).
- [ ] Plus tard, à la sortie sur le Store : ajouter l'empreinte de la clé de Google Play, et le nom définitif de l'appli.

Sans ces identifiants, tout peut être préparé et testé avec un faux Drive, mais rien ne peut partir sur un vrai Drive.

### Le site bpierrard.fr

Aujourd'hui, il n'y a pas de site, seulement le domaine chez IONOS. Le site doit exister avant d'activer la connexion à Google, car l'écran de consentement demande le lien de la politique de confidentialité.

- Une petite page gratuite hébergée par **Cloudflare Pages** (usage commercial autorisé, même compte que le relais). Le DNS du domaine est confié à Cloudflare ; IONOS garde le nom de domaine.
- [ ] Claude prépare les pages : présentation, politique de confidentialité, conditions, mentions légales (brouillons dans `legal/`).
- [ ] Benoît, dans IONOS › Domaines : remplacer les serveurs DNS par ceux de Cloudflare (donnés au moment voulu) ; prise en compte en quelques heures.
- [ ] Une adresse de contact sur le domaine (redirection IONOS vers la boîte actuelle, si l'offre l'inclut).

## Étapes 1 et 2 : sauvegarde Google Drive

Maquette de l'étape 1 validée le 04/11 : artefact « Tickets — Sauvegarde Drive » (12 écrans).

L'utilisateur active la sauvegarde une fois ; ensuite elle part seule, chiffrée, sans photos, et l'appli ne touche qu'à ses propres fichiers.

### Étape 1 — activer et envoyer

1. Menu › Sauvegarder › « Sauvegarde sur Google Drive » (✦ Plus) : choix du compte Google, accès `drive.file`, dossier « Tickets – sauvegardes » créé par l'appli.
2. Clé :
   - si le dossier est vide, une seule clé est créée et gardée dans le téléphone (empreinte), puis affichée une fois en code de secours (« Copier », « J'ai noté le code ») ;
   - si le dossier a déjà des sauvegardes, le code est demandé et vérifié au lieu d'en créer une ;
   - propriétaire d'un foyer : même code que la récupération du foyer ;
   - code de secours au même format que le code de récupération du foyer (26 caractères) pour tout le monde (décidé le 04/11).
3. À chaque modification, le fichier chiffré est préparé sur le téléphone ; en quittant l'appli, Android l'envoie (WorkManager), même appli fermée, dès que le réseau est là (Wi-Fi ou données mobiles).
4. Conservation automatique : la dernière de chaque jour sur 30 jours, de chaque mois sur 12 mois, de chaque année sur 5 ans (durées modifiables). Seules les sauvegardes de l'appli sorties des durées sont supprimées ; jamais la plus récente, et rien si un envoi a échoué.
5. Désactiver arrête l'envoi sans rien supprimer ; réactiver reprend la même clé et le même dossier.
   Case « Wi-Fi seulement », décochée par défaut (décidé le 04/11).
6. Alertes :
   - « Dernière sauvegarde : aujourd'hui 09:12 » dans le menu ;
   - **dès qu'une modification n'est pas partie** (décidé le 04/11) : la ligne du menu passe en rouge tout de suite ; à la réouverture, un bandeau sur l'accueil (qu'on peut fermer) si l'envoi attend depuis plus d'1 heure ; un rappel après 24 h sans envoi, qui remplace le rappel « sauvegarde de plus de 7 jours » quand Drive est actif.
7. Membres d'un foyer : ils sauvegardent leur propre espace (« Mes comptes » et leurs changements pas encore envoyés).

### Étape 2 — restaurer et vérifier

1. « Vérifier » : lit la dernière sauvegarde en arrière-plan sans rien changer (« lisible : 312 tickets, 8 comptes… »).
2. « Restaurer » : liste des sauvegardes (date, nombre de tickets), choix d'une sauvegarde, confirmation.
3. Avant de restaurer, l'état actuel est gardé sur le téléphone ; « Annuler la restauration » le remet.
4. Nouveau téléphone : au premier démarrage, « Restaurer depuis Google Drive », compte Google, code de secours, choix de la sauvegarde. La clé est alors gardée dans ce téléphone.
5. Code perdu : « Repartir de zéro » crée une nouvelle clé, après un avertissement ; les anciennes sauvegardes restent sur Drive, illisibles, et ne sont jamais supprimées par l'appli.

**Tests** : faux Drive local (envoi, conservation, fichiers d'autres applis jamais touchés, panne de réseau, clé perdue), puis essai réel par Benoît sur son téléphone, appli fermée et en mode avion.

## Étapes 3 à 5

### Étape 3 — Plus pour tout le foyer, groupes

- Le Plus du propriétaire couvre les membres : groupes, qui doit combien à qui, factures, analyse avancée selon leurs onglets (les widgets restent par téléphone).
- Groupes : un membre avec Commun en « Modif. » ajoute, retire, rembourse et crée un groupe comme le propriétaire ; avec « Lecture », il voit le groupe sans le changer.
- Le ticket d'un autre membre peut être retiré du groupe, pas modifié.
- Test avec le relais local (propriétaire + 2 membres).

### Étape 4 — import du relevé en un geste

- Dans l'appli de la banque : relevé OFX, QIF ou CSV › Partager › Tickets.
- Tickets s'ouvre sur l'import, en demandant le compte si l'appli en a plusieurs ; la suite est l'import actuel.
- Android : Tickets s'inscrit comme destinataire de ces fichiers (dans le même APK que la sauvegarde).

### Étape 5 — monnaie et présentation

- Réglages : « Devise principale » devient « Monnaie de l'appli », avec « ne convertit pas les montants » ; proposée au premier démarrage.
- Note de la présentation : « *Sauf première connexion, transfert des tickets du foyer et sauvegarde sur Drive. »
- Carte du relevé : « depuis l'appli de ta banque : Partager › Tickets ».
- Carrousel Plus : la sauvegarde Drive et « un achat pour tout le foyer ».
- Guide, politique de confidentialité et journal mis à jour.

## Ensuite

- [ ] **Appli de démonstration** : un « Mode démo » avec un foyer inventé (tickets, comptes, frais, groupes, factures), séparé des vraies données, pour présenter l'appli sans rien montrer de perso ; on en sort d'un geste et les vraies données reviennent telles quelles. Aussi en lien web, pour une présentation sur ordinateur.
- [ ] **Présentation gratuit / Plus à revoir** : fiche du Play Store (texte, captures) et diapos du premier démarrage, avec les nouveautés (groupes, corbeille, rappels, sauvegarde Drive, un achat pour tout le foyer).
- [ ] **Guides de l'Aide à revoir** (propriétaire et membre), avec les corrections de Benoît.
- [ ] **Nouveau nom de l'appli : Copek** (choisi le 04/11), à confirmer après la vérification de la marque à l'INPI et des domaines copek.fr / copek.app ; identifiant Store prévu `fr.bpierrard.copek`. Pour mémoire : à choisir avant la première publication sur le Play Store, car l'identifiant Store (`fr.bpierrard.tickets.store`, provisoire) ne pourra plus changer ensuite. Vérifier qu'il est libre (Play Store, INPI, nom de domaine). Le changement touche les textes, l'icône, la présentation et les guides, pas les données.

### Nouvelles fonctions pour le foyer

Retenues après le tour des logiciels de comptabilité (gratuit ou Plus à décider) ; toutes marchent sans réseau.

1. **Aide à la déclaration d'impôts** : marquer des dépenses (dons, garde d'enfants, emploi à domicile, frais réels…) ; total de l'année par case de la déclaration, avec les justificatifs (photos des tickets et factures).
2. **Garanties** : sur un ticket ou un article, une durée de garantie ; liste « Sous garantie » avec la photo, rappel avant la fin.
3. **Bilan de l'année** : un rapport annuel (dépenses par catégorie, épargne, évolution, comparaison avec l'année d'avant), en PDF.
4. **Pointage du relevé** : sur chaque opération du compte, « vu sur la banque », et l'écart avec le solde de la banque.

## Points ouverts

- [x] Alerte de sauvegarde : **dès qu'une modification n'est pas envoyée** (et non au bout de 3 jours). Décidé le 04/11.
- [x] Sauvegarde Drive dans les deux éditions, Perso et Store. Décidé le 04/11.
- [ ] Prix de Plus (piste : 4,99 €/an ou 9,99 € à vie), sans urgence.
- [ ] Textes légaux à relire (`legal/`) et à mettre sur bpierrard.fr avant d'activer la connexion à Google. Le site est à créer : seul le domaine existe, chez IONOS.
