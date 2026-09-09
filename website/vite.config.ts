import { defineConfig } from "vite";
import { wgslVitePlugin } from "vgpu/client";
import manifest from "./src/font-manifest.json" with { type: "json" };
export default defineConfig({
  build: { license: { fileName: "third-party-licenses.txt" } },
  plugins: [
    wgslVitePlugin({ minify: true }),
    {
      name: "font-release-version",
      transformIndexHtml: (html) =>
        html.replaceAll("__SATOMA_VERSION__", manifest.version),
    },
  ],
});
