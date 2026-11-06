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

Each style comes as three WOFF2 files with identical outlines, spacing, kerning,
and features:

| File | Contains | Regular size |
| --- | --- | --- |
| `satoma-sans-400-latin.woff2` | ASCII, Western European accents, punctuation, €, ™ | ~13 KB |
| `satoma-sans-400-latin-ext.woff2` | Central/Eastern European and other accents, math symbols | ~11 KB |
| `satoma-sans-400.woff2` | Everything, in one file | ~22 KB |

`satoma-sans.css` uses the split files with `unicode-range`, so browsers download
only the Latin core unless a page contains an extended character. Kerning
between a core and an extended character is not applied, as with any split
web font. Use the single-file WOFF2 if you write your own `@font-face` and
prefer one request per style.

`satoma-sans.css` also defines `"Satoma Sans Fallback"`: the local Arial,
resized to Satoma's average width and line height. Put it second in
`font-family` so text doesn't jump when Satoma finishes loading.

For the fastest first render:

- Serve the fonts from your own origin. A font CDN on another domain adds a
  connection before the first byte.
- Put the `@font-face` rules in your main bundled CSS instead of a separate
  stylesheet. That removes one request from the HTML → CSS → font chain.
- Preload only the one or two files used above the fold, typically regular:
  `<link rel="preload" href="/fonts/satoma-sans-400-latin.woff2?v=0.302" as="font" type="font/woff2" crossorigin>`.
  The `href` must match the CSS URL exactly, query string included, or the
  font downloads twice.
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
