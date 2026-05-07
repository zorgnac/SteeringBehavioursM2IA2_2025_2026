/**
 * Circuit
 */
class Track {
  static serial = 0;
  static offset = 0; // Origine du numéro de série relatif dans 'id'
  /** Circuits tueurs @type Track[] */ static killers = [];
  /** Circuits initiaux @type World */ static initials;

  static config = {
    /** Nombre de tours à parcourir                   */ LAPS  : 3,
    /** Difficulté                                    */ TRICKY: 3,
  }

  /** @returns {String} Identifiant unique */
  static uuid() {
    //someone else's function
    //https://slavik.meltser.info/the-efficient-way-to-create-guid-uuid-in-javascript-with-explanation/
    let p8 = (s) => {
      var p = (Math.random().toString(16) + "000000000").substring(2, 2+8);
      return s ? "-" + p.substring(0, 4) + "-" + p.substring(4, 4+4) : p;
    }
    return p8() + p8(true) + p8(true) + p8();
  }

  /** Construit un nouveau circuit 
   * @param {object} config JSON (optionnel) - voir {@link Track.fromJSON}
  */
  constructor(config) {
    /** @type Track.config */   let def = this.constructor.config

    Track.serial ++;

    this.serial = Track.serial;
    /** Compte le nombre de morts inattendues
     * 
      Il s'agit de 'crash' ou de 'abandon' sur des voitures ayant
      déjà réussi au moins un circuit (dans le cadre du test),
      ou sur des voitures qualifiées (dans le cadre normal d'exploration)

      Les meurtres ne sont pas comptés.
      @type {int}
    */
    this.kills  = 0;
    /** Compte le nombre de passes sur le circuit
      depuis le dernier 'kills'
     */
    this.lastKill = 0;
    this.laps   = def.LAPS;
    this.tricky = def.TRICKY;
    this.date   = new Date()
    
    this.checkpoints = [];
    this.uuid = Track.uuid()

    const total = 60;
    let seed = { x: random(1000), y: random(1000) }
    
    // noiseSeed((new Date).getTime()) // A priori redondant avec start[XY] ci-dessus

    let a0 = -PI/2
    let a1 = TWO_PI - PI / 2

    let reverse = this.serial % 2
    if (reverse) {
      a0 = -a0
      a1 = -a1
    }
    let last, length = 0

    for (let i = 0; i < total; i++) {
      let a = map(i, 0, total, a0, a1);

      const [ x1, y1, x2, y2 ] = 
      this.constructor.checkpointModel2(a, seed.x, seed.y, this.tricky, reverse)
        
      let segment = new Boundary(x1, y1, x2, y2)
      this.checkpoints.push(segment);
      let point = segment.midpoint()
      if (last)
        length += last.dist(point)
        
      last = point
    }
    let N = this.checkpoints.length;

    // Murs du circuit
    this.walls = this.constructor.buildThatWalls(this.checkpoints);
    
    this.start  = this.checkpoints[0].midpoint();
    this.length = length + last.dist(this.start)
    // this.end   = this.checkpoints[N - 1].midpoint();
    // this.name  = this.serial;

    if (config)
      this.fromJSON(config);

    // console.log(`track tricky=${noiseMax} start=${this.start} ${width}x${height}`)
  }
  computeStartAndLength() {
    let checkpoints = this.checkpoints
    let last = checkpoints[0].midpoint(), length = 0

    this.start = last;
    for (let segment of checkpoints) {
      let point = segment.midpoint()
      length += last.dist(point)
      last = point
    }
    this.length = length + last.dist(this.start)
  }

  get id() {
    let id =  this.name 
    if (!id) {
      if (Track.offset)
        id = `+${this.serial-Track.offset}`;
      else
        id = `${this.serial}`;
    }
    return id;
  }
  toString() {
    return this.id
  }

  static elliptic(c,s,d,w) {
    let x,y

    // On arrange la géométrie selon l'ellipse naturelle
    // du canvas. Les lignes de checkpoint se croisent
    // toutes au centre du canvas, ce qui garantit
    // (sachant d>0) que le circuit ne fait pas de
    // nœud 
    [x,y] = [
      c * d * width,
      s * d * height
    ]
    let norm = sqrt(x * x + y * y);
    [c, s] = [x / norm, y / norm];

    const [x1, x2, y1, y2] = [
      width / 2 + x - w * c,
      width / 2 + x + w * c,
      height / 2 + y - w * s,
      height / 2 + y + w * s
    ]
    return [x1, x2, y1, y2]
    /* fonction inverse:
    2x = x1+x2 - width 
    2y = y1+y2 - height
    d^2 = (x/width)^2 + (y/height)^2
    c = x/width/d
    s = y/height/d

    2w*ec = x2-x1
    2w*es = y2-y1
    4w^2 = (x2-x1)^2 + (y2-y1)^2
    */
  }
  // Le modèle 2 garantit que le circuit n'est
  // pas juste impossible. Il peut être difficile
  // néanmoins
  static checkpointModel2(a, startX, startY, noiseMax, reverse)
  {
    let c, s;
    [ c, s ] = [ cos(a), sin(a) ]

    let xOff = map(c,-1,1,0,noiseMax) + startX;
    let yOff = map(s,-1,1,0,noiseMax) + startY;

    // La fonction 'noise(x,y)' fabrique une carte
    // (x,y) -> r qui est relativement lisse ; elle
    // permet de boucler un tour sans trop choquer
    // au point de départ. On s'en sert ici
    // pour calculer une distance à l'origine
    // du canvas, ainsi qu'une largeur de piste
    let d = map(noise(xOff, yOff), 0, 1, 0.1, 0.5) // Distance à l'origine
    let w = map(noise(xOff, yOff), 0, 1, 40, 60) // Longueur du segment

    const [x1, x2, y1, y2] = Track.elliptic(c, s, d, w)

    return reverse ? [x2, y2, x1, y1] : [x1, y1, x2, y2]
  }

  toSimplified(rd,rw)
  {
    if (!rd) rd = 1
    if (!rw) rw = rd

    let segments = this.checkpoints
    let inverse = segment => {
      const { a, b } = segment
      let x1,x2,y1,y2
      [x1, x2, y1, y2] = [
        a.x, b.x,
        a.y, b.y
      ]
      let x,y
      [x,y] = [
        (x1 + x2 - width) / 2,
        (y1 + y2 - height) / 2
      ]
      let d = sqrt((x / width) ** 2 + (y / height) ** 2)
      let w = sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) / 2
      let c, s
      [c, s] = [
        x/d/width,
        y/d/height
      ]
      return [x,y,d,w,c,s]
    }
    let simplify = segment => {
      let x, y, d, w, c, s
      [x, y, d, w, c, s] = inverse(segment)

      let d0 = (0.1 + 0.5) / 2
      let w0 = 50
      d = (d-d0)*rd + d0
      w = (w-w0)*rw + w0

      const [x1, x2, y1, y2] = Track.elliptic(c, s, d, w)
      segment = new Boundary(x1, y1, x2, y2)
      return segment
    }

    segments = segments.map(s=>simplify(s))
    let simplified = new Track(
      {
        tricky: this.tricky,
        laps: this.laps,
        checks: segments
      }
    )

    return simplified
  }

  /** Construit les murs sachant les segments
    de checkpoint 
    @param {Boundary[]} checkpoints 
    */
  static buildThatWalls(checkpoints) {
    let inside  = [];
    let outside = [];

    for (let check of checkpoints)
    {
      inside .push(check.a);
      outside.push(check.b);
    }
    let walls = [];
    let N = checkpoints.length;
    for (let i = 0; i < N; i++) {
      let a = checkpoints[i].midpoint()
      let b = checkpoints[(i + 1) % N].midpoint()
      let c
      const mag = 10
      let point = (new Boundary(a.x, a.y, b.x, b.y)).midpoint()

      let wall, index
      let a1 = inside[i];
      let b1 = inside[(i + 1) % N];
      index = walls.length
      wall = new Boundary(a1.x, a1.y, b1.x, b1.y)
      if (wall.signedDistance(point) < 0) {
        // throw `wrong side ${wall.signedDistance(point)}`
        wall.wrong = wall.signedDistance(point)
        wall.reverse()
      }
      c = p5.Vector.sub(wall.b, wall.a).setMag(mag)
      wall.c = c.add(wall.b)
      walls.push(wall); wall.index = index++
      let b2 = outside[i];
      let a2 = outside[(i + 1) % N];
      wall = new Boundary(a2.x, a2.y, b2.x, b2.y)
      if (wall.signedDistance(point) < 0) {
        // throw `wrong side ${wall.signedDistance(point)}`
        wall.wrong = wall.signedDistance(point)
        wall.reverse()
      }
      c = p5.Vector.sub(wall.a, wall.b).setMag(mag)
      wall.c = c.add(wall.a)
      walls.push(wall); wall.index = index++
    }
    for (let check of checkpoints)
    {
      let hits = check.hits
      if (hits) {
        for (let index in hits)
          walls[index].killer = hits[index]
      }
    }

    return walls;
  }
  /** Distance signée d'un point au circuit
   * 
   * @param {p5.Vector} p point du canvas
   * @returns {Number} distance au circuit ; si négatif, P est hors piste
   */
  distance(p) {
    return Track.distance(p, this.walls)
  }
  static distance(p, walls) {
    let N = walls.length
    
    let closest = {d: Infinity, index: -1}
    let error = m => {
      console.log(m)
      closest.type = "wallInfo"
      closest.message = m
      throw closest
    }
    let accept = (i,project) => {
      return {
        d: project.d,
        index: i,
        wall: [walls[i]],
        src: p,
        tgt: project
      }
    }

    for (let i = 0; i < N; i++)
    {
      let wall = walls[i]
      let project = wall.project(p)
      if (project.d < closest.d) closest = accept(i,project)
    }
    let end = closest.tgt.end

    if (!end) 
      closest.d = closest.tgt.sign

    else {
      let i = closest.index + 2
      if (i >= N) i -= N
      end = end + closest.index % 2
      let other = walls[i]
      
      fix: {
        let wall, project, fix = closest.index

        switch (end) {
          case "b1": if (fix != 1) error(`unexpected ${end}`); break
          case "a0": if (fix != 0) error(`unexpected ${end}`); break
          default:
            break fix
        }

        i = N + fix - 2
        wall = walls[i]
        other = closest.wall[0]
        project = wall.project(p)
        end = project.end + fix
        closest = accept(i, project)
      }
      
      closest.end = end
      closest.wall[1] = other

      let k

      switch (end) {
        case "b0": k = "a"; break 
        case "a1": k = "b"; break
        default:
          error(`unexpected end=${end}`)
      }
      let sign = other.project(closest.wall[0][k]).sign
      if (sign > 0) closest.d = -closest.d;
    }

    return closest
  }
  

  /* 
    Persistance

    On s'appuie sur les fonctions 'save' et 'load' de P5. C'est
    un peu pénible :

    - les fonctions sont dissymétriques :
      - on sauvegarde dans le répertoire de téléchargement
        du navigateur
      - on récupère depuis le répertoire du serveur (on
        choisit ici un sous-répertoire 'tracks' relatif
        à 'index.html')

      Cela demande donc de déplacer les fichiers
      à la main, à l'extérieur de l'application. Il faut
      également surveiller le répertoire de téléchargement
      vis-à-vis de renommages de fichiers autrement de même
      nom en '(1)', '(2)'... Il faut nettoyer avant de
      sauvegarder. Note : déplacer dans 'assets' réinitialise
      par défaut le serveur 'live', mais ce dernier peut être
      configuré pour ignorer des fichiers ou dossiers.

    - les fonctions sont asynchrones ; il faut prévoir
      un callback si on veut faire quelque chose une
      fois l'opération réussie

    - 'save' doit obligatoirement recevoir un nom de
      fichier d'extension '.json' ; l'erreur sinon
      est passablement obscure...

    La méthode 'toJSON' est appelée automatiquement quand on passe
    un 'Track' au 'save' P5; 
  */
  toJSON() {
    let keys = [
      "laps"  ,
      "kills" ,
      "lastKill",
      "uuid"  ,
      "tricky",
      "comment",
      "date"
    ]
    let json  = {}
    for (let key of keys) {
      if (key in this)
        json[key] = this[key]
    }

    json.checks= this.checkpoints

    return json;
  }
  fromJSON(json) {
    let checkpoints = [];
    
    for (let check of json.checks)
    {
      let point = new Boundary(
        check.a.x, check.a.y,
        check.b.x, check.b.y
      )
      if (check.hits)        point.hits = check.hits
      if (check.away)        point.away = check.away
      checkpoints.push(point);
    }
    for (let key of ["laps", "uuid", "name", "tricky", "kills", "lastKill", "comment", "date"])
      if (key in json)
        this[key] = json[key];
    
    this.checkpoints = checkpoints;
    this.walls = Track.buildThatWalls(checkpoints);
    
    this.computeStartAndLength()
  }
  static setKillers(list)
  {
    let i = 0;
    let killers = []

    let acceptTrack = (track) => {
      track.killer = true
      track.name = `killer${i++}`
      killers.push(track)
    }
    list.forEach(acceptTrack)
    Track.killers = killers;
    Track.offset  = killers.length;
  }

  // Compte les voitures ayant passé le circuit
  countPassed(vehicles) {
    let count = 0;
    let lists = vehicles
    
    if (Array.isArray(vehicles))
      lists = { finished: vehicles, stored: [], running: [] }

    if (vehicles instanceof Generation)
      lists = vehicles.lists

    for (let k of ["finished", "stored", "running"])
      for (let vehicle of lists[k]){
        if (vehicle.hasPassed(this))
          count++;
      }
    return count;
  }
  get uuidLapped() {
    return `${this.uuid}.${this.laps}`
  }
  // Cherche un circuit parmi les tueurs
  static find(id) {
    let i = Track.indexOf(id)
    let track = i >= 0 ? Track.killers[i] : null
    return track
  }
  static indexOf(id) {
    let found = -1;
    
    for (let i in Track.killers)
    {
      let track = Track.killers[i]
      if (track.serial == id || track.name == id || track.uuid == id)
      {
        found = int(i)
        break
      }
    }

    return found
  }
  /** Dessine le circuit sur le canvas de P5 */
  show() {
    // On dessine les checkpoints du circuit
    let color = "orange" // Couleur de la ligne d'arrivée
    let away  = 128
    for (let point of this.checkpoints) {
      push();
      // stroke      (point.killer ? "purple"            : color);
      // strokeWeight(point.killer ? min(4+point.killer,10) : 2    );
      stroke      (point.away ? away                 : color);
      strokeWeight(point.away ? min(4+point.away,10) : 2    );

      // un checkpoint est une ligne entre cp.a et cp.b
      line(point.a.x, point.a.y, point.b.x, point.b.y);
      color = "blue" // Couleur des autres checkpoints
      pop();
    }
    
    // on dessine les murs du circuit
    for (let wall of this.walls) {
      wall.show();
    }
  }

  declareKiller(gen) {
    let known = true;
    if (!this.killer) {
      this.killer = true;
      known       = false;
      if (!this.name)
        this.name   = `killer${Track.killers.length}`
      Track.killers.push(this);

      if (gen) 
        gen.declareKiller(this)
    }
    return !known;
  }

  static next() {
    let next
    next: {
      if (Track.initials)
        next = Track.initials.next()
      if (next) 
        break next

      next = new Track()
    }

    return next
  }
}
/** Monde de circuits */
class World {
  constructor(json) {
    this.tracks = []
    this.ids = {}
    this.index = 0

    this.populate(json)
  }
  populate(def) {
    let ids = this.ids
    if (def) {
      let tracks = def.tracks
      if (!tracks) tracks = def.killers

      if (!tracks) throw 'World definition has no track'

      for (let one of tracks) {
        let track
        if (one instanceof Track) track = one
        else track = new Track(one)
        if (track.uuid in ids) {
          console.log(`Track ${track.uuid} is a doublon`)
          continue
        }
        this.tracks.push(track)
        ids[track.uuid] = track
      }
    }
  }
  concat(...others) {
    // let concat = new World(this)
    let concat = this

    for (let other of others) {
      concat.populate(other)
    }

    return concat
  }

  /** Prochain circuit
   * 
   * Incrémente {@link World.index}
   * 
   * @returns {Track}  null si {@link World.index} est trop grand */
  next() {
    let next = this.tracks[this.index]
    if (next)
      this.index ++
    return next
  }
}
