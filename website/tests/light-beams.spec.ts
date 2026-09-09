import { test, expect } from "@playwright/test";
import * as THREE from "three/webgpu";
import { createLightBeams } from "../src/light-beams";

test("light paths ease changes, fade out, and settle deterministically", () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry(2, 3, 1);
  const material = new THREE.MeshBasicMaterial();
  const letter = new THREE.Mesh(geometry, material);
  const camera = new THREE.PerspectiveCamera();
  camera.position.z = 13;
  const beams = createLightBeams(scene, letter, camera);
  const core = scene.children[0] as THREE.InstancedMesh;
  const curtain = scene.getObjectByName("spectrum-curtain") as THREE.Mesh;
  const positions = curtain.geometry.getAttribute("position");
  const colors = curtain.geometry.getAttribute("color");
  const original = Array.from(core.instanceMatrix.array);
  letter.rotation.y = 0.6;
  beams.update(1 / 60);
  const eased = Array.from(core.instanceMatrix.array);
  expect(beams.settling).toBe(true);
  expect(eased).not.toEqual(original);
  beams.update();
  const target = Array.from(core.instanceMatrix.array);
  expect(eased).not.toEqual(target);
  expect(beams.settling).toBe(false);
  letter.position.x = 100;
  beams.update(1 / 60);
  expect(beams.settling).toBe(true);
  for (let i = 0; i < 120; i++) beams.update(1 / 60);
  expect(beams.settling).toBe(false);
  const settled = Array.from(core.instanceMatrix.array);
  const settledCurtain = Array.from(positions.array);
  expect(Array.from(colors.array).every((value) => value === 0)).toBe(true);
  beams.update(1 / 60);
  expect(Array.from(core.instanceMatrix.array)).toEqual(settled);
  expect(Array.from(positions.array)).toEqual(settledCurtain);
  beams.dispose();
  geometry.dispose();
  material.dispose();
});

test("parallel flat surfaces produce separated outgoing beams at several angles", () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry(20, 20, 1);
  const material = new THREE.MeshBasicMaterial();
  const letter = new THREE.Mesh(geometry, material);
  const camera = new THREE.PerspectiveCamera();
  camera.position.z = 13;
  const facing = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(9, 1.5, 1.8).normalize(),
  );
  const beams = createLightBeams(scene, letter, camera);
  const curtain = scene.getObjectByName("spectrum-curtain") as THREE.Mesh;
  for (const angle of [0, 0.3, 0.6]) {
    letter.quaternion.copy(facing);
    letter.rotateY(angle);
    beams.update();
    const outgoing = [0, 24].map((band) => {
      const positions = curtain.geometry.getAttribute("position");
      const stride = positions.count / 25;
      const center = (index: number) =>
        new THREE.Vector3()
          .fromBufferAttribute(positions, index)
          .add(new THREE.Vector3().fromBufferAttribute(positions, index + 1))
          .multiplyScalar(0.5);
      const start = center(band * stride);
      const end = center((band + 1) * stride - 2);
      const direction = end.sub(start);
      expect(direction.length()).toBeCloseTo(18, 4);
      return direction.normalize();
    });
    expect(outgoing[0].angleTo(outgoing[1])).toBeGreaterThan(0.2);
    const p = curtain.geometry.getAttribute("position");
    const stride = p.count / 25;
    const width = (index: number) =>
      new THREE.Vector3()
        .fromBufferAttribute(p, index)
        .distanceTo(new THREE.Vector3().fromBufferAttribute(p, index + 1));
    expect(width(stride - 2)).toBeGreaterThan(width(0) * 5);
  }
  beams.dispose();
  geometry.dispose();
  material.dispose();
});
