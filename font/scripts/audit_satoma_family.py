#!/usr/bin/env python3
"""Audit all 18 real styles and calibrate only actual pair clearance failures."""
import argparse
import json
import math
import unicodedata
from pathlib import Path

import numpy as np
import uharfbuzz as hb
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from generate_satoma import ROOT, OUT, VERSION
from outline_profile import profile


def run(calibrate=False):
    manifest = json.loads((OUT / "satoma-sans-manifest.json").read_text())
    correction_path = ROOT / "scripts/satoma_spacing.json"
    corrections = json.loads(correction_path.read_text())
    report = {}; postscript_names = set()
    assert len(manifest["styles"]) == 18
    for style in manifest["styles"]:
        key = str(style["weight"]) + ("-italic" if style["italic"] else "")
        path = OUT / (style["fileStem"] + ".ttf")
        font = TTFont(path); web = TTFont(path.with_suffix(".woff2"))
        cmap = font.getBestCmap(); os2 = font["OS/2"]
        assert font["name"].getDebugName(16) == "Satoma Sans"
        name = font["name"].getDebugName(6)
        assert name not in postscript_names; postscript_names.add(name)
        assert os2.usWeightClass == style["weight"]
        assert bool(os2.fsSelection & 1) == style["italic"]
        assert bool(font["head"].macStyle & 2) == style["italic"]
        assert font["post"].italicAngle == (-11.25 if style["italic"] else 0)
        assert font["hhea"].caretSlopeRun == (199 if style["italic"] else 0)
        assert os2.fsType == 0 and VERSION in font["name"].getDebugName(5)
        assert font["post"].underlinePosition < 0
        assert 0 < os2.yStrikeoutPosition < os2.sxHeight
        assert font["post"].underlineThickness > 0 and os2.yStrikeoutSize > 0
        assert font["hmtx"].metrics == web["hmtx"].metrics
        assert cmap == web.getBestCmap()
        assert font["glyf"].compile(font) == web["glyf"].compile(web)
        if style["weight"] <= 300:
            period = font["glyf"][cmap[ord(".")]]
            for char in "ijįﬁ":
                glyph = font["glyf"][cmap[ord(char)]]; start = 0; dots = []
                for end in glyph.endPtsOfContours:
                    points = glyph.coordinates[start:end+1]; start = end+1
                    xs, ys = zip(*points)
                    if min(ys) > 550:
                        dots.append((max(xs)-min(xs), max(ys)-min(ys)))
                assert len(dots) == 1, (key, char, "missing dot")
                assert abs(dots[0][0] - (period.xMax-period.xMin)) <= 2, (key, char, "dot width")
                assert abs(dots[0][1] - (period.yMax-period.yMin)) <= 1, (key, char, "dot height")
        for name in font.getGlyphOrder():
            glyph = font["glyf"][name]
            if glyph.numberOfContours:
                assert glyph.yMax <= os2.usWinAscent and glyph.yMin >= -os2.usWinDescent, (key, name, "clipping")
        shaping = hb.Font(hb.Face(path.read_bytes()))
        def shape(text, features):
            b = hb.Buffer(); b.add_str(text); b.guess_segment_properties(); hb.shape(shaping, b, features)
            return b
        for sequence in ("0123456789", "11110000", "9876543210"):
            tabular = shape(sequence, {"tnum": True})
            assert len({p.x_advance for p in tabular.glyph_positions}) == 1, (key, "tnum")
        assert len({p.x_advance for p in shape("0123456789", {}).glyph_positions}) > 1
        characters = "".join(chr(cp) for cp in sorted(cmap)
            if unicodedata.category(chr(cp))[0] in "LNPS" and not unicodedata.combining(chr(cp)))
        profiles = profile(path, characters)
        # Shape each pair through HarfBuzz, rather than approximating GPOS.
        failures = []; changes = {}; focused = {}
        for a in characters:
            _, right, ar = profiles[a]
            for b in characters:
                left, _, br = profiles[b]; rows = ar & br
                if not rows.any(): continue
                shaped = shape(a + b, {"liga": False, "clig": False})
                if len(shaped.glyph_positions) != 2: continue
                first, second = shaped.glyph_positions
                advance = first.x_advance + second.x_offset - first.x_offset - 30
                gap = int((advance + left[rows] - right[rows] - 1).min())
                if gap < 8:
                    failures.append((a+b, gap)); changes[a+b] = 12-gap
                if a+b in ("ty", "ab", "qr", "qu", "k.", "mu", "nm", "um", "fi"):
                    focused[a+b] = gap
        report[key] = {"pairs": len(characters)**2, "failures": len(failures), "gapsAtMinus30": focused}
        print(key, report[key], flush=True)
        if calibrate:
            target = corrections.setdefault(key, {})
            for pair, amount in changes.items(): target[pair] = target.get(pair, 0) + amount
            for pair in ("ab", "qr"):
                target[pair] = target.get(pair, 0) + 32 - focused[pair]
        else:
            assert not failures, (key, sorted(failures, key=lambda x:x[1])[:15])
    if calibrate:
        correction_path.write_text(json.dumps(corrections, ensure_ascii=False, indent=2) + "\n")
    else:
        target = ROOT / "reports/family-audit.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(report, indent=2) + "\n")


def proof():
    target = ROOT / "proofs"
    target.mkdir(parents=True, exist_ok=True)
    label = ImageFont.truetype(str(OUT / "satoma-sans-400.ttf"), 20)
    for start, weights in enumerate(((100,200,300),(400,500,600),(700,800,900))):
        im = Image.new("RGB", (1800, 1320), "#101216"); draw = ImageDraw.Draw(im)
        for row, weight in enumerate(weights):
            for col, italic in enumerate((False, True)):
                stem = f"satoma-sans-{weight}" + ("-italic" if italic else "")
                font = ImageFont.truetype(str(OUT / (stem + ".ttf")), 82)
                small = ImageFont.truetype(str(OUT / (stem + ".ttf")), 37)
                x, y = 35 + col * 900, 25 + row * 440
                draw.text((x,y), f"{weight} / {'Italic' if italic else 'Upright'} / tracking 0",font=label,fill="#929292")
                for i, text in enumerate(("Satoma Sans", "abdgmnpqru", "ty work. fi 0123")):
                    draw.text((x,y+42+i*96),text,font=font,fill="#f2f0ec")
                draw.text((x,y+345),"ÀÁÄ ÇÈÉ ÑÖÜ ß æœ €$%",font=small,fill="#f2f0ec")
        im.save(target / f"family-{start+1}.png")


if __name__ == "__main__":
    parser=argparse.ArgumentParser(); parser.add_argument("--calibrate", action="store_true"); parser.add_argument("--proof", action="store_true")
    args=parser.parse_args()
    proof() if args.proof else run(args.calibrate)
