import { defineConfig } from "@playwright/test";
const linuxCI = Boolean(process.env.CI) && process.platform === "linux";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: linuxCI ? 90000 : 45000,
  expect: { timeout: linuxCI ? 15000 : 5000 },
  use: {
    headless: !linuxCI,
    baseURL: process.env.TEST_URL || "http://127.0.0.1:3002",
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    launchOptions: {
      executablePath: process.env.CHROME_PATH,
      args: [
        "--enable-unsafe-webgpu",
        ...(linuxCI
          ? [
              "--enable-features=Vulkan",
              "--use-angle=vulkan",
              "--use-vulkan=swiftshader",
              "--use-webgpu-adapter=swiftshader",
              "--disable-vulkan-surface",
            ]
          : []),
      ],
    },
  },
  webServer: process.env.TEST_URL
    ? undefined
    : {
        command: "pnpm dev --port 3002",
        url: "http://127.0.0.1:3002",
        reuseExistingServer: !process.env.CI,
      },
});
