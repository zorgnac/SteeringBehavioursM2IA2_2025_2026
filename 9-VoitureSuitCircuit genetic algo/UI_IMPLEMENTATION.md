# MichelUI — première implémentation

Cette interface remplace les commandes historiques sur la branche `MichelUI`. La spécification complète reste dans [NEW_UI_SPECIFICATION.md](NEW_UI_SPECIFICATION.md) ; l'analyse du moteur initial dans [ANALYSE.md](ANALYSE.md).

## Utilisation

Servir ce dossier par HTTP (Live Server convient) et ouvrir `index.html`. Pour le serveur de prévisualisation lancé pendant l'implémentation : `http://127.0.0.1:8049/`.

1. La page commence en **observation**, en pause, avec les deux cerveaux fournis.
2. **Changer d'expérience** donne accès aux six scénarios. Choisir les ressources, puis **Préparer une nouvelle session** et **Démarrer / Reprendre**.
3. **Un pas** avance d'une seule mise à jour physique. **Pas / image** accélère les essais ; ce réglage ne change pas la force maximale ni le plafond de vitesse des voitures.
4. Cliquer une voiture ou son nom dans le tableau pour inspecter le réseau et ses dernières entrées/sorties. Les valeurs effectives tiennent compte de la symétrie.
5. **Réglages avancés** prépare une nouvelle session avec les valeurs choisies. Les propriétés d'un cerveau importé sont conservées. Les champs de graine s'appliquent uniquement à une nouvelle évolution depuis seed-c.
6. **Sauvegarder → Expérience complète** télécharge un fichier autonome : configuration, cerveaux, circuits, rôles d'apprentissage, démos et résultats disponibles. Pour le reprendre, importer ce JSON dans le sélecteur d'expérience.

Les fenêtres de préparation et d'aide suspendent la physique. Annuler rétablit l'état de pause antérieur. Les imports restent dans le navigateur et ne nécessitent pas de copier les fichiers dans assets/. Les bibliothèques p5 et TensorFlow restent chargées depuis les CDN d'origine.

## Scénarios

| Scénario | Comportement de cette version |
|---|---|
| Observer | Poids fixes, aucune reproduction ; recommencer ou changer de circuit après un échec. |
| Entraîner par évolution | Une graine seed-c, puis descendants jusqu'au quota demandé. La sinuosité proposée est 1,5. |
| Reprendre | Population importée, quota choisi explicitement, sélection et mutations. |
| Maître/élève | Maître réellement sélectionné, élève seed-c ou élève contenu dans une expérience importée ; collecte, fit et démonstrations. Une demande de pause pendant le fit suspend la physique après celui-ci. |
| Évaluer | Chaque cerveau source est remis au départ de chaque circuit ; aucun descendant. Résultats observés distingués des historiques réutilisés. |
| Balai | Référence sélectionnée ; élimination au passage de tour suivant l'ordre de progression géré par Generation. |

Les qualifications restent évolutives et se programment à la fin de la course courante. Les erreurs ou échecs du maître arrêtent la session avec un message. Les outils d'élimination/réussite artificielle sont dans le débogage avancé et indisponibles en observation/évaluation fixe.

## Archives et limites actuelles

- Les sauvegardes d'événements sont des instantanés JSON **en mémoire**. À partir de 20 archives, la simulation se suspend et demande un export. Elles disparaissent au rechargement si elles ne sont pas exportées.
- L'export d'une expérience inclut les archives puis libère leur liste en mémoire ; l'export des archives seules est aussi disponible.
- La reprise recommence une course et une collecte supervisée ; elle ne restaure pas positions, état Adam, tirages aléatoires ni un fit en cours.
- Les réglages avancés redémarrent la session. Les applications immédiates/à la prochaine course prévues dans la spécification ne sont pas toutes réalisées dans cette première version.
- Le choix du modèle élève personnalisé passe actuellement par une expérience importée ; le formulaire ne propose pas encore un import séparé du maître et de la graine élève.
- Pas encore de graphique d'historique/loss, de panneau latéral repliable, d'éditeur de courbes beta, ni de sélection manuelle d'un circuit arbitraire depuis l'onglet Circuits. L'observation parcourt les circuits de son lot avec **Autre circuit**.
- Les paramètres ahead/channels et les passes de qualification multiples restent ceux des imports ou du moteur ; ils n'ont pas encore d'éditeur dans la fenêtre avancée. Le formulaire crée une graine avec capteurs distance/sens et symétrie configurable.
- Les expériences importées reconstruisent une campagne au départ ; les bilans inclus sont des données exportées, pas un état de campagne interrompue à continuer au milieu.
- Aucun changement dans `vehicle.js` : les limites internes d'interpolation et de collision décrites dans l'analyse restent applicables.

## Modifications du moteur liées à l'UI

Le steering et les forces sont ceux de Vehicle. Les changements dans Generation/Test concernent l'orchestration : compteurs de Test initialisés dès sa construction, garde-fou de reproduction portant sur la nouvelle génération, et ordre du balai indépendant du tableau. Le passage physique parcourt une copie de la liste pour éviter qu'un tri du balai ne saute un participant.

TensorFlow libère les tenseurs temporaires du chargement JSON et du fit ; le contrôleur libère les modèles qui ne sont plus utilisés. Cela améliore la gestion de ressources sans constituer une validation d'endurance de très longues campagnes.

Les nouveaux commentaires commencent par `// CODEX :`. La configuration de scénarios est dans `scenarios.js` ; `CONFIG.Sketch.LOAD_*` décrit désormais le démarrage historique et n'est pas le sélecteur de MichelUI.

## Vérifications effectuées

- Vérification syntaxique des 17 fichiers JavaScript, et identité de vehicle.js avec HEAD.
- Parcours Chrome : affichage, pas à pas, sélection/inspection, préparation des scénarios et ouverture des réglages avancés.
- Évaluation réelle des deux cerveaux sur le circuit fourni : deux réussites observées lors de cet essai. Ce constat ne vaut pas benchmark de généralisation.
- Évolution depuis une graine : remplissage à 30, plusieurs générations et circuits, arrêt à la limite d'archives.
- Maître/élève : collecte et plusieurs phases de fit observées ; aucune garantie sur la qualité finale de l'élève.
- Export d'une expérience réellement téléchargé ; validation de ce fichier par le même validateur que les imports. Les quatre assets fournis sont acceptés, un tenseur aux valeurs incomplètes est refusé.
- La vérification complète de la réimportation par le sélecteur de fichiers et les parcours prolongés de qualification/balai restent à effectuer. Le connecteur de navigateur est devenu indisponible pendant la vérification finale ; le fichier exporté a pu être inspecté directement.

Ces vérifications portent sur une première version fonctionnelle, pas sur tous les critères de la spécification ni sur tous les navigateurs.

## Inspection pédagogique du cerveau

L'onglet Voiture présente maintenant le flux **capteurs → couches cachées → sorties**. Le bouton **Explorer le réseau et son calcul** ouvre un schéma de neurones sélectionnables, avec les connexions pondérées, les valeurs d'activation et le détail du calcul d'un neurone : somme des produits plus biais, puis ReLU/sigmoïde/tanh.

Les entrées sont nommées (proximité des murs, sens des murs et canaux optionnels), et les sorties sont reliées à l'angle et à la vitesse souhaités. Pour les voitures symétrisées, le schéma montre la branche originale et l'explication distingue la combinaison finale avec le miroir.

L'exploration suspend la physique, rejoue uniquement le réseau sur ses dernières entrées mémorisées et libère les tenseurs temporaires. Ce recalcul utilise les poids actuels ; il ne reconstitue pas une ancienne commande après un apprentissage qui a changé les poids. Aucun capteur, déplacement ou force n'est recalculé. Sans observation, les valeurs restent « — » ; faire Un pas avant d'explorer pour obtenir un exemple numérique.

La vue matricielle historique reste dans un volet **Vue technique** avec légende : poids/biais signés, normalisation des couleurs par bloc, bandes d'activations centrées sur 0,5 et dimensions W/b de chaque couche. Les couleurs de poids et d'activations n'ont pas la même échelle. Le schéma pédagogique limite le dessin à 12 neurones par couche pour les grands réseaux, mais le calcul inclut toutes les connexions.

### Codes des capteurs et apprentissage de la vitesse

L'onglet Voiture contient désormais une explication visible des angles relatifs, de la proximité normalisée et des codes de sens des murs : 1 pour le repère à gauche du rayon, 0 à droite, 0,5 sans intersection. L'option de sens pondéré possède une explication adaptée. Ces codes ne sont ni des commandes de virage, ni une preuve de bon sens de circulation.

Le volet « Apprend-elle à accélérer et à freiner ? » décrit la fonction de mérite réellement utilisée, affiche le poids de vitesse configuré et distingue évolution, imitation et observation à poids fixes. Il explique la possibilité d'un ralentissement appris, l'absence de récompense dédiée au freinage anticipé et l'absence de vitesse actuelle dans les entrées des cerveaux fournis. La dernière vitesse souhaitée et la vitesse réelle à l'état affiché sont accessibles dans les détails de la voiture ; ce sont des indicateurs d'observation, pas une preuve d'anticipation en virage.
