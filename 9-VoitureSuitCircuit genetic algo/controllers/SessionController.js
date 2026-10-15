// CODEX : Une session isole les scénarios, les imports et les modèles ; Vehicle reste inchangé.
class SessionController {
  constructor() {
    this.ready = false; this.loading = false; this.dirty = false; this.token = 0;
    this.settings = sessionDefaults('observe'); this.sources = []; this.models = new Set();
    this.course = 0; this.results = []; this.catalog = {}; this.evaluation = null;
    this.base = {vehicle: copyJSON(Vehicle.config), generation: copyJSON(Generation.config),
      track: copyJSON(Track.config), test: copyJSON(Test.config)};
  }
  async init() {
    this.loading = true;
    try {
      const names = ['car-simple-1', 'seed-c', 'seed-v1', 'trk-simple-1'];
      const values = await Promise.all(names.map(async name => {
        const r = await fetch('assets/' + name + '.json');
        if (!r.ok) throw Error('Ressource indisponible : ' + name);
        return r.json();
      }));
      names.forEach((n, i) => this.catalog[n] = values[i]);
      await this.prepare(sessionDefaults('observe'));
    } catch (e) { UI.error(e); } finally { this.loading = false; }
  }
  validate(data) {
    const walk = value => {
      if (!value || typeof value !== 'object') return;
      for (const k of Object.keys(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(k)) throw Error('Clé JSON non autorisée : ' + k);
        walk(value[k]);
      }
    }; walk(data);
    if (data.format) {
      if (data.format !== 'michelui-experience' || data.version !== 1) throw Error('Format d’expérience non pris en charge.');
    }
    const vehicles = data.population || data.vehicles || (data.span != null ? [data] : []);
    const tracks = data.tracks || data.killers || (data.checks ? [data] : []);
    if (!Array.isArray(vehicles) || !Array.isArray(tracks) || vehicles.length > 200 || tracks.length > 100)
      throw Error('Import limité à 200 voitures et 100 circuits.');
    const finite = x => typeof x === 'number' && Number.isFinite(x);
    const allowed = new Set(['version','span','angle','old','beta','hidden','uuid','dead','limit','curves',
      'options','name','champion','ahead','channels','weights','parentUuid','qualified','brain','passed','comment']);
    for (const v of vehicles) {
      if (!v || !Number.isInteger(v.span) || v.span < 0 || v.span > 12) throw Error('Nombre de rayons invalide.');
      if (![1, 6, 'sym-dir-1'].includes(v.version)) throw Error('Version de voiture inconnue : ' + v.version);
      for (const key of Object.keys(v)) if (!allowed.has(key)) throw Error('Champ de voiture non pris en charge : ' + key);
      if (v.options && !['relu','sigmoid','tanh'].includes(v.options.activation || 'sigmoid')) throw Error('Activation inconnue.');
      if (v.limit && (Object.values(v.limit).some(x => !finite(x)) || v.limit.force <= 0 || v.limit.sight <= 0 || v.limit.speed < 0)) throw Error('Limites physiques invalides.');
      for (const key of ['angle','old','beta','ahead','champion']) if (key in v && !finite(v[key])) throw Error('Valeur de voiture invalide : ' + key);
      if (v.name != null && typeof v.name !== 'string') throw Error('Nom de voiture invalide.');
      if (v.uuid != null && typeof v.uuid !== 'string') throw Error('UUID de voiture invalide.');
      if (v.channels && Object.keys(v.channels).some(k => !['v','v2','h[0]v2','h[0]*v2'].includes(k))) throw Error('Canal inconnu.');
      if (v.passed) {
        if (typeof v.passed !== 'object' || Array.isArray(v.passed)) throw Error('Historique de réussite invalide.');
        for (const [key,record] of Object.entries(v.passed)) {
          if (key === 'null' || !record) continue;
          if (!record.stats?.vel || !finite(record.points) || !finite(record.speed)) throw Error('Statistiques mémorisées invalides.');
          for (const value of Object.values(record.stats.vel)) if (!finite(value)) throw Error('Statistiques de vitesse invalides.');
        }
      }
      if (v.brain) {
        const b = v.brain, hidden = Array.isArray(b.hidden) ? b.hidden : [b.hidden];
        const widths = [b.inputs, ...hidden, b.outputs];
        if (b.outputs !== 2 || widths.some(n => !Number.isInteger(n) || n < 1 || n > 256) || hidden.length > 4)
          throw Error('Dimensions de cerveau invalides.');
        const rays = 2*v.span+1, opt = v.options || {};
        const expected = rays + (opt['side-direct'] ? rays : opt.direct ? 1 : 0) + Object.keys(v.channels || {}).length
          + ((v.ahead || 0) + (opt.behind ? 1 : 0)) * (opt['ahead-distance'] ? 2 : 1);
        if (expected !== b.inputs) throw Error('Le cerveau ne correspond pas aux capteurs.');
        const shapes = widths.slice(1).flatMap((n,i) => [[widths[i], n], [n]]);
        if (!Array.isArray(b.weights) || b.weights.length !== shapes.length) throw Error('Tenseurs manquants.');
        let params = 0;
        b.weights.forEach((w,i) => {
          if (JSON.stringify(w.shape) !== JSON.stringify(shapes[i]) || !Array.isArray(w.values)
            || w.values.length !== shapes[i].reduce((a,n) => a*n,1) || w.values.some(n => !finite(n)))
            throw Error('Forme ou valeurs des poids invalides.');
          params += w.values.length;
        });
        if (params > 50000) throw Error('Cerveau trop volumineux.');
      }
    }
    for (const t of tracks) {
      for (const key of ['tricky','kills','lastKill']) if (key in t && !finite(t[key])) throw Error('Valeur de circuit invalide : ' + key);
      if (!t || !Array.isArray(t.checks) || t.checks.length < 3 || t.checks.length > 1000
        || !Number.isInteger(t.laps) || t.laps < 1 || t.laps > 20) throw Error('Circuit invalide.');
      for (const c of t.checks) {
        if (!c.a || !c.b || ![c.a.x,c.a.y,c.b.x,c.b.y].every(finite)
          || (c.a.x === c.b.x && c.a.y === c.b.y)) throw Error('Checkpoint invalide.');
      }
    }
    if (!vehicles.length && !tracks.length) throw Error('Aucun véhicule ni circuit reconnu.');
    return {vehicles: copyJSON(vehicles), tracks: copyJSON(tracks), total: Number.isInteger(data.total) ? data.total : null, experience: data.format ? copyJSON(data) : null};
  }
  configure(s) {
    Object.assign(Vehicle.config, copyJSON(this.base.vehicle), {LIFESPAN: s.lifespan,
      MUTATION_RATE: s.mutationRate, MUTATION_TEMPERATURE: s.temperature, WEIGHT_SPEED: s.weightSpeed, OF_INTEREST: null});
    Object.assign(Track.config, copyJSON(this.base.track), {TRICKY: s.tricky, LENGTH: s.checkpoints,
      LAPS: s.laps, WIDTH: [s.widthMin, s.widthMax]});
    Object.assign(Generation.config, copyJSON(this.base.generation), {TOTAL: s.quota, FROZEN: !!Scenarios[s.mode].fixed,
      BROOM: s.mode === 'broom' ? s.teacher : null, AUTO_TEST: s.autoTest ? s.minElders : false, FINISHED: true});
    Object.assign(Test.config, copyJSON(this.base.test), {MAX_TRACKS: s.maxTracks, MIN_ELDERS: s.minElders, FULL: s.full, PASSES: 1});
  }
  async prepare(settings, imported = null) {
    if (this.training) throw Error('Attendez la fin de l’entraînement.');
    const token = ++this.token, s = copyJSON(settings);
    if (!Scenarios[s.mode]) throw Error('Scénario inconnu.');
    // CODEX : Une expérience importée passe par les mêmes bornes que les formulaires visibles.
    for (const [,key,label,min,max] of SettingsUI.fields) {
      if (typeof s[key] !== 'number' || !Number.isFinite(s[key]) || s[key] < min || s[key] > max
        || (SettingsUI.integer.has(key) && !Number.isInteger(s[key]))) throw Error(label + ' : valeur invalide.');
    }
    for (const key of ['rate','steps']) if (!Number.isInteger(s[key]) || s[key] < 1 || s[key] > (key === 'rate' ? 60 : 12)) throw Error('Cadence invalide.');
    if (s.widthMin > s.widthMax || s.span * s.angle > 90) throw Error('Géométrie ou cône de vision invalide.');
    for (const [key,value] of Object.entries(sessionDefaults(s.mode))) if (typeof value === 'boolean' && typeof s[key] !== 'boolean') throw Error('Option invalide : ' + key);
    if (!['builtin','import'].includes(s.source) || !['generated','builtin','import'].includes(s.circuitSource)) throw Error('Source invalide.');
    const hidden = String(s.hidden).split(',').map(x => Number(x.trim()));
    if (hidden.length > 4 || hidden.some(n => !Number.isInteger(n) || n < 1 || n > 128)) throw Error('Couches cachées invalides.');
    if (!['relu','sigmoid','tanh'].includes(s.activation)) throw Error('Activation inconnue.');
    const widths = [(s.span*2+1)*(s.directional?2:1),...hidden,2];
    if (widths.slice(1).reduce((sum,n,i)=>sum+widths[i]*n+n,0)>50000) throw Error('La graine dépasse 50 000 paramètres.');
    let raw = s.source === 'import' ? imported?.vehicles : this.catalog['car-simple-1'].vehicles;
    if (s.mode === 'evolve' && s.source !== 'import') raw = this.catalog['seed-c'].vehicles;
    if (!raw?.length) throw Error('Choisissez un fichier contenant des voitures.');
    raw = copyJSON(raw);
    if (s.mode === 'evolve' && s.source !== 'import') {
      const v = raw[0]; delete v.brain;
      Object.assign(v, {span:s.span, angle:s.angle, hidden:s.hidden.split(',').map(Number), ahead:0,
        channels:{}, options:{activation:s.activation,'side-direct':s.directional,'no-sym':!s.symmetry},
        limit:{speed:s.maxSpeed,force:s.force,sight:s.sight,safe:s.safe}});
    }
    let trackRaw = s.circuitSource === 'import' ? imported?.tracks : s.circuitSource === 'builtin'
      ? this.catalog['trk-simple-1'].killers : [];
    if (s.mode === 'evaluate' && !trackRaw?.length) throw Error('Une évaluation exige un lot de circuits.');
    if (s.circuitSource === 'import' && !trackRaw?.length) throw Error('Importez un fichier contenant des circuits.');
    const previousConfig = {v:copyJSON(Vehicle.config), g:copyJSON(Generation.config), t:copyJSON(Track.config), test:copyJSON(Test.config)};
    const candidates = []; let candidateGen, tracks, learner, restoredDemos = [];
    try {
      this.configure(s);
      const clean = raw.filter((v,i,a) => !v.uuid || a.findIndex(x => x.uuid === v.uuid) === i);
      if (s.mode === 'observe') clean.forEach(v=>v.passed={});
      candidateGen = new Generation({vehicles:clean, total:Scenarios[s.mode].fixed ? clean.length : s.quota});
      candidates.push(...candidateGen.lists.running);
      tracks = (trackRaw || []).map(t => new Track(copyJSON(t)));
      if (s.mode === 'teach') {
        const teacher = candidateGen.find(s.teacher);
        if (!teacher?.brain) throw Error('Maître introuvable : choisissez une voiture de la liste.');
        const definition = (s.source === 'import' && imported?.experience?.learner) || this.catalog['seed-c'].vehicles[0];
        this.validate({vehicles:[definition]});
        learner = Vehicle.fromJSON(copyJSON(definition)); candidates.push(learner);
        const demos = s.source === 'import' ? imported?.experience?.demos : null;
        if (demos?.length) {
          this.validate({vehicles:demos});
          restoredDemos = demos.map(v=>Vehicle.fromJSON(copyJSON(v))); candidates.push(...restoredDemos);
        }
        if (learner.limit.force < teacher.limit.force) throw Error('La force de l’élève doit être au moins celle du maître.');
      }
      if (s.mode === 'broom' && !candidateGen.find(s.teacher)) throw Error('Voiture-balai introuvable.');
    } catch (e) {
      candidates.forEach(v => v.brain?.dispose());
      Object.assign(Vehicle.config,previousConfig.v); Object.assign(Generation.config,previousConfig.g);
      Object.assign(Track.config,previousConfig.t); Object.assign(Test.config,previousConfig.test); throw e;
    }
    if (token !== this.token) { candidates.forEach(v => v.brain.dispose()); return; }
    this.dispose();
    this.settings = s; this.sources = raw; this.imported = imported; this.results = []; this.course = 1;
    this.evaluation = null; this.finished = false; this.error = null; this.manipulated = !!imported?.experience?.manipulated;
    this.configure(s); Track.killers = []; Track.initials = null; Generation.train = null; Generation.broom = null;
    Vehicle.OF_INTEREST = null; car = null; brain = null; alwaysKiller = null;
    currentGen = candidateGen; currentTrack = null;
    killerTest = new Test(); killerTest.onDone = UI.onTestDone; killerTest.onNext = () => {};
    UI.testCheck.checked(false); UI.purgeCheck.checked(false); UI.genCheck.checked(s.pauseRace); UI.killerCheck.checked(s.pauseTest);
    if (s.mode === 'evaluate') {
      this.evaluation = new EvaluationController(raw, tracks, s.reuse);
      this.releaseGeneration(currentGen); this.evaluation.prepare();
    } else {
      if (!Scenarios[s.mode].fixed) Track.setKillers(tracks);
      this.observationTracks = tracks; this.trackIndex = 0;
      if (s.mode === 'teach') {
        Generation.train = {trainee:learner, trainer:s.teacher}; currentGen.prepareTraining();
        Generation.train.demo = restoredDemos;
      }
      currentTrack = tracks[0] || new Track(); currentGen.prepare(currentTrack);
    }
    if (s.progressive && ['evolve','resume'].includes(s.mode)) alwaysKiller = [s.tricky,s.increment,s.target];
    this.ready = true; this.dirty = false; UI.selectTab('course'); UI.paused = true; UI.steps = s.steps; UI.rate = s.rate;
    if (s.mode !== 'evaluate') candidates.forEach(v=>this.models.add(v.brain.model));
    this.syncModels(); UI.message('Expérience prête. Cliquez sur Démarrer.'); UI.render(true);
  }
  tick(cycles) {
    if (!this.ready || this.finished || this.error || this.training || !cycles) return;
    const before = currentGen;
    for (let n=0;n<cycles;n++) {
      currentGen.lists.running.forEach(v => {if (!v.dead && !v.finished) v.measureSteps = (v.measureSteps || 0)+1;});
      currentGen.run(1); currentGen.classifyRunning(); this.dirty = true;
      if (!currentGen.countRunning) { this.finishRace(); break; }
    }
    if (before !== currentGen) this.syncModels();
    if (Archives.items.length >= Archives.limit) UI.pause('Archives à exporter : exportez-les avant de reprendre.');
  }
  finishRace() {
    if (this.evaluation) { this.evaluation.finish(); this.finished = this.evaluation.done; if (!this.finished) this.course++; this.syncModels(); return; }
    if (Scenarios[this.settings.mode].fixed) { this.finished = true; UI.pause('Course terminée. Rejouez ou choisissez un autre circuit.'); return; }
    if (Generation.train) {
      const trainer = Generation.train.trainer, trainee = Generation.train.trainee;
      if (!trainer.finished) { this.finished = true; UI.pause('Le maître a échoué. Recommencez ou changez de maître.'); return; }
      if ((trainee.data?.inputs?.length || 0) < 32) { this.finished=true; UI.pause('Moins de 32 observations : recommencez une collecte.'); return; }
    }
    nextRace(); this.course++; this.syncModels();
  }
  replay(other = false) {
    if (!this.ready || this.training) return;
    if (this.evaluation) {
      this.evaluation = new EvaluationController(this.evaluation.sources, this.evaluation.tracks, this.settings.reuse);
      this.releaseGeneration(currentGen); this.evaluation.prepare();
    } else if (this.settings.mode === 'observe') {
      this.releaseGeneration(currentGen);
      currentGen = new Generation({vehicles:copyJSON(this.sources), total:this.sources.length});
      if (other) {
        this.trackIndex++;
        currentTrack = this.observationTracks.length ? this.observationTracks[this.trackIndex % this.observationTracks.length] : new Track();
      }
      currentGen.prepare(currentTrack);
    } else if (this.settings.mode === 'teach') {
      Generation.train.trainee.data = null; currentGen.prepare(currentTrack);
    } else { UI.message('Préparez une nouvelle expérience pour recommencer avec une population choisie.'); return; }
    this.finished=false; this.error=null; this.dirty=true; this.course++; UI.paused=true; this.syncModels(); UI.message('Course préparée en pause.');
  }
  stop() {
    if (this.evaluation) { this.evaluation.stop(); this.finished = true; this.dirty = true; }
    else if (UI.status.test) {
      if (killerTest.laps) for (const [uuid,laps] of Object.entries(killerTest.laps)) {const t=killerTest.find(uuid);if(t)t.laps=laps;}
      if (killerTest.allKillers) Track.killers=killerTest.allKillers;
      killerTest = new Test(); killerTest.onDone=UI.onTestDone; UI.testCheck.checked(false);
      UI.pause('Qualification interrompue. Les réussites déjà enregistrées sont conservées.');
    }
  }
  qualify() {
    if (!Track.killers.length) return UI.message('Aucun circuit difficile disponible.');
    if (this.training) return;
    UI.testCheck.checked(true); UI.testCheck.value('on'); UI.message('Qualification programmée après la course courante ; reproduction autorisée.');
  }
  get training() { return currentGen && currentGen.status === Generation.STATUS_TRAINING; }
  liveVehicles() {
    const all = currentGen ? Object.values(currentGen.lists).flat() : [];
    if (Generation.train) all.push(Generation.train.trainee,Generation.train.trainer,...(Generation.train.demo || []));
    return [...new Set(all.filter(v => v instanceof Vehicle))];
  }
  syncModels() {
    const live = new Set(this.liveVehicles().map(v => v.brain.model));
    for (const model of this.models) if (!live.has(model)) model.dispose();
    this.models = live;
    if (car && !this.liveVehicles().includes(car)) {car=null;brain=null;Vehicle.config.OF_INTEREST=null;}
  }
  releaseGeneration(gen) {
    if (!gen) return;
    new Set(Object.values(gen.lists).flat().map(v => v.brain.model)).forEach(m => {m.dispose();this.models.delete(m);});
  }
  dispose() { for (const m of this.models) m.dispose(); this.models.clear(); }
  export(kind = 'experience') {
    if (this.training) return UI.message('Attendez la fin du fit pour exporter des poids stables.');
    const population = this.liveVehicles().filter(v => !v.dead).map(v => v.toJSON());
    if (this.settings.mode === 'teach') {
      const teacher = Generation.train.trainer.toJSON();
      population.splice(0, population.length, teacher);
    }
    const tracks = [...new Set([currentTrack,...Track.killers,...(this.observationTracks || []),...(this.evaluation?.tracks || [])])].filter(Boolean).map(t=>t.toJSON());
    let data;
    if (kind === 'vehicle') {if(!car)return UI.message('Sélectionnez une voiture.');data=car.toJSON();}
    else if(kind === 'population') data={vehicles:Scenarios[this.settings.mode].fixed ? copyJSON(this.sources) : population,total:currentGen.total};
    else if(kind === 'circuits') data={tracks};
    else if(kind === 'report') data=this.evaluation?.report() || {configuration:this.settings, course:this.course, manipulated:this.manipulated};
    else if(kind === 'demos') data={vehicles:(Generation.train?.demo || []).map(v=>v.toJSON())};
    else data={format:'michelui-experience',version:1,date:new Date().toISOString(),settings:this.settings,
      population:Scenarios[this.settings.mode].fixed ? copyJSON(this.sources) : population,
      tracks, learner:Generation.train?.trainee.toJSON(), teacher:this.settings.teacher,
      demos:(Generation.train?.demo || []).map(v=>v.toJSON()),report:this.evaluation?.report(),manipulated:this.manipulated,
      archives:Archives.items, note:'Reprise au départ ; état Adam et positions non restaurés.'};
    Archives.download('michelui-'+kind+'-'+new Date().toISOString().slice(0,19).replace(/:/g,'-'),data);
    if(kind === 'experience') {this.dirty=false;Archives.items=[];}
  }
}
let Session;
