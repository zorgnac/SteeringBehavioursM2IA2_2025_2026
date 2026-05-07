/** Neurones */
class NeuralNetwork {
    constructor(model, input, hidden, output, activation) {
      if (activation)
        this.activation = activation

      // Si on passe un réseau de neurones en paramètre
      // on l'utilise
      // sinon on crée un réseau de neurones
      // avec les paramètres passés: nombre de neurones en entrée, cachés et sortie
      if (model instanceof tf.Sequential) {
        this.model = model;
        this.input_nodes = input;
        this.hidden_nodes = hidden;
        this.output_nodes = output;
      } 
      else if (model && typeof model == typeof {}) {
        this.fromJSON(model)
      }
      else {
        this.input_nodes = input;
        this.hidden_nodes = hidden;
        this.output_nodes = output;
        this.model = this.createModel();
      }
    }

    /** Compte le nombre de paramètres */
    get params() {
      let hidden = this.hidden_nodes
      let count = 0
      if (typeof hidden == typeof []) {
        let current = hidden[0]
        count = this.input_nodes*current + current
        for (let i=1; i < hidden.length; i++)
        {
          count += current*hidden[i] + hidden[i]
          current = hidden[i]
        }
        count += current*this.output_nodes + this.output_nodes
      }
      else {
        let current = hidden
        count = this.input_nodes*current + current
        count += current*this.output_nodes + this.output_nodes
      }
      return count
    }
  
    // On crée une copie du réseau de neurones, utilise peut être pour 
    // implémenter la mutation...
    copy() {
      return tf.tidy(() => {
        const modelCopy = this.createModel();
        const weights = this.model.getWeights();
        const weightCopies = [];
        for (let i = 0; i < weights.length; i++) {
          weightCopies[i] = weights[i].clone();
        }
        modelCopy.setWeights(weightCopies);
        let copy = new NeuralNetwork(modelCopy, this.input_nodes, this.hidden_nodes, this.output_nodes, this.activation);
        return copy
      });
    }
  
    // Applique une mutation au "cerveau" de la voiture
    // rate est le taux de mutation
    // On applique la mutation sur les poids du réseau de neurones
    mutate(rate, temperature) {
      tf.tidy(() => {
        // On récupère le réseau de neurones
        // Ici les poids
        const weights = this.model.getWeights();
        // On crée un tableau pour les poids mutés
        const mutatedWeights = [];
        let mutated = 0;
        if (!temperature) temperature = 1;

        // Pour chaque poids
        for (let i = 0; i < weights.length; i++) {
          // On récupère le tenseur
          // qui contient les poids
          // et sa forme
          // et les valeurs
          let tensor = weights[i];
          let shape = weights[i].shape;
          let values = tensor.dataSync().slice();

          // Pour chaque valeur
          for (let j = 0; j < values.length; j++) {
            // On tire un nombre au hasard
            // si ce nombre est inférieur au taux de mutation
            // on ajoute un nombre aléatoire
            if (random(1) < rate) {
              let w = values[j];
              let dw = randomGaussian(0, temperature);
              values[j] = w + dw;
              if (dw != 0)
                mutated++;
            }
          }

          // On crée un nouveau tenseur avec les valeurs mutées
          let newTensor = tf.tensor(values, shape);
          mutatedWeights[i] = newTensor;
        }
        if (!mutated)
        {
          let i = int(random(weights.length));
          let tensor = weights[i];
          let shape  = weights[i].shape;
          let values = tensor.dataSync().slice();
          let j = int(random(values.length))
          let dw = 0;
          while (dw == 0)
            dw = randomGaussian(0, temperature)
          values[j] = values[j] + dw;

          let newTensor = tf.tensor(values, shape);
          mutatedWeights[i] = newTensor;
          mutated = 1;
        }

        // On applique les poids mutés au réseau de neurones
        this.model.setWeights(mutatedWeights);
        this.rate = rate;
        this.temperature = temperature;
        this.mutations = mutated;

        return mutated;
      });
    }

    /* Persistance du cerveau */

    toJSON() {
      let json = {
        inputs : this.input_nodes,
        hidden : this.hidden_nodes,
        outputs: this.output_nodes,
        temperature: this.temperature,
        rate       : this.rate,
        mutations  : this.mutations
      };
      for (let k of ["activation", "targets"])
      {
        if (k in this)
          json[k] = this[k]
      }

      const weights = this.model.getWeights();

      let weight = tensor => {
        let shape  = tensor.shape;
        let values = tensor.dataSync().slice();
        let generic = [] // Valeur float (sans type spécifique)

        for (let j = 0; j < values.length; j++) {
          let w = values[j];
          generic.push(w);
        }
        return { 
          shape : shape,
          values: generic
        }
      };

      json.weights = weights.map(weight);

      return json;
    }
    fromJSON(json) {
      // TODO: a-t-on besoin de tf.tidy() ici ?
      this.input_nodes  = json.inputs;
      this.hidden_nodes = json.hidden;
      this.output_nodes = json.outputs;
      for (let k of ["activation", "temperature", "mutations", "rate", "targets"]) {
        if (k in json)
          this[k] = json[k]
      }
      // this.model.dispose();
      this.model = this.createModel();

      const weights = [];
      for (let weight of json.weights) {
        let tensor = tf.tensor(weight.values, weight.shape);
        weights.push(tensor);
      }

      this.model.setWeights(weights);
    }

    dispose() {
      this.model.dispose();
    }
  
    // On prédit la sortie en fonction de l'entrée
    predict(...inputs) {
      return tf.tidy(() => {
        // On convertit l'entrée en tenseur
        // et on prédit la sortie
        const xs = tf.tensor2d(inputs);
        const ys = this.model.predict(xs);

        // On récupère les valeurs de la sortie
        const outputs = ys.dataSync();
        // console.log(outputs);
        this.last_predict = {
          inputs: inputs,
          outputs: outputs
        }
        return outputs;
      });
    }
  
    createModel() {
      // On crée un réseau de neurones
      // avec une couche d'entrée, une couche cachée et une couche de sortie
      const model = tf.sequential();
      let activation = 'sigmoid'
      if (this.activation) activation = this.activation

      let args = {
        inputShape: [this.input_nodes],
        activation: activation,
        // kernelInitializer: tf.initializers.randomNormal({ mean: 0.0, stddev: 0.1 }),
        // biasInitializer: tf.initializers.randomNormal({ mean: 0.0, stddev: 0.1 })
      }
      if (activation == "relu") {
        args.kernelInitializer = tf.initializers.heNormal(0.5)
        args.biasInitializer = tf.initializers.heNormal(0.5)
      }

      if (Array.isArray(this.hidden_nodes))
      {
        let hidden = this.hidden_nodes;
        args.units = hidden[0]

        const first = tf.layers.dense(args);

        model.add(first);
        delete args.inputShape

        for (let i = 1; i < hidden.length; i++) {
          args.units = hidden[i]
          const next = tf.layers.dense(args);

          model.add(next);
        }
      }
      else {
        args.units = this.hidden_nodes
        // couche d'activation classique de type sigmoïde
        const hidden = tf.layers.dense(args);

        model.add(hidden);
        delete args.inputShape
      }

      args.units = this.output_nodes
      const output = tf.layers.dense(args);
      model.add(output);

      return model;
    }

    /** Dessine sur le contexte 2d d'un canvas */
    draw(ctx, x, y) {
      if (!ctx) ctx = canvas.getContext("2d");

      if (x == null) x = 1
      if (y == null) y = 1

      let weights = this.toJSON().weights
      let index
      let o = [{ x: x, y: y }, { x: x, y: y }]
      let inputs
      let inter

      if (this.last_predict) {
        inputs = tf.tensor2d(this.last_predict.inputs)
        inter = []
        inter.push(inputs.dataSync())
        // console.log(inputs.dataSync())
      }

      let drawWeights = (tensor, axis) => {
        const indexOf = { x: 0, y: 1 }
        let bias = tensor.shape.length == 1
        let shape

        if (!bias) { shape = drawTensor(ctx, tensor, o[1].x, o[1].y, axis == "y") }
        else { shape = drawTensor(ctx, tensor, o[1].x, o[1].y, axis == "x") }

        let i = indexOf[axis]
        o[0][axis] += shape[i] + (bias ? 2 : 0)
        o[1][axis] += shape[i] + (bias ? 2 : 0)
      }

      const other = { x: "y", y: "x" }

      let drawLayer = (layer, axis) => {
        const inside = layer ? layer.weights.length : 0
        // throw 'inProgress'

        if (inputs) {
          let before = { x: o[1].x, y: o[1].y }
          before[other[axis]] -= 1
          let data = inputs.dataSync()
          if (layer) data = data.slice(0,layer.kernel.shape[0])
          drawVector(ctx, data, before.x, before.y, axis == "y", null, true)
          if (layer) {
            inputs = layer.apply(inputs)
            inter.push(inputs.dataSync())
          }
        }
        if (layer) {
          for (let i = 0; i < inside; i++)
            drawWeights(weights[index++], axis)
        }

        return inside ? other[axis] : axis
      }

      // return tf.tidy(() => 
      {
        // weights = this.model.getWeights()
        index = 0
        ctx.save()
        {
          const s = 10
          ctx.scale(s, s)
          let axis = "x"
          for (let layer of this.model.layers) {
            axis = drawLayer(layer, axis)
          }
        }
        ctx.restore()
        return inter
      }
    //)
    }
  }
