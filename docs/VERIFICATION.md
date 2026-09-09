# Release verification

The public release uses only the pinned Albert Sans sources. The earlier,
proprietary Liquidium font prototype is not included or used by the build.

For every release:

- Rebuild all 18 styles and check committed font distributions for drift.
- Validate upstream hashes, embedded licenses, family metadata, and ZIP contents.
- Run the complete font audit, including pair clearance, dot sizes, and shaping.
- Run the 14 website tests: style loading, interaction, mobile layout, downloads,
  GPU rendering, and the non-WebGPU fallback.
- Check the custom domain and the actual deployment triggered by a main push.
- Download the published release and verify its SHA-256 checksum.

The initial migration was compared with 0.301 at the font-table level. Spacing,
kerning, shaping, and style metadata are preserved. The only outline difference
is the one-unit ellipsis rounding correction documented in the changelog.

The local secret scan passed. The structured source-review helper could not
review this bundle because it rejects binary font diffs; it is not reported as
a completed automated code review. Font validation, source inspection, and
browser tests are separate checks, not a substitute for that review.
