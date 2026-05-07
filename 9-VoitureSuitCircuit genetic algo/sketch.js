

const TABLE_SIZE = 10;

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

  def = CONFIG.Sketch
  // def()
}

/** Circuit en cours      @type {Track}      */let currentTrack;
/** Generation en cours   @type {Generation} */let currentGen;
/** Validation sur tueurs @type {Test}       */let killerTest

// Elements utilisateur 
let UI = {
  messageDiv : null,

  speedSlider: null,
  rateSlider : null,

  trackButton: null,
  saveButton : null,
  killButton : null,
  stepButton : null,

  genCheck   : null, // pause sur changement de generation
  purgeCheck : null,
  testCheck  : null, 
  killerCheck: null,

  /** @type CanvasRenderingContext2D */ board: null,

  get status() {
    return {
      "test": this.testCheck.checked(),
      "cycles": this.speedSlider.value(),
      "rate": CONFIG.Sketch.RATES[this.rateSlider.value()],
      "pause": UI.genCheck.checked(),
      "step" : UI.stepButton.value(),
      "purge": UI.purgeCheck.checked(),
      "killer": UI.killerCheck.checked(),
    }
  }
};

UI.setup = function ()
{
  let board  = createDiv()
  let canvas = createCanvas(1200, 800);

  let div, label

  canvas.parent(board)
  canvas.addClass('Left')

  let right = createDiv()
  right.parent(board)
  right.addClass('Left')

  UI.raceTable = createTable(right, Vehicle.cells, 10)
  UI.raceTable.addClass('Race')
  UI.raceTable.attribute("onclick", "onRaceClick(event)")
  UI.raceTable.clear()

  UI.testTable = createDiv()
  UI.testTable.parent(right)
  UI.testTable.addClass('Test')

  UI.messageDiv = createDiv();
  UI.messageDiv.addClass('Message');

  let control = createDiv()
  control.addClass('Controls');

  let def = CONFIG.Sketch

  UI.speedSlider = createSliderDiv(control,
    "Amount of physical steps in a clock tick",
    'Speed', [0, 12, 1], UI.onSpeedChange);
  UI.rateSlider = createSliderDiv(control,
    "Number of clock ticks in a user second",
    'Rate', [0, def.RATES.length - 1, def.RATES.length-1], UI.onRateChange);
  
  let column 

  column = createDiv();
  column.addClass('Column Left');
  column.parent(control);
  UI.genCheck = createCheckDiv(column,
    "Pause before starting next race",
    "Pause", "gencheck");
  UI.killerCheck = createCheckDiv(column,
    `Pause when an automated killer test is done`,
    "Killer", "killerCheck");

  column = createDiv();
  column.addClass('Column Left');
  column.parent(control);

  UI.testCheck = createCheckDiv(column,
    `Loop on killer tracks`,
    "Test", "testCheck");
  UI.purgeCheck = createCheckDiv(column,
    "Put all vehicles on track. Once done keep the TOTAL best. Not applicable when test is ongoing",
    'Purge', "purgeCheck")

  div = createDiv()
  div.addClass('Actions');

  UI.trackButton = createActionButton(div, 
    "Change track, keeping current population", 
    'Track', (e) => nextTrack())
  UI.saveButton = createActionButton(div, 
    "Save generation, killer tracks, current track, leader vehicle",
    'Save', (e) => saveAll())
  UI.killButton = createActionButton(div,
    "Finish race, killing running cars",
    'Kill', killRunning)
  UI.finishButton = createActionButton(div,
    "Finish race, considering running cars are successful",
    'Finish', finishRunning)
  UI.stepButton = createActionButton(div,
    "Forward one step in time, then pause",
    'Step', oneStep)


  let black = createElement('canvas')
  black.id("board")
  black.attribute("width", 400)
  black.attribute("height", 400)
  UI.board = black.elt.getContext("2d")

  UI.purgeCheck .checked(def.CHECK_PURGE)
  UI.killerCheck.checked(def.CHECK_KILLER)
  UI.testCheck .checked(def.LOAD_KILLERS ? def.CHECK_TEST : false )
  UI.onRateChange()

  canvas.elt.addEventListener("click", (e) => {
    let vehicle = currentGen.vehicleAt(canvas.elt, e)
    selectVOI(vehicle)
    brainInfo(vehicle ? vehicle : 'none')
  })

  canvas.elt.addEventListener("mousemove", (e) => {
    let vehicle = currentGen.vehicleAt(canvas.elt, e)
    if (vehicle) {
      canvas.attribute("title", `${vehicle}`)
      canvas.addClass("Interactive")
    }
    else {
      canvas.removeAttribute("title")
      canvas.removeClass("Interactive")
    }
  })

}

UI.genStats = function (stats)
{
  if (stats.olds) {
    let message = `Stats: ${stats.olds} olds, oldest is ${stats.oldest.id}`
    if (stats.youngest.old)
      message += `, youngest is ${stats.youngest.id}`;
    UI.message(message);
  }
}
UI.message = function(message, log, force)
{
  let holder = UI.speedSlider
  if (log) console.log(message)
  if (holder.value() == 0 && !force)
    holder.hold = message;
  else
    UI.messageDiv.html(message);
  UI.lastMessage = message
}
UI.pause = function(message) {
  let holder = UI.speedSlider
  UI.message(message)
  holder.value(0)
}
UI.onSpeedChange = function()
{
  if (UI.speedSlider.value() != 0 && UI.speedSlider.hold)
  {
    UI.messageDiv.html(UI.speedSlider.hold);
    UI.speedSlider.hold = null;
  }
}
UI.onRateChange = function()
{
  let def = CONFIG.Sketch
  const rate = def.RATES[UI.rateSlider.value()]
  frameRate(rate)
  if (UI.rateSlider.value() != 0 && UI.rateSlider.hold) {
    UI.messageDiv.html(UI.rateSlider.hold);
    UI.rateSlider.hold = null;
  }
}
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
  }

  if (def.LOAD_CONFIG) {
    Asset.load(def.LOAD_CONFIG, on_config)
  }
  else
    on_config()
}


function setup() {
  let track

  // tensor flow will work on the cpu
  tf.setBackend('cpu');

  // On met l'interface en place
  UI.setup()

  killerTest = new Test()
  killerTest.onNext = (next) => UI.testTable.html(killerTest.htmlInfo(next))
  killerTest.onDone = onTestDone

  Test.onKillerClick = onTestKillerClick
  
  // On crée les véhicules....
  if (!currentGen)
    currentGen = new Generation()

  // On crée un circuit...
  nextTrack(true)
  track = currentTrack

  // On met les voitures sur la ligne de départ
  currentGen.prepare(track)
  UI.genStats(currentGen.stats);

  killerTest.init(currentGen.lists.running)

  raceInfo()
  UI.pause(UI.lastMessage)
  let comment = createDiv()
  comment.class("Version")
  comment.html("broom")
}

function onTestDone(message) {
  let {killer} = UI.status
  let test = UI.testCheck
  if (test.checked() && (test.value() != 'auto' || killer))
    UI.pause(message);

  test.checked(false);
  test.value('on')
}

/** @type NeuralNetwork */ let brain
// let pace
function brainInfo(selection)
{
  let ctx = UI.board

  if (!selection) selection = 0

  if (selection instanceof Vehicle)
    car = selection;
  else
    car = currentGen.lists.running[selection]

  // pace = currentGen.lists.running[1]
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (!car) {
    console.log('no car')
    return
  }
  // console.log(car.id)
  brain = car.brain
  let r = brain.draw(ctx,1,2)
  {
    ctx.save()
    // ctx.font = "48px serif"
    ctx.fillStyle = "white"
    ctx.fillText(car.id + " " + car.brain.activation, 10, 10)
    ctx.strokeText(car.id, 0, 0)
    ctx.restore()
  }
  return r
}

function onTestKillerClick(name)
{
  if (!UI.speedSlider.value()) {
    selectKiller(name)
  }
}

function raceInfo() {
  let lists = currentGen.lists

  lists.finished.sort(Vehicle.byRank)
  lists.running.sort(Vehicle.byPoints)

  let table = UI.raceTable
  table.clear()
  let i = 0
  for (let list of [lists.finished, lists.running]) {
    for (let vehicle of list) {
      if (!vehicle.active) continue
      if (!table.set(i, vehicle.summary))
        break
      i++
    }
  }
}

/** Dernière voiture manipulée par l'utilisateur */ let car
function selectVOI(vehicle) {
  if (vehicle) {
    // console.log(vehicle.id)
    car = vehicle
    if (!Vehicle.OF_INTEREST)
      Vehicle.OF_INTEREST = Vehicle.config.OF_INTEREST
    Vehicle.config.OF_INTEREST = vehicle
    UI.message(`VOI: ${vehicle}`, true, true)
  }
  else {
    if (Vehicle.OF_INTEREST) {
      Vehicle.config.OF_INTEREST = Vehicle.OF_INTEREST
      UI.message(`VOI: ${Vehicle.OF_INTEREST}`, true, true)
    }
    delete Vehicle.OF_INTEREST
  }
}
function onRaceClick(e) {
  let serial = int(e.srcElement.parentElement.getAttribute("serial"))
  let vehicle = 'none'
  if (serial != null) vehicle = currentGen.find(serial)
  brainInfo(vehicle)
  selectVOI(vehicle)
}



// Démarre une nouvelle course sur un nouveau circuit.
// 
// - si 'noprepare', on laisse
//   l'appelant se charger de préparer la génération
//   en cours ; sinon, on le fait ici
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

// Sélectionne le i-ième circuit tueur
function selectKiller(i) {
  const {test} = UI.status
  let killers = Track.killers
  if (test && killerTest.killers)
    killers = killerTest.killers

  if (!i) i = 0;
  if (i < 0) i = killers.length+i;
  if (i < 0 || i >= killers.length)
    throw `out of range (length=${killers.length})`

  let track = typeof i == "string" ? Track.find(i) : killers[i];
  if (track) {
    currentTrack = track
    currentStats = currentGen.prepare(currentTrack);
    UI.testTable.html(killerTest.htmlInfo())
  }
  else
    console.log(`no such killer '${i}'`)
}

// Enclenche une pause après le prochain tick d'horloge
function oneStep()
{
  UI.speedSlider.value(1)
  UI.stepButton.value(1)
}

// Assassine les voitures en course
function killRunning() {
  let running = currentGen.lists.running
  const limit = 10
  let kills = running.length
  let name = `m${kills}-t${currentTrack.serial - Track.offset}.gen`

  if (kills < limit || window.confirm(`Really murder ${kills} running vehicles?`))
  {
    if (kills >= limit)
      saveGeneration(name, ['running'])

    for (vehicle of running)
      vehicle.kill()
  }
}

// Marque les voitures en course comme ayant terminé
function finishRunning() {
  let running = currentGen.lists.running
  for (vehicle of running) {
    if (vehicle.dead) continue;
    if (vehicle.finished) continue;
    if (!vehicle.speed) vehicle.speed = 1;
    vehicle.points   = vehicle.track.laps*vehicle.track.checkpoints.length;
    vehicle.tracks   = vehicle.track.laps;
    vehicle.finished = -1
  }
}


// On affiche différentes infos sur le déroulement
// de la course : 
// - numéro de la génération et de piste, 
// - réglages UI, 
// - ...
function drawInfo(cycles, vehicle)
{
  fill(255);
  textSize(24);
  noStroke();
  let y = 50;
  if (!currentGen)
    text(300, 25, "Generation is not ready");

  else {
    const {test, rate, cycles} = UI.status

    let def = CONFIG.Sketch
    let stats = currentGen.stats
    let track  = currentTrack.id;
    let uuid   = currentTrack.uuid;
    let passed = killerTest.passed[uuid];
    if (passed) 
      track = track + ' (' + passed + ')';

    if (test) {
      let killers = killerTest.killers ? killerTest.killers : Track.killers
      if (killers.length)
        track = track + ` of ${killers.length}`
    }

    if (currentTrack.tricky && currentTrack.tricky != Track.config.TRICKY)
      track += ` t=${currentTrack.tricky}`
    if (currentTrack.crashKills)
      track += ` k=${round(currentTrack.crashKills,1)}`
    if (currentTrack.comment)
      track += ` ${currentTrack.comment}`

    let serial = currentGen.serial
    if (test && killerTest.start)
      serial = `+${serial - killerTest.startGen}`
    text('generation ', 10, y); text(serial                , 150, y); y+= 25;
    text('track      ', 10, y); text(track                 , 150, y); y+= 25;
    text('rate       ', 10, y); text(rate                  , 150, y); y+= 25;
    text('speed      ', 10, y); text(cycles                , 150, y); y+= 25;
    text('store      ', 10, y); text(currentGen.countStored, 150, y); y+= 25;
    let elders = `${stats.elders}`
    if (test) {
      if (killerTest.elders[currentTrack.uuidLapped])
        elders = `${elders} + ${killerTest.elders[currentTrack.uuidLapped] - elders}`
    } 
    else if (stats.qualified && stats.qualified > elders)
      elders = `${elders}[${stats.qualified-elders}]`

    text('elders     ', 10, y); text(elders   , 150, y); y+= 25;
    x = 200; y = 25
    let str = `${vehicle}`
    // QuickNDirty: ce bloc dépend de Vehicle.toString, et ce n'est pas une bonne
    // chose. On devrait formater ici à la main, champ par champ, en 
    // connaissance de cause.
    let match = str.match(/([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+)(?: ([^ ]+))?/)
    if (match) {
      text(`${currentGen.countAlive}: ${match[1]}`, x, y); x += 175+50
      text(match[2], x, y); x += 50
      text(match[3], x, y); x += 120
      text(match[4], x, y); x += 100
      text(match[5], x, y); x += 100
      if (match[6]) { text(match[6], x, y); x += 100 }
    }
    else
      text(`${currentGen.countAlive}: ${str}`            , x, y); 
    
    if (!cycles) {
      text("Pause - use Speed slider to animate", 400, 400)
    }
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
      raceInfo()
      // if (currentGen.active == 0) finishRunning()
    }
  } // Fin du bloc 'running'

  drawInfo(cycles, vehicle);

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
 *   - on sauvegarde les tués et le circuit
 *     tueur
 *   - on enclenche éventuellement la qualification
 */
function declareKiller()
{
  let def = Generation.config
  no: {
    let known = !currentTrack.declareKiller(currentGen)
    if (known) break no

    console.log(`killer: ${currentTrack}`)
    let kill = `${currentTrack.kills}-t${currentTrack.serial - Track.offset}`
    let savedGen = `k${kill}.gen`;
    let savedTrack = `k${kill}.track`;
    saveGeneration(savedGen, ['dead']);
    saveTrack(savedTrack)

    let { test } = UI.status
    yes: {
      let auto = def.AUTO_TEST
      if (test) break no
      if (auto === null || auto === false) break no
      if (currentGen.total != def.TOTAL) break no
      if (typeof auto == typeof true) break yes
      if (currentGen.countElders <= auto) break yes
      if (currentGen.countQualifiedOrElders > auto) break no
    }

    UI.message(`Not enough elders (elders=${currentGen.countElders} qualified=${currentGen.countQualifiedOrElders} auto=${def.AUTO_TEST}). Entering test`, true)
    test = UI.testCheck
    test.checked(true)
    test.value('auto')
  }
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
function nextRace()
{
  let {cycles, pause, purge, test} = UI.status
  if (!cycles)
    return

  {
    let def = Generation.config
    
    if (purge && !test) { mayPurge(); }

    currentGen.classifyFinished();
    if (!currentTrack.kills) {
      currentTrack.kills = currentGen.countDeadOld
    }

    let stored = currentGen.countStored;

    // On rapporte à l'utilisateur si le circuit est tueur :
    // un ancêtre ou un qualifié est mort
    if (currentGen.countDead) {
      declareKiller()
    }
 
    // Sauf contre-indication, on ne change de circuit que si toutes voitures ont terminé
    if (stored >= currentGen.total || !def.FINISHED)     {
      nextTrack(true);
    }

    // On prépare la nouvelle course, soit sur le même
    // circuit avec une nouvelle génération, soit sur le
    // nouveau circuit avec la génération en cours
    currentGen = currentGen.next(currentTrack, purge && !test);

    let stats = currentGen.prepare(currentTrack);
    UI.genStats(stats);
    raceInfo()
  }

  // console.log(UI.genCheck)
  if (pause)
    UI.speedSlider.value(0)
}
