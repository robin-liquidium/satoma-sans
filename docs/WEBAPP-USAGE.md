# Satoma Sans in webapps

Satoma Sans has its tighter spacing built in. Use `letter-spacing: 0`;
do not add the old `-0.025em` adjustment again.

## Install

Copy the WOFF2 files, `satoma-sans.css`, and `OFL.txt` from this archive into
your app's public fonts directory. Import the stylesheet or add:

```html
<link rel="stylesheet" href="/fonts/satoma-sans.css" />
```

```css
body {
  font-family: "Satoma Sans", "Satoma Sans Fallback", sans-serif;
  font-weight: 400;
  letter-spacing: 0;
}

button, input, select, textarea { font: inherit; }
.medium { font-weight: 500; }
.semibold { font-weight: 600; }
strong { font-weight: 700; }
em { font-style: italic; }
.balance { font-variant-numeric: tabular-nums; }

.underlined {
  text-decoration-line: underline;
  text-decoration-thickness: from-font;
  text-underline-offset: 0.12em;
  text-decoration-skip-ink: auto;
}
del { text-decoration-line: line-through; }
```

## Load it fast

`satoma-sans.css` loads one complete WOFF2 per style (Regular is ~22 KB), with
every kerning pair intact. Browsers download only the styles a page uses.

For English-only interfaces, `satoma-sans-split.css` roughly halves that. Each
style is split into a Latin core (ASCII, Western European accents,
punctuation, €, ™; Regular ~13 KB) and an extended file (Central/Eastern
European accents, math symbols) that browsers fetch only when a page contains
one of its characters. The tradeoff: kerning between a core and an extended
character side by side (for example "Tā" or "Łó") is not applied, because
they come from different files. Text using only one half renders identically.

Both stylesheets define `"Satoma Sans Fallback"`: the local Arial, resized to
Satoma's average width and line height. Put it second in `font-family` to
reduce layout shift when Satoma finishes loading. It is an approximation;
individual lines can still rewrap.

For the fastest first render:

- Serve the fonts from your own origin. A font CDN on another domain adds a
  connection before the first byte.
- Put the `@font-face` rules in your main bundled CSS instead of a separate
  stylesheet. That removes one request from the HTML → CSS → font chain.
- Preload only the one or two files used above the fold, typically regular:
  `<link rel="preload" href="/fonts/satoma-sans-400.woff2?v=0.303" as="font" type="font/woff2" crossorigin>`
  (or `satoma-sans-400-latin.woff2` with the split stylesheet). The `href`
  must match the CSS URL exactly, query string included, or the font
  downloads twice.
- Because file names carry the version, cache them for a year:
  `Cache-Control: public, max-age=31536000, immutable`.
- Use only the weights your design needs. Each one is a separate download.

## Current coverage and limits

- Eighteen static styles: nine weights, each upright and italic. Thin 100,
  ExtraLight 200, Light 300, Regular 400, Medium 500, DemiBold 600, Bold 700,
  ExtraBold 800, Black 900. All italic files use Albert's actual italic source,
  with Satoma's changes, not a browser-generated slant.
- TTF for desktop installation; WOFF2 for web embedding. The WOFF2 files carry
  a reference to the SIL Open Font License instead of its full text and omit
  glyph names; the license itself ships alongside as `OFL.txt`.
- Underline and strikethrough are text decorations, not separate font variants.
  Both positioning/thickness metrics are present in the font.
- Latin and extended Latin: 395 encoded characters. Precomposed accents are
  included; arbitrary combining marks and Cyrillic are not.
- Standard ligatures, fractions, superscripts, ordinals, and five stylistic sets.
- Proportional numbers by default; optional tabular numbers (`tnum`) for aligned
  numeric columns. Enable with `font-variant-numeric: tabular-nums`.
- This is a static family, not a variable font. Use the nine supplied weight
  values instead of expecting continuous interpolation between them.

Load only the styles your app uses; unused `@font-face` definitions do not need
to download their font. Preload only essential above-the-fold styles. If an older
Satoma release is installed locally, replace it rather than keeping duplicates.

Keep the bundled copyright and SIL Open Font License with redistributed font
files. See `SATOMA-PROVENANCE.md` for the Albert Sans foundation and changes.
