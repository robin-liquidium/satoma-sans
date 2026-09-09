import { Vector3 } from "three";

/** Snell's law; null denotes total internal reflection. Normal faces the incident ray. */
export function refract(
  incident: Vector3,
  normal: Vector3,
  eta: number,
): Vector3 | null {
  const cosine = -incident.dot(normal);
  const k = 1 - eta * eta * (1 - cosine * cosine);
  if (k < 0) return null;
  return incident
    .clone()
    .multiplyScalar(eta)
    .addScaledVector(normal, eta * cosine - Math.sqrt(k))
    .normalize();
}

/** Cauchy dispersion, exaggerated slightly for a legible small-screen spectrum. */
export function glassIor(wavelengthNm: number) {
  return 1.42 + 0.03 / (wavelengthNm * 0.001) ** 2;
}

/** Art-directed prism spread where nearly parallel surfaces cancel refraction.
 * Keep the result in the exit hemisphere so the extra bend cannot send a ray
 * back into the glass. Strong natural edge refraction needs no extra spread.
 */
export function prismExit(
  ray: Vector3,
  normal: Vector3,
  axis: Vector3,
  wavelength: number,
  strength: number,
): Vector3 {
  const spread = strength * (0.12 + 3 * (glassIor(wavelength) - glassIor(700)));
  const result = ray.clone().addScaledVector(axis, spread);
  const outward = -result.dot(normal);
  const minimum = Math.min(0.05, -ray.dot(normal));
  if (outward < minimum) result.addScaledVector(normal, outward - minimum);
  return result.normalize();
}
