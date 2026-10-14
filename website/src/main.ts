import Lenis from "lenis";
import "lenis/dist/lenis.css";
import "./style.css";
import manifest from "./font-manifest.json";

// Inertial page scrolling; Lenis falls back to native scrolling for reduced
// motion and animates in-page anchor links.
const lenis = new Lenis({
  autoRaf: true,
  anchors: true,
  lerp: 0.09,
  stopInertiaOnNavigate: true,
});

const get = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const weights = manifest.weights.map((style) => style.weight);
const names = [
  "Thin",
  "Extra Light",
  "Light",
  "Regular",
  "Medium",
  "Demi Bold",
  "Bold",
  "Extra Bold",
  "Black",
];
const nameOf = (weight: number, italic = false) =>
  names[weights.indexOf(weight)] + (italic ? " Italic" : "");
get("tester-weight").innerHTML = weights
  .map(
    (w, i) =>
      `<option value="${w}" ${w === 700 ? "selected" : ""}>${names[i]} — ${w}</option>`,
  )
  .join("");
get("glyph-weight").innerHTML = weights
  .map(
    (w, i) =>
      `<option value="${w}" ${w === 700 ? "selected" : ""}>${names[i]}</option>`,
  )
  .join("");
const phrases = [
  "Room to breathe",
  "Quiet confidence",
  "A little different",
  "Clear by default",
  "Make your mark",
  "Soft, then sharp",
  "Say it plainly",
  "Hold the line",
  "Weight that lands",
];
get("font-version").textContent = manifest.version;
get("weight-specimens").innerHTML = manifest.styles
  .map(
    (style) => `
  <article class="weight-row">
    <span class="row-label">${nameOf(style.weight, style.italic)}<span>${style.weight}</span></span>
    <span class="row-sample" style="font-weight:${style.weight};font-style:${style.italic ? "italic" : "normal"}">${phrases[weights.indexOf(style.weight)]}</span>
  </article>`,
  )
  .join("");
get("individual-downloads").innerHTML = manifest.styles
  .map(
    (style) =>
      `<div><span style="font-weight:${style.weight};font-style:${style.italic ? "italic" : "normal"}">${nameOf(style.weight, style.italic)}</span><a href="/fonts/${style.fileStem}.ttf?v=${manifest.version}" download aria-label="${nameOf(style.weight, style.italic)} TTF">TTF</a><a href="/fonts/${style.fileStem}.woff2?v=${manifest.version}" download aria-label="${nameOf(style.weight, style.italic)} WOFF2">WOFF2</a></div>`,
  )
  .join("");

// Vertical metrics of the shipped fonts, in font units (1000 per em).
const metrics = [
  { y: -700, label: "Cap height and ascender", value: "700", key: true },
  { y: -511, label: "x-height", value: "511" },
  { y: 0, label: "Baseline", value: "0" },
  { y: 178, label: "Descender", value: "−178" },
];
function drawAnatomy() {
  const svg = get("anatomy") as unknown as SVGSVGElement;
  const ns = "http://www.w3.org/2000/svg";
  svg.replaceChildren();
  const text = document.createElementNS(ns, "text");
  text.textContent = "Liquidium";
  text.setAttribute("font-size", "1000");
  text.setAttribute("font-weight", "300");
  text.setAttribute("x", "0");
  text.setAttribute("y", "0");
  svg.append(text);
  // Leave a left margin for the HTML metric labels so they never hit the H.
  const inset = text.getComputedTextLength() * 0.24;
  text.setAttribute("x", String(inset));
  const width = inset + text.getComputedTextLength() + 120;
  svg.setAttribute("viewBox", `0 -820 ${width} 1100`);
  const gradient = document.createElementNS(ns, "linearGradient");
  gradient.id = "spectrum-stroke";
  gradient.setAttribute("gradientUnits", "userSpaceOnUse");
  gradient.setAttribute("x1", "0");
  gradient.setAttribute("x2", String(width));
  const stops = [
    "#ff453a",
    "#ff9f0a",
    "#ffd60a",
    "#30d158",
    "#40c8e0",
    "#0a84ff",
    "#bf5af2",
  ];
  stops.forEach((color, i) => {
    const stop = document.createElementNS(ns, "stop");
    stop.setAttribute("offset", String(i / (stops.length - 1)));
    stop.setAttribute("stop-color", color);
    gradient.append(stop);
  });
  const defs = document.createElementNS(ns, "defs");
  defs.append(gradient);
  svg.append(defs);
  for (const metric of metrics) {
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", "0");
    line.setAttribute("x2", String(width));
    line.setAttribute("y1", String(metric.y));
    line.setAttribute("y2", String(metric.y));
    if (metric.key) line.classList.add("key");
    svg.prepend(line);
  }
  const plot = svg.parentElement!;
  plot.querySelectorAll(".metric").forEach((el) => el.remove());
  for (const metric of metrics) {
    const label = document.createElement("span");
    label.className = "metric";
    label.style.top = `${((metric.y + 820) / 1100) * 100}%`;
    label.innerHTML = `<span>${metric.label}</span><span>${metric.value}</span>`;
    plot.append(label);
  }
}
drawAnatomy();
document.fonts.ready.then(drawAnatomy);

// Thin to Black: the sticky word steps through the weights as you scroll.
const scrub = get("weight-scrub");
const scrubWord = scrub.querySelector<HTMLElement>(".scrub-word")!;
get("scrub-ticks").innerHTML = weights.map(() => "<li></li>").join("");
const ticks = [...scrub.querySelectorAll("li")];
let scrubStep = -1;
function updateScrub() {
  const box = scrub.getBoundingClientRect();
  const progress = Math.min(
    1,
    Math.max(0, -box.top / Math.max(1, box.height - innerHeight)),
  );
  const step = Math.min(
    weights.length - 1,
    Math.floor(progress * weights.length),
  );
  if (step === scrubStep) return;
  scrubStep = step;
  scrubWord.style.fontWeight = String(weights[step]);
  get("scrub-name").textContent = names[step];
  get("scrub-weight").textContent = String(weights[step]);
  ticks.forEach((tick, i) => tick.classList.toggle("on", i <= step));
}
// The nav steps aside while reading down and returns on any scroll up.
const nav = document.querySelector<HTMLElement>(".nav")!;
let lastY = scrollY;
function updateNav() {
  const y = scrollY;
  nav.classList.toggle("scrolled", y > 40);
  if (Math.abs(y - lastY) > 6) {
    nav.classList.toggle("hidden", y > lastY && y > innerHeight * 0.6);
    lastY = y;
  }
}
nav.addEventListener("focusin", () => nav.classList.remove("hidden"));
let scrollQueued = false;
addEventListener(
  "scroll",
  () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      updateScrub();
      updateNav();
    });
  },
  { passive: true },
);
updateScrub();
updateNav();

const text = get<HTMLTextAreaElement>("tester-text");
const weight = get<HTMLSelectElement>("tester-weight");
const size = get<HTMLInputElement>("tester-size");
const tracking = get<HTMLInputElement>("tester-tracking");
const fontStyle = get<HTMLSelectElement>("tester-font-style");
const decoration = get<HTMLSelectElement>("tester-decoration");
const numbers = get<HTMLSelectElement>("tester-numbers");
const surface = text.closest<HTMLElement>(".type-surface")!;
const supported = new Set(manifest.codepoints);
const defaultSize = window.matchMedia("(max-width:700px)").matches
  ? "58"
  : "120";
size.value = defaultSize;
const chips = [
  ...document.querySelectorAll<HTMLButtonElement>("[data-sample]"),
];

function updateTester() {
  text.style.fontWeight = weight.value;
  text.style.fontStyle = fontStyle.value;
  text.style.textDecorationLine = decoration.value;
  text.style.fontVariantNumeric = numbers.value;
  surface.style.setProperty("--tester-size", `${size.value}px`);
  text.style.letterSpacing = `${tracking.value}em`;
  for (const range of [size, tracking])
    range.style.setProperty(
      "--fill",
      `${((Number(range.value) - Number(range.min)) / (Number(range.max) - Number(range.min))) * 100}%`,
    );
  get("size-output").textContent = `${size.value} px`;
  get("tracking-output").textContent =
    `${Number(tracking.value).toFixed(3).replace("-", "−")} em`;
  get("tester-style").textContent = nameOf(
    Number(weight.value),
    fontStyle.value === "italic",
  );
  const missing = [
    ...new Set(
      [...text.value.normalize("NFC")].filter(
        (c) => !/\s/u.test(c) && !supported.has(c.codePointAt(0)!),
      ),
    ),
  ];
  const status = get("coverage-status");
  status.textContent = missing.length
    ? `Not in this font: ${missing.join(" ")}`
    : "Your canvas. Start typing.";
  status.dataset.warning = String(missing.length > 0);
  text.style.height = "auto";
  text.style.height = `${Math.min(700, Math.max(240, text.scrollHeight + 2))}px`;
}
[size, tracking, text].forEach((control) =>
  control.addEventListener("input", updateTester),
);
[weight, fontStyle, decoration, numbers].forEach((control) =>
  control.addEventListener("change", updateTester),
);
chips.forEach((chip) =>
  chip.addEventListener("click", () => {
    text.value = chip.dataset.sample!;
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    updateTester();
  }),
);
text.addEventListener("input", () =>
  chips.forEach((c) =>
    c.setAttribute("aria-pressed", String(c.dataset.sample === text.value)),
  ),
);
get("invert").addEventListener("click", () =>
  get("invert").setAttribute(
    "aria-pressed",
    String(surface.classList.toggle("inverted")),
  ),
);
get("reset").addEventListener("click", () => {
  weight.value = "700";
  size.value = defaultSize;
  tracking.value = "0";
  fontStyle.value = "normal";
  decoration.value = "none";
  numbers.value = "normal";
  surface.classList.remove("inverted");
  get("invert").setAttribute("aria-pressed", "false");
  chips[0].click();
});
updateTester();
document.fonts.ready.then(updateTester);

const dialog = get<HTMLDialogElement>("glyph-dialog");
const glyphWeight = get<HTMLSelectElement>("glyph-weight");
const glyphStyle = get<HTMLSelectElement>("glyph-style");
const grid = get("glyph-grid");
const loupe = get("loupe-glyph");
const categories = [
  ...document.querySelectorAll<HTMLButtonElement>("[data-category]"),
];
document.querySelector(".filter-group")!.setAttribute("role", "group");
let category = "all";
const visibleCodepoints = manifest.codepoints.filter(
  (cp) => !/[\p{Z}\p{C}\p{M}]/u.test(String.fromCodePoint(cp)),
);
const codeOf = (char: string) =>
  `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
const kindOf = (char: string) =>
  /\p{L}/u.test(char)
    ? "Letter"
    : /\p{N}/u.test(char)
      ? "Number"
      : /\p{P}/u.test(char)
        ? "Punctuation"
        : "Symbol";
function inspect(char: string) {
  loupe.textContent = char;
  get("loupe-code").textContent = codeOf(char);
  get("loupe-kind").textContent = kindOf(char);
}
function renderGlyphs() {
  const chars = visibleCodepoints
    .map((cp) => String.fromCodePoint(cp))
    .filter(
      (c) =>
        category === "all" ||
        (category === "letters"
          ? /\p{L}/u.test(c)
          : category === "numbers"
            ? /\p{N}/u.test(c)
            : /[\p{P}\p{S}]/u.test(c)),
    );
  grid.replaceChildren();
  for (const char of chars) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = char;
    button.setAttribute("aria-label", `Preview ${char}, ${codeOf(char)}`);
    button.addEventListener("click", () => {
      get("glyph-preview").textContent = char;
      get("glyph-preview").style.fontWeight = glyphWeight.value;
      get("glyph-preview").style.fontStyle = glyphStyle.value;
      get("glyph-code").textContent = codeOf(char);
      get("glyph-name").textContent = nameOf(
        Number(glyphWeight.value),
        glyphStyle.value === "italic",
      );
      dialog.showModal();
      lenis.stop();
    });
    grid.append(button);
  }
  get("glyph-count").textContent = `${chars.length}`;
}
for (const type of ["pointerover", "focusin"])
  grid.addEventListener(type, (event) => {
    const button = (event.target as HTMLElement).closest("button");
    if (button) inspect(button.textContent!);
  });
categories.forEach((button) =>
  button.addEventListener("click", () => {
    category = button.dataset.category!;
    categories.forEach((c) =>
      c.setAttribute("aria-pressed", String(c === button)),
    );
    renderGlyphs();
  }),
);
const syncGlyphStyle = () => {
  for (const el of [grid, loupe]) {
    el.style.fontWeight = glyphWeight.value;
    el.style.fontStyle = glyphStyle.value;
  }
};
glyphWeight.addEventListener("change", syncGlyphStyle);
glyphStyle.addEventListener("change", syncGlyphStyle);
syncGlyphStyle();
get("close-glyph").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => lenis.start());
dialog.addEventListener("click", (event) => {
  const box = dialog.getBoundingClientRect();
  if (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  )
    dialog.close();
});
renderGlyphs();

requestAnimationFrame(() =>
  requestAnimationFrame(() =>
    import("./sculpture")
      .then((module) =>
        module.mountSculpture(get<HTMLCanvasElement>("sculpture")),
      )
      .catch((error) => {
        get("top").classList.add("no-gpu");
        console.warn(
          "3D enhancement unavailable:",
          error instanceof Error ? error.message : error,
        );
      }),
  ),
);
