import { test, expect } from "@playwright/test";
import * as THREE from "three/webgpu";
import {
  buildOutline,
  createLightBeams,
  traceRay,
  wavelengthToRgb,
} from "../src/light-beams";
import { glassIor } from "../src/optics";

const square = buildOutline([
  {
    outer: [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
    ],
    holes: [],
  },
]);
// A 43° prism, apex up: light crossing it bends toward the base, violet most.
const prism = buildOutline([
  {
    outer: [
      { x: -0.7, y: -0.8 },
      { x: 0, y: 1 },
      { x: 0.7, y: -0.8 },
    ],
    holes: [],
  },
]);

test("outward normals point from glass into air in either winding", () => {
  for (let i = 0; i < square.count; i++) {
    const s = square.segments.subarray(i * 8, i * 8 + 8);
    const mid = [(s[0] + s[2]) / 2, (s[1] + s[3]) / 2];
    // Every edge midpoint of the centred square lies along its own normal.
    expect(mid[0] * s[4] + mid[1] * s[5]).toBeGreaterThan(0);
  }
  const holed = buildOutline([
    {
      outer: [
        { x: -2, y: -2 },
        { x: -2, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: -2 },
      ],
      holes: [
        [
          { x: -1, y: -1 },
          { x: 1, y: -1 },
          { x: 1, y: 1 },
          { x: -1, y: 1 },
        ],
      ],
    },
  ]);
  // Hole edges face inward, toward the air at the centre.
  const hole = holed.segments.subarray(4 * 8, 4 * 8 + 8);
  const mid = [(hole[0] + hole[2]) / 2, (hole[1] + hole[3]) / 2];
  expect(mid[0] * hole[4] + mid[1] * hole[5]).toBeLessThan(0);
});

test("a slab passes light parallel while a prism disperses it", () => {
  const slab = traceRay(square, -5, 0.2, 1, 0, glassIor(420));
  expect(slab.escaped).toBe(true);
  expect(slab.points.length / 2 - 1).toBe(2);
  expect(slab.dx).toBeCloseTo(1, 10);
  expect(slab.dy).toBeCloseTo(0, 10);
  const [violet, red] = [420, 680].map((nm) =>
    traceRay(prism, -5, 0.1, 1, 0, glassIor(nm)),
  );
  for (const ray of [violet, red]) {
    expect(ray.escaped).toBe(true);
    expect(ray.points.length / 2 - 1).toBe(2);
  }
  expect(violet.dy).toBeLessThan(red.dy);
  expect(
    Math.atan2(red.dy, red.dx) - Math.atan2(violet.dy, violet.dx),
  ).toBeGreaterThan(0.02);
});

test("the spectrum runs violet, green, red", () => {
  const [blue, green, red] = [450, 540, 640].map(wavelengthToRgb);
  expect(blue[2]).toBeGreaterThan(blue[1]);
  expect(green[1]).toBeGreaterThan(green[0]);
  expect(green[1]).toBeGreaterThan(green[2]);
  expect(red[0]).toBeGreaterThan(red[1]);
});

test("light eases toward a new aim, settles, and lights only where it falls", () => {
  const letter = new THREE.Object3D();
  const beams = createLightBeams(
    letter,
    prism,
    { angle: 0, x: 0, y: 5 },
    { width: 0.2 },
  );
  const sheet = letter.getObjectByName("light-sheet") as THREE.Mesh;
  const rgb = [0, 0, 0];
  beams.aim({ angle: 0, x: 0, y: 0.1 });
  expect(beams.settling).toBe(true);
  beams.update(1 / 60);
  expect(beams.settling).toBe(true);
  beams.update();
  expect(beams.settling).toBe(false);
  expect(sheet.geometry.drawRange.count).toBeGreaterThan(0);
  // White on the way in, a dispersed fan beyond the far face.
  expect(beams.sample(-4, 0.1, rgb)[0]).toBeGreaterThan(0.5);
  const centre = traceRay(prism, -24, 0.1, 1, 0, glassIor(550));
  const [ex, ey] = centre.points.slice(-2);
  const fan = beams.sample(ex + centre.dx * 3, ey + centre.dy * 3, rgb).slice();
  expect(Math.max(...fan)).toBeGreaterThan(0);
  expect(Math.max(...fan) - Math.min(...fan)).toBeGreaterThan(0.05);
  expect(Math.max(...beams.sample(-4, 4, rgb))).toBeLessThan(1e-6);
  // Aimed past the glass, nothing is dispersed.
  beams.aim({ angle: 0, x: 0, y: 5 });
  beams.update();
  expect(
    Math.max(...beams.sample(ex + centre.dx * 3, ey + centre.dy * 3, rgb)),
  ).toBeLessThan(1e-6);
  beams.dispose();
  expect(letter.children).toHaveLength(0);
});
