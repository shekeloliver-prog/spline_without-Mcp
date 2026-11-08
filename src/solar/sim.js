import { createContext, useContext, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { MODEL_URL, DRACO_URL } from '../assets.js'

// Shared simulation state. Values read every frame live in refs, so the 3D
// scene never re-renders just because time moved on.
export const SimContext = createContext(null)
export const useSim = () => useContext(SimContext)

// The three meshes from the Spline file, plus the numbers needed to resize
// them: the sphere's radius and the cube's edge length, in their own units.
export function useSplineGeometry() {
  const { nodes } = useGLTF(MODEL_URL, DRACO_URL)
  return useMemo(() => {
    const sphere = nodes.Sphere.geometry
    const cube = nodes.Cube.geometry
    const path = nodes.Path.geometry
    sphere.computeBoundingSphere()
    cube.computeBoundingBox()
    const size = new THREE.Vector3()
    cube.boundingBox.getSize(size)
    return {
      sphere,
      cube,
      path,
      sphereRadius: sphere.boundingSphere.radius,
      cubeSize: size.x,
    }
  }, [nodes])
}

// Wall-clock seconds, for effects that play at real speed (flashes, debris,
// eclipses) whatever the simulation speed.
export const now = () => performance.now() / 1000

// useFrame priority for anything that moves a body. Lower runs first, so
// bodies have their new positions before the camera rig and labels (default
// priority 0) read them. Must stay negative: a positive priority would take
// over rendering. (Clock is -1, PhysicsStep -0.5.)
export const MOVE_PRIORITY = -0.25

// Orbit angle (radians) of a body at time t (Earth years).
export const orbitAngle = (t, period, phase = 0) => phase + (Math.PI * 2 * t) / period

// Planets spin far too fast at true rates for this time scale, so every day
// length is slowed by the same factor. Relative spin speeds stay true.
export const SPIN_SCALE = 0.01
