class Target extends Vehicle {
  constructor(x, y) {
    super(x, y);
    this.r = 50; // rayon de la cible
    this.color = 'green';
    this.vel = p5.Vector.random2D(); // vitesse initiale aléatoire
    // Vitesse max aléatoire enter 1 et 6
    this.vel.setMag(random(1, 6));

    // cercle de detection pour fuir
    this.rayonDetection = 100;

    
    setInterval(() => {
      // Changer la direction de la vitesse aléatoirement toutes les 500 ms
      this.vel = p5.Vector.random2D();
      this.vel.setMag(random(1, 20));
      this.maxSpeed = this.vel.mag();
      // change le rayon aussi
        this.r = random(20, 50);
        // et de couleur
        this.color = color(random(255), random(255), random(255));
        // et l'accélération
        this.acc = p5.Vector.random2D();
        this.acc.setMag(random(1, 5));
        this.maxForce = this.acc.mag();
    }, 1000);
    
  }

  /*
  update() {
    this.vel.setHeading(this.vel.heading() + random(-0.2, 0.2)); // changement aléatoire de direction
    super.update();

  }
    */

  show() {
    fill(this.color);
    noStroke();
    circle(this.pos.x, this.pos.y, this.r * 2);

    // on dessine le rayon de detection
    noFill();
    stroke(this.color);
    circle(this.pos.x, this.pos.y, this.rayonDetection * 2);
  }
}