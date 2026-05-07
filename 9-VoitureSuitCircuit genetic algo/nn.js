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
      else {
        this.input_nodes = input;
        this.hidden_nodes = hidden;
        this.output_nodes = output;
        this.model = this.createModel();
      }
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

      // couche d'activation classique de type sigmoide
      const hidden = tf.layers.dense({
        units: this.hidden_nodes,
        inputShape: [this.input_nodes],
        activation: 'sigmoid'
      });

      model.add(hidden);

      const output = tf.layers.dense({
        units: this.output_nodes,
        activation: 'sigmoid'
      });
      model.add(output);

      return model;
    }
  }
