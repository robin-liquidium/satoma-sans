/** Snell's law in 2D for unit vectors; null denotes total internal
 * reflection. The normal faces the incident ray. */
export function refract(
  dx: number,
  dy: number,
  nx: number,
  ny: number,
  eta: number,
): [number, number] | null {
  const cosine = -(nx * dx + ny * dy);
  const k = 1 - eta * eta * (1 - cosine * cosine);
  if (k < 0) return null;
  const factor = eta * cosine - Math.sqrt(k);
  const x = eta * dx + factor * nx;
  const y = eta * dy + factor * ny;
  const length = Math.hypot(x, y);
  return [x / length, y / length];
}

/** Cauchy dispersion, exaggerated slightly for a legible small-screen spectrum. */
export function glassIor(wavelengthNm: number) {
  return 1.42 + 0.03 / (wavelengthNm * 0.001) ** 2;
}
