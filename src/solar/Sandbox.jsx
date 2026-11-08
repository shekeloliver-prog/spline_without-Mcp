// Sandbox: place cosmic objects, smash planets, set off a supernova.
// Everything here reads and writes the shared physics state in sim.physics.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useFBO } from '@react-three/drei'
import * as THREE from 'three'
import { useSim, useSplineGeometry, now } from './sim.js'
import { glowTexture, rng } from './textures.js'
import { makeRock } from './rocks.js'
import { lensMaterial, accretionDiskMaterial, shellMaterial, tailMaterial } from './shaders.js'
import { stepPlanets, shellRadius } from './physics.js'
import { SANDBOX } from './data.js'

// Invisible orbital plane that catches clicks for placing tools.
export function ClickPlane() {
  const sim = useSim()
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      visible={false}
      onClick={(e) => {
        if (!sim.armed || e.delta > 4) return
        e.stopPropagation()
        sim.placeAt(e.point)
      }}
    >
      <circleGeometry args={[700, 32]} />
      <meshBasicMaterial side={THREE.DoubleSide} />
    </mesh>
  )
}

// Advances free-flying planets each frame, after the clock and before drawing.
export function PhysicsStep() {
  const sim = useSim()
  const lastT = useRef(sim.time.current)
  useFrame(() => {
    const t = sim.time.current
    const dt = t - lastT.current
    lastT.current = t
    stepPlanets(sim.physics.current, dt, t, sim.onFate)
  }, -0.5)
  return null
}

// ---------------------------------------------------------------- lensing
// One capture of the scene per frame (without the lens quads), shared by
// every black hole and wormhole mouth, which then bend it on screen.
export function LensCapture({ lenses }) {
  const fbo = useFBO({ type: THREE.HalfFloatType })
  useFrame(({ gl, scene, camera }) => {
    if (lenses.current.size === 0) return
    lenses.current.forEach((m) => (m.visible = false))
    const prev = gl.getRenderTarget()
    gl.setRenderTarget(fbo)
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(prev)
    lenses.current.forEach((m) => (m.visible = true))
  })
  lenses.texture = fbo.texture
  return null
}

function Lens({ lenses, getPos, mode, outer, einstein, horizon }) {
  const ref = useRef()
  const { camera, gl, size } = useThree()
  const material = useMemo(() => lensMaterial(lenses.texture), [lenses.texture])
  const v = useMemo(() => ({ c: new THREE.Vector3(), e: new THREE.Vector3(), right: new THREE.Vector3(), buf: new THREE.Vector2() }), [])

  useLayoutEffect(() => {
    const set = lenses.current
    const m = ref.current
    set.add(m)
    return () => set.delete(m)
  }, [lenses])

  useFrame((state) => {
    const pos = getPos()
    const R = outer()
    ref.current.position.copy(pos)
    ref.current.quaternion.copy(camera.quaternion)
    ref.current.scale.setScalar(R * 2)
    material.uniforms.tScene.value = lenses.texture
    gl.getDrawingBufferSize(v.buf)
    material.uniforms.uResolution.value.copy(v.buf)
    // Project the centre and an edge point to get the lens size on screen.
    v.c.copy(pos).project(camera)
    v.right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    v.e.copy(pos).addScaledVector(v.right, R).project(camera)
    const aspect = size.width / size.height
    const outerUv = Math.abs(v.e.x - v.c.x) * 0.5 * aspect
    const u = material.uniforms
    u.uCenter.value.set((v.c.x + 1) / 2, (v.c.y + 1) / 2)
    u.uAspect.value = aspect
    u.uOuter.value = outerUv
    u.uEinstein.value = (outerUv * einstein()) / R
    u.uHorizon.value = (outerUv * horizon()) / R
    u.uMode.value = mode
    u.uTime.value = state.clock.elapsedTime
    // Behind the camera: nothing to draw.
    ref.current.visible = v.c.z < 1
  })

  return (
    <mesh ref={ref} material={material} renderOrder={10}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}

// ---------------------------------------------------------------- tools
function useAttractor(sim, id) {
  return () => sim.physics.current.attractors.find((a) => a.id === id)
}

export function BlackHole({ tool, lenses }) {
  const sim = useSim()
  const { sphere, sphereRadius } = useSplineGeometry()
  const group = useRef()
  const disk = useRef()
  const find = useAttractor(sim, tool.id)
  const diskMat = useMemo(() => accretionDiskMaterial(), [])
  const diskGeo = useMemo(() => new THREE.RingGeometry(1.35, 4.2, 160, 1), [])
  diskMat.uniforms.uInner.value = 1.35
  diskMat.uniforms.uOuter.value = 4.2
  const pos = tool.pos
  useFrame((state) => {
    const a = find()
    const h = a ? a.horizon : tool.horizon
    group.current.scale.setScalar(h)
    diskMat.uniforms.uTime.value = state.clock.elapsedTime
  })
  const horizonNow = () => (find()?.horizon ?? tool.horizon)
  return (
    <>
      <group ref={group} position={pos}>
        <mesh geometry={sphere} scale={1 / sphereRadius}>
          <meshBasicMaterial color="#000000" />
        </mesh>
        <mesh ref={disk} geometry={diskGeo} material={diskMat} rotation-x={-Math.PI / 2 + 0.32} />
      </group>
      <Lens
        lenses={lenses}
        getPos={() => pos}
        mode={0}
        outer={() => horizonNow() * 6}
        einstein={() => horizonNow() * 1.9}
        horizon={() => horizonNow() * 1.05}
      />
    </>
  )
}

export function WhiteHole({ tool }) {
  const ring = useRef()
  const core = useMemo(() => new THREE.Color(3, 3.1, 3.6), [])
  useFrame((state) => {
    const k = (state.clock.elapsedTime * 0.6) % 1
    ring.current.scale.setScalar(tool.radius * (1.5 + k * 6))
    ring.current.material.opacity = 0.5 * (1 - k)
  })
  return (
    <group position={tool.pos}>
      <mesh>
        <sphereGeometry args={[tool.radius, 32, 16]} />
        <meshBasicMaterial color={core} toneMapped={false} />
      </mesh>
      <sprite scale={tool.radius * 9}>
        <spriteMaterial map={glowTexture()} color="#cfe0ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.92, 1, 96]} />
        <meshBasicMaterial color="#dfe9ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  )
}

function WormholeMouth({ pos, mouth, lenses }) {
  return (
    <>
      <sprite position={pos} scale={mouth * 5}>
        <spriteMaterial map={glowTexture()} color="#9a6cff" opacity={0.6} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <Lens lenses={lenses} getPos={() => pos} mode={1} outer={() => mouth * 3.4} einstein={() => mouth * 1.2} horizon={() => mouth * 0.9} />
    </>
  )
}

export function Wormhole({ tool, lenses }) {
  return (
    <>
      <WormholeMouth pos={tool.a} mouth={tool.mouth} lenses={lenses} />
      {tool.b && <WormholeMouth pos={tool.b} mouth={tool.mouth} lenses={lenses} />}
    </>
  )
}

// ---------------------------------------------------------------- effects
function Flash({ effect, onDone }) {
  const ref = useRef()
  useFrame(() => {
    const age = now() - effect.start
    const life = effect.life ?? 1.2
    if (age > life) return onDone(effect.id)
    const k = age / life
    ref.current.scale.setScalar(effect.size * (0.3 + Math.sqrt(k) * 1.2))
    ref.current.material.opacity = (1 - k) ** 1.5
  })
  const color = useMemo(() => new THREE.Color(effect.color).multiplyScalar(3), [effect.color])
  return (
    <sprite ref={ref} position={effect.pos} scale={0.01}>
      <spriteMaterial map={glowTexture()} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </sprite>
  )
}

// A planet breaking apart: hot fragments of its own colour flying outwards.
function Debris({ effect, onDone }) {
  const { cube } = useSplineGeometry()
  const mesh = useRef()
  const mat = useRef()
  const count = effect.count
  const rock = useMemo(() => makeRock(cube, 99), [cube])
  const parts = useMemo(() => {
    const random = rng(Math.floor(effect.start * 1000))
    const radius = rock.boundingSphere.radius
    return Array.from({ length: count }, () => {
      const dir = new THREE.Vector3(random() - 0.5, (random() - 0.5) * 0.6, random() - 0.5).normalize()
      return {
        pos: new THREE.Vector3().copy(effect.pos).addScaledVector(dir, effect.radius * random()),
        vel: dir.multiplyScalar(effect.radius * (1.5 + random() * 5)),
        spin: new THREE.Vector3(random(), random(), random()).multiplyScalar(4),
        rot: new THREE.Euler(random() * 6, random() * 6, random() * 6),
        size: (effect.radius * (0.05 + random() ** 3 * 0.35)) / radius,
      }
    })
  }, [count, effect, rock])

  useLayoutEffect(() => {
    const c = new THREE.Color()
    const tint = new THREE.Color(effect.tint)
    parts.forEach((_, i) => mesh.current.setColorAt(i, c.copy(tint).multiplyScalar(0.5 + (i % 5) * 0.12)))
    mesh.current.instanceColor.needsUpdate = true
  }, [parts, effect.tint])

  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])
  const last = useRef(now())
  useFrame(() => {
    const t = now()
    const dt = Math.min(0.1, t - last.current)
    last.current = t
    const age = t - effect.start
    if (age > 9) return onDone(effect.id)
    const shrink = age < 5 ? 1 : Math.max(0, 1 - (age - 5) / 4)
    mat.current.emissiveIntensity = Math.max(0, 2.5 * (1 - age / 2.5))
    parts.forEach((p, i) => {
      p.pos.addScaledVector(p.vel, dt)
      p.vel.multiplyScalar(1 - dt * 0.15)
      p.rot.x += p.spin.x * dt
      p.rot.y += p.spin.y * dt
      q.setFromEuler(p.rot)
      m.compose(p.pos, q, sc.setScalar(p.size * shrink))
      mesh.current.setMatrixAt(i, m)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[rock, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial ref={mat} roughness={0.9} emissive="#ff6a1f" emissiveIntensity={2.5} />
    </instancedMesh>
  )
}

// An asteroid flying in to hit a planet, with a glowing trail.
function Impactor({ effect, onDone }) {
  const sim = useSim()
  const { cube } = useSplineGeometry()
  const rock = useMemo(() => makeRock(cube, 5), [cube])
  const group = useRef()
  const trail = useRef()
  const trailMat = useMemo(() => tailMaterial('#ffb070', 0.9), [])
  const trailGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.5, 1, 24, 4, true)
    g.translate(0, -0.5, 0)
    return g
  }, [])
  const v = useMemo(() => ({ target: new THREE.Vector3(), dir: new THREE.Vector3(), down: new THREE.Vector3(0, -1, 0) }), [])
  const size = effect.radius * 0.35
  useFrame(() => {
    const body = sim.bodies.current[effect.target]
    if (!body) return onDone(effect.id)
    body.object.getWorldPosition(v.target)
    const k = Math.min(1, (now() - effect.start) / SANDBOX.impactor.travelSeconds)
    const eased = k * k
    group.current.position.lerpVectors(effect.from, v.target, eased)
    v.dir.copy(v.target).sub(effect.from).normalize()
    trail.current.quaternion.setFromUnitVectors(v.down, v.dir.clone().negate())
    trail.current.scale.set(size * 2, size * 18 * (0.3 + eased), size * 2)
    group.current.rotation.x += 0.08
    if (k >= 1) {
      onDone(effect.id)
      sim.smash(effect.target)
    }
  })
  return (
    <group>
      <group ref={group}>
        <mesh geometry={rock} scale={size / rock.boundingSphere.radius}>
          <meshStandardMaterial color="#5d544b" roughness={1} emissive="#ff7a30" emissiveIntensity={0.6} />
        </mesh>
        <mesh ref={trail} geometry={trailGeo} material={trailMat} />
      </group>
    </group>
  )
}

// The supernova shock front, expanding with simulated time.
function SupernovaShell({ effect, onDone }) {
  const sim = useSim()
  const ref = useRef()
  const material = useMemo(() => shellMaterial(), [])
  useFrame(() => {
    const r = shellRadius(sim.physics.current, sim.time.current)
    if (r > 420) return onDone(effect.id)
    ref.current.scale.setScalar(Math.max(0.01, r))
    material.uniforms.uFade.value = Math.max(0, 1 - r / 420)
  })
  return (
    <mesh ref={ref} material={material}>
      <sphereGeometry args={[1, 64, 32]} />
    </mesh>
  )
}

const EFFECTS = { flash: Flash, debris: Debris, impactor: Impactor, shell: SupernovaShell }

export function Effects({ effects, onDone }) {
  return effects.map((e) => {
    const C = EFFECTS[e.type]
    return <C key={e.id} effect={e} onDone={onDone} />
  })
}
