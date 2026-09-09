import { test, expect } from "@playwright/test";
import {
  BoxGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from "three";
import { MeshBVH, acceleratedRaycast, disposeBoundsTree } from "three-mesh-bvh";
import { refract, glassIor, prismExit } from "../src/optics";

test("accelerated ray hits preserve mirrored glass surfaces and normals", () => {
  const geometry = new BoxGeometry(2, 3, 1, 3, 3, 3);
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const mesh = new Mesh(geometry, material);
  mesh.scale.y = -1;
  mesh.rotation.set(0.2, -0.4, -0.12);
  mesh.updateMatrixWorld(true);
  const raycaster = new Raycaster();
  raycaster.near = 0.002;
  raycaster.firstHitOnly = true;
  const stockRaycast = mesh.raycast;
  geometry.boundsTree = new MeshBVH(geometry, { indirect: true });
  for (const origin of [new Vector3(9, 1.5, 1.8), new Vector3(0, 0, 0)]) {
    raycaster.set(origin, new Vector3(-9, -1.5, -1.8).normalize());
    mesh.raycast = stockRaycast;
    const expected = raycaster.intersectObject(mesh, false)[0];
    mesh.raycast = acceleratedRaycast;
    const actual = raycaster.intersectObject(mesh, false)[0];
    expect(actual.point.distanceTo(expected.point)).toBeLessThan(1e-9);
    expect(actual.face!.normal.distanceTo(expected.face!.normal)).toBeLessThan(
      1e-9,
    );
  }
  disposeBoundsTree.call(geometry);
  geometry.dispose();
  material.dispose();
});

test("Snell refraction bends toward the normal on entry and reverses on exit", () => {
  const incident = new Vector3(
    Math.sin(Math.PI / 4),
    0,
    -Math.cos(Math.PI / 4),
  );
  const normal = new Vector3(0, 0, 1);
  const entered = refract(incident, normal, 1 / 1.52)!;
  expect(entered.x).toBeCloseTo(Math.sin(Math.PI / 4) / 1.52, 10);
  expect(entered.length()).toBeCloseTo(1, 10);
  expect(refract(entered, normal, 1.52)!.distanceTo(incident)).toBeLessThan(
    1e-10,
  );
});

test("total internal reflection and wavelength ordering are correct", () => {
  const normal = new Vector3(0, 0, 1);
  const steep = new Vector3(Math.sin(Math.PI / 3), 0, -Math.cos(Math.PI / 3));
  expect(refract(steep, normal, 1.52)).toBeNull();
  expect(glassIor(420)).toBeGreaterThan(glassIor(560));
  expect(glassIor(560)).toBeGreaterThan(glassIor(700));
  const blue = refract(steep, normal, 1 / glassIor(420))!;
  const red = refract(steep, normal, 1 / glassIor(700))!;
  expect(blue.x).toBeLessThan(red.x);
  expect(refract(new Vector3(0, 0, -1), normal, 1 / 1.52)!.z).toBe(-1);
});

test("broad-face prism spread separates wavelengths without reversing the exit", () => {
  const normal = new Vector3(0, 0, 1);
  const axis = new Vector3(0, 1, 0);
  for (const angle of [0, 0.3, 0.7, 1.2]) {
    const incident = new Vector3(Math.sin(angle), 0, -Math.cos(angle));
    const outputs = [420, 560, 700].map((wavelength) => {
      const entered = refract(incident, normal, 1 / glassIor(wavelength))!;
      const exited = refract(entered, normal, glassIor(wavelength))!;
      expect(exited.distanceTo(incident)).toBeLessThan(1e-10);
      const spread = prismExit(exited, normal, axis, wavelength, 1);
      expect(spread.length()).toBeCloseTo(1, 10);
      expect(spread.dot(normal)).toBeLessThan(0);
      expect(
        prismExit(exited, normal, axis, wavelength, 0).distanceTo(exited),
      ).toBeLessThan(1e-10);
      return spread;
    });
    expect(outputs[0].angleTo(outputs[2])).toBeGreaterThan(0.25);
    expect(outputs[0].y).toBeGreaterThan(outputs[1].y);
    expect(outputs[1].y).toBeGreaterThan(outputs[2].y);
  }
  // Even a prism axis facing back into the surface must not reverse a ray.
  const grazing = new Vector3(1, 0, -0.01).normalize();
  const limited = prismExit(grazing, normal, normal, 420, 1);
  expect(limited.dot(normal)).toBeLessThan(0);
  expect(limited.length()).toBeCloseTo(1, 10);
});
