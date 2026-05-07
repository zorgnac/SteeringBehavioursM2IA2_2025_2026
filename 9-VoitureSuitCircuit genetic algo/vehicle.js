/** Vitesse de reference 
 * 
 * Doit rester la même indépendamment des évolutions
 * du code
 * */
const REF_SPEED = 2.5
/** 
 * Voiture de course
 * 
 * Le constructeur {@link Vehicle.constructor} peut prendre en argument
 * un JSON ou une voiture mère. Par défaut, la configuration
 * est définie par {@link Vehicle.config}.
 * 
 * La voiture, une fois préparée pour un circuit ({@link Vehicle.prepare}),
 * decide sa prochaine action en fonction des informations dont elle dispose 
 * ({@link Vehicle.lookAndSteer}), puis
 * calcule la dynamique physique de l'action pour un quanta de temps ({@link Vehicle.update}).
 * 
 * Une fois le circuit terminé, on estime un mérite
 * ({@link Vehicle.calculateFitness}). Cette récompense sera
 * utilisée pour décider des voitures mères
 * pour la prochaine {@link Generation}. 
 * 
 * Une voiture de nouvelle génération
 * subit une mutation génétique ({@link Vehicle.mutate}), avec un taux et
 * une sévérité qui dépendent d'une température propre. Cette température est réglée d'après
 * {@link Vehicle.beta} et {@link Vehicle.curves}.
 * 
 * Le dessin dans le canvas est assuré par {@link Vehicle.show} et {@link Vehicle.highlight}.
 * 
 * Une voiture en apprentissage ({@link Vehicle.trainee}) enregistre le parcourt de
 * son entraîneur ({@link Vehicle.follow}). Elle pourra ensuite ajuster son cerveau 
 * en conséquence ({@link Vehicle.train}).
 * 
 * Pour des versions anciennes, voir {@link Vehicle.Version}
 * 
 */
class Vehicle {
  /** Symétrie et sondes d'orientation */
  static version = "sym-dir-1"

  // Indices dans le tableau de sortie de la prédiction du cerveau
  static OUTPUT_DIR = 0
  static OUTPUT_MAG = 1
  

  /** 
   * Configuration
   * 
   * On peut découper les entrées de `config` en deux types d'usage :
   * 
   * - celles qui sont directement référencées dans le code, et
   *   qui gèrent les aspects globaux, indépendants de l'instance ;
   *   ces entrées peuvent varier selon la version de Vehicle (voir
   *   {@link {Vehicle.Version}})
   * 
   * - celles qui servent à l'initialisation de l'instance ; une
   *   instance copie les valeurs de `config`, mais ces copies
   *   ont vocation à êtres modifiées, en particulier par chargement
   *   d'une voiture précédemment sauvegardée
   * 
   * Dans l'idée, `config` est une collection de constantes (d'où la casse), mais en pratique 
   * on peut changer les valeurs en cours d'expérience. `sketch.js` écrase (via `config.js`,
   * voir {@link CONFIG.Vehicle})
   * un certain nombre de choses prédéfinies ici. C'est plutôt 'config.js' qu'il
   * toucher, sachant que les valeurs ci-dessous permettent surtout d'avoir sûrement
   * une définition, quel que soit le point de GIT qu'on choisisse.
   * 
   * Dans le cadre de la configuration d'une nouvelle génération de voiture
   * (changement de topologie de cerveau, de fonction d'activation, de limites, 
   * d'options...), il est plus clair de définir quelques voitures-modèles 
   * dans un JSON représentant une esquisse de génération, plutôt que de
   * touiller les valeurs ici ou dans 'config.js'. On peut alors charger le
   * JSON par {@link CONFIG.Sketch.LOAD_GEN} de 'config.js', tout en gardant la configuration établie.
   */
  static config = {
    /** Taux de remplacement sur mutation      */    MUTATION_RATE: 0.1, 
    /** Sévérité d'un remplacement sur mutation*/    MUTATION_TEMPERATURE: 1,

    /** Temperature en fonction de beta*/ BETA_TEMPERATURE  : {0: 1, 10:0.75, 100:0.1, 1000:0.01},
    /** Taux en fonction de beta       */ BETA_RATE         : {0: 1, 10:0.75, 100:0.1, 1000:0.01},
    /** Erosion de beta sur mort       */ BETA_FACTOR_DEAD  : 1,
    /** Erosion de beta sur héritage   */ BETA_FACTOR_INHERIT : 2/3,

    /** Délai d'abandon sur checkpoint 
     * 
     * Attention - il est facile de détruire des voitures de manière indue
     * à cause d'une valeur trop serrée. L'usage principal est d'abandonner quand on se
     * trompe de direction (et arrêter de polluer le canvas). La valeur peut donc 
     * être plutôt grande              */ LIFESPAN        : 3*150         ,

    /** Portée de vue                  */ SIGHT           : 300         ,
    /** Nombre de rayons               */ VIEW_SPAN       : 1           ,
    /** Angle entre rayons (degrés)    */ ANGLE           : 15          ,


    /** Couches internes du cerveau    */ HIDDEN          : "x2"        , 

    /** Limite de vitesse              */ MAX_SPEED       : 5           ,
    /** Limite d'accélération          */ MAX_FORCE       : 0.2         ,
    /** Limite de distance aux murs
     * 
     * La distance peut être négative. Avec -0.01, on
     * a le droit de mordre de 0.01 pixel sur le bord de 
     * piste                           */ SAFE            : 0           ,

    /** Options (capteurs et cerveau) */
    OPTIONS         : { 
      /** Désactive la symétrie                  */ 'no-sym'     : false,
      /** Sens sur tous rayons                   */ 'side-direct': true,
      /** Fonction d'activation                  */ 'activation': 'relu'
    }        ,
    // Constantes de calcul de fitness
    /** Poids de la vitesse au tour */ WEIGHT_SPEED    : 1           ,

    /** Nom de la voiture d'intérêt         */ OF_INTEREST  : 'broom',
    /** Voir {@link Generation.show}        */ FOCUS_VOI    : true
}

  static serial = 0; // Numéro de série du dernier bolide
  // Fonctions de comparaison pour sort()
  static byRank = (a,b) => {
    if (a.finished && b.finished) {
      if (a.finished != b.finished)
        return a.finished - b.finished
    }
    return b.fitness - a.fitness
  }
  /**
   * 
   * @param {Vehicle} a 
   * @param {Vehicle} b 
   * @returns 
   */
  static byPoints = (a, b) => {
    return b.points - a.points
  }
  /** Nombre de voitures arrivées dans la course en cours */
  static rank = 0 

  /** Action déclenchée quand la voiture termine un circuit 
   * @type {(v:Vehicle)=>null}
  */
  onFinished;

  /**
   * Constructeur selon configuration 
   * @param config - peut être :
   *   - null, auquel cas les propriétés sont initialisées selon {@link Vehicle.config} 
   *   - une autre voiture, auquel cas 
   *   - un JSON
   */
  constructor(config) {
    Vehicle.serial++;
    /** Numéro de série    @type Int    */    this.serial = Vehicle.serial;
    /** Identifiant unique @type String */    this.uuid   = Track.uuid()
    /** Chaîne d'héritage  @type Array  */    this.parentUuid = []

    /** @type Vehicle.config */
    let def     = this.constructor.config

    /** Limites physiques */
    this.limit = {
      speed     : def.MAX_SPEED,
      force     : def.MAX_FORCE, // 0.2;
      sight     : def.SIGHT,
      safe      : def.SAFE
    }
  
    this.span         = def.VIEW_SPAN;
    this.angle        = def.ANGLE   ;
    this.hidden       = def.HIDDEN  ;
    this.options      = def.OPTIONS ;
    /** Points de championnat */ this.champion   = 0
    /** Apprenti   @type Vehicle */ this.trainee = null
    /** Démonstrateur d'un apprenti   @type Vehicle */ this.demo = null

    this.version  = this.constructor.version;
    
    /** Nombre de circuits terminés     */ this.old      = 0;
    /** Température inverse de mutation */ this.beta     = 0;
    /** Courbes de mutation selon {@link Vehicle.beta} */
    this.curves = {
      temperature: def.BETA_TEMPERATURE,
      rate: def.BETA_RATE
    }

    /** Statistiques de parcourt */
    this.stats   = { vel: {sum1: 0, sum2: 0, mean: 0, sigma: 0}, N: 0 }

    /** Circuits (tueurs) passés 
     * @type {Object}
     *  
     * - la clé est {@link Track.uuidLapped}  
     */
    this.passed  = { }

    /** Vitesse moyenne au dernier tour 
     * 
     * Diffère de {@link Vehicle.stats} parce qu'elle
     *   rend compte de l'efficacité de parcourt 
    */
    this.speed   = 0; //  (unité en tours par durée normalisée)

    let brain  = null;
    let parent = null;
    if (config instanceof Vehicle) { // config est une autre voiture
      parent = config
      brain  = config.brain;
    }
    /** @type NeuralNetwork */this.brain = null

    if (config && !brain) // config est un JSON
      this.fromJSON(config);

    else {
      this.inherit(parent);

      // On crée le "cerveau" de la voiture
      // C'est un réseau de neurones
      // qui va prendre des décisions en fonction
      // de ce que la voiture voit
      if (brain) {
        this.brain = brain.copy();
      } else {
        this.makeBrain()
      }
    }
    this.makeSymmetry()
  }



  /** 
   * Place sur la ligne de départ 
   * 
   * @param {Track} track - Le circuit 
   */
  prepare(track, alwaysRun) { 
    if (!track) throw 'mandatory argument TRACK is missing'

    // Niveau d'adaptation (fitness).
    // Évalué en fin de course, puis réévalué (comme probabilité strictement positive) au changement de génération
    /** Niveau d'adaptation (mérite)         */ this.fitness = 0;

    /** Nombre de checkpoints passés         */ this.points = 0;
    /** Vrai (ou raison) si hors-course      */ this.dead = false;
    /** Ordre d'arrivée ou false             */ this.finished = false; // peut être également -1 si on a arrêté prématurément
    /** Circuit en cours  @type Track        */ this.track = track

    let start = track.start

    /** Position     @type p5.Vector */ this.pos = createVector(start.x, start.y);
    /** Vitesse      @type p5.Vector */ this.vel = createVector(0, 0);
    /** Accélération @type p5.Vector */ this.acc = createVector(0, 0);

    /** Indice du prochain checkpoint      */ this.index = 1; 
    /** Durée depuis le dernier checkpoint */ this.counter = 0;
    /** Nombre de tours effectués          */ this.laps = 0;

    // Statistiques
    let passed = alwaysRun ? null : this.hasPassed(track)
    if (passed) {
      this.stats = passed.stats
      this.points = passed.points
      this.speed = passed.speed
      this.laps = track.laps;
    }
    else {
      let vel = this.stats.vel;
      vel.sum1 = 0
      vel.sum2 = 0
      this.stats.N = 0;
    }

    /** Durée de vie depuis le début du tour*/ this.total = 0;
    /** Dernier événement notable           */ this.event = null;

    /** Capteurs rayon @type Ray[]          */ this.rays = [];
    /** Positions d'intersection            */ this.seen = [];

    const N = this.span, A = this.angle;
    // On crée des rayons tous les 15°, entre -45° et 45°
    // on a un angle de vision de 90° (si N=3 et A=15)
    for (let a = -N; a <= N; a++) {
      this.rays.push(new Ray(this.pos, radians(a * A)));
      this.seen.push(null);
    }

    this.active = !passed;
    /** @type Boundary */ this.goal = null

    return !passed
  }

  /**
   * Prépare le cerveau
   */
  makeBrain() {
    let width = (2 * this.span + 1)

    let direct = 0
    if (this.options['side-direct'])
      direct = width

    width        += direct;
    let hidden       = this.hidden;
    if (hidden == 'x2') hidden = width*2
    let final        = 2
    this.brain  = new NeuralNetwork(null, width, hidden, final, this.options.activation);
  }

  /** Hérite - pas de mutation ici (voir {@link Vehicle.mutate}) */
  inherit(parent)
  {
    let def = this.constructor.config

    if (parent) {
      this.limit = {}     
      for (let k in parent.limit) {
        this.limit[k] = parent.limit[k]
      }
      this.span         = parent.span     ;
      this.angle        = parent.angle    ;
      this.parentUuid = [parent.uuid].concat(parent.parentUuid)
      this.curves       = parent.curves
      this.options      = parent.options
      
      this.hidden = parent.hidden
      this.version  = parent.version       ;
      this.beta     = parent.beta*def.BETA_FACTOR_INHERIT      ;
    }
  }

  /** 
   * @returns {Vehicle}
   * */
  copy() {
    return new this.constructor(this)
  }
  dispose() {
    this.brain.dispose();
  }

  /** Étiquettes de colonne pour 'summary' ci-dessous */
  static cells = [ "n", "laps", 
    // "fit", 
    "id", "stats", 
    "avg"
  ];

  get id() {
    let id = `${this.serial}(${this.old}${this.parent != null ? "#" + this.parent : ""})`
    if (this.name)
      id = this.name;
    return id;
  }
  /** Représentation externe
  */
  toString(td) {
    let str
    let unit = this.speedUnit / REF_SPEED

    let vm = round(this.stats.vel.mean *100*unit, 0)
    let vs = round(this.stats.vel.sigma*100*unit, 0)
    let vl = round(this.stats.vel.max  *100*unit, 0)

    {
      let vel = this.vel ? round(this.vel.mag()/REF_SPEED*100,0) : 0
      let score = this.fitness ? round(this.fitness*100,0) : this.points;
      str = `${this.id} [${score}]`

      str += ` vel=${vel}% [${vm}±${vs} ${vl}]`
      if (this.laps) {
        str = str + ` lap=${this.laps+1}/${this.track.laps} avg=${round(this.speed,2)}`
      }
      else {
        if (this.track)
          str += ` lap=1/${this.track.laps}`
      }
    }
    return str
  }

  /** Résumé sous forme clé/valeur */
  get summary() {
    let unit = this.speedUnit / REF_SPEED

    let vm = round(this.stats.vel.mean * 100 * unit, 0)
    let vs = round(this.stats.vel.sigma * 100 * unit, 0)
    let vl = round(this.stats.vel.max * 100 * unit, 0)

    let cells = {
      attributes: {
        "class": this.old ? "Old" : "New",
        "serial": this.serial
      }
    }
    cells.score = this.points
    cells.vel = this.vel ? round(this.vel.mag() / REF_SPEED * 100, 0) : 0

    if (this.finished) cells.n     = this.finished
    if (this.laps    ) cells.laps  = this.laps
    if (this.laps    ) cells.avg   = round(this.speed, 2)
    cells.id    = this.id
    cells.stats = `${vm}%±${vs}`
    cells.max   = vl

    return cells
  }
  toJSON() {
    let json = {};

    let set_always = (keys) => {
      for (let k of keys)
        json[k] = this[k];
    }
    let set_if = (keys) => {
      for (let k of keys)
        if (k in this)
          json[k] = this[k];
    }

    let keys
    keys = [ 
      "version", 
      "span", 
      "angle", 
      "old", 
      "beta", 
      "hidden",
      "uuid", 
      "dead",
      "limit",
      "curves",
      "options",
    ]
    set_if(["name", "champion"])
    set_always(keys)
    
    set_if([ 
      "ahead",
      "parentUuid", 
      "qualified" 
    ])

    if (this.brain)
      json.brain = this.brain.toJSON();

    set_always(["passed"])

    return json
  }

  /** Fusionne la valeur par défaut et la valeur du JSON */
  static merge(k, tgt, src) {
    done: {
      if (!(k in tgt) || !tgt[k]) {
        tgt[k] = src[k]
        break done
      }

      if (Array.isArray(src[k])) {
        tgt[k] = src[k]
        break done
      }
      if (typeof src[k] == typeof {}) {
        let src_k = src[k], tgt_k = tgt[k]
        for (let k in src_k)
          Vehicle.merge(k, tgt_k, src_k)
        break done
      }
      
      tgt[k] = src[k]
    }
  }

  /** Aiguillage de version */
  static fromJSON(json)
  {
    let vehicle = null;
    let version = json.version

    found: 
    {
      if (version in Vehicle.Version) {
        vehicle = new Vehicle.Version[version](json)
        break found
      }
      if (version == Vehicle.version) {
        vehicle = new Vehicle(json)
        break found
      }

      console.warn(`version ${version} is not know. using default`)
      vehicle = new Vehicle(json)
    }

    return vehicle;
  }
  
  fromJSON(json) {
    for (let k in json)
    {
      switch (k) {
        case "channels": // Certains champs doivent être pris tels quels
        case "options":
          this[k] = json[k];
          break
        default: // Les autres doivent surcharger les définitions précédentes
          this.constructor.merge(k, this, json);
      }
    }

    if (!this.beta) 
      this.beta = this.old;

    if (json.brain) {
      this.brain        = new NeuralNetwork(json.brain);
      this.hidden       = this.brain.hidden_nodes;
    }

    else 
      this.makeBrain()
  }

  /** Consulte ou déclare si on a déjà passé un circuit
   * 
   * VALUE peut être :
   * - false, auquel on oublie le circuit
   * - une valeur dont la conversion booléenne est 'vrai', auquel
   *   cas on remplit notre mémoire avec nos dernières statistiques de parcourt
   * - autre chose, auquel on ne touche à rien
   * 
   * Retourne les statistiques du circuit
   * @param {Track} track
  */
  hasPassed(track, value)
  {
    let undef
    if (!track) track = this.track
    
    let key = track.uuidLapped
    if (value == false)
      delete this.passed[key]

    if (value) {
      let src = this.stats.vel
      this.passed[key] = {
        stats : {
          vel: {
            mean:src.mean,
            var: src.var,
            sigma: src.sigma,
            max: src.max
          }
        },
        points: this.points,
        speed : this.speed
      }
    }

    return this.passed[key]
  }
  hasPassedAll(tracks) {
    if (!tracks) tracks = Track.killers
    for (let track of tracks) {
      if (!this.hasPassed(track))
        return false
    }

    return true
  }

  applyBehaviors(walls) {
    // On appelle le comportement look
    if (!walls) walls = this.track.walls;

    this.acc.set(0, 0);
    let force 

    force = this.lookAndSteer(walls);
    this.applyForce(force);
  }

  /** Calcule la valeur selon une courbe linéaire par morceaux
   * @param {Number} b - abscise, typiquement {@link Vehicle.beta}
   * @param {Object} b10 - définition de la courbe, typiquement parmi {@link Vehicle.curves}
   * @returns {Number} ordonnée
   * 
   * @example
   * b10 = { "10": 0.1, "100": 0.05 }
   * computeRatio(0,b10) == 1
   * computeRatio(5,b10) == 0.55
   * computeRatio(100,b10) == 0.05
   * computeRatio(1000,b10) == 0.05
   */
  static computeRatio(b, b10)
  {
    if (!b10) b10 = { 10:0.1 }
    let r0 = 1
    let b0 = 0
    let r = 0

    found: 
    {
      for (let b1 in b10) {
        let r1 = b10[b1]
        b1 = int(b1)
        if (b < b1) {
          r = (b-b0)*r1 + (b1-b)*r0
          r = r/(b1-b0)
          break found
        }
        r  = r0
        r0 = r1
        b0 = b1
      }
    }
    return r
  }
  /** Applique une mutation à l'ADN (réseau de neurones) de la voiture courante */
  mutate(parent) {
    const {
      MUTATION_TEMPERATURE,
      MUTATION_RATE
    }    = this.constructor.config

    let ratio  = this.constructor.computeRatio
    let beta   = parent.beta

    let curves = this.curves
    let temperature = ratio(beta, curves.temperature)*MUTATION_TEMPERATURE
    let rate        = ratio(beta, curves.rate)       *MUTATION_RATE

    this.brain.mutate(rate, temperature);
  }

  applyForce(force) {
    this.acc.add(force);
  }

  /** Met à jour la statistique de vitesse */
  updateStats() {
    let vel = this.vel.mag()/this.speedUnit
    let V = this.stats.vel
    this.stats.N        += 1;
    V.sum1 += vel;
    V.sum2 += vel*vel;
    let N = this.stats.N

    if (!V.max || vel > V.max)
      V.max = vel
    
    V.mean  = V.sum1/N
    V.var   = V.sum2/N - V.mean*V.mean
    V.sigma = sqrt(V.var)
  }

  /** Met à jour la position et la vitesse en fonction de l'accélération */
  update() {
    const { LIFESPAN } = this.constructor.config

    if (!this.dead && !this.finished) {
      this.pos.add(this.vel);
      this.vel.add(this.acc);

      if (this.limit.speed)
        this.vel.limit(this.limit.speed);
      // this.acc.set(0, 0);

      // On incrémente le compteur
      // si on dépasse le temps de vie
      // on meurt, on tue la voiture
      this.counter++;
      if (this.counter > LIFESPAN) {
        this.kill('abandon');
      }

      // on a fait déplacer et tourner la voiture, on va
      // aussi faire tourner les rayons
      for (let i = 0; i < this.rays.length; i++) {
        this.rays[i].rotate(this.vel.heading());
      }

      // On accumule des statistique de vitesse
      this.updateStats()
    }
  }
  /** Suit la position d'une voiture modèle pour entraînement */
  follow(trainer) {
    let limit = 'incompatible limits'
    if (this.limit.speed != trainer.limit.speed)
      if (this.limit.speed && trainer.limit.speed)
        throw 'incompatible speed limits'
    if (this.limit.force < trainer.limit.force)
      throw 'incompatible force limits'

    this.pos = trainer.pos
    this.vel = trainer.vel
    this.track = trainer.track
    this.index = trainer.index

    // if (!this.rays) 
    {
      const N = this.span, A = this.angle;
      this.rays = []
      // On crée des rayons tous les 15°, entre -45° et 45°
      // on a un angle de vision de 90° (si N=3 et A=15)
      for (let a = -N; a <= N; a++) {
        this.rays.push(new Ray(this.pos, radians(a * A)));
        // this.seen.push(null);
      }
    }
    for (let i = 0; i < this.rays.length; i++) {
      this.rays[i].rotate(this.vel.heading());
    }
  }

  /** Ajustements supplémentaires quand on boucle un tour */
  onlap() {
    this.speed = pow(2,this.track.length/this.total)-1
    this.total = 0
    this.event = 'lap';
    this.laps++
    if (this.laps >= this.track.laps) {
      Vehicle.rank++
      this.finished = Vehicle.rank
      this.event = 'finished';
      if (Vehicle.rank <= 10)
        this.champion += 1 / Vehicle.rank

      if (Vehicle.onFinished) {
        for (let k in Vehicle.onFinished) Vehicle.onFinished(this)
      }
      if (this.onFinished) {
        for (let k in this.onFinished) {this.onFinished[k](this)}
      }
    }
  }

  /** Constate l'activité et vérifie si on a atteint le prochain passage cible
   * 
   * Agit en conséquence, en particulier si on vient de boucler un tour
   * @param {Boundary[]} checkpoints */
  check(checkpoints) {
    if (!checkpoints) checkpoints = this.track.checkpoints;

    if (!this.finished && !this.dead) {
      this.total++; // Nombre de ticks horloge depuis le début du tour de piste
      // On a pas fait un tout complet, on regarde quel est le checkpoint à atteindre
      // rappel : un checkpoint est une ligne avec deux points a et b
      // et la voiture doit le "franchir"
      this.goal = checkpoints[this.index];

      // Est-ce qu'on a atteint le checkpoint ?
      const d = this.goal.project(this.pos).sign
    
      if (d < 0) {
        // Si on l'a atteint, on passe au checkpoint suivant
        this.index = (this.index + 1) % checkpoints.length;
        // et on augmente le nombre de checkpoint passés ; la fitness sera calculée à partir de ce score
        this.points++;
        
        this.event = 'checkpoint';
        this.counter = 0;
        if (this.index == 1) { // Un nouveau tour bouclé
          this.onlap()
        }
      }
    }
  }

  /** Met la voiture hors course 
   * 
   * Selon la raison, met à jour le circuit vis-à-vis
   * des zones dangereuses et globalement sur sa dangerosité.
   * 
   * Les voitures assassinées (reason='murder')
   * ne sont pas prises en compte dans l'estimation 
   * de la dangerosité du circuit.
  */
  kill(reason, walls, d)
  {
    const { BETA_FACTOR_DEAD } = this.constructor.config

    const { track, index } = this;
    if (this.dead)      return;
    if (this.finished)  return;

    if (this.old) {
      let point = track.checkpoints[index];
      if (reason == 'crash') {
        if (walls) {
          if (!point.hits) point.hits = {}
          if (!Array.isArray(walls)) walls = [walls]
          for (let wall of walls) {
            if (!wall.killer) wall.killer = 0
            wall.killer++;
            point.hits[wall.index] = wall.killer
          }
        }
      }
      if (reason == 'abandon') {
        if (!point.away) point.away = 0;
        point.away ++;
      }

    }
    if (!reason) reason = 'murder';
    if (this.old > 10 || this.name)
      console.log(`lost ${this} due to ${reason}`)

    this.event = reason;
    this.dead  = reason;
    this.beta *= BETA_FACTOR_DEAD
  }
  
  /** Calcul de 'fitness' */
  calculateFitness() {
    const {WEIGHT_SPEED} = this.constructor.config
    let speed = WEIGHT_SPEED*this.speed 

    this.fitness = (1 + this.points) * (1 + speed) / 
      ((this.track.laps*this.track.checkpoints.length+1)*(1+WEIGHT_SPEED))

    // on met la fitness au carré, pour voir si ça marche mieux
    this.fitness = pow(this.fitness, 2);

    // On pourrait booster la fitness si on a fini le circuit....
    // if (this.finished) {
    // } else {
    //   const d = p5.Vector.dist(this.pos, target);
    //   this.fitness = constrain(1 / d, 0, 1);
    // }
  }

  /** Observe les positions des murs selon les rayons */
  lookAround(walls) {
    // Lancement des rayons
    // On va regarder autour de nous
    // pour voir si on a des murs
    const inputs = [];
    this.seen = [];

    let closest
    try {
      closest = Track.distance(this.pos, walls)
    }
    catch (x) {
      if (x.type == "wallInfo")
        x.vehicle = this
      throw x
    }
    let direct = this.options["side-direct"] ? "side" : null
    if (direct)
      this.direct = []

    if (closest.d < this.limit.safe)
      this.kill('crash', closest.wall, closest.d);

    // Pour chaque rayon
    for (let i = 0; i < this.rays.length; i++) {
      const ray = this.rays[i];
      let closest = {point: null, d: Infinity};
      // let record = this.limit.sight;

      // Pour chaque mur
      for (let wall of walls) {
        // On regarde si le rayon intersecte le mur en question
        const point = ray.cast(wall);
        if (point) {
          const d = p5.Vector.dist(this.pos, point);
          if (d < closest.d) {
            closest.d  = d;
            closest.wall = wall
            closest.point = point
          }
        }
      }

      // On se rappelle le point d'intersection pour le dessiner
      // sur le canvas
      this.seen[i] = (closest.d <= this.limit.sight)  ? closest.point : null;

      // On met la couche de neurone en entrée avec des valeurs entre 0 et 1
      // Rappel, on a i rayons (on est dans une boucle for sur les rayons
      // et on a une couche d'entrée avec autant de neurones que de rayons
      let input = map(closest.d, 0, this.limit.sight, 1, 0)
      if (input < 0) input = 0
      if (input > 1) input = 1
      inputs.push(input) ;

      if (!direct) continue
      // On garde dans this.direct le point "c" du mur le
      // le plus proche ; "c" indique l'orientation du mur, que l'on
      // transforme en un "sign" (0 ou 1)
      if (!closest.wall) this.direct[i] = { point: this.pos, sign: 0.5 }
      else {
        let c = closest.wall.c
        let pc = p5.Vector.sub(c, this.pos)
        let pp = p5.Vector.sub(closest.point, this.pos)
        let sign = p5.Vector.cross(pc, pp).z
        sign = sign > 0 ? 1 : 0
        
        this.direct[i] = { point: c, sign: sign }
      }
    }

    if (direct) {
      // On pousse "sign" qu'on vient de calculer
      for (let side of this.direct) {
        inputs.push(side.sign)
      }
    }

    return inputs
  }

  /** Unité de vitesse. Si this.limit.speed, c'est celle-là, sinon, c'est REF_SPEED */
  get speedUnit() {
    let limit = this.limit.speed
    if (!limit) limit = REF_SPEED
    return limit
  }

  /** Calcule la force à appliquer pour obtenir la direction souhaitée */
  steer(output) {
    let angle = map(output[Vehicle.OUTPUT_DIR], 0, 1, -PI, PI);
    let speed = map(output[Vehicle.OUTPUT_MAG], 0, 1, 0, this.speedUnit);
    angle += this.vel.heading();

    // Calcul de la force à appliquer
    // On calcule un vecteur à partir de l'angle et de la vitesse
    // c'est la vitesse souhaitée
    const targetVelocity = p5.Vector.fromAngle(angle);
    targetVelocity.setMag(speed);

    // force = vitesse souhaitée - vitesse actuelle
    let force = p5.Vector.sub(targetVelocity, this.vel);
  
    // On limite la force
    force.limit(this.limit.force);

    // On applique la force
    return force;
  }


  /** Compose la symétrie des capteurs */
  makeSymmetry() {
    let sym = new Vehicle.Symmetry

    // Partie 'rays' : symétrie par rapport à un pivot
    let n = this.span*2+1
    sym.symPivot(n)

    // Booléen directionnel: sens de parcourt
    if (this.options['side-direct']) {
      sym.antiPivot(n)
    }

    this.symmetry = sym

    return sym
  }

  /** Décide de la consigne en fonction des capteurs */
  decide(inputs, symmetrize) {
    if (symmetrize == null) symmetrize = !this.options['no-sym']
    // if (!inputs) inputs = this.brain.last_predict.inputs[0]

    let list = [inputs]
    
    if (symmetrize) {
      list.push(this.symmetry.apply(inputs))
    }

    let predict  = this.brain.predict(...list);

    if (symmetrize) 
    {
      /* predict est [ ...direct, ...reverse ] */
      let symmetric = []
      
      symmetric[Vehicle.OUTPUT_MAG] = (predict[Vehicle.OUTPUT_MAG] + predict[Vehicle.OUTPUT_MAG+2]) / 2
      symmetric[Vehicle.OUTPUT_DIR] = (predict[Vehicle.OUTPUT_DIR] - predict[Vehicle.OUTPUT_DIR+2] + 1) / 2

      predict = symmetric
    }

    return predict
  }
  
  // C'est LE comportement de la voiture,
  // elle va regarder autour d'elle et prendre des décisions
  // en fonction de ce qu'elle voit
  // Elle va ensuite appliquer une force pour se diriger
  // vers le checkpoint suivant
  // Elle va aussi éviter les murs

  /** Regarde, décide et agit */
  lookAndSteer(walls) {
    const inputs = this.lookAround(walls);

    let trainee = this.trainee

    // On demande au réseau de neurones de prédire la prochaine action
    // output est un tableau à deux dimensions, deux neurones en sortie
    
    const outputs = this.decide(inputs);
    if (trainee) {
      let data = trainee.data
      if (!data) {
        data = trainee.data = { inputs: [], outputs: [] }
      }
      trainee.follow(this)

      data.inputs.push(trainee.lookAround(walls))
      data.outputs.push(outputs)
    }

    return this.steer(outputs);
  }

  /** Entraînement sur donnée */
  train(onTrain) {
    let data = this.data
    if (!data) {
      throw 'no data'
    }
    if (!data.inputs || !data.inputs.length)
    {
      throw 'empty data'
    }

    /** @typedef TrainingData Donnée d'entraînement
     * @property {number[][]} inputs
     * @property {number[][]} outputs
     * @property {number} loss Valeur de fonction de coût
     */
    /** @type TrainingData */ this.data = null
    let loss = this.brain.train(data.inputs, data.outputs, onTrain)
    loss.then(v => this.data = {
      loss: v,
      inputs: [],
      outputs: []
    })

    return loss
  }

  /** Dessin de la voiture */
  show() {
    if (!this.pos)
      console.log(`${this}: no pos`)
    else {
      push();
      translate(this.pos.x, this.pos.y);
      const heading = this.vel.heading();
      rotate(heading);
      if (this.old)
        stroke(255, 0, 0);
      fill(255, 100);
      rectMode(CENTER);
      rect(0, 0, 10, 5);
      pop();
    }
  }

  showArrow(point,c) {
    push()
    noFill() // fill(0, 255, 0)
    stroke(0, 255, 0)
    strokeWeight(1)
    let dp = p5.Vector.sub(c, point)
    const size = 3
    translate(point.x, point.y)
    rotate(dp.heading())
    translate(-size / 2, 0)
    triangle(0, size / 2, 0, -size / 2, 2 * size, 0)
    pop()
  }

  /** Met en surbrillance la voiture */
  highlight(config) {
    if (!config) config = {}

    push();
    translate(this.pos.x, this.pos.y);
    const heading = this.vel.heading();
    rotate(heading);
    if (this.old)
      stroke(255,0,0);
    else
      stroke(0, 255, 0);

    if (config.fill)
      fill(config.fill);

    else 
      fill(0, 255, 0);

    rectMode(CENTER);
    rect(0, 0, 20, 10);
    pop();
    if (!config["no-ray"]) {
      // On dessine aussi les rayons de la voiture en tête
      let sight = this.limit.sight

      let direct = this.direct
      for (let i in this.rays) {
        let ray = this.rays[i];
        let point = this.seen[i];
        ray.show(point, sight, direct);
        if (direct && point)
          this.showArrow(point, direct[i].point)
      }

      // Vecteur vitesse et accélération
      push();
      translate(this.pos.x, this.pos.y);
      const mag = 10;
      let max = this.vel.copy()

      max.setMag(this.speedUnit * mag);

      strokeWeight(1);
      stroke(255, 0, 0, 255);
      line(0, 0, max.x, max.y);

      strokeWeight(3);
      stroke(255, 0, 0, 255);
      line(0, 0, mag * this.vel.x,  mag * this.vel.y);

      stroke(255, 255, 0);
      let MAX_FORCE = this.limit.force
      line(0, 0, mag * this.acc.x / MAX_FORCE, mag * this.acc.y / MAX_FORCE);
      pop();
    }
    if (this.goal) {
      this.goal.show();
    }
  }

  static Symmetry = (function() {
    /** Symétrie des capteurs */
    class Sym {
      constructor() {
        /** index       */ this.i = 0
        /** permutation */ this.r = []
        /** signe       */ this.s = []
        /** décalage    */ this.o = []
      }

      antiPivot(di) {
        let { r, s, o, i } = this
        for (di--; di >= 0; di--) {
          r[i] = this.i + di
          s[i] = -1
          o[i] = 1
          i++
        }
        this.i = i
      }
      symPivot(di) {
        let { r, s, o, i } = this
        for (di--; di >= 0; di--) {
          r[i] = this.i + di
          s[i] = 1
          o[i] = 0
          i++
        }
        this.i = i
      }
      antiPlace(di) {
        let { r, s, o, i } = this
        for (; di > 0; di--) {
          r[i] = i
          s[i] = -1
          o[i] = 1
          i++
        }
        this.i = i
      }
      copy(di) {
        let { r, s, o, i } = this
        for (; di > 0; di--) {
          r[i] = i
          s[i] = 1
          o[i] = 0
          i++
        }
        this.i = i
      }

      /** Applique la symétrie à une couche d'entrée
       * @param {number[]} inputs
       */
      apply(inputs) {
        let { r, s, o } = this
        let symmetric = []

        for (let i in inputs) {
          symmetric[i] = inputs[r[i]] * s[i] + o[i]
        }

        return symmetric
      }

    }

    return Sym
  } )()

  /** Différentes version du code
   * 
   * L'usage principal est de récupérer des JSON de
   * vielles voitures et de restituer leur comportement
   * avec le code à jour. On peut composer des générations
   * avec des voitures de versions différentes 
   */
  static Version = null

  // Méthodes de tests divers
  rotate() {
    this.vel.mult(-1)
  }
}

Vehicle.Version = (function() {
  class V6 extends Vehicle {
    static version = 6

    constructor(config) {
      if (config.channels) {
        if (Object.keys(config.channels).length)
          throw `cannot emulate V6 channels`
      }
      if (config.ahead)
        throw `cannot emulate V6 ahead sensors`
      if (config.options) {
        for (let key of ['behind', 'direct']) {
          if (config.options[key])
            throw `cannot emulate V6 '${key}' option`
        }
      }

      super(config)
    }
  }
  
  class V1 extends Vehicle {
    static version = 1

    constructor(config) {
      if (!config) config = {
        span: 3,
        hidden: "x2",
      }
      
      config.curves = {
        temperature: { 0: 1 },
        rate: { 0: 1 }
      }

      if (!config.options) {
        config.options = {
          "activation": "sigmoid"
        }
      }

      config.options["no-sym"] = true

      super(config)
    }
  }

  let versions = {}
  for (let model of [V1, V6]) {
    versions[model.version] = model
  }

  return versions
}
)()
