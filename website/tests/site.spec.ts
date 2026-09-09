import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";

test("font, live GPU sculpture, specimens, tester, glyphs and downloads", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".sculpture-stage")).toHaveClass(/ready/);
  await expect(page.locator("#render-mode, #motion-toggle")).toHaveCount(0);
  await expect(page.locator(".interaction-hint")).toBeVisible();
  await expect(page.locator(".weight-row")).toHaveCount(18);
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).toBe("rgb(0, 0, 0)");
  const canvas = page.locator("#sculpture");
  const pixels = PNG.sync.read(await canvas.screenshot()).data;
  expect(
    pixels.filter((v, i) => i % 4 !== 3 && v > 120).length,
  ).toBeGreaterThan(10000);
  await page.locator("#tester-text").fill("Satoma style. 0123");
  await expect(page.locator("#tester-tracking")).toHaveValue("0");
  await expect(page.locator("#tester-text")).toHaveCSS(
    "letter-spacing",
    "normal",
  );
  await page.locator("#tester-tracking").fill("0.02");
  await page.locator("#tester-tracking").dispatchEvent("input");
  await page.locator("#tester-weight").selectOption("400");
  await expect(page.locator("#tester-text")).toHaveCSS("font-weight", "400");
  await page.locator("#tester-text").fill("Hello 🦊");
  await expect(page.locator("#coverage-status")).toContainText("🦊");
  await page.locator("#invert").click();
  await expect(page.locator(".type-surface")).toHaveClass(/inverted/);
  await page.locator("#reset").click();
  await expect(page.locator("#tester-text")).toHaveValue(
    "Stay curious.\nMake something.",
  );
  await expect(page.locator("#tester-text")).toHaveCSS("font-weight", "700");
  await expect(page.locator("#tester-tracking")).toHaveValue("0");
  await expect(page.locator("#tester-text")).toHaveCSS(
    "letter-spacing",
    "normal",
  );
  await page.locator('[data-category="numbers"]').click();
  expect(
    await page.locator("#glyph-grid button").count(),
  ).toBeGreaterThanOrEqual(10);
  await page.locator("#glyph-grid button").first().click();
  await expect(page.locator("#glyph-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#glyph-dialog")).not.toBeVisible();
  for (const href of await page
    .locator("a[download]")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")!))) {
    const response = await request.get(href);
    expect(response.ok()).toBe(true);
    const body = await response.body();
    expect(body.length).toBeGreaterThan(1000);
    if (href.includes(".woff2"))
      expect(body.subarray(0, 4).toString()).toBe("wOF2");
    else if (href.includes(".ttf"))
      expect(body.subarray(0, 4).toString("hex")).toBe("00010000");
    else expect(body.subarray(0, 2).toString()).toBe("PK");
  }
  expect(errors).toEqual([]);
});

test("phone sizes remain readable without horizontal overflow", async ({
  page,
}) => {
  for (const width of [360, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator("#tester-text").fill("abcdefghijklmnopqrstuvwxyz");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("glass follows mouse movement and resets with reduced motion enabled", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const canvas = page.locator("#sculpture");
  await expect(page.locator(".sculpture-stage")).toHaveClass(/ready/);
  await expect(canvas).toHaveCSS("opacity", "1");
  await canvas.scrollIntoViewIfNeeded();
  await canvas.focus();
  await page.keyboard.press("Home");
  const originalImage = PNG.sync.read(await canvas.screenshot());
  const original = originalImage.data;
  // The resting S must have a broad spectrum too, not only the edge-hit pose.
  let restingSpectrum = 0;
  for (
    let y = Math.floor(originalImage.height / 2);
    y < originalImage.height;
    y++
  ) {
    for (let x = 0; x < originalImage.width * 0.35; x++) {
      const i = (y * originalImage.width + x) * 4;
      const rgb = [original[i], original[i + 1], original[i + 2]];
      if (Math.max(...rgb) > 90 && Math.max(...rgb) - Math.min(...rgb) > 60)
        restingSpectrum++;
    }
  }
  expect(restingSpectrum).toBeGreaterThan(1500);
  const box = (await page.locator(".sculpture-stage").boundingBox())!;
  const canvasBox = (await canvas.boundingBox())!;
  const titleBox = (await page.locator("#hero-title").boundingBox())!;
  expect(canvasBox.y).toBeLessThan(titleBox.y);
  expect(canvasBox.y + canvasBox.height).toBeCloseTo(box.y + box.height, 0);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, {
    steps: 10,
  });
  // Let the deliberate eased response settle; no mouse button is ever pressed.
  await page.waitForTimeout(1800);
  let rotatedImage = PNG.sync.read(await canvas.screenshot());
  // Software WebGPU may need more wall time for the same eased frames.
  // Require actual pixel stability instead of assuming hardware throughput.
  await expect
    .poll(
      async () => {
        const next = PNG.sync.read(await canvas.screenshot());
        const stable = next.data.equals(rotatedImage.data);
        rotatedImage = next;
        return stable;
      },
      { timeout: 30000, intervals: [500, 1000] },
    )
    .toBe(true);
  const rotated = rotatedImage.data;
  const changed = original.filter(
    (v, i) => i % 4 !== 3 && Math.abs(v - rotated[i]) > 30,
  ).length;
  expect(changed).toBeGreaterThan(5000);
  expect(PNG.sync.read(await canvas.screenshot()).data.equals(rotated)).toBe(
    true,
  );
  // The transmitted beam must visibly split into colored light.
  let spectralPixels = 0;
  for (let i = 0; i < rotated.length; i += 4) {
    const rgb = [rotated[i], rotated[i + 1], rotated[i + 2]];
    if (Math.max(...rgb) > 90 && Math.max(...rgb) - Math.min(...rgb) > 60)
      spectralPixels++;
  }
  expect(spectralPixels).toBeGreaterThan(20);
  // Soft color must cover neighborhoods, not just isolated one-pixel ray cores.
  // This also catches stale GPU ribbon transforms after the S has rotated.
  let softSpectralPixels = 0;
  for (let y = 2; y < rotatedImage.height - 2; y++) {
    for (let x = 2; x < rotatedImage.width - 2; x++) {
      const i = (y * rotatedImage.width + x) * 4;
      const rgb = [rotated[i], rotated[i + 1], rotated[i + 2]];
      if (Math.max(...rgb) < 40 || Math.max(...rgb) - Math.min(...rgb) < 30)
        continue;
      const offsets = [-2, 2, -2 * rotatedImage.width, 2 * rotatedImage.width];
      if (
        offsets.every((offset) => {
          const j = i + offset * 4;
          return Math.max(rotated[j], rotated[j + 1], rotated[j + 2]) > 25;
        })
      )
        softSpectralPixels++;
    }
  }
  expect(softSpectralPixels).toBeGreaterThan(100);
  // A wide refraction fan must be continuous color, not separated laser lines.
  const sampleX = Math.floor(rotatedImage.width * 0.1);
  let run = 0,
    longestColorRun = 0;
  for (let y = 0; y < rotatedImage.height; y++) {
    const i = (y * rotatedImage.width + sampleX) * 4;
    const rgb = [rotated[i], rotated[i + 1], rotated[i + 2]];
    run =
      Math.max(...rgb) > 35 && Math.max(...rgb) - Math.min(...rgb) > 25
        ? run + 1
        : 0;
    longestColorRun = Math.max(longestColorRun, run);
  }
  expect(longestColorRun).toBeGreaterThan(100);
  // Rays must render above the old stage edge, including behind the title.
  const oldEdge = Math.floor(
    ((box.y - canvasBox.y) * rotatedImage.height) / canvasBox.height,
  );
  let upperLightPixels = 0;
  for (let y = 0; y < oldEdge - 5; y++) {
    for (let x = 0; x < rotatedImage.width; x++) {
      const i = (y * rotatedImage.width + x) * 4;
      const rgb = [rotated[i], rotated[i + 1], rotated[i + 2]];
      if (Math.max(...rgb) > 60 && Math.max(...rgb) - Math.min(...rgb) > 40)
        upperLightPixels++;
    }
  }
  expect(upperLightPixels).toBeGreaterThan(100);
  await page.keyboard.press("Home");
  await expect
    .poll(
      async () =>
        PNG.sync.read(await canvas.screenshot()).data.equals(original),
      { timeout: 15000 },
    )
    .toBe(true);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1800);
  expect(PNG.sync.read(await canvas.screenshot()).data.equals(original)).toBe(
    false,
  );
});

test("navigation and sample controls have real destinations and actions", async ({
  page,
  request,
}) => {
  await page.goto("/");
  for (const link of await page.locator('a[href^="#"]').all()) {
    const href = await link.getAttribute("href");
    expect(href).not.toBe("#");
    await expect(page.locator(href!)).toHaveCount(1);
  }
  for (const chip of await page.locator("[data-sample]").all()) {
    await chip.click();
    await expect(page.locator("#tester-text")).toHaveValue(
      (await chip.getAttribute("data-sample"))!,
    );
    await expect(chip).toHaveAttribute("aria-pressed", "true");
  }
  for (const href of await page
    .locator('a[href^="/"]:not([download])')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")!))) {
    expect((await request.get(href)).ok()).toBe(true);
  }
});

test("touch devices do not show mouse instructions", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1024, height: 1366 },
  });
  const page = await context.newPage();
  await page.goto(test.info().project.use.baseURL!);
  await expect(page.locator(".sculpture-stage")).toHaveClass(/ready/);
  await expect(page.locator(".interaction-hint")).toBeHidden();
  await context.close();
});

test("without WebGPU the typeface and static sculpture still work", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", { value: undefined }),
  );
  await page.goto("/");
  await expect(page.locator(".interaction-hint")).toBeHidden();
  await expect(page.locator("#sculpture")).toHaveCSS("pointer-events", "none");
  await expect(page.locator(".sculpture-fallback")).toBeVisible();
  await expect(page.locator(".weight-row")).toHaveCount(18);
  await page.locator("#tester-text").fill("Still sharp.");
  await expect(page.locator("#tester-text")).toHaveValue("Still sharp.");
});

test.describe("frame scheduling", () => {
  // Keep this CPU/animation-policy check independent of raster throughput.
  // Full-size visual correctness is covered by the sculpture tests above.
  test.use({ viewport: { width: 480, height: 320 }, deviceScaleFactor: 0.5 });
  test("mouse interaction renders at browser cadence instead of a 30 fps cap", async ({
    page,
  }) => {
    await page.clock.install({ time: new Date("2026-09-09T00:00:00Z") });
    await page.goto("/");
    await expect(page.locator(".sculpture-stage")).toHaveClass(/ready/);
    await page.locator("#sculpture").scrollIntoViewIfNeeded();
    await page.clock.pauseAt(new Date("2026-09-09T01:00:00Z"));
    const cadenceResult = page.evaluate(async () => {
      const stage = document.querySelector(".sculpture-stage")!;
      const box = stage.getBoundingClientRect();
      // Count actual GPU submissions, grouping multiple passes in one frame.
      const queue = (globalThis as any).GPUQueue.prototype;
      const submit = queue.submit;
      const times: number[] = [];
      queue.submit = function (...args: unknown[]) {
        const now = performance.now();
        if (!times.length || now - times[times.length - 1] > 2) times.push(now);
        return submit.apply(this, args);
      };
      let frames = 0;
      try {
        await new Promise<void>((resolve) => {
          const start = performance.now();
          const step = (now: number) => {
            frames++;
            stage.dispatchEvent(
              new PointerEvent("pointermove", {
                bubbles: true,
                pointerType: "mouse",
                clientX:
                  box.x +
                  box.width * (0.5 + Math.sin((now - start) / 500) * 0.2),
                clientY: box.y + box.height / 2,
              }),
            );
            if (now - start < 1500) requestAnimationFrame(step);
            else resolve();
          };
          requestAnimationFrame(step);
        });
      } finally {
        queue.submit = submit;
      }
      return { frames, renders: times.length };
    });
    // Real GPU submissions, but deterministic ~60 Hz RAF timestamps. A slow
    // software renderer must not turn this into a VM benchmark or hide a cap.
    await page.clock.runFor(1600);
    const cadence = await cadenceResult;
    expect(cadence.frames).toBeGreaterThan(80);
    expect(cadence.renders / cadence.frames).toBeGreaterThan(0.8);
  });
});
