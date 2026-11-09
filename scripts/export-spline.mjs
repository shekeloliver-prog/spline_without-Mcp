// Builds exports/solar-system-for-spline.glb: the solar system as one file
// to import into a new Spline project (File → Import, or drag it onto the
// canvas).
//
// It reuses the meshes from the original Spline file (Sphere, Cube, Path),
// so everything stays in Spline's own units and comes in at a familiar size.
// Every object is named (Sun, Earth, Orbit · Mars, Asteroid belt…) so it is
// easy to find in Spline's object list.
//
// Only static, standard glTF goes in: textured meshes and transparency.
// Motion, glow/bloom, shaders, labels and the UI live in the web app and
// can't travel in a .glb. Re-create motion with Spline's own animation
// states if you want it there.
//
//   npm run export:spline
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SUN, PLANETS, ASTEROID_BELT, COMET, DWARFS, KUIPER_BELT, SPACECRAFT, auToScene, moonsOf } from '../src/solar/data.js'
import { keplerPosition, orbitPoints } from '../src/solar/orbits.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'exports/solar-system-for-spline.glb')
const TEX = join(ROOT, 'public/textures')
const U = 100 // Spline units per scene unit (the original export scales by 0.01)

// Same starting angles as the web app, so the layout matches its first frame.
// (PHASES is used again by the spacecraft section to find Earth.)
const PHASES = PLANETS.map((_, i) => (i * 2.39996) % (Math.PI * 2))

const io = new NodeIO()
const doc = await io.read(join(ROOT, 'spline_3_d_starter_file.glb'))
const root = doc.getRoot()
const buffer = root.listBuffers()[0]
const byName = (n) => root.listNodes().find((node) => node.getName() === n).getMesh()
const sphereMesh = byName('Sphere')
const cubeMesh = byName('Cube')
const pathMesh = byName('Path')
const SPHERE_R = 587.1593 // radius of the Spline Sphere, in Spline units
const CUBE_SIZE = 510.7353

// Start from an empty scene that keeps only those three meshes' data.
for (const scene of root.listScenes()) scene.dispose()
for (const node of root.listNodes()) node.dispose()
for (const cam of root.listCameras()) cam.dispose()
const scene = doc.createScene('Solar System')
// No scale on the root: the file is in Spline units directly (the Sun's
// radius is 700, about the size of the starter scene's sphere). An earlier
// version copied Spline's own 0.01 root scale, and the whole system came in
// as a tiny clump.
const top = doc.createNode('Solar System')
scene.addChild(top)

// ------------------------------------------------------------ helpers
const textures = new Map()
function texture(file) {
  if (!textures.has(file)) {
    const mime = file.endsWith('.png') ? 'image/png' : 'image/jpeg'
    textures.set(file, doc.createTexture(file).setImage(readFileSync(join(TEX, file))).setMimeType(mime))
  }
  return textures.get(file)
}

function material(name, { map, color = [1, 1, 1, 1], emissive, rough = 0.9, metal = 0, blend = false, double = false }) {
  const m = doc.createMaterial(name).setBaseColorFactor(color).setRoughnessFactor(rough).setMetallicFactor(metal)
  if (map) m.setBaseColorTexture(texture(map))
  if (emissive) m.setEmissiveTexture(texture(emissive)).setEmissiveFactor([1, 1, 1])
  if (blend) m.setAlphaMode('BLEND')
  if (double) m.setDoubleSided(true)
  return m
}

// A copy of one of the Spline meshes with its own material. Primitives are
// cloned (a cloned mesh would share them); their vertex data stays shared.
function reuse(mesh, name, mat) {
  const copy = doc.createMesh(name)
  mesh.listPrimitives().forEach((p) => copy.addPrimitive(p.clone().setMaterial(mat)))
  return copy
}

// three.js BufferGeometry -> glTF mesh.
function meshFrom(geo, name, mat) {
  const prim = doc.createPrimitive().setMaterial(mat)
  const attr = (key, type) =>
    doc.createAccessor().setType(type).setArray(new Float32Array(geo.attributes[key].array)).setBuffer(buffer)
  prim.setAttribute('POSITION', attr('position', 'VEC3'))
  if (geo.attributes.normal) prim.setAttribute('NORMAL', attr('normal', 'VEC3'))
  if (geo.attributes.uv) prim.setAttribute('TEXCOORD_0', attr('uv', 'VEC2'))
  if (geo.index) prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(geo.index.array)).setBuffer(buffer))
  return doc.createMesh(name).addPrimitive(prim)
}

function addNode(parent, name, { mesh, pos = [0, 0, 0], rot, scale } = {}) {
  const n = doc.createNode(name).setTranslation(pos)
  if (mesh) n.setMesh(mesh)
  if (rot) n.setRotation(rot)
  if (scale !== undefined) n.setScale(typeof scale === 'number' ? [scale, scale, scale] : scale)
  parent.addChild(n)
  return n
}

const quat = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)).toArray()
const sphereScale = (r) => (r * U) / SPHERE_R

// ------------------------------------------------------------ the Sun
const sunMat = material('Sun', { map: 'sun.jpg', emissive: 'sun.jpg', rough: 1 })
addNode(top, 'Sun', { mesh: reuse(sphereMesh, 'Sun', sunMat), scale: sphereScale(SUN.radius) })

// ------------------------------------------------------------ planets
const MAP_FILE = {
  mercury: 'mercury.jpg', venus: 'venus_atmosphere.jpg', earth: 'earth_day.jpg', mars: 'mars.jpg',
  jupiter: 'jupiter.jpg', saturn: 'saturn.jpg', uranus: 'uranus.jpg', neptune: 'neptune.jpg',
}
const orbitMat = material('Orbit line', { color: [0.55, 0.62, 0.8, 0.35], rough: 1, blend: true })
const dwarfOrbitMat = material('Dwarf orbit line', { color: [0.65, 0.59, 0.78, 0.35], rough: 1, blend: true })

// A body's major moons, placed where the app shows them on its first frame
// (angle = phase, in the parent's equatorial plane plus each moon's own
// inclination). Shapes as in the app: lunar map tinted, plain tint, or rock.
function addMoons(parentName, tilt) {
  for (const m of moonsOf(parentName)) {
    const plane = addNode(tilt, `${m.name} · orbit plane`, { rot: quat(((m.incl ?? 0) * Math.PI) / 180, 0, 0) })
    const pos = [Math.cos(m.phase) * m.distance * U, 0, -Math.sin(m.phase) * m.distance * U]
    const mat = material(m.name, {
      map: m.shape === 'cratered' ? 'moon.jpg' : undefined,
      color: [...new THREE.Color(m.tint).toArray(), 1],
      rough: m.shape === 'smooth' ? 0.8 : 1,
    })
    if (m.shape === 'rock') {
      const g = makeRock(m.name.length * 7 + 3)
      g.computeBoundingSphere()
      addNode(plane, m.name, { mesh: meshFrom(g, m.name, mat), pos, scale: (m.radius * U) / g.boundingSphere.radius })
    } else {
      addNode(plane, m.name, { mesh: reuse(sphereMesh, m.name, mat), pos, scale: sphereScale(m.radius) })
    }
  }
}

PLANETS.forEach((p, i) => {
  const a = PHASES[i]
  const pos = [Math.cos(a) * p.distance * U, 0, -Math.sin(a) * p.distance * U]
  const holder = addNode(top, p.name, { pos })
  const tilt = addNode(holder, `${p.name} · tilt`, { rot: quat(0, 0, (p.tilt * Math.PI) / 180) })
  const mat = material(p.name, { map: MAP_FILE[p.map], rough: 0.95 })
  addNode(tilt, `${p.name} · surface`, { mesh: reuse(sphereMesh, p.name, mat), scale: sphereScale(p.radius) })

  if (p.ring) {
    // Real radial ring profile: UVs run from the inner to the outer edge.
    const g = new THREE.RingGeometry(p.ring.inner * U, p.ring.outer * U, 180, 1)
    const v = new THREE.Vector3()
    for (let k = 0; k < g.attributes.position.count; k++) {
      v.fromBufferAttribute(g.attributes.position, k)
      g.attributes.uv.setXY(k, (v.length() - p.ring.inner * U) / ((p.ring.outer - p.ring.inner) * U), 0.5)
    }
    g.rotateX(-Math.PI / 2)
    const ringMat = material('Saturn rings', { map: 'saturn_ring.png', rough: 1, blend: true, double: true })
    addNode(tilt, 'Saturn · rings', { mesh: meshFrom(g, 'Saturn rings', ringMat) })
  }

  if (p.moon) {
    const moonMat = material('Moon', { map: 'moon.jpg', rough: 1 })
    addNode(holder, 'Moon', { mesh: reuse(sphereMesh, 'Moon', moonMat), pos: [p.moon.distance * U, 0, 0], scale: sphereScale(p.moon.radius) })
  }

  if (p.satellite) {
    const s = p.satellite.size * U
    const sat = addNode(holder, 'Satellite', { pos: [0, p.satellite.distance * U * 0.5, -p.satellite.distance * U * 0.85] })
    const gold = material('Satellite foil', { color: [0.78, 0.6, 0.23, 1], rough: 0.32, metal: 0.7 })
    addNode(sat, 'Satellite · body', { mesh: reuse(cubeMesh, 'Satellite body', gold), scale: s / CUBE_SIZE })
    const panelMat = material('Solar panel', { color: [0.08, 0.13, 0.24, 1], rough: 0.25, metal: 0.5 })
    const panel = meshFrom(new THREE.BoxGeometry(s * 2.2, s * 0.04, s * 0.8), 'Solar panel', panelMat)
    addNode(sat, 'Satellite · panel L', { mesh: panel, pos: [-s * 1.7, 0, 0] })
    addNode(sat, 'Satellite · panel R', { mesh: panel, pos: [s * 1.7, 0, 0] })
  }

  // Major moons, in the planet's equatorial plane, where they are at the
  // app's first frame.
  addMoons(p.name, tilt)

  // Orbit line: a thin flat torus.
  const torus = new THREE.TorusGeometry(p.distance * U, 6, 4, 256)
  torus.rotateX(Math.PI / 2)
  addNode(top, `Orbit · ${p.name}`, { mesh: meshFrom(torus, `Orbit · ${p.name}`, orbitMat) })
})

// ------------------------------------------------------------ asteroid belt
// The Spline Cube roughened into rocks (a lighter cousin of src/solar/rocks.js).
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function cubeGeometry() {
  const prim = cubeMesh.listPrimitives()[0]
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(prim.getAttribute('POSITION').getArray()), 3))
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(prim.getIndices().getArray()), 1))
  return g
}
function makeRock(seed) {
  const random = rng(seed)
  const g = mergeVertices(cubeGeometry())
  const pos = g.attributes.position
  const p = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const half = CUBE_SIZE / 2
  const bumps = Array.from({ length: 6 }, () => [new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize(), (random() - 0.5) * 0.5])
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    dir.copy(p).normalize()
    p.lerp(dir.clone().multiplyScalar(half), 0.55)
    let n = 0
    for (const [b, h] of bumps) n += Math.max(0, dir.dot(b)) ** 3 * h
    p.addScaledVector(dir, n * half)
    pos.setXYZ(i, p.x, p.y, p.z)
  }
  g.computeVertexNormals()
  return g
}
{
  // Three rock shapes stored once; each asteroid is a light object that
  // points at one of them, all grouped under "Asteroid belt".
  const random = rng(7)
  const rockMat = material('Asteroid rock', { color: [0.36, 0.33, 0.3, 1], rough: 1 })
  const rocks = [11, 23, 37].map((seed, k) => meshFrom(makeRock(seed), `Rock ${k + 1}`, rockMat))
  const belt = addNode(top, 'Asteroid belt')
  const count = 240
  for (let i = 0; i < count; i++) {
    const a = random() * Math.PI * 2
    const d = ASTEROID_BELT.inner + (ASTEROID_BELT.outer - ASTEROID_BELT.inner) * ((random() + random() + random()) / 3)
    const size = (ASTEROID_BELT.size[0] + (ASTEROID_BELT.size[1] - ASTEROID_BELT.size[0]) * random() ** 2) * 1.6
    const k = (size * U) / CUBE_SIZE
    addNode(belt, `Asteroid ${i + 1}`, {
      mesh: rocks[i % 3],
      pos: [Math.cos(a) * d * U, (random() - 0.5) * ASTEROID_BELT.thickness * U, -Math.sin(a) * d * U],
      rot: quat(random() * 6, random() * 6, random() * 6),
      scale: [k, k * (0.7 + random() * 0.6), k * (0.8 + random() * 0.4)],
    })
  }
}

// ------------------------------------------------------------ dwarf planets
for (const d of DWARFS) {
  const pos = keplerPosition(d.orbit, 0, new THREE.Vector3()).multiplyScalar(U)
  const holder = addNode(top, d.name, { pos: pos.toArray() })
  const tilt = addNode(holder, `${d.name} · tilt`, { rot: quat(0, 0, (d.tilt * Math.PI) / 180) })
  const mat = material(d.name, {
    map: d.shape === 'cratered' ? 'moon.jpg' : undefined,
    color: [...new THREE.Color(d.tint).toArray(), 1],
    rough: d.shape === 'smooth' ? 0.75 : 1,
  })
  const k = sphereScale(d.radius)
  const [sx, sy, sz] = d.stretch ?? [1, 1, 1]
  addNode(tilt, `${d.name} · surface`, { mesh: reuse(sphereMesh, d.name, mat), scale: [k * sx, k * sy, k * sz] })
  addMoons(d.name, tilt)
  // Its tilted, oval orbit as a thin tube.
  const curve = new THREE.CatmullRomCurve3(orbitPoints(d.orbit, 240).slice(0, -1).map((q) => new THREE.Vector3(...q).multiplyScalar(U)), true)
  const tube = new THREE.TubeGeometry(curve, 480, 6, 4, true)
  addNode(top, `Orbit · ${d.name}`, { mesh: meshFrom(tube, `Orbit · ${d.name}`, dwarfOrbitMat) })
}

// ------------------------------------------------------------ Kuiper belt
{
  const random = rng(KUIPER_BELT.seed)
  const icy = material('Kuiper rock', { color: [...KUIPER_BELT.color, 1], rough: 1 })
  const rocks = [41, 53, 67].map((seed, k) => meshFrom(makeRock(seed), `Kuiper rock ${k + 1}`, icy))
  const belt = addNode(top, 'Kuiper belt')
  for (let i = 0; i < 180; i++) {
    const a = random() * Math.PI * 2
    const d = KUIPER_BELT.inner + (KUIPER_BELT.outer - KUIPER_BELT.inner) * ((random() + random() + random()) / 3)
    const size = (KUIPER_BELT.size[0] + (KUIPER_BELT.size[1] - KUIPER_BELT.size[0]) * random() ** 2) * 2.2
    const k = (size * U) / CUBE_SIZE
    addNode(belt, `Kuiper object ${i + 1}`, {
      mesh: rocks[i % 3],
      pos: [Math.cos(a) * d * U, (random() - 0.5) * KUIPER_BELT.thickness * U * (0.3 + random()), -Math.sin(a) * d * U],
      rot: quat(random() * 6, random() * 6, random() * 6),
      scale: [k, k * (0.7 + random() * 0.6), k * (0.8 + random() * 0.4)],
    })
  }
}

// ------------------------------------------------------------ spacecraft
// Simple stand-ins (the Spline Cube in gold foil plus a white dish), placed
// where the app shows them on its first frame. Small, so look for their names.
{
  const earthIndex = PLANETS.findIndex((p) => p.name === 'Earth')
  const ea = PHASES[earthIndex]
  const earth = new THREE.Vector3(Math.cos(ea), 0, -Math.sin(ea)).multiplyScalar(PLANETS[earthIndex].distance)
  const foil = material('Spacecraft foil', { color: [0.78, 0.6, 0.23, 1], rough: 0.32, metal: 0.7 })
  const white = material('Spacecraft dish', { color: [0.94, 0.93, 0.9, 1], rough: 0.6, double: true })
  const dish = meshFrom(new THREE.ConeGeometry(0.85, 0.35, 32, 1, true).rotateX(Math.PI), 'Dish', white)
  for (const c of SPACECRAFT) {
    const pos = new THREE.Vector3()
    if (c.orbit === 'earth') pos.copy(earth).add(new THREE.Vector3(c.distance, 0, 0))
    else if (c.orbit === 'l2') pos.copy(earth).addScaledVector(earth.clone().normalize(), c.distance)
    else if (c.orbit === 'kepler') keplerPosition(c.elements, 0, pos)
    else {
      const l = (c.lon * Math.PI) / 180
      const b = (c.lat * Math.PI) / 180
      pos.set(Math.cos(b) * Math.cos(l), Math.sin(b), -Math.cos(b) * Math.sin(l)).multiplyScalar(auToScene(c.au))
    }
    // Enlarged ×3 so they can be found in Spline at all.
    const s = c.size * 3 * U
    const craft = addNode(top, c.name, { pos: pos.multiplyScalar(U).toArray() })
    addNode(craft, `${c.name} · body`, { mesh: reuse(cubeMesh, `${c.name} body`, foil), scale: (s * 0.7) / CUBE_SIZE })
    addNode(craft, `${c.name} · dish`, { mesh: dish, pos: [0, s * 0.5, 0], scale: s })
  }
}

// ------------------------------------------------------------ comet + your Path
{
  const outer = addNode(top, 'Comet orbit (your Spline Path)', {
    pos: COMET.offset.map((v) => v * U),
    rot: quat(...COMET.rotation),
    scale: COMET.scale * U,
  })
  const inner = addNode(outer, 'Comet orbit · centred', { pos: COMET.anchor.map((v) => -v) })
  const trackMat = material('Comet track', { color: [0.56, 0.69, 0.88, 0.4], rough: 1, blend: true })
  addNode(inner, 'Comet track', { mesh: reuse(pathMesh, 'Comet track', trackMat) })
  // The comet sits on the first point of the path, the near-Sun end.
  const cometMat = material('Comet', { color: [0.9, 0.96, 1, 1], rough: 0.6 })
  addNode(inner, 'Comet', { mesh: reuse(sphereMesh, 'Comet', cometMat), scale: (COMET.radius * 2) / COMET.scale / SPHERE_R })
}

// Flatten: every object carries its full position, rotation and scale itself,
// directly under the root (which has no transform). Nothing depends on how
// an importer treats nested groups. Only the belt rocks stay inside their
// "Asteroid belt" / "Kuiper belt" groups, which also have no transform.
{
  const belts = top.listChildren().filter((n) => n.getName() === 'Asteroid belt' || n.getName() === 'Kuiper belt')
  const keep = new Set([top, ...belts])
  const meshNodes = []
  scene.traverse((n) => {
    if (n.getMesh() && !keep.has(n.getParentNode())) meshNodes.push(n)
  })
  for (const n of meshNodes) {
    const world = n.getWorldMatrix()
    n.getParentNode().removeChild(n)
    n.setMatrix(world)
    top.addChild(n)
  }
  // Remove the now-empty positioning groups.
  let removed = true
  while (removed) {
    removed = false
    scene.traverse((n) => {
      if (!keep.has(n) && !n.getMesh() && n.listChildren().length === 0) {
        n.dispose()
        removed = true
      }
    })
  }
  // Give the surfaces their planet's plain name ("Earth", not "Earth · surface").
  for (const n of top.listChildren()) n.setName(n.getName().replace(' · surface', ''))
}

// Drop meshes/materials left over from the original scene.
for (const mesh of [sphereMesh, cubeMesh, pathMesh]) mesh.dispose()
for (const mat of root.listMaterials()) if (mat.listParents().length <= 1) mat.dispose()

mkdirSync(dirname(OUT), { recursive: true })
await io.write(OUT, doc)
const kb = Math.round(readFileSync(OUT).length / 1024)
console.log(`Wrote ${OUT} (${kb} KB): ${root.listNodes().length} objects, ${root.listMeshes().length} meshes, ${textures.size} textures`)
