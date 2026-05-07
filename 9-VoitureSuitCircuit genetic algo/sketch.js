let COMMENT = "Distance signée à la piste"

const TOTAL = 100;
const MUTATION_RATE = 0.1;
const LIFESPAN = 25;
// On regarde le long des capteurs jq distance = 50
const SIGHT = 50;

let generationCount = 0;


// Les voitures
let population = [];
let savedVehicles = [];

let speedSlider;
let currentTrack;

let changeMap = false;

function setup() {
  let track
  createCanvas(1200, 800);

  // tensor flow will work on the cpu
  tf.setBackend('cpu');

  currentTrack = track = new Track();
  track.show()

  // On crée les véhicules....
  for (let i = 0; i < TOTAL; i++) {
    population[i] = new Vehicle();
    population[i].prepare(track)
  }

  speedSlider = createSlider(0, 10, 0);
  let comment = createDiv()
  comment.html(COMMENT)
}

// Appelée 60 fois / seconde
function draw() {
  let track = currentTrack
  const cycles = speedSlider.value();
  background(0);

  currentTrack.show()
  // Par défaut le meilleur candidat est le premier de la population
  let bestP = population[0];

  // Nombre de cycles par frame ("époques par frame")
  for (let n = 0; n < cycles; n++) {
    // Pour chaque voiture
    for (let vehicle of population) {
      // On applique le comportement
      vehicle.applyBehaviors(track.walls);
      // on regarde si on a passé un checkpoint
      vehicle.check(track.checkpoints);
      // on vérifie qu'on est pas sorti du circuit
      //Vehicle.bounds();

      // classique.... on met à jour accelerations, vitesses et positions
      vehicle.update();
      // et on dessine
      // vehicle.show();

      // Une fois les voitures déplacées
      // On récupère la meilleure, celle qui a passé le plus de checkpoints
      if (vehicle.fitness > bestP.fitness) {
        bestP = vehicle;
      }
    }


    // On supprime les voitures mortes ou celles qui ont fini le circuit
    for (let i = population.length - 1; i >= 0; i--) {
      const vehicle = population[i];
      if (vehicle.dead || vehicle.finished) {
        savedVehicles.push(population.splice(i, 1)[0]);
      }
    }

    // Si jamais on a plus de voitures, on passe à la génération suivante
    // MB: ça me semble inutile, car on a déjà un test pour passer à la génération suivante
    if (population.length == 0) {
      currentTrack = track = new Track();
      nextGeneration(track);
      generationCount++;
    }
  }


  // On dessine les voitures
  for (let vehicle of population) {
    vehicle.show();
  }

  // On met la voiture la meilleure en surbrillance
  bestP.highlight();

  // on affiche le numéro de la génération
  fill(255);
  textSize(24);
  noStroke();
  text('generation ' + generationCount, 10, 50);

  // ellipse(start.x, start.y, 10);
  // ellipse(end.x, end.y, 10);
}