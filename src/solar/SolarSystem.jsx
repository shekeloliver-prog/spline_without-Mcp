import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, useProgress } from '@react-three/drei'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { SimContext, useSim, now } from './sim.js'
import { Sky, Sun, Planet, OrbitLine, AsteroidBelt, Comet } from './Bodies.jsx'
import { ClickPlane, PhysicsStep, LensCapture, BlackHole, WhiteHole, Wormhole, Effects } from './Sandbox.jsx'
import { createPhysics, resetPhysics, activate } from './physics.js'
import { PLANETS, MOON, MOONS, CAMERA_HOME, VIEWS, BODY_LIST, SECONDS_PER_YEAR, SANDBOX, SUN, moonsOf } from './data.js'
import Hud from './Hud.jsx'
import { Labels, LabelProjector } from './Labels.jsx'
import './solar.css'

// Starting angles, spread out so the planets don't line up on load.
const PHASES = PLANETS.map((_, i) => (i * 2.39996) % (Math.PI * 2))
const TINTS = Object.fromEntries([...PLANETS, MOON, ...MOONS].map((b) => [b.name, b.tint]))
const RADII = Object.fromEntries(
  [...PLANETS, { name: 'Moon', radius: PLANETS[2].moon.radius }, ...MOONS].map((b) => [b.name, b.radius]),
)

const DEFAULT_OPTIONS = {
  showLabels: true,
  labelDetails: false,
  showOrbits: true,
  showBelt: true,
  showSky: true,
  showGlow: true,
  autoRotate: false,
}

let nextId = 1
const uid = () => nextId++

// Advances simulated time (in Earth years). Runs before the bodies update.
function Clock() {
  const sim = useSim()
  useFrame((_, dt) => {
    if (!sim.paused.current) sim.time.current += (Math.min(dt, 0.1) * sim.speed.current) / SECONDS_PER_YEAR
  }, -1)
  return null
}

// Shown while the planet maps download (about 2.4 MB in total).
function LoadingNote() {
  const { active, progress } = useProgress()
  if (!active) return null
  return (
    <div className="solar-loading" role="status">
      Loading planet maps… {Math.round(progress)}%
    </div>
  )
}

// Camera position for a view preset. Portrait screens (phones) back the
// camera off so the whole system still fits across the narrow width.
function viewPosition(view, aspect, out) {
  const back = aspect < 1 ? Math.min(2.4, 1.15 / aspect) : 1
  return out.set(...VIEWS[view].position).multiplyScalar(back)
}

// Where to stand for each eclipse.
//   Solar: on the Sun–Earth line, just above Earth, at the point where the
//   Moon looks very slightly bigger than the Sun (a total eclipse).
//   Lunar: off to the side of Earth's night side, looking at the Moon.
function eclipseCamera(type, earth, moonDistance, moonRadius, pos, target) {
  const s = earth.clone().normalize() // from the Sun towards Earth
  if (type === 'solar') {
    const dm = earth.length() - moonDistance
    const k = 1.04 * SUN.radius
    pos.copy(s).multiplyScalar((k * dm) / (k - moonRadius))
    target.set(0, 0, 0)
  } else {
    const side = new THREE.Vector3().crossVectors(s, new THREE.Vector3(0, 1, 0)).normalize()
    pos.copy(earth).addScaledVector(s, 0.7).addScaledVector(side, 3.4).add(new THREE.Vector3(0, 0.9, 0))
    target.copy(earth).addScaledVector(s, 1.9)
  }
}

const UP = new THREE.Vector3(0, 1, 0)

// Glides the camera to the selected body and keeps following it as it
// orbits. With nothing selected, glides once to the current view preset.
// During an eclipse it takes over and holds the eclipse viewpoint.
function CameraRig() {
  const sim = useSim()
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const aspect = useThree((s) => s.size.width / s.size.height)
  const v = useMemo(
    () => ({
      target: new THREE.Vector3(),
      prev: new THREE.Vector3(),
      delta: new THREE.Vector3(),
      homePos: new THREE.Vector3(),
      homeTarget: new THREE.Vector3(...CAMERA_HOME.target),
      earth: new THREE.Vector3(),
      eventPos: new THREE.Vector3(),
      eventTarget: new THREE.Vector3(),
      litDir: new THREE.Vector3(),
      camDir: new THREE.Vector3(),
      following: null,
    }),
    [],
  )

  if (import.meta.env.DEV) window.__solarCamera = camera // dev-only, for automated checks

  // Start framed for this screen shape (and reframe on resize while in a view).
  useLayoutEffect(() => {
    viewPosition(sim.view.current, aspect, v.homePos)
    if (!sim.selected.current) camera.position.copy(v.homePos)
  }, [aspect, camera, sim, v])

  useFrame((_, dt) => {
    if (!controls) return
    const k = 1 - Math.exp(-dt * 3.5)
    const event = sim.event.current

    if (event) {
      const earth = sim.bodies.current.Earth
      if (!earth) return
      earth.object.getWorldPosition(v.earth)
      const moon = PLANETS[2].moon
      eclipseCamera(event.type, v.earth, moon.distance, moon.radius, v.eventPos, v.eventTarget)
      const kk = 1 - Math.exp(-dt * 5)
      camera.position.lerp(v.eventPos, kk)
      controls.target.lerp(v.eventTarget, kk)
      controls.enabled = false // OrbitControls stops aiming the camera, so aim it here
      camera.lookAt(controls.target)
      return
    }
    controls.enabled = true

    const selected = sim.selected.current
    const body = selected && sim.bodies.current[selected]
    if (body) {
      body.object.getWorldPosition(v.target)
      if (v.following !== selected) {
        v.following = selected
        v.prev.copy(v.target)
      }
      // 1. Ride along with the body's own motion this frame, so even the
      //    fast Moon never slips out of view.
      v.delta.copy(v.target).sub(v.prev)
      v.prev.copy(v.target)
      controls.target.add(v.delta)
      camera.position.add(v.delta)
      // 2. Ease the remaining gap (instantly once locked on). Target and
      //    camera move together, so the view keeps its angle.
      v.delta.copy(v.target).sub(controls.target).multiplyScalar(selected === sim.lastSelected.current ? 1 : k)
      controls.target.add(v.delta)
      camera.position.add(v.delta)
      if (sim.flying.current) {
        const want = body.radius * 5 + 4
        const dist = camera.position.distanceTo(controls.target)
        const next = THREE.MathUtils.lerp(dist, want, k)
        // Swing round to the sunlit side (a three-quarter view, slightly
        // from above), so we never arrive facing a body's black night side.
        v.camDir.copy(camera.position).sub(controls.target).normalize()
        let facing = 1
        if (v.target.lengthSq() > 1) {
          v.litDir.copy(v.target).negate().normalize().applyAxisAngle(UP, 0.6)
          v.litDir.y += 0.35
          v.litDir.normalize()
          v.camDir.lerp(v.litDir, k).normalize()
          facing = v.camDir.dot(v.litDir)
        }
        camera.position.copy(controls.target).addScaledVector(v.camDir, next)
        if (Math.abs(next - want) < 0.05 && controls.target.distanceTo(v.target) < 0.05 && facing > 0.995) {
          sim.flying.current = false
          sim.lastSelected.current = selected // locked on: follow exactly from now on
        }
      }
    } else if (sim.flying.current) {
      v.following = null
      viewPosition(sim.view.current, aspect, v.homePos)
      controls.target.lerp(v.homeTarget, k)
      camera.position.lerp(v.homePos, k)
      if (camera.position.distanceTo(v.homePos) < 0.1) sim.flying.current = false
    }
  })
  return null
}

// Ends an eclipse when its sequence has played through.
function EventTimer() {
  const sim = useSim()
  useFrame(() => {
    const e = sim.event.current
    if (e && now() - e.startReal > SANDBOX.eclipseSeconds + 1.5) sim.endEvent()
  })
  return null
}

export default function SolarSystem() {
  const [selected, setSelected] = useState(null)
  const [view, setViewState] = useState('overview')
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [options, setOptions] = useState(DEFAULT_OPTIONS)
  const setOption = useCallback((key, value) => setOptions((o) => ({ ...o, [key]: value })), [])

  // Sandbox state
  const [armed, setArmed] = useState(null) // 'blackhole' | 'whitehole' | 'wormhole' | 'impactor' | null
  const [strength, setStrength] = useState('medium')
  const [pendingMouth, setPendingMouth] = useState(null)
  const [tools, setTools] = useState([])
  const [effects, setEffects] = useState([])
  const [destroyed, setDestroyed] = useState(() => new Set())
  const [eventType, setEventType] = useState(null)
  const [starPhase, setStarPhase] = useState('normal')
  const [resetKey, setResetKey] = useState(0)

  const time = useRef(0)
  const speedRef = useRef(speed)
  const pausedRef = useRef(paused)
  const selectedRef = useRef(null)
  const viewRef = useRef('overview')
  const lastSelected = useRef(null)
  const flying = useRef(false)
  const bodies = useRef({})
  const labelEls = useRef({})
  const lenses = useRef(new Set())
  const physics = useRef(null)
  if (!physics.current) {
    physics.current = createPhysics()
    resetPhysics(physics.current, PLANETS)
  }
  const destroyedRef = useRef(destroyed)
  const event = useRef(null)
  const star = useRef({ phase: 'normal', startReal: 0 })
  const pausedBeforeEvent = useRef(false)
  speedRef.current = speed
  pausedRef.current = paused
  destroyedRef.current = destroyed

  const select = useCallback((name) => {
    selectedRef.current = name
    lastSelected.current = null
    flying.current = true
    setSelected(name)
  }, [])

  // A view preset also leaves whatever body was being followed.
  const setView = useCallback(
    (name) => {
      viewRef.current = name
      setViewState(name)
      select(null)
    },
    [select],
  )

  const register = useCallback((name, object, radius) => {
    if (object) bodies.current[name] = { object, radius }
  }, [])

  const addEffect = useCallback((e) => setEffects((list) => [...list, { id: uid(), start: now(), ...e }]), [])
  const removeEffect = useCallback((id) => setEffects((list) => list.filter((e) => e.id !== id)), [])

  // A body is gone: record it, leave it if we were following it, show why.
  const destroy = useCallback(
    (name, fate, where) => {
      const gone = new Set(destroyedRef.current)
      gone.add(name)
      // A planet's moons go with it.
      if (name === 'Earth') gone.add('Moon')
      for (const m of moonsOf(name)) gone.add(m.name)
      destroyedRef.current = gone
      setDestroyed(gone)
      const b = physics.current.bodies[name]
      if (b) b.alive = false
      if (gone.has(selectedRef.current)) select(null)
      const radius = RADII[name] ?? 1
      const pos = where.clone ? where.clone() : new THREE.Vector3().copy(where)
      if (fate === 'swallowed') {
        addEffect({ type: 'flash', pos, color: '#cfe0ff', size: radius * 6, life: 1.4 })
        const hole = physics.current.attractors.find((a) => a.type === 'blackhole' && a.pos.distanceTo(pos) < 0.01)
        if (hole) {
          hole.horizon *= 1.04 // a black hole grows as it feeds
          hole.gm *= 1.06
        }
      } else {
        addEffect({ type: 'flash', pos, color: fate === 'burned' ? '#ffb15a' : '#ffd2a0', size: radius * 10, life: 1.6 })
        addEffect({ type: 'debris', pos, tint: TINTS[name] ?? '#888', radius, count: SANDBOX.impactor.debris })
      }
    },
    [addEffect, select],
  )

  // Physics reports each planet's fate; wormhole trips only get a small flash.
  const onFate = useCallback(
    (name, fate, where) => {
      if (fate === 'teleported') {
        addEffect({ type: 'flash', pos: where.clone(), color: '#b48cff', size: 4, life: 0.8 })
        return
      }
      destroy(name, fate, where)
    },
    [addEffect, destroy],
  )

  const startPhysics = useCallback(() => {
    activate(physics.current, PLANETS, PHASES, time.current)
  }, [])

  const addTool = useCallback(
    (tool) => {
      const p = physics.current
      if (tool.type === 'blackhole' || tool.type === 'whitehole') {
        p.attractors.push({ id: tool.id, type: tool.type, pos: tool.pos, gm: tool.gm, horizon: tool.horizon ?? 0 })
      } else if (tool.type === 'wormhole') {
        p.wormholes.push({ id: tool.id, a: tool.a, b: tool.b, mouth: tool.mouth, gm: tool.gm })
      }
      startPhysics()
      setTools((list) => [...list, tool])
    },
    [startPhysics],
  )

  const removeTool = useCallback((id) => {
    const p = physics.current
    p.attractors = p.attractors.filter((a) => a.id !== id)
    p.wormholes = p.wormholes.filter((w) => w.id !== id)
    setTools((list) => list.filter((t) => t.id !== id))
  }, [])

  // Place the armed tool at a point on (or projected onto) the orbital plane.
  const placeAt = useCallback(
    (point) => {
      const pos = new THREE.Vector3(point.x, 0, point.z)
      const k = SANDBOX.strengths[strength]
      if (armed === 'blackhole') {
        addTool({ id: uid(), type: 'blackhole', pos, gm: SANDBOX.blackHole.gm * k, horizon: SANDBOX.blackHole.horizon * Math.cbrt(k) })
      } else if (armed === 'whitehole') {
        addTool({ id: uid(), type: 'whitehole', pos, gm: SANDBOX.whiteHole.gm * k, radius: SANDBOX.whiteHole.radius * Math.cbrt(k) })
      } else if (armed === 'wormhole') {
        if (!pendingMouth) {
          setPendingMouth(pos)
        } else {
          addTool({ id: uid(), type: 'wormhole', a: pendingMouth, b: pos, gm: SANDBOX.wormhole.gm * k, mouth: SANDBOX.wormhole.mouth })
          setPendingMouth(null)
        }
      }
    },
    [armed, strength, pendingMouth, addTool],
  )

  // Launch an asteroid at a planet or the Moon.
  const launchImpactor = useCallback(
    (name) => {
      const body = bodies.current[name]
      if (!body || destroyedRef.current.has(name)) return
      const target = body.object.getWorldPosition(new THREE.Vector3())
      const dir = new THREE.Vector3(Math.random() - 0.5, 0.35 + Math.random() * 0.4, Math.random() - 0.5).normalize()
      const radius = Math.max(RADII[name] ?? 1, 0.3) // keep the rock visible even when aimed at a tiny moon
      addEffect({ type: 'impactor', target: name, from: target.clone().addScaledVector(dir, 22 + radius * 8), radius })
    },
    [addEffect],
  )

  const smash = useCallback(
    (name) => {
      const body = bodies.current[name]
      if (!body || destroyedRef.current.has(name)) return
      destroy(name, 'smashed', body.object.getWorldPosition(new THREE.Vector3()))
    },
    [destroy],
  )

  // Clicking a body: with a tool armed, use the tool on it; otherwise fly to it.
  const bodyClick = useCallback(
    (name, point) => {
      if (!armed) return select(name)
      if (armed === 'impactor') {
        if (name !== 'Sun' && name !== 'Comet') launchImpactor(name)
        return
      }
      const body = bodies.current[name]
      placeAt(body ? body.object.getWorldPosition(new THREE.Vector3()) : point)
    },
    [armed, select, launchImpactor, placeAt],
  )

  const triggerSupernova = useCallback(() => {
    if (star.current.phase !== 'normal') return
    const p = physics.current
    startPhysics()
    p.supernova = { startT: time.current, ...SANDBOX.supernova }
    p.sunScale = 0
    p.sunRadius = 1.1
    star.current = { phase: 'supernova', startReal: now() }
    setStarPhase('supernova')
    setPaused(false)
    addEffect({ type: 'flash', pos: new THREE.Vector3(), color: '#fff2d8', size: 120, life: 3 })
    addEffect({ type: 'shell' })
  }, [startPhysics, addEffect])

  const endEvent = useCallback(() => {
    if (!event.current) return
    event.current = null
    setEventType(null)
    setPaused(pausedBeforeEvent.current)
    select(null)
  }, [select])

  const startEvent = useCallback(
    (type) => {
      if (destroyedRef.current.has('Earth') || destroyedRef.current.has('Moon') || star.current.phase !== 'normal') return
      if (!event.current) pausedBeforeEvent.current = pausedRef.current
      setArmed(null)
      setPaused(true)
      event.current = { type, startReal: now() }
      setEventType(type)
    },
    [],
  )

  const restore = useCallback(() => {
    resetPhysics(physics.current, PLANETS)
    setTools([])
    setEffects([])
    const none = new Set()
    destroyedRef.current = none
    setDestroyed(none)
    star.current = { phase: 'normal', startReal: 0 }
    setStarPhase('normal')
    event.current = null
    setEventType(null)
    setPendingMouth(null)
    setArmed(null)
    setResetKey((k) => k + 1)
    select(null)
  }, [select])

  const arm = useCallback((tool) => {
    setPendingMouth(null)
    setArmed((current) => (current === tool ? null : tool))
  }, [])

  // Keyboard: Space pauses, ← / → step through the bodies, Esc cancels a
  // tool, ends an eclipse, or returns to the view.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, select, textarea')) return
      if (e.key === ' ' && !e.target.closest?.('button, summary, a')) {
        e.preventDefault()
        if (!event.current) setPaused((p) => !p)
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !event.current) {
        const alive = BODY_LIST.filter((b) => !destroyedRef.current.has(b.name))
        const i = alive.findIndex((b) => b.name === selectedRef.current)
        const step = e.key === 'ArrowRight' ? 1 : -1
        const next = i === -1 ? (step > 0 ? 0 : alive.length - 1) : (i + step + alive.length) % alive.length
        select(alive[next].name)
      } else if (e.key === 'Escape') {
        if (armed) {
          setArmed(null)
          setPendingMouth(null)
        } else if (event.current) endEvent()
        else select(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [select, armed, endEvent])

  const sim = useMemo(
    () => ({
      time,
      speed: speedRef,
      paused: pausedRef,
      selected: selectedRef,
      view: viewRef,
      lastSelected,
      flying,
      bodies,
      labelEls,
      physics,
      star,
      event,
      destroyedRef,
      select,
      register,
      bodyClick,
      placeAt,
      smash,
      onFate,
      endEvent,
      armed,
      resetKey,
      ...options,
    }),
    [select, register, bodyClick, placeAt, smash, onFate, endEvent, armed, resetKey, options],
  )

  // Dev-only handle for automated checks (stripped from production builds).
  useEffect(() => {
    if (import.meta.env.DEV) window.__solar = sim
  }, [sim])

  const solarClass = ['solar', armed ? 'armed' : '', eventType ? 'in-event' : ''].join(' ')

  return (
    <SimContext.Provider value={sim}>
      <div className={solarClass}>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: CAMERA_HOME.position, fov: CAMERA_HOME.fov, near: 0.1, far: 3000 }}
          onPointerMissed={() => document.body.style.removeProperty('cursor')}
        >
          <color attach="background" args={['#000000']} />
          {/* Space has almost no fill light: night sides should be close to black. */}
          <ambientLight intensity={0.025} />
          {options.showSky && <Stars radius={1000} depth={300} count={2500} factor={2.5} saturation={0} fade speed={0} />}
          <Clock />
          <PhysicsStep />
          <Suspense fallback={null}>
            <Sky />
            <Sun />
            {PLANETS.map((p, i) => (
              <group key={p.name}>
                <OrbitLine radius={p.distance} />
                <Planet planet={p} phase={PHASES[i]} />
              </group>
            ))}
            <AsteroidBelt />
            <Comet />
            <LensCapture lenses={lenses} />
            {tools.map((t) =>
              t.type === 'blackhole' ? (
                <BlackHole key={t.id} tool={t} lenses={lenses} />
              ) : t.type === 'whitehole' ? (
                <WhiteHole key={t.id} tool={t} />
              ) : (
                <Wormhole key={t.id} tool={t} lenses={lenses} />
              ),
            )}
            {pendingMouth && <Wormhole tool={{ a: pendingMouth, mouth: SANDBOX.wormhole.mouth }} lenses={lenses} />}
            <Effects effects={effects} onDone={removeEffect} />
          </Suspense>
          <ClickPlane />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            minDistance={0.3}
            maxDistance={600}
            autoRotate={options.autoRotate && !eventType}
            autoRotateSpeed={0.35}
          />
          <CameraRig />
          <EventTimer />
          <LabelProjector />
          {/* Bloom only catches values above 1 (the Sun, hot effects), then tone-map. */}
          {options.showGlow && (
            <EffectComposer multisampling={4}>
              <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.9} radius={0.75} />
              <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            </EffectComposer>
          )}
        </Canvas>
        <Labels />
        <LoadingNote />
        <Hud
          time={time}
          selected={selected}
          onSelect={select}
          view={view}
          onView={setView}
          paused={paused}
          setPaused={setPaused}
          speed={speed}
          setSpeed={setSpeed}
          options={options}
          setOption={setOption}
          onReset={() => {
            setOptions(DEFAULT_OPTIONS)
            setSpeed(1)
            setPaused(false)
            setView('overview')
          }}
          sandbox={{
            armed,
            arm,
            strength,
            setStrength,
            pendingMouth: !!pendingMouth,
            tools,
            removeTool,
            destroyed,
            starPhase,
            triggerSupernova,
            eventType,
            startEvent,
            endEvent,
            restore,
          }}
        />
      </div>
    </SimContext.Provider>
  )
}
