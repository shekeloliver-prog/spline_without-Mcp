// Spacecraft and the habitable zone.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { useSim, useSplineGeometry, orbitAngle, MOVE_PRIORITY } from './sim.js'
import { glowTexture } from './textures.js'
import { keplerPosition } from './orbits.js'
import { auToScene, HABITABLE_ZONE, MOON_TIME_SLOW, PLACES } from './data.js'

const DEG = Math.PI / 180
const UP = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)

// Ecliptic longitude/latitude (degrees) -> unit vector in scene axes
// (ecliptic x -> X, y -> -Z, north -> +Y; same convention as the orbits).
function eclipticDir(lon, lat) {
  const l = lon * DEG
  const b = lat * DEG
  return new THREE.Vector3(Math.cos(b) * Math.cos(l), Math.sin(b), -Math.cos(b) * Math.sin(l))
}

// Small models, each built around the Spline Cube.
function CraftModel({ craft }) {
  const { cube, cubeSize } = useSplineGeometry()
  const s = craft.size
  const body = s / cubeSize
  if (craft.kind === 'station') {
    // ISS: a long truss with four pairs of solar wings and a module stack.
    return (
      <group>
        <mesh geometry={cube} scale={[body * 2.4, body * 0.7, body * 0.7]}>
          <meshStandardMaterial color="#d9dde4" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[s * 4.2, s * 0.08, s * 0.08]} />
          <meshStandardMaterial color="#9aa0aa" metalness={0.6} roughness={0.4} />
        </mesh>
        {[-1.8, -1.2, 1.2, 1.8].map((x) => (
          <mesh key={x} position={[x * s, 0, 0]}>
            <boxGeometry args={[s * 0.45, s * 0.02, s * 1.9]} />
            <meshStandardMaterial color="#b0782a" metalness={0.4} roughness={0.35} />
          </mesh>
        ))}
      </group>
    )
  }
  if (craft.kind === 'telescope') {
    // James Webb: a gold hexagonal mirror above a big kite-shaped sunshield.
    return (
      <group>
        <mesh rotation-x={Math.PI / 2} position={[0, s * 0.5, 0]}>
          <cylinderGeometry args={[s * 0.9, s * 0.9, s * 0.08, 6]} />
          <meshStandardMaterial color="#e1b54a" metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} scale={[2.2, 1.4, 1]}>
          <circleGeometry args={[s, 4]} />
          <meshStandardMaterial color="#c9a9c9" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={cube} scale={body * 0.5} position={[0, -s * 0.3, 0]}>
          <meshStandardMaterial color="#d4a23a" metalness={0.7} roughness={0.35} />
        </mesh>
      </group>
    )
  }
  // Probes: the Cube as the bus, a white dish antenna, and a boom.
  const isParker = craft.name.startsWith('Parker')
  return (
    <group>
      <mesh geometry={cube} scale={body * 0.7}>
        <meshStandardMaterial color="#c79a3a" metalness={0.7} roughness={0.32} />
      </mesh>
      {isParker ? (
        // Parker's heat shield faces the Sun.
        <mesh position={[0, s * 0.55, 0]}>
          <cylinderGeometry args={[s * 0.75, s * 0.75, s * 0.12, 24]} />
          <meshStandardMaterial color="#f4f1ea" roughness={0.9} />
        </mesh>
      ) : (
        <mesh position={[0, s * 0.5, 0]} rotation-x={Math.PI}>
          <coneGeometry args={[s * 0.85, s * 0.35, 32, 1, true]} />
          <meshStandardMaterial color="#f1efe9" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh position={[s * 1.1, 0, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[s * 0.02, s * 0.02, s * 1.6, 6]} />
        <meshStandardMaterial color="#8d8a84" />
      </mesh>
    </group>
  )
}

export function Spacecraft({ craft }) {
  const sim = useSim()
  const ref = useRef()
  const v = useMemo(() => ({ earth: new THREE.Vector3(), dir: new THREE.Vector3(), tmp: new THREE.Vector3() }), [])
  const escapeDir = useMemo(
    () => (craft.orbit === 'escape' ? eclipticDir(craft.lon, craft.lat) : null),
    [craft],
  )
  // Escape trajectories: a faint line from the inner system out to where
  // the probe starts.
  const track = useMemo(() => {
    if (!escapeDir) return null
    return [escapeDir.clone().multiplyScalar(12).toArray(), escapeDir.clone().multiplyScalar(auToScene(craft.au)).toArray()]
  }, [escapeDir, craft])

  const handlers = {
    onClick: (e) => {
      e.stopPropagation()
      if (e.delta > 4) return
      sim.bodyClick(craft.name, e.point)
    },
    onPointerOver: (e) => {
      e.stopPropagation()
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      document.body.style.cursor = ''
    },
  }

  useFrame(() => {
    const t = sim.time.current
    const o = ref.current
    const earth = sim.bodies.current.Earth
    if (craft.orbit === 'earth' && earth) {
      // A fast low orbit, slowed like the moons, tilted by its inclination.
      earth.object.getWorldPosition(v.earth)
      const a = orbitAngle(t, (1 * MOON_TIME_SLOW) / 365.25)
      v.tmp.set(Math.cos(a) * craft.distance, 0, -Math.sin(a) * craft.distance).applyAxisAngle(X_AXIS, craft.incl * DEG)
      o.position.copy(v.earth).add(v.tmp)
      o.rotation.y = a
    } else if (craft.orbit === 'l2' && earth) {
      // Beyond Earth on the Sun–Earth line, looping round the L2 point.
      earth.object.getWorldPosition(v.earth)
      v.dir.copy(v.earth).normalize()
      const a = orbitAngle(t, 0.5)
      v.tmp.crossVectors(v.dir, UP).normalize().multiplyScalar(Math.cos(a) * craft.halo)
      o.position.copy(v.earth).addScaledVector(v.dir, craft.distance).add(v.tmp)
      o.position.y += Math.sin(a) * craft.halo
      o.lookAt(0, 0, 0) // sunshield towards the Sun
    } else if (craft.orbit === 'kepler') {
      keplerPosition(craft.elements, t, o.position)
      o.lookAt(0, 0, 0)
      o.rotateX(Math.PI / 2) // heat shield (local +Y) towards the Sun
    } else if (craft.orbit === 'escape') {
      const r = auToScene(craft.au + craft.auPerYear * Math.max(0, t))
      o.position.copy(escapeDir).multiplyScalar(r)
      o.lookAt(0, 0, 0)
      o.rotateX(Math.PI / 2) // dish (local +Y) back towards Earth
    }
    o.visible = !sim.destroyedRef.current.has(craft.name)
  }, MOVE_PRIORITY)

  return (
    <>
      {track && sim.showOrbits && (
        <Line points={track} color="#e8c27a" transparent opacity={0.14} lineWidth={1} dashed dashSize={3} gapSize={2} />
      )}
      <group
        ref={(o) => {
          ref.current = o
          sim.register(craft.name, o, Math.max(craft.size, 0.25))
        }}
      >
        <group {...handlers}>
          <CraftModel craft={craft} />
        </group>
        {/* A faint glint so distant probes can be spotted and clicked */}
        <sprite scale={craft.orbit === 'escape' ? 3 : 0.9}>
          <spriteMaterial map={glowTexture()} color="#ffe2a8" opacity={0.6} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      </group>
    </>
  )
}

// The habitable zone: a faint green band where liquid water could exist.
export function HabitableZone() {
  const sim = useSim()
  const inner = auToScene(HABITABLE_ZONE.inner)
  const outer = auToScene(HABITABLE_ZONE.outer)
  return (
    <group visible={sim.showZone}>
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[inner, outer, 160, 1]} />
        <meshBasicMaterial color="#3fd17a" transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <object3D position={[0, 0, -(inner + outer) / 2]} ref={(o) => sim.register('Habitable zone', o, 0.6)} />
    </group>
  )
}

// Pins for famous places, on Earth's surface at their real latitude and
// longitude. Rendered inside Earth's spin group, so they turn with it. On
// the Spline sphere v runs south to north (+Y) and u runs west to east, so
// (lat, lon) sits along (cos lat·cos lon, sin lat, −cos lat·sin lon), which
// lines up with the NASA map.
export function EarthPlaces({ radius }) {
  const sim = useSim()
  const pins = useMemo(
    () =>
      PLACES.map((p) => {
        const la = p.lat * DEG
        const lo = p.lon * DEG
        return { ...p, pos: new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)).multiplyScalar(radius * 1.004) }
      }),
    [radius],
  )
  const color = useMemo(() => new THREE.Color(2.2, 1.5, 0.6), [])
  return (
    <group visible={sim.showPlaces}>
      {pins.map((p) => (
        <group
          key={p.name}
          position={p.pos}
          ref={(o) => sim.register(p.name, o, 0.03, { place: true })}
          onClick={(e) => {
            e.stopPropagation()
            if (e.delta > 4 || !sim.showPlaces) return
            sim.bodyClick(p.name, e.point)
          }}
          onPointerOver={(e) => {
            if (!sim.showPlaces) return
            e.stopPropagation()
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            document.body.style.cursor = ''
          }}
        >
          <mesh>
            <sphereGeometry args={[radius * 0.012, 12, 8]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <sprite scale={radius * 0.07}>
            <spriteMaterial map={glowTexture()} color="#ffcf7a" opacity={0.5} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
        </group>
      ))}
    </group>
  )
}
