import * as THREE from "three/webgpu";
import {
  float,
  instancedBufferAttribute,
  smoothstep,
  uv,
  vec4,
} from "three/tsl";

type LightField = {
  sample(x: number, y: number, out: number[]): number[];
};

const COUNT = 900;

/**
 * Airborne dust that is only visible where the beam passes through it.
 * Mostly pinprick grains, a few brighter flakes and rare soft out-of-focus
 * motes. Positions drift slowly; reduced motion freezes them in place.
 */
export function createDust(plane: THREE.Object3D, light: LightField) {
  const random = mulberry32(7);
  const base = new Float32Array(COUNT * 3);
  const phase = new Float32Array(COUNT * 2);
  const strength = new Float32Array(COUNT);
  const sizes = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    // The plane in front of the camera: wide to the left where the fan opens.
    base[i * 3] = -13 + random() * 22;
    base[i * 3 + 1] = -6 + random() * 12;
    base[i * 3 + 2] = -1.2 + random() * 2.6;
    phase[i * 2] = random() * Math.PI * 2;
    phase[i * 2 + 1] = 0.2 + random() * 0.6;
    const kind = random();
    const size = random();
    if (kind < 0.84) {
      sizes[i] = 1.2 + size * 1.2;
      strength[i] = 0.5 + size * 0.5;
    } else if (kind < 0.97) {
      sizes[i] = 2.4 + size * 2.4;
      strength[i] = 0.9;
    } else {
      sizes[i] = 7 + size * 12;
      strength[i] = 0.08;
    }
  }
  const position = new THREE.InstancedBufferAttribute(
    new Float32Array(COUNT * 3),
    3,
  ).setUsage(THREE.DynamicDrawUsage);
  const color = new THREE.InstancedBufferAttribute(
    new Float32Array(COUNT * 3),
    3,
  ).setUsage(THREE.DynamicDrawUsage);
  const size = new THREE.InstancedBufferAttribute(sizes, 1);
  const material = new THREE.PointsNodeMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    sizeAttenuation: false,
  });
  material.positionNode = instancedBufferAttribute(position);
  material.sizeNode = instancedBufferAttribute<"float">(size).mul(
    Math.min(devicePixelRatio, 2),
  );
  const radius = uv().sub(0.5).length().mul(2);
  material.colorNode = vec4(
    instancedBufferAttribute<"vec3">(color).mul(
      float(1).sub(smoothstep(0.25, 1, radius)),
    ),
    1,
  );
  const sprite = new THREE.Sprite(material);
  sprite.count = COUNT;
  sprite.frustumCulled = false;
  sprite.renderOrder = 3;
  plane.add(sprite);

  const light_ = [0, 0, 0];
  function update(time: number, level = 1) {
    const p = position.array as Float32Array;
    const c = color.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      const a = phase[i * 2];
      const speed = phase[i * 2 + 1];
      const x = base[i * 3] + Math.sin(time * 0.07 * speed + a) * 0.35;
      const y =
        base[i * 3 + 1] +
        Math.cos(time * 0.05 * speed + a * 1.3) * 0.3 -
        ((time * 0.02 * speed) % 12);
      const wrappedY = y < -6 ? y + 12 : y;
      p[i * 3] = x;
      p[i * 3 + 1] = wrappedY;
      p[i * 3 + 2] = base[i * 3 + 2];
      light.sample(x, wrappedY, light_);
      const twinkle = 0.75 + 0.25 * Math.sin(time * 1.3 * speed + a * 3);
      const k = strength[i] * twinkle * 2.4 * level;
      c[i * 3] = light_[0] * k;
      c[i * 3 + 1] = light_[1] * k;
      c[i * 3 + 2] = light_[2] * k;
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
  }
  update(0);

  return {
    update,
    dispose() {
      plane.remove(sprite);
      material.dispose();
    },
  };
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
