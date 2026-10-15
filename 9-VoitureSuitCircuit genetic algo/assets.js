/*
  Fonctions de sauvegarde et de récupération pour 'sketch.js'

  On utilise les globales currentGen et currentTrack si besoin est.

  On s'occupe ici :
  - d'une génération
  - du circuit en cours
  - des circuits tueurs ou initiaux
  - de la configuration elle-même
*/

class Asset {
  /** préfixe de sauvegarde (dans download) */ static PREFIX = 'mb-'

  constructor(def) {
    this.concat(def, true)
  }

  // CODEX : Les clés JSON déterminent le type chargé ; ce n'est pas le nom du fichier.
  static make(def) {
    let object

    id: {
      if ("killers"  in def) { object = new World(def); break id }
      if ("tracks"   in def) { object = new World(def); break id }
      if ("vehicles" in def) { object = new Generation(def); break id }
      if ("checks"   in def) { object = new Track(def); break id }
      if ("span"     in def) { object = Vehicle.fromJSON(def); break id }
      if ("config"   in def) { object = new Asset(def); break id }

      throw `could not identify JSON type`
    }

    return object
  }
  /**
   * @callback assetOnLoad
   * @param {Asset} asset
   */

  /** Charge un ou plusieurs JSON depuis le sous-répertoire `assets` 
   * @param {string|string[]} names Noms des JSON (extension `.json` optionnelle)
   * @param {assetOnLoad} onload 
  */
  static load(names, onload) {
    if (!names) return

    let list = []
    let asset

    if (!Array.isArray(names))
      names = [names]

    let count = 0
    let on_all = (list) => {
      for (let one of list) {
        one = Asset.make(one)
        select:
        {
          if (one instanceof Track) { one = new World({ tracks: [one] }); break select }
          if (one instanceof World) break select
          if (one instanceof Vehicle) { one = new Generation({ vehicles: [one] }); break select }
          if (one instanceof Generation) break select
          if (one instanceof Asset) {
            if (!asset) asset = CONFIG
            break select
          }
          throw 'unexpected asset type'
        }
        if (!asset) asset = one
        else
          asset = asset.concat(one)
      }

      if (onload)
        onload(asset)
    }
    let on_one = (json,name) => {
      json.name = name
      // console.log(`loaded ${json.name}`)
      count++
      if (count == names.length)
        on_all(list)
    }

    for (let name of names) {
      name = name.replace(/[.]json$/, "")
      console.log(`loading ${name}`)
      // CODEX : La reprise lit assets/ ; les sauvegardes téléchargées doivent y être copiées manuellement.
      let json = loadJSON(`assets/${name}.json`, (json) => on_one(json,name))
      // console.log(json)
      list.push(json)
    }
    return list
  }   

  concat(one, force) {
    if (!(one instanceof Asset || force))
      throw `heterogenous assets in a raw`

    let merge = this
    let part  = one

    for (let key in part) {
      let value = part[key]
      if (Array.isArray(value))
        merge[key] = value

      else if (typeof value == 'object') {
        if (!(key in merge)) merge[key] = {}

        for (let sub in value) {
          merge[key][sub] = value[sub]
        }
      }
      else
        merge[key] = value
    }
  }
}

// CODEX : Sauvegarde des voitures (poids, capteurs, historique), pas de la course en cours ni de CONFIG.
function saveGeneration(name, lists)
{
  let gen = currentGen
  let json = gen.toJSON(lists)
  if (!name) {
    name = `gen${gen.serial}`
    if (gen.saved)
      name += '-' + gen.saved
  }
  if (gen.saved) {
    gen.saved++
  }
  else
    gen.saved = 1

  name = name.replace(/[.]json$/, "")

  // CODEX : Les événements moteur créent des archives en mémoire ; l'utilisateur choisit quand exporter.
  Archives.add(name, json);
  return name
}

function saveKillers(name, killers)
{
  if (!killers) killers = Track.killers
  if (!name) name = 'killerTracks'
  name = name.replace(/[.]json$/, "")

  let json = { "killers": killers }
  // CODEX : Les événements moteur créent des archives en mémoire ; l'utilisateur choisit quand exporter.
  Archives.add(name, json);
}

function saveTrack(name, track)
{
  if (!track) track = currentTrack
  if (!name) name = `track${currentTrack.serial - Track.offset}`

  Archives.add(name, track.toJSON());
}


function saveAll(keys)
{
  // CODEX : Le bouton Save ne demande par défaut que génération + tueurs, malgré son infobulle.
  // CODEX : Pour inclure le circuit courant : saveAll({gen: true, kill: true, track: true}).
  if (!keys) keys = {gen: true, kill: true}
  let name
  if (keys.gen)   name = saveGeneration()
  if (keys.kill)  saveKillers(name ? name.replace(/gen/,"kil"):null)
  if (keys.track) saveTrack(name ? name.replace(/gen/, "trk") : null)
}
