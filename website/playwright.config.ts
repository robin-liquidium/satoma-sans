import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.TEST_URL || "http://127.0.0.1:3002",
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    launchOptions: {
      executablePath: process.env.CHROME_PATH,
      args: ["--enable-unsafe-webgpu"],
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
