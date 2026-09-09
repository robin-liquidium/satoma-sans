# Development and releases

## Source and build

Use Python 3.12, Node 24, and pnpm 11.25. Run `pnpm setup:font` once to install
the pinned font dependencies in `.venv`, and `pnpm install --frozen-lockfile`.

- `pnpm build` rebuilds all fonts, validates packaging, prepares the website, and runs its typecheck/build.
- `pnpm test:font` audits all 18 styles, outlines/metrics parity, dot sizes, shaping, and pair clearances.
- `pnpm dev` starts the local specimen at http://127.0.0.1:3002.
- In another terminal, `pnpm --dir website exec playwright install chromium` then `pnpm test:website` runs browser tests.
- `pnpm deploy:check` validates the Worker deployment without publishing.
- `pnpm deploy` is a manual recovery deployment, not the normal release path.

`font/dist/` is generated but committed (except ZIPs) so consumers can use
the fonts without Python. After editing font sources or scripts, rebuild and
commit the resulting distribution changes. CI checks this synchronization.
Never hand-edit `website/public/fonts/`; those copies are generated and ignored.

The font-only download includes `font/scripts`, `font/sources`, and the pinned
requirements. To rebuild it without the website, create a Python environment,
install `font/requirements.txt`, and run `python font/scripts/generate_satoma.py`.

## Continuous delivery

The public GitHub repository is `robin-liquidium/satoma-sans`. Cloudflare Workers
Builds watches **main** and builds/deploys Worker `satoma-sans` in Robin's account.
The custom domain is declared in `website/wrangler.jsonc` as `satoma.robin.build`.
Cloudflare manages the build token; no Cloudflare credentials belong in Git.

Build command: `pnpm setup:font && pnpm build && pnpm test:font`.
Deploy command: `pnpm deploy`.
Repository root: `/`. Branch: `main`. All paths trigger builds.

GitHub Actions validates changes on pull requests and main. Fork PRs get no
deployment credentials. Native Cloudflare deployment independently runs the
font audit and build before publishing.

## Publish a font release

1. Update `VERSION` in `font/scripts/generate_satoma.py`, release notes, and the root package version. The font version `0.302` corresponds to Git tag `v0.302.0`.
2. Run `pnpm build`, `pnpm test:font`, and the browser tests. Inspect specimen changes.
3. Commit source and generated font distribution files together. Push main.
4. After checks pass, tag the exact commit and push the tag. The release workflow checks tag/version consistency, rebuilds, audits, and attaches the family ZIP and SHA-256 checksums to a GitHub Release.
5. Verify the release download and production site. Existing releases stay pinned; do not overwrite their font assets.

The single root OFL contains both upstream and Satoma copyright notices. Keep
it aligned with font metadata and release packages. `font/sources/albert-sans/OFL.txt`
must remain the unmodified upstream license. No Reserved Font Names have been
added by Satoma.
