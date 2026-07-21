// Custom surface material for extracted isosurfaces — ports the legacy
// mc_fragment shading: cosine palette color sources (|grad f|, df/dw,
// distance, normal hue), key+fill+hemisphere lighting, specular, rim,
// iridescence and ACES tonemapping.

import { DoubleSide, ShaderMaterial, Vector3 } from 'three';
import { PALETTES } from '../state/presets';
import type { ShadingParams } from '../state/store';

const vertexShader = /* glsl */ `
attribute float aGrad;
attribute float aWflow;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vGrad;
varying float vWflow;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vGrad = aGrad;
  vWflow = aWflow;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vGrad;
varying float vWflow;

uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;
uniform int uColorSource;   // 0 distance | 1 |grad f| | 2 df/dw | 3 normal hue
uniform float uGradientScale;
uniform float uGradientPhase;
uniform float uAmbient;
uniform float uDiffuse;
uniform float uSpecular;
uniform float uShininess;
uniform vec3 uLightPos;
uniform float uLightGlobal; // 0 = local (world/subject-fixed) | 1 = global (view/headlight)
uniform float uRim;
uniform float uIridescence;
uniform float uExposure;
uniform float uIsovalue;
uniform float uFlat;

vec3 cosPalette(float t) {
  return clamp(uPaletteA + uPaletteB * cos(6.28318530718 * (uPaletteC * t + uPaletteD)), 0.0, 1.0);
}

vec3 acesTonemap(vec3 x) {
  float a = 2.51; float b = 0.03; float c = 2.43; float d = 0.59; float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3(0.0), vec3(1.0));
}

void main() {
  vec3 N = normalize(vNormal);
  if (uFlat > 0.5) {
    N = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
  }
  if (!gl_FrontFacing) {
    N = -N;
  }

  vec3 V = normalize(cameraPosition - vWorldPos);
  float NdotV = max(dot(N, V), 0.0);
  float isoN = 1.0 + max(uIsovalue, 0.0);

  float t;
  if (uColorSource == 1) {
    // Steepness of the dynamical transition across the surface
    t = log(1.0 + vGrad / isoN) * uGradientScale + uGradientPhase;
  } else if (uColorSource == 2) {
    // Signed growth/dissolution rate along the 4th dimension
    t = 0.5 + 0.5 * tanh(vWflow / isoN * uGradientScale) + uGradientPhase;
  } else if (uColorSource == 3) {
    // Hue from normal orientation (matcap-like)
    t = (atan(N.x, N.z) * 0.15915494 + 0.5 + 0.25 * N.y) * uGradientScale + uGradientPhase;
  } else {
    t = length(vWorldPos) * uGradientScale + uGradientPhase;
  }

  // Iridescence: fresnel-driven palette phase shift
  float fres = pow(1.0 - NdotV, 2.0);
  t += uIridescence * 0.35 * fres;

  vec3 baseColor = cosPalette(t);

  // Key + fill + hemisphere + specular + rim. Directional key light (at
  // infinity) so specular depends only on N and the view. Two anchors:
  //  local  — direction fixed in WORLD space: glued to the subject, the same
  //           side stays lit as you orbit (current behavior).
  //  global — direction fixed in VIEW space (headlight): rotates with the
  //           camera, so different sides light up as you orbit.
  //  (v * mat3(viewMatrix) == transpose(mat3(viewMatrix)) * v = view->world.)
  vec3 Ld;
  if (uLightGlobal > 0.5) {
    Ld = normalize(uLightPos * mat3(viewMatrix));
  } else {
    Ld = normalize(uLightPos);
  }
  vec3 H = normalize(Ld + V);

  float keyDiff = uDiffuse * max(dot(N, Ld), 0.0);
  vec3 fillDir = normalize(vec3(-0.45, 0.2, -0.85));
  float fillDiff = 0.25 * uDiffuse * max(dot(N, fillDir), 0.0);
  float hemi = 0.65 + 0.35 * N.y;
  float ambient = uAmbient * hemi;
  float spec = uSpecular * pow(max(dot(N, H), 0.0), uShininess);
  float rim = uRim * pow(1.0 - NdotV, 3.0);
  vec3 rimColor = mix(vec3(1.0), baseColor, 0.4);

  vec3 color = baseColor * (keyDiff + fillDiff + ambient) + vec3(spec) + rimColor * rim;
  color = acesTonemap(color * max(uExposure, 0.01));

  gl_FragColor = vec4(color, 1.0);
}
`;

export function createFractalMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: DoubleSide,
    uniforms: {
      uPaletteA: { value: new Vector3(0.5, 0.5, 0.5) },
      uPaletteB: { value: new Vector3(0.5, 0.5, 0.5) },
      uPaletteC: { value: new Vector3(1, 1, 1) },
      uPaletteD: { value: new Vector3(0, 0.33, 0.67) },
      uColorSource: { value: 1 },
      uGradientScale: { value: 1 },
      uGradientPhase: { value: 0 },
      uAmbient: { value: 0.25 },
      uDiffuse: { value: 0.8 },
      uSpecular: { value: 0.8 },
      uShininess: { value: 40 },
      uLightPos: { value: new Vector3(0.5, 0.5, 2.0) },
      uLightGlobal: { value: 0 },
      uRim: { value: 0.35 },
      uIridescence: { value: 0 },
      uExposure: { value: 1.15 },
      uIsovalue: { value: 2.05 },
      uFlat: { value: 0 },
    },
  });
}

export function applyShading(mat: ShaderMaterial, shading: ShadingParams, isovalue: number) {
  const p = PALETTES[shading.paletteName] ?? PALETTES.neon;
  (mat.uniforms.uPaletteA.value as Vector3).set(...p.a);
  (mat.uniforms.uPaletteB.value as Vector3).set(...p.b);
  (mat.uniforms.uPaletteC.value as Vector3).set(...p.c);
  (mat.uniforms.uPaletteD.value as Vector3).set(...p.d);
  mat.uniforms.uColorSource.value = shading.colorSource;
  mat.uniforms.uGradientScale.value = shading.gradientScale;
  mat.uniforms.uGradientPhase.value = shading.gradientPhase;
  mat.uniforms.uAmbient.value = shading.ambient;
  mat.uniforms.uDiffuse.value = shading.diffuse;
  mat.uniforms.uSpecular.value = shading.specular;
  mat.uniforms.uShininess.value = shading.shininess;
  (mat.uniforms.uLightPos.value as Vector3).set(...shading.lightPos);
  mat.uniforms.uLightGlobal.value = shading.lightGlobal ? 1 : 0;
  mat.uniforms.uRim.value = shading.rimStrength;
  mat.uniforms.uIridescence.value = shading.iridescence;
  mat.uniforms.uExposure.value = shading.exposure;
  mat.uniforms.uIsovalue.value = isovalue;
  mat.uniforms.uFlat.value = shading.flatShading ? 1 : 0;
  mat.wireframe = shading.wireframe;
}
