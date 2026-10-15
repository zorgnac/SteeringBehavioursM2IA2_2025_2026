// CODEX : Les scénarios décrivent l'expérience ; aucun comportement de déplacement n'est défini ici.
const Scenarios = {
  observe: {name: 'Observer les cerveaux', tag: 'DÉCOUVERTE', icon: '◎', text: 'Explorez les décisions de deux voitures déjà entraînées, sans modifier leurs cerveaux.', fixed: true},
  evolve: {name: 'Entraîner par évolution', tag: 'APPRENTISSAGE', icon: '↗', text: 'Partez d’une graine aléatoire. Conservez les réussites et faites évoluer les descendants.'},
  resume: {name: 'Reprendre une évolution', tag: 'REPRISE', icon: '↻', text: 'Importez des cerveaux sauvegardés et poursuivez leur évolution sur de nouveaux circuits.'},
  teach: {name: 'Apprendre avec un maître', tag: 'IMITATION', icon: '⇄', text: 'Un élève apprend les décisions d’un maître, puis conduit seul pour les mettre à l’épreuve.'},
  evaluate: {name: 'Évaluer des cerveaux fixes', tag: 'ÉVALUATION', icon: '✓', text: 'Rejouez un lot de circuits avec chaque cerveau, sans mutation ni remplacement.', fixed: true},
  broom: {name: 'Améliorer la progression', tag: 'VOITURE-BALAI', icon: '⚑', text: 'Une voiture de référence élimine les véhicules en retard au passage de chaque tour.'}
};
const copyJSON = value => JSON.parse(JSON.stringify(value));
const sessionDefaults = mode => ({mode, quota: 30, tricky: mode === 'evolve' ? 1.5 : 3,
  checkpoints: 240, laps: 2, widthMin: 20, widthMax: 50, lifespan: 150, rate: 30,
  steps: 2, pauseRace: false, pauseTest: true, autoTest: false, maxTracks: 0,
  minElders: 15, full: true, mutationRate: .1, temperature: 1, weightSpeed: 1,
  span: 1, angle: 15, sight: 300, force: .15, maxSpeed: 0, safe: -.01,
  hidden: '9', activation: 'relu', symmetry: true, directional: true,
  reuse: false, progressive: false, increment: .5, target: 6.5, debug: false,
  teacher: 'h9c-f1.5', source: 'builtin', circuitSource: mode === 'evaluate' ? 'builtin' : 'generated'});
