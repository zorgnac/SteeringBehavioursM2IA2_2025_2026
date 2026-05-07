

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

  def = CONFIG.Sketch
  // def()
}

/** Circuit en cours    @type {Track}      */let currentTrack;
/** Generation en cours @type {Generation} */let currentGen;

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
  // singleCheck: null, // ne garder qu'une seule voiture en course
  purgeCheck : null,
  killerCheck: null,  // pause quand une génération fini par réussir un circuit tueur
  /** @type CanvasRenderingContext2D */ board: null
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

  UI.messageDiv = createDiv();
  UI.messageDiv.addClass('Message');

  let control = createDiv()
  control.addClass('Controls');

  let def = CONFIG.Sketch

  UI.speedSlider = createSliderDiv(control,
    "Amount of physical steps in a clock tick",
    'Speed', [0, 12, 0], UI.onSpeedChange);
  UI.rateSlider = createSliderDiv(control,
    "Number of clock ticks in a user second",
    'Rate', [0, def.RATES.length - 1, def.RATES.length-1], UI.onRateChange);
  
  let column 

  column = createDiv();
  column.addClass('Column Left');
  column.parent(control);
  UI.genCheck = createCheckDiv(column,
    "Pause on generation",
    "Pause", "gencheck");

  column = createDiv();
  column.addClass('Column Left');
  column.parent(control);

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

  UI.onRateChange()
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
UI.message = function(message, log)
{
  let holder = UI.speedSlider
  if (log) console.log(message)
  if (holder.value() == 0)
    holder.hold = message;
  else
    UI.messageDiv.html(message);
}
UI.pause = function(message) {
  let holder = UI.speedSlider
  UI.message(`Pause: ${message}`)
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

function preload()
{
  let def = CONFIG.Sketch
  CONFIG.setup()
  Asset.load(def.LOAD_TRACKS , world => Track.initials = world)
  Asset.load(def.LOAD_KILLERS, world => Track.setKillers(world.tracks))
  Asset.load(def.LOAD_GEN    , gen   => currentGen     = gen)
}


function setup() {
  let track

  // tensor flow will work on the cpu
  tf.setBackend('cpu');

  // On met l'interface en place
  UI.setup()

  nextTrack(true)
  track = currentTrack

  // On crée les véhicules....
  if (!currentGen)
    currentGen = new Generation()
  currentGen.prepare(track)
  UI.genStats(currentGen.stats);

  raceInfo()
  let comment = createDiv()
  comment.class("Version")
  comment.html("Tueurs")
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
//      if (!vehicle.active) continue
      if (!table.set(i, vehicle.cells))
        break
      i++
    }
  }
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
    next = Track.next()
  } // track

  currentTrack = next;

  if (!noprepare) {
    currentStats = currentGen.prepare(currentTrack)
  }
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
    let def = CONFIG.Sketch
    const rate = def.RATES[UI.rateSlider.value()]
    let stats = currentGen.stats
    let track  = currentTrack.id;
    let uuid   = currentTrack.uuid;

    if (currentTrack.tricky && currentTrack.tricky != Track.config.TRICKY)
      track += ` t=${currentTrack.tricky}`
    if (currentTrack.crashKills)
      track += ` k=${round(currentTrack.crashKills,1)}`
    if (currentTrack.comment)
      track += ` ${currentTrack.comment}`

    let serial = currentGen.serial
    let elders = `${stats.elders}`

    text('generation ', 10, y); text(serial                , 150, y); y+= 25;
    text('track      ', 10, y); text(track                 , 150, y); y+= 25;
    text('rate       ', 10, y); text(rate                  , 150, y); y+= 25;
    text('speed      ', 10, y); text(cycles                , 150, y); y+= 25;
    text('store      ', 10, y); text(currentGen.countStored, 150, y); y+= 25;

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

// Appelée 60 fois / seconde
function draw() {
  let vehicle
  const cycles = UI.speedSlider.value();
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
    currentGen.show(vehicle)

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
  if (UI.stepButton.value()) {
    UI.stepButton.value('')
    UI.speedSlider.value(0)
    if (UI.onStep) UI.onStep()
  }
}

function declareKiller()
{
  let def = Generation.config
  if (currentTrack.declareKiller(currentGen)) {
    console.log(`killer: ${currentTrack}`)
    let kill = `${currentTrack.kills}-t${currentTrack.serial - Track.offset}`
    let savedGen = `k${kill}.gen`;
    let savedTrack = `k${kill}.track`;
    saveGeneration(savedGen, ['dead']);
    saveTrack(savedTrack)
  }
}

function nextRace()
{
  if (!UI.speedSlider.value())
    return

  { // Cas standard : vraie course, générations...
    let limit
    let stored = currentGen.countStored;
    const {FINISHED} = Generation.config

    currentGen.classifyFinished();
    if (!currentTrack.kills) {
      currentTrack.kills = currentGen.countDeadOld
    }

    stored = currentGen.countStored;

    // On rapporte à l'utilisateur si le circuit est tueur :
    // un ancêtre ou un qualifié est mort
    if (currentGen.countDead) {
      declareKiller()
    }
 
    // On ne change de circuit que si le nombre minimal de voitures
    // a terminé
    if (stored >= currentGen.total || !FINISHED)     {
      nextTrack(true);
    }

    // On prépare la nouvelle course, soit sur le même
    // circuit avec une nouvelle génération, soit sur le
    // nouveau circuit avec la génération en cours
    currentGen = currentGen.next(currentTrack);

    let stats = currentGen.prepare(currentTrack);
    UI.genStats(stats);
    raceInfo()
  }

  // console.log(UI.genCheck)
  if (UI.genCheck.checked())
    UI.speedSlider.value(0)
}
