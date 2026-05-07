function pldistance(p1, p2, x, y) {
    const num = abs((p2.y - p1.y) * x - (p2.x - p1.x) * y + p2.x * p1.y - p2.y * p1.x);
    const den = p5.Vector.dist(p1, p2);
    return num / den;
  }
  
// Voir aussi : Boundary.signedDistance
function pointToLineDistance(p1, p2, x, y) {
  /*
  v = (p2-p1)/ |p2-p1|
  d = |p^v-p1^v|
  */
  const num = abs((p2.y - p1.y) * x - (p2.x - p1.x) * y + p2.x * p1.y - p2.y * p1.x);
  const den = p5.Vector.dist(p1, p2);
  return num / den;
}

class Vehicle {
  // Indices dans le tableau de sortie de la prédiction du cerveau
  static OUTPUT_DIR = 0
  static OUTPUT_MAG = 1
  
  static config = {
    /** Taux de remplacement sur mutation      */    MUTATION_RATE: 0.1, 
    /** Sévérité d'un remplacement sur mutation*/    MUTATION_TEMPERATURE: 1,

    /** Délai d'abandon sur checkpoint 
     * 
     * Attention - il est facile de détruire des voitures de manière indue
     * à cause d'une valeur trop serrée. L'usage principal est d'abandonner quand on se
     * trompe de direction (et arrêter de polluer le canvas). La valeur peut donc 
     * être plutôt grande              */ LIFESPAN        : 3*150         ,

    /** Portée de vue                  */ SIGHT           : 100         ,
    /** Nombre de rayons               */ VIEW_SPAN       : 3           ,
    /** Angle entre rayons (degrés)    */ ANGLE           : 15          ,


    /** Couches internes du cerveau    */ HIDDEN          : 0    , 

    /** Limite de vitesse              */ MAX_SPEED       : 5           ,
    /** Limite d'accélération          */ MAX_FORCE       : 0.2         ,
    /** Limite de distance aux murs
     * 
     * La distance peut être négative. Avec -0.01, on
     * a le droit de mordre de 0.01 pixel sur le bord de 
     * piste                           */ SAFE            : 0           ,
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

  constructor(config) {
    Vehicle.serial++;
    /** Numéro de série    @type Int    */    this.serial = Vehicle.serial;
    /** Identifiant unique @type String */    this.uuid   = Track.uuid()

    /** @type Vehicle.config */
    let def     = this.constructor.config

    this.limit = {
      speed     : def.MAX_SPEED,
      force     : def.MAX_FORCE, // 0.2;
      sight     : def.SIGHT,
      safe      : def.SAFE
    }
  
    this.span         = def.VIEW_SPAN;
    this.angle        = def.ANGLE   ;
    this.hidden       = def.HIDDEN  ;

    /** Nombre de circuits terminés     */ this.old      = 0;

    /** Statistiques de parcourt */
    this.stats   = { vel: {sum1: 0, sum2: 0, mean: 0, sigma: 0}, N: 0 }

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
  }



  /** 
   * Place sur la ligne de départ 
   * 
   * @param {Track} track - Le circuit 
   */
  prepare(track) { 
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
    {
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

    return true
  }

  /**
   * Prépare le cerveau
   */
  makeBrain() {
    let width = (2 * this.span + 1)

    let hidden       = this.hidden;
    if (!hidden) hidden = width*2
    let final        = 2
    this.brain  = new NeuralNetwork(null, width, hidden, final);
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
      
      this.hidden = parent.hidden
    }
  }

  copy() {
    return new this.constructor(this)
  }
  dispose() {
    this.brain.dispose();
  }

  // Étiquettes de colonne pour 'cells' ci-dessous
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
    const ref = 2.5
    let unit = this.speedUnit / ref

    let vm = round(this.stats.vel.mean *100*unit, 0)
    let vs = round(this.stats.vel.sigma*100*unit, 0)
    let vl = round(this.stats.vel.max  *100*unit, 0)

    {
      let vel = this.vel ? round(this.vel.mag()/ref*100,0) : 0
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
  get cells() {
    let unit = this.speedUnit / 2.5

    let vm = round(this.stats.vel.mean * 100 * unit, 0)
    let vs = round(this.stats.vel.sigma * 100 * unit, 0)
    let vl = round(this.stats.vel.max * 100 * unit, 0)

    let cells = {
      attributes: {
        "class": this.old ? "Old" : "New",
        "serial": this.serial
      }
    }
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
      "hidden",
      "uuid", 
      "dead",
      "limit",
    ]
    set_if(["name", "champion"])
    set_always(keys)
    

    if (this.brain)
      json.brain = this.brain.toJSON();

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
  
  fromJSON(json) {
    for (let k in json)
    {
      this.constructor.merge(k, this, json);
    }

    if (json.brain) {
      this.brain        = new NeuralNetwork(json.brain);
      this.hidden       = this.brain.hidden_nodes;
    }

    else 
      this.makeBrain()
  }


  applyBehaviors(walls) {
    // On appelle le comportement look
    if (!walls) walls = this.track.walls;

    this.acc.set(0, 0);
    let force 

    force = this.lookAndSteer(walls);
    this.applyForce(force);
  }

  /** Applique une mutation à l'ADN (réseau de neurones) de la voiture courante */
  mutate() {
    let def = Vehicle.config
    this.brain.mutate(def.MUTATION_RATE, def.MUTATION_TEMPERATURE);
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
    let def = this.constructor.config

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
      if (this.counter > def.LIFESPAN) {
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

      if (Vehicle.onFinished) Vehicle.onFinished(this)
      if (this.onFinished) this.onFinished(this)
    }
  }

  /** Vérifie si on a atteint le checkpoint, ou si on a atteint
   *     la fin du circuit  */
  check(checkpoints) {
    /** @type Vehicle.config */ let def = this.constructor.config

    if (!checkpoints) checkpoints = this.track.checkpoints;

    if (!this.finished && !this.dead) {
      this.total++; // Nombre de ticks horloge depuis le début du tour de piste
      // On a pas fait un tout complet, on regarde quel est le checkpoint à atteindre
      // rappel : un checkpoint est une ligne avec deux points a et b
      // et la voiture doit le "franchir"
      this.goal = checkpoints[this.index];

      // Est-ce qu'on a atteint le checkpoint ?
      // La fonction pointToLineDistance calcule la distance
      // entre un point et une ligne définie par deux points
      // c'est fourni par p5.js
      const d = pointToLineDistance(this.goal.a, this.goal.b, this.pos.x, this.pos.y);
    
      if (d < 5) {
        // Si on l'a atteint, on passe au checkpoint suivant
        this.index = (this.index + 1) % checkpoints.length;
        // et on augmente le nombre de checkpoint passés ; la fitness sera calculée à partir de ce score
        this.points++;
        // this.calculateFitness();
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
   * des zones dangereuses. Les voitures assassinées
   * ne sont pas prises en compte dans l'estimation 
   * de la dangerosité du circuit.
  */
  kill(reason, walls, d)
  {
    /**@type Vehicle.config*/ let def = this.constructor.config

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
  }
  
  /** Calcul de 'fitness' */
  calculateFitness() {
    // on met la fitness au carré, pour voir si ça marche mieux
    this.fitness = pow(this.points, 2);

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
    }
    return inputs
  }

  /** Unité de vitesse. Si this.limit.speed, c'est celle-là, sinon, c'est MAX_SPEED */
  get speedUnit() {
    let limit = this.limit.speed
    if (!limit) limit = Vehicle.config.MAX_SPEED
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
  /** Décide de la consigne en fonction des capteurs */
  decide(inputs, symmetrize) {
    // symmetrize : code à venir
    let list = [inputs]
    
    let predict  = this.brain.predict(...list);

    return predict
  }
  
  // C'est LE comportement de la voiture,
  // elle va regarder autour d'elle et prendre des décisions
  // en fonction de ce qu'elle voit
  // Elle va ensuite appliquer une force pour se diriger
  // vers le checkpoint suivant
  // Elle va aussi éviter les murs
  lookAndSteer(walls) {
    const inputs = this.lookAround(walls);

    // On demande au réseau de neurones de prédire la prochaine action
    // output est un tableau à deux dimensions, deux neurones en sortie
    // output[0] est la direction
    // output[1] est la vitesse
    
    const outputs = this.decide(inputs);

    return this.steer(outputs);
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

  // Met en surbrillance la voiture
  highlight() {
    push();
    translate(this.pos.x, this.pos.y);
    const heading = this.vel.heading();
    rotate(heading);
    stroke(0, 255, 0);
    fill(0, 255, 0);
    rectMode(CENTER);
    rect(0, 0, 20, 10);
    pop();

    // On dessine aussi les rayons de la voiture en tête
    {  
      let sight = this.limit.sight
      for (let i in this.rays) {
        let ray = this.rays[i];
        let point = this.seen[i];
        // console.log(`seen ${point}`);
        ray.show(point, sight);
      }
    }
    if (this.goal) {
      this.goal.show();
    }
  }
}
