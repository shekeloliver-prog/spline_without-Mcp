// Small helpers for generated textures and seeded randomness. Planet surfaces
// use real maps (textureUrls.js); only effects are generated here.
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { TEXTURES, DATA_TEXTURES } from './textureUrls.js'

export function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Load one or more maps by key from TEXTURES, with the right colour space
// and good filtering for grazing angles.
export function useMaps(...keys) {
  const urls = keys.map((k) => TEXTURES[k])
  const textures = useTexture(urls, (loaded) => {
    ;[].concat(loaded).forEach((t, i) => {
      t.colorSpace = DATA_TEXTURES.has(keys[i]) ? THREE.NoColorSpace : THREE.SRGBColorSpace
      t.anisotropy = 8
    })
  })
  return Object.fromEntries(keys.map((k, i) => [k, textures[i]]))
}

const cache = new Map()

// Soft radial falloff used for the Sun's corona and the comet's coma.
export function glowTexture() {
  if (!cache.has('glow')) {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.15, 'rgba(255,255,255,0.6)')
    grad.addColorStop(0.4, 'rgba(255,255,255,0.12)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    cache.set('glow', t)
  }
  return cache.get('glow')
}

// Pluto, drawn from the features New Horizons mapped in 2015: a tan,
// methane-frosted world with the bright heart (Tombaugh Regio, its left lobe
// the nitrogen-ice plain Sputnik Planitia) near 180° longitude, the long dark
// reddish band of Cthulhu Macula along the equator to its west, darker
// spots further round, and a paler north polar cap. An artist's map, not a
// photo mosaic.
export function plutoTexture() {
  if (!cache.has('pluto')) {
    const W = 1024
    const H = 512
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d')
    const random = rng(1930)
    const lon = (deg) => (deg / 360) * W
    const lat = (deg) => ((90 - deg) / 180) * H

    g.fillStyle = '#c4a988'
    g.fillRect(0, 0, W, H)
    // mottled terrain
    for (let i = 0; i < 1600; i++) {
      g.globalAlpha = 0.05 + random() * 0.12
      g.fillStyle = random() < 0.5 ? '#9d7f62' : '#dcc7a8'
      g.beginPath()
      g.arc(random() * W, random() * H, 2 + random() * random() * 22, 0, Math.PI * 2)
      g.fill()
    }
    // pale north polar region (Lowell Regio)
    const cap = g.createLinearGradient(0, 0, 0, lat(55))
    cap.addColorStop(0, 'rgba(214,214,206,0.9)')
    cap.addColorStop(1, 'rgba(214,214,206,0)')
    g.globalAlpha = 1
    g.fillStyle = cap
    g.fillRect(0, 0, W, lat(55))
    // dark equatorial band: Cthulhu Macula, plus the darker spots further east
    g.fillStyle = '#4a2d22'
    const blob = (x, y, rx, ry, a) => {
      g.globalAlpha = a
      g.beginPath()
      g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
      g.fill()
    }
    for (let i = 0; i < 70; i++) {
      blob(lon(20 + random() * 140), lat(-18 + random() * 22), 18 + random() * 40, 8 + random() * 18, 0.18 + random() * 0.25)
    }
    for (let i = 0; i < 6; i++) blob(lon(215 + i * 22), lat(-8 + random() * 6), 18 + random() * 10, 10 + random() * 6, 0.45)
    // the heart: two lobes and a point, centred near 180°E, 20°N
    const hx = lon(180)
    const hy = lat(15)
    g.globalAlpha = 0.92
    g.fillStyle = '#f2ebe0'
    g.beginPath()
    g.moveTo(hx, hy + 70)
    g.bezierCurveTo(hx - 120, hy + 10, hx - 105, hy - 75, hx - 40, hy - 70)
    g.bezierCurveTo(hx - 10, hy - 68, hx, hy - 45, hx, hy - 38)
    g.bezierCurveTo(hx, hy - 45, hx + 15, hy - 72, hx + 55, hy - 66)
    g.bezierCurveTo(hx + 120, hy - 55, hx + 105, hy + 15, hx, hy + 70)
    g.fill()
    // Sputnik Planitia (the smooth left lobe) is brighter still, with cells
    g.globalAlpha = 0.6
    g.fillStyle = '#fbf7f0'
    g.beginPath()
    g.ellipse(hx - 48, hy - 8, 46, 52, -0.2, 0, Math.PI * 2)
    g.fill()
    g.globalAlpha = 0.12
    g.strokeStyle = '#c9bfae'
    for (let i = 0; i < 40; i++) {
      g.beginPath()
      g.arc(hx - 48 + (random() - 0.5) * 70, hy - 8 + (random() - 0.5) * 80, 6 + random() * 8, 0, Math.PI * 2)
      g.stroke()
    }
    g.globalAlpha = 1
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    cache.set('pluto', t)
  }
  return cache.get('pluto')
}
