import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { useSim, useSplineGeometry, orbitAngle, SPIN_SCALE } from './sim.js'
import { planetTexture, ringTexture, glowTexture, rng } from './textures.js'
import { SUN, ASTEROID_BELT, COMET, SPLINE_PATH_POINTS } from './data.js'

const DEG = Math.PI / 180

// Pointer handlers shared by everything clickable.
function useSelectable(name) {
  const sim = useSim()
  return {
    onClick: (e) => {
      e.stopPropagation()
      sim.select(name)
    },
    onPointerOver: (e) => {
      e.stopPropagation()
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      document.body.style.cursor = ''
    },
  }
}

export function Sun() {
  const { sphere, sphereRadius } = useSplineGeometry()
  const sim = useSim()
  const ref = useRef()
  const handlers = useSelectable(SUN.name)
  const map = useMemo(
    () => planetTexture({ name: 'Sun', texture: 'rocky', colors: ['#ffb238', '#ff8a1f', '#ffd36b', '#ff6a00'] }),
    [],
  )
  useFrame(() => {
    ref.current.rotation.y = sim.time.current * 0.4
  })
  return (
    <group ref={(o) => sim.register(SUN.name, o, SUN.radius)}>
      <mesh ref={ref} geometry={sphere} scale={SUN.radius / sphereRadius} {...handlers}>
        <meshBasicMaterial map={map} color="#ffe2a8" toneMapped={false} />
      </mesh>
      <sprite scale={SUN.radius * 5.5}>
        <spriteMaterial
          map={glowTexture()}
          color={SUN.glowColor}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      {/* decay 0: brightness doesn't fall off, so Neptune is still lit */}
      <pointLight intensity={2.6} decay={0} color="#fff3e0" />
    </group>
  )
}

export function OrbitLine({ radius }) {
  const sim = useSim()
  const points = useMemo(() => {
    const pts = []
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2
      pts.push([Math.cos(a) * radius, 0, -Math.sin(a) * radius])
    }
    return pts
  }, [radius])
  if (!sim.showOrbits) return null
  return <Line points={points} color="#9fb4ff" transparent opacity={0.18} lineWidth={1} />
}

export function Planet({ planet, phase }) {
  const { sphere, sphereRadius } = useSplineGeometry()
  const sim = useSim()
  const orbit = useRef()
  const spin = useRef()
  const handlers = useSelectable(planet.name)
  const map = useMemo(() => planetTexture(planet), [planet])

  useFrame(() => {
    const t = sim.time.current
    const a = orbitAngle(t, planet.period, phase)
    orbit.current.position.set(Math.cos(a) * planet.distance, 0, -Math.sin(a) * planet.distance)
    spin.current.rotation.y = (Math.PI * 2 * t * 365.25 * SPIN_SCALE) / planet.day
  })

  return (
    <group
      ref={(o) => {
        orbit.current = o
        sim.register(planet.name, o, planet.radius)
      }}
    >
      <group rotation-z={planet.tilt * DEG}>
        <mesh ref={spin} geometry={sphere} scale={planet.radius / sphereRadius} {...handlers}>
          <meshStandardMaterial map={map} roughness={0.85} metalness={0} />
        </mesh>
        {planet.ring && <Ring ring={planet.ring} />}
      </group>
      {planet.moon && <Moon moon={planet.moon} />}
      {planet.satellite && <Satellite satellite={planet.satellite} />}
    </group>
  )
}

function Ring({ ring }) {
  const map = useMemo(() => ringTexture(ring), [ring])
  return (
    <mesh rotation-x={-Math.PI / 2}>
      <ringGeometry args={[ring.inner, ring.outer, 128]} />
      <meshStandardMaterial
        map={map}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        roughness={1}
      />
    </mesh>
  )
}

function Moon({ moon }) {
  const { sphere, sphereRadius } = useSplineGeometry()
  const sim = useSim()
  const ref = useRef()
  useFrame(() => {
    const a = orbitAngle(sim.time.current, moon.period)
    ref.current.position.set(Math.cos(a) * moon.distance, Math.sin(a) * 0.15, -Math.sin(a) * moon.distance)
  })
  return (
    <mesh ref={ref} geometry={sphere} scale={moon.radius / sphereRadius}>
      <meshStandardMaterial color={moon.color} roughness={1} />
    </mesh>
  )
}

// The Spline Cube, reused as a little satellite with solar panels, on a
// tilted orbit around Earth.
function Satellite({ satellite }) {
  const { cube, cubeSize } = useSplineGeometry()
  const sim = useSim()
  const ref = useRef()
  const s = satellite.size
  useFrame(() => {
    const a = orbitAngle(sim.time.current, satellite.period)
    const d = satellite.distance
    ref.current.position.set(Math.cos(a) * d, Math.sin(a) * d * 0.5, -Math.sin(a) * d * 0.85)
    ref.current.rotation.y = a
  })
  return (
    <group ref={ref}>
      <mesh geometry={cube} scale={s / cubeSize}>
        <meshStandardMaterial color="#d9dde4" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[s * 1.6, 0, 0]}>
        <boxGeometry args={[s * 2, s * 0.08, s * 0.9]} />
        <meshStandardMaterial color="#2b4d9b" metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[-s * 1.6, 0, 0]}>
        <boxGeometry args={[s * 2, s * 0.08, s * 0.9]} />
        <meshStandardMaterial color="#2b4d9b" metalness={0.3} roughness={0.4} />
      </mesh>
    </group>
  )
}

// Hundreds of copies of the Spline Cube, drawn in a single instanced call.
export function AsteroidBelt() {
  const { cube, cubeSize } = useSplineGeometry()
  const sim = useSim()
  const mesh = useRef()
  const group = useRef()
  const { count, inner, outer, thickness, size } = ASTEROID_BELT

  useLayoutEffect(() => {
    const random = rng(7)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const p = new THREE.Vector3()
    const sc = new THREE.Vector3()
    for (let i = 0; i < count; i++) {
      const a = random() * Math.PI * 2
      const r = inner + (outer - inner) * Math.sqrt(random())
      p.set(Math.cos(a) * r, (random() - 0.5) * thickness, -Math.sin(a) * r)
      e.set(random() * Math.PI, random() * Math.PI, random() * Math.PI)
      q.setFromEuler(e)
      const k = (size[0] + (size[1] - size[0]) * random() ** 2) / cubeSize
      sc.set(k * (0.6 + random() * 0.8), k * (0.6 + random() * 0.8), k * (0.6 + random() * 0.8))
      m.compose(p, q, sc)
      mesh.current.setMatrixAt(i, m)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  }, [count, inner, outer, thickness, size, cubeSize])

  useFrame(() => {
    // The belt as a whole turns at the period of its middle (~4.6 years).
    group.current.rotation.y = orbitAngle(sim.time.current, 4.6)
  })

  return (
    <group ref={group}>
      <instancedMesh ref={mesh} args={[cube, undefined, count]}>
        <meshStandardMaterial color="#8a7f74" roughness={1} />
      </instancedMesh>
    </group>
  )
}

// Comet riding the closed Path from the Spline file. The path mesh and the
// curve the comet follows share one local frame (Spline units), so the comet
// stays exactly on the drawn track. The head and tail are drawn in world
// space so the tail can always point away from the Sun, as real comet tails do.
export function Comet() {
  const { path, sphere, sphereRadius } = useSplineGeometry()
  const sim = useSim()
  const anchor = useRef()
  const head = useRef()
  const tail = useRef()
  const handlers = useSelectable(COMET.name)

  const curve = useMemo(() => {
    const pts = SPLINE_PATH_POINTS.map((p) => new THREE.Vector3(...p))
    const c = new THREE.CurvePath()
    pts.forEach((p, i) => c.add(new THREE.LineCurve3(p, pts[(i + 1) % pts.length])))
    return c
  }, [])

  const tailGeometry = useMemo(() => {
    // Open cone with its tip at the origin, opening along -Y over one unit.
    const g = new THREE.ConeGeometry(0.55, 1, 32, 1, true)
    g.translate(0, -0.5, 0)
    return g
  }, [])

  const tailTexture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 128
    const g = c.getContext('2d')
    const grad = g.createLinearGradient(0, 0, 0, 128)
    grad.addColorStop(0, 'rgba(255,255,255,0.9)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 4, 128)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])

  const tmp = useMemo(() => ({ w: new THREE.Vector3(), dir: new THREE.Vector3(), down: new THREE.Vector3(0, -1, 0) }), [])

  useFrame(() => {
    const u = (((sim.time.current / COMET.period) % 1) + 1) % 1
    anchor.current.position.copy(curve.getPointAt(u))
    anchor.current.updateWorldMatrix(true, false)
    anchor.current.getWorldPosition(tmp.w)
    head.current.position.copy(tmp.w)

    // Tail: away from the Sun, longer the closer the comet gets.
    const dist = tmp.w.length()
    tmp.dir.copy(tmp.w).normalize()
    tail.current.quaternion.setFromUnitVectors(tmp.down, tmp.dir)
    const len = THREE.MathUtils.clamp(260 / (dist + 8), 1.2, 14)
    const width = THREE.MathUtils.clamp(len * 0.18, 0.4, 1.6)
    tail.current.scale.set(width, len, width)
  })

  const s = COMET.scale
  return (
    <>
      <group position={COMET.offset} rotation={COMET.rotation} scale={s}>
        <group position={COMET.anchor.map((v) => -v)}>
          {sim.showOrbits && (
            <mesh geometry={path}>
              <meshBasicMaterial color="#8fd3ff" transparent opacity={0.35} depthWrite={false} />
            </mesh>
          )}
          <object3D ref={anchor} />
        </group>
      </group>

      <group
        ref={(o) => {
          head.current = o
          sim.register(COMET.name, o, COMET.radius * 3)
        }}
      >
        <mesh geometry={sphere} scale={COMET.radius / sphereRadius} {...handlers}>
          <meshBasicMaterial color={COMET.color} toneMapped={false} />
        </mesh>
        <sprite scale={COMET.radius * 7}>
          <spriteMaterial
            map={glowTexture()}
            color="#9fe0ff"
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
        <mesh ref={tail} geometry={tailGeometry}>
          <meshBasicMaterial
            map={tailTexture}
            color="#a8e6ff"
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      </group>
    </>
  )
}
