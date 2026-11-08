import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useSim } from './sim.js'
import { BODY_LIST, MOONS, labelDetail } from './data.js'

// Everything that gets a label. `minor` labels (small objects next to a
// planet) only appear once the camera is close, so the overview stays clean.
const LABELS = [
  ...BODY_LIST.map((b) => ({ name: b.name, detail: labelDetail(b), minor: b.name === 'Moon' })),
  { name: 'Satellite', detail: 'Orbiting Earth', minor: true },
  ...MOONS.map((m) => ({ name: m.name, detail: m.short, minor: true })),
  { name: 'Asteroid belt', detail: '2.2–3.2 AU · millions of rocks', belt: true },
]
const MINOR_RANGE = 30 // scene units from the camera

// Plain DOM labels laid over the canvas. LabelProjector (inside the Canvas)
// moves them every frame; nothing here re-renders while the scene runs.
export function Labels() {
  const sim = useSim()
  const className = ['solar-labels', sim.labelDetails ? 'with-details' : ''].join(' ')
  return (
    <div className={className} style={{ display: sim.showLabels ? undefined : 'none' }} aria-hidden="true">
      {LABELS.map(({ name, detail, belt }) => (
        <span
          key={name}
          className={belt ? 'solar-label belt' : 'solar-label'}
          ref={(el) => {
            if (el) sim.labelEls.current[name] = el
            else delete sim.labelEls.current[name]
          }}
        >
          <b>{name}</b>
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

  useFrame(() => {
    if (!sim.showLabels) return
    const gone = sim.destroyedRef.current
    const eclipse = !!sim.event.current
    for (const { name, minor, belt } of LABELS) {
      const el = sim.labelEls.current[name]
      const body = sim.bodies.current[name]
      if (!el || !body) continue
      body.object.getWorldPosition(v)
      const hidden =
        eclipse ||
        gone.has(name) ||
        (name === 'Satellite' && gone.has('Earth')) ||
        (belt && (!sim.showBelt || sim.physics.current.active)) ||
        (minor && v.distanceTo(camera.position) > MINOR_RANGE)
      v.y += body.radius + 1
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
