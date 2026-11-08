import { Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { SimContext, useSim } from './sim.js'
import { Sun, Planet, OrbitLine, AsteroidBelt, Comet } from './Bodies.jsx'
import { PLANETS, CAMERA_HOME, SECONDS_PER_YEAR } from './data.js'
import Hud from './Hud.jsx'
import { Labels, LabelProjector } from './Labels.jsx'
import './solar.css'

// Starting angles, spread out so the planets don't line up on load.
const PHASES = PLANETS.map((_, i) => (i * 2.39996) % (Math.PI * 2))

// Advances simulated time (in Earth years). Runs before the bodies update.
function Clock() {
  const sim = useSim()
  useFrame((_, dt) => {
    if (!sim.paused.current) sim.time.current += (Math.min(dt, 0.1) * sim.speed.current) / SECONDS_PER_YEAR
  }, -1)
  return null
}

// Overview camera position. Portrait screens (phones) back the camera off
// so the whole system still fits across the narrow width.
function homePosition(aspect, out) {
  const back = aspect < 1 ? Math.min(2.4, 1.15 / aspect) : 1
  return out.set(...CAMERA_HOME.position).multiplyScalar(back)
}

// Glides the camera to the selected body and keeps following it as it
// orbits. With nothing selected, glides back to the overview once.
function CameraRig() {
  const sim = useSim()
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const aspect = useThree((s) => s.size.width / s.size.height)
  const v = useMemo(
    () => ({
      target: new THREE.Vector3(),
      delta: new THREE.Vector3(),
      homePos: new THREE.Vector3(),
      homeTarget: new THREE.Vector3(...CAMERA_HOME.target),
    }),
    [],
  )

  // Start framed for this screen shape (and reframe on resize while in overview).
  useLayoutEffect(() => {
    homePosition(aspect, v.homePos)
    if (!sim.selected.current) camera.position.copy(v.homePos)
  }, [aspect, camera, sim, v])

  useFrame((_, dt) => {
    if (!controls) return
    const k = 1 - Math.exp(-dt * 3.5)
    const selected = sim.selected.current
    const body = selected && sim.bodies.current[selected]

    if (body) {
      body.object.getWorldPosition(v.target)
      // Move target and camera together, so the view keeps its angle.
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
      controls.target.lerp(v.homeTarget, k)
      camera.position.lerp(v.homePos, k)
      if (camera.position.distanceTo(v.homePos) < 0.1) sim.flying.current = false
    }
  })
  return null
}

export default function SolarSystem() {
  const [selected, setSelected] = useState(null)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [showLabels, setShowLabels] = useState(true)
  const [showOrbits, setShowOrbits] = useState(true)

  const time = useRef(0)
  const speedRef = useRef(speed)
  const pausedRef = useRef(paused)
  const selectedRef = useRef(null)
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

  const register = useCallback((name, object, radius) => {
    if (object) bodies.current[name] = { object, radius }
  }, [])

  const sim = useMemo(
    () => ({
      time,
      speed: speedRef,
      paused: pausedRef,
      selected: selectedRef,
      lastSelected,
      flying,
      bodies,
      labelEls,
      select,
      register,
      showLabels,
      showOrbits,
    }),
    [select, register, showLabels, showOrbits],
  )

  return (
    <SimContext.Provider value={sim}>
      <div className="solar">
        <Canvas
          dpr={[1, 2]}
          camera={{ position: CAMERA_HOME.position, fov: CAMERA_HOME.fov, near: 0.1, far: 3000 }}
          onPointerMissed={() => document.body.style.removeProperty('cursor')}
        >
          <color attach="background" args={['#03040a']} />
          <ambientLight intensity={0.12} />
          <Stars radius={600} depth={200} count={6000} factor={6} saturation={0.2} fade speed={0.4} />
          <Clock />
          <Suspense fallback={null}>
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
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={2} maxDistance={600} />
          <CameraRig />
          <LabelProjector />
        </Canvas>
        <Labels />
        <Hud
          time={time}
          selected={selected}
          onSelect={select}
          paused={paused}
          setPaused={setPaused}
          speed={speed}
          setSpeed={setSpeed}
          showLabels={showLabels}
          setShowLabels={setShowLabels}
          showOrbits={showOrbits}
          setShowOrbits={setShowOrbits}
        />
      </div>
    </SimContext.Provider>
  )
}
