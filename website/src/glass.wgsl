// Surface finish only. Three's physical lighting model owns Snell refraction,
// RGB dispersion, Fresnel reflection, and volume attenuation.
export fn glassRoughness(position: vec3f) -> f32 {
  return 0.025 + 0.008 * (0.5 + 0.5 * sin(position.y * 1.4));
}
