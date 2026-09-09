import { glassRoughness } from "../src/glass.wgsl";
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let position = vec3f((uv - 0.5) * 8.0, 0.0);
  // Amplify roughness for a readable diagnostic image and CPU comparison.
  return vec4f(vec3f(glassRoughness(position) * 20.0), 1.0);
}
