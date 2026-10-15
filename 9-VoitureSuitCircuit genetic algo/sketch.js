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

// CODEX : Le canvas reste en coordonnées 1200 × 800 ; l'UI et les sessions sont indépendantes du steering.
let currentTrack, currentGen, killerTest;
function setup() {
  UI.setup(); CONFIG.setup();
  Session = new SessionController();
  Promise.resolve(tf.setBackend('cpu')).then(() => Session.init()).catch(e => UI.error(e));
}
function draw() {
  background('#101b29');
  if (!Session?.ready) return;
  try {
    if (UI.stepping) {
      UI.paused = false; Session.tick(1); UI.paused = true; UI.stepping = false;
    } else Session.tick(UI.status.cycles);
    currentTrack.show();
    const running = currentGen.lists.running;
    const focus = car && running.includes(car) ? car : running.find(v => !v.dead && !v.finished);
    currentGen.show(focus, car);
  } catch (e) { UI.error(e); }
  UI.render(); frameRate(UI.rate);
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
    currentGen.prepare(currentTrack)
  }
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
    killerTest.accept(currentTrack)
    let kill = `${currentTrack.kills}-t${currentTrack.serial - Track.offset}`
    let savedGen   = `k${kill}.gen`;
    let savedTrack = `k${kill}.trk`;
    // CODEX : Un nouveau tueur crée deux archives : voitures mortes et géométrie du circuit.
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

    UI.message('Qualification automatique : le quota de voitures validées est insuffisant.', true)
    test = UI.testCheck
    test.checked(true)
    test.value('auto')
  }
  if (no) UI.message('Circuit difficile archivé. Qualification automatique non déclenchée.')
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
      console.log(`alwaysKiller(${alwaysKiller}): ${currentTrack.tricky}`)
      if (currentTrack.tricky >= alwaysKiller[2]) {
        console.log('done alwaysKiller')
        Track.config.TRICKY = alwaysKiller[2]
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
    const {MIN_ELDERS} = Test.config

    if (purge && Generation.train)
    {
      console.warn(`disabling purge as training is ongoing`)
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
 
    if (FROZEN && stored < currentGen.total) {
      currentGen.total = stored
      if (stored < MIN_ELDERS) {
        UI.pause(`Frozen generation is low`)
      }
    }
    // Sauf contre-indication, on ne change de circuit que si toutes voitures ont terminé
    // CODEX : FINISHED=true garde le même circuit jusqu'au quota de réussites ; les places manquantes sont mutées.
    if (stored >= currentGen.total || FROZEN || !FINISHED)     {
      // if (!purge || test) // ce test ne fonctionne pas si purge et stored == total
        nextTrack(true);
    }

    // On prépare la nouvelle course, soit sur le même
    // circuit avec une nouvelle génération, soit sur le
    // nouveau circuit avec la génération en cours
    currentGen = currentGen.next(currentTrack, purge && !test);

    let stats = currentGen.prepare(currentTrack);
    UI.genStats(stats);
    UI.raceInfo()
    UI.testTable.html(killerTest.htmlInfo(currentTrack))
  }

  // console.log(UI.genCheck)
  if (pause)
    UI.speedSlider.value(0)
}
