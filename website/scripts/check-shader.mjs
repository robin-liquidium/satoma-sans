import { writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { PNG } from "pngjs";
import { init, effect, target } from "vgpu/node";
const require = createRequire(import.meta.url);
const { resolveShader } = require(
  require.resolve("@vgpu/wgsl/runtime", { paths: [require.resolve("vgpu")] }),
);
const shader = await resolveShader({
  entry: new URL("./glass-proof.wgsl", import.meta.url).pathname,
});
const gpu = await init();
try {
  const output = target(gpu, { size: [320, 180] });
  effect(gpu, shader.wgsl).draw(output);
  const pixels = await output.read();
  const red = pixels.filter((_, i) => i % 4 === 0);
  let maxError = 0;
  for (let y = 0; y < 180; y++) {
    const py = ((y + 0.5) / 180 - 0.5) * 8;
    const expected = (0.025 + 0.008 * (0.5 + 0.5 * Math.sin(py * 1.4))) * 20;
    maxError = Math.max(
      maxError,
      Math.abs(pixels[y * 320 * 4] / 255 - expected),
    );
  }
  if (maxError > 2 / 255)
    throw new Error(`Glass finish differs from CPU reference: ${maxError}`);
  const png = new PNG({ width: 320, height: 180 });
  png.data.set(pixels);
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/glass-proof.png", PNG.sync.write(png));
  console.log(
    `Glass shader GPU/CPU maximum error: ${maxError}; red-channel range ${Math.min(...red)}–${Math.max(...red)}.`,
  );
} finally {
  gpu.dispose();
}
