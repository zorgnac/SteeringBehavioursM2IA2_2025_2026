
class Boundary {
  constructor(x1, y1, x2, y2) {
    this.a = createVector(x1, y1);
    this.b = createVector(x2, y2);
  }

  reverse()
  {
    let p = this.a
    this.a = this.b
    this.b = p
  }

  midpoint() {
    return createVector((this.a.x + this.b.x) * 0.5, (this.a.y + this.b.y) * 0.5);
  }

  show() {
    push()
    if (this.killer) {
      stroke      ("purple");
      strokeWeight(min(1+this.killer,10));
    }
    else if (this.wrong)
      stroke(127);
    else
      stroke(255);
    line(this.a.x, this.a.y, this.b.x, this.b.y);
    pop()
  }

  /**
    Calcule la distance signée de 'p' au mur.

    Le signe dit de quel côté du mur on se trouve, et l'amplitude
    est la distance au projeté orthogonal

    Si 'inside' est vrai et que le projeté est à l'extérieur du mur,
    la distance est positive et est celle au plus proche des coins du mur.

  */
  signedDistance(p, inside) {
    let d = 0
    let p1 = this.a
    let p2 = this.b
    let {x,y} = p

    done:
    {
      if (inside) {
        // (p-p1).(p2-p1)
        let dot1 = (x - p1.x) * (p2.x - p1.x) + (y - p1.y) * (p2.y - p1.y)
        let dot2 = (x - p2.x) * (p2.x - p1.x) + (y - p2.y) * (p2.y - p1.y)
        if (dot2 * dot1 >= 0) {
          d = min(p5.Vector.dist(p1, p), p5.Vector.dist(p, p2))
          break done
        }
      }
      /*
      v = (p2-p1)/ |p2-p1|
      d = p^v-p1^v
      */
      const num = ((p2.y - p1.y) * x - (p2.x - p1.x) * y + p2.x * p1.y - p2.y * p1.x);
      const den = p5.Vector.dist(p1, p2);

      d = num / den
    }
    return d;
  }

  /** 
   * @typedef {object} Projection 
   * @property {p5.Vector} point point le plus proche dans [a,b]
   * @property {number} d distance absolue à {@link Projection.point}
   * @property {number} sign distance signée à la droite
   * @property {string} end extrémité si {@link Projection.point} est a ou b ("a", "b" ou null)
   * */

  /** Projette un point 
   * 
   * @param {p5.Vector} p 
   * 
   * @returns {Projection}
  */
  project(p) {
    /** @type {Projection} */let project = {sign: 0, d: null}
    let {sub, add, mult, dist, cross} = p5.Vector


    project: {
      let { a, b } = this
      let choose = (point, end, d) => {
        project.point = point
        project.end = end
        project.d = d
      }
      let dab = sub(b, a).setMag(1)
      
      let pa = sub(a, p)
      let db = pa.dot(dab)

      project.sign = cross(dab, pa).z

      if (db >= 0) { choose(a, "a"); break project }

      let pb = sub(b, p)
      let da = -pb.dot(dab)

      if (da >= 0) { choose(b, "b"); break project }

      let q = add(a, mult(dab, -db))
      project.point = q
      // Pour cause d'arrondi, 'q' peut se trouver légèrement à l'extérieur
      // du segment [a,b]. Ceci est dommageable quand on cherche à trouver
      // le mur à distance minimale : un point qui projette pile au coin
      // d'un mur peut se calculer comme plus proche du mur adjacent. On s'assure
      // ici de bien savoir si on est sur ]a,b[, et de mesurer a ou b de manière consistante
      // avec le mur adjacent
      project.d = dist(p, project.point)
      let d
      d = dist(p, a); if (d <= project.d) { choose(a, "a", d); break project }
      d = dist(p, b); if (d <= project.d) { choose(b, "b", d); break project }

      // On est sur ]a,b[
      project.end = null
    }

    if (project.d == null)
      project.d = dist(p, project.point)

    // console.log(`project end=${project.end} d=${dist(p,project.point)} s=${project.sign}`)
    return project
  }
}
