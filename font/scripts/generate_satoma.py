#!/usr/bin/env python3
"""Satoma Sans: an explicitly approved, SIL-OFL-licensed Albert Sans derivative.

Only Albert is read. No TT Commons/Liquidium font or SVG data is imported.
"""
from __future__ import annotations

import hashlib
import copy
import json
import math
import unicodedata
import zipfile
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
OUT = ROOT / "dist"
SOURCE = ROOT / "sources/albert-sans/AlbertSans.ttf"
SOURCE_SHA = "8fe5d4cf5822d7096d4d17ad781c90f97c745ac13a22be619db74966fba45fda"
ITALIC_SOURCE = SOURCE.with_name("AlbertSans-Italic.ttf")
ITALIC_SOURCE_SHA = "16eb3291f7389045e90a00abb66a3d2bca1d03387b7ebbbc2b0cd9a094f86226"
UPSTREAM_COMMIT = "fffdadf0f0c9cc1ec8b407063424a8bfbee05611"
VERSION = "0.302"
DEFAULT_TRACKING_EM = -0.025
WEIGHTS = {100: ("Thin", 100), 200: ("ExtraLight", 180), 300: ("Light", 260),
           400: ("Regular", 350), 500: ("Medium", 475), 600: ("DemiBold", 590),
           700: ("Bold", 720), 800: ("ExtraBold", 820), 900: ("Black", 900)}
# Optical proportions, measured against the brand reference at a 700-unit cap.
# These transform Albert's own outlines; no reference paths are imported.
WIDTH_SCALE = {"L": 1.027, "m": .933, "n": .9665, "h": .9665, "u": 1.039}
X_HEIGHT = 511
BRAND_PAIRS = {"Li": -17, "iq": -11, "qu": 5, "ui": 3, "id": -11, "iu": -2, "um": 20}
# Small optical width reductions, stronger in the lighter master. The already
# matched wordmark bowls, shoulders, stems, and descenders keep their shapes.
DENSITY_WIDTHS = {
    "A":(.965,.975), "B":(.98,.985), "C":(.96,.98), "D":(.95,.97),
    "E":(.99,1), "F":(.99,1), "G":(.975,.99), "K":(.97,.975),
    "M":(.985,1), "O":(.975,.99), "P":(.975,.985), "Q":(.975,.99),
    "R":(.99,1), "U":(.98,1), "V":(.975,.98), "W":(.975,.98),
    "X":(.975,.98), "Y":(.975,.98), "a":(.99,1), "c":(.97,.985),
    "e":(.97,.985), "k":(.975,.985), "o":(.98,1), "s":(.975,.99),
    "v":(.99,1), "w":(.98,1), "z":(.975,.99),
    "Æ":(.97,.985), "æ":(.975,.99), "Œ":(.975,.99), "œ":(.98,1), "Ꜳ":(.965,.975),
}

# Indices in the hash-pinned source. Fillets shorten only adjacent lines:
# existing curved shoulders and their stroke compensation are not redrawn.
CORNERS = {"L": [4], "b": [15, 18], "d": [2, 5], "p": [2, 5],
           "q": [15, 18], "k": [1], "t": [1], "m": [1], "n": [1],
           "r": [1], "u": [1], "a": [0], "g": [0], "l": [1], "h": [1]}


def round_corners(glyph, indices, radius):
    points, ends, flags = glyph.coordinates, glyph.endPtsOfContours, glyph.flags
    new_points, new_flags, new_ends = [], [], []
    first = 0
    for end in ends:
        for i in range(first, end + 1):
            if i not in indices:
                new_points.append(points[i]); new_flags.append(flags[i]); continue
            prev = end if i == first else i - 1
            nxt = first if i == end else i + 1
            assert all(flags[j] & 1 for j in (prev, i, nxt)), (i, "corner must adjoin lines")
            p, a, b = points[i], points[prev], points[nxt]
            def toward(q):
                dx, dy = q[0]-p[0], q[1]-p[1]
                length = math.hypot(dx, dy)
                amount = min(radius, length * .45) / length
                return (p[0]+dx*amount, p[1]+dy*amount)
            new_points.extend([toward(a), p, toward(b)])
            new_flags.extend([1, 0, 1])
        new_ends.append(len(new_points)-1)
        first = end+1
    glyph.coordinates = GlyphCoordinates(new_points)
    glyph.flags = type(flags)(new_flags)
    glyph.endPtsOfContours = new_ends
    glyph.removeHinting()


def customize(font, italic=False, weight=400):
    cmap, glyf = font.getBestCmap(), font["glyf"]
    corners = {**CORNERS, **({"q": [16, 19]} if italic else {})}
    stem = glyf[cmap[ord("i")]].coordinates[1][0] - glyf[cmap[ord("i")]].coordinates[0][0]
    period = glyf[cmap[ord(".")]]
    dot_width = period.xMax - period.xMin if weight <= 300 else max(80, stem * 1.095)
    dot_height = period.yMax - period.yMin if weight <= 300 else dot_width
    targets = {c: [tuple(glyf[cmap[ord(c)]].coordinates[i]) for i in indices]
               for c, indices in corners.items()}
    ascenders = {c: max(y for x,y in glyf[cmap[ord(c)]].coordinates) for c in "bdhkl"}
    widths = {c:(min(x for x,y in glyf[cmap[ord(c)]].coordinates),
                 max(x for x,y in glyf[cmap[ord(c)]].coordinates)-min(x for x,y in glyf[cmap[ord(c)]].coordinates)) for c in WIDTH_SCALE}
    original_y = list(glyf[cmap[ord("y")]].coordinates)
    changed, processed = set(), set()
    for cp, name in cmap.items():
        if name in processed: continue
        processed.add(name)
        char = chr(cp); base = {"ı":"i", "ł":"l", "đ":"d", "ħ":"h"}.get(char,unicodedata.normalize("NFD", char)[0])
        if base not in CORNERS and base not in "abcdefghijklmnopqrstuvwxyz" and char != "Q" and not (weight <= 300 and char == "ﬁ"): continue
        glyph = glyf[name]
        if glyph.isComposite(): continue  # references automatically inherit edits
        if base == "y":
            # Keep the original diagonals; replace only the straight descender
            # with a quiet returning tail. Accented y uses the same contour.
            points, flags, ends = [], [], []
            first = 0
            for end in glyph.endPtsOfContours:
                contour = list(glyph.coordinates[first:end+1])
                if len(contour)==8 and all(math.dist(a,b)<.01 for a,b in zip(contour,original_y)):
                    p=contour
                    outer_x=p[1][0]+(p[2][0]-p[1][0])*530/700
                    inner_x=p[3][0]+(p[4][0]-p[3][0])*170/(p[4][1]+200)
                    tail=[p[0],p[1],(outer_x,-30),(outer_x-65,-226),(76,-192),
                          (76,-192+stem*.94),(inner_x-45,-182+stem*.94),(inner_x,-30),*p[4:]]
                    points.extend(tail); flags.extend([1,1,1,0,1,1,0,1,1,1,1,1])
                else:
                    points.extend(contour); flags.extend(glyph.flags[first:end+1])
                ends.append(len(points)-1); first=end+1
            glyph.coordinates=GlyphCoordinates(points); glyph.flags=type(glyph.flags)(flags); glyph.endPtsOfContours=ends
        if char == "Q":
            # Anchor the diagonal inside the lower-right counter, not below
            # the bowl. Retain Albert's stroke width and the 45-degree angle.
            first_contour=list(glyph.coordinates[:4])
            cx=sum(x for x,y in first_contour)/4; cy=sum(y for x,y in first_contour)/4
            diagonal=[((x-cx-y+cy)/math.sqrt(2)+565,(x-cx+y-cy)/math.sqrt(2)) for x,y in first_contour]
            bottom=min(y for x,y in diagonal)
            for i,(x,y) in enumerate(diagonal):
                glyph.coordinates[i]=(x,y-bottom-18)
        # Albert ships many accents as flattened outlines; locate the same
        # corner there instead of leaving the unaccented glyph inconsistent.
        indices = []
        for point in targets.get(base, []):
            for i, value in enumerate(glyph.coordinates):
                if math.dist(point, value) < .01 and glyph.flags[i] & 1:
                    first = 0
                    for end in glyph.endPtsOfContours:
                        if i <= end: break
                        first = end+1
                    prev, nxt = (end if i == first else i-1), (first if i == end else i+1)
                    if glyph.flags[prev]&1 and glyph.flags[nxt]&1: indices.append(i)
        if char in corners: assert len(indices) == len(corners[char]), char
        if indices: round_corners(glyph, indices, stem*.40)
        if base in "bdhkl":
            # Only contours reaching the body, not a floating diacritic.
            first = 0
            for end in glyph.endPtsOfContours:
                ys = [glyph.coordinates[i][1] for i in range(first, end+1)]
                if min(ys) <= 500 and max(ys) <= ascenders[base]+.01:
                    for i in range(first, end+1):
                        x, y = glyph.coordinates[i]
                        if y > 500: glyph.coordinates[i] = (x, 500+(y-500)*200/(ascenders[base]-500))
                first = end+1
        if base in "abcdefghijklmnopqrsuvwxyz":
            # Shared body/descender proportions keep b/d/p/q and their accents
            # related. Floating accents and i/j dots are handled separately.
            first = 0
            for end in glyph.endPtsOfContours:
                if min(y for x,y in glyph.coordinates[first:end+1]) <= 500:
                    for i in range(first,end+1):
                        x,y=glyph.coordinates[i]
                        if y < 0: y *= .89
                        elif y <= 500: y *= X_HEIGHT/500
                        else: y = X_HEIGHT+(y-500)*(700-X_HEIGHT)/200
                        glyph.coordinates[i]=(x,y)
                first=end+1
        if char in "ijį" or (weight <= 300 and char == "ﬁ"):
            first = 0
            for end in glyph.endPtsOfContours:
                ys = [glyph.coordinates[i][1] for i in range(first, end+1)]
                if min(ys) > 550:
                    xs = [glyph.coordinates[i][0] for i in range(first,end+1)]
                    cx,cy=(min(xs)+max(xs))/2,(min(ys)+max(ys))/2
                    # Light dots follow the period instead of an 80-unit floor.
                    # Keep each dot's existing center and leave stems untouched.
                    center_y = cy if char == "ﬁ" else 644.5
                    for i in range(first, end+1):
                        x,y=glyph.coordinates[i]
                        glyph.coordinates[i]=(cx+(x-cx)*dot_width/(max(xs)-min(xs)),center_y+(y-cy)*dot_height/(max(ys)-min(ys)))
                first=end+1
        factor=WIDTH_SCALE.get(base,1)
        if factor != 1:
            # Maintain the existing sidebearings; only the requested letter's
            # ink width and corresponding advance change, not global tracking.
            left,width=widths[base]
            for i,(x,y) in enumerate(glyph.coordinates):
                glyph.coordinates[i]=(left+(x-left)*factor,y)
            advance,lsb=font["hmtx"][name]
            font["hmtx"][name]=(round(advance+width*(factor-1)),lsb)
        if base in "abdpqg":
            # Related bowls share the same counter expansion. Keep
            # outer contours and vertical stroke contrast unchanged.
            first=glyph.endPtsOfContours[-2]+1
            xs=[x for x,y in glyph.coordinates[first:]]
            center=(min(xs)+max(xs))/2
            factor=(max(xs)-min(xs)+stem*.205)/(max(xs)-min(xs))
            for i in range(first,len(glyph.coordinates)):
                x,y=glyph.coordinates[i];glyph.coordinates[i]=(center+(x-center)*factor,y)
        if base == "g":
            # A returning, flat-ended hook, constructed around Albert's own
            # stem. Keep its bowl and counter intact, including on accents.
            points, flags, ends = [], [], []; first=0
            for end in glyph.endPtsOfContours:
                p=list(glyph.coordinates[first:end+1]); f=list(glyph.flags[first:end+1])
                if len(p)==30 and p[3][1]==X_HEIGHT:
                    right,inner=p[4][0],p[12][0]
                    left=65; center=(left+right)/2; bottom=-194
                    inner_bottom=bottom+stem*.94
                    def quarter(a,b,corner):
                        k=math.sqrt(2)-1; h=1-math.sqrt(.5)
                        return [tuple(a[i]+k*(corner[i]-a[i]) for i in (0,1)),
                                tuple(h*(a[i]+b[i])+k*corner[i] for i in (0,1)),
                                tuple(b[i]+k*(corner[i]-b[i]) for i in (0,1)),b]
                    tail=[p[4],(right,-4),
                          *quarter((right,-4),(center,bottom),(right,bottom)),
                          *quarter((center,bottom),(left,-42),(left,bottom)),
                          (left+stem,-42),
                          *quarter((left+stem,-42),(center,inner_bottom),(left+stem,inner_bottom)),
                          *quarter((center,inner_bottom),(inner,-4),(inner,inner_bottom)),p[12]]
                    p=p[:4]+tail+p[13:]
                    f=f[:4]+[1,1]+[0,1,0,1]*2+[1]+[0,1,0,1]*2+[1]+f[13:]
                points.extend(p);flags.extend(f);ends.append(len(points)-1);first=end+1
            glyph.coordinates=GlyphCoordinates(points);glyph.flags=type(glyph.flags)(flags);glyph.endPtsOfContours=ends
        glyph.removeHinting(); glyph.recalcBounds(glyf)
        font["hmtx"][name]=(font["hmtx"][name][0],glyph.xMin)
        changed.add(name)
    # A period's optical overshoot should not read as a dropped dot next to k.
    glyph = glyf[cmap[ord(".")]]
    shift = -glyph.yMin
    for i,(x,y) in enumerate(glyph.coordinates): glyph.coordinates[i]=(x,y+shift)
    glyph.removeHinting(); glyph.recalcBounds(glyf); changed.add(cmap[ord(".")])
    return sorted(changed)


def add_pair_corrections(font, pairs):
    """Append additive pair adjustments without replacing Albert's GPOS."""
    if not pairs: return
    from fontTools.otlLib.builder import buildLookup, buildPairPosGlyphsSubtable
    from fontTools.ttLib.tables import otTables
    cmap = font.getBestCmap(); values = {}
    for pair, amount in pairs.items():
        if amount == 0: continue
        value = otTables.ValueRecord(); value.XAdvance = int(amount)
        values[(cmap[ord(pair[0])], cmap[ord(pair[1])])] = (value, None)
    if not values: return
    table = font["GPOS"].table
    lookup = buildLookup([buildPairPosGlyphsSubtable(values, font.getReverseGlyphMap())])
    index = len(table.LookupList.Lookup)
    table.LookupList.Lookup.append(lookup); table.LookupList.LookupCount += 1
    for record in table.FeatureList.FeatureRecord:
        if record.FeatureTag == "kern":
            record.Feature.LookupListIndex.append(index)
            record.Feature.LookupCount += 1


def densify(font, weight):
    """Refine outlines and sidebearings in the font, never via CSS squeezing."""
    from fontTools.pens.recordingPen import DecomposingRecordingPen, replayRecording
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    cmap=font.getBestCmap(); glyf=font["glyf"]
    # Expand composites together before editing, so accents inherit exactly
    # the same width change instead of applying it twice through a reference.
    expanded={}; metrics=dict(font["hmtx"].metrics); glyph_set=font.getGlyphSet()
    for cp,name in cmap.items():
        base=unicodedata.normalize("NFD",chr(cp))[0]
        if not unicodedata.category(chr(cp)).startswith("L") or not glyf[name].isComposite(): continue
        pen=DecomposingRecordingPen(glyph_set); glyph_set[name].draw(pen)
        output=TTGlyphPen(None); replayRecording(pen.value,output); expanded[name]=output.glyph()
        if base!=chr(cp) and ord(base) in cmap:
            font["hmtx"][name]=(metrics[cmap[ord(base)]][0],metrics[name][1])
    for name,glyph in expanded.items(): glyf[name]=glyph
    processed=set()
    for cp,name in cmap.items():
        if name in processed or not unicodedata.category(chr(cp)).startswith("L"): continue
        processed.add(name); base=unicodedata.normalize("NFD",chr(cp))[0]
        glyph=glyf[name]; glyph.recalcBounds(glyf)
        low,high=DENSITY_WIDTHS.get(base,(1,1)); factor=low+(high-low)*max(0,min(1,(weight-400)/300))
        left=glyph.xMin; width=glyph.xMax-left
        trim=14 if base in "ij" else 6
        if factor!=1:
            for i,(x,y) in enumerate(glyph.coordinates): glyph.coordinates[i]=(left+(x-left)*factor,y)
            glyph.removeHinting();glyph.recalcBounds(glyf)
        advance,_=font["hmtx"][name]
        font["hmtx"][name]=(round(advance+width*(factor-1)-trim),glyph.xMin)
    return processed


def bake_tracking(font):
    """Make the approved -0.025em rhythm native, without changing outlines/kern.

    Standard ligatures represent multiple letters and receive the corresponding
    advance reduction. Fractions and composed/accented characters remain single
    glyphs. Zero-width marks/control glyphs are never given a negative advance.
    """
    counts = {}
    gsub = font["GSUB"].table
    for feature in gsub.FeatureList.FeatureRecord:
        if feature.FeatureTag != "liga": continue
        for index in feature.Feature.LookupListIndex:
            lookup = gsub.LookupList.Lookup[index]
            for sub in lookup.SubTable:
                if lookup.LookupType != 4: continue
                for ligatures in sub.ligatures.values():
                    for ligature in ligatures:
                        counts[ligature.LigGlyph] = len(ligature.Component) + 1
    delta = round(font["head"].unitsPerEm * DEFAULT_TRACKING_EM)
    for name, (advance, lsb) in list(font["hmtx"].metrics.items()):
        if advance == 0: continue
        advance += delta * counts.get(name, 1)
        assert advance > 0, (name, "tracking erased advance")
        font["hmtx"][name] = (advance, lsb)


def shear_font(font, slope):
    """Temporarily deskew the actual italic for shared, upright-coordinate edits.

    Work about the middle of the original x-height, then restore the slant.
    All native italic contours/optical corrections remain the foundation.
    """
    from fontTools.pens.recordingPen import DecomposingRecordingPen, replayRecording
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    glyf = font["glyf"]; glyph_set = font.getGlyphSet(); expanded = {}
    for name in font.getGlyphOrder():
        if glyf[name].isComposite():
            recording = DecomposingRecordingPen(glyph_set); glyph_set[name].draw(recording)
            pen = TTGlyphPen(None); replayRecording(recording.value, pen)
            expanded[name] = pen.glyph()
    for name, glyph in expanded.items(): glyf[name] = glyph
    for name in font.getGlyphOrder():
        glyph = glyf[name]
        if not glyph.numberOfContours: continue
        for i, (x, y) in enumerate(glyph.coordinates):
            # Equivalent shear operations can land a few floating-point bits
            # either side of a half-unit on different libm implementations.
            # Normalize that noise before TrueType's integer rounding.
            glyph.coordinates[i] = (round(x + slope * (y - 250), 8), round(y, 8))
        glyph.removeHinting(); glyph.recalcBounds(glyf)
        font["hmtx"][name] = (font["hmtx"][name][0], glyph.xMin)


def add_tabular_numbers(font):
    """Opt-in equal-width figures for balances, prices, counters, and tables."""
    from fontTools.otlLib.builder import buildLookup, buildSingleSubstSubtable
    from fontTools.ttLib.tables import otTables
    cmap = font.getBestCmap(); mapping = {}; glyf = font["glyf"]
    width = math.ceil(max(font["hmtx"][cmap[ord(c)]][0] for c in "0123456789") / 50) * 50
    order = list(font.getGlyphOrder())
    for c in "0123456789":
        name = cmap[ord(c)]; target = name + ".tnum"; mapping[name] = target
        glyph = copy.deepcopy(glyf[name]); advance, lsb = font["hmtx"][name]
        dx = round((width - advance) / 2)
        for i, (x, y) in enumerate(glyph.coordinates): glyph.coordinates[i] = (x + dx, y)
        glyph.recalcBounds(glyf); glyph.removeHinting(); glyf[target] = glyph
        font["hmtx"][target] = (width, glyph.xMin); order.append(target)
        font["GDEF"].table.GlyphClassDef.classDefs[target] = 1
    font.setGlyphOrder(order)
    table = font["GSUB"].table; index = len(table.LookupList.Lookup)
    table.LookupList.Lookup.append(buildLookup([buildSingleSubstSubtable(mapping)]))
    table.LookupList.LookupCount += 1
    record = otTables.FeatureRecord(); record.FeatureTag = "tnum"
    record.Feature = otTables.Feature(); record.Feature.FeatureParams = None
    record.Feature.LookupListIndex = [index]; record.Feature.LookupCount = 1
    feature_index = len(table.FeatureList.FeatureRecord)
    table.FeatureList.FeatureRecord.append(record); table.FeatureList.FeatureCount += 1
    for script in table.ScriptList.ScriptRecord:
        languages = [script.Script.DefaultLangSys] + [r.LangSys for r in script.Script.LangSysRecord]
        for language in languages:
            if language is not None:
                language.FeatureIndex.append(feature_index); language.FeatureCount += 1


def build(weight, style, source_weight, italic=False):
    font = instantiateVariableFont(TTFont(ITALIC_SOURCE if italic else SOURCE), {"wght": source_weight}, inplace=True)
    slope = math.tan(math.radians(-font["post"].italicAngle)) if italic else 0
    if italic: shear_font(font, -slope)
    changed = customize(font, italic, weight)
    changed=sorted(set(changed)|densify(font,weight))
    if italic: shear_font(font, slope)
    spacing = ROOT / "scripts/satoma_spacing.json"
    key = f"{weight}-italic" if italic else str(weight)
    adjustments = json.loads(spacing.read_text()).get(key, {}) if spacing.exists() else {}
    for pair,amount in BRAND_PAIRS.items():
        adjustments[pair]=adjustments.get(pair,0)+amount
    add_pair_corrections(font, adjustments)
    bake_tracking(font)
    add_tabular_numbers(font)
    names = font["name"]
    base_style = style
    style = ("Italic" if weight == 400 else style + " Italic") if italic else style
    # Legacy RIBBI style linking plus one modern typographic family.
    legacy_family = "Satoma Sans" if weight in (400,700) else "Satoma Sans " + base_style
    legacy_style = ("Bold Italic" if italic else "Bold") if weight == 700 else ("Italic" if italic else "Regular")
    copyright_text = names.getDebugName(0) + "\nCopyright 2026 Robin Obermaier. Satoma Sans modifications."
    replacements = {0: copyright_text, 1: legacy_family, 2: legacy_style,
        3: f"Satoma Sans {VERSION} {style}", 4: f"Satoma Sans {style}",
        5: f"Version {VERSION}", 6: f"SatomaSans-{style.replace(' ', '')}",
        10: "Satoma Sans, a modified version of Albert Sans. Asymmetric corners and adjusted ascender/dot alignment. SIL OFL 1.1.",
        8: "Satoma Sans Project", 9: "Albert Sans Project Authors; Satoma modifications by Robin Obermaier",
        11: "https://satoma.robin.build", 12: "https://robin.build",
        13: (REPO / "OFL.txt").read_text(), 14: "https://openfontlicense.org",
        16: "Satoma Sans", 17: style}
    names.names = [n for n in names.names if n.nameID not in replacements and n.nameID not in (18, 21, 22, 25)]
    for name_id, text in replacements.items(): names.setName(text, name_id, 3, 1, 0x409)
    font["OS/2"].usWeightClass = weight
    font["OS/2"].sxHeight = X_HEIGHT
    font["OS/2"].fsSelection &= ~((1 << 0) | (1 << 5) | (1 << 6))
    if not italic and weight != 700: font["OS/2"].fsSelection |= 1 << 6
    if italic: font["OS/2"].fsSelection |= 1 << 0
    if weight == 700: font["OS/2"].fsSelection |= 1 << 5
    font["head"].macStyle = (1 if weight == 700 else 0) | (2 if italic else 0)
    font["hhea"].caretSlopeRise = 1000
    font["hhea"].caretSlopeRun = round(slope * 1000)
    font["head"].fontRevision = float(VERSION)
    font["head"].created = font["head"].modified = 3871584000
    font.recalcTimestamp = False
    # STAT describes the original variable-axis positions, not these styles.
    if "STAT" in font: del font["STAT"]
    suffix = "-italic" if italic else ""
    font.save(OUT/f"satoma-sans-{weight}{suffix}.ttf")
    font.flavor = "woff2"; font.save(OUT/f"satoma-sans-{weight}{suffix}.woff2")
    return {"weight": weight, "style": style, "sourceWeight": source_weight,
        "italic": italic, "fileStem": f"satoma-sans-{weight}{suffix}",
        "characters": len(font.getBestCmap()), "glyphs": len(font.getGlyphOrder()),
        "codepoints": sorted(font.getBestCmap()), "modifiedGlyphs": changed}


def main():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA, "Unexpected Albert source"
    assert hashlib.sha256(ITALIC_SOURCE.read_bytes()).hexdigest() == ITALIC_SOURCE_SHA, "Unexpected Albert italic source"
    OUT.mkdir(parents=True, exist_ok=True)
    styles = [build(weight, *parameters, italic=italic) for italic in (False, True) for weight, parameters in WEIGHTS.items()]
    codepoints = styles[0]["codepoints"]
    assert all(style["codepoints"] == codepoints for style in styles)
    styles = [{k: v for k, v in style.items() if k not in ("codepoints", "modifiedGlyphs")} for style in styles]
    weights = [style for style in styles if not style["italic"]]
    manifest = {"family": "Satoma Sans", "version": VERSION, "foundation": "Albert Sans",
        "license": "SIL Open Font License 1.1", "upstreamCommit": UPSTREAM_COMMIT,
        "sourceSha256": SOURCE_SHA, "italicSourceSha256": ITALIC_SOURCE_SHA,
        "nativeTrackingAdjustmentEm": DEFAULT_TRACKING_EM, "codepoints": codepoints, "weights": weights, "styles": styles}
    (OUT/"satoma-sans-manifest.json").write_text(json.dumps(manifest, indent=2)+"\n")
    (OUT/"satoma-sans-OFL.txt").write_bytes((REPO/"OFL.txt").read_bytes())
    (OUT/"satoma-sans.css").write_text("\n".join(
        '@font-face {\n  font-family: "Satoma Sans";\n'
        f'  src: url("./{style["fileStem"]}.woff2?v={VERSION}") format("woff2");\n'
        f'  font-weight: {style["weight"]};\n  font-style: {"italic" if style["italic"] else "normal"};\n  font-display: swap;\n}}\n'
        for style in styles
    ))
    for name in ("WEBAPP-USAGE.md", "SATOMA-PROVENANCE.md"):
        (OUT/name).write_bytes((REPO/"docs"/name).read_bytes())
    (OUT/"AUTHORS.md").write_bytes((REPO/"AUTHORS.md").read_bytes())
    (OUT/"OFL.txt").write_bytes((REPO/"OFL.txt").read_bytes())
    with zipfile.ZipFile(OUT/"satoma-sans-family.zip", "w", zipfile.ZIP_DEFLATED) as archive:
        # Fixed timestamps and ordering make release archives reproducible.
        files = [(path, path.name) for path in sorted(OUT.iterdir()) if path.suffix != ".zip" and path.name != "SHA256SUMS.txt"]
        for folder in (ROOT/"scripts", ROOT/"sources"):
            files.extend((path, path.relative_to(REPO).as_posix()) for path in sorted(folder.rglob("*")) if path.is_file() and "__pycache__" not in path.parts)
        files.extend((REPO/file, file) for file in ("README.md", "CHANGELOG.md", "font/requirements.txt", "docs/DEVELOPMENT.md", "docs/WEBAPP-USAGE.md", "docs/SATOMA-PROVENANCE.md"))
        for path, name in files:
            info = zipfile.ZipInfo(name, (2026, 9, 9, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_bytes())
    print(json.dumps({"version": VERSION, "weights": [{k:v for k,v in w.items() if k not in ("codepoints", "modifiedGlyphs")} for w in weights]}, indent=2))


if __name__ == "__main__": main()
