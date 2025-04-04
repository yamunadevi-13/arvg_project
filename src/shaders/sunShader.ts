export const vertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}`;

export const fragmentShader = `
uniform float time;
uniform vec3 color;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

// Noise functions
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
  return mod289(((x * 34.0) + 1.0) * x);
}

vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  // Permutations
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  // Gradients: 7x7 points over a square, mapped onto an octahedron.
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  // Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 x) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100);
    for (int i = 0; i < 5; ++i) {
        v += a * snoise(x);
        x = x * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main() {
    float viewDistance = length(vViewPosition);
    float scale = smoothstep(5.0, 20.0, viewDistance);
    
    // Multi-layered noise for surface detail
    float baseNoise = fbm(vec3(vUv * 8.0, time * 0.2));
    float detailNoise = fbm(vec3(vUv * 32.0, time * 0.5));
    float microDetail = fbm(vec3(vUv * 64.0, time * 0.8));
    
    // Blend noise layers based on view distance
    float blendedNoise = mix(
        mix(microDetail, detailNoise, scale),
        baseNoise,
        scale * scale
    );
    
    // Base sun color
    vec3 baseColor = vec3(1.0, 0.6, 0.1); // Warm orange
    
    // Dynamic color variations
    vec3 hotSpot = vec3(1.0, 0.9, 0.3);    // Bright yellow
    vec3 midTemp = vec3(1.0, 0.5, 0.1);     // Orange
    vec3 coolSpot = vec3(0.9, 0.3, 0.1);    // Dark orange/red
    
    // Create plasma-like effect
    float plasma = sin(blendedNoise * 6.28 + time) * 0.5 + 0.5;
    plasma = pow(plasma, 1.0 + scale);
    
    // Surface turbulence
    float turbulence = fbm(vec3(vUv * 16.0 + time * 0.1, time * 0.2));
    
    // Combine colors based on noise and view distance
    vec3 finalColor = mix(
        mix(hotSpot, midTemp, turbulence),
        coolSpot,
        plasma
    );
    
    // Add bright spots for close-up view
    if (viewDistance < 10.0) {
        float highlights = pow(fbm(vec3(vUv * 128.0, time * 1.2)), 3.0);
        finalColor += vec3(1.0, 0.9, 0.5) * highlights * (1.0 - scale) * 2.0;
    }
    
    // Rim lighting effect
    float fresnel = pow(1.0 - dot(vNormal, normalize(vViewPosition)), 2.0);
    finalColor += vec3(1.0, 0.8, 0.4) * fresnel * 0.5;
    
    // Emission and glow
    float glow = sin(time * 1.5) * 0.1 + 0.9;
    finalColor *= glow;
    
    // Boost overall brightness
    finalColor *= 1.5;
    
    gl_FragColor = vec4(finalColor, 1.0);
}`;