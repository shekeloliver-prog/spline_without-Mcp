// Shader pieces for the realistic look. The Sun sits at the world origin,
// so "towards the Sun" from any surface point is simply -worldPosition.
import * as THREE from 'three'

// Earth: city lights show only on the night side, fading in across the
// terminator. Patches a MeshPhongMaterial so normal lighting still applies.
export function patchNightLights(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSunWPos;\nvarying vec3 vSunWNormal;')
      .replace(
        '#include <fog_vertex>',
        '#include <fog_vertex>\nvSunWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvSunWNormal = normalize(mat3(modelMatrix) * objectNormal);',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSunWPos;\nvarying vec3 vSunWNormal;')
      .replace(
        '#include <emissivemap_fragment>',
        `#ifdef USE_EMISSIVEMAP
          vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
          float sunFacing = dot( normalize( vSunWNormal ), normalize( -vSunWPos ) );
          float night = smoothstep( 0.1, -0.2, sunFacing );
          totalEmissiveRadiance *= emissiveColor.rgb * night;
        #endif`,
      )
  }
  material.customProgramCacheKey = () => 'night-lights'
  return material
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
