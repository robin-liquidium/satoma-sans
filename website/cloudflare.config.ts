import { defineConfig } from "cf/config";

export default defineConfig({
  accountId: "81b27ab7c6fe3a3b3a0e6d31f7d2a381",
  worker: {
    name: "satoma-sans",
    compatibilityDate: "2026-09-09",
    workersDev: true,
    // Matches the live Worker, where preview URLs are on.
    previewUrls: true,
    assets: {
      notFoundHandling: "404-page",
    },
    domains: ["satoma.robin.build"],
  },
});
