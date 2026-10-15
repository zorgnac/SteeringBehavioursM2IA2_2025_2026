// CODEX : La campagne prépare les véhicules via leurs méthodes existantes et ne calcule aucune force.
class EvaluationController {
  constructor(sources, tracks, reuse) {
    this.sources = copyJSON(sources); this.tracks = tracks; this.reuse = reuse;
    this.index = 0; this.results = []; this.done = false;
  }
  prepare() {
    currentTrack = this.tracks[this.index];
    const sources = copyJSON(this.sources);
    if (!this.reuse) sources.forEach(v => v.passed = {});
    currentGen = new Generation({vehicles: sources, total: sources.length});
    currentGen.prepare(currentTrack);
    this.steps = 0;
  }
  collect(partial = false) {
    const seen = new Set();
    for (const v of Object.values(currentGen.lists).flat()) {
      if (seen.has(v.uuid)) continue; seen.add(v.uuid);
      this.results.push({vehicle: v.name || v.uuid, uuid: v.uuid, circuit: currentTrack.id,
        trackUUID: currentTrack.uuid, requestedLaps: currentTrack.laps, laps: v.laps,
        points: v.points, steps: v.measureSteps || 0,
        status: v.finished ? (v.active ? 'observed-success' : 'reused-success') : v.dead ? 'observed-failure' : partial ? 'interrupted' : 'observed-failure', reason: v.dead || null});
    }
  }
  finish() {
    this.collect();
    this.index++;
    if (this.index >= this.tracks.length) {
      this.done = true; UI.pause('Évaluation terminée. Le bilan est disponible dans l’onglet Course.');
      Archives.add('bilan-évaluation', this.report());
    } else {
      Session.releaseGeneration(currentGen); this.prepare();
      if (Session.settings.pauseRace) UI.pause('Circuit suivant préparé.');
    }
  }
  stop() {
    if (this.done) return;
    this.collect(true);
    this.done = true; UI.pause('Évaluation interrompue ; le bilan reste partiel.');
  }
  report() {
    return {version: 1, complete: this.index >= this.tracks.length, configuration: Session.settings,
      planned: this.sources.length * this.tracks.length, results: this.results,
      remaining: Math.max(0, this.sources.length * this.tracks.length - this.results.length)};
  }
}
