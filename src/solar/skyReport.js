// "What's in the sky today?" From the same mean longitudes that Today's sky
// uses to place the planets, work out each planet's elongation: its angle
// from the Sun as seen from Earth. East of the Sun means the evening sky,
// west means the morning sky, near 180° means up all night, and within about
// 18° it's lost in the Sun's glare. Approximate: mean (circular) orbits.
import { MEAN_LONGITUDE, MOON_MEAN_LONGITUDE } from './data.js'

// Semi-major axes in AU (for the geocentric direction).
const AU = { Mercury: 0.387, Venus: 0.723, Earth: 1, Mars: 1.524, Jupiter: 5.203, Saturn: 9.537, Uranus: 19.19, Neptune: 30.07 }
// How to see each one: Uranus needs binoculars, Neptune a telescope.
const HOW = { Uranus: 'binoculars', Neptune: 'telescope' }

const RAD = Math.PI / 180
const wrap = (a) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI

function moonPhaseName(elong) {
  const e = Math.abs(elong)
  const waxing = elong > 0
  if (e < 12) return 'New Moon'
  if (e > 168) return 'Full Moon'
  if (e >= 80 && e <= 100) return waxing ? 'First quarter' : 'Last quarter'
  if (e < 80) return waxing ? 'Waxing crescent' : 'Waning crescent'
  return waxing ? 'Waxing gibbous' : 'Waning gibbous'
}

export function skyReport(date) {
  const days = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000
  const T = days / 36525
  const helio = {}
  for (const [name, [l0, rate]] of Object.entries(MEAN_LONGITUDE)) {
    const L = (l0 + rate * T) * RAD
    helio[name] = [AU[name] * Math.cos(L), AU[name] * Math.sin(L)]
  }
  const [ex, ey] = helio.Earth
  const sunLon = Math.atan2(-ey, -ex)
  const planets = Object.keys(AU)
    .filter((n) => n !== 'Earth')
    .map((name) => {
      const [x, y] = helio[name]
      const elong = wrap(Math.atan2(y - ey, x - ex) - sunLon) / RAD
      const e = Math.abs(elong)
      const when = e < 18 ? 'hidden' : e > 150 ? 'all night' : elong > 0 ? 'evening' : 'morning'
      return { name, elong, when, how: HOW[name] }
    })
  const moonElong = wrap((MOON_MEAN_LONGITUDE[0] + MOON_MEAN_LONGITUDE[1] * days) * RAD - sunLon) / RAD
  return {
    date,
    planets,
    moon: { phase: moonPhaseName(moonElong), lit: Math.round(((1 - Math.cos(moonElong * RAD)) / 2) * 100) },
  }
}
