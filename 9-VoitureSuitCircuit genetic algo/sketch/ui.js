// CODEX : L'interface lit l'état du moteur ; les tris et tooltips n'agissent jamais sur les forces.
let car = null, brain = null;
const UI = {
  paused: true, steps: 2, rate: 30, stepping: false, log: [], tab: 'course', sort: 'points', lastRender: 0,
  escape(value) {return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
  text(id,value) {const e=document.getElementById(id), text=String(value ?? '');if(e && e.textContent!==text)e.textContent=text;},
  html(id,value) {const e=document.getElementById(id);if(e && e._viewHTML!==value){e.innerHTML=value;e._viewHTML=value;}},
  flag(initial=false) {return {_checked:initial,_value:'on',checked(v){if(v!==undefined)this._checked=!!v;return this._checked;},value(v){if(v!==undefined)this._value=v;return this._value;}};},
  get status() {return {test:this.testCheck.checked(),cycles:this.paused?0:this.steps,rate:this.rate,
    pause:this.genCheck.checked(),step:this.stepping,purge:this.purgeCheck.checked(),killer:this.killerCheck.checked()};},
  setup() {
    this.testCheck=this.flag();this.genCheck=this.flag();this.purgeCheck=this.flag();this.killerCheck=this.flag(true);
    this.speedSlider={value:v=>{if(v!==undefined){if(v===0)this.paused=true;else{this.steps=Number(v);this.paused=false;}}return this.paused?0:this.steps;}};
    this.stepButton={value:v=>{if(v!==undefined)this.stepping=!!v;return this.stepping;}};
    this.testTable={html:()=>{}};
    document.getElementById('app').innerHTML=`
      <header class="app-head"><a class="brand" href="index.html"><span class="brand-mark">↗</span><span>Steering Lab<small>Voitures autonomes · Bruno Vasselle</small></span></a><div class="head-links"><span class="version-pill">MichelUI · première version</span><button class="secondary" id="help-open">Guide rapide</button></div></header>
      <main><section class="experience-head"><div><span class="eyebrow">VOTRE EXPÉRIENCE</span><h1 id="scenario-title">Chargement des ressources…</h1><p id="scenario-description">Préparation du laboratoire.</p></div><button class="secondary" id="scenario-open">Changer d’expérience <span>↗</span></button></section>
      <section class="toolbar" aria-label="Commandes de simulation"><button id="play" class="primary">Démarrer</button><button id="step" class="secondary">Un pas ${SettingsUI.help('Exécute une seule mise à jour physique, puis reste en pause.')}</button><label class="speed-control">Pas / image ${SettingsUI.help('Accélère les essais, sans changer les limites physiques des voitures.')}<input type="range" id="speed" min="1" max="12" value="2"><output id="speed-value">2</output></label><span class="spacer"></span><button id="advanced" class="secondary">Réglages avancés</button><details class="export-menu"><summary>Sauvegarder ▾</summary><div>${[['experience','Expérience complète'],['population','Population actuelle'],['vehicle','Voiture sélectionnée'],['circuits','Circuits'],['demos','Élèves / démonstrations'],['report','Bilan'],['archives','Archives en mémoire']].map(([k,l])=>`<button data-export="${k}">${l}</button>`).join('')}</div></details></section>
      <section class="status-line"><span id="phase" class="state-pill">Chargement</span><span id="session-summary"></span><span id="archive-count"></span></section>
      <section class="workspace"><div class="track-area"><div id="canvas-host"></div><div class="track-footer"><span id="track-label">Circuit</span><div><button class="text-button" id="replay">Recommencer</button><button class="text-button" id="other-track">Autre circuit</button></div></div></div><aside class="inspector"><nav class="tabs" aria-label="Inspection">${[['course','Course'],['car','Voiture'],['tracks','Circuits'],['journal','Journal']].map(([k,l])=>`<button data-tab="${k}" class="${k==='course'?'active':''}" aria-pressed="${k==='course'}">${l}</button>`).join('')}</nav><div id="panel-course" class="panel"></div><div id="panel-car" class="panel" hidden><div id="car-details"></div><canvas id="brain-board" width="400" height="400"></canvas><p class="muted">Bleu : poids positif · rouge : négatif. Chaque bloc représente les poids ou biais d’une couche.</p><div class="button-row"><button class="secondary" id="car-export">Exporter</button><button class="secondary" id="use-teacher">Comme maître</button><button class="secondary" id="use-broom">Comme balai</button></div></div><div id="panel-tracks" class="panel" hidden></div><div id="panel-journal" class="panel" hidden></div></aside></section>
      <section class="metrics" id="metrics"></section><section class="message-bar" role="status" aria-live="polite"><span class="message-dot"></span><span id="message">Chargement…</span></section>
      <section class="secondary-actions"><button id="qualify" class="secondary">Qualifier la population ${SettingsUI.help('Rejoue les circuits difficiles ; la reproduction peut rester active pour obtenir le quota.')}</button><button id="stop-campaign" class="secondary">Arrêter la campagne</button><button id="archives-export" class="text-button">Exporter les archives</button><span class="spacer"></span><a href="ANALYSE.md" target="_blank">Comprendre le moteur ↗</a></section>
      <section id="debug-panel" class="notice" hidden><strong>Débogage · session marquée comme manipulée</strong><div class="button-row"><button id="debug-kill">Éliminer les voitures en piste</button><button id="debug-finish">Déclarer une réussite artificielle</button></div></section></main>
      <dialog id="settings-dialog" aria-label="Préparer une expérience"></dialog><dialog id="help-dialog" aria-labelledby="help-title"><header class="dialog-head"><h2 id="help-title">Bienvenue dans Steering Lab</h2><button id="help-close" class="icon-button" aria-label="Fermer">×</button></header><div class="dialog-body"><ol class="quick-guide"><li><strong>Choisissez une expérience.</strong> Observer, faire évoluer, imiter ou évaluer : le mode indique ce qui change dans les cerveaux.</li><li><strong>Préparez, puis démarrez.</strong> La préparation laisse la simulation en pause. Un pas permet de suivre une décision à la fois.</li><li><strong>Inspectez une voiture.</strong> Cliquez sur la piste ou dans le tableau pour voir ses capteurs, son réseau et ses consignes.</li><li><strong>Ouvrez les réglages avancés.</strong> Les changements préparent une nouvelle session ; les cerveaux importés conservent leur architecture.</li><li><strong>Exportez vos résultats.</strong> Les archives sont en mémoire jusqu’à l’export. Une reprise repart au début d’une course.</li></ol><p class="notice">Qualification ≠ évaluation fixe : une qualification peut créer des descendants. La loss mesure l’imitation, pas la réussite en conduite.</p><a href="ANALYSE.md" target="_blank">Lire l’analyse complète du code ↗</a></div></dialog>`;
    const canvas=createCanvas(1200,800);canvas.parent('canvas-host');this.canvas=canvas.elt;
    this.board=document.getElementById('brain-board').getContext('2d');
    const on=(id,action)=>document.getElementById(id).onclick=action;
    on('play',()=>{
      if(Session.loading || !Session.ready || Session.error)return;
      if(Session.training){this.paused=true;this.message('La physique restera en pause après le fit en cours.');return;}
      if(Session.finished)return this.message('La course est terminée. Cliquez sur Recommencer ou changez d’expérience.');
      if(Archives.items.length>=Archives.limit)return this.message('Exportez les archives avant de reprendre.');
      this.paused=!this.paused;this.render(true);
    });
    on('step',()=>{if(!Session.training && !Session.finished){this.stepping=true;this.paused=true;}});
    document.getElementById('speed').oninput=e=>{this.steps=Number(e.target.value);Session.settings.steps=this.steps;Session.dirty=true;this.render(true);};
    on('scenario-open',()=>SettingsUI.open());on('advanced',()=>SettingsUI.open(true));
    on('replay',()=>{try{Session.replay();}catch(e){this.error(e);}});
    on('other-track',()=>{try{Session.replay(true);}catch(e){this.error(e);}});
    on('qualify',()=>Session.qualify());on('stop-campaign',()=>Session.stop());
    on('archives-export',()=>Archives.export());on('car-export',()=>Session.export('vehicle'));
    for(const role of ['teacher','broom'])on('use-'+role,()=>{
      if(!car)return;
      this.imported={vehicles:[car.toJSON()],tracks:[],experience:null};
      SettingsUI.open(false,role==='teacher'?'teach':'broom');
      const f=document.getElementById('settings-form');f.elements.source.value='import';SettingsUI.teachers();SettingsUI.summary();
    });
    document.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>{if(!Session.ready)return;b.dataset.export==='archives'?Archives.export():Session.export(b.dataset.export);b.closest('details').open=false;});
    document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>this.selectTab(b.dataset.tab));
    on('help-open',()=>{this.helpPaused=this.paused;this.paused=true;document.getElementById('help-dialog').showModal();});
    on('help-close',()=>document.getElementById('help-dialog').close());
    document.getElementById('help-dialog').onclose=()=>{this.paused=this.helpPaused;};
    this.canvas.onclick=e=>{
      if(!Session.ready)return;
      const r=this.canvas.getBoundingClientRect(), x=(e.clientX-r.left)*1200/r.width,y=(e.clientY-r.top)*800/r.height;
      const v=currentGen.lists.running.filter(v=>v.pos).map(v=>({v,d:Math.hypot(v.pos.x-x,v.pos.y-y)})).sort((a,b)=>a.d-b.d)[0];
      if(v?.d<25)this.select(v.v);
    };
    on('debug-kill',()=>{Session.manipulated=true;for(const v of currentGen.lists.running)v.kill();Session.dirty=true;this.message('Élimination manuelle. Session manipulée.');});
    on('debug-finish',()=>{Session.manipulated=true;for(const v of currentGen.lists.running){if(v.dead)continue;v.points=currentTrack.laps*currentTrack.checkpoints.length;v.finished=-1;}Session.dirty=true;this.message('Réussites artificielles. Session manipulée.');});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.paused=true;this.message('Simulation suspendue pendant l’absence. Reprenez quand vous êtes prêt.');}});
    document.addEventListener('click',e=>{const help=e.target.closest('.help');if(help){e.preventDefault();e.stopPropagation();help.focus();}},true);
    window.addEventListener('beforeunload',e=>{if(Session?.dirty || Archives.items.length){e.preventDefault();e.returnValue='';}});
  },
  selectTab(tab) {
    this.tab=tab;document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-pressed',b.dataset.tab===tab);});
    ['course','car','tracks','journal'].forEach(k=>document.getElementById('panel-'+k).hidden=k!==tab);this.render(true);
  },
  select(v) {car=v;brain=v.brain;Vehicle.config.OF_INTEREST=v;this.selectTab('car');this.brainInfo(v);},
  brainInfo(v) {
    if(!v?.brain)return;this.board.clearRect(0,0,400,400);
    // CODEX : Les tenseurs d'inspection sont libérés ; aucune observation physique n'est recalculée.
    tf.tidy(()=>v.brain.draw(this.board,1,2));this.drawnBrain=v.brain;this.drawnCount=v.brain.count;
  },
  message(message) {
    const text=String(message || '');const el=document.getElementById('message');if(el)el.textContent=text;
    if(text && this.log.at(-1)?.text!==text)this.log.push({time:new Date().toLocaleTimeString('fr-FR'),text});
    if(this.log.length>100)this.log.shift();this.lastMessage=text;
  },
  pause(message) {this.paused=true;if(message)this.message(message);},
  error(e) {console.error(e);const message=e?.message || String(e);this.pause(message);if(Session){Session.error=message;}this.render(true);},
  genStats() {}, raceInfo() {},
  onTestDone() {UI.testCheck.checked(false);UI.testCheck.value('on');if(UI.killerCheck.checked())UI.pause('Qualification terminée. Les archives sont prêtes à exporter.');else UI.message('Qualification terminée.');},
  onTestKillerClick() {},
  render(force=false) {
    const now=performance.now();if(!force && now-this.lastRender<200)return;this.lastRender=now;
    if(!Session?.ready)return;
    const s=Session.settings, scenario=Scenarios[s.mode], train=Session.training, lists=currentGen.lists;
    this.text('scenario-title',scenario.name);
    this.text('scenario-description',scenario.text);
    const phase=Session.error?'Erreur':train?'Entraînement du réseau':Session.finished?'Terminé':this.testCheck.checked()?'Qualification':s.mode==='teach'?'Collecte maître / élève':this.paused?'Prêt / en pause':'En course';
    this.text('phase',phase+(this.paused && ['Qualification','Collecte maître / élève'].includes(phase)?' · en pause':''));
    document.getElementById('phase').classList.toggle('running',!this.paused && !Session.finished);
    this.text('session-summary',`${scenario.fixed?'Cerveaux fixes':s.mode==='teach'?'Imitation active':'Sélection + mutation'} · ${Session.sources.length} au départ · ${s.mode==='teach'?'maître + démo':`quota ${currentGen.total}`} ${Session.manipulated?'· MANIPULÉE MANUELLEMENT':''}`);
    this.text('archive-count',Archives.items.length?`${Archives.items.length} archive(s) à exporter`:'');
    const play=document.getElementById('play');play.textContent=train?'Pause après entraînement':this.paused?'Démarrer / Reprendre':'Pause';play.disabled=Session.finished || !!Session.error;
    document.getElementById('step').disabled=!this.paused || train || Session.finished || !!Session.error;
    document.getElementById('speed').value=this.steps;this.text('speed-value',this.steps);
    ['scenario-open','advanced'].forEach(id=>document.getElementById(id).disabled=train);
    document.getElementById('replay').disabled=train || !['observe','evaluate','teach'].includes(s.mode);
    document.getElementById('other-track').hidden=s.mode!=='observe';
    this.text('track-label',`Circuit ${currentTrack.id} · ${currentTrack.checkpoints.length} checkpoints · ${currentTrack.laps} tour(s)`);
    document.getElementById('qualify').hidden=!['evolve','resume','broom'].includes(s.mode);
    document.getElementById('qualify').disabled=!Track.killers.length || this.testCheck.checked();
    document.getElementById('stop-campaign').hidden=!(this.testCheck.checked() || (Session.evaluation && !Session.finished));
    document.getElementById('debug-panel').hidden=!s.debug || !!scenario.fixed || train;
    const metrics=[['Course',Session.course],['Génération',currentGen.serial],['En piste',lists.running.filter(v=>!v.dead&&!v.finished).length],['Arrivées',lists.finished.length],['Garage',lists.stored.length],['Échecs',lists.dead.length]];
    this.html('metrics',metrics.map(([l,v])=>`<div><strong>${v}</strong><span>${l}</span></div>`).join(''));
    if(this.tab==='course')this.renderCourse();
    if(this.tab==='car')this.renderCar();
    if(this.tab==='tracks')this.renderTracks();
    if(this.tab==='journal')this.html('panel-journal','<h2>Journal de session</h2>'+this.log.slice().reverse().map(l=>`<div class="log-entry"><time>${l.time}</time><p>${this.escape(l.text)}</p></div>`).join(''));
    if(train) {
      const info=Generation.train.trainee.brain.trainInfo;
      this.message(`Imitation : epoch ${info.epoch}/${info.epochs} · erreur × 1000 = ${Number.isFinite(info.loss)?(info.loss*1000).toFixed(3):'…'} · ${info.duration}`);
    }
  },
  renderCourse() {
    const l=currentGen.lists, vehicles=[...l.finished,...l.running,...l.stored,...l.dead];
    const e=Session.evaluation, report=e?.report();
    let html='<div class="panel-heading"><span class="eyebrow">POPULATION</span><h2>La course en détail</h2></div>';
    if(report) {
      const observed=report.results.filter(r=>r.status.startsWith('observed')), success=observed.filter(r=>r.status==='observed-success').length;
      html+=`<div class="notice"><strong>${report.results.length} / ${report.planned} essais traités</strong><p>${observed.length?`${success} / ${observed.length} réussites observées (${Math.round(100*success/observed.length)} %)`:'Aucun essai mesuré terminé.'}</p><small>Les réussites réutilisées ne comptent pas dans ce taux.</small></div>`;
    } else html+=`<p class="muted">${Track.killers.length?`${Track.killers.length} circuit(s) difficile(s) connu(s).`:'Aucun circuit de validation : aucune compétence globale ne peut être déduite.'}</p>`;
    if(Session.settings.mode==='teach')html+='<div class="notice">Maître : '+this.escape(Generation.train.trainer.id)+'<br>Élève : '+this.escape(Generation.train.trainee.id)+'<br>'+ (Session.training?Generation.train.trainee.brain.trainInfo.samples:(Generation.train.trainee.data?.inputs?.length || 0))+' observations collectées.<br>'+ (Generation.train.demo?.length || 0)+' démos conservées.</div>';
    html+='<label class="sort-control">Trier <select id="course-sort" aria-label="Trier les voitures"><option value="points">Progression</option><option value="name">Nom</option></select></label><div class="table-scroll"><table><thead><tr><th>Voiture</th><th>Tours</th><th>État</th><th>Points</th></tr></thead><tbody>';
    // CODEX : Le classement porte sur une copie ; le balai gère son propre ordre dans Generation.
    const ordered=[...new Set(vehicles)].sort(this.sort==='name'?(a,b)=>a.id.localeCompare(b.id):(a,b)=>b.points-a.points);
    for(const v of ordered)html+=`<tr><td><button class="vehicle-link" data-car="${v.serial}">${this.escape(v.id)}</button></td><td>${v.laps || 0}/${currentTrack.laps}</td><td>${this.escape(v.dead || (v.finished?(v.active?'Arrivée':'Mémorisée'):l.stored.includes(v)?'Garage':'En piste'))}</td><td>${v.points}</td></tr>`;
    html+='</tbody></table></div>';
    if(report?.results.length)html+='<h3>Derniers résultats</h3>'+report.results.slice(-20).map(r=>`<p class="result-row"><span>${this.escape(r.vehicle)} · ${this.escape(r.circuit)}</span><strong>${this.escape({'observed-success':'Réussite','observed-failure':'Échec','reused-success':'Réutilisée',interrupted:'Interrompu'}[r.status])}</strong></p>`).join('');
    this.html('panel-course',html);
    const sorting=document.getElementById('course-sort');sorting.value=this.sort;sorting.onchange=e=>{this.sort=e.target.value;this.render(true);};
    document.querySelectorAll('[data-car]').forEach(b=>b.onclick=()=>this.select(currentGen.find(Number(b.dataset.car))));
  },
  renderCar() {
    const el=document.getElementById('car-details');
    if(!car){el.innerHTML='<h2>Regarder une décision</h2><p class="empty-state">Cliquez sur une voiture de la piste ou du tableau pour découvrir son cerveau.</p>';this.board.clearRect(0,0,400,400);return;}
    const b=car.brain, p=b.last_predict, out=p?.outputs;
    if (!Session.training && (this.drawnBrain!==b || this.drawnCount!==b.count))this.brainInfo(car);
    let effective=out?Array.from(out).slice(0,2):null;
    if(out?.length===4 && !car.options['no-sym'])effective=[(out[0]-out[2]+1)/2,(out[1]+out[3])/2];
    el.innerHTML=`<span class="eyebrow">VOITURE SÉLECTIONNÉE</span><h2>${this.escape(car.id)}</h2><dl class="facts"><dt>Réseau</dt><dd>${b.input_nodes} → ${[].concat(b.hidden_nodes).join(' → ')} → ${b.output_nodes}</dd><dt>Paramètres</dt><dd>${b.params} · ${this.escape(b.activation || 'sigmoid')}</dd><dt>Symétrie</dt><dd>${car.options['no-sym']?'Désactivée':'Observation + miroir'}</dd><dt>Capteurs</dt><dd>${car.span*2+1} rayons · portée ${car.limit.sight} px</dd><dt>Force maximale</dt><dd>${car.limit.force}</dd><dt>Plafond vitesse</dt><dd>${car.limit.speed || 'Sans plafond explicite'}</dd><dt>Version</dt><dd>${this.escape(car.version)}</dd><dt>Réussites mémorisées</dt><dd>${Object.keys(car.passed).filter(k=>k!=='null').length}</dd></dl><h3>Dernière observation enregistrée</h3><p class="muted">${car.track===currentTrack && !car.dead && !car.finished?'Course courante':'Observation conservée ; pas de recalcul physique.'}</p>${p?'<div class="sensor-values">'+p.inputs[0].map((v,i)=>`<span title="Entrée ${i+1}">${Number(v).toFixed(2)}</span>`).join('')+'</div>':'<p>La voiture n’a pas encore pris de décision.</p>'}${effective?`<dl class="facts"><dt>Direction effective</dt><dd>${effective[0].toFixed(3)}</dd><dt>Vitesse effective</dt><dd>${effective[1].toFixed(3)}</dd></dl><p class="muted">Consignes après combinaison miroir, avant conversion en force. ReLU peut dépasser 1.</p>`:''}`;
  },
  renderTracks() {
    const tracks=[...new Set([currentTrack,...Track.killers,...(Session.observationTracks || []),...(Session.evaluation?.tracks || [])])].filter(Boolean);
    document.getElementById('panel-tracks').innerHTML='<span class="eyebrow">BIBLIOTHÈQUE</span><h2>Circuits disponibles</h2><p class="muted">Les circuits difficiles sont archivés pour retrouver les situations qui ont mis la population en échec.</p>'+tracks.map(t=>`<div class="track-card"><strong>${this.escape(t.id)}</strong><span>${t.laps} tours · ${t.checkpoints.length} passages</span><small>Sinuosité ${t.tricky} · ${t.kills || 0} échecs historiques comptés${t===currentTrack?' · ACTUEL':''}</small></div>`).join('');
  }
};
