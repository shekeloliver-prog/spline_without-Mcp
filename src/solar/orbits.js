// Elliptical orbits for the dwarf planets (Kepler's equation), mapped onto
// the app's stylised distance scale. Scene axes follow the planets'
// convention: ecliptic x -> X, ecliptic y -> -Z, ecliptic north -> +Y, so
// orbits run anticlockwise seen from above.
import * as THREE from 'three'
import { auToScene } from './data.js'

const DEG = Math.PI / 180

// Position of a body with orbital elements `o` at time t (years) -> `out`.
// `M0` (degrees) optionally overrides the starting mean anomaly (Today's sky).
export function keplerPosition(o, t, out, M0 = o.M0) {
  const M = M0 * DEG + (Math.PI * 2 * t) / o.period
  // Solve E - e sin E = M (Newton's method, a few steps are plenty).
  let E = M
  for (let k = 0; k < 6; k++) E -= (E - o.e * Math.sin(E) - M) / (1 - o.e * Math.cos(E))
  const nu = 2 * Math.atan2(Math.sqrt(1 + o.e) * Math.sin(E / 2), Math.sqrt(1 - o.e) * Math.cos(E / 2))
  const rAU = o.a * (1 - o.e * Math.cos(E))
  // Orbital plane -> ecliptic: rotate by the argument of perihelion, the
  // inclination, then the longitude of the ascending node.
  const u = nu + o.peri * DEG
  const node = o.node * DEG
  const inc = o.i * DEG
  const x = Math.cos(node) * Math.cos(u) - Math.sin(node) * Math.sin(u) * Math.cos(inc)
  const y = Math.sin(node) * Math.cos(u) + Math.cos(node) * Math.sin(u) * Math.cos(inc)
  const z = Math.sin(u) * Math.sin(inc)
  const r = auToScene(rAU)
  return out.set(x * r, z * r, -y * r)
}

const a = new THREE.Vector3()
const b = new THREE.Vector3()
// Position and velocity (scene units per year), for handing a dwarf planet
// over to the sandbox physics.
export function keplerState(o, t, pos, vel) {
  const h = o.period * 1e-4
  keplerPosition(o, t - h, a)
  keplerPosition(o, t + h, b)
  vel.subVectors(b, a).divideScalar(2 * h)
  return keplerPosition(o, t, pos)
}

// Points around the whole orbit, for drawing it.
export function orbitPoints(o, n = 360) {
  const pts = []
  const v = new THREE.Vector3()
  for (let k = 0; k <= n; k++) {
    keplerPosition({ ...o, M0: 0 }, (k / n) * o.period, v)
    pts.push([v.x, v.y, v.z])
  }
  return pts
}
