import * as PIXI from "pixi.js";

const CRT_VERTEX = `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vNormCoord;
out vec2 vMaxUV;
out vec2 vScreenSize;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
  vNormCoord = aPosition;
  vMaxUV = max(uOutputFrame.zw * uInputSize.zw, vec2(0.0001));
  vScreenSize = max(uOutputFrame.zw, vec2(320.0, 240.0));
}
`;

const CRT_FRAGMENT = `
in vec2 vTextureCoord;
in vec2 vNormCoord;
in vec2 vMaxUV;
in vec2 vScreenSize;

out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uTime;
uniform float uCurvature;
uniform float uScanlineIntensity;
uniform float uFlickerIntensity;

void main(void) {
  vec2 uv = vNormCoord;

  // Center coordinates in -1..1 for barrel glass curvature
  vec2 centered = uv * 2.0 - 1.0;
  vec2 bend = centered.yx / vec2(uCurvature, uCurvature * 0.92);
  vec2 warped = centered + centered * bend * bend;
  vec2 warpedUV = warped * 0.5 + 0.5;

  // Rounded CRT plastic bezel mask outside curved glass
  if (warpedUV.x < 0.0 || warpedUV.x > 1.0 || warpedUV.y < 0.0 || warpedUV.y > 1.0) {
    finalColor = vec4(0.02, 0.03, 0.045, 1.0);
    return;
  }

  // Subtle edge chromatic aberration (stronger near screen corners)
  float edgeDist = dot(centered, centered);
  float chromaShift = 0.0014 * edgeDist;

  vec2 texCoordCenter = clamp(warpedUV, vec2(0.001), vec2(0.999)) * vMaxUV;
  vec2 texCoordR = clamp(warpedUV + vec2(chromaShift, 0.0), vec2(0.001), vec2(0.999)) * vMaxUV;
  vec2 texCoordB = clamp(warpedUV - vec2(chromaShift, 0.0), vec2(0.001), vec2(0.999)) * vMaxUV;

  vec4 baseSample = texture(uTexture, texCoordCenter);
  float r = texture(uTexture, texCoordR).r;
  float g = baseSample.g;
  float b = texture(uTexture, texCoordB).b;
  vec3 col = vec3(r, g, b);

  // Crisp horizontal CRT scanlines
  float scan = sin(warpedUV.y * vScreenSize.y * 1.45);
  col *= 1.0 - uScanlineIntensity * (0.5 - 0.5 * scan);

  // Subtle vertical RGB phosphor aperture grille
  float grille = sin(warpedUV.x * vScreenSize.x * 2.1);
  col *= 1.0 - (uScanlineIntensity * 0.25) * (0.5 - 0.5 * grille);

  // Authentic 90s CRT refresh flicker + soft rolling sync bar
  float flicker =
    1.0 -
    uFlickerIntensity * (0.5 + 0.5 * sin(uTime * 27.0)) -
    (uFlickerIntensity * 0.65) * sin(uTime * 61.0);
  float barDist = fract(warpedUV.y - uTime * 0.16) - 0.5;
  float rollingBar = exp(-(barDist * barDist) * 85.0);
  col *= flicker + rollingBar * 0.032;

  // Soft curved tube edge shadow / vignette
  float vignette = smoothstep(1.48, 0.42, length(centered));
  float cornerBevel =
    smoothstep(0.0, 0.025, warpedUV.x) *
    smoothstep(1.0, 0.975, warpedUV.x) *
    smoothstep(0.0, 0.025, warpedUV.y) *
    smoothstep(1.0, 0.975, warpedUV.y);
  col *= mix(0.74, 1.03, vignette) * mix(0.6, 1.0, cornerBevel);

  finalColor = vec4(col, 1.0);
}
`;

export interface CRTFilterHandle {
  filter: PIXI.Filter;
  setTime: (timeSeconds: number) => void;
}

export function createCRTFilter(): CRTFilterHandle {
  const uniforms = new PIXI.UniformGroup({
    uTime: { value: 0, type: "f32" },
    uCurvature: { value: 5.4, type: "f32" },
    uScanlineIntensity: { value: 0.11, type: "f32" },
    uFlickerIntensity: { value: 0.024, type: "f32" },
  });

  const glProgram = PIXI.GlProgram.from({
    vertex: CRT_VERTEX,
    fragment: CRT_FRAGMENT,
    name: "old-pc-crt-filter",
    preferredFragmentPrecision: "highp",
  });

  const filter = new PIXI.Filter({
    glProgram,
    resources: {
      crtUniforms: uniforms,
    },
    antialias: "off",
    clipToViewport: true,
  });

  return {
    filter,
    setTime: (timeSeconds: number) => {
      uniforms.uniforms.uTime = timeSeconds;
    },
  };
}
