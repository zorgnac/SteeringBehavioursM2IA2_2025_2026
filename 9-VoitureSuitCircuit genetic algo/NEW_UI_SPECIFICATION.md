# Tâche 1 — Spécification de la nouvelle interface

**Projet :** version Bruno Vasselle de « Voiture suit circuit — algorithme génétique »  
**Branche :** `MichelUI`  
**Date :** 15 octobre 2026  
**Statut :** proposition révisée après une seconde revue, avant implémentation  
**Révision :** 2 — cycle de vie, neutralité de l’inspection, résultats et cas limites précisés  
**Référence :** [ANALYSE.md](ANALYSE.md)

La tâche 1 produit ce document uniquement. Les comportements décrits au futur sont des fonctionnalités proposées ; ils ne sont pas encore implémentés. Aucun code ni réglage de simulation n'est modifié dans cette tâche.

## 1. Objectif

Permettre à un enseignant ou un étudiant de choisir une expérience, comprendre ce qui s'exécute, inspecter les voitures et conserver les résultats **sans modifier de JavaScript ni utiliser la console**.

La vue principale doit répondre immédiatement à quatre questions :

- Quelle expérience est active ?
- Les cerveaux sont-ils conservés, mutés ou entraînés par imitation ?
- Pourquoi la simulation roule-t-elle, attend-elle ou s'est-elle arrêtée ?
- Comment observer, sauvegarder ou changer d'expérience ?

L'interface sera en français, avec le nom technique des paramètres disponible dans l'aide. Le titre conservera l'attribution à Bruno Vasselle. Les réglages avancés seront dans une fenêtre « Réglages avancés » ; une option de débogage rendra accessibles les commandes de manipulation historique.

## 2. Principes de conception

1. **Une expérience explicite.** Remplacer les combinaisons de cases ambiguës par un scénario nommé et un résumé de ses effets.
2. **Un démarrage maîtrisé.** Préparer l'expérience en pause, puis la lancer avec un bouton clair. Changer de scénario ne lance pas immédiatement une nouvelle simulation.
3. **Des réglages effectifs visibles.** Distinguer effectif importé, quota cible et nombre de voitures réellement en course ; distinguer valeurs d'une sauvegarde et valeurs par défaut.
4. **Une aide au bon endroit.** Libellé concret, tooltip explicatif et détails facultatifs. Un blocage doit rester visible sans survol.
5. **Des états fidèles au moteur.** Une qualification autorisant les mutations ne sera jamais présentée comme une évaluation à population fixe.
6. **Une piste lisible.** Le circuit occupe la majorité de l'écran ; tableaux et cerveau sont accessibles dans un panneau latéral.
7. **Des échanges de fichiers simples.** Import local par sélection de fichiers et export nommé, sans déplacement obligatoire vers assets/.
8. **Le modèle de mouvement est conservé.** `vehicle.js` reste immutable ; aucun déplacement ni comportement de steering ne sera remplacé par l'interface.

## 3. Organisation de l'écran

### Vue principale sur ordinateur

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Voitures autonomes · Bruno Vasselle                         Aide        │
│ Expérience : Observer des cerveaux entraînés     [Changer d'expérience] │
├────────────────────────────────────────────────────────────────────────┤
│ [Démarrer / Pause] [Un pas]  Simulation : 2 pas/image  [Sauvegarder ▾]   │
│ [Réglages avancés]  État : prêt · cerveaux fixes · 2 voitures            │
├──────────────────────────────────────────────┬─────────────────────────┤
│                                              │ Course | Voiture        │
│                 CIRCUIT                      │ Circuits | Journal      │
│                                              │                         │
│                                              │ Contenu de l'onglet      │
│                                              │ sélectionné              │
├──────────────────────────────────────────────┴─────────────────────────┤
│ Circuit 3 · Course 5 · Génération 2 · En piste 8 · Garage 22 · Échecs 4  │
│ Message : qualification terminée, simulation en pause. [Voir le bilan] │
└────────────────────────────────────────────────────────────────────────┘
```

Le schéma indique la hiérarchie, pas des dimensions définitives. La barre de commandes reste courte et les états sont décrits avec du texte, pas seulement une couleur.

### Adaptation aux tailles d'écran

- Grand écran : canvas et panneau latéral ; panneau repliable pour privilégier la piste.
- Écran étroit : panneau sous la piste, commandes sur plusieurs lignes, tableaux avec défilement local.
- Éviter la largeur fixe de 1500 px et les positionnements absolus actuels.
- Conserver au départ les coordonnées de simulation 1200 × 800 ; adapter la présentation sans changer la géométrie des circuits ni la physique. La sélection doit convertir correctement les coordonnées du pointeur si le canvas est redimensionné visuellement.
- Les raccourcis clavier restent facultatifs : toutes les actions ont un bouton accessible.

## 4. Choix d'une expérience

Le bouton « Changer d'expérience » ouvre un panneau de préparation : cartes de scénarios, description courte, ressources nécessaires, réglages essentiels et résumé final. Le scénario proposé à la première ouverture est **Observer des cerveaux entraînés**.

Deux actions terminent cette préparation : « Annuler » et « Préparer l'expérience ». Préparer remplace la session après confirmation si elle contient un travail non exporté, puis laisse la nouvelle session en pause. La confirmation propose « Exporter puis préparer », « Préparer sans exporter » et « Annuler ».

Le changement d'un champ dans ce panneau ne touche pas à la simulation en cours. Un indicateur « Modifications non appliquées » apparaît. Une fois la session préparée, son résumé indique les sources effectivement chargées et les réglages retenus.

### Scénarios proposés

| Scénario | Objectif | Configuration proposée | Informations visibles |
|---|---|---|---|
| **Observer des cerveaux entraînés** | Comprendre les décisions des deux voitures livrées. | `car-simple-1`, deux voitures, aucune reproduction ni apprentissage supervisé. Circuits générés ou circuit choisi. | « Cerveaux fixes », source, capteurs, voiture sélectionnée. Les échecs ne déclenchent pas de remplacement. |
| **Entraîner par évolution** | Faire émerger une conduite à partir de poids aléatoires. | Graine `seed-c`, quota 30, difficulté initiale proposée 1,5, reproduction active, conservation des réussites, même circuit jusqu'au quota. | État d'apprentissage, effectif initial et quota, nouvelles voitures, réussites et qualifications. |
| **Reprendre une évolution** | Continuer à partir de cerveaux sauvegardés. | Import d'une génération ou d'une voiture, lot de circuits facultatif, quota explicitement choisi, reproduction active. | Nombre importé, nombre retenu, quota demandé, historique repris ou réinitialisé. |
| **Apprendre avec un maître** | Entraîner un élève à imiter une voiture compétente. | Maître choisi parmi les voitures de `car-simple-1` ou importées, élève `seed-c` ou graine importée ; purge désactivée. | Noms du maître et de l'élève, collecte, nombre d'observations, entraînement TensorFlow, loss, démos. |
| **Évaluer des cerveaux fixes** | Mesurer le comportement sur un lot choisi sans reproduction. | Population importée ou livrée ; circuits fournis/importés ; `FROZEN`, aucun apprentissage ; nouvelle mesure par défaut. | Taille du lot, résultats réels, échecs, résultats mémorisés si l'option de réutilisation est choisie. |
| **Améliorer la vitesse avec un balai** | Faire évoluer une population déjà compétente sous une contrainte de progression. | Population et voiture de référence choisies explicitement, reproduction active, balai configuré par identité. | Référence active, éliminations pour lenteur et moment d'application. |

### Détails indispensables par scénario

**Observation.** Ce scénario sera distinct du démarrage historique, qui peut produire des mutations. Il faudra un pilotage de session qui permette de revoir les mêmes cerveaux sur d'autres circuits après une course, sans laisser le chemin FROZEN s'arrêter sur un faible effectif. Une voiture échouée reste disponible dans la population source pour une autre course. Ses échecs restent visibles dans le bilan.

**Évolution depuis zéro.** Afficher « Première course : 1 graine ; quota cible : 30 » si l'on conserve le démarrage de seed-c. Ne pas annoncer 30 voitures en course dès la première image. L'utilisateur peut choisir une autre taille de population ; une éventuelle initialisation immédiate à N voitures serait une évolution séparée à spécifier, pas un effet implicite du formulaire.

**Reprise.** Le quota est un champ visible, prérempli depuis le fichier s'il existe, sinon depuis le nombre de voitures importées. Un bouton « Utiliser un quota de 30 » facilite la poursuite sans masquer la décision. Si le fichier contient plus de voitures que le quota, annoncer le surplus et sa gestion au garage.

**Maître/élève.** Les listes déroulantes montrent les noms réellement présents. Une référence introuvable bloque la préparation ; aucun remplacement silencieux par le premier maître. Vérifier les limites physiques et la disponibilité d'un cerveau. En cas d'échec du maître, afficher une action « Recommencer la course » ou « Choisir un autre maître ». Sous 32 observations, ne pas lancer un fit de zéro epoch : indiquer le nombre manquant et proposer une nouvelle collecte. Les boutons de changement de session sont désactivés pendant un fit non annulable ; la pause physique n'est pas présentée comme une annulation de TensorFlow.

**Évaluation.** Le lot de circuits doit être non vide. Le lot par défaut peut utiliser `trk-simple-1`, en indiquant clairement qu'il ne contient qu'un circuit. Pour une nouvelle mesure, vider l'historique de réussite sur des copies des véhicules importés, jamais sur les fichiers sources. Évaluer chaque cerveau source sur chaque circuit choisi, même s'il a échoué sur le précédent. Le contrôleur réinitialise les voitures au départ avec les méthodes existantes, conserve leurs poids et termine proprement sur zéro survivant. Il ne se contente pas de cocher l'ancien Test avec FROZEN. Afficher séparément les résultats du lot courant et les anciens historiques. Ne pas promettre une mesure de généralisation si les circuits ont servi à l'entraînement.

**Balai.** Préparer une référence depuis la sélection UI ou la liste des voitures. Indiquer que l'implémentation actuelle élimine selon la progression et l'ordre de la liste au passage de chaque tour. Ne pas présenter cela comme une garantie de vitesse minimale en km/h. Ce scénario ne permettra pas l'activation simultanée du mode supervisé ou d'une évaluation fixe.

### Qualification pendant une évolution

La qualification sur les circuits difficiles devient une action secondaire « Qualifier la population », avec l'aide « Des descendants peuvent être créés pour obtenir le quota de voitures qualifiées ». Elle appartient aux scénarios d'évolution et de balai.

Elle montre le lot complet ou partiel, le quota visé et la progression. Si aucun circuit difficile n'est connu, l'action est désactivée avec « Aucun circuit difficile disponible ». Le réglage « Qualifications automatiques » reste accessible en avancé ; son état effectif figure dans le résumé de session.

## 5. Commandes courantes et états

| Commande proposée | Comportement attendu |
|---|---|
| **Démarrer / Pause / Reprendre** | Vraie pause immédiate de la physique ; restauration du nombre de pas précédent à la reprise. L'UI reste interactive en pause. |
| **Un pas** | Un seul pas physique, puis pause ; accessible lorsque la simulation est en pause et hors fit. |
| **Simulation : N pas/image** | Valeur numérique accompagnée d'un curseur ; contrôle du débit de simulation, pas de la vitesse des voitures. La pause a son propre bouton. |
| **Sauvegarder** | Export de la session utile au scénario ; menu pour choisir population, voiture, circuits, démos ou configuration. |
| **Changer d'expérience** | Ouvre la préparation ; ne modifie rien avant validation. |
| **Réglages avancés** | Ouvre la fenêtre décrite en section 7. |

Les transitions seront explicites : **Prêt**, **En course**, **En pause**, **Collecte maître/élève**, **Entraînement du réseau**, **Qualification**, **Évaluation terminée**, **Erreur**. La pause et la phase sont deux informations distinctes : « Qualification · en pause » reste possible.

La cadence d'affichage reste positive ; la pause ne repose plus sur Rate=0. « Pause après chaque course » et « Pause après qualification » deviennent des préférences nommées, distinctes du bouton Pause.

Le bouton historique Track devient « Autre circuit » dans une action secondaire disponible pour l'observation et l'exploration. Durant une qualification ou une évaluation, il propose d'interrompre la campagne ; il ne saute pas silencieusement un cas mesuré.

## 6. Panneau d'inspection

### Onglet Course

- Compteurs séparés : en piste, arrivées, échecs de la course, garage et quota.
- Tableau avec nom, progression, tours, état et vitesse ; tri explicite et liste complète avec défilement.
- Génération et compteur de courses présentés séparément.
- Qualification : indiquer le lot concerné, par exemple « 8 voitures validées sur 3 circuits de cette session ».
- Si le lot est vide, afficher « Aucun circuit de validation » au lieu d'un nombre de vétérans qui semblerait prouver une compétence.
- Pour une campagne d'évaluation : nombre de paires voiture/circuit achevées sur le total ; résumé des succès et échecs, avec nombre de tours demandé.

### Onglet Voiture

Accessible par clic sur une voiture ou une ligne. Une invitation « Sélectionnez une voiture pour inspecter ses capteurs et son cerveau » remplace les panneaux vides.

Afficher le nom, la source/version, les dimensions du réseau, l'activation, le nombre de paramètres, la symétrie active, les capteurs et limites effectifs. Ajouter une légende au dessin du réseau : poids, biais, entrées et sorties. Les deux sorties sont nommées « Direction souhaitée » et « Vitesse souhaitée ».

Les valeurs de capteurs et prédictions se rafraîchissent à une cadence modérée lorsque l'onglet est visible. La représentation lourde des poids est mise à jour à la sélection ou au changement de cerveau, pas inutilement à chaque pas. Prévoir les états de réseau absent, voiture retirée et voiture au garage.

Actions contextuelles : « Exporter cette voiture », « Utiliser comme maître » et « Utiliser comme balai ». Les deux dernières ouvrent la préparation du scénario correspondant, sans transformer la session immédiatement.

### Onglet Circuits

Remplacer l'intitulé « tueurs » par **Circuits difficiles**, avec explication du terme historique dans l'aide. Indiquer nom, tours, difficulté enregistrée, échecs comptés et réussites mémorisées. Le compteur historique kills n'est pas présenté comme un taux d'échec de toutes les voitures.

Permettre import, export et sélection en observation. Distinguer circuits générés, circuit fourni et circuits archivés. Le nombre de circuits réellement inclus dans une qualification reste affiché.

### Onglet Journal

Messages courts datés : préparation, chargement, course terminée, nouvelle génération, circuit archivé, qualification terminée, export proposé et erreur. Éviter un message par pas ou par prédiction.

Un message décrit la cause et l'action possible : « Aucune voiture n'a terminé. Évaluation terminée sur ce circuit » ; « Maître introuvable : sélectionnez une voiture disponible ». Un bilan exportable est accessible après les campagnes. L'interface n'affirme pas que le navigateur a écrit un fichier sur disque si elle a seulement déclenché un téléchargement.

## 7. Fenêtre « Réglages avancés »

Fenêtre modale avec onglets ou sections, valeurs courantes, aide et actions **Annuler**, **Rétablir les valeurs du scénario**, **Appliquer**. Si un redémarrage est nécessaire, l'action devient **Préparer une nouvelle session** et affiche les changements avant validation.

Chaque paramètre porte une indication de prise d'effet : **immédiatement**, **prochaine course** ou **nouvelle session**. Une valeur en attente ne remplace pas la valeur effective dans les indicateurs.

| Groupe | Réglages exposés | Prise d'effet proposée |
|---|---|---|
| Affichage et pauses | Cadence positive, pause après course/qualification, inspection des capteurs. | Immédiate, sans changement physique. |
| Circuit généré | Sinuosité TRICKY, nombre de checkpoints LENGTH, demi-largeurs minimale/maximale WIDTH, tours LAPS. | Prochaine course générée ; nouveau circuit avec nouvelle identité. Les circuits importés gardent leur géométrie et leurs tours sauf transformation explicite en copie. |
| Population | Quota cible TOTAL, conserver le circuit jusqu'au quota FINISHED, qualification automatique. | Nouvelle session pour éviter un changement de sélection au milieu d'une course. |
| Qualification | Lot complet ou partiel MAX_TRACKS, seuil MIN_ELDERS, inclure les anciens FULL, passes PASSES. | Prochaine campagne, uniquement avant son lancement. |
| Graine de voiture | Délai sans checkpoint LIFESPAN, portée, span et nombre de rayons dérivé, angle, force, limite de vitesse, marge safe. | Nouvelle session avec nouvelle graine ; les voitures importées conservent leurs caractéristiques. |
| Réseau de la graine | Couches cachées, activation, symétrie, side-direct/direct, ahead et channels pris en charge. | Nouvelle graine ; toute modification de dimensions crée un nouveau cerveau. |
| Évolution | Taux et amplitude de mutation, poids de vitesse dans la fitness. | Nouvelle session ; afficher l'influence de beta sur les mutations. |
| Archives | Sauvegarde sur événement, contenu du bilan et préfixe des exports. | Immédiate pour les exports suivants. |
| Débogage | Terminer artificiellement, éliminer les voitures, purge, inspection technique. | Actions explicites, désactivées en évaluation mesurée. |

### Règles de validation

- Refuser les champs vides requis, nombres non finis, quotas/tours/checkpoints non entiers ou valeurs incompatibles avec le moteur.
- Largeur minimale positive et inférieure ou égale à la maximale ; contrôle du nombre de rayons et dimensions de réseau cohérentes avec les options de capteurs.
- Les champs documentent leurs unités : pixels, pas physiques, ratio ou nombre d'individus. Pour LIFESPAN, afficher aussi le seuil effectif calculé avec le nombre de checkpoints ; ne pas le présenter comme une durée en secondes.
- La limite de vitesse propose « Sans plafond explicite » plutôt que de demander de saisir un zéro ambigu ; expliquer le rôle distinct de REF_SPEED et de l'activation de sortie.
- Une activation ReLU n'est pas décrite comme une sortie bornée entre 0 et 1.
- Les options `direct` et `side-direct` sont proposées comme choix exclusifs. Les combinaisons de capteurs non cohérentes avec la symétrie ou les dimensions sont bloquées, pas corrigées silencieusement.
- Une architecture importée s'inspecte en lecture seule. Pour la changer, l'utilisateur choisit explicitement « Créer une nouvelle graine », avec des poids réinitialisés.
- Les courbes de beta restent consultables mais leur édition détaillée est reportée : l'anomalie de computeRatio dans `vehicle.js` doit être traitée dans un travail distinct avant de promettre un éditeur fidèle. Aucun contournement par duplication ou override de cette méthode.

Les diagnostics techniques figurent dans cette fenêtre et l'aide détaillée. La vue courante indique seulement ce qui aide à conduire l'expérience.

## 8. Tooltips et aide

Utiliser une aide visible au survol **et au focus clavier**, avec une icône d'information activable au clic pour les explications plus longues. Les tooltips ne contiennent pas de commandes essentielles et ne sont pas le seul moyen d'expliquer une erreur. Éviter de dépendre uniquement de l'attribut HTML title.

Exemples de textes prévus :

| Élément | Texte d'aide |
|---|---|
| Pas par image | « Nombre de mises à jour physiques par image. Augmenter cette valeur accélère les essais sans changer les limites de vitesse des voitures. » |
| Cadence d'affichage | « Nombre d'images demandé par seconde. Le débit réel dépend de votre ordinateur. » |
| Quota cible | « Nombre de voitures réussies recherché par l'évolution. Il peut différer du nombre importé et du nombre actuellement en piste. » |
| Qualification | « Rejoue des circuits difficiles pour obtenir une population qualifiée. La reproduction peut rester active. » |
| Population fixe | « Les poids des cerveaux sont conservés et aucun descendant n'est créé pendant cette évaluation. » |
| Réutiliser les réussites | « Une voiture déjà validée peut éviter un nouveau passage. Désactivez cette option pour mesurer à nouveau son comportement. » |
| Sinuosité | « Modifie les variations du circuit généré. Cette valeur n'est pas une mesure calibrée de difficulté. » |
| Loss | « Écart entre les sorties de l'élève et celles du maître sur les observations collectées. Une faible valeur ne garantit pas une conduite autonome réussie. » |
| Balai | « Au passage d'un tour de la référence, les voitures placées derrière elle dans la liste de progression peuvent être éliminées. » |
| Exporter | « Télécharge des fichiers sur votre ordinateur. Les positions en course et l'état de l'optimiseur ne sont pas repris à l'identique. » |

L'aide générale propose un parcours en cinq étapes : choisir une expérience, préparer, lancer, inspecter, sauvegarder. Un lien vers ANALYSE.md donne accès aux détails du moteur.

## 9. Import, sauvegarde et reprise

### Import

Sélection de fichiers JSON locaux, sans téléversement vers un service. Garder aussi un catalogue des assets effectivement fournis : `car-simple-1`, `seed-c`, `seed-v1`, `trk-simple-1`. Ne pas afficher les références absentes comme options utilisables.

Avant de préparer, montrer un aperçu : type, nombre de voitures/circuits, présence de poids, architectures, quotas et noms disponibles. Refuser un JSON invalide avec un message compréhensible ; vérifier formes et nombres de valeurs des tenseurs avant construction du réseau. Signaler versions inconnues et conflits d'identité avant le lancement.

Pour plusieurs fichiers, afficher les UUID dédoublonnés et le nombre final retenu. Les imports incomplets ou invalides ne remplacent pas une session valide. Les presets historiques `config/training` et `config/broom` ne sont pas proposés tels quels avec leurs références obsolètes.

### Export

Le bouton principal propose **Exporter l'expérience**, avec un nom lisible. Le format proposé est un JSON d'enveloppe versionné contenant : scénario, configuration effective, quota explicite, populations utiles au scénario, circuits et métadonnées de session. Le nouveau chargeur reconnaîtra cette enveloppe tout en acceptant les anciens JSON.

Le menu secondaire permet les exports historiques séparés : génération, voiture sélectionnée, circuits difficiles, circuit courant, démos et configuration. Le contenu par défaut est annoncé et adapté au scénario ; morts et non-qualifiés demandent une sélection explicite dans les exports courants.

Une exportation d'expérience réunit les données dans un fichier sans ajouter de dépendance ZIP. Le rapport d'évaluation peut être un fichier JSON séparé. Les fichiers sauvegardés reprennent au départ d'une course et ne constituent pas une restauration exacte de la physique en cours ni de l'optimiseur Adam.

### Éviter les téléchargements automatiques envahissants

Proposition : les événements de tueur et de qualification ajoutent des points de sauvegarde à une liste d'archives en mémoire, avec badge « Archives à exporter ». Le téléchargement s'effectue sur action de l'utilisateur. Une option avancée restaure les téléchargements automatiques historiques.

Cela exige de remplacer les déclenchements dispersés dans sketch.js et test.js par un service d'archives commun. La liste en mémoire est bornée ; si la limite est atteinte, proposer d'exporter avant de libérer des archives, sans perte silencieuse. Les archives en mémoire disparaissent au rechargement : le bandeau l'indique tant qu'elles ne sont pas exportées. Pas de promesse de persistance locale automatique dans cette première version.

## 10. Ajustements du moteur nécessaires à une interface honnête

La refonte inclut du pilotage de session : changer uniquement les libellés ne suffirait pas à réaliser les scénarios annoncés.

| Besoin | Adaptation future prévue, hors vehicle.js |
|---|---|
| Démarrer sans édition de config.js | Préparer des objets de configuration et ressources validées avant construction de la session ; chargement asynchrone hors du seul preload initial. |
| Initialisation de Test | Initialiser ses compteurs indépendamment de l'état d'une case UI ; supprimer le besoin de cocher Test une première fois à vide. |
| Arrêt sur population vide | Traiter comme fin de course/campagne attendue dans le contrôleur, avec bilan ; éviter une exception ou un redémarrage infini. |
| Observer des poids fixes | Conserver les sources et préparer les courses suivantes sans appeler la reproduction. |
| Évaluation réelle | Contrôleur de campagne conservant les cerveaux sources, parcourant le lot entier et enregistrant les résultats sans remplacement par mutation. |
| Configuration effective | Résoudre explicitement la priorité scénario → choix utilisateur → données importées, selon le type de champ. Les propriétés d'un cerveau importé restent celles du fichier. |
| Transitions fiables | Une seule orchestration de préparation, pause et changement de session ; pas d'assemblage de cases cachées comme API métier. |
| Mémoire et modèles | Définir le propriétaire de chaque modèle TensorFlow, y compris références partagées maître/élève/démos, puis libérer les ressources devenues inutilisées lors d'un changement de session. |
| Résultats lisibles | Distinguer réussites observées, réutilisées, partielles et artificielles dans les données présentées. |

Les anomalies internes de steering, interpolation ou collision documentées dans ANALYSE.md restent un sujet distinct. Leur correction nécessiterait une évolution de périmètre et, pour `vehicle.js`, une levée explicite de son immutabilité. La nouvelle UI ne doit ni modifier ce fichier, ni dupliquer ses comportements, ni surcharger ses méthodes pour corriger indirectement ces anomalies.

## 11. Fichiers concernés par l'implémentation future

Ce tableau décrit le périmètre envisagé ; aucun de ces changements de code n'est effectué dans la tâche 1. Les noms des nouveaux fichiers sont proposés et pourront être ajustés avant implémentation.

| Action | Fichier | Responsabilité envisagée |
|---|---|---|
| Modifier | `index.html` | Structure de page et chargement des composants locaux. |
| Modifier | `style.css` | Mise en page adaptable, panneaux, modale, focus et tooltips. |
| Modifier | `ui.js`, `sketch/ui.js` | Composants et branchement des commandes existantes vers les nouvelles actions. |
| Modifier | `sketch.js` | Intégration du cycle de vie des sessions et des états d'exécution. |
| Modifier | `config.js` | Défauts explicites et configuration des scénarios. |
| Modifier | `assets.js` | Import local, format d'expérience et exports annoncés. |
| Modifier | `ga.js`, `test.js` | Adaptations de gestion nécessaires aux transitions et aux campagnes, sans modifier le steering. |
| Modifier si nécessaire | `nn.js` | État du fit, gestion des erreurs et nettoyage des ressources appartenant à cette couche. |
| Créer | `controllers/SessionController.js` | Préparation, pause et remplacement de session. |
| Créer | `controllers/EvaluationController.js` | Évaluation des cerveaux fixes sur un lot de circuits. |
| Créer | `scenarios.js` | Catalogue de scénarios, défauts et contraintes. |
| Créer | `settings-ui.js` | Fenêtre de préparation et réglages avancés. |
| Créer | `tooltips.js` | Aide accessible et textes des commandes. |
| Créer | `archives.js` | Points de sauvegarde en mémoire et exports sur demande. |
| Conserver intact | `vehicle.js` | Modèle de véhicule, comportements, capteurs et steering. |
| Conserver a priori | `track.js`, `ray.js`, `boundary.js`, JSON fournis | Géométrie et ressources sources ; aucune refonte requise par la présentation. |

Ces contrôleurs gèrent des expériences et des campagnes ; ils ne calculent pas de trajectoire ni de force à la place des véhicules. Aucune nouvelle bibliothèque de composants, moteur physique ou dépendance n'est prévue : HTML, CSS, JavaScript et les bibliothèques déjà utilisées suffisent.

Tout commentaire de code ajouté lors de l'implémentation commencera par `// CODEX :`, conformément à la demande initiale.

## 12. Ordre de réalisation proposé après discussion

1. Structure visuelle, commandes de pause/pas et inspection, en conservant un scénario fonctionnel.
2. Préparation de session, catalogue de scénarios, imports et configuration effective.
3. Réglages avancés, contraintes entre modes et tooltips.
4. Pilotage de l'observation fixe, campagnes d'évaluation et état du supervisé.
5. Exports d'expérience, archives et bilans, puis ajustements de lisibilité/accessibilité.

Ces étapes ne constituent pas une autorisation d'implémentation. La présente livraison clôt uniquement **la tâche 1 : spécification**. Les numéros des prochaines tâches restent à définir avec l'utilisateur.

## 13. Compléments issus de la seconde revue

Cette revue confronte la proposition aux fonctions de chargement, aux références globales et à la boucle de simulation existantes. Les exigences ci-dessous complètent les sections précédentes ; elles ne constituent pas des fonctionnalités déjà présentes.

### 13.1 Fenêtres, pause et transitions entre expériences

- Ouvrir la préparation d'expérience ou les réglages avancés suspend la physique et mémorise l'état précédent. Annuler ou fermer sans appliquer restaure cet état, y compris une pause déjà active. Préparer une nouvelle session la laisse toujours en pause.
- Échap ferme une fenêtre sans appliquer ; le focus reste dans la fenêtre ouverte puis revient au bouton d'origine. Un clic sur le fond ne valide ni ne détruit une configuration. Un formulaire long défile dans la fenêtre.
- Pendant un fit, le formulaire peut être consulté mais aucune nouvelle session ni modification de paramètres moteur n'est appliquée. Si un changement a été demandé, il attend une action explicite après la fin du fit ; aucun redémarrage différé surprise.
- Les changements « prochaine course » restent visibles dans un résumé en attente, annulable. Appliquer un réglage de circuit ne provoque pas implicitement le passage au circuit suivant. Pendant une campagne figée, les changements de circuit attendent la fin ou l'interruption explicite de la campagne.
- Un formulaire mélangeant valeurs immédiates et valeurs de nouvelle session ne les applique pas partiellement sans l'annoncer : le bouton décrit l'opération globale et le résumé distingue leurs prises d'effet.
- Ajouter **Recommencer la course** en observation et **Recommencer l'évaluation** à la fin d'une campagne. Les poids restent identiques ; une nouvelle mesure possède son propre identifiant. En évolution, recommencer passe par la préparation pour expliciter la population de départ.
- Ajouter **Arrêter la campagne** pendant une qualification ou une évaluation. L'arrêt ne tue pas artificiellement les voitures ; les résultats déjà obtenus sont conservés et les cas restants portent « Non exécuté ». Une interruption ne produit jamais un bilan « terminé avec succès ».

### 13.2 Nouvelle session : isolation et chargement fiable

Une nouvelle session doit repartir des défauts complets du scénario, puis appliquer les choix validés. Des paramètres absents dans le nouveau scénario ne doivent pas conserver accidentellement leurs anciennes valeurs.

Le contrôleur réinitialise notamment les références de génération/circuit/test, `Generation.train`, le balai et ses callbacks, les options de qualification/purge, la sélection de voiture, les circuits initiaux et leur index, les listes de tueurs, les statistiques de campagne et la progression ALWAYS_KILLER. Les numéros de session et les identités sauvegardées sont distingués : on ne réécrit pas arbitrairement les UUID des imports pour remettre les compteurs visuels à zéro.

Le chargement devient une phase visible **Chargement des ressources**, avec boutons dépendants désactivés et possibilité d'annuler. Les ressources sont validées et les modèles préparés avant de remplacer la session courante. En cas d'erreur, elle reste disponible en pause avec « Reprendre la session précédente ». Un identifiant de demande empêche qu'un ancien chargement asynchrone remplace une préparation plus récente. Les modèles construits pour une demande abandonnée sont libérés.

Les erreurs TensorFlow et les promesses rejetées sont prises en charge : message lisible, sortie de l'état « Entraînement », conservation des derniers cerveaux exportables et choix de recommencer. Aucun callback tardif ne doit modifier une autre session. Un maître et un élève issus de la même ressource restent des instances distinctes ; les limites adaptées pour la collecte ne modifient pas le modèle source importé.

Le démarrage vérifie la disponibilité de p5 et TensorFlow. Si un CDN est indisponible, afficher une erreur de chargement plutôt qu'une page vide. Le support hors ligne complet n'est pas inclus dans cette version.

### 13.3 L'inspection ne doit pas influencer la conduite

**Point découvert dans le code :** `UI.raceInfo()` trie `lists.running` en place, tandis que `Generation.killSlower()` utilise l'ordre de cette liste. Faire dépendre ce tri de l'onglet visible ou du choix de colonne changerait le comportement du balai.

Les tableaux de la nouvelle UI trieront donc des copies destinées à l'affichage. L'ordre utile au balai sera géré explicitement par la couche Generation, indépendamment des interactions UI. La règle proposée est un ordre par checkpoints passés décroissants, avec départage stable conservant l'ordre moteur précédent, établi au passage de tour du balai avant l'élimination. Ce déplacement de responsabilité dans ga.js doit être vérifié et documenté : il rend explicite une règle aujourd'hui liée aux rafraîchissements du tableau, sans modifier le steering ni vehicle.js.

L'inspection lit les dernières observations enregistrées. Elle n'appelle pas `lookAround()`, `applyBehaviors()` ni une méthode pouvant tuer, déplacer ou entraîner une voiture pour rafraîchir un panneau. Pour une voiture au garage, afficher « Dernière observation — course … » plutôt qu'une mesure prétendument actuelle.

Avec symétrie, différencier les sorties brutes du réseau des **consignes effectives après combinaison miroir**. Ne pas présenter `brain.last_predict` comme la commande finale sans tenir compte des deux prédictions. Les activations détaillées et calculs d'inspection sont facultatifs, bornés en cadence et nettoyés après utilisation ; les activer ou les masquer ne doit pas modifier la population, les archives ni l'ordre moteur.

### 13.4 Résultats : définitions, historique et périmètre de mesure

Le bilan d'évaluation contient une ligne par paire voiture/circuit avec identités, nombre de tours demandé, statut, checkpoints passés, tours achevés, nombre de pas physiques et motif d'arrêt. Les statuts sont **Réussite observée**, **Échec observé**, **Réussite réutilisée**, **Interrompu** ou **Non exécuté**. Les durées réelles d'exécution sont séparées des pas simulés : accélérer l'affichage ne change pas la définition de la performance physique.

Le taux de réussite mesuré a pour dénominateur les seuls essais réellement achevés (réussites + échecs observés). Le bilan affiche aussi leur nombre sur le total prévu ; aucune proportion n'est affichée quand le dénominateur est nul. Les réussites mémorisées et les essais interrompus ne gonflent pas ce taux. Les vitesses instantanées, moyennes et score transformé de tour ont des libellés distincts ; aucune conversion en km/h n'est annoncée.

Conserver un petit historique de courses et un historique de loss en supervisé, avec taille bornée et unité indiquée. Une vue de progression peut montrer succès observés et quota ; elle distingue les circuits et modes, sans mélanger des séries incomparables dans un seul score. Cette vue ne devient pas un classement scientifique entre algorithmes.

Les bilans enregistrent la configuration effective, la provenance des cerveaux, la géométrie exacte des circuits, les options d'historique et l'ordre des essais. Pour un circuit transformé (géométrie ou tours), générer une identité de copie et préserver la provenance ; ne pas transporter les preuves de réussite vers un nouveau problème.

La reproductibilité complète à partir d'une graine aléatoire n'est pas promise : p5, Math.random et TensorFlow participent à des tirages distincts. Rejouer des poids et circuits sauvegardés est pris en charge ; produire des campagnes statistiquement reproductibles avec toutes les sources aléatoires contrôlées reste une extension.

### 13.5 Sauvegardes pendant l'entraînement et états non exportés

« Exporter l'expérience » conserve aussi les rôles maître/élève, le cerveau élève courant même sans démo réussie, les démos retenues, les options en attente identifiées comme telles et les bilans disponibles. Un fichier exporté doit être autonome pour ses cerveaux et circuits, même s'ils venaient d'un fichier local qui n'est plus accessible.

Un fit en cours n'est pas sérialisé à mi-mutation de ses poids. L'export est disponible après la fin du fit ; le message annonce cette condition. Reprendre un entraînement supervisé restaure les réseaux et recommence une collecte, sans prétendre reprendre le lot, les moments Adam ou l'epoch interrompue.

Une archive en mémoire est un instantané de données sérialisées, pas une référence aux objets vivants qui continuent d'évoluer. L'enveloppe distingue la population de départ, celle de reprise et les archives éventuelles. Le numéro de format est obligatoire ; un format futur inconnu produit une erreur explicite plutôt qu'une interprétation approximative.

L'état « modifications non exportées » est suivi depuis la dernière demande d'export, en précisant que le navigateur ne confirme pas l'enregistrement effectif. Il couvre nouveaux cerveaux, résultats et archives. Les commandes de débogage marquent la session **Manipulée manuellement** et cette provenance figure dans les exports.

### 13.6 Réglages oubliés, limites et compatibilité

- **Délai sans checkpoint :** LIFESPAN est un vrai champ avancé de simulation, avec valeur effective en pas ; il ne reste pas seulement cité dans une règle de validation.
- **Difficulté progressive :** proposer dans le scénario d'évolution une option avancée désactivée par défaut avec niveau initial, incrément et niveau cible. Expliquer que ALWAYS_KILLER progresse à la déclaration des circuits selon la logique existante, sans mesurer un taux de succès. Ne pas appeler cette option « adaptation automatique au niveau des voitures ».
- **Débogage historique :** purge et arrêt forcé restent visibles uniquement lorsque le scénario les accepte. Leurs effets sont annoncés ; la réussite artificielle exclut un bilan de toute présentation comme mesure réelle.
- **Capacité de calcul :** annoncer le nombre de paramètres avant de créer une graine. Définir des bornes UI sur les tailles de population/réseau, les checkpoints et les archives avant implémentation, sans présenter ces bornes ergonomiques comme des limites mathématiques du moteur. Montrer cadence demandée et cadence observée pour expliquer une saturation ; ne pas réduire silencieusement le quota.
- **Onglet de navigateur masqué :** suspendre la physique, puis proposer Reprendre au retour sans rattraper le temps écoulé. Un fit déjà lancé peut se terminer ; son état est mis à jour au retour et la prochaine course reste en pause.
- **Décimales et saisie française :** accepter virgule ou point dans les champs décimaux, normaliser à la validation et exporter des nombres JSON. Les valeurs affichées peuvent être arrondies, les valeurs de calcul exportées conservent leur précision.
- **Fichiers importés :** afficher noms et commentaires comme texte ; valider les clés de configuration autorisées, les dimensions et les valeurs numériques avant construction. Ne pas recopier une configuration importée arbitraire dans les objets globaux.
- **Navigateur :** cibler les navigateurs de bureau récents avec sélecteur de fichiers standard, sans dépendre d'une API d'écriture directe sur le disque. L'usage sur petit écran est prévu pour observer et régler ; la puissance disponible conditionne l'entraînement.

### 13.7 Priorités et décisions restant à figer

Les transitions fiables, la neutralité de l'inspection, les scénarios honnêtes et l'export des cerveaux sont prioritaires. Les graphiques d'historique et le confort de consultation viennent ensuite ; un éditeur de courbes beta, une comparaison automatique multi-campagnes et un fonctionnement complètement hors ligne restent hors du premier périmètre.

Avant implémentation, préciser les bornes numériques des formulaires, les limites d'archives et le schéma exact de l'enveloppe JSON. Ces choix de réalisation ne doivent pas remettre en cause les scénarios et règles de prise d'effet décrits ici. Le moteur de campagne et le format de reprise nécessitent de vrais travaux de logique ; la refonte dépasse donc le seul changement de CSS.

## 14. Critères d'acceptation de la future UI

- Les six scénarios se préparent depuis la page sans modification de code ni console.
- Le résumé permet d'identifier sources, population réelle, quota et possibilité de mutation avant Démarrer.
- L'observation conserve les poids, même après un échec et un changement de circuit.
- Pause, Reprendre et Un pas ont des effets distincts et vérifiables ; les paramètres avancés indiquent quand ils prennent effet.
- Une qualification évolutive et une évaluation fixe sont clairement distinguées.
- L'évaluation rejoue les cas demandés sans descendants, différencie l'historique d'une nouvelle mesure et termine proprement même si tous les véhicules échouent.
- Le maître affiché est réellement celui utilisé ; les états collecte/fit/démo et l'insuffisance de données sont compréhensibles.
- Une voiture importée garde ses capteurs et son architecture ; une modification structurelle crée une nouvelle graine explicitement.
- Les erreurs d'import et ressources manquantes n'effacent pas la session précédente.
- L'export/reprise conserve les cerveaux, circuits, scénario et quota ; le départ d'une nouvelle course est annoncé.
- Les téléchargements automatiques peuvent être remplacés par des archives exportables sans perte silencieuse.
- La page reste lisible sur écran étroit ; dialogues, tooltips et commandes sont utilisables au clavier ; le focus revient au bouton d'ouverture après fermeture d'une fenêtre.
- Les indicateurs et messages ne reposent pas uniquement sur la couleur ; les graphes du cerveau ont une légende.
- Les commandes de réussite artificielle restent dans le débogage et ne contaminent pas une évaluation présentée comme mesurée.
- `vehicle.js` demeure inchangé et le pilotage continue à passer par les méthodes existantes de véhicule et leurs forces.

- Ouvrir/annuler un formulaire restitue l'état de pause précédent ; un fit ou un chargement ancien ne modifie jamais une nouvelle session.
- Changer du scénario maître/élève au scénario observation ne laisse ni maître, ni balai, ni qualification automatique hérités de la session précédente.
- Trier un tableau, ouvrir l'inspection ou masquer le panneau ne change pas les décisions ni les éliminations du moteur.
- Les sorties brutes et les consignes après symétrie sont identifiables ; les mesures conservées sont distinguées des observations actuelles.
- Un bilan interrompu reste partiel et son taux de réussite exclut les succès mémorisés et essais non exécutés.
- Une reprise supervisée restaure le cerveau élève et les rôles sans annoncer une reprise exacte d'Adam ou du fit.
- Une archive exportée ne change pas lorsque les objets de la simulation évoluent ensuite.

Les critères ci-dessus définissent les vérifications à effectuer lors de l'implémentation. Aucun test d'application n'est exécuté pour cette tâche documentaire.

## 15. État de la première implémentation

Une première version fonctionnelle a été réalisée sur MichelUI après la tâche 1. Voir [UI_IMPLEMENTATION.md](UI_IMPLEMENTATION.md) pour les parcours disponibles, les adaptations du moteur, les vérifications et les éléments de cette spécification encore à réaliser. Ce document conserve le périmètre cible ; il ne signifie pas que tous ses critères sont déjà satisfaits.
