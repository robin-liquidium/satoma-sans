import { test, expect } from "@playwright/test";
import { glassIor, refract } from "../src/optics";

test("Snell refraction bends toward the normal on entry and reverses on exit", () => {
  const incident: [number, number] = [
    Math.sin(Math.PI / 4),
    -Math.cos(Math.PI / 4),
  ];
  const entered = refract(...incident, 0, 1, 1 / 1.52)!;
  expect(entered[0]).toBeCloseTo(Math.sin(Math.PI / 4) / 1.52, 10);
  expect(Math.hypot(...entered)).toBeCloseTo(1, 10);
  const exited = refract(...entered, 0, 1, 1.52)!;
  expect(exited[0]).toBeCloseTo(incident[0], 10);
  expect(exited[1]).toBeCloseTo(incident[1], 10);
});

test("total internal reflection and wavelength ordering are correct", () => {
  const steep: [number, number] = [
    Math.sin(Math.PI / 3),
    -Math.cos(Math.PI / 3),
  ];
  expect(refract(...steep, 0, 1, 1.52)).toBeNull();
  expect(glassIor(420)).toBeGreaterThan(glassIor(560));
  expect(glassIor(560)).toBeGreaterThan(glassIor(700));
  const blue = refract(...steep, 0, 1, 1 / glassIor(420))!;
  const red = refract(...steep, 0, 1, 1 / glassIor(700))!;
  expect(blue[0]).toBeLessThan(red[0]);
  expect(refract(0, -1, 0, 1, 1 / 1.52)).toEqual([0, -1]);
});
