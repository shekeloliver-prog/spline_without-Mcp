// Shader pieces for the realistic look and the sandbox. The Sun sits at the
// world origin, so "towards the Sun" from any surface point is -worldPosition.
import * as THREE from 'three'

// GLSL: how much sunlight reaches world point p when one sphere (the
// occluder: the Moon for Earth, Earth for the Moon) may block the Sun's disc.
// Compares the angular sizes of Sun and occluder and their separation, which
// gives a hard umbra with a soft penumbra, and real annular/total behaviour.
const SHADOW_GLSL = /* glsl */ `
  uniform vec4 uOccluder;   // xyz: world position, w: radius (0 = off)
  uniform float uSunRadius;
  uniform float uRedden;    // 1: light bent through an atmosphere reddens the umbra
  varying vec3 vSunWPos;
  varying vec3 vSunWNormal;
  float sunVisibility(vec3 p) {
    if (uOccluder.w <= 0.0) return 1.0;
    vec3 toSun = -p;
    float dSun = length(toSun);
    vec3 L = toSun / dSun;
    vec3 toOcc = uOccluder.xyz - p;
    float dOcc = length(toOcc);
    if (dot(toOcc, L) <= 0.0) return 1.0;
    float sep = acos(clamp(dot(toOcc / dOcc, L), -1.0, 1.0));
    float aOcc = asin(clamp(uOccluder.w / dOcc, 0.0, 1.0));
    float aSun = asin(clamp(uSunRadius / dSun, 0.0, 1.0));
    float cover = min(1.0, (aOcc * aOcc) / (aSun * aSun));
    float vis = smoothstep(abs(aOcc - aSun), aOcc + aSun, sep);
    return mix(1.0 - cover, 1.0, vis);
  }
`

// Patches a Phong/Standard material with eclipse shadows and, optionally,
// night-side city lights (emissive map shown only away from the Sun, or in
// the Moon's shadow). Returns { material, uniforms } to update per frame.
export function patchSurface(material, { nightLights = false, redden = 0 } = {}) {
  const uniforms = {
    uOccluder: { value: new THREE.Vector4(0, 0, 0, 0) },
    uSunRadius: { value: 7 },
    uRedden: { value: redden },
  }
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSunWPos;\nvarying vec3 vSunWNormal;')
      .replace(
        '#include <fog_vertex>',
        '#include <fog_vertex>\nvSunWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvSunWNormal = normalize(mat3(modelMatrix) * objectNormal);',
      )
    let frag = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + SHADOW_GLSL)
    if (nightLights) {
      frag = frag.replace(
        '#include <emissivemap_fragment>',
        `#ifdef USE_EMISSIVEMAP
          vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
          float sunFacing = dot( normalize( vSunWNormal ), normalize( -vSunWPos ) );
          float night = smoothstep( 0.1, -0.2, sunFacing );
          night = max( night, 1.0 - sunVisibility( vSunWPos ) ); // lights come on in an eclipse
          totalEmissiveRadiance *= emissiveColor.rgb * night;
        #endif`,
      )
    }
    frag = frag.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      {
        float sunLit = sunVisibility( vSunWPos );
        reflectedLight.directDiffuse *= sunLit;
        reflectedLight.directSpecular *= sunLit;
        reflectedLight.directDiffuse += diffuseColor.rgb * vec3( 0.32, 0.07, 0.025 ) * ( 1.0 - sunLit ) * uRedden;
      }`,
    )
    shader.fragmentShader = frag
  }
  material.customProgramCacheKey = () => `surface-${nightLights}-${redden}`
  return { material, uniforms }
}

// Thin glowing shell around a planet, brightest at the limb and only on the
// sunlit side.
export function atmosphereMaterial(color, strength = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float rim = pow(1.0 - abs(dot(n, viewDir)), 2.5);
        float lit = smoothstep(-0.25, 0.4, dot(n, normalize(-vWorldPos)));
        gl_FragColor = vec4(uColor * rim * lit * uStrength, rim * lit);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  })
}

// Comet tail: a cone that is soft at its silhouette and fades along its length.
export function tailMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vAlong = -position.y; // 0 at the nucleus, 1 at the far end
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mv.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlong;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        float facing = abs(dot(normalize(vNormal), normalize(-vViewPos)));
        float a = pow(facing, 1.6) * pow(1.0 - clamp(vAlong, 0.0, 1.0), 1.8) * uOpacity;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}

// Screen-space gravitational lens, drawn on a camera-facing quad around a
// black hole or wormhole mouth. It samples a capture of the scene (taken
// without the lenses) and bends it:
//   black hole: point-mass lens, β = θ − θE² / θ, with a black shadow inside
//               and a thin photon ring at the edge of the shadow;
//   wormhole:   a swirl that tightens towards the mouth, with a violet throat.
export function lensMaterial(sceneTexture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: sceneTexture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uAspect: { value: 1 },
      uOuter: { value: 0.2 }, // quad radius, in screen-height units
      uEinstein: { value: 0.06 },
      uHorizon: { value: 0.03 },
      uMode: { value: 0 }, // 0 black hole, 1 wormhole
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tScene;
      uniform vec2 uResolution;
      uniform vec2 uCenter;
      uniform float uAspect;
      uniform float uOuter;
      uniform float uEinstein;
      uniform float uHorizon;
      uniform int uMode;
      uniform float uTime;
      void main() {
        vec2 uv = gl_FragCoord.xy / uResolution;
        vec2 d = uv - uCenter;
        d.x *= uAspect;
        float r = max(length(d), 1e-5);
        vec2 dir = d / r;
        float fade = 1.0 - smoothstep(uOuter * 0.55, uOuter, r);
        vec3 col;
        if (uMode == 0) {
          if (r < uHorizon) {
            col = vec3(0.0);
          } else {
            vec2 s = d - dir * (uEinstein * uEinstein / r);
            col = texture2D(tScene, uCenter + vec2(s.x / uAspect, s.y)).rgb;
            float ring = exp(-pow((r - uHorizon * 1.08) / (uHorizon * 0.06), 2.0));
            col += vec3(1.6, 1.25, 0.9) * ring;
          }
        } else {
          float twist = 0.9 * uEinstein / r + uTime * 0.6;
          float c = cos(twist), sn = sin(twist);
          vec2 s = mat2(c, -sn, sn, c) * d * smoothstep(0.0, uOuter, r + uHorizon * 0.5);
          col = texture2D(tScene, uCenter + vec2(s.x / uAspect, s.y)).rgb;
          float throat = 1.0 - smoothstep(uHorizon * 0.6, uHorizon * 1.4, r);
          col = mix(col, vec3(0.35, 0.2, 0.9) * (0.6 + 0.4 * sin(r * 120.0 - uTime * 6.0)), throat * 0.85);
          col += vec3(0.9, 0.55, 1.6) * exp(-pow((r - uHorizon * 1.4) / (uHorizon * 0.12), 2.0));
        }
        gl_FragColor = vec4(col, fade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    toneMapped: true,
  })
}

// Accretion disk: hot white-blue at the inner edge, cooling to orange,
// with spiral streaks that shear as they orbit (inner parts turn faster).
export function accretionDiskMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uInner: { value: 1 }, uOuter: { value: 4 } },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() { vPos = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uInner;
      uniform float uOuter;
      varying vec2 vPos;
      void main() {
        float r = length(vPos);
        float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
        float ang = atan(vPos.y, vPos.x);
        float spin = uTime * 2.5 / pow(max(r / uInner, 1.0), 1.5);
        float streak = 0.55 + 0.45 * sin(ang * 7.0 + spin * 6.0 + log(r) * 9.0);
        streak *= 0.7 + 0.3 * sin(ang * 23.0 - spin * 4.0 + r * 3.0);
        vec3 hot = vec3(2.6, 2.4, 2.9);
        vec3 warm = vec3(2.2, 0.95, 0.3);
        vec3 cool = vec3(0.6, 0.15, 0.03);
        vec3 col = t < 0.35 ? mix(hot, warm, t / 0.35) : mix(warm, cool, (t - 0.35) / 0.65);
        float a = smoothstep(0.0, 0.06, t) * pow(1.0 - t, 1.4) * streak;
        gl_FragColor = vec4(col * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
}

// Expanding supernova shock shell: bright at the limb, fading as it grows.
export function shellMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uFade: { value: 1 }, uColor: { value: new THREE.Color(2.4, 1.4, 0.7) } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mv.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(-vViewPos))), 3.0);
        float a = (0.08 + rim) * uFade;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
}

// Solar corona for total eclipses: soft streamers radiating from the limb.
let coronaTex = null
export function coronaTexture() {
  if (coronaTex) return coronaTex
  const size = 512
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const mid = size / 2
  const base = g.createRadialGradient(mid, mid, size * 0.18, mid, mid, mid)
  base.addColorStop(0, 'rgba(255,255,255,0.95)')
  base.addColorStop(0.15, 'rgba(235,240,255,0.45)')
  base.addColorStop(0.5, 'rgba(210,220,255,0.08)')
  base.addColorStop(1, 'rgba(210,220,255,0)')
  g.fillStyle = base
  g.fillRect(0, 0, size, size)
  g.globalCompositeOperation = 'lighter'
  let seed = 9
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 48; i++) {
    const a = rand() * Math.PI * 2
    const len = size * (0.25 + rand() * 0.25)
    const w = 0.03 + rand() * 0.08
    const grad = g.createLinearGradient(mid, mid, mid + Math.cos(a) * len, mid + Math.sin(a) * len)
    grad.addColorStop(0.35, 'rgba(230,236,255,0.22)')
    grad.addColorStop(1, 'rgba(230,236,255,0)')
    g.fillStyle = grad
    g.beginPath()
    g.moveTo(mid, mid)
    g.arc(mid, mid, len, a - w, a + w)
    g.closePath()
    g.fill()
  }
  coronaTex = new THREE.CanvasTexture(c)
  coronaTex.colorSpace = THREE.SRGBColorSpace
  return coronaTex
}
