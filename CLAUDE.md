# Spline scene + solar system (Vite + React + react-three-fiber)

One Vite app with two views, both built from the Spline export
`spline_3_d_starter_file.glb`:

| URL hash          | View |
| ----------------- | ---- |
| `#/` (default)    | **Solar system**: an animated, clickable solar system whose bodies reuse the GLB's meshes |
| `#/spline`        | **Spline scene**: the original Spline starter scene, recreated as closely as the export allows |

`src/App.jsx` switches between them on `hashchange`. Only one `<Canvas>` is
mounted at a time.

## Commands

- `npm install`: install dependencies
- `npm run dev`: start the Vite dev server on http://localhost:5173 (also bound to the network)
- `npm run build`: production build into `dist/` (git-ignored)
- `npm run preview`: serve the production build

Stack: React 19, three 0.187, @react-three/fiber 9, @react-three/drei 10, Vite 8.
The solar view loads real planet maps from `public/textures/` (about 2.4 MB;
sources and licenses are in `CREDITS.md`). The Spline view loads no images.

## Files

```
.
├── spline_3_d_starter_file.glb          Original Spline export (source of truth, ~370 KB)
├── CREDITS.md                           Texture sources and licenses
├── public/
│   ├── spline_3_d_starter_file-transformed.glb   Optimized, Draco-compressed copy the app loads (~43 KB)
│   ├── draco/                           Draco decoder copied from three/examples/jsm/libs/draco/gltf
│   └── textures/                        Planet maps, rings, Earth layers, Milky Way (see CREDITS.md)
├── index.html                           Vite entry, mounts #root
├── vite.config.js                       React plugin; dev server host: true, port 5173
└── src/
    ├── main.jsx                         createRoot, renders <App/>
    ├── App.jsx                          Hash router: solar system (default) or #/spline
    ├── assets.js                        MODEL_URL + DRACO_URL, shared by both views (one download, cached)
    ├── index.css                        Full-viewport layout, back link on the Spline view
    │
    ├── Scene.jsx                        Spline view: <Canvas>, lights, environment, OrbitControls, <Model/>
    ├── Model.jsx                        gltfjsx output plus a few hand edits (see below)
    ├── sceneConfig.js                   Spline view tunables: camera, orbit target, background, lights, materials
    │
    └── solar/
        ├── SolarSystem.jsx              Solar view root: state, context, <Canvas>, Clock, CameraRig, bloom, loading note
        ├── Bodies.jsx                   Sky, Sun, Planet (+EarthSurface, Ring, Moon, Satellite), OrbitLine, AsteroidBelt, Comet
        ├── Labels.jsx                   DOM name labels + LabelProjector, which positions them every frame
        ├── Hud.jsx                      Overlay UI: title, play/pause, speed, toggles, info card, fly-to bar
        ├── data.js                      All solar tunables and facts: SUN, PLANETS, ASTEROID_BELT, COMET, camera
        ├── sim.js                       SimContext/useSim, useSplineGeometry, orbitAngle, SPIN_SCALE
        ├── textureUrls.js               TEXTURES: key -> image URL (the one place image paths live)
        ├── textures.js                  useMaps(...keys) loader (colour space, anisotropy), glowTexture, rng
        ├── shaders.js                   Earth night-lights patch, atmosphere rim shader, comet tail shader
        ├── rocks.js                     makeRock(): roughens the Spline Cube into asteroid shapes
        └── solar.css                    HUD and label styles (responsive below 760px)
```

## Solar system view

### How the Spline file is reused

`useSplineGeometry()` (sim.js) loads the same GLB as the Spline view and
returns its three geometries, plus their native sizes so they can be resized:

| GLB mesh | Becomes |
| -------- | ------- |
| **Sphere** | The Sun, all 8 planets, the Moon, Earth's cloud and atmosphere shells, the comet head and the Milky Way sky (inside-out, radius 1500). Scaled by `radius / sphereRadius`. |
| **Cube** | Earth's satellite (gold-foil body with two solar wings), and the asteroid belt: `makeRock` rounds the cube partway to a sphere and displaces it with 3D noise, three seeds give three rock shapes, ~1,400 instances in total. |
| **Path** | The comet's orbit: its original control points (`SPLINE_PATH_POINTS` in data.js, copied from the GLB's `extras.path`) define both the hairline track and the curve the comet follows. Corners are sharp (Spline roundness 0), so the curve is a closed `CurvePath` of `LineCurve3` segments, sampled with `getPointAt` for constant speed. |

### The realistic look

- **Lighting.** A single point light at the Sun (`decay 0`, so the outer
  planets stay lit) and an ambient light of 0.025, so night sides are nearly
  black.
- **Bloom.** `EffectComposer` applies `Bloom` (threshold 1), then ACES
  `ToneMapping`. Only surfaces brighter than 1 bloom: the Sun (its colour is
  multiplied by about 2) and the comet head. Lit planets stay below 1.
- **Earth.** `EarthSurface` layers four things:
  - a NASA day map with a specular mask, so oceans glint;
  - city lights through `patchNightLights`, which shows the emissive map only
    where the surface faces away from the Sun (the Sun is at the origin);
  - a cloud shell, using `alphaMap`, that turns faster than the ground;
  - an atmosphere shell: an additive Fresnel rim, lit side only.
- **Saturn's rings.** The ring texture is a 1D radial strip, so `Ring`
  rewrites the RingGeometry UVs to "distance from the centre". Radii follow
  the real C-to-A ring span (1.24 to 2.27 Saturn radii).
- **Comet.** Two cones with `tailMaterial`, which is soft at the silhouette
  and fades along the length:
  - a narrow blue ion tail pointing straight away from the Sun;
  - a wider dust tail bent back along the direction of travel.
  Both lengthen as the comet nears the Sun.
- **Labels and orbits.** Kept quiet: small uppercase text with no pill
  background, and orbit lines at 10% opacity.

### Scene graph

```
<SimContext.Provider>
├── <Canvas camera={CAMERA_HOME}>
│   ├── background black, ambientLight 0.025, <Stars> (fine, no twinkle)
│   ├── <Clock>                          useFrame priority -1: advances sim.time (Earth years)
│   ├── <Suspense>                       suspends until the planet maps load (LoadingNote shows %)
│   │   ├── <Sky>                        Milky Way panorama on an inside-out Sphere
│   │   ├── <Sun>                        textured Sphere (HDR colour) + two glow sprites + pointLight (decay 0)
│   │   ├── per planet:
│   │   │   ├── <OrbitLine>              drei <Line> circle at planet.distance
│   │   │   └── <Planet>                 group on the orbit
│   │   │       ├── group rotation-z = axial tilt
│   │   │       │   ├── spin group       PlanetSurface (map) or EarthSurface (4 layers)
│   │   │       │   └── <Ring>           Saturn only
│   │   │       ├── <Moon>               Earth only
│   │   │       └── <Satellite>          Earth only (the Cube)
│   │   ├── <AsteroidBelt>               3 instancedMeshes of roughened Cube rocks; the whole belt turns
│   │   └── <Comet>                      hairline track + hidden anchor in the Path's local frame;
│   │                                    head, coma and ion/dust tails drawn in world space
│   ├── <OrbitControls makeDefault>
│   ├── <CameraRig>                      fly-to / follow selected body; fly home on Overview
│   ├── <LabelProjector>                 projects each body to screen and moves its DOM label
│   └── <EffectComposer>                 Bloom (threshold 1) -> ACES ToneMapping
├── <Labels>                             absolutely positioned <span>s over the canvas
└── <Hud>                                DOM overlay (z-index above labels)
```

### State and the frame loop

- `SolarSystem.jsx` owns UI state (`selected`, `paused`, `speed`,
  `showLabels`, `showOrbits`). It mirrors anything the frame loop reads into
  refs (`sim.time`, `sim.speed`, `sim.paused`, `sim.selected`), so the 3D tree
  doesn't re-render as time passes.
- Every body computes its own position from `sim.time` in `useFrame`, via
  `orbitAngle(t, period, phase)`. Nothing is integrated, so pausing,
  speeding up and slowing down never drift.
- Bodies call `sim.register(name, object3D, radius)`. The camera rig and the
  labels look bodies up by name in `sim.bodies`.
- `sim.select(name)` (HUD buttons, or a click on a body) sets `selected` and
  starts a flight. `CameraRig` moves the target and camera together toward the
  body, dollies to `radius * 5 + 4`, then locks on and follows exactly.
  `select(null)` flies back to `CAMERA_HOME`. On portrait screens the home
  position is pushed back by up to 2.4× so the whole system fits.

### Scale and time

- Sizes and distances are stylised (data.js). Orbital periods keep their real
  ratios to Earth's year.
- `SECONDS_PER_YEAR = 20` at 1× speed. The speed slider steps through 0.25× to 50×.
- Spin uses real day lengths slowed by `SPIN_SCALE = 0.01`. Negative `day`
  values mean retrograde rotation (Venus, Uranus).
- The facts in the info card are real values.

### Comet placement

`COMET` in data.js places the Spline path in the solar system. The path's
local frame (Spline units) is wrapped in two groups: the outer one applies
`offset`, `rotation` and `scale`, and the inner one shifts by `-anchor`. The
point `anchor` (the tight end of the loop) therefore lands at `offset`, and
the long end swings out past Neptune. To move the orbit, change those four
values; the comet stays on the drawn track automatically.

### Labels

Labels are plain DOM nodes positioned by `LabelProjector`, not drei `<Html>`.
Each `<Html>` creates its own React root, and under React 19 those roots threw
`removeChild` errors when the view unmounted. Don't switch back without
testing the `#/spline` round trip.

## Spline view

### Scene graph

```
<Canvas shadows="percentage" camera={CAMERA}>
├── <color attach="background">          BACKGROUND (#f1f1f1)
├── <Lights>
│   ├── ambientLight                     LIGHTS.ambient
│   ├── directionalLight (key, shadows)  LIGHTS.directional, upper right, 2048² shadow map
│   ├── directionalLight (fill)          LIGHTS.fill, cool light from the opposite side
│   └── <Environment>                    Two Lightformers for soft reflections (built in code, no HDRI fetch)
├── <Suspense>
│   └── <Model>                          "Welcome to Spline" contents
│       ├── mesh "Path"                  Closed extruded path (16-sided tube) looping around the sphere
│       ├── mesh "Sphere"                Radius ≈ 5.87, centre (-5.36, 5.87, 2.54); the loop's centre too
│       └── mesh "Cube"                  ≈ 5.1 units, rounded corners, sits on the loop at (-31.2, -1.05, -7.37)
└── <OrbitControls makeDefault>          Target ORBIT_TARGET (sphere centre), damping, distance 10–300
```

Units: Spline works in units about 100× larger than three.js. The export wraps
everything in a node scaled by 0.01. gltfjsx flattens that hierarchy and puts
`scale={0.01}` on each mesh, so positions in `Model.jsx` are already in scene
units.

### What came from the GLB, and what was recreated

From the GLB:
- The three meshes and their transforms.
- The camera: position `(16.1, 32.5, 69.8)`, 45° vertical FOV, near/far 0.7/1000
  after scaling. These values are in `CAMERA`.
- The Path's control points (used by the solar view's comet).

Not in the GLB (Spline's exporter drops them), so they are recreated in code:
- **Materials.** The meshes have none, so `MATERIALS` sets a
  `meshStandardMaterial` for each.
- **Lights.** The only light in the export is an empty "Default Ambient Light"
  node.
- **Background.**

The recreated values approximate Spline's default starter look. To match the
Spline file exactly, copy colours and intensities from the Spline editor into
`sceneConfig.js`.

The orbit target isn't in the export either. It is set to the sphere's centre,
so the initial view stays centred on the group. The camera position is
Spline's.

## Regenerating Model.jsx

```
npx gltfjsx spline_3_d_starter_file.glb --transform --keepmeshes --keepnames
```

- `--keepmeshes` is required. None of the meshes has a material, so plain
  `--transform` treats them as compatible and joins Path, Sphere and Cube into
  one mesh. Both views need them separate: the solar view looks up
  `nodes.Sphere`, `nodes.Cube` and `nodes.Path` by name.
- The command writes `Spline_3_d_starter_file.jsx` and
  `spline_3_d_starter_file-transformed.glb` next to the source. Move the GLB
  into `public/` and the JSX over `src/Model.jsx`.
- Then reapply the hand edits listed in the header of `Model.jsx`:
  1. Import `MODEL_URL` and `DRACO_URL` from `./assets.js` and pass both to
     `useGLTF` and `useGLTF.preload`.
  2. Give each mesh a `<meshStandardMaterial {...MATERIALS.X} />` child.
  3. Add `castShadow receiveShadow` to each mesh.
  4. Remove the generated `<PerspectiveCamera>` (its values live in `CAMERA`).
- If the Spline path changes, also update `SPLINE_PATH_POINTS` in
  `src/solar/data.js` from the original GLB's `meshes[0].primitives[0].extras.path.points`.

## Conventions

- Look-and-feel values live in config files: `sceneConfig.js` for the Spline
  view, `solar/data.js` for the solar view. Keep components free of magic
  numbers where possible.
- In the solar view, anything that changes every frame goes through refs and
  `useFrame`, never React state.
- To add an image, add its file to `public/textures/`, add a key to
  `TEXTURES` in `textureUrls.js` (and to `DATA_TEXTURES` if it is a mask
  rather than a colour), and credit it in `CREDITS.md`.
- Assets load from absolute `/...` paths, so anything the app loads goes in
  `public/`.
