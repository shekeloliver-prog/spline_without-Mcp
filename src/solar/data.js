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

export const ASTEROID_BELT = { count: 1400, inner: 36, outer: 41.5, thickness: 1.4, size: [0.04, 0.2] }

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
export const BODY_LIST = [SUN, ...PLANETS.flatMap((p) => (p.name === 'Earth' ? [p, MOON] : [p])), COMET]

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
export const MOONS = PLANETS.flatMap((planet) =>
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
      phase: (i * 2.39996 + planet.distance) % (Math.PI * 2),
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
