// CODEX : Cette vue lit les poids et les dernières entrées ; elle ne recalcule aucun capteur ni force.
const BrainInspector = {
  format(value) { return Number.isFinite(value) ? Number(value).toFixed(3) : '—'; },
  inputs(vehicle) {
    const labels = [], count = vehicle.span * 2 + 1;
    const angle = i => `${(i - vehicle.span) * vehicle.angle > 0 ? '+' : ''}${(i - vehicle.span) * vehicle.angle}°`;
    for (let i = 0; i < count; i++) labels.push({name: `Proximité ${angle(i)}`,
      help: 'Proximité du mur sur ce rayon : 0 = aucun mur dans la portée ; 1 = mur au niveau du véhicule.'});
    if (vehicle.options['side-direct'] || vehicle.options['weight-direct']) {
      for (let i = 0; i < count; i++) labels.push({name: `Sens du mur ${angle(i)}`,
        help: vehicle.options['weight-direct'] ? 'Repère de sens pondéré par la proximité : près du mur, la valeur tend vers 0 (droite) ou 1 (gauche) ; loin du mur, elle tend vers 0,5. La valeur 0,5 peut aussi signifier aucune intersection.' : 'Orientation du mur par rapport à ce rayon : 1 = son repère de parcours est à gauche du rayon, 0 = à droite, 0,5 = aucune intersection. Ce code n’indique pas à lui seul si la voiture roule dans le bon sens. Il peut être calculé même pour un mur au-delà de la portée des distances.'});
    } else if (vehicle.options.direct) labels.push({name: 'Sens du mur central', help: 'Orientation du mur par rapport au rayon central : 1 = repère de parcours à gauche du rayon, 0 = à droite, 0,5 = aucune intersection.'});
    for (const channel of Object.keys(vehicle.channels)) labels.push({name: `Canal ${channel}`, help: 'Pré-calcul du moteur, avec le facteur configuré pour ce véhicule.'});
    while (labels.length < vehicle.brain.input_nodes) labels.push({name: `Checkpoint / entrée ${labels.length + 1}`, help: 'Information optionnelle fournie par le moteur. Voir les options ahead/behind du véhicule.'});
    return labels.slice(0, vehicle.brain.input_nodes);
  },
  effective(outputs, symmetry) {
    if (!outputs) return null;
    return symmetry && outputs.length === 4 ? [(outputs[0] - outputs[2] + 1) / 2, (outputs[1] + outputs[3]) / 2] : Array.from(outputs).slice(0, 2);
  },
  shell() {
    return `<section class="brain-teaching"><h3>Des capteurs à la décision</h3>
      <p>Le réseau transforme ce que la voiture perçoit en <strong>direction et vitesse souhaitées</strong>.</p>
      <div id="brain-flow" class="brain-flow"></div>
      <section id="brain-input-guide" class="input-guide" aria-label="Comprendre les capteurs"></section>
      <details id="brain-driving-guide"><summary>Apprend-elle à accélérer et à freiner ?</summary><div id="brain-driving-explanation"></div></details>
      <button class="primary" id="brain-explore">Explorer le réseau et son calcul ↗</button>
      <p class="muted">Prédire une commande ne modifie pas les poids : ils changent lors d’une mutation ou de l’entraînement de l’élève.</p>
      <p class="muted">Un neurone caché combine des nombres. On ne peut pas lui attribuer automatiquement un rôle comme « éviter le mur ».</p>
      <details id="brain-matrix-details"><summary>Vue technique : que représentent les carrés ?</summary>
        <p>Les grands rectangles sont les <strong>matrices de poids W</strong>. Un carré est le poids d’une connexion entre deux neurones. Les bandes adjacentes représentent les <strong>biais b</strong>, un nombre ajouté par neurone.</p>
        <p class="muted">Instantané pris à l’ouverture du volet. Fermez puis rouvrez pour actualiser les bandes d’activations.</p>
        <canvas id="brain-board" width="400" height="400" aria-label="Matrices de poids et biais du réseau sélectionné"></canvas>
        <ul class="matrix-legend"><li><span class="weight-positive">Bleu</span> : poids ou biais positif ; <span class="weight-negative">rouge</span> : négatif ; gris : proche de zéro.</li><li>L’intensité est normalisée <strong>séparément dans chaque bloc</strong>. Comparer les couleurs de deux blocs ne compare pas directement les valeurs des poids.</li><li>Les fines bandes ajoutées pendant une observation montrent les <strong>entrées / activations</strong> : leur couleur utilise un repère centré sur 0,5, différent de celui des poids.</li><li>Le dessin alterne horizontal et vertical pour être compact. Il montre les paramètres, sans matérialiser le trajet des signaux.</li></ul><div id="brain-matrix-shapes"></div>
      </details></section>`;
  },
  update(vehicle) {
    UI.html('brain-input-guide', this.inputGuide(vehicle));
    UI.html('brain-driving-explanation', this.drivingGuide(vehicle));
    const widths = [vehicle.brain.input_nodes, ...[].concat(vehicle.brain.hidden_nodes), vehicle.brain.output_nodes];
    UI.html('brain-flow', widths.map((n,i) => `<span><strong>${n}</strong><small>${i === 0 ? 'entrées' : i === widths.length - 1 ? 'sorties' : 'couche cachée ' + i}</small></span>`).join('<b aria-hidden="true">→</b>'));
    const button = document.getElementById('brain-explore');
    button.disabled = !!Session.training;
    button.onclick = () => this.open(vehicle);
    document.getElementById('brain-matrix-details').ontoggle = e => {if (e.target.open && !Session.training) UI.brainInfo(vehicle);};
    UI.html('brain-matrix-shapes', '<p><strong>Dimensions :</strong> ' + widths.slice(1).map((n,i) => `W${i+1} : ${widths[i]} × ${n} ; b${i+1} : ${n}`).join(' · ') + '.</p>');
  },
  // CODEX : La légende suit les capteurs du véhicule sélectionné, y compris le sens pondéré facultatif.
  inputGuide(vehicle) {
    const count = vehicle.span * 2 + 1;
    const angles = Array.from({length:count},(_,i) => `${(i-vehicle.span)*vehicle.angle}°`).join(', ');
    const directional = vehicle.options.direct || vehicle.options['side-direct'] || vehicle.options['weight-direct'];
    return `<h4>Comment lire les entrées ?</h4><p><strong>${count} rayons : ${angles}.</strong> Les angles sont relatifs au cap de la voiture : négatif à gauche, 0° devant, positif à droite.</p>
      <p><strong>Proximité :</strong> 0 = aucun mur dans la portée ; 1 = mur au niveau de la voiture. Plus la valeur monte, plus le mur est proche. Cette information est calculée par la géométrie, avant le réseau.</p>` +
      (directional ? `<p><strong>Sens du mur :</strong> chaque bordure porte un repère de sens de parcours, comme une flèche peinte sur le circuit. Le capteur indique de quel côté du rayon se trouve ce repère.</p>
      <table class="input-code-table"><thead><tr><th>Code</th><th>Interprétation</th></tr></thead><tbody><tr><td>1</td><td>Repère à gauche du rayon.</td></tr><tr><td>0</td><td>Repère à droite du rayon.</td></tr><tr><td>0,5</td><td>Aucune intersection avec un mur${vehicle.options['weight-direct'] ? ', ou influence atténuée par la distance' : ''}.</td></tr></tbody></table>
      ${vehicle.options['weight-direct'] ? '<p>Avec l’option de pondération active, les valeurs intermédiaires tiennent aussi compte de la proximité. Les codes 0 et 1 sont les extrêmes de cette échelle.</p>' : '<p>Exemple avec trois rayons : trois valeurs à 1 signifient que les trois repères sont à gauche de leurs rayons respectifs. Ce n’est ni une probabilité, ni « tourner à gauche », ni la preuve que la voiture roule dans le bon sens.</p><p class="muted">Le sens peut être calculé pour une intersection au-delà de la portée des distances. Une proximité de 0 et un sens de 1 peuvent donc coexister.</p>'}` : '<p>Ce véhicule n’utilise pas les capteurs de sens des murs.</p>') +
      '<p>Le réseau apprend à combiner les entrées pour produire une direction et une vitesse souhaitées. La signification des capteurs, elle, est définie par le programme.</p>';
  },
  // CODEX : Cette explication décrit l'objectif réellement codé, sans attribuer un freinage appris à toute décélération.
  drivingGuide(vehicle) {
    const weight = vehicle.constructor.config.WEIGHT_SPEED;
    const channels = Object.keys(vehicle.channels);
    const mode = Session.settings.mode;
    const phase = ['observe','evaluate'].includes(mode) ? 'Dans ce scénario, les cerveaux sont fixes : aucun apprentissage ne se produit pendant la course.' :
      mode === 'teach' ? 'Dans ce scénario, l’élève imite les sorties du maître avec Adam et une erreur quadratique. Il ne maximise pas directement le mérite génétique.' :
      'Dans ce scénario, la sélection et les mutations font évoluer les descendants. Les poids d’une voiture ne changent pas simplement parce qu’elle roule.';
    return `<p class="notice">${phase}</p><h4>Ce que l’évolution favorise</h4>
      <p>Le mérite combine <strong>checkpoints franchis</strong> et <strong>vitesse au dernier tour terminé</strong>. Le poids de vitesse configuré est <strong>${UI.escape(weight)}</strong>.
      ${weight > 0 ? 'À progression identique sur un même circuit, terminer un tour plus vite augmente ce mérite.' : 'Le facteur de vitesse au tour est désactivé ; progresser et éviter l’abandon restent utiles.'}</p>
      <p>Il n’existe pas de récompense dédiée au freinage avant un virage, à l’accélération en ligne droite, ni à la douceur des commandes. La voiture reçoit une <strong>vitesse souhaitée</strong>, pas des ordres de pédales.</p>
      <h4>Ce qui peut émerger</h4><p>Une politique qui ralentit à l’approche des murs ou d’un passage difficile, puis demande plus de vitesse quand la voie s’ouvre, peut mieux réussir et être conservée. Ce comportement est possible, mais il doit être observé et mesuré sur plusieurs circuits pour être confirmé.</p>
      <p>${channels.length ? 'Ce cerveau reçoit aussi des pré-calculs de vitesse via les canaux : '+channels.map(c=>UI.escape(c)).join(', ')+'.' : 'Ce cerveau ne reçoit pas la vitesse actuelle en entrée : il réagit aux murs et aux autres capteurs configurés. Le moteur utilise néanmoins la vitesse réelle pour calculer la force de steering.'}</p>
      <h4>Comment observer un freinage ?</h4><p>Comparez la <strong>vitesse souhaitée</strong> à la <strong>vitesse mesurée</strong> dans l’onglet Voiture, avec Un pas avant un virage puis dans une ligne droite. Une consigne plus basse indique une demande de ralentissement ; une baisse de vitesse réelle peut aussi venir de la force de changement de direction. Elle ne prouve pas à elle seule une anticipation du virage.</p>
      <p>Le scénario balai ajoute une pression sur la progression relative. En maître/élève, un freinage peut être imité si le maître le montre dans les données collectées.</p>
      <details><summary>Formule du mérite utilisée par le moteur</summary><p class="formula">s = 2^(longueur du circuit / pas du dernier tour) − 1<br>mérite = [(1 + points) × (1 + W × s) / ((tours × checkpoints + 1) × (1 + W))]²</p><p class="muted">W est le poids de vitesse. s est un score transformé de vitesse au tour, et non une vitesse en km/h. Le réseau lui-même reste un réseau de couches denses, sans mémoire récurrente.</p></details>`;
  },
  snapshot(vehicle) {
    const brain = vehicle.brain, definition = brain.toJSON(), observation = brain.last_predict;
    let values = null, batchOutputs = null;
    if (observation) {
      // CODEX : On rejoue seulement les couches du réseau sur des données enregistrées ; tous les tenseurs sont temporaires.
      values = tf.tidy(() => {
        let tensor = tf.tensor2d(observation.inputs);
        const rows = [Array.from(observation.inputs[0])];
        for (const layer of brain.model.layers) {
          tensor = layer.apply(tensor);
          rows.push(Array.from(tensor.dataSync()).slice(0, layer.units));
        }
        batchOutputs = Array.from(tensor.dataSync());
        return rows;
      });
    }
    return {name: vehicle.id, widths: [brain.input_nodes, ...[].concat(brain.hidden_nodes), brain.output_nodes],
      weights: definition.weights, activation: definition.activation || 'sigmoid', labels: this.inputs(vehicle), values,
      symmetry: !vehicle.options['no-sym'], effective: this.effective(batchOutputs, !vehicle.options['no-sym']),
      speedUnit: vehicle.speedUnit, captured: new Date().toLocaleTimeString('fr-FR')};
  },
  open(vehicle) {
    if (Session.training) return UI.message('Attendez la fin du fit pour inspecter des poids stables.');
    this.vehicle = vehicle; this.wasPaused = UI.paused; UI.paused = true;
    this.data = this.snapshot(vehicle); this.selection = {layer: this.data.widths.length - 1, index: 0};
    let dialog = document.getElementById('brain-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.id = 'brain-dialog'; dialog.className = 'brain-dialog';
      dialog.setAttribute('aria-label', 'Comprendre le réseau de neurones'); document.body.append(dialog);
    }
    dialog.innerHTML = `<header class="dialog-head"><div><span class="eyebrow">COMPRENDRE LE CERVEAU</span><h2>Comment la voiture prend-elle une décision ?</h2></div><button id="brain-close" class="icon-button" aria-label="Fermer l’exploration du cerveau">×</button></header>
      <div class="dialog-body"><p id="brain-snapshot-note" class="notice"></p>
      <p><strong>Lecture de gauche à droite :</strong> capteurs → combinaisons apprises → sorties. Cliquez sur un neurone pour voir son calcul.</p>
      <p class="network-legend"><span class="weight-positive">Trait bleu : poids positif</span> · <span class="weight-negative">trait rouge : poids négatif</span>. L’épaisseur représente |poids|, rapporté au maximum de la couche. Le nombre dans un cercle est son activation ; « — » signifie aucune observation.</p>
      <div id="brain-network" class="network-scroll"></div>
      <section id="neuron-calculation" class="neuron-calculation" aria-live="polite"></section>
      <div class="brain-explanations"><section><h3>1. Que voit la voiture ?</h3><div id="brain-input-table"></div><details><summary>Rappel des codes des capteurs</summary>${this.inputGuide(vehicle)}</details></section><section><h3>2. Que demande le réseau ?</h3><div id="brain-output-explanation"></div><h3>3. Comment la voiture bouge-t-elle ?</h3><p>La consigne devient une vitesse souhaitée. Le moteur calcule <strong>force = vitesse souhaitée − vitesse actuelle</strong>, limite cette force puis l’applique. Le réseau ne modifie pas directement la position.</p></section></div>
      <details class="driving-lesson"><summary>Ce que l’entraînement encourage : vitesse, virages et freinage</summary>${this.drivingGuide(vehicle)}</details>
      <p class="muted">Les poids et les biais sont les paramètres ajustables du réseau. Les activations dépendent de la situation. Les liens montrent une opération de calcul, pas la preuve qu’un neurone a une signification humaine unique.</p></div>
      <footer class="dialog-foot"><span class="muted">La physique est suspendue pendant l’exploration.</span><span class="spacer"></span><button id="brain-refresh" class="secondary">Actualiser l’observation</button><button id="brain-done" class="primary">Revenir à la simulation</button></footer>`;
    const close = () => dialog.close();
    document.getElementById('brain-close').onclick = close; document.getElementById('brain-done').onclick = close;
    document.getElementById('brain-refresh').onclick = () => {this.data = this.snapshot(this.vehicle);this.render();};
    dialog.onclose = () => {UI.paused = this.wasPaused;this.vehicle = null;this.data = null;UI.render(true);};
    this.render(); dialog.showModal();
  },
  render() {
    const d = this.data, escape = UI.escape, output = ['Direction brute', 'Vitesse brute'];
    document.getElementById('brain-snapshot-note').textContent = `${d.name} · instantané à ${d.captured}. ` +
      (d.values ? 'Calcul pédagogique sur les dernières entrées enregistrées et les poids actuels. Pour observer une autre situation, fermez cette fenêtre, avancez puis rouvrez-la.' : 'Aucune décision enregistrée : les paramètres sont visibles, mais pas les activations. Faites Un pas, puis rouvrez cette fenêtre.');
    const cap = 12, max = Math.max(...d.widths.map(n => Math.min(n, cap))), height = 130 + max*40;
    const width = 380+(d.widths.length-1)*200;
    const point = (layer,index) => ({x:170+layer*200,y:85+(height-150)/(Math.min(d.widths[layer],cap)+1)*(index+1)});
    let svg = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="group" aria-label="Réseau de ${d.name.replace(/[&<>"']/g,'')} ; sélectionnez un neurone"><title>Capteurs, couches cachées et deux sorties</title>`;
    for (let l=1;l<d.widths.length;l++) {
      const weights=d.weights[2*(l-1)], scale=Math.max(...weights.values.map(Math.abs),.000001);
      for(let i=0;i<Math.min(d.widths[l-1],cap);i++)for(let j=0;j<Math.min(d.widths[l],cap);j++) {
        const w=weights.values[i*d.widths[l]+j], a=point(l-1,i), b=point(l,j);
        const selected=this.selection.layer===l && this.selection.index===j;
        svg+=`<line aria-hidden="true" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${w>=0?'#8dcdf8':'#eea09b'}" stroke-width="${.4+2*Math.abs(w)/scale}" opacity="${selected ? .9 : .12}"><title>Couche ${l-1}, neurone ${i+1} → couche ${l}, neurone ${j+1} : poids ${this.format(w)}</title></line>`;
      }
    }
    for(let l=0;l<d.widths.length;l++) {
      svg+=`<text x="${170+l*200}" y="30" text-anchor="middle" class="network-heading">${l===0?'Capteurs':l===d.widths.length-1?'Sorties':'Couche cachée '+l} (${d.widths[l]})</text>`;
      for(let i=0;i<Math.min(d.widths[l],cap);i++) {
        const p=point(l,i), value=d.values?.[l]?.[i], selected=this.selection.layer===l && this.selection.index===i;
        const label=l===0?d.labels[i].name:l===d.widths.length-1?output[i]:`Neurone ${i+1}`;
        svg+=`<g role="button" tabindex="0" data-layer="${l}" data-neuron="${i}" aria-label="${escape(label)} : ${this.format(value)}" aria-pressed="${selected}"><title>${escape(label)} — activation ${this.format(value)}. Sélectionner pour voir les détails.</title><circle cx="${p.x}" cy="${p.y}" r="16" class="network-neuron ${selected?'selected':''}"/><text x="${p.x}" y="${p.y+4}" text-anchor="middle" class="network-value">${this.format(value)}</text></g>`;
        if(l===0)svg+=`<text x="${p.x-30}" y="${p.y+4}" text-anchor="end" class="network-label">${escape(label)}</text>`;
        else if(l===d.widths.length-1)svg+=`<text x="${p.x+30}" y="${p.y+4}" class="network-label">${label}</text>`;
      }
      if(d.widths[l]>cap)svg+=`<text x="${170+l*200}" y="${height-20}" text-anchor="middle" class="network-label">${d.widths[l]-cap} autres neurones non dessinés</text>`;
    }
    svg+='</svg>';
    document.getElementById('brain-network').innerHTML=svg;
    document.querySelectorAll('#brain-network [data-neuron]').forEach(node=>{
      const select=()=>{this.selection={layer:Number(node.dataset.layer),index:Number(node.dataset.neuron)};this.render();
        document.querySelector(`#brain-network [data-layer="${this.selection.layer}"][data-neuron="${this.selection.index}"]`).focus();};
      node.onclick=select;node.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}};
    });
    document.getElementById('brain-input-table').innerHTML='<table><thead><tr><th>Entrée</th><th>Valeur</th></tr></thead><tbody>'+d.labels.map((label,i)=>`<tr><td>${escape(label.name)}<small class="sensor-help">${escape(label.help)}</small></td><td>${this.format(d.values?.[0]?.[i])}</td></tr>`).join('')+'</tbody></table>';
    const effective=d.effective;
    document.getElementById('brain-output-explanation').innerHTML=`<p>${d.symmetry?'Le moteur prédit aussi sur les capteurs en miroir. Le dessin détaille la branche originale ; la décision combine les deux branches.':'La symétrie est désactivée : les deux sorties brutes donnent directement les consignes.'}</p>`+
      (effective?`<dl class="facts"><dt>Direction effective</dt><dd>${this.format(effective[0])}</dd><dt>Angle relatif souhaité</dt><dd>${((effective[0]*2-1)*180).toFixed(1)}°</dd><dt>Vitesse effective</dt><dd>${this.format(effective[1])}</dd><dt>Vitesse souhaitée</dt><dd>${this.format(effective[1]*d.speedUnit)} px / pas</dd></dl>`:'<p>Les sorties apparaîtront après une observation.</p>')+
      `<p>Pour la direction : <strong>0,5 = tout droit</strong> ; en dessous = virage à gauche, au-dessus = virage à droite. La vitesse est multipliée par l’unité du véhicule (${d.speedUnit} px/pas). Ces consignes peuvent dépasser les intervalles habituels avec ReLU.</p>`+
      (d.symmetry?'<p class="formula">direction = (d_original − d_miroir + 1) / 2<br>vitesse = (v_original + v_miroir) / 2</p>':'');
    this.calculation();
  },
  calculation() {
    const d=this.data, {layer,index}=this.selection, el=document.getElementById('neuron-calculation');
    if(layer===0) {el.innerHTML=`<h3>${UI.escape(d.labels[index].name)}</h3><p>${UI.escape(d.labels[index].help)}</p><p>Valeur observée : <strong>${this.format(d.values?.[0]?.[index])}</strong>. Une entrée est une mesure, sans poids ni biais propre.</p>`;return;}
    const W=d.weights[2*(layer-1)].values, bias=d.weights[2*(layer-1)+1].values[index];
    const rows=Array.from({length:d.widths[layer-1]},(_,i)=>({i,w:W[i*d.widths[layer]+index],a:d.values?.[layer-1]?.[i]}));
    rows.forEach(r=>r.term=Number.isFinite(r.a)?r.w*r.a:null);
    rows.sort((a,b)=>Math.abs(b.term ?? b.w)-Math.abs(a.term ?? a.w));
    const z=d.values?rows.reduce((sum,r)=>sum+r.term,0)+bias:null;
    const title=layer===d.widths.length-1?['Direction brute','Vitesse brute'][index]:`Couche cachée ${layer}, neurone ${index+1}`;
    const activation=d.activation==='relu'?'ReLU(z) = max(0, z)':d.activation==='sigmoid'?'sigmoïde(z) = 1 / (1 + exp(−z))':'tanh(z)';
    el.innerHTML=`<h3>${title}</h3><p class="formula">z = Σ (activation précédente × poids) + biais<br>sortie = ${activation}</p>
      <p>Biais : <strong>${this.format(bias)}</strong> · Somme z : <strong>${this.format(z)}</strong> · Activation : <strong>${this.format(d.values?.[layer]?.[index])}</strong>.</p>
      <p>Un poids positif multiplie le signal avec le même signe ; un poids négatif en inverse le signe. L’effet réel dépend aussi de l’activation entrante.</p>
      <table><thead><tr><th>Source</th><th>Activation</th><th>Poids</th><th>Produit</th></tr></thead><tbody>${rows.slice(0,8).map(r=>`<tr><td>${UI.escape(layer===1?d.labels[r.i].name:'Neurone '+(r.i+1))}</td><td>${this.format(r.a)}</td><td class="${r.w>=0?'weight-positive':'weight-negative'}">${this.format(r.w)}</td><td>${this.format(r.term)}</td></tr>`).join('')}</tbody></table>
      <p class="muted">${rows.length>8?'Les 8 contributions les plus fortes sont affichées ; toutes sont incluses dans la somme.':'Toutes les connexions entrantes sont affichées.'} ${!d.values?'Sans observation, le classement utilise |poids| et aucun produit n’est calculé.':''}</p>`;
  }
};
