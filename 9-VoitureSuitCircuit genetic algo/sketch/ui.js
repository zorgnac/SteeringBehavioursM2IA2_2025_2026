// Elements utilisateur 
let UI = {
        messageDiv: null,

        speedSlider: null,
        rateSlider: null,

        trackButton: null,
        saveButton: null,
        killButton: null,
        stepButton: null,

        genCheck: null, // pause sur changement de generation
        purgeCheck: null,
        testCheck: null,
        killerCheck: null,

  /** @type CanvasRenderingContext2D */ board: null,

        get status() {
                return {
                        "test": this.testCheck.checked(),
                        "cycles": this.speedSlider.value(),
                        "rate": CONFIG.Sketch.RATES[this.rateSlider.value()],
                        "pause": UI.genCheck.checked(),
                        "step": UI.stepButton.value(),
                        "purge": UI.purgeCheck.checked(),
                        "killer": UI.killerCheck.checked(),
                }
        }
};

UI.setup = function () {
        let board = createDiv()
        let canvas = createCanvas(1200, 800);

        let div, label

        canvas.parent(board)
        canvas.addClass('Left')

        let right = createDiv()
        right.parent(board)
        right.addClass('Left')

        UI.raceTable = createTable(right, Vehicle.cells, 10)
        UI.raceTable.addClass('Race')
        UI.raceTable.attribute("onclick", "UI.onRaceClick(event)")
        UI.raceTable.clear()

        UI.testTable = createDiv()
        UI.testTable.parent(right)
        UI.testTable.addClass('Test')

        UI.messageDiv = createDiv();
        UI.messageDiv.addClass('Message');

        let control = createDiv()
        control.addClass('Controls');

        let def = CONFIG.Sketch

        UI.speedSlider = createSliderDiv(control,
                "Amount of physical steps in a clock tick",
                'Speed', [0, 12, def.SPEED], UI.onSpeedChange);
        UI.rateSlider = createSliderDiv(control,
                "Number of clock ticks in a user second",
                'Rate', [0, def.RATES.length - 1, def.RATES.length - 1], UI.onRateChange);

        let column

        column = createDiv();
        column.addClass('Column Left');
        column.parent(control);
        UI.genCheck = createCheckDiv(column,
                "Pause before starting next race",
                "Pause", "gencheck");
        UI.killerCheck = createCheckDiv(column,
                `Pause when an automated killer test is done`,
                "Killer", "killerCheck");

        column = createDiv();
        column.addClass('Column Left');
        column.parent(control);

        UI.testCheck = createCheckDiv(column,
                `Loop on killer tracks`,
                "Test", "testCheck");
        UI.purgeCheck = createCheckDiv(column,
                "Put all vehicles on track. Once done keep the TOTAL best. Not applicable when test is ongoing",
                'Purge', "purgeCheck")

        div = createDiv()
        div.addClass('Actions');

        UI.trackButton = createActionButton(div,
                "Change track, keeping current population",
                'Track', (e) => nextTrack())
        UI.saveButton = createActionButton(div,
                "Save generation, killer tracks, current track, leader vehicle",
                'Save', (e) => saveAll())
        UI.killButton = createActionButton(div,
                "Finish race, killing running cars",
                'Kill', UI.killRunning)
        UI.finishButton = createActionButton(div,
                "Finish race, considering running cars are successful",
                'Finish', UI.finishRunning)
        UI.stepButton = createActionButton(div,
                "Forward one step in time, then pause",
                'Step', UI.oneStep)


        let black = createElement('canvas')
        black.id("board")
        black.attribute("width", 400)
        black.attribute("height", 400)
        UI.board = black.elt.getContext("2d")

        UI.purgeCheck.checked(def.CHECK_PURGE)
        UI.killerCheck.checked(def.CHECK_KILLER)
        UI.genCheck.checked(def.CHECK_PAUSE)
        UI.testCheck.checked(def.LOAD_KILLERS ? def.CHECK_TEST : false)
        UI.onRateChange()

        canvas.elt.addEventListener("click", (e) => {
                let vehicle = currentGen.vehicleAt(canvas.elt, e)
                UI.selectVOI(vehicle)
                UI.brainInfo(vehicle ? vehicle : 'none')
        })

        canvas.elt.addEventListener("mousemove", (e) => {
                let vehicle = currentGen.vehicleAt(canvas.elt, e)
                if (vehicle) {
                        canvas.attribute("title", `${vehicle}`)
                        canvas.addClass("Interactive")
                }
                else {
                        canvas.removeAttribute("title")
                        canvas.removeClass("Interactive")
                }
        })

}

UI.genStats = function (stats) {
        if (stats.olds) {
                let message = `Stats: ${stats.olds} olds, oldest is ${stats.oldest.id}`
                if (stats.youngest.old)
                        message += `, youngest is ${stats.youngest.id}`;
                UI.message(message);
        }
}
UI.message = function (message, log, force) {
        let holder = UI.speedSlider
        if (log) console.log(message)
        if (holder.value() == 0 && !force)
                holder.hold = message;
        else
                UI.messageDiv.html(message);
        UI.lastMessage = message
}
UI.pause = function (message) {
        let holder = UI.speedSlider
        UI.message(message)
        holder.value(0)
}
UI.onSpeedChange = function () {
        if (UI.speedSlider.value() != 0 && UI.speedSlider.hold) {
                UI.messageDiv.html(UI.speedSlider.hold);
                UI.speedSlider.hold = null;
        }
}
UI.onRateChange = function () {
        let def = CONFIG.Sketch
        const rate = def.RATES[UI.rateSlider.value()]
        console.log(`rate ${rate}`)
        frameRate(rate)
        if (UI.rateSlider.value() != 0 && UI.rateSlider.hold) {
                UI.messageDiv.html(UI.rateSlider.hold);
                UI.rateSlider.hold = null;
        }
}

// Enclenche une pause après le prochain tick d'horloge
UI.oneStep = function () {
        UI.speedSlider.value(1)
        UI.stepButton.value(1)
}


UI.onRaceClick = function (e) {
        let serial = int(e.srcElement.parentElement.getAttribute("serial"))
        let vehicle = 'none'
        if (serial != null) vehicle = currentGen.find(serial)
        UI.brainInfo(vehicle)
        UI.selectVOI(vehicle)
}

/** Dernière voiture manipulée par l'utilisateur */ let car
UI.selectVOI = function (vehicle) {
        if (vehicle) {
                // console.log(vehicle.id)
                car = vehicle
                if (!Vehicle.OF_INTEREST)
                        Vehicle.OF_INTEREST = Vehicle.config.OF_INTEREST
                Vehicle.config.OF_INTEREST = vehicle
                UI.message(`VOI: ${vehicle}`, true, true)
        }
        else {
                if (Vehicle.OF_INTEREST) {
                        Vehicle.config.OF_INTEREST = Vehicle.OF_INTEREST
                        UI.message(`VOI: ${Vehicle.OF_INTEREST}`, true, true)
                }
                delete Vehicle.OF_INTEREST
        }
}

UI.onTestKillerClick = function (name) {
        if (!UI.speedSlider.value()) {
                UI.selectKiller(name)
        }
}

UI.onTestDone = function (message) {
        let { killer } = UI.status
        let test = UI.testCheck
        if (test.checked() && (test.value() != 'auto' || killer))
                UI.pause(message);

        test.checked(false);
        test.value('on')
}


/** @type NeuralNetwork */ let brain
// let pace
UI.brainInfo = function (selection) {
        let ctx = UI.board

        if (!selection) selection = 0

        if (selection instanceof Vehicle)
                car = selection;
        else
                car = currentGen.lists.running[selection]

        // pace = currentGen.lists.running[1]
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        if (!car) {
                console.log('no car')
                return
        }
        // console.log(car.id)
        brain = car.brain
        let r = brain.draw(ctx, 1, 2)
        {
                ctx.save()
                // ctx.font = "48px serif"
                ctx.fillStyle = "white"
                ctx.fillText(car.id + " " + car.brain.activation, 10, 10)
                ctx.strokeText(car.id, 0, 0)
                ctx.restore()
        }
        return r
}

UI.raceInfo = function () {
        let lists = currentGen.lists

        lists.finished.sort(Vehicle.byRank)
        lists.running.sort(Vehicle.byPoints)

        let table = UI.raceTable
        table.clear()
        let i = 0
        for (let list of [lists.finished, lists.running]) {
                for (let vehicle of list) {
                        if (!vehicle.active) continue
                        if (!table.set(i, vehicle.summary))
                                break
                        i++
                }
        }
}
// On affiche différentes infos sur le déroulement
// de la course : 
// - numéro de la génération et de piste, 
// - réglages UI, 
// - ...
UI.info = function (cycles, vehicle) {
        fill(255);
        textSize(24);
        noStroke();
        let y = 50;
        if (!currentGen)
                text(300, 25, "Generation is not ready");

        else {
                const { test, rate, cycles } = UI.status

                let def = CONFIG.Sketch
                let stats = currentGen.stats
                let track = currentTrack.id;
                let uuid = currentTrack.uuid;
                let passed = killerTest.passed[uuid];
                if (passed)
                        track = track + ' (' + passed + ')';

                if (test) {
                        let killers = killerTest.killers ? killerTest.killers : Track.killers
                        if (killers.length)
                                track = track + ` of ${killers.length}`
                }

                if (currentTrack.tricky && currentTrack.tricky != Track.config.TRICKY)
                        track += ` t=${currentTrack.tricky}`
                if (currentTrack.crashKills)
                        track += ` k=${round(currentTrack.crashKills, 1)}`
                if (currentTrack.comment)
                        track += ` ${currentTrack.comment}`

                let serial = currentGen.serial
                if (test && killerTest.start)
                        serial = `+${serial - killerTest.startGen}`
                text('generation ', 10, y); text(serial, 150, y); y += 25;
                text('track      ', 10, y); text(track, 150, y); y += 25;
                text('rate       ', 10, y); text(rate, 150, y); y += 25;
                text('speed      ', 10, y); text(cycles, 150, y); y += 25;
                text('store      ', 10, y); text(currentGen.countStored, 150, y); y += 25;
                let elders = `${stats.elders}`
                if (test) {
                        if (killerTest.elders[currentTrack.uuidLapped])
                                elders = `${elders} + ${killerTest.elders[currentTrack.uuidLapped] - elders}`
                }
                else if (stats.qualified && stats.qualified > elders)
                        elders = `${elders}[${stats.qualified - elders}]`

                text('elders     ', 10, y); text(elders, 150, y); y += 25;
                x = 200; y = 25
                let str = vehicle ? `${vehicle}` : 'no car'

                if (vehicle) {
                        let {
                                id, stats, max, laps,
                                score, vel
                        } = vehicle.summary

                        laps = laps ? `laps=${laps}` : ""
                        text(`${currentGen.countAlive}: ${id}`, x, y); x += 175 + 50
                        text(`[${score}]`, x, y); x += 60
                        text(`vel=${vel}%`, x, y); x += 120
                        text(`[${stats}`, x, y); x += 150
                        text(`${max}]`, x, y); x += 100
                        text(laps, x, y); x += 100
                }
                else
                        text(`${currentGen.countAlive}: ${str}`, x, y);

                if (!cycles) {
                        text("Pause - use Speed slider to animate", 400, 400)
                }
        }
}
// Sélectionne le i-ième circuit tueur
UI.selectKiller = function (i) {
        const { test } = UI.status
        let killers = Track.killers
        if (test && killerTest.killers)
                killers = killerTest.killers

        if (!i) i = 0;
        if (i < 0) i = killers.length + i;
        if (i < 0 || i >= killers.length)
                throw `out of range (length=${killers.length})`

        let track = typeof i == "string" ? Track.find(i) : killers[i];
        if (track) {
                currentTrack = track
                currentStats = currentGen.prepare(currentTrack);
                UI.testTable.html(killerTest.htmlInfo())
        }
        else
                console.log(`no such killer '${i}'`)
}

// Assassine les voitures en course
UI.killRunning = function () {
        let running = currentGen.lists.running
        const limit = 10
        let kills = running.length
        let name = `m${kills}-t${currentTrack.serial - Track.offset}.gen`

        if (kills < limit || window.confirm(`Really murder ${kills} running vehicles?`)) {
                if (kills >= limit)
                        saveGeneration(name, ['running'])

                for (vehicle of running)
                        vehicle.kill()
        }
}

// Marque les voitures en course comme ayant terminé
UI.finishRunning = function () {
        let running = currentGen.lists.running
        for (vehicle of running) {
                if (vehicle.dead) continue;
                if (vehicle.finished) continue;
                if (!vehicle.speed) vehicle.speed = 1;
                vehicle.points = vehicle.track.laps * vehicle.track.checkpoints.length;
                vehicle.tracks = vehicle.track.laps;
                vehicle.finished = -1
        }
}
