/**
 * Configuration
 * 
 * On peut se souvenir d'une configuration alternative par deux moyens :
 * 
 * - écrire un autre JS (e.g. `config-a0.js`) et référencer celui qu'on veut dans index.html ;
 *   l'inconvénient est qu'on ne peut charger qu'un seul de ces fichiers, et qu'on
 *   risque d'oublier des champs ou de la doc d'un côté ou de l'autre
 * 
 * - écrire un JSON (exemple ci-dessous) qui modifie quelques entrées et le nommer dans
 *   {@link CONFIG.Sketch.LOAD_CONFIG} ; l'inconvénient est que JSON est trop strict,
 *   et par conséquent pénible à écrire et maintenir.
 * 
 * Pour tester de nouvelles configurations de voitures, on peut vouloir
 * définir un JSON de génération et le nommer dans {@link CONFIG.Sketch.LOAD_GEN}. 
 * Plus de détails dans {@link Vehicle.config}.
 * 
 * @example #config-a0.json
 * {
 *   "Track": {
 *     "TRICKY": 4
 *   },
 *   "Sketch": {
 *     "LOAD_KILLERS": "killerTracks/initial-4"
 *   }
 * }
 */

let CONFIG = { 
    /* Les entrées autres que Sketch (c'est à dire Vehicle, Track...) sont recopiées dans 
       les configurations des classes correspondantes(Vehicle.config, Track.config...)
        
       On donne des définitions initiales dans un pur but de documentation. Elles
       sont est écrasées un plus loin par des fonctions ou des blocs qui permettent
       de renseigner les valeurs de manière un peu plus confortable qu'on ne 
       pourrait le faire ici.
    */ 
    /** Voir {@link Vehicle.config} */    Vehicle: {},
    /** Voir {@link Track.config}   */    Track: {},
    /** Voir {@link Generation.config} */ Generation: {},
    /** Voir {@link Test.config}       */ Test: {},
    /**
     * Les définitions LOAD_* nomment des JSON présents dans
     * le sous-répertoire assets. La génération peut être une
     * voiture, une génération, ou une liste composée de telles
     * choses. Les mondes peuvent être des circuits, des mondes, ou une
     * listes de telles choses.
     * 
     * On peut oublier l'extension .json
     */
    Sketch: {
        /** Configuration prédéfinie (JSON) @type string            */ LOAD_CONFIG : null,
        /** Génération prédéfinie           @type {string|string[]} */ LOAD_GEN    : null,
        /** Monde de circuits prédéfinis    @type {string|string[]} */ LOAD_TRACKS : null,
        /** Monde de circuits tueurs        @type {string|string[]} */ LOAD_KILLERS: null,

        /** Voiture en apprentissage                    
         * 
         * Sous la forme : 'GEN:TRAINEE:TRAINER'
         * avec :
         * - GEN le fichier de génération qui contient l'élève
         * - TRAINEE le nom de l'élève (facultatif)
         * - TRAINER le nom de du maître dans la génération LOAD_GEN (facultatif)
         * 
         * Les deux séparateurs (:) doivent être présents si l'un ou l'autre
         * de TRAINEE ou TRAINER est donné
         *                       @type {string} */ TRAINING    : null,

        // État initial de l'interface utilisateur
        /** Case Test cochée     @type boolean  */ CHECK_TEST  : null,
        /** Case Killer cochée   @type boolean  */ CHECK_KILLER: null,
        /** Case Purge cochée    @type boolean  */ CHECK_PURGE : null,
        /** Case Pause cochée    @type boolean  */ CHECK_PAUSE : null,
        /** Étages d'ascenseur   @type {int[]}  */ RATES       : null,
        /** Valeur de speed      @type int      */ SPEED       : 2,

        /** Mode de définition de circuits initiaux tueurs  
         * 
         * Valeur : [ TRICKY, DT ]
         * 
         * Si non-null, les nouveaux circuits sont de plus
         * en plus tueurs (depuis TRICKY et par incrément DT) jusqu'à atteindre le niveau
         * défini par {@link Track.config.TRICKY}. 
         * 
         * Le niveau de difficulté d'un
         * circuit est {@link Track.tricky}    */ ALWAYS_KILLER:null,
    }, 

    /** Configure selon diverses sources de configuration 
     * 
     * CONFIG est définit dans 'config.js', et surcharge
     * les configurations par défaut des différentes classes. La
     * surcharge elle-même n'est activée qu'à l'appel de CONFIG.setup.
     * 
     * La méthode 'setup' est virtuelle ; elle est normalement implémentée 
     * dans 'sketch.js' (ou 'Asset')
    */
    setup: () => null
}

CONFIG = new Asset(CONFIG)

{
    let def = CONFIG.Sketch

    // def.LOAD_CONFIG = 'config/miage-0'
    def.LOAD_CONFIG = 'config/training'

    def.LOAD_GEN = [
        'car-simple-1',
        // 'gen-h9x6c1-2',
        // 'gen-h9x6c1-f05',
        // 'gen-sym-dir-1',
        // 'seed-v1'
        // 'seed-c',
        // 'seed-f1'
        // 'gen64'
    ]

    def.LOAD_TRACKS = [
        // 'initialTracks'
    ]
    def.LOAD_KILLERS = [
        // 'trk-simple-1',
        // 'killerTracks/standard',
        // 'killerTracks',
        //  'initialTracks',
    ]

    // def.TRAINING = 'seed-c::h9x6c1-f05'
    // def.ALWAYS_KILLER = [ 1.5, 0.5 ]

    def.CHECK_TEST = true
    // def.CHECK_PURGE = true
    // def.CHECK_PAUSE = true
    def.RATES = [0, 1, 2, 5, 10, 15, 20, 30];
}

// ----------------------------------------------------
CONFIG.Vehicle = function () {
    let def = Vehicle.config

    def.LIFESPAN = 150
    
    return CONFIG.Vehicle
}


// ----------------------------------------------------
CONFIG.Track = function () {
    let def = Track.config;

    def.TRICKY = 6.5; 3; 
    def.LAPS = 2;

    return CONFIG.Track
}

// ----------------------------------------------------
CONFIG.Generation = function() {
    let def = Generation.config

    def.TOTAL = 30; 1;
    def.BROOM = 'broom' // On tue systématiquement les voitures plus lentes que celle-ci

    def.AUTO_TEST = 10; 
    def.FINISHED = true;

    return CONFIG.Generation
}

// ----------------------------------------------------
CONFIG.Test = function() {
    let def = Test.config

    def.MIN_ELDERS = 5
    def.MAX_TRACKS = 10; 0;
    def.FULL = true

    return CONFIG.Test
}

