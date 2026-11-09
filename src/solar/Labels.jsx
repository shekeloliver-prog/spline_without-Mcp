import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useSim } from './sim.js'
import { BODY_LIST, MOONS, SIZE_LINEUP, SPACECRAFT, PLACES, labelDetail } from './data.js'

// Everything that gets a label. `minor` labels (small objects next to a
// planet) only appear once the camera is close, so the overview stays clean.
const LABELS = [
  // (spacecraft near Earth are minor: they'd crowd Earth's label from afar)
  ...BODY_LIST.map((b) => ({
    name: b.name,
    detail: labelDetail(b),
    minor: b.name === 'Moon' || SPACECRAFT.some((c) => c.name === b.name && c.orbit !== 'escape'),
  })),
  { name: 'Habitable zone', detail: 'where liquid water could exist', zone: true },
  ...PLACES.map((p) => ({ name: p.name, detail: p.short, place: true })),
  { name: 'Satellite', detail: 'Orbiting Earth', minor: true },
  ...MOONS.map((m) => ({ name: m.name, detail: m.short, minor: true })),
  { name: 'Asteroid belt', detail: '2.2–3.2 AU · millions of rocks', belt: true },
  { name: 'Kuiper belt', detail: '30–50 AU · icy leftovers', belt: true },
  // Size line-up (only shown in the Sizes view)
  { name: 'size:Sun', title: 'Sun', detail: `${SIZE_LINEUP.sun} × Earth`, sizes: true },
  ...SIZE_LINEUP.bodies.map(([n, r]) => ({ name: `size:${n}`, title: n, detail: `${r} × Earth`, sizes: true })),
]
const MINOR_RANGE = 30 // scene units from the camera
const PLACE_RANGE = 7 // place labels only when this close to the pin

// A place's label shows when the camera is close and the place is on the
// side of Earth facing it.
const _n = new THREE.Vector3()
const _c = new THREE.Vector3()
function placeFacing(pin, earthPos, camPos) {
  if (pin.distanceTo(camPos) > PLACE_RANGE) return false
  _n.copy(pin).sub(earthPos).normalize()
  _c.copy(camPos).sub(pin).normalize()
  return _n.dot(_c) > 0.2
}

// Plain DOM labels laid over the canvas. LabelProjector (inside the Canvas)
// moves them every frame; nothing here re-renders while the scene runs.
export function Labels() {
  const sim = useSim()
  const className = ['solar-labels', sim.labelDetails ? 'with-details' : ''].join(' ')
  return (
    <div className={className} style={{ display: sim.showLabels ? undefined : 'none' }} aria-hidden="true">
      {LABELS.map(({ name, title, detail, belt, sizes, zone }) => (
        <span
          key={name}
          className={belt || zone ? 'solar-label belt' : sizes ? 'solar-label sizes' : 'solar-label'}
          ref={(el) => {
            if (el) sim.labelEls.current[name] = el
            else delete sim.labelEls.current[name]
          }}
        >
          <b>{title ?? name}</b>
          <small>{detail}</small>
        </span>
      ))}
    </div>
  )
}

export function LabelProjector() {
  const sim = useSim()
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const v = useMemo(() => new THREE.Vector3(), [])
  const earthPos = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (!sim.showLabels) return
    const gone = sim.destroyedRef.current
    const eclipse = !!sim.event.current
    const inSizes = sim.view.current === 'sizes' && !sim.selected.current
    const earth = sim.bodies.current.Earth
    if (earth) earth.object.getWorldPosition(earthPos)
    for (const { name, minor, belt, sizes, zone, place } of LABELS) {
      const el = sim.labelEls.current[name]
      const body = sim.bodies.current[name]
      if (!el || !body) continue
      body.object.getWorldPosition(v)
      const hidden =
        eclipse ||
        (sizes ? !inSizes : inSizes) ||
        (zone && !sim.showZone) ||
        (place && (!sim.showPlaces || gone.has('Earth') || !placeFacing(v, earthPos, camera.position))) ||
        gone.has(name) ||
        (name === 'Satellite' && gone.has('Earth')) ||
        (belt && (!sim.showBelt || sim.physics.current.active)) ||
        (minor && v.distanceTo(camera.position) > MINOR_RANGE)
      v.y += place ? 0.06 : body.radius + 1
      v.project(camera)
      if (hidden || v.z > 1 || v.z < -1) {
        el.style.visibility = 'hidden'
        continue
      }
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      el.style.visibility = 'visible'
      el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      el.classList.toggle('selected', sim.selected.current === name)
    }
  })
  return null
}
