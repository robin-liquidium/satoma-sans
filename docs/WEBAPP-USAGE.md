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
  font-family: "Satoma Sans", sans-serif;
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

## Current coverage and limits

- Eighteen static styles: nine weights, each upright and italic. Thin 100,
  ExtraLight 200, Light 300, Regular 400, Medium 500, DemiBold 600, Bold 700,
  ExtraBold 800, Black 900. All italic files use Albert's actual italic source,
  with Satoma's changes, not a browser-generated slant.
- TTF for desktop installation; WOFF2 for web embedding.
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
