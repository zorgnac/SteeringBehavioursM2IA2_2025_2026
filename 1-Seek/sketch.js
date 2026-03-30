let target;
let vehicles = [];

// la fonction setup est appelée une fois au démarrage du programme par p5.js
function setup() {
  // on crée un canvas de 800px par 800px
  createCanvas(windowWidth, windowHeight);

  // On crée un véhicule à la position (100, 100)
  //vehicle = new Vehicle(100, 100);

  // TODO: créer un tableau de véhicules en global
  // ajouter nb vehicules au tableau dans une boucle
  // avec une position random dans le canvas
  creerVehicles(10);

  // La cible est un vecteur avec une position aléatoire dans le canvas
  // dirigée par la souris ensuite dans draw()
  //target = createVector(random(width), random(height));
  target = new Target(random(width), random(height));

  // Slider pour régler la vitesse max des véhicules
  // On crée le slider et on le positionne
  // paramètres du slider : min, max, valeur initiale, pas
  vitesseMaxSlider = createSlider(1, 20, 10, 1);
  vitesseMaxSlider.position(920, 10);
  vitesseMaxSlider.size(80);

  // je crée un label juste devant en X
  let labelVitesseMax = createDiv("Vitesse Max:");
  labelVitesseMax.position(810, 10);
  labelVitesseMax.style("color", "white");
  labelVitesseMax.style("font-size", "14px");

  // Slider pour régler la force max des véhicules
  forceMaxSlider = createSlider(0.1, 10, 0.25, 0.01);
  forceMaxSlider.position(920, 40);
  forceMaxSlider.size(80);

  // je crée un label juste devant en X
  let labelForceMax = createDiv("Force Max:");
  labelForceMax.position(810, 40);
  labelForceMax.style("color", "white");
  labelForceMax.style("font-size", "14px");
}

function creerVehicles(nb) {
  for (let i = 0; i < nb; i++) {
    let v = new Vehicle(random(width), random(height));
    vehicles.push(v);
  }
}


// la fonction draw est appelée en boucle par p5.js, 60 fois par seconde par défaut
// Le canvas est effacé automatiquement avant chaque appel à draw
function draw() {
  // fond noir pour le canvas
  background("black");

  // A partir de maintenant toutes les formes pleines seront en rouge
  fill("red");
  // pas de contours pour les formes.
  noStroke();

  // mouseX et mouseY sont des variables globales de p5.js, elles correspondent à la position de la souris
  // on les stocke dans un vecteur pour pouvoir les utiliser avec la méthode seek (un peu plus loin)
  // du vehicule
  //target.x = mouseX;
  //target.y = mouseY;

  // Dessine un cercle de rayon 32px à la position de la souris
  // la couleur de remplissage est rouge car on a appelé fill(255, 0, 0) plus haut
  // pas de contours car on a appelé noStroke() plus haut
  //circle(target.x, target.y, 32);
  
  target.update();
  target.show()
  target.edges();

  vehicles.forEach((vehicle) => {
    // je déplace et dessine le véhicule
    // Je récupère la valeur du slider et je la mets dans le véhicule
    vehicle.maxSpeed = vitesseMaxSlider.value();
    // on affiche la valeur de la vitesse à droite du slider
    fill("white");
    textSize(14);
    textAlign(LEFT, CENTER);
    text(vehicle.maxSpeed, 1010, 25);

    // Je récupère la valeur du slider et je la mets dans le véhicule
    vehicle.maxForce = forceMaxSlider.value();
    // on affiche la valeur de la force à droite du slider
    fill("white");
    textSize(14);
    textAlign(LEFT, CENTER);
    text(vehicle.maxForce, 1010, 55);

    vehicle.applyBehaviors(target.pos);
    vehicle.update();

    // On dessine le véhicule
    vehicle.show();

    // Detection : si le vehicule touche la target, il reapparait
    // ailleurs aléatoirement dans le canvas
    // si distance < somme des rayons (rayon du véhicule + rayon de la cible)
    if (vehicle.pos.dist(target.pos) < vehicle.r + 16) {
      // le véhicule a touché la cible, on le fait réapparaître ailleurs aléatoirement dans le canvas
      vehicle.pos = createVector(random(width), random(height));
    }

    // si le véhicule sort du canvas, on le fait réapparaître de l'autre côté
    vehicle.edges();
  });
}
