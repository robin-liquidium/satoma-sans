import { test, expect } from "@playwright/test";
import manifest from "../src/font-manifest.json" with { type: "json" };

test("all 18 native styles load, with zero tracking and working decorations", async ({
  page,
}) => {
  await page.goto("/#playground");
  for (const selector of [
    'link[href*="satoma-sans.css"]',
    'link[rel="preload"][as="font"]',
    'a[href*="satoma-sans-family.zip"]',
  ]) {
    const links = page.locator(selector);
    expect(await links.count()).toBeGreaterThan(0);
    for (const link of await links.all()) {
      expect(
        new URL(
          (await link.getAttribute("href"))!,
          page.url(),
        ).searchParams.get("v"),
      ).toBe(manifest.version);
    }
  }
  const text = page.locator("#tester-text");
  await expect(page.locator("#tester-weight option")).toHaveCount(9);
  for (const style of ["normal", "italic"]) {
    await page.locator("#tester-font-style").selectOption(style);
    for (const weight of [100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      await page.locator("#tester-weight").selectOption(String(weight));
      const loaded = await page.evaluate(
        async ({ style, weight }) => {
          const fonts = await document.fonts.load(
            `${style} ${weight} 48px "Satoma Sans"`,
            "Satoma 0123",
          );
          return fonts.map((f) => ({
            style: f.style,
            weight: f.weight,
            status: f.status,
          }));
        },
        { style, weight },
      );
      expect(loaded).toEqual([
        { style, weight: String(weight), status: "loaded" },
      ]);
      await expect(text).toHaveCSS("font-style", style);
      await expect(text).toHaveCSS("font-weight", String(weight));
      await expect(text).toHaveCSS("letter-spacing", "normal");
    }
  }
  await page
    .locator("#tester-decoration")
    .selectOption("underline line-through");
  await expect(text).toHaveCSS(
    "text-decoration-line",
    "underline line-through",
  );
  await page.locator("#tester-numbers").selectOption("tabular-nums");
  await expect(text).toHaveCSS("font-variant-numeric", "tabular-nums");
  const widths = await page.evaluate(() => {
    const span = document.createElement("span");
    span.style.cssText =
      'position:absolute;visibility:hidden;font:100px "Satoma Sans";letter-spacing:0';
    document.body.append(span);
    const measure = (text: string, variant: string) => {
      span.textContent = text;
      span.style.fontVariantNumeric = variant;
      return span.getBoundingClientRect().width;
    };
    const result = {
      t1: measure("1111", "tabular-nums"),
      t8: measure("8888", "tabular-nums"),
      p1: measure("1111", "normal"),
      p8: measure("8888", "normal"),
    };
    span.remove();
    return result;
  });
  expect(widths.t1).toBeCloseTo(widths.t8, 2);
  expect(Math.abs(widths.p1 - widths.p8)).toBeGreaterThan(50);
  await page.locator("#reset").click();
  await expect(page.locator("#tester-font-style")).toHaveValue("normal");
  await expect(page.locator("#tester-decoration")).toHaveValue("none");
  await expect(page.locator("#tester-numbers")).toHaveValue("normal");
  await expect(page.locator("#tester-tracking")).toHaveValue("0");
  await page.locator("#glyph-weight").selectOption("900");
  await page.locator("#glyph-style").selectOption("italic");
  await page.locator("#glyph-grid button").first().click();
  await expect(page.locator("#glyph-preview")).toHaveCSS(
    "font-style",
    "italic",
  );
  await expect(page.locator("#glyph-preview")).toHaveCSS("font-weight", "900");
  await expect(page.locator("a[download]")).toHaveCount(37);
});
