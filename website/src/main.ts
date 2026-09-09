import "./style.css";
import manifest from "./font-manifest.json";

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
const weightOptions = weights
  .map(
    (w, i) =>
      `<option value="${w}" ${w === 700 ? "selected" : ""}>${names[i]} — ${w}</option>`,
  )
  .join("");
get("tester-weight").innerHTML = get("glyph-weight").innerHTML = weightOptions;
const phrases = [
  "Room to breathe.",
  "Quiet confidence.",
  "A little different.",
  "Make your mark.",
];
get("font-version").textContent = manifest.version;
get("weight-specimens").innerHTML = manifest.styles
  .map(
    (style, i) => `
  <article class="weight-row" style="font-weight:${style.weight};font-style:${style.italic ? "italic" : "normal"}">
    <div class="weight-row-top"><span>${names[weights.indexOf(style.weight)]}${style.italic ? " Italic" : ""} / ${style.weight}</span><span>Satoma Sans</span></div>
    <h3>${phrases[i % phrases.length]}</h3>
    <div class="alphabet"><p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p><p>abcdefghijklmnopqrstuvwxyz</p><p class="symbols">0123456789 &amp; ! ? @ # $ € £ % ( ) [ ] { } + − × ÷ =</p></div>
  </article>`,
  )
  .join("");
get("individual-downloads").innerHTML = manifest.styles
  .map(
    (style) =>
      `<div><h3>${names[weights.indexOf(style.weight)]}${style.italic ? " Italic" : ""}</h3><a href="/fonts/${style.fileStem}.ttf?v=${manifest.version}" download>TTF ↗</a><a href="/fonts/${style.fileStem}.woff2?v=${manifest.version}" download>WOFF2 ↗</a></div>`,
  )
  .join("");

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
  : "104";
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
  get("size-output").textContent = `${size.value} px`;
  get("tracking-output").textContent =
    `${Number(tracking.value).toFixed(3).replace("-", "−")} em`;
  get("tester-style").textContent =
    names[weights.indexOf(Number(weight.value))] +
    (fontStyle.value === "italic" ? " Italic" : "");
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
  text.style.height = `${Math.min(650, Math.max(210, text.scrollHeight + 2))}px`;
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
const categories = [
  ...document.querySelectorAll<HTMLButtonElement>("[data-category]"),
];
document.querySelector(".filter-group")!.setAttribute("role", "group");
let category = "all";
const visibleCodepoints = manifest.codepoints.filter(
  (cp) => !/[\p{Z}\p{C}\p{M}]/u.test(String.fromCodePoint(cp)),
);
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
    const code = `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
    button.setAttribute("aria-label", `Preview ${char}, ${code}`);
    button.addEventListener("click", () => {
      get("glyph-preview").textContent = char;
      get("glyph-preview").style.fontWeight = glyphWeight.value;
      get("glyph-preview").style.fontStyle = glyphStyle.value;
      get("glyph-code").textContent = code;
      get("glyph-name").textContent =
        names[weights.indexOf(Number(glyphWeight.value))] +
        (glyphStyle.value === "italic" ? " Italic" : "");
      dialog.showModal();
    });
    grid.append(button);
  }
  get("glyph-count").textContent = `${chars.length}`;
}
categories.forEach((button) =>
  button.addEventListener("click", () => {
    category = button.dataset.category!;
    categories.forEach((c) =>
      c.setAttribute("aria-pressed", String(c === button)),
    );
    renderGlyphs();
  }),
);
glyphWeight.addEventListener("change", () => {
  grid.style.fontWeight = glyphWeight.value;
});
glyphStyle.addEventListener("change", () => {
  grid.style.fontStyle = glyphStyle.value;
});
get("close-glyph").addEventListener("click", () => dialog.close());
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

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
if (!reduced.matches) {
  document.documentElement.classList.add("motion-ready");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}
requestAnimationFrame(() =>
  requestAnimationFrame(() =>
    import("./sculpture")
      .then((module) =>
        module.mountSculpture(get<HTMLCanvasElement>("sculpture")),
      )
      .catch((error) => {
        console.warn(
          "3D enhancement unavailable:",
          error instanceof Error ? error.message : error,
        );
      }),
  ),
);
