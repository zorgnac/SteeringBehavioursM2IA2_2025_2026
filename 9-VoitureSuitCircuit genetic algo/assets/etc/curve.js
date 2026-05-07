let G = {
  position: 0
}

G.start = function(e)
{
  // console.log(e)
  G.x = e.x
}
G.move = function (e) {
  if (G.x == null) return

  let dx = (e.x - G.x)/10
  let position = G.position + dx
  G.scroll.setAttribute('transform', `translate(${position})`)
}
G.stop = function (e) {
  let dx = (e.x - G.x) / 10
  G.position += dx
  G.x = null
}
G.reset = function() {
  let position = G.position = 0
  G.scroll.setAttribute('transform', `translate(${position})`)
}
G.install = function ()
{
  /** @type SVGElement */ G.scroll = document.querySelector('#scroll')

  let back = document.querySelector('#back')

  back.addEventListener('mousedown', G.start)
  back.addEventListener('mouseup', G.stop)
  back.addEventListener('mousemove', G.move)
  back.addEventListener('dblclick', G.reset)
}

window.addEventListener('load', G.install)

