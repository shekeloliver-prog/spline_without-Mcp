// Data for the solar system view.
//
// Sizes and distances are stylised: true scale would leave the planets as
// invisible dots. Orbital periods keep their real ratios to Earth's year, and
// the facts shown in the info panel are real.

// One Earth year takes this many seconds at 1x speed.
export const SECONDS_PER_YEAR = 20

export const CAMERA_HOME = { position: [0, 85, 160], target: [0, 0, 0], fov: 45 }

// Camera presets for the View buttons. All look at the Sun.
export const VIEWS = {
  overview: { label: 'Overview', position: [0, 85, 160] },
  top: { label: 'Top', position: [0, 195, 0.01] },
  side: { label: 'Side', position: [0, 7, 180] },
  // Looks at the size line-up, parked far behind the Sun (see SIZE_LINEUP).
  sizes: { label: 'Sizes', position: [30, 11, -568], target: [30, 0, -700] },
}

export const SUN = {
  name: 'Sun',
  radius: 7,
  glowColor: '#ffcf8a',
  facts: {
    Type: 'G-type main-sequence star',
    Diameter: '1,392,700 km',
    'Surface temp.': '≈ 5,500 °C',
    Age: '≈ 4.6 billion years',
  },
  blurb: 'Holds 99.8% of the solar system’s mass. Everything here orbits it.',
  short: 'Our star',
}

export const MOON = {
  name: 'Moon',
  tint: '#a8a49c',
  facts: {
    Type: 'Natural satellite',
    Diameter: '3,474 km',
    'From Earth': '384,400 km',
    Orbit: '27.3 days',
    Gravity: '1.6 m/s²',
    'Surface temp.': '−173 to 127 °C',
  },
  blurb: 'Always shows Earth the same face: it turns once per orbit.',
  short: '384,400 km from Earth',
}

// distance: orbit radius (scene units). radius: body radius (scene units).
// period: orbital period in Earth years. day: rotation period in Earth days
// (negative means it spins backwards). tilt: axial tilt in degrees.
// map: key into TEXTURES (textureUrls.js); real surface/cloud-top maps.
export const PLANETS = [
  {
    name: 'Mercury', tint: '#8a8580', map: 'mercury', distance: 14, radius: 0.5, period: 0.241, day: 58.6, tilt: 0.03,
    facts: { Type: 'Rocky planet', Diameter: '4,879 km', 'From the Sun': '0.39 AU', Year: '88 days', Day: '58.6 Earth days', Gravity: '3.7 m/s²', 'Avg. temp.': '167 °C' },
    blurb: 'The smallest planet and the closest to the Sun.',
  },
  {
    name: 'Venus', tint: '#d9b87a', map: 'venus', distance: 19, radius: 0.95, period: 0.615, day: -243, tilt: 177.4,
    facts: { Type: 'Rocky planet', Diameter: '12,104 km', 'From the Sun': '0.72 AU', Year: '225 days', Day: '243 Earth days (backwards)', Gravity: '8.9 m/s²', 'Avg. temp.': '464 °C' },
    blurb: 'The hottest planet: its thick clouds trap heat.',
  },
  {
    name: 'Earth', tint: '#5a7896', map: 'earth', distance: 25, radius: 1, period: 1, day: 1, tilt: 23.4,
    facts: { Type: 'Rocky planet', Diameter: '12,756 km', 'From the Sun': '1 AU', Year: '365.25 days', Day: '23.9 hours', Gravity: '9.8 m/s²', 'Avg. temp.': '15 °C' },
    blurb: 'Home. The only world known to have life.',
    // period: 27.3 days, slowed like every moon (see MOON_TIME_SLOW below)
    moon: { radius: 0.27, distance: 2.2, period: (27.32 * 10) / 365.25, color: '#bdbab4' },
    satellite: { size: 0.22, distance: 1.55, period: 0.02 },
  },
  {
    name: 'Mars', tint: '#b5532f', map: 'mars', distance: 31, radius: 0.7, period: 1.881, day: 1.03, tilt: 25.2,
    facts: { Type: 'Rocky planet', Diameter: '6,792 km', 'From the Sun': '1.52 AU', Year: '687 days', Day: '24.6 hours', Gravity: '3.7 m/s²', 'Avg. temp.': '−65 °C' },
    blurb: 'The red planet: its dust is rich in iron oxide (rust).',
  },
  {
    name: 'Jupiter', tint: '#c8a27e', map: 'jupiter', distance: 46, radius: 3, period: 11.86, day: 0.41, tilt: 3.1,
    facts: { Type: 'Gas giant', Diameter: '142,984 km', 'From the Sun': '5.2 AU', Year: '11.9 years', Day: '9.9 hours', Gravity: '23.1 m/s²', 'Avg. temp.': '−110 °C' },
    blurb: 'The largest planet: more than twice the mass of all the others combined.',
  },
  {
    name: 'Saturn', tint: '#d8c49a', map: 'saturn', distance: 62, radius: 2.5, period: 29.46, day: 0.45, tilt: 26.7,
    facts: { Type: 'Gas giant', Diameter: '120,536 km', 'From the Sun': '9.5 AU', Year: '29.5 years', Day: '10.7 hours', Gravity: '9.0 m/s²', 'Avg. temp.': '−140 °C' },
    blurb: 'Its rings are made of countless chunks of ice and rock.',
    // Real proportions: C ring starts at 1.24 and A ring ends at 2.27 Saturn radii.
    ring: { inner: 3.1, outer: 5.68 },
  },
  {
    name: 'Uranus', tint: '#9fd8e0', map: 'uranus', distance: 76, radius: 1.7, period: 84.01, day: -0.72, tilt: 97.8,
    facts: { Type: 'Ice giant', Diameter: '51,118 km', 'From the Sun': '19.2 AU', Year: '84 years', Day: '17.2 hours', Gravity: '8.7 m/s²', 'Avg. temp.': '−195 °C' },
    blurb: 'An ice giant that rolls around the Sun tipped on its side.',
  },
  {
    name: 'Neptune', tint: '#4a6fd0', map: 'neptune', distance: 88, radius: 1.65, period: 164.8, day: 0.67, tilt: 28.3,
    facts: { Type: 'Ice giant', Diameter: '49,528 km', 'From the Sun': '30.1 AU', Year: '165 years', Day: '16.1 hours', Gravity: '11.0 m/s²', 'Avg. temp.': '−200 °C' },
    blurb: 'The windiest planet, with storms faster than the speed of sound.',
  },
]

export const ASTEROID_BELT = {
  name: 'Asteroid belt', count: 1400, inner: 36, outer: 41.5, thickness: 1.4, size: [0.04, 0.2],
  period: 4.6, seed: 7, color: [0.42, 0.38, 0.34],
}

// The comet follows the closed Path drawn in Spline. These are the path's
// control points exactly as stored in spline_3_d_starter_file.glb, in the
// path mesh's local (Spline) units. Corners are sharp (roundness 0), so the
// comet travels in straight segments between them.
export const SPLINE_PATH_POINTS = [
  [0, 0, 0],
  [3120, 44, 0],
  [14203, -1851, 0],
  [41731, -11416, 0],
  [-1303, -707, 2588],
  [-4408, 363, 2588],
  [-5714, 1147, 2588],
]

export const COMET = {
  name: 'Comet',
  // How the Spline path is placed in the solar system.
  scale: 0.0028, // Spline units -> scene units
  anchor: [-2800, 200, 1300], // path point (Spline units) that lands at `offset`
  offset: [16, 0, -10], // where the tight end of the loop sits (scene units)
  rotation: [-Math.PI / 2 + 0.22, 0, 0.55], // lays the loop near the ecliptic, slightly tilted
  period: 6, // Earth years per lap
  radius: 0.16,
  color: '#e8f6ff',
  facts: { Orbit: 'Your Spline path', Shape: 'Long, eccentric loop', Lap: '6 years (here)', Tails: 'Ion (blue) and dust (cream)' },
  short: 'On your Spline path',
  blurb: 'Rides the closed path from your Spline file, swinging in close to the Sun and out past Neptune.',
}

// Order of the fly-to bar and the ← / → keys.
// ---------------------------------------------------------------- dwarf planets
// Real orbital elements (J2000, rounded): semi-major axis a (AU),
// eccentricity e, inclination i, longitude of the ascending node node,
// argument of perihelion peri (degrees), period (years), and the mean anomaly
// M0 at the start of the simulation. Positions come from Kepler's equation in
// AU, then the distance from the Sun is mapped onto the app's stylised scale
// (auToScene), so Pluto still dips just inside Neptune's orbit at perihelion.
export const DWARFS = [
  {
    name: 'Ceres', tint: '#8f8a84', shape: 'cratered', km: 939,
    orbit: { a: 2.77, e: 0.0785, i: 10.59, node: 80.3, peri: 73.6, period: 4.6, M0: 40 },
    day: 0.378, tilt: 4,
    facts: { Type: 'Dwarf planet', Diameter: '939 km', 'From the Sun': '2.8 AU', Year: '4.6 years', Day: '9.1 hours', Discovered: '1801' },
    blurb: 'The largest object in the asteroid belt, and the first asteroid ever found.',
  },
  {
    name: 'Pluto', tint: '#d6bfa2', shape: 'cratered', km: 2377,
    orbit: { a: 39.48, e: 0.2488, i: 17.16, node: 110.3, peri: 113.8, period: 247.9, M0: 54 },
    day: -6.39, tilt: 122.5,
    facts: { Type: 'Dwarf planet', Diameter: '2,377 km', 'From the Sun': '39.5 AU (average)', Year: '248 years', Day: '6.4 Earth days (backwards)', Discovered: '1930' },
    blurb: 'Its oval orbit brings it closer to the Sun than Neptune for 20 years of every 248.',
  },
  {
    name: 'Haumea', tint: '#e9e9ea', shape: 'smooth', km: 1600, stretch: [1.35, 0.68, 1.05],
    orbit: { a: 43.1, e: 0.195, i: 28.2, node: 122.2, peri: 239, period: 284, M0: 210 },
    day: 0.163, tilt: 0,
    facts: { Type: 'Dwarf planet', Size: 'about 2,100 × 1,000 km', 'From the Sun': '43 AU (average)', Year: '284 years', Day: '3.9 hours', Discovered: '2004' },
    blurb: 'Spins so fast, once every 4 hours, that it has stretched into an egg shape. It also has a ring.',
  },
  {
    name: 'Makemake', tint: '#c98f6a', shape: 'smooth', km: 1430,
    orbit: { a: 45.8, e: 0.161, i: 29.0, node: 79.4, peri: 297, period: 305, M0: 150 },
    day: 0.95, tilt: 0,
    facts: { Type: 'Dwarf planet', Diameter: 'about 1,430 km', 'From the Sun': '45.8 AU (average)', Year: '305 years', Day: '22.8 hours', Discovered: '2005' },
    blurb: 'A reddish world coated in frozen methane, far out in the Kuiper belt.',
  },
  {
    name: 'Eris', tint: '#ecebe8', shape: 'smooth', km: 2326,
    orbit: { a: 67.8, e: 0.44, i: 44.0, node: 35.9, peri: 151.6, period: 557, M0: 205 },
    day: 15.8, tilt: 0,
    facts: { Type: 'Dwarf planet', Diameter: '2,326 km', 'From the Sun': '68 AU (average)', Year: '557 years', Day: '15.8 Earth days', Discovered: '2005' },
    blurb: 'Almost as big as Pluto: its discovery led to the definition of “dwarf planet”.',
  },
]

// Distance from the Sun in AU -> scene units, through the planets' own
// stylised distances (and the asteroid belt), then 1.05 units per AU beyond
// Neptune.
const AU_KNOTS = [
  [0, 9], [0.39, 14], [0.72, 19], [1, 25], [1.52, 31], [2.77, 38.7], [5.2, 46], [9.54, 62], [19.2, 76], [30.1, 88],
]
export function auToScene(au) {
  if (au >= 30.1) return 88 + (au - 30.1) * 1.05
  for (let k = 1; k < AU_KNOTS.length; k++) {
    const [a1, s1] = AU_KNOTS[k]
    if (au <= a1) {
      const [a0, s0] = AU_KNOTS[k - 1]
      return s0 + ((au - a0) / (a1 - a0)) * (s1 - s0)
    }
  }
  return 88
}

// Radius in the scene: Earth-relative like the moons, a little enlarged so
// these small worlds stay visible.
for (const d of DWARFS) d.radius = Math.max(0.12, (d.km / 2 / 6371) * 1.3)

export const KUIPER_BELT = {
  name: 'Kuiper belt', count: 900, inner: 95, outer: 112, thickness: 12, size: [0.05, 0.22],
  period: 290, seed: 13, color: [0.5, 0.5, 0.55],
}

export const BODY_LIST = [SUN, ...PLANETS.flatMap((p) => (p.name === 'Earth' ? [p, MOON] : [p])), ...DWARFS, COMET]

// One-line summary shown under a label when label details are on.
export const labelDetail = (body) => body.short ?? `${body.facts['From the Sun']} · ${body.facts.Year}`

// Sandbox tools. gm values are in scene units³ / year² (see physics.js);
// Earth's own solar pull is about 6e5 for comparison.
export const SANDBOX = {
  strengths: { small: 0.4, medium: 1, huge: 3 },
  blackHole: { gm: 1.2e5, horizon: 2.2 }, // event horizon radius (scene units)
  whiteHole: { gm: 1.5e5, radius: 1.6 },
  wormhole: { gm: 2.5e4, mouth: 2.6 },
  impactor: { travelSeconds: 1.6, debris: 260 },
  supernova: { speed: 450, vaporize: 21, boost: 260 }, // shock speed (units/yr), radius that vaporises, kick (units/yr)
  eclipseSeconds: 16,
}

// ---------------------------------------------------------------- moons
// The major moons of every planet (Earth's Moon is handled separately as
// MOON). Real values: mean diameter (km), distance from the planet's centre
// (km), orbital period (days; negative = retrograde), inclination to the
// planet's equator (degrees). Hundreds of tiny moons are left out: at this
// scale they would be invisible specks.
//
// Shapes: 'cratered' uses the lunar map tinted, 'smooth' a plain tint
// (hazy or icy worlds), 'rock' a roughened Spline Cube (small, irregular moons).
const MOON_DATA = {
  Mars: [
    { name: 'Phobos', km: 22.4, distanceKm: 9376, days: 0.319, tint: '#6b5f55', shape: 'rock',
      blurb: 'Slowly spiralling inward: in about 50 million years it will crash into Mars or break into a ring.' },
    { name: 'Deimos', km: 12.4, distanceKm: 23460, days: 1.263, tint: '#857668', shape: 'rock',
      blurb: 'The smaller, outer moon of Mars, smoothed by a thick layer of dust.' },
  ],
  Jupiter: [
    { name: 'Io', km: 3643, distanceKm: 421700, days: 1.769, tint: '#e3cf62', shape: 'cratered',
      blurb: 'The most volcanically active world in the solar system, squeezed by Jupiter’s tides.' },
    { name: 'Europa', km: 3122, distanceKm: 671034, days: 3.551, tint: '#e2d6c2', shape: 'smooth',
      blurb: 'An ice shell over a salty ocean: one of the best places to look for life.' },
    { name: 'Ganymede', km: 5268, distanceKm: 1070412, days: 7.155, tint: '#9c9084', shape: 'cratered',
      blurb: 'The largest moon in the solar system, bigger than Mercury, with its own magnetic field.' },
    { name: 'Callisto', km: 4821, distanceKm: 1882709, days: 16.689, tint: '#6e655c', shape: 'cratered',
      blurb: 'The most heavily cratered surface known: almost unchanged for 4 billion years.' },
  ],
  Saturn: [
    { name: 'Mimas', km: 396, distanceKm: 185539, days: 0.942, tint: '#c9c7c3', shape: 'cratered',
      blurb: 'One giant crater, Herschel, covers a third of its width.' },
    { name: 'Enceladus', km: 504, distanceKm: 237948, days: 1.37, tint: '#f1f5f7', shape: 'smooth',
      blurb: 'Geysers of water ice spray from its south pole, feeding Saturn’s E ring.' },
    { name: 'Tethys', km: 1062, distanceKm: 294619, days: 1.888, tint: '#e0ddd8', shape: 'cratered',
      blurb: 'Made almost entirely of water ice, with a canyon stretching three-quarters around it.' },
    { name: 'Dione', km: 1123, distanceKm: 377396, days: 2.737, tint: '#cfccc6', shape: 'cratered',
      blurb: 'Bright ice cliffs streak its trailing side.' },
    { name: 'Rhea', km: 1527, distanceKm: 527108, days: 4.518, tint: '#bdbab4', shape: 'cratered',
      blurb: 'Saturn’s second-largest moon: a cold, cratered ball of ice and rock.' },
    { name: 'Titan', km: 5150, distanceKm: 1221870, days: 15.945, tint: '#d6a24a', shape: 'smooth',
      blurb: 'The only moon with a thick atmosphere, and lakes of liquid methane on its surface.' },
    { name: 'Iapetus', km: 1469, distanceKm: 3560820, days: 79.32, tint: '#a59d92', shape: 'cratered', incl: 15.5,
      blurb: 'Two-toned: one hemisphere is as dark as coal, the other bright as snow.' },
  ],
  Uranus: [
    { name: 'Miranda', km: 472, distanceKm: 129390, days: 1.413, tint: '#b5b0aa', shape: 'cratered',
      blurb: 'A patchwork world with Verona Rupes, the tallest known cliff in the solar system.' },
    { name: 'Ariel', km: 1158, distanceKm: 191020, days: 2.52, tint: '#c2bdb6', shape: 'cratered',
      blurb: 'The brightest of Uranus’s large moons, with a young, rifted surface.' },
    { name: 'Umbriel', km: 1169, distanceKm: 266000, days: 4.144, tint: '#6f6a66', shape: 'cratered',
      blurb: 'The darkest of Uranus’s large moons.' },
    { name: 'Titania', km: 1577, distanceKm: 435910, days: 8.706, tint: '#b8afa6', shape: 'cratered',
      blurb: 'The largest moon of Uranus, cut by huge canyons.' },
    { name: 'Oberon', km: 1523, distanceKm: 583520, days: 13.463, tint: '#a39a92', shape: 'cratered',
      blurb: 'The outermost large moon of Uranus, old and heavily cratered.' },
  ],
  Pluto: [
    { name: 'Charon', km: 1212, distanceKm: 19591, days: 6.387, tint: '#9a958f', shape: 'cratered',
      blurb: 'Half Pluto’s size: the two are locked face to face, orbiting a point between them.' },
  ],
  Neptune: [
    { name: 'Proteus', km: 420, distanceKm: 117647, days: 1.122, tint: '#5f5a56', shape: 'rock',
      blurb: 'About as big as a moon can be without gravity pulling it round.' },
    { name: 'Triton', km: 2707, distanceKm: 354759, days: -5.877, tint: '#d8c6c0', shape: 'cratered', incl: 157,
      blurb: 'Orbits backwards, so it was probably captured from the Kuiper belt. It has nitrogen geysers.' },
  ],
}

// Moon orbits run this many times slower than real, and none faster than a
// one-day orbit, so the inner moons don't strobe.
export const MOON_TIME_SLOW = 10
const EARTH_RADIUS_KM = 6371
const km = (text) => Number(String(text).replace(/[^0-9.]/g, ''))
const fmt = (n) => Math.round(n).toLocaleString('en-US')

// Scene placement for each moon, derived from the real values:
//   size: same scale as Earth's Moon (km / Earth radius), with a minimum so
//         the smallest moons stay clickable;
//   distance: compressed (square root of the real ratio) so every system
//             fits between its neighbours' orbits.
export const MOONS = [...PLANETS, ...DWARFS].flatMap((planet) =>
  (MOON_DATA[planet.name] ?? []).map((m, i) => {
    const planetKm = km(planet.facts.Diameter) / 2
    const ratio = m.distanceKm / planetKm
    const days = Math.abs(m.days)
    return {
      ...m,
      planet: planet.name,
      radius: Math.max(0.045, m.km / 2 / EARTH_RADIUS_KM),
      distance: planet.radius * (1.4 + 0.5 * Math.sqrt(ratio)),
      // A tilt over 90° already makes the orbit run backwards (Triton),
      // so the period's sign only matters for low-tilt orbits.
      period: (Math.max(days, 1) * MOON_TIME_SLOW * ((m.incl ?? 0) > 90 ? 1 : Math.sign(m.days))) / 365.25,
      phase: (i * 2.39996 + (planet.distance ?? planet.orbit.a)) % (Math.PI * 2),
      short: `Moon of ${planet.name} · ${days < 2 ? `${(days * 24).toFixed(1)} h` : `${days.toFixed(1)} d`}`,
      facts: {
        Type: `Moon of ${planet.name}`,
        Diameter: `${fmt(m.km)} km`,
        [`From ${planet.name}`]: `${fmt(m.distanceKm)} km`,
        Orbit: days < 2 ? `${(days * 24).toFixed(1)} hours` : `${days.toFixed(2)} days`,
        ...(m.days < 0 ? { Direction: 'Backwards (retrograde)' } : {}),
      },
    }
  }),
)

// Every selectable body: the fly-to bar (BODY_LIST) plus the other moons.
export const ALL_BODIES = [...BODY_LIST, ...MOONS]
export const moonsOf = (planetName) => MOONS.filter((m) => m.planet === planetName)

// ---------------------------------------------------------------- today's sky
// Mean longitudes at J2000 (degrees) and their rates (degrees per Julian
// century) from JPL's approximate planetary elements. A mean longitude ignores
// orbital eccentricity, so positions are approximate (worst for Mercury and
// Mars, within about 20°). The Moon uses its mean geocentric longitude.
export const MEAN_LONGITUDE = {
  Mercury: [252.2503235, 149472.67411175],
  Venus: [181.9790995, 58517.81538729],
  Earth: [100.46457166, 35999.37244981],
  Mars: [-4.55343205, 19140.30268499],
  Jupiter: [34.39644051, 3034.74612775],
  Saturn: [49.95424423, 1222.49362201],
  Uranus: [313.23810451, 428.48202785],
  Neptune: [-55.12002969, 218.45945325],
}
export const MOON_MEAN_LONGITUDE = [218.316, 13.176396] // degrees, degrees per day

// ---------------------------------------------------------------- size line-up
// True relative sizes, in Earth radii. Shown far behind the Sun at
// SIZE_LINEUP.center (the "Sizes" view), lit by the Sun from in front.
export const SIZE_LINEUP = {
  center: [0, 0, -700],
  unit: 0.9, // scene units per Earth radius
  gap: 2.2,
  sun: 109.1,
  bodies: [
    ['Jupiter', 11.21], ['Saturn', 9.45], ['Uranus', 4.01], ['Neptune', 3.88],
    ['Earth', 1], ['Venus', 0.95], ['Mars', 0.532], ['Mercury', 0.383], ['Moon', 0.273], ['Pluto', 0.187],
  ],
}

// ---------------------------------------------------------------- guided tour
export const TOUR_SECONDS = 9
export const TOUR = [
  ['Sun', 'Our star: a ball of hot plasma 109 times wider than Earth. Its light takes 8 minutes to reach us.'],
  ['Mercury', 'The smallest planet. With almost no air to hold heat, its days reach 430 °C and its nights fall to −180 °C.'],
  ['Venus', 'Thick clouds of sulfuric acid trap so much heat that Venus is hotter than Mercury, though twice as far from the Sun.'],
  ['Earth', 'The only world known to have life, oceans of liquid water on its surface, and plate tectonics.'],
  ['Moon', 'Formed from debris after a Mars-sized body hit the young Earth. Twelve people have walked on it.'],
  ['Mars', 'Home to Olympus Mons, the tallest volcano in the solar system, about two and a half times as high as Everest.'],
  ['Jupiter', 'Its Great Red Spot is a storm wider than Earth that has raged for centuries.'],
  ['Io', 'Jupiter’s tides knead Io’s interior so hard that hundreds of volcanoes erupt across its surface.'],
  ['Saturn', 'Saturn is less dense than water. Its rings are mostly ice, but only tens of metres thick in places.'],
  ['Titan', 'Saturn’s largest moon has rain, rivers and seas, but they are made of liquid methane and ethane.'],
  ['Uranus', 'An ice giant tipped on its side, so each pole gets 42 years of sunlight and then 42 years of darkness.'],
  ['Neptune', 'The windiest planet: its storms reach about 2,000 km/h.'],
  ['Pluto', 'A dwarf planet with mountains of water ice and a vast heart-shaped plain of frozen nitrogen.'],
  ['Comet', 'Comets are dirty snowballs. Near the Sun their ice turns to gas, blowing out tails millions of kilometres long.'],
]
