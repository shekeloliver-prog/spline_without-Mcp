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
    name: 'Mercury', map: 'mercury', distance: 14, radius: 0.5, period: 0.241, day: 58.6, tilt: 0.03,
    facts: { Type: 'Rocky planet', Diameter: '4,879 km', 'From the Sun': '0.39 AU', Year: '88 days', Day: '58.6 Earth days', Gravity: '3.7 m/s²', 'Avg. temp.': '167 °C' },
    blurb: 'The smallest planet and the closest to the Sun.',
  },
  {
    name: 'Venus', map: 'venus', distance: 19, radius: 0.95, period: 0.615, day: -243, tilt: 177.4,
    facts: { Type: 'Rocky planet', Diameter: '12,104 km', 'From the Sun': '0.72 AU', Year: '225 days', Day: '243 Earth days (backwards)', Gravity: '8.9 m/s²', 'Avg. temp.': '464 °C' },
    blurb: 'The hottest planet: its thick clouds trap heat.',
  },
  {
    name: 'Earth', map: 'earth', distance: 25, radius: 1, period: 1, day: 1, tilt: 23.4,
    facts: { Type: 'Rocky planet', Diameter: '12,756 km', 'From the Sun': '1 AU', Year: '365.25 days', Day: '23.9 hours', Gravity: '9.8 m/s²', 'Avg. temp.': '15 °C' },
    blurb: 'Home. The only world known to have life.',
    moon: { radius: 0.27, distance: 2.2, period: 0.0748, color: '#bdbab4' },
    satellite: { size: 0.22, distance: 1.55, period: 0.02 },
  },
  {
    name: 'Mars', map: 'mars', distance: 31, radius: 0.7, period: 1.881, day: 1.03, tilt: 25.2,
    facts: { Type: 'Rocky planet', Diameter: '6,792 km', 'From the Sun': '1.52 AU', Year: '687 days', Day: '24.6 hours', Gravity: '3.7 m/s²', 'Avg. temp.': '−65 °C' },
    blurb: 'The red planet: its dust is rich in iron oxide (rust).',
  },
  {
    name: 'Jupiter', map: 'jupiter', distance: 46, radius: 3, period: 11.86, day: 0.41, tilt: 3.1,
    facts: { Type: 'Gas giant', Diameter: '142,984 km', 'From the Sun': '5.2 AU', Year: '11.9 years', Day: '9.9 hours', Gravity: '23.1 m/s²', 'Avg. temp.': '−110 °C' },
    blurb: 'The largest planet: more than twice the mass of all the others combined.',
  },
  {
    name: 'Saturn', map: 'saturn', distance: 62, radius: 2.5, period: 29.46, day: 0.45, tilt: 26.7,
    facts: { Type: 'Gas giant', Diameter: '120,536 km', 'From the Sun': '9.5 AU', Year: '29.5 years', Day: '10.7 hours', Gravity: '9.0 m/s²', 'Avg. temp.': '−140 °C' },
    blurb: 'Its rings are made of countless chunks of ice and rock.',
    // Real proportions: C ring starts at 1.24 and A ring ends at 2.27 Saturn radii.
    ring: { inner: 3.1, outer: 5.68 },
  },
  {
    name: 'Uranus', map: 'uranus', distance: 76, radius: 1.7, period: 84.01, day: -0.72, tilt: 97.8,
    facts: { Type: 'Ice giant', Diameter: '51,118 km', 'From the Sun': '19.2 AU', Year: '84 years', Day: '17.2 hours', Gravity: '8.7 m/s²', 'Avg. temp.': '−195 °C' },
    blurb: 'An ice giant that rolls around the Sun tipped on its side.',
  },
  {
    name: 'Neptune', map: 'neptune', distance: 88, radius: 1.65, period: 164.8, day: 0.67, tilt: 28.3,
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
