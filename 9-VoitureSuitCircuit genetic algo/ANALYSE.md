# Analyse et mode d'emploi — voitures et algorithme génétique

> **Sur la branche MichelUI :** une première interface a été implémentée après cette analyse. Voir [UI_IMPLEMENTATION.md](UI_IMPLEMENTATION.md) pour le mode d’emploi actuel. Les instructions ci-dessous décrivent la version d’origine et ses réglages historiques ; les scénarios se choisissent désormais dans la page.

Analyse du 15 octobre 2026, fondée sur la lecture du code et des JSON présents. Comparaison avec `SteeringBehavioursM2IA2_2026_2027_G2/9-VoitureSuitCircuit genetic algo` dans le même répertoire Casablanca. Aucune campagne d'entraînement ni mesure de performance n'a été exécutée : les gains expliqués ci-dessous sont des conséquences attendues des mécanismes, pas des résultats expérimentaux établis.

## 1. Comprendre le projet en deux minutes

Chaque voiture possède un réseau de neurones : ses capteurs entrent dans le réseau, qui produit une direction et une vitesse souhaitées. Ces consignes deviennent une force de steering. Le réseau ne connaît pas un itinéraire à suivre, sauf si l'on active explicitement les capteurs de checkpoints.

**L'apprentissage génétique démarre automatiquement. Il n'y a pas de bouton « Train ».** Les voitures roulent, les réussites sont conservées, les places manquantes sont remplies par des copies mutées de parents sélectionnés selon leur mérite. Une voiture conservée ne modifie pas ses poids en roulant. Le mode supervisé, facultatif, est le seul qui utilise `model.fit()`.

La nouveauté majeure est la mémoire des difficultés : un circuit qui met la population en échec devient un **circuit tueur**, conservé pour les qualifications ultérieures. La case **Test** active ces qualifications, mais **ne désactive pas les mutations**. Pour une évaluation sans reproduction, il faut `Generation.config.FROZEN = true`.

**Attention au démarrage livré : il charge deux voitures déjà entraînées**, et non trente cerveaux aléatoires. Plusieurs options commentées citent des fichiers ou des noms absents. Les recettes ci-dessous utilisent les ressources effectivement présentes.

## 2. Lancer et utiliser l'interface

Servir le dossier par HTTP pour permettre les chargements JSON. Par exemple, depuis ce dossier :

```sh
python3 -m http.server 8000
```

Ouvrir `http://localhost:8000/`. Un serveur de développement tel que Live Server convient également. `index.html` charge p5.js 0.8.0, son module DOM et TensorFlow.js 1.1.0 depuis des CDN : le lancement tel quel dépend du réseau. Le calcul TensorFlow est configuré sur CPU dans `setup()`.

### Commandes réellement disponibles

| Élément UI | Effet réel et usage |
|---|---|
| **Speed**, de 0 à 12 | Nombre de pas physiques par image. **0 = pause**, 1 = observation lente, 12 = accélération de la simulation. Ce n'est pas la vitesse maximale des voitures. |
| **Rate** | Nombre demandé d'images par seconde, choisi dans `CONFIG.Sketch.RATES`, ici `[0,1,2,5,10,15,20,30]`. Éviter 0 pour une pause ordinaire ; utiliser Speed. |
| **Pause** | Demande une pause à la fin de chaque course, après préparation de la suivante. Ne met pas immédiatement en pause. |
| **Step** | Exécute un pas physique puis remet Speed à 0. |
| **Test** | Parcourt les tueurs connus pour qualifier les voitures. S'il n'y a aucun circuit à tester, la case est décochée. Des descendants peuvent être produits pendant cette phase. |
| **Killer** | Demande une pause à la fin d'un test déclenché automatiquement. Ce n'est pas le bouton qui crée un circuit tueur. Un test manuel se termine normalement par une pause même sans cette case. |
| **Purge** | Demande de faire courir le surplus du garage, puis de réduire les survivants au quota quand les conditions sont réunies. Sans effet de purge pendant Test ; à utiliser après avoir constitué une réserve. La sélection n'est pas un classement universel garanti des meilleurs cerveaux. |
| **Track** | Change immédiatement de circuit et prépare la population actuelle. Cela ne correspond pas à la fin normale d'une course et peut interrompre l'évaluation. |
| **Save** | Télécharge la génération et les circuits tueurs. L'infobulle annonce aussi le circuit courant et le leader, mais le gestionnaire appelle `saveAll()` avec seulement `gen` et `kill`. |
| **Kill** | Tue les voitures encore en course (`murder`). À partir de 10 voitures, demande confirmation et sauvegarde d'abord la liste en course. Les meurtres manuels sont exclus de plusieurs compteurs de dangerosité. |
| **Finish** | Marque artificiellement les voitures encore vivantes comme réussies. Outil de manipulation/debug ; invalide une mesure de réussite réelle. |
| **Broom** | Renomme la voiture d'intérêt en `broom`, et retire ce nom à l'ancienne. Le balai sera installé lors d'une préparation de course, si la configuration BROOM vaut bien `broom`. |

Pour accélérer, augmenter Speed et garder un Rate positif, par exemple 20 ou 30. Le débit effectif dépend du CPU : `Speed × Rate` est un nombre de pas physiques demandé par seconde, pas un débit garanti. Aucun entraînement TensorFlow ne s'effectue à chaque image en mode génétique.

Cliquer sur une voiture dans le canvas ou sur une ligne du tableau la sélectionne comme **VOI** (*Vehicle Of Interest*). Cela fixe aussi les globales `car` et `brain`, utiles dans la console. Le canvas de 400 × 400 sous les commandes dessine les poids, biais et activations du cerveau sélectionné ; il faut recliquer pour rafraîchir cette inspection. Ce dessin n'est pas une preuve que le réseau apprend en direct.

### Lire les informations

- `generation` : numéro de l'objet Generation ; une nouvelle course ne crée pas systématiquement un nouvel objet. Ce numéro n'est ni un compteur d'epochs TensorFlow ni le nombre total de circuits parcourus.
- `store` : nombre de voitures au garage (`stored`).
- `elders` : voitures ayant réussi tous les tueurs considérés ; s'il n'y a aucun tueur, le test « tous réussis » est vrai par vacuité. Ce compteur seul ne prouve donc rien.
- `old` dans l'identité : nombre de réussites accumulées selon les règles de classement, pas l'âge en secondes.
- `laps` : tours terminés ; `avg` repose sur la mesure de vitesse au tour décrite plus bas.
- Le tableau de course montre au plus dix voitures actives. Il ne représente pas toute la population ni tout le garage.
- Le tableau des tueurs expose `name`, `elders` (réussites mémorisées sur ce circuit), `last` (dernières victimes), `when` (passes sans victime), `max` (maximum de victimes pendant la session), `passed` (nombre de passages de test). À Speed=0, cliquer un tueur permet de le sélectionner.

## 3. Ce que fait exactement la configuration actuelle

Le dernier bloc de `config.js` et les JSON chargés déterminent ensemble le fonctionnement :

| Paramètre | Valeur active et conséquence |
|---|---|
| `Sketch.LOAD_CONFIG` | `null` : aucun preset de configuration chargé. |
| `Sketch.LOAD_GEN` | `['car-simple-1']` : charge **deux cerveaux avec des poids**. |
| `Sketch.LOAD_TRACKS` | `[]` : aucun circuit initial imposé. |
| `Sketch.LOAD_KILLERS` | `[]` : aucun tueur préchargé. |
| `Sketch.TRAINING` | `null` : pas d'apprentissage supervisé. |
| `Sketch.CHECK_TEST` | `true`, mais le lot de tueurs est vide : Test n'a initialement rien à faire et est décoché. Un tableau vide est une valeur vraie en JavaScript. |
| `Sketch.SPEED` | 2 pas physiques par image ; Rate commence au dernier palier, soit 30. |
| `Vehicle.LIFESPAN` | 150 ; le seuil réel sans checkpoint est `LIFESPAN × 60 / nombreDeCheckpoints`, donc 37,5 pas avec 240 checkpoints. Ce n'est pas 150 secondes. |
| `Track.TRICKY` | 6,5 : fréquence spatiale du bruit, qui influence la sinuosité. Ce n'est pas une difficulté calibrée. |
| `Track.LAPS`, `LENGTH`, `WIDTH` | 2 tours, 240 checkpoints, demi-largeur radiale variable de 20 à 50 pixels. Le segment de checkpoint fait donc approximativement 40 à 100 pixels de largeur totale. |
| `Generation.TOTAL` | Défaut de 30, **mais le JSON chargé le ramène initialement à 2** : il contient deux voitures et aucun champ `total`. |
| `Generation.BROOM` | `'broom'`, mais aucune voiture fournie ne porte ce nom ; le balai est initialement inactif. |
| `Generation.AUTO_TEST` | 10 : seuil utilisé par la logique de déclenchement automatique ; les autres conditions sont détaillées en section 7. |
| `Generation.FINISHED` | `true` : conserver le circuit jusqu'à atteindre le quota de survivants, sauf cas FROZEN. |
| `Generation.FROZEN` | `false`, valeur par défaut : reproduction autorisée. |
| `Test.MIN_ELDERS`, `MAX_TRACKS`, `FULL` | 15, 10, `true`. FULL augmente le quota à qualifier pour inclure les anciens ; il n'annule pas la sélection d'un sous-ensemble par MAX_TRACKS. |

Dans `def.TRICKY = 6.5; 3;`, la valeur affectée est **6,5**. Le `3` est une expression isolée sans effet. Même remarque pour `TOTAL = 30; 1;` et `MAX_TRACKS = 10; 0;`.

### Les deux cerveaux fournis

`assets/car-simple-1.json` contient :

| Nom | Réseau | Paramètres entraînables | Particularité |
|---|---|---:|---|
| `nosym-f1.5` | 6 → 9 → 6 → 2, ReLU | 137 | Symétrie désactivée ; commentaire JSON : « graine supervisée ». |
| `h9c-f1.5` | 6 → 9 → 2, ReLU | 83 | Symétrie activée ; commentaire JSON : graine supervisée par `h9x6c`. |

Les six entrées sont trois distances de rayons et trois informations de sens des murs. Les deux ont une portée de 300, une force maximale de 0,15, `safe=-0.01`, pas de capteurs `ahead`, pas de channels et `limit.speed=0`. Ce zéro supprime la limite explicite dans `update()` et utilise `REF_SPEED=2.5` comme unité de consigne ; **il n'immobilise pas la voiture**. ReLU peut produire des sorties au-delà de 1, donc cette unité n'est pas à elle seule un plafond de vitesse.

Leurs compteurs `old` dépassent 1100 et `beta` 1400, mais leurs mémoires `passed` sont vides. Ces compteurs et commentaires sont des métadonnées héritées, pas une validation reproductible dans la session actuelle.

## 4. Recettes d'entraînement

Ces modifications sont des instructions à appliquer selon l'expérience souhaitée ; la présente documentation ne change pas les réglages actifs. Recharger la page après modification. Garder une copie des JSON sources et des résultats.

### A. Observer les cerveaux livrés

1. Garder la configuration actuelle.
2. Utiliser Speed=1 et un Rate positif pour comprendre les capteurs et les réactions ; sélectionner une voiture.
3. Mettre Speed=0 pour inspecter, Step pour avancer.
4. Laisser rouler pour découvrir de nouveaux circuits. Cela peut déclencher des mutations si les places manquent après une course.
5. Utiliser Save pour conserver l'état des cerveaux et des tueurs, avant de recharger.

Pour tester un circuit fourni dès le départ, remplacer le tableau `LOAD_KILLERS` par `['trk-simple-1']` et garder `CHECK_TEST=true`. Ce fichier contient un monde d'un circuit tueur de 60 checkpoints, difficulté enregistrée 1,5 et 2 tours. Il conserve ses caractéristiques chargées, indépendamment du LENGTH=240 des nouveaux circuits.

### B. Entraîner depuis zéro avec les capteurs améliorés

Dans le bloc `CONFIG.Sketch` de `config.js`, remplacer le tableau de génération actif par :

```js
def.LOAD_CONFIG = null;
def.LOAD_GEN = ['seed-c'];
def.LOAD_TRACKS = [];
def.LOAD_KILLERS = [];
def.TRAINING = null;
def.CHECK_TEST = true;
def.CHECK_PAUSE = false;
```

Garder ici CHECK_TEST=true même avec un lot vide : le passage initial dans Test initialise ses compteurs puis décoche la case. Avec CHECK_TEST=false dès le démarrage, une anomalie d'initialisation peut interrompre la première déclaration de tueur (voir section 9).

`seed-c.json` contient une voiture **sans poids**, donc son cerveau est initialisé aléatoirement. Le JSON demande `total:30`. Il décrit trois rayons, trois capteurs de sens, une couche cachée de 9 neurones, ReLU et une force maximale de 0,15. La première course ne contient que la graine ; le remplissage à 30 intervient ensuite si le quota manque.

Dans `CONFIG.Track`, commencer éventuellement par `def.TRICKY = 1.5;`, puis augmenter la difficulté une fois les succès observés. Garder `Generation.FROZEN=false` et `FINISHED=true`. Avec FINISHED, un circuit en échec est rejoué avec de nouveaux descendants jusqu'au quota ; cela laisse une chance d'apprendre un cas difficile au lieu de le remplacer immédiatement.

La progression est automatique : aucune ligne à décommenter dans `draw()`, aucun `model.fit()` à ajouter. Augmenter Speed accélère les essais. Des pauses ou téléchargements automatiques peuvent survenir lors des qualifications. Reprendre avec Speed>0.

Alternative : `def.LOAD_GEN = null` produit directement 30 voitures avec `Vehicle.config`. Toutefois les défauts actuels n'activent pas `side-direct` ; **ce n'est donc pas la même expérience que seed-c**. Préférer le JSON pour une configuration explicite sans toucher à `vehicle.js`.

### C. Poursuivre l'évolution d'une sauvegarde

1. Placer le JSON téléchargé dans `assets/`, par exemple `assets/reprise.json`.
2. Mettre `def.LOAD_GEN = ['reprise'];` et charger aussi le lot de tueurs correspondant.
3. Si l'on veut 30 voitures malgré une petite sauvegarde, ajouter au niveau racine de ce JSON `"total":30`. Une sauvegarde de génération standard n'exporte pas `total`.
4. Garder FROZEN=false pour autoriser la reproduction. Ne pas activer TRAINING pour une simple reprise génétique.

On peut fournir plusieurs générations dans LOAD_GEN. Elles sont concaténées et les UUID identiques sont dédoublonnés. Le quota provient du premier objet ; concaténer ne recalcule pas automatiquement un nouveau total.

### D. Apprentissage supervisé par un maître

Il faut un maître déjà compétent et une graine élève. Le code fourni permet cette recette explicite :

```js
def.LOAD_CONFIG = null;
def.LOAD_GEN = ['car-simple-1'];
def.TRAINING = 'seed-c::h9c-f1.5';
def.LOAD_KILLERS = [];
def.CHECK_TEST = false;
def.CHECK_PURGE = false;
```

Le format est `fichierEleve:nomEleve:nomMaitre` ; les deux `:` restent nécessaires lorsque l'on donne un nom. Un champ élève vide prend la première voiture du fichier élève. Le maître est recherché dans LOAD_GEN. Si son nom est introuvable, le code prend silencieusement la première voiture : mieux vaut utiliser le nom exact.

**Le preset `config/training` fourni cite `h9x6c1-f05`, absent des deux voitures livrées.** Le décommenter tel quel n'entraîne donc pas avec ce maître nommé : il tombe sur la première voiture. La recette ci-dessus évite cette ambiguïté.

Déroulement :

1. `Generation.prepareTraining()` prépare le maître et un véhicule de démonstration de l'élève ; le quota est ramené à 1. La vitesse du maître est limitée à REF_SPEED si nécessaire pour densifier les observations.
2. À chaque décision du maître, l'élève est placé dans son état pour mesurer **ses propres capteurs**. On enregistre ces entrées et les sorties du maître. Le maître peut donc avoir une autre architecture que l'élève, mais les limites physiques doivent rester compatibles.
3. À la fin de la course, `nextTraining()` lance `trainee.train()` sur les observations collectées. Il faut que le maître ait terminé ; un maître qui échoue provoque une erreur.
4. `NeuralNetwork.train()` compile avec Adam et erreur quadratique moyenne, mélange les données, utilise des lots de 32 et `floor(nombreObservations/32)` epochs.
5. Pendant le `fit()` asynchrone, la physique est suspendue. Le message affiche durée, epoch et `loss × 1000`.
6. Après apprentissage, le véhicule `demo` reçoit le cerveau de l'élève. Les démos qui réussissent sont conservées avec une copie de leurs poids, puis l'apprentissage recommence sur les courses suivantes.

Une faible loss signifie imitation sur les observations du maître ; elle ne garantit pas qu'un élève autonome sait récupérer une situation qu'il n'a jamais vue. Il faut ensuite le faire rouler sur d'autres circuits.

Pour exporter les démos, mettre Speed=0 puis utiliser la console :

```js
saveGeneration('eleves', 'demo');
```

Recharger ensuite `eleves` avec `TRAINING=null` pour une phase génétique ou une évaluation. La loss et les données d'apprentissage ne sont pas une sauvegarde d'optimiseur ; la sauvegarde conserve surtout les réseaux obtenus. Avec moins de 32 observations, le calcul donne 0 epoch et le code ne gère pas explicitement ce cas.

### E. Imposer une vitesse minimale : la voiture-balai

Ce mécanisme sert à améliorer une population déjà capable de terminer :

1. Sélectionner une voiture de référence, puis cliquer **Broom**.
2. Vérifier que `Generation.config.BROOM` vaut `'broom'`, comme dans le réglage actuel.
3. Lors de la prochaine préparation, cette voiture est ajoutée à la course même si sa réussite est déjà mémorisée.
4. À chaque tour du balai, `killSlower()` élimine les voitures placées après lui dans la liste `running`. Cette liste est triée par progression lorsque `UI.raceInfo()` est appelé ; ce n'est pas un chronométrage indépendant de toutes les voitures.

L'action active est `onLap.broom`, **pas** `onFinished.broom`, qui reste commentée. Le commentaire historique « tue tout le monde à l'arrivée » ne décrit pas exactement l'implémentation courante. Le preset `config/broom` cite `h9x6c1-f1`, absent des ressources livrées ; utiliser la sélection UI est plus explicite.

## 5. Organisation du code et boucle d'exécution

| Fichier | Responsabilité |
|---|---|
| `index.html` | Dépendances et ordre des scripts. Tous partagent l'espace global, sans modules. |
| `config.js` | Choix des assets et surcharge des configurations de classes. |
| `sketch.js` | `preload`, `setup`, `draw`, changement de course, déclaration des tueurs. |
| `ga.js` | Classe Generation : listes, conservation, sélection, reproduction, qualification, mode supervisé. |
| `vehicle.js` | Capteurs, décisions, symétrie, physique, checkpoints, mérite, sérialisation et versions de véhicules. **Fichier laissé intact.** |
| `nn.js` | Modèle TensorFlow, prédiction, copie, mutation, apprentissage supervisé et poids JSON. |
| `track.js` | Circuits procéduraux, murs orientés, identité et mémoires de circuits ; classe World. |
| `boundary.js`, `ray.js` | Géométrie de projection et intersections des rayons avec les segments. |
| `assets.js` | Chargement typé, concaténation et téléchargements de sauvegardes. |
| `ui.js` | Utilitaires DOM, tables et dessin de tenseurs. |
| `sketch/ui.js` | Commandes, sélection, inspection et tableaux. Ce fichier est réellement chargé, ce n'est pas un doublon inutilisé. |
| `test.js` | Qualification des populations sur les circuits tueurs ; **pas une suite de tests unitaires**. |
| `assets/etc/` | Outils externes de fusion, tri et traitement des archives. |

```text
preload : config éventuelle → surcharges → JSON de circuits / voitures / élève
setup   : UI → Test → Generation si nécessaire → circuit → départ
 draw   : répéter Speed fois : capteurs → réseau → force → checkpoint → physique
          classer les voitures terminées ou mortes
          si aucune ne court : nextRace
nextRace: garage → déclaration éventuelle de tueur → choix du circuit
          réutilisation ou création de descendants → préparation → pause éventuelle
```

`Generation.lists` distingue `running` (en course), `finished` (arrivées), `dead` (échecs) et `stored` (garage). Après une course, `classifyFinished()` transfère les arrivées au garage. Si le quota est atteint, les survivants peuvent rouler sur un autre circuit **avec leurs poids inchangés**. Sinon, une nouvelle Generation conserve les survivants utiles et complète avec des descendants.

Le test de changement de course dans `draw()` est donc nécessaire : `run()` simule les voitures, mais ne choisit pas lui-même la course suivante.

### Capteurs, décision, steering et locomotion

- `lookAround()` mesure les distances aux murs par raycasting, puis ajoute les informations optionnelles. Les distances deviennent des valeurs bornées entre 0 et 1 : proche=1, loin=0.
- `side-direct` donne un bit de sens pour chaque rayon, calculé à partir de l'orientation du mur. Cela aide à distinguer avancer dans le bon sens et parcourir la même route en sens inverse.
- `weight-direct` pondère cette information par la proximité ; `direct` ne garde que celle du rayon central.
- `channels` peut ajouter vitesse, vitesse au carré ou un produit distance-vitesse. Les graines livrées n'en utilisent pas.
- `ahead`, `behind`, `ahead-distance` peuvent fournir des informations de checkpoints. Ils rendent le problème plus guidé ; `ahead=0` dans les cerveaux fournis.
- `decide()` prédit les deux sorties. Si la symétrie est active, il prédit aussi l'observation miroir, moyenne les vitesses et remet les directions dans un même repère : `dir=(dirOriginal-dirMiroir+1)/2`.
- `steer()` construit une vitesse souhaitée relative au cap actuel, calcule **vitesse souhaitée − vitesse actuelle**, puis limite la force à `limit.force`.
- `applyForce()` accumule la force dans l'accélération ; `update()` intègre vitesse et position. Il n'y a pas de chemin programmé imposé aux voitures en course.

Le changement de génération, les listes et la validation forment une couche de gestion au-dessus du steering. Le mode `follow()` recopie explicitement l'état du maître pour recueillir des observations : c'est une instrumentation d'apprentissage, pas le pilotage autonome de la démo.

## 6. Améliorations par rapport à G2 et intérêt attendu

| Sujet | Version G2 | Nouvelle version | Pourquoi cela peut aider |
|---|---|---|---|
| Survie des bons réseaux | Toute la population est remplacée par des descendants mutés. | Conservation des voitures ayant réussi et garage réutilisable. | Évite de perdre systématiquement une bonne solution à chaque reproduction. |
| Circuits difficiles | Nouveau circuit à chaque extinction de population. | Avec FINISHED, même circuit jusqu'au quota ; archivage des tueurs. | Permet de travailler une difficulté persistante et de la retrouver plus tard. |
| Généralisation | Pas de mémoire organisée des circuits. | Qualifications sur un lot de tueurs et historique par voiture. | Rend visibles certaines régressions sur des cas précédemment difficiles. |
| Entrées du réseau | Six rayons de −45° à +30°, portée 50. | `2×span+1` rayons symétriques ; trois rayons et portée 300 pour les voitures fournies, plus information de sens. | Moins d'entrées mais plus d'anticipation ; l'information directionnelle réduit l'ambiguïté du sens de parcours. |
| Symétrie | Aucune combinaison miroir. | Prédiction sur observation originale et miroir, sauf option no-sym. | Impose une cohérence gauche/droite ; coûte deux prédictions et limite les politiques asymétriques. |
| Géométrie du circuit | Rayons x et y générés séparément avec largeur fixe. | Construction elliptique radiale, largeur variable, sens alterné. | La structure radiale vise à éviter les nœuds géométriques ; les sens alternés diversifient l'expérience. Cela ne prouve pas que tout circuit est franchissable aux limites physiques choisies. |
| Checkpoints | Proximité de la droite à moins de 5 pixels. | Signe de projection sur une droite orientée. | Moins sensible au fait de sauter une mince bande de proximité en un pas. Ce n'est pas un test complet d'intersection de trajectoire et de segment. |
| Collision | Mort à moins de 5 pixels d'un mur vu par les rayons. | Test de côté signé d'un mur vu, seuil safe et détection de disparition des murs. | Distingue bord proche et sortie ; reste une détection discrète guidée par les rayons. |
| Mérite | `2^nombreCheckpoints`. | Progression normalisée et vitesse au tour, puis carré. | Récompense progression et efficacité ; atténue l'explosion exponentielle avec le nombre de checkpoints. |
| Mutation | Taux fixe 0,1 et perturbation gaussienne. | Taux et amplitude modulés par beta ; au moins une mutation forcée. | Cherche de petits ajustements autour des lignées éprouvées, tout en évitant les copies strictement identiques chez les nouveaux enfants. |
| Architecture réseau | Une couche cachée, sigmoïde. | Couches multiples, activation configurable, JSON par voiture et versions. | Permet de comparer plusieurs capacités et de reprendre des réseaux antérieurs. |
| Démarrage | 100 cerveaux aléatoires. | Graines, cerveaux préentraînés ou maître/élève. | Le bon comportement visible immédiatement peut venir de l'historique d'entraînement fourni. |
| Outils | Un curseur Speed. | Pause, Step, sélection, inspection, sauvegardes, qualifications, balai. | Facilite l'analyse et la reprise des expériences. |

**Il n'y a toujours pas de crossover** entre deux parents : c'est sélection d'un parent, copie et mutation. L'expression « algorithme génétique » recouvre ici cette évolution asexuée de poids.

### Mérite et température : les formules

Avec `P` checkpoints passés, `C` checkpoints par tour, `L` tours demandés, `W=WEIGHT_SPEED` et `s` la vitesse transformée du dernier tour achevé :

```text
s = 2^(longueurCircuit / nombreDePasDuTour) - 1
fitness = [ (1+P) × (1+W×s) / ((L×C+1) × (1+W)) ]²
probabilité de sélection = fitness / somme des fitness
```

`s` n'est pas une vitesse brute en pixels par seconde. Un véhicule sans tour achevé ne dispose pas d'une nouvelle mesure de ce tour. Les statistiques instantanées `stats.vel` sont un autre indicateur, normalisé par `speedUnit`.

`beta` augmente avec les réussites et, dans certains cas, avec l'attente des survivants au garage. L'enfant hérite de `beta × 2/3` par défaut. La sélection utilise la fitness ; **elle n'applique pas directement un multiplicateur de résilience**, malgré un commentaire historique dans ga.js. La résilience agit par conservation, historique et variation des mutations.

`Vehicle.mutate(parent)` calcule :

```text
taux = MUTATION_RATE × computeRatio(betaParent, courbeRate)
amplitude = MUTATION_TEMPERATURE × computeRatio(betaParent, courbeTemperature)
poidsChoisi += gaussienne(0, amplitude)
```

Les biais sont mutés comme les poids. Si aucun paramètre n'a changé, `nn.js` en force un. Une courbe plus froide autour d'un parent éprouvé est une intention utile, mais voir l'anomalie d'interpolation en section 9 avant d'interpréter les valeurs extrêmes.

## 7. Comment fonctionnent les tests des cerveaux

### Découverte d'un tueur

Après une course, `nextRace()` classe les arrivées puis examine les morts. Hors mode supervisé, la présence de morts peut appeler `declareKiller()`. **La condition réelle est `countDead`**, plus large que le commentaire qui évoque uniquement un vétéran ou un qualifié mort.

Si le circuit n'était pas déjà tueur :

1. Il reçoit le statut et est ajouté à `Track.killers`.
2. Les survivants concernés enregistrent leur réussite.
3. Les voitures mortes et le circuit sont téléchargés séparément.
4. Un auto-test peut être enclenché.

Le compteur `kills` est renseigné depuis `countDeadOld` quand il est nul : il reflète donc les anciens morts hors meurtres, pas nécessairement tous les échecs de la course. Un circuit peut être archivé même si ce compteur vaut zéro.

L'auto-test ne se déclenche pas si Test est déjà actif, si AUTO_TEST est false/null ou si `currentGen.total` diffère de `Generation.config.TOTAL`. Ensuite AUTO_TEST=true suffit ; avec un nombre, un faible nombre d'elders ou un manque de qualifiés peut le déclencher. **La population livrée de total=2 diffère du défaut TOTAL=30**, ce qui bloque cette voie automatique au démarrage.

### Qualification et mémorisation

`Test.next()` commence une session, choisit les tueurs à rejouer puis privilégie ceux qui ont récemment éliminé des voitures. Il regarde aussi combien de voitures ont réussi deux circuits en commun ; avoir 30 succès sur A et 30 sur B ne suffit pas si ce sont des voitures différentes.

Les réussites sont mémorisées dans `vehicle.passed` sous la clé :

```text
uuidDuCircuit.nombreDeTours
```

La mémoire contient progression, vitesse et statistiques. Une voiture ayant déjà réussi un circuit peut rester au garage ou être considérée comme arrivée sans refaire le trajet. Un descendant muté ne reprend pas automatiquement la preuve de réussite du parent. Passer d'un à deux tours crée une autre clé, donc exige une autre validation.

Le lot peut être limité par `MAX_TRACKS` lorsque `MIN_ELDERS` est atteint ; le mode livré `bad-min` retient au plus MAX_TRACKS circuits parmi ceux dont `kills` est non nul. Pendant ce test partiel, `Track.killers` est temporairement remplacé par le sous-ensemble. **Un elder durant cette phase peut donc être relatif au lot courant** ; après restauration de la liste complète, les prochaines préparations réévaluent le statut.

`FULL=true` vise à inclure les anciens à qualifier dans le quota. Pour exiger le lot complet plutôt qu'un sous-ensemble, mettre `Test.MAX_TRACKS=0` dans la configuration. `PASSES=2`, option non active, prévoit un premier passage à un tour puis un passage au nombre de tours prévu.

En fin de session : `markQualified()` marque les réussites sur le lot choisi, les voitures ni qualifiées ni elders sont retirées dans `unqualified`, et plusieurs fichiers sont téléchargés. Le mode normal peut continuer à produire des descendants pour obtenir le quota. C'est une **qualification avec possibilité d'évolution**, pas un jeu de validation indépendant de l'apprentissage.

### Évaluer une population fixe, sans reproduction

Utiliser une sauvegarde et des circuits connus. Exemple de réglages :

```js
// Bloc Sketch
 def.LOAD_GEN = ['reprise'];
 def.LOAD_KILLERS = ['trk-simple-1'];
 def.TRAINING = null;
 def.CHECK_TEST = true;
 def.CHECK_PAUSE = true;

// Dans CONFIG.Generation, avant return
 def.FROZEN = true;

// Dans CONFIG.Test, avant return
 def.MAX_TRACKS = 0;
 def.FULL = true;
```

Chaque `def` ci-dessus désigne le bloc correspondant, pas une variable unique à copier telle quelle en fin de fichier. Avec FROZEN, les morts ne sont pas remplacés, et le quota diminue ; un faible effectif peut mettre la simulation en pause avec `Frozen generation is low`. Une population entièrement perdue peut atteindre les garde-fous de génération vide : ne pas attendre de ce mode un rapport de benchmark automatique.

**Pour forcer une nouvelle mesure**, créer une copie du JSON de génération et vider les champs `passed` de ses voitures avant chargement. Sinon une ancienne réussite peut éviter le roulage. Ne pas changer la géométrie tout en conservant un UUID et ses anciennes preuves de passage. Pour une mesure fiable, ne pas utiliser Finish, Kill, Track ni Purge pendant les courses.

Cette application ne calcule pas à elle seule un taux de réussite indépendant sur des circuits jamais vus. Une comparaison sérieuse demanderait des populations de départ comparables, des circuits conservés à part, plusieurs essais aléatoires et des mesures de temps/succès ; aucune conclusion chiffrée de ce type n'est fournie ici.

## 8. Sauvegarder, charger et archiver

### Ce qui est réellement enregistré

`NeuralNetwork.toJSON()` exporte les dimensions, activation, métadonnées de mutation, et chaque tenseur sous la forme `{shape, values}`. Le JSON véhicule ajoute notamment version, capteurs, limites, options, beta, ascendance, nom et réussites.

Ce sont des sauvegardes de véhicules et cerveaux, **pas un instantané complet** : ni position/vitesse en cours, ni état détaillé du Test, ni état Adam, ni graine aléatoire. Au chargement, les voitures sont remises au départ. `Generation.toJSON()` exporte `counts` et une liste plate `vehicles`, sans préserver les compartiments comme listes distinctes ni exporter `total`. Par défaut il prend toutes les listes présentes, **y compris dead et éventuellement unqualified**.

Les circuits exportent les checkpoints et leur identité, nombre de tours, difficulté et statistiques de danger ; les murs sont reconstruits au chargement. Un monde est `{tracks:[...]}` ou `{killers:[...]}`. `Asset.make()` reconnaît les types par leurs clés ; pas par l'extension du nom avant `.json`.

### Commandes console utiles

Mettre Speed=0 avant une sauvegarde sélectionnée, puis :

```js
// Ensemble par défaut : génération (toutes listes) + tueurs
saveAll();

// Ajouter explicitement le circuit courant
saveAll({gen: true, kill: true, track: true});

// Sauver uniquement les voitures arrivées / au garage
saveGeneration('survivants', ['stored', 'finished']);

// Sauver les véhicules actuellement en piste
saveGeneration('en-course', ['running']);

// Après sélection d'une voiture dans l'UI
saveJSON(car.toJSON(), 'mb-ma-voiture.json');

// Circuit courant et lot des tueurs
saveTrack('mon-circuit');
saveKillers('mes-tueurs');

// En mode supervisé : démos conservées
saveGeneration('eleves', 'demo');
```

Une sauvegarde individuelle se recharge elle aussi via LOAD_GEN ; `Asset.load()` l'enveloppe dans une Generation.

### Téléchargements automatiques et noms

Le préfixe est `Asset.PREFIX='mb-'`. Les sauvegardes utilisent les téléchargements du navigateur, sans écrire dans le dépôt ni dans localStorage.

| Déclencheur | Fichiers attendus |
|---|---|
| Save | `mb-genN.json` et `mb-kilN.json` ; sauvegardes répétées avec suffixe suivant `gen.saved`. |
| Nouveau tueur | `mb-kK-tT.gen.json` (liste dead) et `mb-kK-tT.trk.json` (circuit). K est le compteur kills et T le numéro relatif du circuit. |
| Fin de qualification | `mb-genN[-suffixe].json`, `mb-genN[-suffixe].txt` (bilan), `mb-kilN[-suffixe].json`, plus `mb-unkN[-suffixe].json` si des non-qualifiés ont été retirés. |
| Kill avec au moins 10 voitures, après confirmation | `mb-mK-tT.gen.json` (voitures encore en course avant meurtre). |

Si plusieurs téléchargements sont produits, vérifier que le navigateur les autorise et qu'ils sont tous présents. Les éventuels suffixes `(1)` ajoutés par le navigateur font partie du nom local et peuvent brouiller la reprise.

### Reprise concrète

1. Copier les fichiers de téléchargement dans `assets/`. Par exemple `mb-gen42.json` → `assets/reprise.json`, `mb-kil42.json` → `assets/tueurs-reprise.json`.
2. Configurer `LOAD_GEN=['reprise']`, `LOAD_KILLERS=['tueurs-reprise']`, `TRAINING=null`.
3. Ajouter si nécessaire `"total":30` à la racine de la génération.
4. Remettre les autres paramètres d'expérience dans `config.js` ou un preset ; ils ne sont pas exportés par Save.
5. Recharger la page. Sans renommage, utiliser `LOAD_GEN=['mb-gen42']` puisque le préfixe n'est pas retiré automatiquement par le chargeur.

`LOAD_TRACKS` sert à une séquence initiale : `World.next()` la parcourt une fois, puis les nouveaux circuits sont générés. `LOAD_KILLERS` nourrit le lot rejoué par Test.

Les JSON de configuration ont une clé `config` et des sections `Vehicle`, `Track`, `Generation`, `Test`, `Sketch`. `CONFIG.setup()` exécute d'abord les fonctions de configuration de classes, puis recopie leurs propriétés venant du preset. Les JSON de voitures continuent ensuite de définir leurs propres caractéristiques d'instance : un preset n'efface pas automatiquement l'architecture d'un cerveau chargé.

### Outils d'archives dans assets/etc

`merge.js` est un outil Node indépendant de la page : fusion de générations ou tueurs, comptage, statistiques d'ancienneté, filtrage et dédoublonnage. Son aide décrit `--output`, `--last-kill`, `--old`, `--fix-safe`, `--trash`. La commande `doublon` peut réécrire les fichiers sources ; utiliser son option `--dry-run` pour inspecter.

Les `.mk` et scripts `curve.*` sont des aides historiques d'archivage/production de courbes. Ils citent notamment un `Makefile`, des dossiers de tueurs ou `LOG.md` non livrés ici. `download.mk` utilise un chemin de téléchargement personnel, déplace des fichiers et comporte des cibles de suppression : ce n'est pas une chaîne de sauvegarde automatique prête à lancer telle quelle.

## 9. Limites, incohérences et pièges repérés

Les points suivants proviennent de la lecture du code ; ils n'ont pas été corrigés dans cette intervention de documentation.

1. **Deux voitures au lieu du défaut trente.** Le chargement de car-simple-1 ramène total à 2 ; Save ne conserve pas ce quota explicitement. Pour une population de 30, utiliser une graine/reprise avec `total:30`.
2. **Assets absents dans les suggestions commentées.** `gen-h9x6c1-2`, `gen-h9x6c1-f05`, `gen-sym-dir-1`, `seed-f1`, `gen64`, `initialTracks` et les chemins `killerTracks/...` ne sont pas fournis. Les décommenter entraîne des chargements manquants. Les noms de maîtres/balais des presets sont aussi obsolètes.
3. **Le preset miage-0 n'est pas un clone exact de G2.** Il garde la nouvelle logique de survie/test/géométrie et donne sept rayons symétriques au lieu des six rayons de G2. Surtout, il ne remet pas LOAD_GEN à null : le décommenter seul conserve car-simple-1 et ses caractéristiques propres.
4. **« Test » n'est pas une évaluation immuable.** Reproduction active sauf FROZEN, historique parfois réutilisé et test partiel possible. Un elder n'est pas une preuve de réussite sur tous les circuits imaginables.
5. **`saveGeneration(..., 'passed')` semble défectueux.** `toJSON()` convertit d'abord les véhicules en objets JSON puis appelle `vehicle.hasPassedAll()` sur ces objets, qui n'ont plus cette méthode. Utiliser les listes explicites `['stored','finished']`, comme le fait la fin de Test.
6. **Interpolation de température aux extrêmes.** Dans `Vehicle.computeRatio()`, quand beta atteint ou dépasse le dernier seuil, la boucle renvoie le ratio précédent plutôt que celui du dernier seuil. Les courbes à un seul point `{0:1}` tombent aussi sur ce chemin. Le refroidissement effectif ne suit donc pas toujours la documentation. `nn.mutate()` remplace de plus une température nulle par 1 via `if (!temperature)`. Ne pas conclure qu'un taux nul ou une température nulle garantit un clone : une mutation est forcée.
7. **Mémoire TensorFlow à surveiller.** G2 libère systématiquement les anciens cerveaux avec dispose. Ici cette libération est commentée dans `inherit()` pour permettre la conservation ; `fromJSON()`, `train()` et le dessin du cerveau créent aussi des tenseurs sans nettoyage systématique visible. Des sessions longues peuvent accumuler des ressources. Les `tf.tidy()` de predict/copy/mutate n'assurent pas le nettoyage de tout le projet.
8. **Cas d'erreur secondaires.** `Test.dump()` cite `currentStats`, non défini dans les scripts livrés ; certains garde-fous lancent `new Exception(...)`, constructeur absent ; le chemin purge+training cite `log.warn` sans logger déclaré. Éviter de traiter ces outils secondaires comme robustes en toutes circonstances.
9. **Balai et purge : intentions à distinguer du code.** Le balai travaille par tour et selon l'ordre courant de running. La purge tronque la liste des survivants dans certaines conditions ; aucun calcul global indépendant ne garantit « les TOTAL meilleurs » dans tous les cas.
10. **ReLU et sorties non bornées.** Les couches cachées et la couche de sortie utilisent la même activation. ReLU ne borne pas les consignes entre 0 et 1 alors que steer utilise un mapping fondé sur cet intervalle. `limit.speed=0` ne rajoute pas de plafond. Cela explique certains comportements rapides sans constituer une garantie de stabilité.
11. **Collisions et checkpoints discrets.** Les mesures sont faites sur l'état courant, puis la physique avance ; elles ne balayent pas tout le segment parcouru pendant un pas. Les très grandes vitesses peuvent donc poser des problèmes de franchissement. La projection géométrique plus complète `Track.project()` existe, mais lookAround utilise surtout les murs vus par les rayons.
12. **Initialisation de Test avant le premier tueur.** Le constructeur laisse `killerTest.kills=null`, et seul `Test.begin()` crée l'objet des compteurs. Avec CHECK_TEST=false dès le démarrage, le premier nouveau tueur appelle `killerTest.accept()` et tente `uuid in this.kills` avant cette initialisation : ce chemin peut provoquer une TypeError. La configuration livrée évite ce problème en passant une fois par Test avec CHECK_TEST=true, même avec un lot vide. Les recettes génétiques ci-dessus conservent ce passage initial.
13. **Difficulté progressive ALWAYS_KILLER.** L'option commentée augmente TRICKY de l'incrément donné lors de la première déclaration d'un nouveau circuit, puis active Test au niveau cible. Elle n'adapte pas la difficulté d'après un taux de succès mesuré ; le nom « killer » ne prouve pas à lui seul que le circuit a éliminé une voiture.

## 10. Parcours de lecture conseillé et portée des modifications

Pour comprendre sans lire d'emblée tout `vehicle.js` :

1. `config.js` pour identifier l'expérience active et les assets.
2. `sketch.js` : `preload()`, `setup()`, `draw()`, puis `nextRace()`.
3. `ga.js` : `prepare()`, `classifyRunning()`, `classifyFinished()`, `next()`, `inherit()`, `pickOne()`.
4. `vehicle.js` en lecture seule : `lookAround()`, `decide()`, `steer()`, `update()`, `check()`, `calculateFitness()`, `mutate()`.
5. `test.js` : `begin()`, `next()`, `terminate()` ; puis `assets.js` pour la reprise.
6. Pour le supervisé : `Generation.prepareTraining()`, `nextTraining()`, `Vehicle.lookAndSteer()`, `Vehicle.train()`, `NeuralNetwork.train()`.

Cette intervention crée `ANALYSE.md` et ajoute uniquement des commentaires commençant par `// CODEX :` dans `config.js`, `assets.js`, `ga.js`, `nn.js`, `test.js`, `track.js`, `sketch.js` et `sketch/ui.js`. Aucun réglage, comportement, JSON ou dépendance n'est changé. `vehicle.js` est laissé strictement intact conformément à AGENTS.md ; ses mécanismes et anomalies sont expliqués dans ce document.

Le chemin de steering existant emploie p5.Vector, la différence vitesse souhaitée/vitesse courante, une limitation de force et applyForce. Les ajouts documentaires ne créent aucune entité ni mouvement et ne refondent pas l'architecture existante en dossiers behaviors/controllers. La vérification de cette intervention porte sur la lecture et la comparaison des fichiers ; aucune simulation ou campagne de tests n'a été lancée.
