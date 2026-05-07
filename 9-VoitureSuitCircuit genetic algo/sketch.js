const TABLE_SIZE = 10;

let alwaysKiller
CONFIG.setup = () => {
  let def = CONFIG.Vehicle
  def()
  for (let k in def) {
    Vehicle.config[k] = def[k]
  }

  def = CONFIG.Track
  def()
  for (let k in def) {
    Track.config[k] = def[k]
  }
  def = CONFIG.Generation
  def()
  for (let k in def) {
    Generation.config[k] = def[k]
  }
  def = CONFIG.Test
  def()
  for (let k in def) {
    Test.config[k] = def[k]
  }
}

/** Circuit en cours      @type {Track}      */let currentTrack;
/** Generation en cours   @type {Generation} */let currentGen;
/** Validation sur tueurs @type {Test}       */let killerTest

/**
  Donnée sauvegardée
*/
function preload() {
  let def = CONFIG.Sketch

  let on_config = () => {
    CONFIG.setup()

    Asset.load(def.LOAD_TRACKS , world => Track.initials = world)
    Asset.load(def.LOAD_KILLERS, world => Track.setKillers(world.tracks))
    Asset.load(def.LOAD_GEN    , gen   => currentGen     = gen)
    if (def.TRAINING) {
      let training = def.TRAINING.split(":")
      Asset.load(training[0], gen => Generation.prepareTraining(gen, training[1], training[2]))
    }
  }

  if (def.LOAD_CONFIG) {
    Asset.load(def.LOAD_CONFIG, on_config)
  }
  else
    on_config()
}

let trainee
function setup() {
  let track

  // tensor flow will work on the cpu
  tf.setBackend('cpu');
  let def = CONFIG.Sketch
  if (def.ALWAYS_KILLER) {
    let always  = def.ALWAYS_KILLER
    let conf    = Track.config
    alwaysKiller = [conf.TRICKY, always[1], always[2]]
    conf.TRICKY = always[0]
  }

  // On met l'interface en place
  UI.setup()

  killerTest = new Test()
  killerTest.onNext = (next) => UI.testTable.html(killerTest.htmlInfo(next))
  killerTest.onDone = UI.onTestDone

  Test.onKillerClick = UI.onTestKillerClick
  
  // On crée les véhicules....
  if (!currentGen)
    currentGen = new Generation()

  if (Generation.train) {
    currentGen.prepareTraining()
  }

  // On crée un circuit...
  nextTrack(true)
  track = currentTrack

  // On met les voitures sur la ligne de départ
  currentGen.prepare(track)
  UI.genStats(currentGen.stats);

  killerTest.init(currentGen.lists.running)

  UI.raceInfo()
  // UI.brainInfo()
  let {pause} = UI.status
  if (pause) UI.pause(UI.lastMessage)
  let comment = createDiv()
  comment.class("Version")
  comment.html("UI")
}

/** Démarre une nouvelle course sur un nouveau circuit.
  
  - si `noprepare`, on laisse
   l'appelant se charger de préparer la génération
   en cours ; sinon, on le fait ici
 */
function nextTrack(noprepare) 
{
  let next
  track: {
    const {test} = UI.status
    if (test) {
      next = killerTest.next()
      if (next) break track;
      console.log('nothing to test. unchecking Test')
      UI.testCheck.checked(false)
    }

    next = Track.next()
  } // track

  currentTrack = next;

  if (!noprepare) {
    currentStats = currentGen.prepare(currentTrack)
  }
}

function onRunningException(x)
{
  let caught
  if (x.message) {
    if (x.type == UI)
    {
      UI.message(x.message)
      caught = true
    }
    else {
      UI.pause(x.message)
      if (x.type && window[x.type]) {
        window[x.type](x)
        caught = true
      }
    }
  }
  else {
    UI.pause(`unknown '${x}'`)
  }
  if (!caught) {
    console.log(x)
    throw x
  }
}

// Appelée 60 fois / seconde (mais voir frameRate)
function draw() {
  let vehicle
  let {cycles,step, rate} = UI.status

  background(0);

  running: {
    // On dessine le circuit
    currentTrack.show()

    // On simule quelques cycles de physique, et on récupère la voiture
    // la plus intéressante.
    try 
    {
      if (currentGen.status == Generation.STATUS_TRAINING) {
        let info = Generation.train.trainee.brain.trainInfo
        rate = 1
        throw { 
          type: UI, 
          message: `Training[${info.duration}] ` + 
          `${info.epoch}/`.padStart(5) + info.epochs +
          ' loss ' + `${round(info.loss*1000,3)}`.padEnd(10) 
        }
      }

      vehicle = currentGen.run(cycles);
      
      // On répartit les voitures selon leur état (en course, dans le décor, ...)
      currentGen.classifyRunning();

      // Si jamais on a plus de voitures en course, on passe à la course suivante (
      // génération suivante, circuit suivant ou autre selon la logique mise en
      // place dans 'nextRace')
      // MB: ça me semble inutile, car on a déjà un test pour passer à la génération suivante
      if (currentGen.countRunning == 0 && currentGen.started) {
        nextRace()
      }
    }
    catch (x) { onRunningException(x) }

    // On dessine le circuit
    currentTrack.show()
    // On dessine les voitures
    currentGen.show(vehicle, Vehicle.config.OF_INTEREST)

    // On montre le tableau de course de temps à autre
    if (vehicle && vehicle.event) { 
      vehicle.event = null
      UI.raceInfo()
      // if (currentGen.active == 0) finishRunning()
    }
  } // Fin du bloc 'running'

  UI.info(cycles, vehicle);

  // Le bouton 'Step', si enclenché, demande de mettre sur
  // pause après le premier appel à 'draw'. On réalise la pause
  // en mettant 'speed' à 0
  if (step) {
    UI.stepButton.value('')
    UI.speedSlider.value(0)
    if (UI.onStep) UI.onStep()
  }

  frameRate(rate)
}

/** Qualifie le circuit en cours de tueur
 * - s'il l'est déjà, rien ne passe
 * - sinon :
 *   - on sauvegarde les tués et le circuit tueur
 *   - on enclenche éventuellement la qualification
 */
function declareKiller()
{
  const { AUTO_TEST, TOTAL } = Generation.config
  let no
  no: {
    let known = !currentTrack.declareKiller(currentGen)
    if (known) break no

    console.log(`killer: ${currentTrack}`)
    let kill = `${currentTrack.kills}-t${currentTrack.serial - Track.offset}`
    let savedGen   = `k${kill}.gen`;
    let savedTrack = `k${kill}.trk`;
    saveGeneration(savedGen, ['dead']);
    saveTrack(savedTrack)

    let { test } = UI.status
    yes: {
      let auto = AUTO_TEST
      if (test)                                       { no = 'test'          ; break no}
      if (auto === null || auto === false)            { no = 'false or null' ; break no }
      if (currentGen.total != TOTAL)                  { no = 'TOTAL != total'; break no }
      if (typeof auto == typeof true)     break yes
      if (currentGen.countElders <= auto) break yes
      if (currentGen.countQualifiedOrElders >= TOTAL) { no = ''; break no }
    }

    UI.message(`Not enough elders (elders=${currentGen.countElders} qualified=${currentGen.countQualifiedOrElders} auto=${AUTO_TEST}).` +
      ` Entering test`, true)
    test = UI.testCheck
    test.checked(true)
    test.value('auto')
  }
  if (no) UI.message(`Killer: skipping auto test because of ${no}`)
}

function mayPurge()
{
  let finished = currentGen.lists.finished
  let stored = currentGen.countStored

  {
    if (stored == 0 && finished.length > currentGen.total) {
      let purge = finished.splice(currentGen.total)
      Generation.serial++
      currentGen.serial++
      console.log(`purging ${purge.length} vehicles`)
      console.log(purge)
      UI.purgeCheck.checked(false)
    }
  }

  return stored
}
function checkAlwaysKiller()
{
  if (alwaysKiller) {
    if (currentTrack.declareKiller(currentGen)) {
      console.log(`alwaysKiller(${alwaysKiller}): ${currentTrack}`)
      if (currentTrack.tricky >= alwaysKiller[2]) {
        console.log('done alwaysKiller')
        Track.config.TRICKY = alwaysKiller[0]
        alwaysKiller = null
        UI.testCheck.checked(true)
      }
      else
        Track.config.TRICKY += alwaysKiller[1]
    }
  }
}
function nextRace()
{
  let {cycles, pause, purge, test} = UI.status
  if (!cycles)
    return

  {
    const {FROZEN, FINISHED} = Generation.config
    

    if (purge && Generation.train)
    {
      log.warn(`disabling purge as training is ongoing`)
      UI.purgeCheck.checked(false)
      purge = false
    }

    if (purge && !test) { mayPurge(); }
    
    currentGen.classifyFinished();
    if (!currentTrack.kills) {
      currentTrack.kills = currentGen.countDeadOld
    }

    let stored = currentGen.countStored;
    checkAlwaysKiller()

    // On rapporte à l'utilisateur si le circuit est tueur :
    // un ancêtre ou un qualifié est mort
    if (currentGen.countDead && !Generation.train) {
      declareKiller()
    }
 
    // Sauf contre-indication, on ne change de circuit que si toutes voitures ont terminé
    if (stored >= currentGen.total || FROZEN || !FINISHED)     {
      if (!purge || test)
        nextTrack(true);
    }

    // On prépare la nouvelle course, soit sur le même
    // circuit avec une nouvelle génération, soit sur le
    // nouveau circuit avec la génération en cours
    currentGen = currentGen.next(currentTrack, purge && !test);

    let stats = currentGen.prepare(currentTrack);
    UI.genStats(stats);
    UI.raceInfo()
  }

  // console.log(UI.genCheck)
  if (pause)
    UI.speedSlider.value(0)
}
