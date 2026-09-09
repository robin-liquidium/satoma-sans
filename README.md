# Satoma Sans

A geometric sans with asymmetric rounded details and a compact rhythm.
Nine weights. Real italic companions. Free for personal and commercial projects.

**[Explore the typeface](https://satoma.robin.build)** · **[Download a release](https://github.com/robin-liquidium/satoma-sans/releases)** · **[Webapp guide](docs/WEBAPP-USAGE.md)**

Maintained by [Robin Obermaier](https://robin.build). Based on [Albert Sans](https://github.com/usted/Albert-Sans) by Andreas Rasmussen and the Albert Sans Project Authors.

## Use the font

Download the family ZIP from Releases or the website. For webapps, copy the
WOFF2 files, CSS, and `OFL.txt` into your application's public fonts folder:

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
strong { font-weight: 700; }
em { font-style: italic; }
.balance { font-variant-numeric: tabular-nums; }
```

For desktop use, install the TTF files. Only load the weights/styles your app
needs. Pin a release and upgrade intentionally; the website's latest download
is not an immutable production dependency.

## Family

| Weight | Style |
| --- | --- |
| 100 | Thin |
| 200 | Extra Light |
| 300 | Light |
| 400 | Regular |
| 500 | Medium |
| 600 | Demi Bold |
| 700 | Bold |
| 800 | Extra Bold |
| 900 | Black |

Each weight has upright and native italic files: 18 static styles, TTF and
WOFF2, 395 encoded Latin/extended Latin characters, proportional and tabular
numbers. Underline and strikethrough work through normal text decoration.
This is not a variable font, and it does not include Cyrillic or arbitrary
combining-mark coverage. Current releases are pre-1.0.

## Develop

Use Node 24, pnpm 11.25, and Python 3.12. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm setup:font
pnpm build
pnpm dev
```

`font/sources/` and `font/scripts/` are the source of truth. `font/dist/` holds
the distributable files. The website receives generated, Git-ignored copies
during its build. Do not edit those copies.

See [development and releases](docs/DEVELOPMENT.md), [design provenance](docs/SATOMA-PROVENANCE.md), and [changelog](CHANGELOG.md).

## Contribute

Open an issue with the affected text, weight/style, browser or application,
and a screenshot. For outline changes, check related letters, accents, all
weights, and italics. Include a before/after specimen and run the font audit.
Contributions use the license of the component they modify. Do not contribute
proprietary font outlines, private assets, or material you cannot redistribute.

## License and credit

Fonts, their sources, build scripts, and font documentation: **SIL OFL 1.1**,
in [OFL.txt](OFL.txt). Separately authored website and orchestration code:
**MIT**, as scoped in [LICENSE](LICENSE). Third-party dependencies retain
their own licenses.

Keep copyright/license notices with redistributed fonts. Your app does not
need to be open source. A visible credit is appreciated, **not required**:
“Typography: [Satoma Sans](https://satoma.robin.build).”

See [AUTHORS.md](AUTHORS.md) for upstream and Satoma credits.
