// Utilitaires UI/DOM pour p5

function createCheckDiv(control, title, text, id)
{
  let div = createDiv()

  div.parent(control)
  div.attribute('title' , title)

  let label  = createElement('label')
  label.addClass('Label')
  label.html(text)
  label.attribute('for', id)
  label.parent(div)

  let check = createElement('input') // 'Pause')
  check.attribute('id'  , id)
  check.attribute('type', 'checkbox')
  check.parent(div)

  check.checked = function (value) {
    let undef
    if (typeof value != typeof undef)
      this.elt.checked = value

    return this.elt.checked
  }

  return check
}
function createSliderDiv(control, title, text, values, change)
{
  let div = createDiv()
  div.attribute('title', title)
  div.parent(control)

  let label  = createDiv(text)
  label.addClass('Label')
  label.parent(div)

  let slider = createSlider(values[0],values[1], values[2])
  slider.parent(div)

  if (change)
    slider.changed(change)

  return slider
}
function createActionButton(control, title, text, action)
{
  let button

  button = createButton(text)
  button.attribute('title', title)
  button.addClass('Control')
  button.mousePressed(action)
  button.parent(control)

  return button
}
function createTable(parent, labels, numRows)
{
  let table = createElement('table')
  let header = createElement('tr')
  header.parent(table)

  let make = (row, type, label) => {
    let cell = createElement(type)
    cell.parent(row)
    cell.addClass(label)
    cell.html(label)

    return cell
  }

  for (let label of labels) {
    make(header, 'th', label)
  }

  let rows = []
  for (let i = 0; i < numRows; i++) {
    let row = createElement('tr')
    rows.push(row)
    row.cells = {}
    row.parent(table)
    for (let label of labels) {
      row.cells[label] = make(row, 'td', label)
    }
  }

  if (parent) {
    table.parent(parent)
  }

  table.clear = () => {
    for (let row of rows)
      for (let label in row.cells)
        row.cells[label].html("&nbsp;")
  }
  table.set = (r, content) => {
    let row = rows[r]
    if (row) {
      for (let label in row.cells) {
        if (label in content) {
          row.cells[label].html(content[label])
        }
      }
      if (content.attributes) {
        for (let att in content.attributes)
          row.attribute(att, content.attributes[att])
      }
    }
    return row
  }

  return table
}

function dataAsRGB(data, normal)
{
  let prepared = []
  let min = Infinity, max = -Infinity

  if (normal) {
    for (let f of data) {
      prepared.push(f-0.5)
    }

    min = -0.5, max = 0.5
  }
  else {
    for (let f of data) {
      if (f < min) min = f
      if (f > max) max = f
      prepared.push(f)
    }
  }
  let scale = Math.max(Math.abs(min), Math.abs(max))
  for (let i in prepared) {
    let rgb
    let f = prepared[i]
    f /= scale
    f *= 127

    const BASE=92
    let v = Math.round(Math.abs(f))
    let o = BASE + Math.round(v / 2)
    let g = BASE + v
    rgb = `rgb(${BASE},${BASE},${BASE})`
    if (f > 0) rgb = `rgb(${o}, ${g}, ${v + 128})`
    if (f < 0) rgb = `rgb(${v + 128}, ${g}, ${o})`

    prepared[i] = (rgb)
  }

  return prepared
}

/*
  "weights": [
    {
      "shape": [
        10,
        3
      ],
      "values": [
        0, 	0, 0,
	      0, 	0, 0,
	      -0.94, 	0, 0,
	      0, 	0, 0,
	      0, 	0, 0,
 	      
	      0 , 	0, 0,
	      -1, 	0, 0,
 	      
        0, 	1, 0,
	      0, 	0, 0,
        0, 	0, 0
      ]
    }...

*/

function drawTensor(ctx, data, x, y, transpose, normal)
{
  let shape = data.shape
  data = data.values

  w = shape[0]
  h = shape[1]; 
  if (!h) { h=1 }
  let rgb = dataAsRGB(data, normal)

  ctx.save()
  {
    let i = 0
    if (x || y) ctx.translate(x, y);
    else x = y = 0;
    // let A = [x,y]
    let DX = [1,0]
    let DY = [0,1]

    if (transpose) 
    {
      let D = DY
      DY = DX
      DX = D
    }
    ctx.save()
    for (let dx = 0; dx < w; dx++) {
      ctx.save()
      for (let dy = 0; dy < h; dy++) {
        // let g = data[i++] * 255
        ctx.fillStyle = rgb[i++] // `rgb(${g}, ${g}, ${g})`
        ctx.fillRect(0, 0, 1, 1)
        ctx.translate.apply(ctx, DY)
      }
      ctx.restore()
      ctx.translate.apply(ctx, DX)
    }
    ctx.restore()
    let dx = DX[0]*w + DY[0]*h
    let dy = DX[1]*w + DY[1]*h
    ctx.lineWidth = 0.1
    ctx.strokeStyle = "white"
    ctx.strokeRect(0,0,dx,dy)
    shape = [dx,dy]
  }
  ctx.restore()
  return shape
}

function drawVector(ctx, vector, x, y, reverse, scale, normal) {
  let tensor = {
    shape: [ vector.length ],
    values : vector
  }
  if (scale) {
    ctx.save()
    ctx.scale(scale, scale)
  }
  let shape = drawTensor(ctx, tensor, x, y, reverse, normal)
  if (scale)
    ctx.restore()
  
  return shape
}


