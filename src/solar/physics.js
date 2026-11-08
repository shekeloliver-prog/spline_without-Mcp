// Sandbox physics. Until something disturbs the system, planets follow their
// exact analytic orbits. Once a black hole, white hole, wormhole or
// supernova appears, every surviving planet becomes a free body: it starts
// from its current orbital position and velocity and is integrated under
// gravity from then on.
//
// Units: scene units and Earth years (the same clock as sim.time).
//
// The stylised distances don't obey Kepler's third law, so a single solar
// mass can't keep every planet on its orbit. Each body therefore carries its
// own solar "gm" (omega² · r³), chosen so its undisturbed orbit is exactly
// the circle it was already on. Black holes etc. add forces on top.
import * as THREE from 'three'
import { orbitAngle } from './sim.js'

const SOFTEN2 = 1.5 // softening² keeps close passes finite
export const SUN_BURN_RADIUS = 7

export function createPhysics() {
  return {
    active: false,
    sunScale: 1, // solar gravity multiplier; 0 after a supernova
    sunRadius: SUN_BURN_RADIUS,
    bodies: {}, // name -> { free, alive, pos, vel, gm, radius, cooldown, pushed }
    attractors: [], // { id, type, pos: Vector3, gm, horizon }
    wormholes: [], // { id, a: Vector3, b: Vector3, mouth, gm }
    supernova: null, // { startT, speed, vaporize, boost }
  }
}

// Position and velocity of a body on its circular orbit at time t.
export function analyticState(distance, period, phase, t, pos, vel) {
  const a = orbitAngle(t, period, phase)
  const w = (Math.PI * 2) / period
  pos.set(Math.cos(a) * distance, 0, -Math.sin(a) * distance)
  vel.set(-Math.sin(a) * distance * w, 0, -Math.cos(a) * distance * w)
}

export function circularGm(distance, period) {
  const w = (Math.PI * 2) / period
  return w * w * distance ** 3
}

// Switch every living planet over to free flight, starting from where it is now.
// `extra` adds other bodies (the dwarf planets): { name, stateAt(t, pos, vel), gm }.
export function activate(physics, planets, phases, t, extra = []) {
  if (physics.active) return
  physics.active = true
  planets.forEach((p, i) => {
    const b = physics.bodies[p.name]
    if (!b.alive) return
    analyticState(p.distance, p.period, phases[i], t, b.pos, b.vel)
    b.gm = circularGm(p.distance, p.period)
    b.free = true
  })
  for (const x of extra) {
    const b = physics.bodies[x.name]
    if (!b || !b.alive) continue
    x.stateAt(t, b.pos, b.vel)
    b.gm = x.gm
    b.free = true
  }
}

// `extra`: other bodies to track (anything with a name and a radius).
export function resetPhysics(physics, planets, extra = []) {
  Object.assign(physics, createPhysics())
  ;[...planets, ...extra].forEach((p) => {
    physics.bodies[p.name] = {
      free: false,
      alive: true,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      gm: 0,
      radius: p.radius,
      cooldown: 0,
      pushed: false,
    }
  })
}

const d = new THREE.Vector3()

// Acceleration on a body at `pos` whose own solar pull is `gm`. After a
// supernova a body keeps feeling the old star's pull until the shock front
// has passed it (`pushed`): news of the collapse can't outrun the blast.
export function accel(physics, pos, gm, out, pushed = false) {
  out.set(0, 0, 0)
  const sun = physics.supernova ? (pushed ? 0 : 1) : physics.sunScale
  if (sun > 0) {
    const r2 = pos.lengthSq() + SOFTEN2
    out.addScaledVector(pos, (-gm * sun) / (r2 * Math.sqrt(r2)))
  }
  for (const a of physics.attractors) {
    d.subVectors(a.pos, pos)
    const r2 = d.lengthSq() + SOFTEN2
    const sign = a.type === 'whitehole' ? -1 : 1
    out.addScaledVector(d, (sign * a.gm) / (r2 * Math.sqrt(r2)))
  }
  for (const w of physics.wormholes) {
    for (const m of [w.a, w.b]) {
      d.subVectors(m, pos)
      const r2 = d.lengthSq() + SOFTEN2
      out.addScaledVector(d, w.gm / (r2 * Math.sqrt(r2)))
    }
  }
  return out
}

// What happens to a body at `pos` this step: swallowed by a black hole,
// burned up in the Sun, or carried through a wormhole.
// Returns { fate, where } or null. Teleports in place (pos, vel updated).
const exitOffset = new THREE.Vector3()
export function interact(physics, body, pos, vel, radius) {
  for (const a of physics.attractors) {
    if (a.type === 'blackhole' && pos.distanceTo(a.pos) < a.horizon + radius * 0.5) {
      return { fate: 'swallowed', where: a.pos }
    }
  }
  if (physics.sunScale > 0 && pos.length() < physics.sunRadius + radius * 0.3) {
    return { fate: 'burned', where: pos.clone() }
  }
  if (body.cooldown <= 0) {
    for (const w of physics.wormholes) {
      for (const [from, to] of [[w.a, w.b], [w.b, w.a]]) {
        if (pos.distanceTo(from) < w.mouth) {
          // Come out of the other mouth, moving the same way, a little clear of it.
          exitOffset.copy(vel).normalize().multiplyScalar(w.mouth * 1.3)
          pos.copy(to).add(exitOffset)
          body.cooldown = 0.08
          return { fate: 'teleported', where: to }
        }
      }
    }
  }
  return null
}

// Radius of the supernova shock front at time t (scene units).
export function shellRadius(physics, t) {
  const s = physics.supernova
  return s ? Math.max(0, (t - s.startT) * s.speed) : 0
}

const acc = new THREE.Vector3()

// Advance every free planet by dt years. `onFate(name, fate, where)` reports
// planets that are destroyed or teleported.
export function stepPlanets(physics, dt, t, onFate) {
  if (!physics.active || dt <= 0) return
  const steps = Math.min(240, Math.max(1, Math.ceil(dt / 0.0004)))
  const h = dt / steps
  const shell = shellRadius(physics, t)
  for (const [name, b] of Object.entries(physics.bodies)) {
    if (!b.free || !b.alive) continue
    // The supernova shock front reaching a planet: vaporise or fling it.
    if (physics.supernova && !b.pushed && b.pos.length() < shell) {
      b.pushed = true
      if (b.pos.length() < physics.supernova.vaporize) {
        b.alive = false
        onFate(name, 'vaporized', b.pos.clone())
        continue
      }
      b.vel.addScaledVector(b.pos.clone().normalize(), physics.supernova.boost)
    }
    for (let i = 0; i < steps; i++) {
      accel(physics, b.pos, b.gm, acc, b.pushed)
      b.vel.addScaledVector(acc, h)
      b.pos.addScaledVector(b.vel, h)
      b.cooldown -= h
      const hit = interact(physics, b, b.pos, b.vel, b.radius)
      if (hit) {
        if (hit.fate !== 'teleported') {
          b.alive = false
          onFate(name, hit.fate, hit.where)
          break
        }
        onFate(name, hit.fate, hit.where)
      }
    }
  }
}
