#!/usr/bin/node

var crypto = require('crypto');

const { writeFileSync } = require('fs');

let defs = []
let output, undef
let params = {
  command: 'merge',
  output: null,
  trash: null,
  old: 0,
  "last-kill": 0,
  "kills": 0,
  "dry-run": false,
  "fix-beta": false,
  "fix-version": null,
  "fix-factor": null,
  "fix-relu": false,
  "fix-kills": null,
  "fix-safe": undef,
  "add-range": false,
  help: false
}
let shorts = {
  "o": "output",
  "n": "dry-run",
  "k": "last-kill",
  "t": "trash"
}
let commands = {
  merge: "merge",
  doublon: "doublon",
  count: "count",
  olds: "dumpOld"
}

let cwd = process.cwd()
let type = null; "killers"

function cmdline() {
  let i = -1
  let skip = 0
  for (let v of process.argv)
  {
    let m
    i++
    if (skip) {
      skip--
      continue
    }
    m = v.match(/^(?:(?:--)?(?<key>.*)=)?(?<file>.*[.]json)$/)
    if (m) {
      cmdline.def(m)
      continue
    }
    
    m = v.match(/^(?:--)?(?<key>.*)=(?<value>.*)$/)
    if (m) {
      cmdline.param(m)
      continue
    }
    
    m = v.match(/^--(?<key>[^=]+)$/)
    if (m) {
      cmdline.option(m)
      continue
    }
    
    m = v.match(/^-(?<key>[^=])$/)
    if (m) {
      skip = cmdline.short(m, i)
      continue
    }
    
    if (i < 2) continue
    if (commands[v]) {
      params.command = commands[v]
      continue
    }
    
    console.log(`skipping ${v}`)
  }
  if (params.help)
  {
    console.log(`Usage: merge.js [[--command=]COMMAND] --output=OUTPUT.json ...

COMMAND in
  merge --last-kill=N --trash=TRASH.json killers.json ...
    Merge killer tracks

    If --last-kill (short -k), reject killers those last kill
    is at least that. If in addition --trash is given (short -t), 
    save the rejected tracks there

  merge --fix-safe=SAFE --old=MIN --trash=TRASH.json gen.json ...
    Merge generations

    If --fix-safe=SAFE, set limit.safe to SAFE

    If --old=MIN, reject vehicles younger than MIN. If in addition
    --trash, save the rejected vehicles there
 
    gen.json may be individual cars instead of generations

  olds gen.json
    Show statistics for old vehicles in generation

  count killers.json ...
    Count tracks in killer tracks

  count gen.json ...
    Count vehicles in generation

  doublon --dry-run src1.json src2.json ...
    Remove doublon from different files

    src1.json src2.json are same nature : either generations,
    either killers 

    Unless --dry-run (short -n), src2.json ... are overriten
    if doublon occurs from previous files

Default COMMAND is merge`)
    process.exit()
  }
}
cmdline.param = function (m)
{
  let value = m.groups.value
  let key  = m.groups.key
  if (key in params)
  {
    params[key] = value
  }
  else
    console.warn(`ignoring unknown parameter '${key}'`)
}

cmdline.option = function (m)
{
  let value = true
  let key  = m.groups.key
  if (key in params)
  {
    params[key] = value
  }
  else
    console.warn(`ignoring unknown option '${key}'`)
}

cmdline.short = function (m,i)
{
  let value = true
  let skip = 0
  
  let short  = m.groups.key
  if (short in shorts)
  {
    let long =  shorts[short]
    switch (typeof params[long])
    {
      case typeof true: break
      case typeof null:
      case typeof 0:
      case typeof "string":
      skip++
      i += 1
      value = process.argv[i]
      break
      default:
      throw `cannot decide type of '${long}'`
    }
    
//     console.log(`short ${short} -> ${long}=${value}`)
    params[long] = value
  }
  else
    throw `no such short option or parameter '${short}'`
  
  return skip
}

cmdline.def = function (m)
{
  let file = m.groups.file
  let key  = m.groups.key
  if (key) {
    if (key in params)
    {
      params[key] = file 
    }
    else
      console.warn(`ignoring unknown key '${key}'`)
    return
  }
  
  let def = require(`${cwd}/${file}`)
  def.origin = file
  
  let current = Generic.make(def)
  
  if (type && current.constructor.type != type)
    throw `inconsistent definitions: ${current.constructor.type} != ${type}`
  
  type = current.constructor.type
  defs.push(current)
}

class Generic {
  constructor (def) {
    for (let key in def)
      this[key] = def[key]
  }
  static make(def) {
    let object
    
    id: {
      if ("killers"  in def) { object = new Killers   (def); break id}
      if ("vehicles" in def) { object = new Generation(def); break id}
      if ("checks"   in def) { object = new Track     (def); break id}
      if ("span"     in def) { 
// 	object = new Vehicle(def); 
	object = new Generation({ vehicles: [ def ] })
	break id
      }
      
      throw `could not identify ${def.origin}` 
    }
    
    return object
  }
  
  static uuid() {
    //someone else's function
    //https://slavik.meltser.info/the-efficient-way-to-create-guid-uuid-in-javascript-with-explanation/
    let p8 = (s) => {
      var p = (Math.random().toString(16) + "000000000").substring(2, 2+8);
      return s ? "-" + p.substring(0, 4) + "-" + p.substring(4, 4+4) : p;
    }
    return p8() + p8(true) + p8(true) + p8();
  }

}
class Track extends Generic {
  static type = "track"
  constructor (def) {
    super(def)
    this.hash = this.md5()
//     if (!this.uuid)
//       this.uuid = this.missing = Generic.uuid()
  }
  md5() {
    let str = ""
    let {round} = Math
    for (let point of this.checks)
    {
      if (str.length) str += ":"
      str +=  `${round(point.a.x,2)},${round(point.a.y,2)}` 
      str += `-${round(point.b.x,2)},${round(point.b.y,2)}` 
    }
    
    return crypto.createHash('md5').update(str).digest('hex')
  }
  static merge(defs) {
    output = new Killers({killers: defs})
    return output
  }
}

class Killers extends Generic {
  static type = "killers"
  
  constructor(def) {
    super(def)
    this.killers = this.killers.map(k => new Track(k))
  }
  static merge(defs) {
    let output = defs[0]
    let trash = {}
    let killers = {}
    let done = {}
    let serial = 0
    
    let last = params["last-kill"]
    let fixKills = params["fix-kills"]
    let kills = params["kills"]
    if (last) last = parseInt(last)
    if (fixKills) fixKills = parseInt(fixKills)
  
    for (let def of defs) {
      for (let killer of def.killers) {
	serial ++
	let uuid = killer.uuid
	let target = killers 
	if (last) {
	  if (killer.lastKill >= last)
	    target = trash
	}
	if (kills)
	  if (!killer.kills) continue
	
	if (params["fix-kills"]) {
	  killer.kills = fixKills
	  killer.lastKill = serial
	}
	
	killer.origin = def.origin
	if (target[uuid]) {
	  console.log(`track ${uuid} is a doublon`)
	  if (killer.comment && !killers[uuid].comment)
	    target[uuid].comment = killer.comment
	}
	else
	  target[uuid] = killer
      }
    }

    let keys = Object.keys(killers)
    output.length  = keys.length
    output.killers = keys.map(k=>new Track(killers[k]))
    
    keys = Object.keys(trash)
    if (keys.length) {
      if (params.trash) {
	let output = {
	  length: keys.length,
	  killers: keys.map(k=>new Track(trash[k]))
	}
	let json = JSON.stringify(output, null, 2)
	writeFileSync(params.trash, json, 'utf8')
      }
      else
	console.log(`removed ${keys.length} tracks`)
    }
    
    return new Killers(output)
  }
  
  static doublon(defs) {
    let killers = {}
    let md5s = {}
  
    for (let def of defs) {
      let list = []
      let n = def.killers.length
      let i = 0
      let missing = 0  
      
      for (let killer of def.killers) {
	let uuid = killer.uuid
	let md5  = killer.md5()
	
	killer.serial = i++
	killer.origin = def.origin
	
	if (md5s[md5]) {
	  let dup = md5s[md5]
	  let point = `${killer.checks[0].a.x},${killer.checks[0].a.y} ${killer.checks[0].b.x},${killer.checks[0].b.y}`
	  console.warn(`${point} ${killer.origin}#${killer.serial} is likely a duplicate of ${dup.origin}#${dup.serial}`)
	}
	else
	  md5s[md5] = killer
	
	if (!uuid || !killers[uuid])
	  list.push(killer)
	
	if (!uuid)
	  console.warn(`${killer.origin}#${killer.serial} has no uuid`)
	
	killers[uuid] = killer
      }
      if (n == list.length)
	continue
      
      if (params["dry-run"]) {
	console.log(`${def.origin} : ${n}->${list.length}`)
      }
      else {
	def.killers = list
      
	writeFileSync(def.origin, JSON.stringify(def, null, 2), 'utf8');
      }
    }
  }
  static count(defs) {
    let count = 0
    let killers = {}
  
    for (let def of defs) {
      for (let killer of def.killers) {
	let uuid = killer.uuid
	killers[uuid] = killer
      }
    }
    
    count = Object.keys(killers).length
    console.log(`${count} tracks`)
  }
}
  
class Vehicle extends Generic {
  static type = "vehicle"
}
class Generation extends Generic {
  static type = "generation"
  
  static merge(defs) {
    let output = defs[0]
    let trash = {}
    let vehicles = {}
    let undef
    let minold = params.old
    let version = params["fix-version"]
    let factor = params["fix-factor"]
    let safe = params["fix-safe"]
    
    if (minold)  minold  = parseInt(minold)
    if (version) version = parseInt(version)
    if (factor) factor   = parseInt(factor)
    if (safe != null) safe = parseFloat(safe)
    
    
    for (let def of defs) {
      for (let vehicle of def.vehicles) {
	let uuid = vehicle.uuid
	let target = vehicles
	
	if (params["fix-beta"])	   vehicle.beta = vehicle.old
	if (params["add-range"])   vehicle.range = [ 1, 0.01 ]
	if (params["fix-version"]) {
	  if (vehicle.version == 3 && version == 4)
	    vehicle.channels = { 'v2': 1 }
	  vehicle.version = version
	}
	if (params["fix-factor"]) {
	  if (vehicle.limit.factor)
	    vehicle.limit.factor /= factor
	  vehicle.channels = { 'v2': factor, 'h[0]*v2': factor }
	}
	if (params["fix-relu"]) {
	  vehicle.brain.activation = "relu"
	}
	
	if (minold && vehicle.old < minold)
	{
	  target = trash
	}
	
	let previous = target[uuid]
	if (previous) {
	  if (previous.old > vehicle.old)
	    continue
	  if (previous.name)
	    vehicle.name = previous.name
	}
	if (safe != null)
	  vehicle.limit.safe = safe
	
	target[uuid] = vehicle
      }
    }
    
    let keys = Object.keys(vehicles)
    output.counts  = { running: keys.length }
    output.vehicles = keys.map(k=>vehicles[k])
    
    keys = Object.keys(trash)
    if (keys.length) {
      if (params.trash) {
	let output = {
	  length: keys.length,
	  vehicles: keys.map(k=>new Vehicle(trash[k]))
	}
	let json = JSON.stringify(output, null, 2)
	writeFileSync(params.trash, json, 'utf8')
      }
      else
	console.log(`removed ${keys.length} vehicles`)
    }

    
    return new Generation(output)
  }
  static dumpOld(defs) {
    let known = {}
    let byOldAsc  = (a,b) => a.old-b.old
    let byOldDesc = (a,b) => b.old-a.old
    let str = v => 
	`\t${v.serial}\t${v.old}\t${v.uuid.substr(0,6)}` + 
	(v.known ? v.known : '')

    let vehicles, N, g=0
    for (let def of defs) {
      let gen = new Generation(def)
      vehicles = gen.vehicles
    
      let N = vehicles.length
    
      for (let i=0; i < N; i++) {
	let v = vehicles[i]
	if (known[v.uuid])
	  v.known = known[v.uuid]
	else
	  known[v.uuid] = `\t${g}:${v.old}`
	v.serial = i+1
      }
      g++
    }
    
    vehicles.sort(byOldDesc)
    N = vehicles.length
  
    let V = vehicles
    let v1 = vehicles[N-1]
    let v10 = vehicles[10]
  
    console.log('\tserial\told\tuuid\tgen:old')
    console.log(`old` + str(V[0]))
    let i
    for (i=1; i < 10 && i < N-1; i++)
      console.log(str(V[i]))
    if (i < N-1) {
      console.log(`${i}th` + str(V[i])); i++
    }
	       
    for (; i < 20 && i < N-1; i++)
      console.log(str(V[i]))
    if (i < N-1) {
      console.log(`${i}th` + str(V[i])); i++
    }
    for (; i < N-1; i++)
      if (V[i].known)
	console.log(`${i}th` + str(V[i]));
	     
    console.log(`young` + str(V[N-1]))
  }
  static doublon(defs) {
    let vehicles = {}
  
    for (let def of defs) {
      let list = []
      let n = def.vehicles.length
      let i = 0
      
      for (let vehicle of def.vehicles) {
	let uuid = vehicle.uuid
	
// 	vehicle.serial = i++
	
	if (!uuid || !vehicles[uuid])
	  list.push(vehicle)
	
	vehicles[uuid] = vehicle
      }
      if (n == list.length)
	continue
      
      if (params["dry-run"]) {
	console.log(`${def.origin} : ${n}->${list.length}`)
      }
      else {
	def.vehicles = list
      
	writeFileSync(def.origin, JSON.stringify(def, null, 2), 'utf8');
      }
    }
  }
  
  static count(defs) {
    let count = 0
    let vehicles = {}
  
    for (let def of defs) {
      for (let vehicle of def.vehicles) {
	let uuid = vehicle.uuid
	vehicles[uuid] = vehicle
      }
    }
    
    count = Object.keys(vehicles).length
    console.log(`${count} vehicles`)
  }
  
//   static max(defs) {
//     for (let def of defs) {
//       for (let vehicle of def.vehicles) {
// 	let weights = vehicle.brain.weights
// 	let last = weights[weights.length-1].values
	
// 	console.log()
//       }
//     }
//   }
}

cmdline()

let model = defs[0]
let command = params.command
if (commands[command])
  command = commands[command]

if (command in model.constructor)
  ;
else
  throw `'${model.constructor.type}' does not implement command '${params.command}'`


output = model.constructor[command](defs)

if (output) {
  let json = JSON.stringify(output, null, 2)
  if (!params.output)
    process.stdout.write(json)
  else
    writeFileSync(params.output, json, 'utf8');
}

