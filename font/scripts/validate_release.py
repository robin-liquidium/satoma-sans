"""Validate distributable font identity, licensing, and package contents. OFL 1.1."""
import hashlib
import json
import zipfile
from fontTools.ttLib import TTFont
from generate_satoma import OUT, REPO, SOURCE, SOURCE_SHA, ITALIC_SOURCE, ITALIC_SOURCE_SHA, VERSION

assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA
assert hashlib.sha256(ITALIC_SOURCE.read_bytes()).hexdigest() == ITALIC_SOURCE_SHA
manifest = json.loads((OUT / "satoma-sans-manifest.json").read_text())
assert manifest["version"] == VERSION and len(manifest["styles"]) == 18
license_text = (REPO / "OFL.txt").read_text()
assert "Albert Sans Project Authors" in license_text and "Robin Obermaier" in license_text
for style in manifest["styles"]:
    for extension in ("ttf", "woff2"):
        font = TTFont(OUT / f"{style['fileStem']}.{extension}")
        assert font["name"].getDebugName(16) == "Satoma Sans"
        assert font["name"].getDebugName(13) == license_text
        assert font["name"].getDebugName(11) == "https://satoma.robin.build"
        assert sorted(font.getBestCmap()) == manifest["codepoints"]
        assert font["OS/2"].fsType == 0
        assert font["OS/2"].usWeightClass == style["weight"]
        font.close()
with zipfile.ZipFile(OUT / "satoma-sans-family.zip") as archive:
    assert archive.testzip() is None
    assert archive.read("OFL.txt").decode() == license_text
    assert len([name for name in archive.namelist() if "/" not in name and name.endswith(".ttf")]) == 18
    assert "font/scripts/generate_satoma.py" in archive.namelist()
    assert "docs/WEBAPP-USAGE.md" in archive.namelist()
checksums = "".join(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n" for path in sorted(OUT.iterdir()) if path.is_file() and path.name != "SHA256SUMS.txt")
(OUT / "SHA256SUMS.txt").write_text(checksums)
print(f"Validated Satoma Sans {VERSION}: 18 styles, source hashes, metadata, licenses, and archive")
