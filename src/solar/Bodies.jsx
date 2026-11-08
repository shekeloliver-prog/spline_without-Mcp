import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { useSim, useSplineGeometry, orbitAngle, SPIN_SCALE, now, MOVE_PRIORITY } from './sim.js'
import { glowTexture, rng, useMaps } from './textures.js'
import { makeRock } from './rocks.js'
import { patchSurface, atmosphereMaterial, tailMaterial, coronaTexture } from './shaders.js'
import { SUN, MOON, ASTEROID_BELT, COMET, SPLINE_PATH_POINTS, SANDBOX, moonsOf } from './data.js'
import { keplerPosition, orbitPoints } from './orbits.js'
import { accel, interact, shellRadius } from './physics.js'

const DEG = Math.PI / 180

// Pointer handlers shared by everything clickable.
function useSelectable(name) {
  const sim = useSim()
  return {
    onClick: (e) => {
      e.stopPropagation()
      if (e.delta > 4) return // that was a drag, not a click
      sim.bodyClick(name, e.point)
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
  const sim = useSim()
  return (
    <mesh visible={sim.showSky} geometry={sphere} scale={1500 / sphereRadius} rotation={[0.5, 0, 0.35]}>
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
  const mat = useRef()
  const light = useRef()
  const glowA = useRef()
  const glowB = useRef()
  const corona = useRef()
  const beams = useRef()
  // Brighter than white on purpose: values above 1 are what the bloom picks up.
  const hot = useMemo(() => new THREE.Color(2.2, 1.75, 1.3), [])
  const pulsarColor = useMemo(() => new THREE.Color(2.4, 2.7, 3.4), [])
  const beamMaterial = useMemo(() => tailMaterial('#a9c8ff', 1.1), [])
  const beamGeometry = useMemo(() => {
    const g = new THREE.ConeGeometry(0.5, 1, 32, 6, true)
    g.translate(0, -0.5, 0) // tip at the star, opening outwards
    return g
  }, [])
  const baseScale = SUN.radius / sphereRadius

  useFrame(() => {
    const star = sim.star.current
    const t = now()
    ref.current.rotation.y = sim.time.current * 0.25
    let size = 1
    let glow = 1
    let remnant = false
    if (star.phase === 'supernova') {
      // 0–1.4 s: the star brightens and swells; then it collapses to a pulsar.
      const age = t - star.startReal
      if (age < 1.4) {
        const k = age / 1.4
        size = 1 + k * 0.8
        glow = 1 + k * 9
        mat.current.color.copy(hot).multiplyScalar(1 + k * 6)
      } else {
        remnant = true
        glow = Math.max(0.35, 10 * Math.exp(-(age - 1.4) * 1.2))
      }
    }
    if (remnant) {
      size = 1.1 / SUN.radius
      mat.current.color.copy(pulsarColor)
      mat.current.map = null
      light.current.color.set('#bcd2ff')
      light.current.intensity = 1.2
      beams.current.visible = true
      beams.current.rotation.y = t * 5
    } else {
      if (star.phase !== 'supernova') mat.current.color.copy(hot)
      if (!mat.current.map) mat.current.map = sun
      light.current.color.set('#fff4e6')
      light.current.intensity = 3.2
      beams.current.visible = false
    }
    mat.current.needsUpdate = mat.current.map !== mat.current.userData.lastMap
    mat.current.userData.lastMap = mat.current.map
    ref.current.scale.setScalar(baseScale * size)
    glowA.current.scale.setScalar(SUN.radius * 3.2 * (remnant ? glow * 0.6 : glow))
    glowB.current.scale.setScalar(SUN.radius * 7 * (remnant ? glow * 0.5 : Math.sqrt(glow)))
    corona.current.visible = sim.event.current?.type === 'solar' && star.phase === 'normal'
  })

  return (
    <group ref={(o) => sim.register(SUN.name, o, SUN.radius)}>
      <mesh ref={ref} geometry={sphere} scale={baseScale} {...handlers}>
        <meshBasicMaterial ref={mat} map={sun} color={hot} toneMapped={false} />
      </mesh>
      <group ref={glowA}>
        <Glow scale={1} color={SUN.glowColor} opacity={0.55} />
      </group>
      <group ref={glowB}>
        <Glow scale={1} color="#ff9b45" opacity={0.18} />
      </group>
      {/* Corona: only seen when the Moon blocks the bright disc */}
      <sprite ref={corona} scale={SUN.radius * 4.4} visible={false}>
        <spriteMaterial map={coronaTexture()} color={[0.9, 0.95, 1.1]} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      {/* Pulsar beams after a supernova: soft cones from the poles */}
      <group ref={beams} visible={false} rotation-z={0.5}>
        {[1, -1].map((side) => (
          <mesh key={side} geometry={beamGeometry} material={beamMaterial} rotation-x={side > 0 ? Math.PI : 0} scale={[3, 30, 3]} />
        ))}
      </group>
      {/* decay 0: brightness doesn't fall off, so Neptune is still lit */}
      <pointLight ref={light} intensity={3.2} decay={0} color="#fff4e6" />
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
  const moonPos = useMemo(() => new THREE.Vector3(), [])
  const maps = useMaps('earth', 'earthSpecular', 'earthNight', 'earthClouds')
  const surface = useMemo(
    () =>
      patchSurface(
        new THREE.MeshPhongMaterial({
          map: maps.earth,
          specularMap: maps.earthSpecular,
          specular: new THREE.Color('#5a6f88'),
          shininess: 22,
          emissiveMap: maps.earthNight,
          emissive: new THREE.Color('#ffd7a0'),
          emissiveIntensity: 1.4,
        }),
        { nightLights: true },
      ),
    [maps],
  )
  const atmosphere = useMemo(() => atmosphereMaterial('#5aa8ff', 1.4), [])
  useFrame(() => {
    clouds.current.rotation.y = sim.time.current * 3
    // The Moon's shadow (solar eclipses) falls on Earth.
    const moon = sim.bodies.current.Moon
    if (moon) {
      moon.object.getWorldPosition(moonPos)
      surface.uniforms.uOccluder.value.set(moonPos.x, moonPos.y, moonPos.z, moon.radius)
    }
    surface.uniforms.uSunRadius.value = sim.star.current.phase === 'normal' ? SUN.radius : 1.1
  })
  return (
    <>
      <mesh geometry={sphere} scale={scale} material={surface.material} />
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
    const body = sim.physics.current.bodies[planet.name]
    if (body?.free) {
      orbit.current.position.copy(body.pos)
    } else {
      const a = orbitAngle(t, planet.period, sim.phases.current[planet.name] ?? phase)
      orbit.current.position.set(Math.cos(a) * planet.distance, 0, -Math.sin(a) * planet.distance)
    }
    orbit.current.visible = body ? body.alive : true
    spin.current.rotation.y = (Math.PI * 2 * t * 365.25 * SPIN_SCALE) / planet.day
  }, MOVE_PRIORITY)

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
        {/* Major moons orbit in the planet's equatorial plane, so they share its tilt */}
        {moonsOf(planet.name).map((m) => (
          <PlanetMoon key={m.name} moon={m} />
        ))}
      </group>
      {planet.moon && <Moon moon={planet.moon} planetRadius={planet.radius} />}
      {planet.satellite && <Satellite satellite={planet.satellite} />}
    </group>
  )
}

// Saturn's rings from a real radial colour/opacity profile. The texture is a
// strip running from the inner edge to the outer edge, so the ring's UVs are
// rewritten to "distance from centre" instead of RingGeometry's planar UVs.
export function Ring({ ring }) {
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

// A moon of Mars, Jupiter, Saturn, Uranus or Neptune. Clickable (fact card),
// and the impactor can destroy it on its own.
function PlanetMoon({ moon }) {
  const { sphere, sphereRadius, cube } = useSplineGeometry()
  const { moon: lunarMap } = useMaps('moon')
  const sim = useSim()
  const ref = useRef()
  const handlers = useSelectable(moon.name)
  const rock = useMemo(() => (moon.shape === 'rock' ? makeRock(cube, moon.name.length * 7 + 3) : null), [cube, moon])
  const geometry = rock ?? sphere
  const scale = moon.radius / (rock ? rock.boundingSphere.radius : sphereRadius)
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: moon.tint,
        map: moon.shape === 'cratered' ? lunarMap : null,
        roughness: moon.shape === 'smooth' ? 0.8 : 1,
      }),
    [moon, lunarMap],
  )
  useFrame(() => {
    const a = orbitAngle(sim.time.current, moon.period, moon.phase)
    ref.current.position.set(Math.cos(a) * moon.distance, 0, -Math.sin(a) * moon.distance)
    ref.current.rotation.y = a + Math.PI // tidally locked
    ref.current.visible = !sim.destroyedRef.current.has(moon.name)
  }, MOVE_PRIORITY)
  return (
    <group rotation-x={((moon.incl ?? 0) * Math.PI) / 180}>
      <mesh
        ref={(o) => {
          ref.current = o
          sim.register(moon.name, o, moon.radius)
        }}
        geometry={geometry}
        scale={scale}
        material={material}
        {...handlers}
      />
    </group>
  )
}

function Moon({ moon, planetRadius }) {
  const { sphere, sphereRadius } = useSplineGeometry()
  const { moon: map } = useMaps('moon')
  const sim = useSim()
  const ref = useRef()
  const handlers = useSelectable(MOON.name)
  const surface = useMemo(
    () => patchSurface(new THREE.MeshStandardMaterial({ map, roughness: 1 }), { redden: 1 }),
    [map],
  )
  const tmp = useMemo(() => ({ earth: new THREE.Vector3(), dir: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), [])

  useFrame(() => {
    const earth = ref.current.parent
    earth.getWorldPosition(tmp.earth)
    const event = sim.event.current
    if (event) {
      // Eclipse: slide the Moon across the Sun–Earth line.
      const p = Math.min(1, (now() - event.startReal) / SANDBOX.eclipseSeconds)
      const solar = event.type === 'solar'
      tmp.dir.copy(tmp.earth).normalize().multiplyScalar(solar ? -1 : 1)
      tmp.dir.applyAxisAngle(tmp.up, (p - 0.5) * (solar ? 0.6 : 1.2))
      ref.current.position.copy(tmp.dir).multiplyScalar(moon.distance)
      ref.current.rotation.y = Math.atan2(-tmp.dir.z, tmp.dir.x) + Math.PI
    } else {
      const a = orbitAngle(sim.time.current, moon.period, sim.phases.current.Moon ?? 0)
      ref.current.position.set(Math.cos(a) * moon.distance, Math.sin(a) * 0.15, -Math.sin(a) * moon.distance)
      ref.current.rotation.y = a + Math.PI // tidally locked: same face toward Earth
    }
    ref.current.visible = !sim.destroyedRef.current.has(MOON.name)
    // Earth's shadow (lunar eclipses) falls on the Moon, reddened by Earth's air.
    surface.uniforms.uOccluder.value.set(tmp.earth.x, tmp.earth.y, tmp.earth.z, planetRadius)
    surface.uniforms.uSunRadius.value = sim.star.current.phase === 'normal' ? SUN.radius : 1.1
  }, MOVE_PRIORITY)
  return (
    <mesh
      ref={(o) => {
        ref.current = o
        sim.register(MOON.name, o, moon.radius)
      }}
      geometry={sphere}
      scale={moon.radius / sphereRadius}
      material={surface.material}
      {...handlers}
    />
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
  }, MOVE_PRIORITY)
  return (
    <group
      ref={(o) => {
        ref.current = o
        sim.register('Satellite', o, s)
      }}
    >
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
// Normally the whole belt turns as one, at the period of its middle. Once
// the sandbox physics is active, every rock becomes its own particle: pulled
// by black holes, carried through wormholes, blown out by a supernova.
// `config` is ASTEROID_BELT by default; KUIPER_BELT reuses the same code.
export function AsteroidBelt({ config = ASTEROID_BELT }) {
  const { cube } = useSplineGeometry()
  const sim = useSim()
  const group = useRef()
  const meshes = useRef([])
  const { count, inner, outer, thickness, size, period, seed, color: tint, name } = config
  const rocks = useMemo(() => ROCK_SEEDS.map((seed) => makeRock(cube, seed)), [cube])
  const perRock = Math.ceil(count / rocks.length)
  const total = perRock * rocks.length
  // Per-instance layout (fixed) and particle state (used once physics is on).
  const layout = useMemo(
    () => ({
      base: new Float32Array(total * 3),
      quat: Array.from({ length: total }, () => new THREE.Quaternion()),
      scale: Array.from({ length: total }, () => new THREE.Vector3()),
    }),
    [total],
  )
  const particles = useRef(null)
  const lastT = useRef(0)

  useLayoutEffect(() => {
    const random = rng(seed)
    const m = new THREE.Matrix4()
    const e = new THREE.Euler()
    const p = new THREE.Vector3()
    const color = new THREE.Color()
    rocks.forEach((rock, r) => {
      const mesh = meshes.current[r]
      const radius = rock.boundingSphere.radius
      for (let i = 0; i < perRock; i++) {
        const n = r * perRock + i
        const a = random() * Math.PI * 2
        // Sum of three randoms: denser in the middle of the belt.
        const d = inner + (outer - inner) * ((random() + random() + random()) / 3)
        p.set(Math.cos(a) * d, (random() - 0.5) * thickness * (0.3 + random()), -Math.sin(a) * d)
        e.set(random() * Math.PI * 2, random() * Math.PI * 2, random() * Math.PI * 2)
        layout.quat[n].setFromEuler(e)
        const k = (size[0] + (size[1] - size[0]) * random() ** 3) / radius
        layout.scale[n].set(k * (0.7 + random() * 0.6), k * (0.6 + random() * 0.5), k * (0.7 + random() * 0.6))
        layout.base.set([p.x, p.y, p.z], n * 3)
        m.compose(p, layout.quat[n], layout.scale[n])
        mesh.setMatrixAt(i, m)
        const shade = 0.55 + random() * 0.45 // carbon-dark to stony
        mesh.setColorAt(i, color.setRGB(tint[0] * shade, tint[1] * shade, tint[2] * shade))
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.instanceColor.needsUpdate = true
    })
    particles.current = null
  }, [rocks, perRock, inner, outer, thickness, size, seed, tint, layout, sim.resetKey])

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), v: new THREE.Vector3(), a: new THREE.Vector3(), zero: new THREE.Vector3() }),
    [],
  )

  useFrame(() => {
    const physics = sim.physics.current
    const t = sim.time.current
    const dt = t - lastT.current
    lastT.current = t
    if (!physics.active) {
      group.current.rotation.y = orbitAngle(t, period)
      return
    }

    // First frame under physics: turn the rigidly rotating belt into particles.
    if (!particles.current) {
      const rot = group.current.rotation.y
      const w = (Math.PI * 2) / period
      const pos = Array.from({ length: total }, (_, n) =>
        new THREE.Vector3().fromArray(layout.base, n * 3).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot),
      )
      particles.current = {
        pos,
        vel: pos.map((q) => new THREE.Vector3(q.z * w, 0, -q.x * w)),
        gm: pos.map((q) => w * w * Math.hypot(q.x, q.z) ** 3),
        state: pos.map(() => ({ cooldown: 0, pushed: false, alive: true })),
      }
      group.current.rotation.y = 0
    }

    const P = particles.current
    const steps = Math.min(24, Math.max(1, Math.ceil(dt / 0.002)))
    const h = dt / steps
    const shell = shellRadius(physics, t)
    for (let n = 0; n < total; n++) {
      const st = P.state[n]
      if (!st.alive) continue
      const pos = P.pos[n]
      const vel = P.vel[n]
      if (physics.supernova && !st.pushed && pos.length() < shell) {
        st.pushed = true
        vel.addScaledVector(tmp.p.copy(pos).normalize(), physics.supernova.boost * (0.7 + (n % 7) * 0.08))
      }
      for (let k = 0; k < steps; k++) {
        accel(physics, pos, P.gm[n], tmp.a, st.pushed)
        vel.addScaledVector(tmp.a, h)
        pos.addScaledVector(vel, h)
        st.cooldown -= h
        const hit = interact(physics, st, pos, vel, 0.1)
        if (hit && hit.fate !== 'teleported') {
          st.alive = false
          break
        }
      }
    }
    // Write the particles back into the three instanced meshes.
    rocks.forEach((_, r) => {
      const mesh = meshes.current[r]
      for (let i = 0; i < perRock; i++) {
        const n = r * perRock + i
        const alive = P.state[n].alive
        tmp.m.compose(P.pos[n], layout.quat[n], alive ? layout.scale[n] : tmp.zero)
        mesh.setMatrixAt(i, tmp.m)
      }
      mesh.instanceMatrix.needsUpdate = true
    })
  })

  return (
    <group ref={group} visible={sim.showBelt}>
      {/* Anchor for the "Asteroid belt" label, riding along with the rocks */}
      <object3D
        position={[0, 0, -(inner + outer) / 2]}
        ref={(o) => sim.register(name, o, 0.6)}
      />
      {rocks.map((g, r) => (
        <instancedMesh key={r} ref={(el) => (meshes.current[r] = el)} args={[g, undefined, perRock]} frustumCulled={false}>
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
  }, MOVE_PRIORITY)

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

// A dwarf planet on its real (tilted, oval) orbit. Like the planets it is
// clickable, destroyable, and handed over to the sandbox physics when that
// switches on. Haumea is stretched into its egg shape.
export function DwarfPlanet({ dwarf }) {
  const { sphere, sphereRadius } = useSplineGeometry()
  const { moon: lunarMap } = useMaps('moon')
  const sim = useSim()
  const holder = useRef()
  const spin = useRef()
  const handlers = useSelectable(dwarf.name)
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: dwarf.tint,
        map: dwarf.shape === 'cratered' ? lunarMap : null,
        roughness: dwarf.shape === 'smooth' ? 0.75 : 1,
      }),
    [dwarf, lunarMap],
  )
  const k = dwarf.radius / sphereRadius
  const [sx, sy, sz] = dwarf.stretch ?? [1, 1, 1]

  useFrame(() => {
    const t = sim.time.current
    const body = sim.physics.current.bodies[dwarf.name]
    if (body?.free) holder.current.position.copy(body.pos)
    else keplerPosition(dwarf.orbit, t, holder.current.position)
    holder.current.visible = body ? body.alive : true
    spin.current.rotation.y = (Math.PI * 2 * t * 365.25 * SPIN_SCALE) / dwarf.day
  }, MOVE_PRIORITY)

  return (
    <group
      ref={(o) => {
        holder.current = o
        sim.register(dwarf.name, o, dwarf.radius)
      }}
    >
      <group rotation-z={dwarf.tilt * DEG}>
        <mesh ref={spin} geometry={sphere} scale={[k * sx, k * sy, k * sz]} material={material} {...handlers} />
        {moonsOf(dwarf.name).map((m) => (
          <PlanetMoon key={m.name} moon={m} />
        ))}
      </group>
    </group>
  )
}

// A dwarf planet's orbit: tilted and oval, drawn a little more violet than
// the planets' circles so the two kinds are easy to tell apart.
export function DwarfOrbitLine({ orbit }) {
  const sim = useSim()
  const points = useMemo(() => orbitPoints(orbit), [orbit])
  if (!sim.showOrbits) return null
  return <Line points={points} color="#a596c8" transparent opacity={0.12} lineWidth={1} />
}
