import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, useProgress } from '@react-three/drei'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { SimContext, useSim } from './sim.js'
import { Sky, Sun, Planet, OrbitLine, AsteroidBelt, Comet } from './Bodies.jsx'
import { PLANETS, CAMERA_HOME, VIEWS, BODY_LIST, SECONDS_PER_YEAR } from './data.js'
import Hud from './Hud.jsx'
import { Labels, LabelProjector } from './Labels.jsx'
import './solar.css'

// Starting angles, spread out so the planets don't line up on load.
const PHASES = PLANETS.map((_, i) => (i * 2.39996) % (Math.PI * 2))

const DEFAULT_OPTIONS = {
  showLabels: true,
  labelDetails: false,
  showOrbits: true,
  showBelt: true,
  showSky: true,
  showGlow: true,
  autoRotate: false,
}

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

// Glides the camera to the selected body and keeps following it as it
// orbits. With nothing selected, glides once to the current view preset.
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
      following: null,
      homePos: new THREE.Vector3(),
      homeTarget: new THREE.Vector3(...CAMERA_HOME.target),
    }),
    [],
  )

  // Start framed for this screen shape (and reframe on resize while in a view).
  useLayoutEffect(() => {
    viewPosition(sim.view.current, aspect, v.homePos)
    if (!sim.selected.current) camera.position.copy(v.homePos)
  }, [aspect, camera, sim, v])

  useFrame((_, dt) => {
    if (!controls) return
    const k = 1 - Math.exp(-dt * 3.5)
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
        camera.position.sub(controls.target).setLength(next).add(controls.target)
        if (Math.abs(next - want) < 0.05 && controls.target.distanceTo(v.target) < 0.05) {
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

export default function SolarSystem() {
  const [selected, setSelected] = useState(null)
  const [view, setViewState] = useState('overview')
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [options, setOptions] = useState(DEFAULT_OPTIONS)
  const setOption = useCallback((key, value) => setOptions((o) => ({ ...o, [key]: value })), [])

  const time = useRef(0)
  const speedRef = useRef(speed)
  const pausedRef = useRef(paused)
  const selectedRef = useRef(null)
  const viewRef = useRef('overview')
  const lastSelected = useRef(null)
  const flying = useRef(false)
  const bodies = useRef({})
  const labelEls = useRef({})
  speedRef.current = speed
  pausedRef.current = paused

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

  // Keyboard: Space pauses, ← / → step through the bodies, Esc returns to the view.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, select, textarea')) return
      if (e.key === ' ' && !e.target.closest?.('button, summary, a')) {
        e.preventDefault()
        setPaused((p) => !p)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const i = BODY_LIST.findIndex((b) => b.name === selectedRef.current)
        const step = e.key === 'ArrowRight' ? 1 : -1
        const next = i === -1 ? (step > 0 ? 0 : BODY_LIST.length - 1) : (i + step + BODY_LIST.length) % BODY_LIST.length
        select(BODY_LIST[next].name)
      } else if (e.key === 'Escape') {
        select(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [select])

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
      select,
      register,
      ...options,
    }),
    [select, register, options],
  )

  return (
    <SimContext.Provider value={sim}>
      <div className="solar">
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
          </Suspense>
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            minDistance={2}
            maxDistance={600}
            autoRotate={options.autoRotate}
            autoRotateSpeed={0.35}
          />
          <CameraRig />
          <LabelProjector />
          {/* Bloom only catches values above 1 (the Sun, the comet), then tone-map. */}
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
        />
      </div>
    </SimContext.Provider>
  )
}
