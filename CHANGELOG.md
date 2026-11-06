# Changelog

## 0.303 — 2026-11-06

- Web fonts are about half the size. `satoma-sans.css` now loads a ~13 KB Latin
  core per style and fetches extended Latin and symbols only when a page uses
  them. Outlines, spacing, kerning, and features are unchanged; the audit shapes
  every character pair in every WOFF2 against the TTF to prove it.
- WOFF2 files carry the standard OFL reference instead of the full license text
  and drop glyph names. The single-file WOFF2 per style remains, about 13% smaller.
- Added a metric-matched `"Satoma Sans Fallback"` (local Arial) so text doesn't
  shift when the font finishes loading.
- Raised lowercase t and its cedilla, caron, and comma-below forms to the
  700-unit cap/ascender height in all nine weights and their italics. Crossbars,
  terminals, and accent positions are preserved.
- Added ascender-height checks to the family audit, including accented t stems.
- Aligned ł and þ stems to the same height across weights and italics.
- Adjusted pair spacing where accents approach the taller stems.

## 0.302 — 2026-09-09

- First dedicated public repository and release package.
- Standalone, pinned-source font build and platform-independent audit paths.
- Complete upstream and Satoma copyright/license metadata, authors, and usage documentation.
- Reproducible release ZIP and a shared font build for the website.
- Official specimen site at satoma.robin.build, linked to GitHub and robin.build.
- Spacing, kerning, weights, and italic designs unchanged from 0.301. Normalized
  floating-point shear rounding across macOS/Linux; this moves one Black Italic
  ellipsis outline point by one font unit. All other outlines are unchanged.

## 0.301 — 2026-09-07

- Thin, Extra Light, and Light i/j dots match the period size, including related accented forms and fi.

## 0.300 — 2026-09-07

- Expanded to nine upright weights and nine real italic companions.
- Built the preferred tighter spacing into the font advances; default CSS tracking is zero.
- Added tabular figures and pair-specific spacing corrections.

## Earlier development

Albert Sans-derived geometric family with one-sided rounding, revised g/y
tails and Q diagonal, coordinated bowl/shoulder details, and optical density
adjustments. See the provenance document for the design changes.
