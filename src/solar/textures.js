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
