let COMMENT = "Les vieux en piste"

const TOTAL = 100;

let speedSlider;

/** Circuit en cours @type {Track} */let currentTrack;
/** Generation en cours @type {Generation} */let currentGen;

let changeMap = false;

function setup() {
  let track
  createCanvas(1200, 800);

  // tensor flow will work on the cpu
  tf.setBackend('cpu');

  currentTrack = track = new Track();
  track.show()

  // On crée les véhicules....
  currentGen = new Generation()
  currentGen.prepare(track)

  speedSlider = createSlider(0, 10, 0);
  let comment = createDiv()
  comment.html(COMMENT)
}

// Appelée 60 fois / seconde
function draw() {
  let track = currentTrack
  const cycles = speedSlider.value();
  background(0);


  // Par défaut le meilleur candidat est le premier de la population
  let bestP = currentGen.run(cycles)

  // On supprime les voitures mortes ou celles qui ont fini le circuit
  currentGen.classifyRunning()

  // Si jamais on a plus de voitures, on passe à la génération suivante
  if (!currentGen.countRunning) {
    currentTrack = track = new Track();
    currentGen.classifyFinished()
    currentGen = currentGen.next(track)
    currentGen.prepare(track)
  }

  // On dessine le circuit
  currentTrack.show()
  // On dessine les voitures
  currentGen.show(bestP)

  // on affiche le numéro de la génération
  fill(255);
  textSize(24);
  noStroke();
  text('generation ' + currentGen.serial, 10, 50);
}
