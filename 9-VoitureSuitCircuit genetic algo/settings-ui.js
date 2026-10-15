// CODEX : Les formulaires manipulent un brouillon ; aucun paramètre moteur n'est appliqué à la saisie.
const SettingsUI = {
  fields: [
    ['Circuit généré','tricky','Sinuosité',.1,12,'Fréquence des variations du circuit ; ce n’est pas une difficulté calibrée.'],
    ['Circuit généré','checkpoints','Checkpoints',12,1000,'Nombre de passages par tour.'],
    ['Circuit généré','laps','Tours demandés',1,20,'Les circuits importés conservent leur nombre de tours.'],
    ['Circuit généré','widthMin','Demi-largeur minimale',1,150,'Pixels de chaque côté du centre de piste.'],
    ['Circuit généré','widthMax','Demi-largeur maximale',1,150,'Pixels de chaque côté du centre de piste.'],
    ['Population et évolution','quota','Quota cible',1,200,'Nombre de voitures réussies recherché ; pas nécessairement le nombre en course.'],
    ['Population et évolution','lifespan','Délai sans checkpoint',1,10000,'Seuil physique = valeur × 60 / nombre de checkpoints, en pas et non en secondes.'],
    ['Population et évolution','mutationRate','Taux de mutation',.0001,1,'Probabilité de mutation d’un paramètre, modulée par beta. Au moins une mutation est forcée.'],
    ['Population et évolution','temperature','Amplitude des mutations',.0001,5,'Écart-type de la perturbation gaussienne, modulé par beta.'],
    ['Population et évolution','weightSpeed','Poids de la vitesse',0,10,'Influence de la vitesse au tour dans le mérite de reproduction.'],
    ['Qualifications','maxTracks','Maximum de circuits (0 = tous)',0,100,'Un lot partiel ne garantit pas une qualification sur tous les circuits connus.'],
    ['Qualifications','minElders','Seuil de vétérans',1,200,'Seuil utilisé par la qualification partielle et automatique.'],
    ['Nouvelle graine uniquement','span','Rayons de chaque côté',0,12,'Nombre total de rayons = 2 × cette valeur + 1.'],
    ['Nouvelle graine uniquement','angle','Écart angulaire',1,90,'Angle en degrés entre deux rayons ; le cône total est limité à 180°.'],
    ['Nouvelle graine uniquement','sight','Portée des capteurs',1,2000,'Portée en pixels. Les voitures importées conservent leurs capteurs.'],
    ['Nouvelle graine uniquement','force','Force maximale',.001,2,'Limite de la force de steering.'],
    ['Nouvelle graine uniquement','maxSpeed','Plafond de vitesse (0 = sans plafond)',0,30,'0 utilise REF_SPEED comme unité de consigne, sans limiter explicitement la vitesse.'],
    ['Nouvelle graine uniquement','safe','Marge de bord',-10,50,'Distance signée en pixels ; une petite valeur négative permet de mordre le bord.'],
    ['Difficulté progressive','increment','Incrément',.1,5,'Augmentation à la déclaration d’un nouveau circuit, pas selon un taux de réussite.'],
    ['Difficulté progressive','target','Sinuosité cible',.1,12,'Niveau maximal de la progression.']
  ],
  integer: new Set(['quota','checkpoints','laps','maxTracks','minElders','span','lifespan']),
  help(text) {return `<span class="help" tabindex="0" role="note" aria-label="${UI.escape(text)}">?<span class="tooltip">${UI.escape(text)}</span></span>`;},
  input(key,label,help,min,max) {
    return `<label class="field"><span>${label} ${this.help(help)}</span><input name="${key}" inputmode="decimal" type="text" required data-min="${min}" data-max="${max}" aria-label="${label}"></label>`;
  },
  check(key,label,help) {return `<label class="check"><input type="checkbox" name="${key}"><span>${label}</span>${this.help(help)}</label>`;},
  open(advanced = false, mode = null) {
    if (Session.training || Session.loading) return UI.message('Attendez la fin de l’opération en cours.');
    this.advanced=advanced; this.draft=copyJSON(mode ? sessionDefaults(mode) : Session.settings);
    if (mode === 'resume') this.draft.source='import';
    this.wasPaused=UI.paused; this.previousImport=UI.imported; UI.paused=true; this.committed=false;
    const dialog=document.getElementById('settings-dialog');
    dialog.innerHTML=`<form id="settings-form" novalidate>
      <header class="dialog-head"><div><span class="eyebrow">${advanced?'CONFIGURATION':'NOUVELLE EXPÉRIENCE'}</span><h2>${advanced?'Réglages avancés':'Que voulez-vous explorer ?'}</h2></div><button type="button" class="icon-button" id="close-settings" aria-label="Fermer">×</button></header>
      <div class="dialog-body">${advanced?this.advancedFields():this.scenarioFields()}
      <p id="draft-summary" class="notice"></p><p class="form-error" id="form-error" role="alert"></p>
      <section id="replace-guard" class="notice" hidden><strong>Conserver la session actuelle ?</strong><p>Des résultats ou archives n’ont pas été exportés.</p><div class="button-row"><button type="button" id="export-replace">Exporter puis préparer</button><button type="button" id="replace-now" class="secondary">Préparer sans exporter</button><button type="button" id="cancel-replace" class="secondary">Annuler</button></div></section>
      </div><footer class="dialog-foot"><button type="button" class="secondary" id="reset-settings">Valeurs du scénario</button><span class="spacer"></span><button type="button" class="secondary" id="cancel-settings">Annuler</button><button type="submit" class="primary">Préparer une nouvelle session</button></footer></form>`;
    this.fill(); this.bind(); dialog.showModal(); this.summary();
  },
  scenarioFields() {
    return `<div class="scenario-grid">${Object.entries(Scenarios).map(([id,s])=>`<label class="scenario-card"><input type="radio" name="mode" value="${id}" ${this.draft.mode===id?'checked':''}><span class="scenario-icon">${s.icon}</span><span class="eyebrow">${s.tag}</span><strong>${s.name}</strong><span>${s.text}</span></label>`).join('')}</div>
      <section class="settings-section"><h3>Ressources de départ</h3><div class="field-grid">
      <label class="field"><span>Population</span><select name="source"><option value="builtin">Deux cerveaux fournis</option><option value="import">Fichier importé</option></select></label>
      <label class="field"><span>Circuits</span><select name="circuitSource"><option value="generated">Génération de nouveaux circuits</option><option value="builtin">Circuit fourni (1 circuit, 2 tours)</option><option value="import">Circuits importés</option></select></label>
      ${this.input('quota','Quota cible','En évolution, nombre de réussites recherché.',1,200)}
      ${this.input('tricky','Sinuosité initiale','Concerne uniquement les circuits générés.',.1,12)}
      <label class="field" id="teacher-field"><span>Maître / référence balai</span><select name="teacher"></select></label>
      </div><label class="import-zone">Importer voitures, circuits ou expérience (.json)<input id="import-files" type="file" accept=".json,application/json" multiple><span id="import-summary">Les fichiers restent sur votre ordinateur.</span></label>
      ${this.check('reuse','Réutiliser les anciennes réussites','Désactivé : chaque cerveau est mesuré à nouveau. Activé : certaines réussites ne seront pas rejouées.')}
      <p class="muted">Pour les capteurs, le réseau, les mutations et les pauses, ouvrez Réglages avancés après la préparation.</p></section>`;
  },
  advancedFields() {
    let html='<p class="notice">Ces réglages préparent une <strong>nouvelle session en pause</strong>. Les caractéristiques des cerveaux importés sont conservées. Scénario : '+UI.escape(Scenarios[this.draft.mode].name)+'.</p>';
    for(const group of [...new Set(this.fields.map(f=>f[0]))]) {
      html+=`<section class="settings-section"><h3>${group}</h3><div class="field-grid">`;
      for(const [g,k,l,min,max,h] of this.fields) if(g===group)html+=this.input(k,l,h,min,max);
      if(group==='Nouvelle graine uniquement')html+=`<label class="field"><span>Couches cachées</span><input name="hidden" placeholder="9,6" required><small>1 à 4 couches ; 1 à 128 neurones chacune.</small></label><label class="field"><span>Activation</span><select name="activation"><option>relu</option><option>sigmoid</option><option>tanh</option></select></label>`;
      html+='</div>';
      if(group==='Qualifications')html+=this.check('autoTest','Qualifications automatiques','L’évolution peut produire des descendants pendant ces qualifications.')+this.check('full','Inclure les anciens à qualifier','FULL modifie le quota ; il ne force pas le lot complet.');
      if(group==='Nouvelle graine uniquement')html+=this.check('symmetry','Combiner les observations miroir','Deux prédictions sont combinées pour la décision.')+this.check('directional','Capteurs de sens des murs','Ajoute une information de sens par rayon.');
      if(group==='Difficulté progressive')html+=this.check('progressive','Augmenter progressivement la sinuosité','Disponible pour évolution et reprise ; ce n’est pas une mesure du niveau des voitures.');
      html+='</section>';
    }
    html+=`<section class="settings-section"><h3>Affichage et pauses</h3><div class="field-grid">${this.input('rate','Images par seconde demandées','Cadence réelle limitée par les performances.',1,60)}${this.input('steps','Pas physiques par image','Accélère les essais sans changer les forces.',1,12)}</div>${this.check('pauseRace','Pause après chaque course','La course suivante est préparée en pause.')}${this.check('pauseTest','Pause après qualification','Suspend la simulation après une qualification automatique.')}${this.check('debug','Afficher les outils de débogage','Les réussites artificielles marquent la session comme manipulée.')}</section>`;
    return html;
  },
  fill() {
    const form=document.getElementById('settings-form');
    for(const [k,v] of Object.entries(this.draft)) {
      const el=form.elements.namedItem(k); if(!el || k==='mode')continue;
      if(el.type==='checkbox')el.checked=!!v;else el.value=v;
    }
    this.teachers();
  },
  teachers() {
    const form=document.getElementById('settings-form'), select=form.elements.namedItem('teacher');
    if(!select)return;
    const source=form.elements.source.value;
    const vehicles=source==='import'?UI.imported?.vehicles:Session.catalog['car-simple-1']?.vehicles;
    select.innerHTML='';
    (vehicles || []).forEach(v=>{const o=document.createElement('option');o.value=v.name || v.uuid;o.textContent=v.name || v.uuid;select.append(o);});
    if([...select.options].some(o=>o.value===this.draft.teacher))select.value=this.draft.teacher;
  },
  bind() {
    const dialog=document.getElementById('settings-dialog'), form=document.getElementById('settings-form');
    const close=()=>dialog.close();
    document.getElementById('close-settings').onclick=close;document.getElementById('cancel-settings').onclick=close;
    dialog.onclose=()=>{if(!this.committed){UI.paused=this.wasPaused;UI.imported=this.previousImport;}UI.render(true);};
    document.getElementById('reset-settings').onclick=()=>{this.draft=sessionDefaults(this.draft.mode);this.fill();this.summary();};
    form.oninput=()=>{document.getElementById('replace-guard').hidden=true;this.summary();};
    form.onchange=e=>{
      if(e.target.name==='mode') {
        const mode=e.target.value;this.draft=sessionDefaults(mode);if(mode==='resume')this.draft.source='import';this.fill();
      }
      if(e.target.name==='source')this.teachers();this.summary();
    };
    const input=document.getElementById('import-files');
    if(input)input.onchange=async()=>{
      try {
        let combined={vehicles:[],tracks:[]}, count=0;
        for(const file of input.files) {
          if(file.size>10*1024*1024)throw Error('Un fichier est limité à 10 Mo.');
          const data=Session.validate(JSON.parse(await file.text()));
          combined.vehicles.push(...data.vehicles);combined.tracks.push(...data.tracks);if(data.total && !combined.total)combined.total=data.total;count++;
          if(data.experience)combined.experience=data.experience;
        }
        if(combined.vehicles.length>200 || combined.tracks.length>100)throw Error('Lot trop volumineux.');
        UI.imported=combined;
        if(combined.experience) {
          const saved=combined.experience.settings || {};
          for(const k of Object.keys(this.draft))if(k in saved)this.draft[k]=saved[k];
          if(!Scenarios[this.draft.mode])throw Error('Scénario sauvegardé inconnu.');
          this.draft.source='import';this.draft.circuitSource=combined.tracks.length?'import':'generated';
          this.fill();
          const radio=form.querySelector(`input[name="mode"][value="${this.draft.mode}"]`);if(radio)radio.checked=true;
        } else {
          if(combined.vehicles.length)form.elements.source.value='import';
          if(combined.tracks.length)form.elements.circuitSource.value='import';
          if(combined.vehicles.length)form.elements.quota.value=combined.total || combined.vehicles.length;
        }
        document.getElementById('import-summary').textContent=`${count} fichier(s) · ${combined.vehicles.length} voitures · ${combined.tracks.length} circuits`;
        document.getElementById('form-error').textContent='';this.teachers();this.summary();
      }catch(e){document.getElementById('form-error').textContent=e.message;}
    };
    form.onsubmit=e=>{
      e.preventDefault();
      try {
        this.read();
        if(Session.dirty || Archives.items.length)document.getElementById('replace-guard').hidden=false;
        else this.commit();
      }catch(err){document.getElementById('form-error').textContent=err.message;}
    };
    document.getElementById('export-replace').onclick=()=>{Session.export();this.commit();};
    document.getElementById('replace-now').onclick=()=>this.commit();
    document.getElementById('cancel-replace').onclick=()=>document.getElementById('replace-guard').hidden=true;
  },
  read() {
    const form=document.getElementById('settings-form'), s=copyJSON(this.draft);
    for(const el of form.elements) {
      if(!el.name || el.type==='radio')continue;
      if(el.type==='checkbox')s[el.name]=el.checked;
      else if(el.dataset.min != null) {
        const text=el.value.trim().replace(',','.');const n=Number(text);
        if(!text || !Number.isFinite(n) || n<Number(el.dataset.min) || n>Number(el.dataset.max)
          || (this.integer.has(el.name) && !Number.isInteger(n)))throw Error(el.getAttribute('aria-label')+' : valeur invalide.');
        s[el.name]=n;
      }else s[el.name]=el.value;
    }
    const mode=form.querySelector('input[name="mode"]:checked');if(mode)s.mode=mode.value;
    if(s.widthMin>s.widthMax)throw Error('La demi-largeur minimale dépasse la maximale.');
    if(s.span*s.angle>90)throw Error('Le cône de vision dépasse 180°.');
    const hidden=String(s.hidden).split(',').map(x=>Number(x.trim()));
    if(!hidden.length || hidden.length>4 || hidden.some(n=>!Number.isInteger(n)||n<1||n>128))throw Error('Couches cachées : 1 à 4 nombres entiers entre 1 et 128.');
    if(s.progressive && s.target<s.tricky)throw Error('La sinuosité cible doit être supérieure ou égale au départ.');
    this.draft=s;return s;
  },
  summary() {
    const form=document.getElementById('settings-form');
    const mode=form.querySelector('input[name="mode"]:checked')?.value || this.draft.mode;
    const source=form.elements.namedItem('source');if(source)source.disabled=mode==='evolve';
    const teacher=document.getElementById('teacher-field');if(teacher)teacher.hidden=!['teach','broom'].includes(mode);
    const q=form.elements.namedItem('quota');if(q)q.disabled=!!Scenarios[mode].fixed || mode==='teach';
    const evolving=['evolve','resume','broom'].includes(mode);
    const seed=mode==='evolve' && this.draft.source!=='import';
    const inactive=[...(!evolving?['mutationRate','temperature','weightSpeed','autoTest','maxTracks','minElders','full']:[]),
      ...(!seed?['span','angle','sight','force','maxSpeed','safe','hidden','activation','symmetry','directional']:[]),
      ...(!['evolve','resume'].includes(mode)?['progressive','increment','target']:[])];
    inactive.forEach(key=>{const el=form.elements.namedItem(key);if(el)el.disabled=true;});
    const reuse=form.elements.namedItem('reuse');if(reuse)reuse.closest('label').hidden=mode!=='evaluate';
    const isImport=(source?.value || this.draft.source)==='import';
    const seedCount=isImport?(UI.imported?.vehicles.length || Session.imported?.vehicles.length || 0):mode==='evolve'?1:2;
    if(source && mode==='evolve' && !isImport)source.options[0].textContent='Graine aléatoire (seed-c)';else if(source)source.options[0].textContent='Deux cerveaux fournis';
    document.getElementById('draft-summary').textContent=`${Scenarios[mode].name} · ${seedCount} voiture(s) au départ · ${Scenarios[mode].fixed?'Poids fixes, aucune reproduction':mode==='teach'?'Collecte puis imitation TensorFlow':'Sélection et mutation actives'} · Nouvelle session en pause.`;
  },
  async commit() {
    try {
      const s=this.read();await Session.prepare(s,this.advanced ? Session.imported : (UI.imported || Session.imported));
      this.committed=true;document.getElementById('settings-dialog').close();
    }catch(e){document.getElementById('form-error').textContent=e.message;}
  }
};
