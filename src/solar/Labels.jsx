import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useSim } from './sim.js'
import { SUN, PLANETS, COMET } from './data.js'

const NAMES = [SUN.name, ...PLANETS.map((p) => p.name), COMET.name]

// Plain DOM labels laid over the canvas. LabelProjector (inside the Canvas)
// moves them every frame; nothing here re-renders while the scene runs.
export function Labels() {
  const sim = useSim()
  return (
    <div className="solar-labels" style={{ display: sim.showLabels ? undefined : 'none' }} aria-hidden="true">
      {NAMES.map((name) => (
        <span
          key={name}
          className="solar-label"
          ref={(el) => {
            if (el) sim.labelEls.current[name] = el
            else delete sim.labelEls.current[name]
          }}
        >
          {name}
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
    for (const name of NAMES) {
      const el = sim.labelEls.current[name]
      const body = sim.bodies.current[name]
      if (!el || !body) continue
      body.object.getWorldPosition(v)
      v.y += body.radius + 1
      v.project(camera)
      if (v.z > 1 || v.z < -1) {
        el.style.visibility = 'hidden' // behind the camera
        continue
      }
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      el.style.visibility = 'visible'
      el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
    }
  })
  return null
}
