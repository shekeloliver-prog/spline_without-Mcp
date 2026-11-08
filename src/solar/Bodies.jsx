import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { useSim, useSplineGeometry, orbitAngle, SPIN_SCALE } from './sim.js'
import { glowTexture, rng, useMaps } from './textures.js'
import { makeRock } from './rocks.js'
import { patchNightLights, atmosphereMaterial, tailMaterial } from './shaders.js'
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

function Glow({ scale, color, opacity = 1 }) {
  return (
    <sprite scale={scale}>
      <spriteMaterial
        map={glowTexture()}
        color={color}
        opacity={opacity}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </sprite>
  )
}

// Milky Way panorama on a huge inside-out sphere, dimmed so it reads as
// background starlight rather than a painted wall.
export function Sky() {
  const { sphere, sphereRadius } = useSplineGeometry()
  const { milkyWay } = useMaps('milkyWay')
  return (
    <mesh geometry={sphere} scale={1500 / sphereRadius} rotation={[0.5, 0, 0.35]}>
      <meshBasicMaterial map={milkyWay} side={THREE.BackSide} color="#c4c8d4" depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

export function Sun() {
  const { sphere, sphereRadius } = useSplineGeometry()
  const sim = useSim()
  const ref = useRef()
  const handlers = useSelectable(SUN.name)
  const { sun } = useMaps('sun')
  // Brighter than white on purpose: values above 1 are what the bloom picks up.
  const hot = useMemo(() => new THREE.Color(2.2, 1.75, 1.3), [])
  useFrame(() => {
    ref.current.rotation.y = sim.time.current * 0.25
  })
  return (
    <group ref={(o) => sim.register(SUN.name, o, SUN.radius)}>
      <mesh ref={ref} geometry={sphere} scale={SUN.radius / sphereRadius} {...handlers}>
        <meshBasicMaterial map={sun} color={hot} toneMapped={false} />
      </mesh>
      <Glow scale={SUN.radius * 3.2} color={SUN.glowColor} opacity={0.55} />
      <Glow scale={SUN.radius * 7} color="#ff9b45" opacity={0.18} />
      {/* decay 0: brightness doesn't fall off, so Neptune is still lit */}
      <pointLight intensity={3.2} decay={0} color="#fff4e6" />
    </group>
  )
}

export function OrbitLine({ radius }) {
  const sim = useSim()
  const points = useMemo(() => {
    const pts = []
    for (let i = 0; i <= 200; i++) {
      const a = (i / 200) * Math.PI * 2
      pts.push([Math.cos(a) * radius, 0, -Math.sin(a) * radius])
    }
    return pts
  }, [radius])
  if (!sim.showOrbits) return null
  return <Line points={points} color="#7f8db0" transparent opacity={0.1} lineWidth={1} />
}

function PlanetSurface({ planet, scale }) {
  const { sphere } = useSplineGeometry()
  const maps = useMaps(planet.map)
  return (
    <mesh geometry={sphere} scale={scale}>
      <meshStandardMaterial map={maps[planet.map]} roughness={0.95} metalness={0} />
    </mesh>
  )
}

// Earth gets the full treatment: NASA day map, ocean glint from a specular
// mask, city lights on the night side, a moving cloud layer and a thin
// blue atmosphere at the limb.
function EarthSurface({ scale }) {
  const { sphere } = useSplineGeometry()
  const sim = useSim()
  const clouds = useRef()
  const maps = useMaps('earth', 'earthSpecular', 'earthNight', 'earthClouds')
  const surface = useMemo(
    () =>
      patchNightLights(
        new THREE.MeshPhongMaterial({
          map: maps.earth,
          specularMap: maps.earthSpecular,
          specular: new THREE.Color('#5a6f88'),
          shininess: 22,
          emissiveMap: maps.earthNight,
          emissive: new THREE.Color('#ffd7a0'),
          emissiveIntensity: 1.4,
        }),
      ),
    [maps],
  )
  const atmosphere = useMemo(() => atmosphereMaterial('#5aa8ff', 1.4), [])
  useFrame(() => {
    clouds.current.rotation.y = sim.time.current * 3
  })
  return (
    <>
      <mesh geometry={sphere} scale={scale} material={surface} />
      <mesh ref={clouds} geometry={sphere} scale={scale * 1.012}>
        <meshStandardMaterial color="#ffffff" alphaMap={maps.earthClouds} transparent depthWrite={false} roughness={1} />
      </mesh>
      <mesh geometry={sphere} scale={scale * 1.035} material={atmosphere} />
    </>
  )
}

export function Planet({ planet, phase }) {
  const { sphereRadius } = useSplineGeometry()
  const sim = useSim()
  const orbit = useRef()
  const spin = useRef()
  const handlers = useSelectable(planet.name)
  const scale = planet.radius / sphereRadius

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
        <group ref={spin} {...handlers}>
          {planet.name === 'Earth' ? <EarthSurface scale={scale} /> : <PlanetSurface planet={planet} scale={scale} />}
        </group>
        {planet.ring && <Ring ring={planet.ring} />}
      </group>
      {planet.moon && <Moon moon={planet.moon} />}
      {planet.satellite && <Satellite satellite={planet.satellite} />}
    </group>
  )
}

// Saturn's rings from a real radial colour/opacity profile. The texture is a
// strip running from the inner edge to the outer edge, so the ring's UVs are
// rewritten to "distance from centre" instead of RingGeometry's planar UVs.
function Ring({ ring }) {
  const { saturnRing } = useMaps('saturnRing')
  const geometry = useMemo(() => {
    const g = new THREE.RingGeometry(ring.inner, ring.outer, 180, 1)
    const pos = g.attributes.position
    const uv = g.attributes.uv
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      uv.setXY(i, (v.length() - ring.inner) / (ring.outer - ring.inner), 0.5)
    }
    return g
  }, [ring])
  return (
    <mesh geometry={geometry} rotation-x={-Math.PI / 2}>
      <meshStandardMaterial
        map={saturnRing}
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
  const { moon: map } = useMaps('moon')
  const sim = useSim()
  const ref = useRef()
  useFrame(() => {
    const a = orbitAngle(sim.time.current, moon.period)
    ref.current.position.set(Math.cos(a) * moon.distance, Math.sin(a) * 0.15, -Math.sin(a) * moon.distance)
    ref.current.rotation.y = a + Math.PI // tidally locked: same face toward Earth
  })
  return (
    <mesh ref={ref} geometry={sphere} scale={moon.radius / sphereRadius}>
      <meshStandardMaterial map={map} roughness={1} />
    </mesh>
  )
}

// The Spline Cube as a satellite body wrapped in gold insulation foil, with
// two solar-cell wings, on a tilted orbit around Earth.
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
        <meshStandardMaterial color="#c79a3a" metalness={0.7} roughness={0.32} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[side * s * 1.7, 0, 0]}>
          <boxGeometry args={[s * 2.2, s * 0.04, s * 0.8]} />
          <meshStandardMaterial color="#14213d" metalness={0.5} roughness={0.25} />
        </mesh>
      ))}
    </group>
  )
}

const ROCK_SEEDS = [11, 23, 37]

// The Spline Cube, roughened into three rock shapes, instanced ~1,400 times.
export function AsteroidBelt() {
  const { cube } = useSplineGeometry()
  const sim = useSim()
  const group = useRef()
  const meshes = useRef([])
  const { count, inner, outer, thickness, size } = ASTEROID_BELT
  const rocks = useMemo(() => ROCK_SEEDS.map((seed) => makeRock(cube, seed)), [cube])
  const perRock = Math.ceil(count / rocks.length)

  useLayoutEffect(() => {
    const random = rng(7)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const p = new THREE.Vector3()
    const sc = new THREE.Vector3()
    const color = new THREE.Color()
    rocks.forEach((rock, r) => {
      const mesh = meshes.current[r]
      const radius = rock.boundingSphere.radius
      for (let i = 0; i < perRock; i++) {
        const a = random() * Math.PI * 2
        // Sum of three randoms: denser in the middle of the belt.
        const d = inner + (outer - inner) * ((random() + random() + random()) / 3)
        p.set(Math.cos(a) * d, (random() - 0.5) * thickness * (0.3 + random()), -Math.sin(a) * d)
        e.set(random() * Math.PI * 2, random() * Math.PI * 2, random() * Math.PI * 2)
        q.setFromEuler(e)
        const k = (size[0] + (size[1] - size[0]) * random() ** 3) / radius
        sc.set(k * (0.7 + random() * 0.6), k * (0.6 + random() * 0.5), k * (0.7 + random() * 0.6))
        m.compose(p, q, sc)
        mesh.setMatrixAt(i, m)
        const shade = 0.55 + random() * 0.45 // carbon-dark to stony
        mesh.setColorAt(i, color.setRGB(0.42 * shade, 0.38 * shade, 0.34 * shade))
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.instanceColor.needsUpdate = true
    })
  }, [rocks, perRock, inner, outer, thickness, size])

  useFrame(() => {
    // The belt as a whole turns at the period of its middle (~4.6 years).
    group.current.rotation.y = orbitAngle(sim.time.current, 4.6)
  })

  return (
    <group ref={group}>
      {rocks.map((g, r) => (
        <instancedMesh key={r} ref={(el) => (meshes.current[r] = el)} args={[g, undefined, perRock]}>
          <meshStandardMaterial roughness={1} metalness={0} />
        </instancedMesh>
      ))}
    </group>
  )
}

// Comet riding the closed Path from the Spline file: its control points (in
// Spline units) define both the hairline track and the curve the comet
// follows, so the comet stays exactly on the drawn track. Head and tails are drawn in world space:
// the blue ion tail points straight away from the Sun, and the broader dust
// tail curves back along the orbit, as on real comets.
export function Comet() {
  const { sphere, sphereRadius } = useSplineGeometry()
  const sim = useSim()
  const anchor = useRef()
  const head = useRef()
  const ionTail = useRef()
  const dustTail = useRef()
  const handlers = useSelectable(COMET.name)

  const curve = useMemo(() => {
    const pts = SPLINE_PATH_POINTS.map((p) => new THREE.Vector3(...p))
    const c = new THREE.CurvePath()
    pts.forEach((p, i) => c.add(new THREE.LineCurve3(p, pts[(i + 1) % pts.length])))
    return c
  }, [])
  // The track, drawn as a hairline through the Path's own points.
  const track = useMemo(() => {
    const pts = SPLINE_PATH_POINTS.map((p) => [...p])
    return [...pts, pts[0]]
  }, [])

  const tailGeometry = useMemo(() => {
    const g = new THREE.ConeGeometry(0.5, 1, 40, 8, true)
    g.translate(0, -0.5, 0) // tip at the origin, opening along -Y
    return g
  }, [])
  const ionMaterial = useMemo(() => tailMaterial('#7fb8ff', 0.9), [])
  const dustMaterial = useMemo(() => tailMaterial('#fff1d6', 0.85), [])

  const tmp = useMemo(
    () => ({
      w: new THREE.Vector3(),
      prev: new THREE.Vector3(),
      anti: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      dust: new THREE.Vector3(),
      down: new THREE.Vector3(0, -1, 0),
    }),
    [],
  )

  useFrame(() => {
    const u = (((sim.time.current / COMET.period) % 1) + 1) % 1
    // Where the comet was a moment ago gives its direction of travel.
    anchor.current.position.copy(curve.getPointAt((u + 0.998) % 1))
    anchor.current.updateWorldMatrix(true, false)
    anchor.current.getWorldPosition(tmp.prev)
    anchor.current.position.copy(curve.getPointAt(u))
    anchor.current.updateWorldMatrix(true, false)
    anchor.current.getWorldPosition(tmp.w)
    head.current.position.copy(tmp.w)

    const dist = tmp.w.length()
    tmp.anti.copy(tmp.w).normalize()
    tmp.vel.copy(tmp.w).sub(tmp.prev).normalize()
    const len = THREE.MathUtils.clamp(320 / (dist + 6), 1, 22) // longer near the Sun

    ionTail.current.quaternion.setFromUnitVectors(tmp.down, tmp.anti)
    ionTail.current.scale.set(len * 0.035, len, len * 0.035)

    tmp.dust.copy(tmp.anti).multiplyScalar(0.7).addScaledVector(tmp.vel, -0.3).normalize()
    dustTail.current.quaternion.setFromUnitVectors(tmp.down, tmp.dust)
    dustTail.current.scale.set(len * 0.22, len * 0.75, len * 0.22)
  })

  const s = COMET.scale
  return (
    <>
      <group position={COMET.offset} rotation={COMET.rotation} scale={s}>
        <group position={COMET.anchor.map((v) => -v)}>
          {sim.showOrbits && <Line points={track} color="#8fb0e0" transparent opacity={0.22} lineWidth={1} />}
          <object3D ref={anchor} />
        </group>
      </group>

      <group
        ref={(o) => {
          head.current = o
          sim.register(COMET.name, o, COMET.radius * 6)
        }}
      >
        <mesh geometry={sphere} scale={COMET.radius / sphereRadius} {...handlers}>
          <meshBasicMaterial color={COMET.color} toneMapped={false} />
        </mesh>
        <Glow scale={COMET.radius * 12} color="#bfe6ff" opacity={0.5} />
        <mesh ref={ionTail} geometry={tailGeometry} material={ionMaterial} />
        <mesh ref={dustTail} geometry={tailGeometry} material={dustMaterial} />
      </group>
    </>
  )
}
