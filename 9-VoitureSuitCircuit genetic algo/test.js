/**
 * Protocole de qualification
 * 
 * La qualification se fait sur les circuits tueurs
 * déclarés dans {@link Track.killers}.
 * 
 * On définit deux modes de test :
 * - le test sur tous les tueurs
 * - le test partiel sur les quelques tueurs les
 *   plus dangereux
 * 
 * Voir {@link Test.selectKillers} pour la manière dont Test sélectionne.
 */
class Test {
  /* 
   * La grosse question est : comment parcourir les
   * circuits de manière efficace ? 
   * 
   * Le faire par force brute, linéairement, conduit à des complexités
   * insupportables.
   * 
   * Quelques constatations s'imposent :
   * 
   * - il est important d'arriver à identifier
   *   des circuits qui sont à la base incompatibles,
   *   et de se concentrer sur leur résolution conjointe
   *   avant de passer à la suite
   * 
   * - il est important de laisser les circuits les
   *   plus dangereux éponger les mauvais candidats de nouvelle
   *   génération, avant de passer aux moins dangereux. Ceux-là
   *   ne tueront probablement plus personne, tout le monde ayant 
   *   déjà résisté aux plus méchants.
   * 
   * Pour cela, on utilise plusieurs propriétés :
   * - le nombre de tués (d'ancienne génération) sur
   *   une piste
   * - le nombre de qualifiés sur une piste
   * - la distance en nombre de tests qui sépare
   *   un circuit de sa dernière victime
   * 
   * Prendre en compte les considérations ci-dessus
   * diminue drastiquement la durée du test, et très probablement
   * sa complexité algorithmique.
   * 
   * Les modes de test intègrent ces idées. Au
   * fil du temps, les circuits qui s'étaient avérés tueurs
   * dans les premières générations se révèlent de moins en 
   * moins pertinents.
   */
  
  /** Instance en cours */
  static current = null

  /** La configuration n'est pas copiée, mais juste référencée dans l'instance */
  static config = {
    /** Nombre de passes ({@link Test.pass})       */ PASSES: 1,
    /** Erosion sur kill                           */ KILL_EROSION: 1 / 2,
    /** Attend la qualification de tous les vieux  */ FULL: false,
    /** Nombre de piste sur test partiel           */ MAX_TRACKS: 10,
    /** Minimum de vétérans pour partiel           */ MIN_ELDERS: 15,
    /** Selection sur test partiel                 */ SELECT_MODE: 'bad-min',
    /** Selection ELDERS (non implémenté)          */ SELECT_MODE_ELDER: 'bad-max'
  }

  /** Action sur click dans la table des tueurs */
  static onKillerClick(name)
  {
    console.log(name)
  }

  constructor() {
    this.config = Test.config

    /** Nombre de circuits testés                      */ this.done = 0

    /** Nombre de passes par circuit @type {Object.<string,int>}   */ this.passed= { }
    /** Nombre vétérans par circuit  @type {Object.<string,int>}   */ this.elders= { }
    /** Derniers tués par circuit    @type {Object.<string,int>}   */ this.kills = null
    /** Nombre de tours par circuit  @type {Object.<string,int>}   */ this.laps = null

    /** Sélection de circuits à tester @type {Track[]} */ this.killers = []
    /** Action sur changement de circuit               */ this.onNext = null
    /** Action sur test terminé                        */ this.onDone = null
    this.lastTrack = null
    this.lastKill  = 0
    this.track = null

    Test.current = this
  }

  // Fonctions de comparaison pour tri
  byKill = (b, a) => {
    // let this = this
    let ka = this.kills[a.uuid]; if (!ka) ka = 0; else ka = ka.tempered
    let kb = this.kills[b.uuid]; if (!kb) kb = 0; else kb = kb.tempered
    let ra = this.elders[a.uuidLapped]; if (!ra) ra = 0
    let rb = this.elders[b.uuidLapped]; if (!rb) rb = 0

    let r = ka - kb
    if (!r) r = rb - ra
    if (!r) r = b.serial - a.serial

    return r
  }
  byKillMax = (b, a) => {
    // let this = this
    let ka = this.kills[a.uuid]; if (!ka) ka = 0; else ka = ka.max
    let kb = this.kills[b.uuid]; if (!kb) kb = 0; else kb = kb.max
    let ra = this.elders[a.uuidLapped]; if (!ra) ra = 0
    let rb = this.elders[b.uuidLapped]; if (!rb) rb = 0

    let r = ka - kb
    if (!r) r = rb - ra
    if (!r) r = b.serial - a.serial

    return r
  }
  fromKeyAsc(key, b, a) {
    let ra = a ? a[key] : 0
    let rb = b ? b[key] : 0
    let r = rb - ra
    return r
  }
  fromKeyDesc(key, a, b) {
    let ra = a ? a[key] : 0
    let rb = b ? b[key] : 0
    let r = rb - ra
    return r
  }

  byKillLast = (a,b) => {
    let ka = this.kills[a.uuid]
    let kb = this.kills[b.uuid]

    let     r = this.fromKeyDesc("last", ka, kb)
    // if (!r) r = this.fromKeyDesc("max" , ka, kb)
    if (!r) r = this.fromKeyAsc ("when", ka, kb)

    if (!r) { // selon elders du plus petit au plus grand
      let ra = this.elders[a.uuidLapped]; if (!ra) ra = 0
      let rb = this.elders[b.uuidLapped]; if (!rb) rb = 0
      r = ra - rb
    }
    // selon last du plus petit au plus grand
    if (!r) r = a.serial - b.serial

    return r
  }
  byElders = (a, b) => {
    // let this = this // Test.current
    let ra = this.elders[a.uuidLapped]; if (!ra) ra = 0
    let rb = this.elders[b.uuidLapped]; if (!rb) rb = 0
    let ka = this.kills[a.uuid]; if (!ka) ka = 0; else ka = ka.tempered
    let kb = this.kills[b.uuid]; if (!kb) kb = 0; else kb = kb.tempered

    let r = ra - rb
    if (!r) r = kb - ka
    if (!r) r = a.serial - b.serial

    return r
  }

  init(list) {
    let killers = this.killers;
    for (let track of killers) {
      this.elders[track.uuidLapped] = track.countPassed(list)
    }
    return !currentGen.lists.running.length
  }
  time     = (time) => { return time.toTimeString().replace(/ .*/, "") }
  duration = (start, stop) => {
    let duration = new Date(stop.getTime() - start.getTime())
    return duration.toUTCString().replace(/.*(..:..:..).*/, "$1")
  }

  /**  Deuxième passe dans une session à deux passes. Dans la
       première passe, on se restreint à 1 tour par circuit */
  pass() {
    for (let uuid in this.laps) {
      let track = this.find(uuid)
      track.laps = this.laps[uuid]
    }
    this.laps = null
    this.init(currentGen.lists)
    this.inter = new Date
    console.log(`${this.time(this.inter)}: 1-lap pass done; running with actual laps`)
  }

  /** Choisit les circuits à tester, selon un mode de test  */
  selectKillers(mode, generation)
  {
    let def = this.config
    if (!mode)       mode       = 'max'
    if (!generation) generation = currentGen

    let sorted = Track.killers.toSorted(
      (b,a) => {
        let     r = a.kills    - b.kills    // du plus tueur au moins tueur
        if (!r) r = b.lastKill - a.lastKill // du plus récent au moins récent
        return r
      }
    )

    let killers = []
    let pivot = 0

    for (let killer of sorted)
    {
      if (killer.countPassed(generation) >= generation.total) continue
      if (killer.kills) pivot++
      killers.push(killer)
    }
    // if (!pivot) pivot = sorted.length

    switch (mode) {
      case 'all': break
      case 'max'    : killers = killers.slice(0,def.MAX_TRACKS); break;
      case 'bad'    : killers = killers.slice(0, pivot); break;
      case 'bad-max': killers = killers.slice(0, max(pivot, def.MAX_TRACKS)); break;
      case 'bad-min': killers = killers.slice(0, min(pivot, def.MAX_TRACKS)); break;
      case 'old'    : killers = killers.slice(pivot, pivot+def.MAX_TRACKS); break;
      default:
        throw `no support for mode ${mode}`
    }

    if (!killers.length)
      console.warn( `could not devise killers mode=${mode} pivot=${pivot} sorted=${sorted.length}`)

    return killers
  }
  /** Débute une nouvelle session de test */
  begin(generation) {
    let def = this.config
    let killers = Track.killers
    this.lastKill = 0
    this.maxKill  = 0
    this.passed = {}
    this.minRunning = generation.minRunning
    /** Numéro de série la génération de départ */ this.startGen = generation.serial

    /* On limite le nombre de circuits si le nombre de vétérans est suffisant */
    if (def.MAX_TRACKS && generation.countElders >= def.MIN_ELDERS) {
      let i = 0
      this.allKillers = killers
      killers = this.selectKillers(def.SELECT_MODE)
      for (let killer of killers)
      {
        killer.alias = killer.name
        killer.name = `crash ${i++}`
      }
      Track.killers = killers
    }
    this.killers = killers

    // let total = currentGen ? currentGen.total : 40 // 
    this.start = new Date
    if (!this.laps && def.PASSES == 2) this.laps = {}
    if (!this.kills) this.kills = {}

    for (let killer of killers) {
      if (!(killer.uuid in this.kills))
        this.kills[killer.uuid] = { tempered: killer.kills + 2, when: 0 }
      let kills = this.kills[killer.uuid]
      kills.max = 0
      kills.last = killer.kills // 
      if (killer.lastKill)
        kills.when = killer.lastKill

      if (def.PASSES > 1) {
        this.laps[killer.uuid] = killer.laps;
        killer.laps = 1;
      }
    }

    return killers
  }

  /** Termine la session de test */
  terminate() {
    let already = this.stop
    
    this.stop = new Date
    let message = `test done. runs=${this.done} when=${this.lastKill} max=${this.maxKill} gen=${currentGen.serial}`
    // console.log(message)
    if (this.onDone)
      this.onDone(message)

    currentGen.markQualified(this.killers)
    let count = currentGen.countQualifiedOrElders
    if (count < currentGen.total)
      throw `inconsistant qualified count=${count}`

    let removed = currentGen.removeUnqualified()
    message = [ message, `${removed} removed` ]

    let { start, inter, stop } = this

    let duration = this.duration(start, stop)
    message.push(`start : ${this.time(start)}`)
    if (inter)
      message.push(`pass 1: ${this.time(inter)}`)
    message.push(`stop  : ${this.time(stop)}`)
    message.push(`      + ${duration}`)
    console.log(message.join('\n'))

    if (currentGen.tested) {
      console.warn(`already tested ${currentGen.tested}`)
      currentGen.tested++
    }

    currentGen.minRunning = this.minRunning

    {
      let base = `gen${currentGen.serial}`
      if (currentGen.tested) base = base + '-' + currentGen.tested
      saveGeneration(base, ['stored', 'finished']); // 'passed'
      if (removed)
        saveGeneration(base + "-u", ['unqualified'])
      save(message, 'mb-' + base + `.txt`)
      if (!currentGen.tested) currentGen.tested = 1
      // currentGen.tested++
    }

    for (let killer of this.killers) {
      if (killer.alias)
        killer.name = killer.alias

      if (this.passed[killer.uuid]) {
        killer.kills = this.kills[killer.uuid].max
      }
    }

    // this.passed = {};
    // this.elders = {};
    this.stop = null;
    this.start = null;
    this.done = 0;

    if (this.allKillers)
      Track.killers = this.allKillers
    delete this.allKillers

    if (already)
      throw 'double termination'
  }

  /** Met à jour les différentes statistiques selon le dernier circuit passé */
  accept(track) {
    let def = this.config
    let uuid = null

    this.init(currentGen.lists)
    accept:
    if (track) {
      uuid = track.uuid
      if (track.killer) {
        let total = currentGen.total
        if (!(uuid in this.kills)) {
          this.kills[uuid] = { 
            tempered: 0,  //track.kills
            max: 0,
            last: track.kills,
            when: track.lastKill ? track.lastKill : 0
          }
        }
        if (!this.passed[uuid])
          this.passed[uuid] = 0;

        if (track != this.lastTrack) {
          if (!track.lastKill) track.lastKill = 0;

          if (track.kills == 0) track.lastKill++
          else track.lastKill = 0

          let kills = this.kills[uuid].tempered * def.KILL_EROSION + track.kills
          this.kills[uuid] = {
            tempered: kills > total ? total : kills,
            max: max(track.kills, this.kills[uuid].max),
            last: track.kills,
            when: track.lastKill
          }
        }
        if (track.kills) {
          this.lastKill ++
          if (track.kills > this.maxKill)
            this.maxKill = track.kills
        }
        else this.lastKill = 1

        this.lastTrack = track
        this.passed[uuid]++;
        this.done++;
      }
    }

    return uuid
  }

  /** Cherche un circuit dans les circuits de test */
  find(uuid) {
    let found = null
    let killers = this.killers

    for (let i = 0; i < killers.length && !found; i++) {
      if (killers[i].uuid == uuid) 
        found = killers[i]
    }

    return found
  }
  /** Cherche la position d'un circuit dans la liste des circuits de test */
  indexOf(uuid) {
    let found = null
    let c = -1
    let killers = this.killers

    for (let i = 0; i < killers.length && !found; i++) {
      if (killers[i].uuid == uuid) {
        found = killers[i]
        c = i
      }
    }

    return c
  }
  /** Sélectionne le circuit suivant dans la liste des circuits de test */
  nextSibling(uuid, total) {
    let next = null
    let killers = this.killers

    if (killers.length) {
      let pivot = this.indexOf(uuid)
      if (pivot < 0) 
        if (!total || this.elders[killers[0].uuidLapped] < total) {
          next = killers[0]
          this.reason = `${next.name} due to ${this.elders[next.uuidLapped]} < ${total}`
          // console.log()
        }

      else
      {
        for (let i = 1; i < killers.length; i++) {
          let c = (i + pivot) % killers.length;

          if (total && this.elders[killers[c].uuidLapped] >= total)
            continue

          next = killers[c];
          this.reason = `${next.name} due to ${this.elders[next.uuidLapped]} < ${total}`
          // console.log()
          break
        }
      }
    }
    return next
  }

  /** Sélectionne le circuit plus chaud dans la liste des circuits de test */
  nextHot(sorted, uuid, total, common) {
    let next

    for (let i = 0; sorted[i]; i++) {
      let track = sorted[i]
      if (track.uuid == uuid) continue
      if (this.elders[track.uuidLapped] < total) {
        next = track;
        this.reason = `${next.name} due to ${this.elders[next.uuidLapped]} < ${total}`
        // console.log()
        break;
      }
      if (!common) continue
      let count = currentGen.countHasPassed([common, track])
      if (count < total)
      {
        next = track;
        this.reason = `${next.name} due to common=${count}(${common.name}) < ${total}`
        // console.log()
        break;
      }
    }
    return next
  }

  /** Termine le test ou enclenche la passe suivante */
  isDone(start, total)
  {
    let done = false
    let stats = currentGen.stats
    if (stats && stats.elders >= total) {
      if (!start)
        throw `unexpected call to test: elders=${stats.elders}`

      if (this.laps) this.pass()
      else {
        this.terminate();
        done = true;
      }
    }
    return done
  }

  /** Calcule le nombre de voitures à prendre en considération */
  computeTotal(generation, stats)
  {
    let total = generation.total
    let missing = generation.countNonElderOlderThan(this.killers.length)

    stats = generation.stats
    if (missing && missing != this.missing) {
      console.log(`missing ${missing} qualifications for old vehicles`)
      this.missing = missing
    }

    if (this.config.FULL || missing) {
      if (stats && stats.olds > total)
        total = stats.olds
    }

    return total
  }

  /** Choisit le prochain circuit */
  next() {
    let next = null;
    let start = this.start

    abort: {
      let killers = this.killers;
      let uuid = null

      if (!currentGen) {
        console.log('test: no generation') 
        break abort
      }
      let stats = currentGen.stats
      if (!this.start) killers = this.begin(currentGen)

      uuid = this.accept(currentTrack)
      let total = this.computeTotal(currentGen, stats)

      if (this.isDone(start, total))
        break abort;

      let sorted = killers.toSorted(this.byKillLast)
      if (stats && stats.olds > total) {
        total = stats.olds
      }
      currentGen.minRunning = this.minRunning

      found: {
        next = this.nextHot(sorted, uuid, currentGen.total, currentTrack)
        if (next) break found;

        if (total > currentGen.total) {
          currentGen.minRunning = 0
          next = this.nextHot(sorted, uuid, total)
          if (next) break found;
        }
        
        next = this.nextSibling(uuid, total) // 
      } // found:

      if (!next) {
        console.log(`no next (total=${total})`)
        if (start)
          this.terminate();
        break abort;
      }

      if (next.uuid in this.kills) // TODO : comment ça ne peut pas être dans 'kills' ?
        next.crashKills = this.kills[next.uuid].last
      next.kills = 0;
    } // abort:

    // if (!start && !next)
    //   throw `started an empty test`

    if (next && this.onNext)
      this.onNext(next)

    return next
  }

  /** Retourne les informations pertinentes à jour sur les circuits de test */
  killersInfo()
  {
    let keys = ["name", "elders", "last", "when", "max", "passed"]
    let header = {}
    let index = {}

    let i = 0
    for (let k of keys) {
      header[k] = k.length
      index[k] = i++
    }

    let list = []
    let done = {}
    let append = (t,total) => {
      done: {
        if (done[t.uuid]) break done

        let elders = this.elders[t.uuidLapped]
        if (total && elders >= total) break done

        let kills = this.kills[t.uuid]
        let passed = this.passed[t.uuid]
        if (!passed) passed = "-"
        if (!kills) kills = {
          last: '-',
          when: '-',
          max : '-'
        }

        let log = [
          t.name,
          '' + elders,
          '' + kills.last,
          '' + kills.when,
          '' + kills.max,
          '' + passed
        ]
        for (let k in header) {
          let i = index[k]
          let n = log[i].length
          if (n > header[k])
            header[k] = n
        }
        list.push(log)
        done[t.uuid] = t
      }
    }
    let sorted = this.killers.
      toSorted(this.byKillLast)
    
    sorted.map(t => append(t, currentGen.total))
    if (currentGen.stats)
      sorted.map(t => append(t, currentGen.stats.olds))
    sorted.map(t => append(t, 0))

    let TAB
    for (let k in header) {
      let length = header[k] + 1
      let rest = length % TAB
      if (rest)
        length + TAB - rest
      header[k] = length
    }

    return [header, list]
  }

  /** Retourne une chaîne HTML qui représente le tableau de circuits de test */
  htmlInfo(current) {
    let list = []
    let [header, all] = this.killersInfo()
    if (!current) current = currentTrack

    let index = {}
    let i = 0
    for (let k in header)
      index[k] = i++

    all.
      map(raw => {
        let log = ''
        for (let k in header)
          log += `<td class='${k}'>${raw[index[k]]}</td>`
        list.push(log)
      });


    let html = ''
    for (let k in header)
      html += `<th class='${k}'>${k}</th>\n`
    html = `<tr>${html}</tr>\n`

    for (let i in all)
    {
      let raw = all[i]
      let name   = raw[index.name]
      let elders = raw[index.elders]
      let track = Track.find(name)
      let classes = []

      let att = ""; //` index='${i}'`
      att += ` onclick='Test.onKillerClick("${name}", event.target)'`
      if (track == current)        {
        classes.push("Current")
        att += ` title='${this.reason ? this.reason : "no reason"}'`
      }
      if (currentGen.stats && parseInt(elders) >= currentGen.stats.olds)
        classes.push("Done")

      if (classes.length)
        att += ` class='${classes.join(" ")}'`

      html += `<tr${att}>${list[i]}</tr>`
    }

    html = `<table class='Killers'>${html}</table>`

    return html
  }

  // crashTest.dump = function(n) {
  /** console.log ce qu'il reste à faire */
  dump(n) {
    let list = []

    if (!n) n = 10
    let [header, all] = this.killersInfo()

    let index = {}
    let i = 0
    for (let k in header)
      index[k] = i++

    all.
      map(raw => {
        let elders = raw[index.elders]
        if (!currentStats || currentStats.olds > elders || n == 'all') {
          let log = ''
          for (let k in header)
            log += raw[index[k]].padEnd(header[k])
          list.push(log)
        }
      });

    if (n == 'all') n = this.killers.length

    let message = ''
    for (let k in header)
      message += k.padEnd(header[k])
    console.log(message)
    console.log(list.toSpliced(n).join('\n'))
    console.log(`${list.length} to go`)
  }
}
