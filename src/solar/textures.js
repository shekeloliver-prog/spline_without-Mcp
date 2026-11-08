// Procedural canvas textures, so the solar system needs no image downloads.
// Every texture is seeded, so it looks the same on each load.
import * as THREE from 'three'

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFrom(name) {
  let h = 2166136261
  for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h
}

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

function toTexture(c) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// Horizontal bands (gas giants, Venus' clouds). The sphere's V coordinate runs
// pole to pole, so rows of the canvas become latitude bands.
function banded(colors, random) {
  const [c, g] = canvas(512, 256)
  let y = 0
  while (y < 256) {
    const h = 4 + random() * 22
    g.fillStyle = colors[Math.floor(random() * colors.length)]
    g.globalAlpha = 0.55 + random() * 0.45
    g.fillRect(0, y, 512, h + 1)
    y += h
  }
  // Soft wavy streaks so the bands aren't perfectly straight.
  g.globalAlpha = 0.18
  for (let i = 0; i < 60; i++) {
    g.fillStyle = colors[Math.floor(random() * colors.length)]
    g.beginPath()
    g.ellipse(random() * 512, random() * 256, 20 + random() * 80, 1 + random() * 3, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  return c
}

// Speckled surface with craters (Mercury, Mars).
function rocky(colors, random) {
  const [c, g] = canvas(512, 256)
  g.fillStyle = colors[0]
  g.fillRect(0, 0, 512, 256)
  for (let i = 0; i < 900; i++) {
    g.globalAlpha = 0.08 + random() * 0.25
    g.fillStyle = colors[1 + Math.floor(random() * (colors.length - 1))]
    const r = 1 + random() * random() * 14
    g.beginPath()
    g.arc(random() * 512, random() * 256, r, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  return c
}

// Ocean, blobby continents and polar caps.
function earth([ocean, land, ice], random) {
  const [c, g] = canvas(512, 256)
  g.fillStyle = ocean
  g.fillRect(0, 0, 512, 256)
  g.fillStyle = land
  for (let k = 0; k < 7; k++) {
    const cx = random() * 512
    const cy = 50 + random() * 156
    for (let i = 0; i < 40; i++) {
      g.beginPath()
      g.arc(cx + (random() - 0.5) * 110, cy + (random() - 0.5) * 60, 6 + random() * 16, 0, Math.PI * 2)
      g.fill()
    }
  }
  g.fillStyle = ice
  g.fillRect(0, 0, 512, 14)
  g.fillRect(0, 242, 512, 14)
  // Wispy clouds.
  g.fillStyle = '#ffffff'
  for (let i = 0; i < 120; i++) {
    g.globalAlpha = 0.12 + random() * 0.2
    g.beginPath()
    g.ellipse(random() * 512, random() * 256, 10 + random() * 40, 2 + random() * 5, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  return c
}

const BUILDERS = { banded, rocky, earth }
const cache = new Map()

export function planetTexture(planet) {
  if (!cache.has(planet.name)) {
    const c = BUILDERS[planet.texture](planet.colors, rng(seedFrom(planet.name)))
    cache.set(planet.name, toTexture(c))
  }
  return cache.get(planet.name)
}

// Saturn's ring. RingGeometry's UVs are planar, so concentric circles drawn
// on a square canvas line up with the ring.
export function ringTexture({ inner, outer, colors }) {
  const key = `ring:${inner}:${outer}`
  if (!cache.has(key)) {
    const size = 512
    const [c, g] = canvas(size, size)
    const random = rng(42)
    const rIn = (inner / outer) * (size / 2)
    for (let r = size / 2; r > rIn; r -= 1.5) {
      g.strokeStyle = colors[Math.floor(random() * colors.length)]
      g.globalAlpha = random() < 0.08 ? 0.05 : 0.35 + random() * 0.6 // the odd gap
      g.lineWidth = 2
      g.beginPath()
      g.arc(size / 2, size / 2, r, 0, Math.PI * 2)
      g.stroke()
    }
    cache.set(key, toTexture(c))
  }
  return cache.get(key)
}

// Soft radial glow for the Sun's halo and the comet's head.
export function glowTexture() {
  if (!cache.has('glow')) {
    const [c, g] = canvas(256, 256)
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.2, 'rgba(255,255,255,0.55)')
    grad.addColorStop(0.5, 'rgba(255,255,255,0.12)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
    cache.set('glow', toTexture(c))
  }
  return cache.get('glow')
}

export { rng }
