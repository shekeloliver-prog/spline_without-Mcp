// The "Sizes" view: the planets, the Moon and Pluto side by side at their
// true relative sizes, next to the edge of a Sun drawn at the same scale.
// It is parked far behind the Sun (SIZE_LINEUP.center), so the real Sun lights
// it from the front and it never gets in the way of the solar system.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSim, useSplineGeometry } from './sim.js'
import { useMaps } from './textures.js'
import { Ring } from './Bodies.jsx'
import { PLANETS, SIZE_LINEUP } from './data.js'

const MAP_OF = Object.fromEntries(PLANETS.map((p) => [p.name, p.map]))
MAP_OF.Moon = 'moon'

function LineupBody({ name, radius, x }) {
  const { sphere, sphereRadius } = useSplineGeometry()
  const sim = useSim()
  const key = MAP_OF[name]
  const maps = useMaps(...(key ? [key] : ['moon']))
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: key ? maps[key] : maps.moon,
        color: key ? '#ffffff' : '#d6bfa2', // Pluto: the lunar map tinted tan
        roughness: 0.95,
      }),
    [key, maps],
  )
  const [cx, cy, cz] = SIZE_LINEUP.center
  return (
    <group
      position={[x, cy, cz]}
      ref={(o) => sim.register(`size:${name}`, o, radius)}
      rotation-x={name === 'Saturn' ? 0.42 : 0}
    >
      <mesh geometry={sphere} scale={radius / sphereRadius} material={material} />
      {name === 'Saturn' && <Ring ring={{ inner: radius * 1.24, outer: radius * 2.27 }} />}
    </group>
  )
}

export function SizeLineup() {
  const { sphere, sphereRadius } = useSplineGeometry()
  const sim = useSim()
  const { sun } = useMaps('sun')
  const { unit, gap, bodies, center } = SIZE_LINEUP
  // Lay the bodies out left to right, edge to edge with a fixed gap,
  // centred on the line-up's centre.
  const placed = useMemo(() => {
    const radii = bodies.map(([, r]) => r * unit)
    // Saturn takes up the width of its rings (2.27 × its radius) on each side.
    // Small worlds get a minimum slot so their labels don't run together.
    const halfWidths = bodies.map(([name], i) => (name === 'Saturn' ? radii[i] * 2.27 : Math.max(radii[i], 2.4)))
    const width = halfWidths.reduce((w, h) => w + 2 * h, 0) + gap * (radii.length - 1)
    let cursor = center[0] + 8 - width / 2
    return bodies.map(([name], i) => {
      const x = cursor + halfWidths[i]
      cursor += 2 * halfWidths[i] + gap
      return { name, radius: radii[i], x }
    })
  }, [bodies, unit, gap, center])
  const sunR = SIZE_LINEUP.sun * unit
  const sunX = placed[0].x - placed[0].radius - gap * 1.5 - sunR
  const sunColor = useMemo(() => new THREE.Color(1.25, 1.05, 0.85), [])
  // Only drawn in the Sizes view (or while the camera is near it), so its
  // giant Sun never shows up behind the real solar system.
  const group = useRef()
  const near = useMemo(() => new THREE.Vector3(...center), [center])
  useFrame(({ camera }) => {
    group.current.visible = sim.view.current === 'sizes' || camera.position.distanceTo(near) < 260
  })
  return (
    <group ref={group} visible={false}>
      {/* The Sun at the same scale: only its edge fits in the frame */}
      <mesh geometry={sphere} scale={sunR / sphereRadius} position={[sunX, center[1], center[2] - 4]}>
        <meshBasicMaterial map={sun} color={sunColor} toneMapped={false} />
      </mesh>
      {/* label anchor near the Sun's visible edge */}
      <object3D position={[sunX + sunR * 0.93, sunR * 0.3, center[2] - 4]} ref={(o) => sim.register('size:Sun', o, 1)} />
      {placed.map((b) => (
        <LineupBody key={b.name} {...b} />
      ))}
    </group>
  )
}
