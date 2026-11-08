// Turns the Spline Cube into lumpy asteroid shapes: round it partway toward
// a sphere, then push each vertex in or out with 3D value noise.
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { rng } from './textures.js'

function valueNoise(seed) {
  const random = rng(seed)
  const perm = new Uint8Array(512)
  const vals = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    perm[i] = i
    vals[i] = random() * 2 - 1
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i]
  const v = (x, y, z) => vals[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]]
  const s = (t) => t * t * (3 - 2 * t)
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
    const xf = s(x - xi), yf = s(y - yi), zf = s(z - zi)
    const lerp = THREE.MathUtils.lerp
    const x00 = lerp(v(xi, yi, zi), v(xi + 1, yi, zi), xf)
    const x10 = lerp(v(xi, yi + 1, zi), v(xi + 1, yi + 1, zi), xf)
    const x01 = lerp(v(xi, yi, zi + 1), v(xi + 1, yi, zi + 1), xf)
    const x11 = lerp(v(xi, yi + 1, zi + 1), v(xi + 1, yi + 1, zi + 1), xf)
    return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf)
  }
}

export function makeRock(cube, seed) {
  let g = cube.clone()
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g)
  g.computeBoundingBox()
  const center = g.boundingBox.getCenter(new THREE.Vector3())
  const half = g.boundingBox.getSize(new THREE.Vector3()).x / 2
  const noise = valueNoise(seed)
  const pos = g.attributes.position
  const p = new THREE.Vector3()
  const dir = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).sub(center)
    dir.copy(p).normalize()
    p.lerp(dir.clone().multiplyScalar(half), 0.55) // soften the box
    const n =
      noise(dir.x * 1.6 + 7, dir.y * 1.6, dir.z * 1.6) * 0.32 +
      noise(dir.x * 4 + 3, dir.y * 4, dir.z * 4) * 0.1
    p.addScaledVector(dir, n * half)
    pos.setXYZ(i, p.x, p.y, p.z)
  }
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}
