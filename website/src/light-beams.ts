import * as THREE from "three/webgpu";
import { MeshBVH, acceleratedRaycast, disposeBoundsTree } from "three-mesh-bvh";
import { glassIor, prismExit, refract } from "./optics";

export function createLightBeams(
  scene: THREE.Scene,
  letter: THREE.Mesh,
  camera: THREE.Camera,
) {
  const bands = 25;
  const bounces = 9;
  const outgoingStart = bands * bounces;
  const capacity = outgoingStart + bands;
  const source = new THREE.Vector3(9, 1.5, 1.8);
  const direction = new THREE.Vector3(-9, -1.5, -1.8).normalize();
  const raycaster = new THREE.Raycaster();
  raycaster.near = 0.002;
  raycaster.firstHitOnly = true;
  const probeMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const probe = new THREE.Mesh(letter.geometry, probeMaterial);
  // Index the detailed bevels once, rather than scan every triangle per ray.
  letter.geometry.boundsTree = new MeshBVH(letter.geometry, { indirect: true });
  probe.raycast = acceleratedRaycast;
  probe.matrixAutoUpdate = false;
  const normalMatrix = new THREE.Matrix3();
  const prismAxis = new THREE.Vector3();
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  const ribbon = new THREE.PlaneGeometry(1, 1);
  // A Gaussian cross-section gives light a soft edge without a full-screen blur.
  const pixels = new Uint8Array(64 * 16 * 4);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      const across = (x / 63 - 0.5) * 2;
      const end = Math.min(1, y / 2, (15 - y) / 2);
      pixels.set(
        [255, 255, 255, Math.round(255 * Math.exp(-across * across * 9) * end)],
        i,
      );
    }
  }
  const profile = new THREE.DataTexture(pixels, 64, 16);
  profile.magFilter = profile.minFilter = THREE.LinearFilter;
  profile.needsUpdate = true;
  const up = new THREE.Vector3(0, 1, 0);
  const transform = new THREE.Object3D();
  const white = new THREE.Color(1, 1, 1);
  const coreMaterial = new THREE.MeshBasicNodeMaterial({ toneMapped: false });
  const glowMaterial = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    map: profile,
    opacity: 0.7,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  // Persistent instance buffers: no new GPU objects while the pointer moves.
  const core = new THREE.InstancedMesh(cylinder, coreMaterial, outgoingStart);
  const glow = new THREE.InstancedMesh(ribbon, glowMaterial, outgoingStart);
  // Explicit storage uploads keep transparent ribbons and opaque cores in sync;
  // the uniform-backed instancing path retained stale ribbon poses in WebGPU.
  for (const mesh of [core, glow]) {
    mesh.instanceMatrix = new THREE.StorageInstancedBufferAttribute(
      new Float32Array(outgoingStart * 16),
      16,
    );
    mesh.instanceColor = new THREE.StorageInstancedBufferAttribute(
      new Float32Array(outgoingStart * 3),
      3,
    );
  }
  core.frustumCulled = glow.frustumCulled = false;
  scene.add(core, glow);
  // Feathered wavelength fields overlap into a continuous volume of light.
  // Their width follows spectral separation, keeping a wide fan gap-free.
  const curtainSteps = 20;
  const curtainGeometry = new THREE.BufferGeometry();
  const curtainPositions = new THREE.BufferAttribute(
    new Float32Array(bands * (curtainSteps + 1) * 2 * 3),
    3,
  ).setUsage(THREE.DynamicDrawUsage);
  curtainGeometry.setAttribute("position", curtainPositions);
  const curtainColors = new THREE.BufferAttribute(
    new Float32Array(curtainPositions.count * 3),
    3,
  ).setUsage(THREE.DynamicDrawUsage);
  curtainGeometry.setAttribute("color", curtainColors);
  const curtainUvs = new THREE.BufferAttribute(
    new Float32Array(curtainPositions.count * 2),
    2,
  );
  const curtainIndices = [];
  for (let band = 0; band < bands; band++) {
    for (let row = 0; row <= curtainSteps; row++) {
      const index = (band * (curtainSteps + 1) + row) * 2;
      curtainUvs.setXY(index, 0, row / curtainSteps);
      curtainUvs.setXY(index + 1, 1, row / curtainSteps);
      if (row < curtainSteps)
        curtainIndices.push(
          index,
          index + 1,
          index + 2,
          index + 1,
          index + 3,
          index + 2,
        );
    }
  }
  curtainGeometry.setAttribute("uv", curtainUvs);
  curtainGeometry.setIndex(curtainIndices);
  const veilPixels = new Uint8Array(256 * 128 * 4);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 256; x++) {
      const u = x / 255,
        v = y / 127;
      const edge =
        Math.exp(-Math.pow((u - 0.5) * 2, 2) * 7) *
        THREE.MathUtils.smoothstep(u, 0, 0.04) *
        (1 - THREE.MathUtils.smoothstep(u, 0.96, 1));
      const distance =
        THREE.MathUtils.smoothstep(v, 0, 0.035) *
        (1 - THREE.MathUtils.smoothstep(v, 0.65, 1));
      veilPixels.set(
        [255, 255, 255, Math.round(255 * edge * distance)],
        (y * 256 + x) * 4,
      );
    }
  }
  const veil = new THREE.DataTexture(veilPixels, 256, 128);
  veil.magFilter = veil.minFilter = THREE.LinearFilter;
  veil.needsUpdate = true;
  const curtainMaterial = new THREE.MeshBasicNodeMaterial({
    map: veil,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const curtain = new THREE.Mesh(curtainGeometry, curtainMaterial);
  curtain.name = "spectrum-curtain";
  curtain.frustumCulled = false;
  scene.add(curtain);
  const segment = new THREE.Vector3();
  const view = new THREE.Vector3();
  const right = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const tint = new THREE.Color();
  const paths = Array.from({ length: capacity }, () => ({
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    targetA: new THREE.Vector3(),
    targetB: new THREE.Vector3(),
    color: new THREE.Color(),
    radius: 0,
    visibility: 0,
    active: false,
  }));
  let settling = false;

  function update(dt = Infinity) {
    letter.updateMatrixWorld(true);
    probe.matrixWorld.copy(letter.matrixWorld);
    normalMatrix.getNormalMatrix(letter.matrixWorld);
    prismAxis.set(0, 1, 0).transformDirection(letter.matrixWorld);
    paths.forEach((path) => {
      path.active = false;
    });
    function addSegment(
      id: number,
      a: THREE.Vector3,
      b: THREE.Vector3,
      color: THREE.Color,
      radius: number,
    ) {
      const path = paths[id];
      if (path.visibility === 0) {
        path.a.copy(a);
        path.b.copy(b);
      }
      path.targetA.copy(a);
      path.targetB.copy(b);
      path.color.copy(color);
      path.radius = radius;
      path.active = true;
    }
    for (let band = 0; band < bands; band++) {
      const wavelength = 420 + (band * 280) / (bands - 1);
      const ior = glassIor(wavelength);
      const color = new THREE.Color().setHSL(
        (1 - band / (bands - 1)) * 0.73,
        0.85,
        0.5,
      );
      let origin = source.clone();
      let ray = direction.clone();
      let inside = false;
      let entered = false;
      const entryNormal = new THREE.Vector3();
      for (let bounce = 0; bounce < bounces; bounce++) {
        const id = band * bounces + bounce;
        raycaster.set(origin, ray);
        const hit = raycaster.intersectObject(probe, false)[0];
        if (!hit || hit.distance > 24) {
          if (entered && !inside)
            addSegment(
              outgoingStart + band,
              origin,
              origin.clone().addScaledVector(ray, 18),
              color,
              0.004,
            );
          else if (!entered && band === 12)
            addSegment(
              id,
              origin,
              origin.clone().addScaledVector(ray, 24),
              white,
              0.008,
            );
          break;
        }
        if (!entered && band === 12)
          addSegment(id, source, hit.point, white, 0.008);
        else if (entered) addSegment(id, origin, hit.point, color, 0.003);
        const normal = hit.face!.normal.clone().applyNormalMatrix(normalMatrix);
        if (normal.dot(ray) > 0) normal.negate();
        const transmitted = refract(ray, normal, inside ? ior : 1 / ior);
        if (transmitted) {
          // Nearly parallel entry/exit surfaces cancel their bends, including
          // the S's side walls. Add a letter-local prism fan only in that case.
          const parallel = THREE.MathUtils.smoothstep(
            Math.abs(entryNormal.dot(normal)),
            0.8,
            0.98,
          );
          ray =
            inside && parallel > 0
              ? prismExit(transmitted, normal, prismAxis, wavelength, parallel)
              : transmitted;
          if (!inside) entryNormal.copy(normal);
          inside = !inside;
        } else ray = ray.clone().reflect(normal).normalize();
        entered = true;
        origin = hit.point.clone().addScaledVector(ray, 0.003);
      }
    }
    // Stable wavelength/bounce slots prevent one disappearing ray from moving
    // every subsequent ray. Ease positions and fade vanished paths separately.
    const blend = 1 - Math.exp(-18 * dt);
    settling = false;
    paths.forEach((path, id) => {
      const visible = path.active ? 1 : 0;
      path.visibility += (visible - path.visibility) * blend;
      if (Math.abs(visible - path.visibility) < 0.001)
        path.visibility = visible;
      if (path.active) {
        path.a.lerp(path.targetA, blend);
        path.b.lerp(path.targetB, blend);
        if (
          path.a.distanceToSquared(path.targetA) +
            path.b.distanceToSquared(path.targetB) <
          1e-6
        ) {
          path.a.copy(path.targetA);
          path.b.copy(path.targetB);
        } else settling = true;
      }
      if (path.visibility !== visible) settling = true;
      if (id >= outgoingStart) return;
      segment.subVectors(path.b, path.a);
      const length = segment.length();
      transform.position.copy(path.a).add(path.b).multiplyScalar(0.5);
      if (length > 0.002 && path.visibility > 0) {
        segment.divideScalar(length);
        transform.quaternion.setFromUnitVectors(up, segment);
        transform.scale.set(path.radius, length, path.radius);
      } else transform.scale.setScalar(0);
      transform.updateMatrix();
      core.setMatrixAt(id, transform.matrix);
      core.setColorAt(
        id,
        tint
          .copy(path.color)
          .multiplyScalar(
            path.visibility * (path.radius === 0.008 ? 0.65 : 0.25),
          ),
      );
      // Orient each soft ribbon toward the camera, around its light-path axis.
      view.subVectors(camera.position, transform.position).normalize();
      right.crossVectors(segment, view).normalize();
      normal.crossVectors(right, segment).normalize();
      basis.makeBasis(right, segment, normal);
      transform.quaternion.setFromRotationMatrix(basis);
      if (length > 0.002 && path.visibility > 0)
        transform.scale.set(path.radius === 0.008 ? 0.35 : 0.45, length, 1);
      transform.updateMatrix();
      glow.setMatrixAt(id, transform.matrix);
      glow.setColorAt(
        id,
        tint
          .copy(path.color)
          .multiplyScalar(path.visibility * (path.radius === 0.008 ? 1 : 0.3)),
      );
    });
    // Dedicated exit slots stay stable even when internal bounce counts change.
    // Only vertex contents move; geometry, materials and textures are reused.
    for (let band = 0; band < bands; band++) {
      const path = paths[outgoingStart + band];
      segment.subVectors(path.b, path.a).normalize();
      view.subVectors(camera.position, path.a).normalize();
      right.crossVectors(segment, view).normalize();
      let spacing = 0.12;
      for (const neighbor of [band - 1, band + 1]) {
        if (neighbor < 0 || neighbor >= bands) continue;
        const other = paths[outgoingStart + neighbor];
        if (other.visibility > 0) {
          normal.subVectors(other.b, path.b);
          spacing = Math.max(
            spacing,
            Math.abs(normal.dot(right)) * other.visibility,
          );
        }
      }
      const width = Math.min(8, spacing * 4.5);
      for (let row = 0; row <= curtainSteps; row++) {
        const progress = row / curtainSteps;
        const halfWidth = THREE.MathUtils.lerp(0.1, width, progress) / 2;
        segment.lerpVectors(path.a, path.b, progress);
        const index = (band * (curtainSteps + 1) + row) * 2;
        for (let side = 0; side < 2; side++) {
          const offset = halfWidth * (side === 0 ? -1 : 1);
          curtainPositions.setXYZ(
            index + side,
            segment.x + right.x * offset,
            segment.y + right.y * offset,
            segment.z + right.z * offset,
          );
          curtainColors.setXYZ(
            index + side,
            path.color.r * path.visibility * 0.45,
            path.color.g * path.visibility * 0.45,
            path.color.b * path.visibility * 0.45,
          );
        }
      }
    }
    curtainPositions.needsUpdate = curtainColors.needsUpdate = true;
    core.instanceMatrix.needsUpdate = glow.instanceMatrix.needsUpdate = true;
    if (core.instanceColor) core.instanceColor.needsUpdate = true;
    if (glow.instanceColor) glow.instanceColor.needsUpdate = true;
  }
  update();
  return {
    update,
    get settling() {
      return settling;
    },
    dispose() {
      scene.remove(core, glow, curtain);
      core.dispose();
      glow.dispose();
      cylinder.dispose();
      ribbon.dispose();
      profile.dispose();
      coreMaterial.dispose();
      glowMaterial.dispose();
      curtainGeometry.dispose();
      curtainMaterial.dispose();
      veil.dispose();
      probeMaterial.dispose();
      disposeBoundsTree.call(letter.geometry);
    },
  };
}
