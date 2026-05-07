
// Fonctions pour le calcul génétique

// const p5 = require("../0-Librairies/p5.min");

/**
  Une instance de Generation est une liste de voitures ({@link Vehicle})
  disponibles pour une course sur un circuit ({@link Track})

  On produit la première génération de manière spontanée comme
  TOTAL instances de Vehicle, en ne donnant aucun argument au
  constructeur. TOTAL est essentiellement une constante, précisée
  dans {@link Generation.config}. TOTAL est copié dans la propriété 
  {@link Generation.total} de l'instance.

  Les générations suivantes s'obtiennent soit par héritage,
  soit par dé-sérialisation, selon l'argument que l'on passe au
  constructeur.

  La méthode {@link Generation.prepare} met en place les voitures sur
  la ligne de départ d'un circuit ; {@link Generation.run} provoque 
  l'avancée de la course dans le temps.

  Selon l'état de course, la liste est segmentée en quatre
  dans {@link Generation.lists} :
  - 'finished' contient les voitures qui ont terminé
    la course
  - 'running' contient les voitures encore en course
  - 'dead' celles qui se sont craché, qui ont abandonné, ou
    qui ont été sauvagement assassinées
  - 'stored' celles qui sont encore viables, mais en surnombre
    pour participer à la course ; elle restent au garage

  Le voitures elle-mêmes ne touchent pas aux listes, mais se
  déclarent 'dead' ou 'finished' selon qu'elles rencontrent l'une
  ou l'autre des situations. Generation range dans les listes avec
  {@link Generation.classifyRunning}.

  Une fois la course terminée, {@link Generation.classifyFinished} met à jour
  la température des voitures et vide 'finished' pour remplir
  le garage.

  Les modalités du passage à la génération suivante sont contrôlées
  par la méthode {@link Generation.next}. On prend plusieurs choses en compte,
  en particulier si on se prépare pour un circuit que 
  certaines voitures ont déjà rencontré. Voir les détails
  dans {@link Generation.next}.

  La génération elle-même hérite de certaines caractéristiques
  de son parent, mais autorise les mutations. Generation choisit
  les voitures mères parmi la génération parente, mais laisse
  à Vehicle le soin de s'occuper de la mutation elle-même. Il
  y a deux méthodes importantes pour la tâche :
  - {@link Generation.calculateFitnessForAllCars} établit les probabilités de
    sélection d'une voiture mère
  - {@link Generation.inherit} sélectionne les mères et leur demande d'enfanter les 
    nouvelles voitures
 */
class Generation {
  /** Numéro de série */ static serial = 0 ;
  /** Configuration  */
  static config = {
    /** Nombre nominal de voitures à mettre en course */
    TOTAL: 30,

    // Les entrées suivantes ne sont pas directement utilisées par Generation,
    // mais par la logique de course implémentée par sketch.js. On les documente
    // ici par soucis de rangement

    /** On passe en mode test si le nombre d'anciens passe en dessous de cette limite
     * 
     * Si non nul, on passe également en auto-test si le nombre de qualifiés passe
     * sous TOTAL
     */
    AUTO_TEST: 15,
    /** Nombre de voitures devant terminer pour passer à la course suivante */
    FINISHED: true
  }

  /**
   * Si donné, CONFIG est soit une génération, qui sera le parent, soit
   * un JSON (a priori le produit d'une sérialisation 
   * précédente). La valeur {@link Generation.config.TOTAL} peut être 
   * remplacée par CONFIG comme
   * CONFIG.total ; c'est le cas en particulier quand 
   * CONFIG est le parent.
*
   * Si CONFIG est le parent, on peut donner un deuxième argument KEEP
   * comme booléen. Si KEEP, on garde dans la nouvelle génération les 
   * voitures de la liste 'running' du parent, inchangées. Sinon, ces
   * dernières sont ignorées.
   * 
   * On complète si besoin jusqu'à CONFIG.total avec de nouvelles voitures.
  */
  constructor(config, keep) {
    Generation.serial++;
    Generation.current = this

    /** Numéro de série                                */ this.serial = Generation.serial;
    /** Nombre nominal de voitures dans la génération  */ this.total = Generation.config.TOTAL

    /** Si préparé à une piste (valeur: la piste)    */ this.started = null;
    /** Statistique (nombre de vieux, de veterans...)*/ this.stats = null;
    /** Liste des voitures selon leur état */
    this.lists = {
      /** En course                                   @type {Vehicle[]}*/ running : [],
      /** Disqualifiées, assassinées ou dans le décor @type {Vehicle[]}*/ dead    : [],
      /** Course terminée                             @type {Vehicle[]}*/ finished: [],
      /** Au garage, déjà validées pour le circuit 
       * en cours, ou bien en surplus par rapport 
       * à la capacité de la piste                    @type {Vehicle[]}*/ stored  : []  
    };

    /** Voitures par uuid */
    this.ids = {}

    console.log(`generation ${this.serial}`);
    let lists = null;
    let parent = null;
    if (config instanceof Generation) {
      parent = config
    }
    if (parent) {
      lists = parent.lists
      if (parent.total < this.total || keep)
        this.total = parent.total 
    }
    if (!parent && config)
      this.fromJSON(config);
    else
      this.inherit(lists, keep);
  }

  /** Représentation externe d'une heure (HH:MM:SS) */
  static time(time)
  {
    if (!time) time = new Date
    return time.toTimeString().replace(/ .*/, "")
  }
  /** Représentation externe d'une durée (HH:MM:SS) */
  static duration(start, stop) {
    let duration = new Date(stop.getTime() - start.getTime())
    return duration.toUTCString().replace(/.*(..:..:..).*/, "$1")
  }

  /** Statistiques de génération
   * @typedef {object} Stats
   * @property   {Track} track    Circuit préparé        
   * @property     {Int} olds     Nombre total d'anciens 
   * @property     {Int} news     Nombre de nouveaux     
   * @property {Vehicle} oldest   La plus vieille        
   * @property {Vehicle} youngest La plus jeune          
   * @property {Int}     elders   Nombre de vétérans (tous tests passés)
   * @property {Int}  qualified   Nombre de qualifiés aux minis tests
   */

  /**
   * Met les voitures de cette génération en condition de départ pour un circuit donné
   * 
   * @param {Track}    track Le circuit pour lequel préparer
   * @param {?Int}     limit Si donné, limite le nombre de voitures en course
   * @returns {Stats}
   */
  prepare(track, limit) {
    let oldest = null, youngest = null
    let olds = 0, news = 0, elders = 0, qualified = 0;
    if (!track) throw 'mandatory argument TRACK is missing'

    let running = [];
    let finished = [];
    let lists = [
      this.lists.finished,
      this.lists.running,
      // this.lists.dead,
    ]

    // lists[1].sort(Vehicle.byResilience);
    // lists[2].reverse();

    let update = (vehicle) => {
      if (vehicle.old) olds++; else news++;
      if (vehicle.hasPassedAll()) {
        vehicle.elder = true
        elders++;
      }
      else
        vehicle.elder = false

      if (vehicle.elder || vehicle.qualified)
        qualified++;

      if (!oldest || oldest.old < vehicle.old)
        oldest = vehicle;

      if (!youngest || youngest.old > vehicle.old)
        youngest = vehicle;
    }

    for (let list of lists)
    {
      for (let vehicle of list) {
        update(vehicle)
        if (vehicle.prepare(track)) {
          running.push(vehicle)
        }
        else {
          finished.push(vehicle)
          vehicle.finished = -1
        }
      }
    }

    for (let vehicle of this.lists.stored) {
      update(vehicle)
      vehicle.prepare(track)
    }

    this.lists.finished = finished;
    if (limit) {
      this.lists.dead = this.lists.dead.concat(running.splice(limit));
    }

    this.lists.running  = running;
    
    let message = `${Generation.time()} ${track.id}: run=${running.length}`
    if (track.crashKills) message += ` k=${track.crashKills}`
    if (olds) message += `, ${olds}(${elders}) old(er)s; ${youngest.id} → ${oldest.id}`
    console.log(message)

    Vehicle.rank = 0; // Nombre de voitures ayant terminé

    this.started = track
    this.stats = { 
      track: track,
      olds: olds, 
      news: news,
      oldest: oldest, 
      youngest: youngest, 
      elders: elders, 
      qualified: qualified 
    }

    return this.stats
  }

  static fromJSON(json)
  {
    return new Generation(json);
  }

  fromJSON(json) {
    let array
    let running = []
    this.lists.running = running
    this.ids = {}
    this.stats = {
      olds: 0
    }

    if (Array.isArray(json))      array = json
    else                          array = [ json ]
    
    for (let json of array) {
      this.populate(json.vehicles)
    }
    if (array.length == 1) {
      json = array[0]
      if (running.length < this.total) this.total = running.length
      if (json.total) this.total = json.total
    }
  }
  populate(vehicles) {
    let running = this.lists.running
    let olds = this.stats.olds
    let ids = this.ids

    for (let config of vehicles) {
      let vehicle
      if (config instanceof Vehicle)
      {
        vehicle = config
      }
      else
        vehicle = Vehicle.fromJSON(config)

      if (vehicle.uuid in ids) continue
      ids[vehicle.uuid] = vehicle
      running.push(vehicle);
      if (vehicle.old)
        olds++
    }

    this.stats.olds = olds
  }
  concat(...others) {
    let concat = this
    for (let other of others)
      concat.populate(other.lists.running)
    return concat
  }

  toJSON(keys) {
    let gen = this
    let json = {}
    let vehicles = []
    let counts = {}

    let byUUID = (a,b) => a.uuid.localeCompare(b.uuid)

    if (keys == 'passed') {
      keys = ['stored', 'finished' ]// Object.keys(gen.lists)
      keys.push('passed')
    }
    if (!keys) keys = Object.keys(gen.lists);

    for (let key of keys)
    {
      let list = gen.lists[key];
      if (!list) continue

      counts[key] = list.length;

      for (let vehicle of list) {
        // vehicle.passed
        vehicles.push(vehicle.toJSON())
      }
    }
    if (keys.includes('passed')) {
      let passed = []

      for (let vehicle of vehicles) {
        if (vehicle.hasPassedAll())
          passed.push(vehicle)
      }

      vehicles = passed
    }
    vehicles.sort(byUUID)
    // json.type = "Generation";
    json.counts   = counts;
    json.vehicles = vehicles;
    // json.total    = this.total

    return json
  }

  /** Crée une nouvelle génération de voitures */
  inherit(lists, keep) {
    // On calcule la fitness de chaque voiture: on regarde
    // combien de checkpoints elle a passé

    let previous = lists ? Generation.calculateFitnessForAllCars(lists) : [];
    let running = []
    // let finished = []

    // On garde toutes les voitures qui ont terminé
    let i = 0;
    if (keep && lists) {
      running = lists.running
      i = running.length
      for (let vehicle of running)
      {
        vehicle.kept = true;
      }
    }
    // Pour les autres, on change de génération
    {
      for (; i < this.total; i++)
      {
        // Pour la mutation, on choisit un parent au hasard
        // 'running' est le tableau des voitures "vivantes", on
        // le remplit avec des voitures issues de la génération précédente
        // et choisies parmi les meilleures, avec de l'aléatoire et
        // des mutations possibles (c'est fait dans pickOne())
          running[i] = Generation.pickOne(previous);
      }
    }
    // On aimerait recycler les voitures abandonnées,
    // mais dispose() est plutôt délicat à manipuler
    for (let vehicle of previous) {
      if (vehicle.kept)
        delete vehicle.kept;
      // else
      //   vehicle.dispose();
    }

    this.lists.finished = [];
    this.lists.dead     = lists ? Generation.retainOlds(lists.dead) : [];
    this.lists.running  = running;
    this.lists.stored   = lists ? lists.stored : [];
  }

  /** Garde les morts (pour héritage) */
  static retainOlds(dead)
  {
    let retain = []
    for (let vehicle of dead)
    {
      if (!vehicle.old) continue
      vehicle.beta -= 1
      if (vehicle.beta < 0) vehicle.beta = 0
      retain.push(vehicle)
    }

    return retain
  }
  /** On choisit un parent au hasard dans une liste
   * 'parents'
   * Note : on peut passer 'null' comme parents pour
   * signifier une génération spontanée, sans ascendant
   * 
   * @param {Vehicle[]} parents 
   */ 
  static pickOne(parents) {
    let index = 0;
    let N = parents ? parents.length : 0;
    let child;

    if (!N) 
      child = new Vehicle()

    else {
      // Algorithme de la roulette
      // On tire un nombre r au hasard, par exemple
      // 0.5
      // On parcourt le tableau des voitures en enlevant
      // la fitness à r et on s'arrête dès que r <= 0;
      // la valeur de index est le véhicule choisi
      let r = random(1);
      while (r > 0) {
        if (index >= N) break; // Garde-fou en cas d'erreur d'arrondi
        r = r - parents[index].fitness;
        index++;
      }
      index--;

      // l'heureux élu !
      let vehicle = parents[index];
      // console.log(`picked #${index}/${N} fitness=${vehicle.fitness}`)
      // on en fait une copie et on la mute
      child = vehicle.copy();
      child.mutate(vehicle);
      child.parent = index;
    }

    return child;
  }
  
  /** Calcule 'fitness' pour chaque voiture
   * 
   * - l'argument 'lists' est une liste de tableaux de voitures, typiquement
   *   la liste Generation.lists
   * - au moins un de ces tableaux est non vide
   *
   * - toutes les voitures se retrouvent dans l'unique tableau en retour, 
   *   qui est ordonné ; la propriété 'fitness' de chaque
   *   voiture est une probabilité sur la population ainsi
   *   constituée 
   * 
   * */
  static calculateFitnessForAllCars(lists) {
    let vehicles = []
    
    for (let k in lists)
    {
      /** @type {Vehicle[]} */
      let list = lists[k];
      for (let vehicle of list) {
        vehicles.push(vehicle)
        vehicle.calculateFitness();
      }
    }

    let N = vehicles.length; // Normalement, la même chose que TOTAL

    // On réévalue fitness en prenant la résilience en compte, puis
    // on normalise en une probabilité. 
    let sum = 0;
    let fitness;

    vehicles.sort(Vehicle.byFitness) // Utile dans le cas où ELDER est défini

    for (let vehicle of vehicles) {
      sum += vehicle.fitness;
    }
    // Profitons de la normalisation pour calculer la variance
    let sum2 = 0, mean = 1.0/N; // La moyenne est 1/N après normalisation
    for (let vehicle of vehicles) {
      fitness = vehicle.fitness / sum;
      vehicle.fitness = fitness;
      sum2 += pow(fitness - mean, 2)
    }
    let log = v=> {
      let str = v.id.padEnd(16)
      str += ("" + round(v.fitness * 100)).padEnd(8)
      str += (""+ round(v.stats.vel.mean * 100))
      str += "±"
      str += ("" + round(v.stats.vel.sigma * 100)).padEnd(8)
      return str
    }
    
    console.log(vehicles.toSpliced(10).
    map(v=>log(v)).
    join('\n'))

    // Si la variance est nulle, on a probablement un bug (genre
    // on a changé de génération alors qu'on a pas fait de course)
    console.log(`sum=${sum} len=${vehicles.length} mean=${round(mean*100,1)}% sigma=${round(sqrt(sum2)/N*100,1)}%`)

    return vehicles
  }

  declareKiller(track)
  {
    for (let vehicle of this.lists.stored) {
      if (vehicle.track == track && vehicle.finished)
        vehicle.hasPassed(track, true);
    }
  }

  markQualified(killers) {
    let lists = this.lists
    let count = 0

    for (let k of [ 'stored', 'finished'])
    {
      let list = lists[k]
      for (let vehicle of list) {
        if (vehicle.hasPassedAll(killers))
        {
          vehicle.qualified = true
          count++
        }
      }
    }

    return count
  }

  removeUnqualified() {
    let lists = this.lists
    let unqualified = []
    let count = 0
    for (let k of Object.keys(lists)) {
      let list = []
      for (let vehicle of lists[k]) {
        // vehicle.elder = vehicle.hasPassedAll()
        if (vehicle.qualified || vehicle.elder)
          list.push(vehicle)
        else
          unqualified.push(vehicle)
      }
      lists[k] = list
    }
    count = unqualified.length
    lists.unqualified = unqualified

    return count
  }

  // On range les voitures qui ne sont plus en course entre 
  // les listes 'finished' et 'dead'
  classifyRunning(force)
  {
    let lists = this.lists
    let running  = lists.running
    let finished = lists.finished 
    let dead     = lists.dead     

    if (!this.started && !force) return;

    // On supprime les voitures mortes ou celles qui ont fini le circuit
    for (let i = running.length - 1; i >= 0; i--) {
      const vehicle = running[i];
      if (vehicle.finished) {
        let track = vehicle.track
        running.splice(i, 1);
        old:
        if (vehicle.lastTrack != vehicle.track ||
            (track.killer && !vehicle.hasPassed()))
        {
          vehicle.lastTrack = track
          if (track.killer) {
            if (vehicle.hasPassed(track)) break old;

            vehicle.hasPassed(track, true);
          }
          vehicle.old ++;
          vehicle.beta++;
        }
        finished.push(vehicle);
      }
      if (vehicle.dead) {
        running.splice(i, 1);
        dead.unshift(vehicle);
      }
    }

    return running.length;
  }
  
  static STATUS_RUNNING  = 1;
  static STATUS_FINISHED = 10;
  
  classifyFinished(elders)
  {
    let lists    = this.lists
    let finished = lists.finished
    let stored   = lists.stored

    if (lists.running.length)
      throw new Exception(`Race is not done running=${lists.running.length}`)

    let N = finished.length
    // stored = stored.concat(finished)
    for (let i = 0; i < N; i++)
    {
      stored.push(finished[i]);
    }

    lists.finished = [];

    this.status = Generation.STATUS_FINISHED;

    /*
    On incrémente beta pour toutes les voitures qui ont
    passé le circuit. Cela vaut en particulier pour celles
    qui étaient au garage, et n'ont par conséquent pas
    couru une nouvelle fois. Plus on peine à atteindre
    le quota de succès pour un circuit, plus les vétérans 
    doivent montrer l'exemple
    */
    if (stored.length < this.total && this.started)
    {
      for (let vehicle of stored)
        if (vehicle.hasPassed(this.started))
          vehicle.beta += 1
    }

    return N > 0;
  }

  // On avance la simulation physique de quelques unités (cycles)
  run(cycles) {
    let running = this.lists.running
    // On choisit une voiture comme étant la plus intéressante à
    // observer plus précisément. Ce sera la valeur de retour.
    // Par défaut le meilleur candidat est le premier de la population
    let best = running[0];

    // Nombre de cycles par frame ("époques par frame")
    for (let n = 0; n < cycles; n++) {
      // Pour chaque voiture
      for (let vehicle of running) {
        if (vehicle.dead || vehicle.finished) continue;

        // this.started = true;
        // On applique le comportement
        vehicle.applyBehaviors();
        // on regarde si on a passé un checkpoint
        vehicle.check();

        // classique.... on met à jour accelerations, vitesses et positions
        vehicle.update();

        // Une fois les voitures déplacées
        // On récupère la meilleure, celle qui a passé le plus de checkpoints
        if (vehicle.points > best.points) {
          best = vehicle;
        }
      }
    }
    
    return best
  }

  /**
    Trie les voitures du garage selon le fait 
    qu'elles ont déjà réussi le circuit ou non.
    Celles qui on passé se retrouvent en tête
    de liste.

    La valeur de retour est le nombre de ces voitures
  */
  sortStoreByPassed(track)
  {
    let count = 0
    let stored = this.lists.stored
    let broom = Generation.broom
    let oldest = 0

    for (let vehicle of stored)
    {
      if (vehicle.old > oldest) oldest = vehicle.old
      if (
        vehicle.hasPassed(track) &&
        vehicle != broom
        // || vehicle.lastTrack == track // TODO: Problème quand le circuit n'est pas tueur
      )
      {
        vehicle.passed[null] = 2
        // vehicle.finished = -1
        count ++
      }
      else if (vehicle == broom)
        vehicle.passed[null] = 1
      else
        vehicle.passed[null] = 0
    }

    // Parmi les voitures qui n'ont pas passé, on privilégie les anciennes.
    // dans le cadre d'une campagne de test de résilience, cela garantit

    let byPassed = (b,a) => a.passed[null]-b.passed[null]
    stored.sort(byPassed)

    return count
  }

  next(track) {
    let def = this.constructor.config
    let r = this;
    let lists  = this.lists
    let {stored} = lists
    let elders // = this.elders

    if (!track) 
      throw 'argument track is mandatory';
      
    if (this.status != Generation.STATUS_FINISHED)
      throw new Exception('Generation is not completed')

    elders = this.sortStoreByPassed(track)

    running:
    {
      if (stored.length >= this.total)
      {
        let total = this.total
        let olds = stored.length

        lists.running = stored.splice(0, this.total + elders)
        lists.dead    = []

        break running
      }

      lists.running = stored.splice(elders)
      r = new Generation(this, true);
    } // bloc 'running'

    r.status = Generation.STATUS_RUNNING;
    if (!lists.running.length)
      throw 'generation is empty'

    return r;
  }
  
  /*
    Accesseurs pour quelque décomptes utiles
  */
  get countFinished() {
    let count = this.lists.finished.length
    return count
  }

  get countStored() {
    let count = this.lists.stored.length
    return count
  }

  get countRunning() {
    let count = this.lists.running.length
    return count
  }

  get countAlive() {
    let count = this.lists.finished.length + this.lists.running.length
    return count
  }
  get countDead() {
    let count = this.lists.dead.length
    return count
  }
  get countDeadOld() {
    let count = 0
    this.lists.dead.map(v => { if (v.old && v.dead != 'murder') count++ });

    return count
  }
  get countDeadElders() {
    let count = 0
    this.lists.dead.map(v => { if (v.elder && v.dead != 'murder') count++});

    return count
  }
  get countDeadQualifiedOrElders() {
    let count = 0
    this.lists.dead.map(v => { if (v.elder || v.qualified) if (v.dead != 'murder') count++ });

    return count
  }

  get countStoredElders() {
    let count = 0
    this.lists.stored.map(v => {if (v.elder) count++});

    return count
  }
  get countElders() {
    let count = 0
    for (let k of ['stored', 'finished', 'running' ])
      this.lists[k].map(v => { if (v.elder) count++ });

    return count
  }
  get countOlds() {
    let count = 0
    for (let k of ['stored', 'finished', 'running'])
      this.lists[k].map(v => { if (v.old) count++ });

    return count
  }

  get countRunningElders() {
    let count = 0
    let total = 0
    for (let k of ['running'])
      this.lists[k].map(v => { total++; if (v.elder) count++ });

    return [count, total]
  }

  get countQualifiedOrElders() {
    let lists = this.lists
    let count = 0

    for (let k of ['stored', 'finished', 'running']) {
      lists[k].map (vehicle => {
        if (vehicle.qualified || vehicle.elder) {
          count++
        }
      })
    }

    return count
  }

  countNonElderOlderThan(old) {
    let lists = this.lists
    let count = 0

    for (let k of ['stored', 'finished', 'running']) {
      lists[k].map(vehicle => {
        if (vehicle.old > old && !vehicle.elder) {
          count++
        }
      })
    }

    return count
  }

  countHasPassed(tracks) {
    let lists = this.lists
    let count = 0

    for (let k of ['stored', 'finished', 'running']) {
      lists[k].map(vehicle => {
        if (vehicle.elder || vehicle.hasPassedAll(tracks)) {
          count++
        }
      })
    }

    return count
  }


  /** 
   * Trouver une voiture en particulier 
   * 
   * @param {string|RegExp|Number} id Une manière d'identifier (par numéro de série si Int, par nom ou uuid sinon)
   * 
   * @returns {Vehicle} 
   *   - null si aucune voiture n'a été trouvée
   *   - un tableau s'il y a au moins une correspondance
   *     et que ID est une RegExp. 
   *   - la première voiture trouvée sinon
   * 
   * Chaque voiture retournée possède
   * une propriété `origin` qui indique dans quelle liste
   * elle a été trouvée
  */
  find(id) {
    let lists = this.lists
    let found = null;
    let re = id instanceof RegExp

    found:
    if (re) {
      for (let k of Object.keys(lists)) {
        for (let vehicle of lists[k]) {
          if ((vehicle.name && vehicle.name.match(id)) || vehicle.uuid.match(id)) {
            vehicle.origin = k
            if (!found) found = []
            found.push (vehicle)
          }
        }
      }
    }
    else
      for (let k of Object.keys(lists)) {
        for (let vehicle of lists[k]) {
          if (vehicle.serial == id || vehicle.name == id || vehicle.uuid == id)
          {
            vehicle.origin = k
            found = vehicle
            break found
          }
        }
      }

    return found
  }

  /** Affiche les voitures sur la piste
   * 
   * - Si FOCUS, cette voiture est affichée en surbrillance
   *   avec des infos comme les rayons, la vitesse et l'
   *   accélération.
   * - Si INTEREST, identifie une voiture d'intérêt, à
   *   afficher aussi en surbrillance, mais sans les infos.
   *   Toutefois, si en plus {@link Vehicle.config.FOCUS_VOI}
   *   est vrai, INTEREST prend purement et simplement la place
   *   de FOCUS
   * 
   * @param {?Vehicle} focus 
   * @param {?Int|String|RegExp|Vehicle} interest 
   * - Identifie, autre directement comme Vehicle, par le numéro de série, 
   *   le nom ou l'identifiant unique (uuid)
  */
  show(focus, interest) {
    let running  = this.lists.running

    for (let vehicle of running) {
      vehicle.show();
      no:
      if (interest) {
        yes: {
          if (vehicle == interest)                     break yes
          if (vehicle.serial == interest)              break yes
          if (vehicle.name == interest)                break yes
          if (!(interest instanceof RegExp))           break no
          if (vehicle.uuid.match(interest))            break yes
          if (!vehicle.name)                           break no
          if (vehicle.name.match(interest))            break yes

          break no
        }
        vehicle.highlight({ fill: "yellow", "no-ray": 1 })
      }
    }

    // On met la voiture la meilleure en surbrillance
    if (focus)
      focus.highlight();
  }

  /** 
   * Trouve, dans le canvas, la voiture la plus proche de la souris
   * @param {Canvas} canvas 
   * @param {MouseEvent} event 
   * @returns {Vehicle} null si aucune voiture n'est à distance raisonnable
   */
  vehicleAt(canvas, event) {
    let closest = {
      /** Distance minimale */      d:10, 
      /** Voiture la plus proche @type {Vehicle} */
      vehicle: null
    }
    var rect = canvas.getBoundingClientRect(), // abs. size of element
      scaleX = 1,// canvas.width / rect.width,    // relationship bitmap vs. element for x
      scaleY = 1//canvas.height / rect.height;  // relationship bitmap vs. element for y

    let p = createVector(
      (event.clientX - rect.left) * scaleX,   // scale mouse coordinates after they have
      (event.clientY - rect.top) * scaleY     // been adjusted to be relative to element
    )

    /** @type Vehicle */
    let vehicle 
    for (vehicle of this.lists.running)
    {
      let d = vehicle.pos.dist(p)
      if (d >= closest.d) continue
      closest.d = d
      closest.vehicle = vehicle
    }

    return closest.vehicle
  }
}


