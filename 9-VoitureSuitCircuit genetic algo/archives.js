// CODEX : Les archives sont des instantanés JSON, jamais des références aux voitures vivantes.
const Archives = {
  items: [], limit: 20,
  add(name, data) {
    this.items.push({name, date: new Date().toISOString(), data: copyJSON(data)});
    if (Session.ready) Session.dirty = true;
    if (this.items.length >= this.limit) UI.pause('Archives à exporter : la simulation est suspendue pour éviter leur accumulation.');
  },
  download(name, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name.replace(/\.json$/, '') + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    UI.message('Téléchargement demandé : ' + a.download);
  },
  export() {
    this.download('michelui-archives', {format: 'michelui-archives', version: 1, archives: this.items});
    this.items = [];
  }
};
