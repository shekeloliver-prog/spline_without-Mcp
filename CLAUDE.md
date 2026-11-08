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
        ├── Labels.jsx                   LABELS list, DOM labels + LabelProjector (positions, LOD, selected highlight)
        ├── Hud.jsx                      Overlay UI: play/pause, speed, Options (views, toggles, keys, reset), info card, fly-to bar
        ├── data.js                      Tunables and facts: SUN, MOON, PLANETS, MOONS (major moons), ASTEROID_BELT,
        │                                COMET, VIEWS, BODY_LIST (fly-to bar), ALL_BODIES, labelDetail, SANDBOX
        ├── sim.js                       SimContext/useSim, useSplineGeometry, orbitAngle, SPIN_SCALE, MOVE_PRIORITY, now
        ├── textureUrls.js               TEXTURES: key -> image URL (the one place image paths live)
        ├── textures.js                  useMaps(...keys) loader (colour space, anisotropy), glowTexture, rng
        ├── shaders.js                   patchSurface (eclipse shadows, night lights), atmosphere, comet tail,
        │                                lens, accretion disk, supernova shell, corona texture
        ├── physics.js                   Sandbox gravity: free bodies, attractors, wormholes, supernova shock
        ├── Sandbox.jsx                  ClickPlane, PhysicsStep, LensCapture/Lens, BlackHole, WhiteHole,
        │                                Wormhole, Effects (Flash, Debris, Impactor, SupernovaShell)
        ├── rocks.js                     makeRock(): roughens the Spline Cube into asteroid shapes
        ├── orbits.js                    keplerPosition/keplerState/orbitPoints: dwarf-planet ellipses on the stylised scale
        ├── SizeLineup.jsx               "Sizes" view: planets, Moon and Pluto at true relative size beside the Sun
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
│   │   │       │   ├── <Ring>           Saturn only
│   │   │       │   └── <PlanetMoon>×n   major moons, in the equatorial plane (+ own inclination)
│   │   │       ├── <Moon>               Earth only
│   │   │       └── <Satellite>          Earth only (the Cube)
│   │   ├── <AsteroidBelt>               3 instancedMeshes of roughened Cube rocks; the whole belt turns
│   │   ├── <AsteroidBelt config={KUIPER_BELT}>   same component, icy rocks beyond Neptune
│   │   ├── per dwarf planet: <DwarfOrbitLine> + <DwarfPlanet> (+ Charon for Pluto)
│   │   ├── <Comet>                      hairline track + hidden anchor in the Path's local frame;
│   │   │                                head, coma and ion/dust tails drawn in world space
│   │   └── <SizeLineup>                 far behind the Sun; only visible in the Sizes view
│   ├── <OrbitControls makeDefault>
│   ├── <CameraRig>                      fly-to / follow selected body; fly home on Overview
│   ├── <LabelProjector>                 projects each body to screen and moves its DOM label
│   └── <EffectComposer>                 Bloom (threshold 1) -> ACES ToneMapping
├── <Labels>                             absolutely positioned <span>s over the canvas
└── <Hud>                                DOM overlay (z-index above labels)
```

### State and the frame loop

- `SolarSystem.jsx` owns UI state: `selected`, `view`, `paused`, `speed`, and
  `options`. The `options` object holds `showLabels`, `labelDetails`,
  `showOrbits`, `showBelt`, `showSky`, `showGlow` and `autoRotate`, starting
  from `DEFAULT_OPTIONS`, and is spread into the sim context. Anything the
  frame loop reads is mirrored into refs (`sim.time`, `sim.speed`,
  `sim.paused`, `sim.selected`, `sim.view`), so the 3D tree doesn't re-render
  as time passes.
- What each option does:
  - `showBelt` and `showSky` toggle `visible` on the belt and the sky, so
    nothing remounts.
  - `showGlow` mounts or unmounts the `EffectComposer`; it restores the
    renderer's tone mapping when removed.
  - `autoRotate` is passed to OrbitControls.
- Every body computes its own position from `sim.time` in `useFrame`, via
  `orbitAngle(t, period, phase)`. Nothing is integrated, so pausing,
  speeding up and slowing down never drift.
- Bodies call `sim.register(name, object3D, radius)`. The camera rig and the
  labels look bodies up by name in `sim.bodies`.
- `sim.select(name)` (HUD buttons, or a click on a body) sets `selected` and
  starts a flight. `CameraRig` moves the target and camera together toward the
  body, dollies to `radius * 5 + 4`, then locks on and follows exactly.
  `select(null)` flies back to the current view preset (`VIEWS`: overview,
  top, side); `setView(name)` switches preset and leaves any followed body.
  On portrait screens the view position is pushed back by up to 2.4× so the
  whole system fits.
- Following a body happens in two steps each frame. First the target and
  camera move by the body's own displacement since the last frame. Then they
  ease across the remaining gap. The first step is what keeps fast bodies,
  such as Io (one lap of Jupiter in about 1 s at 1×), from drifting out of
  view.
- Keyboard (window listener in `SolarSystem.jsx`):
  - <kbd>Space</kbd> pauses, unless focus is on a button or link.
  - <kbd>←</kbd> / <kbd>→</kbd> step through `BODY_LIST`.
  - <kbd>Esc</kbd> returns to the view.

### Moons

`MOONS` (data.js) lists the major moons of Mars, Jupiter, Saturn, Uranus
and Neptune: 20 in all. Earth's Moon stays separate as `MOON`, with its
eclipse logic. Each entry stores real values: diameter, distance, period
(negative = retrograde) and inclination. Scene values are derived from them:
- **Radius:** same scale as Earth's Moon (km ÷ Earth radius), at least
  0.045 so tiny moons stay clickable.
- **Distance:** `planetRadius × (1.4 + 0.5·√(realDistance / planetRadiusKm))`,
  compressed so each system fits between its neighbours' orbits.
- **Period:** `MOON_TIME_SLOW` (10×) slower than real, and never faster than
  a one-day orbit. Earth's Moon uses the same rule (27.3 d → 15 s per lap at
  1×).
- **Inclination:** a tilt over 90° (Triton) already reverses the orbit, so
  the period's sign is ignored then.

`PlanetMoon` renders each moon inside its planet's tilt group, so moons
orbit the equator. Uranus's moons therefore circle it on its side. Shapes:
- `cratered`: the lunar map tinted;
- `smooth`: a plain tint (Titan, Europa, Enceladus);
- `rock`: a roughened Spline Cube (Phobos, Deimos, Proteus).

Moons are not in the fly-to bar; only Earth's Moon is. Clicking a moon
selects it and shows its fact card (`ALL_BODIES` in the HUD). The impactor
can destroy any moon on its own. Destroying a planet also destroys its moons
(`destroy` cascades via `moonsOf`). Moon labels are minor, so they only
appear up close.

### Dwarf planets and the Kuiper belt

`DWARFS` (data.js) holds Ceres, Pluto, Haumea, Makemake and Eris with their
real orbital elements: a, e, i, node, argument of perihelion, period, and
a starting mean anomaly `M0`.
- **Position.** `keplerPosition` (orbits.js) solves Kepler's equation in AU,
  rotates into the ecliptic, then maps the distance from the Sun through
  `auToScene`. That function is piecewise-linear through the planets'
  stylised distances, then 1.05 units per AU beyond Neptune. Because the
  remapping is radial, Pluto still dips just inside Neptune's orbit at
  perihelion.
- **Drawing.** `DwarfOrbitLine` draws each tilted ellipse in a slightly
  violet colour. Haumea is stretched into its egg shape (`stretch`).
- **Charon.** It is in `MOON_DATA.Pluto`, so `MOONS` (built from planets and
  dwarfs) includes it, and destroying Pluto takes Charon with it.
- **Sandbox.** Dwarf planets are full physics bodies: `resetPhysics(...,
  DWARFS)`, plus `activate(..., DWARF_PHYSICS)`, whose `stateAt` is
  `keplerState`.
- **Fly-to bar.** They follow a divider after Neptune.

The Kuiper belt is `<AsteroidBelt config={KUIPER_BELT}>`. The belt
component takes its name, size, seed, colour and period from its config,
and works with the physics exactly like the asteroid belt.

### Today's sky, the tour and the Sizes view

- **Today's sky** (Options → Time). `realPhases(date, t)` turns JPL mean
  longitudes (`MEAN_LONGITUDE`) and the Moon's mean longitude into
  starting angles, stored in `sim.phases`. Planets and Earth's Moon read them
  in preference to their default phases. It also sets `sim.epoch`
  (`{ t0, ms0 }`), so the HUD shows the simulated calendar date, and it
  pauses. Mean longitudes ignore eccentricity, so positions are approximate
  (within about 20° for Mercury and Mars, much closer for the rest). Dwarf
  planets keep their default positions.
- **Tour** (button beside Pause). It steps through `TOUR` (stop and
  caption) every `TOUR_SECONDS`, skipping destroyed bodies. It has
  Back / Hold / Next controls. Ending it (button, Esc, or using the fly-to
  bar or a view button) returns to the view.
- **Sizes view.** A fourth `VIEWS` preset; view presets may now carry their
  own `target`. `SizeLineup` lays out `SIZE_LINEUP.bodies` at true relative
  size (Earth radius = 0.9 units). Saturn gets its ring width, and small
  worlds get a minimum slot so their labels fit. A Sun edge is drawn at the
  same scale, and the line-up is lit by the real Sun from in front. It is
  only visible in that view. Its labels (`size:*`) show only there.

### Frame order and the camera

- Anything that moves a body runs its `useFrame` at `MOVE_PRIORITY` (−0.25).
  The camera rig and the labels run at the default 0, so they read this
  frame's positions. Keep moving code at `MOVE_PRIORITY` (never positive,
  which would take over rendering). Without this, the rig chases where a
  fast moon was a frame ago and loses it.
- While flying to a body, the camera swings round to a three-quarter view
  from the sunlit side, so it never arrives facing a black night side. It
  only locks on once it's there.

### Dev-only test hooks

In `npm run dev` only (`import.meta.env.DEV`, stripped from builds),
`window.__solar` is the sim context and `window.__solarCamera` the camera.
Automated browser checks use them to select bodies and project positions.

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

### Sandbox

The Sandbox panel offers eclipse events and destructive tools. These are
original mechanics; nothing is copied from any existing game.

**Eclipses.** `startEvent('solar' | 'lunar')` does four things:
- pauses simulated time;
- sets `sim.event` (`{ type, startReal }`);
- makes the Moon (in `Bodies.jsx`) slide across the Sun–Earth line over
  `SANDBOX.eclipseSeconds`;
- makes `CameraRig` hold a fixed viewpoint (`eclipseCamera()`) and aim the
  camera itself, since OrbitControls is disabled.

The two viewpoints:
- **Solar:** the camera stands on the Sun–Earth line where the Moon looks 4%
  larger than the Sun, so the eclipse is total. A corona sprite appears
  behind the Moon.
- **Lunar:** the camera looks at the Moon from beside Earth's night side.

The shadows themselves are real, not staged. `patchSurface` gives Earth the
Moon as an occluder and the Moon Earth as an occluder. It compares the
angular sizes of Sun and occluder, which produces an umbra and penumbra
(and annular eclipses where geometry says so). The Moon's material adds a
red term in Earth's umbra, so a lunar eclipse gives a blood moon. On Earth,
city lights switch on inside the Moon's shadow. `EventTimer` ends the event
once it has played.

**Physics** (`physics.js`). Planets stay on analytic orbits until a gravity
tool or a supernova calls `activate()`. From then on every living planet is
a free body integrated with sub-stepped semi-implicit Euler. Each planet
keeps its own solar `gm` (ω²r³), so its undisturbed orbit is unchanged even
though the stylised distances break Kepler's third law. The forces and
outcomes:
- black holes (attract, swallow inside the horizon, grow as they feed);
- white holes (repel);
- wormholes (attract gently; a body inside one mouth exits the other, keeping
  its velocity);
- the Sun (burns anything that falls in);
- the supernova shock front (`shellRadius`): vaporises bodies inside
  `vaporize` and kicks the rest outwards.

The asteroid belt turns into ~1,400 particles under the same rules, in its
own `useFrame`. `PhysicsStep` runs at priority −0.5, after `Clock`, and
reports fates through `sim.onFate`.

**Tools.**
- Placement: `arm(tool)`, then a click on `ClickPlane` (the y=0 plane) or on
  a body calls `placeAt`. Clicks are ignored if the pointer moved more than
  4 px, so dragging the view never places anything.
- Wormholes take two clicks; the first mouth shows as pending.
- The impactor launches an `Impactor` effect at the clicked planet. On
  arrival it calls `smash`, which leads to `destroy` (a flash plus debris in
  the planet's `tint`).
- Supernova: the Sun flares for 1.4 s, then becomes a pulsar (a small
  blue-white star with rotating beams). A `SupernovaShell` expands with
  simulated time. Each body keeps feeling the old star's gravity until the
  shock front reaches it (`accel(..., pushed)`), so nothing escapes before
  the blast arrives.
- `restore()` resets physics, tools, effects and the star, and bumps
  `resetKey`, which re-lays the asteroid belt.

**Lensing.** `LensCapture` renders the scene, without lens quads, into a
half-float render target once per frame, and only while a lens exists. Each
`Lens` is a camera-facing quad that samples that capture:
- black holes use the point-lens map β = θ − θE²/θ, with a black shadow and a
  photon ring;
- wormhole mouths use a tightening swirl with a violet throat.

It is screen-space, so it bends planets, the Sun and the sky alike.

### Labels

What gets a label:
- Every entry in `BODY_LIST`.
- The satellite and the asteroid belt. The belt's label rides on an anchor
  object inside the rotating belt group.

How labels behave:
- Each label has a name and a detail line (`labelDetail(body)`, e.g.
  "1 AU · 365.25 days"). The detail line shows only when the "Label details"
  option is on.
- Minor labels (Moon, Satellite) appear only within 30 units of the camera.
- The selected body's label turns the accent colour.

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

## Spline export

`npm run export:spline` runs `scripts/export-spline.mjs`, which writes
`exports/solar-system-for-spline.glb` for importing into a new Spline
project. The file is committed so it can be downloaded directly.

How it's built:
- It reads the original `spline_3_d_starter_file.glb` with glTF-Transform
  and reuses its Sphere, Cube and Path meshes. Primitives are cloned per
  body, so each gets its own material while the vertex data stays shared.
- It lays bodies out from `src/solar/data.js`, using the app's starting
  angles.
- It writes Spline units directly (scene units × 100; the Sun's radius is
  700) with **no root scale**. A first version copied Spline's own 0.01 root
  scale, and the system imported into Spline as a tiny clump.
- The hierarchy is flattened: every mesh node sits directly under an
  untransformed "Solar System" root and carries its full world transform.
  Only the asteroids are grouped, under an untransformed "Asteroid belt"
  node. Keep it that way, so nothing depends on how an importer handles
  nested transforms.

What it contains:
- The Sun, planets, Earth's Moon and satellite, every major moon
  (`moonsOf`, placed as on the app's first frame), the dwarf planets with
  Charon, their tilted oval orbits as thin tubes, and 180 Kuiper belt
  objects (grouped like the asteroids).
- Textures from `public/textures/`.
- Saturn's rings, with radial UVs.
- Orbit tori.
- 240 asteroids: nodes that share three roughened-cube meshes, which keeps
  the file small.
- The comet on the Path, using the same transform chain as `<Comet>`.

Only static, standard glTF goes in. There are no lights, shaders, motion or
UI.

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
