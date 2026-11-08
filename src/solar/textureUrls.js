// Every image the solar system loads. Files live in public/textures/ (see
// CREDITS.md for sources and licenses). A build can swap this one module for
// data URIs to make a self-contained page.
const base = '/textures/'

export const TEXTURES = {
  sun: base + 'sun.jpg',
  mercury: base + 'mercury.jpg',
  venus: base + 'venus_atmosphere.jpg',
  earth: base + 'earth_day.jpg',
  earthSpecular: base + 'earth_specular.jpg',
  earthNight: base + 'earth_night.jpg',
  earthClouds: base + 'earth_clouds.jpg',
  moon: base + 'moon.jpg',
  mars: base + 'mars.jpg',
  jupiter: base + 'jupiter.jpg',
  saturn: base + 'saturn.jpg',
  saturnRing: base + 'saturn_ring.png',
  uranus: base + 'uranus.jpg',
  neptune: base + 'neptune.jpg',
  milkyWay: base + 'milky_way.jpg',
}

// Maps that hold data (masks), not colour: keep them out of sRGB decoding.
export const DATA_TEXTURES = new Set(['earthSpecular', 'earthClouds'])
