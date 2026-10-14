"""Export the shipped Satoma S outline for the 3D specimen. Never edit the font."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
root=Path(__file__).resolve().parents[1]
font=TTFont(root/'public/fonts/satoma-sans-700.ttf')
glyphs=font.getGlyphSet();pen=SVGPathPen(glyphs);glyphs['S'].draw(pen)
path=pen.getCommands()
(root/'public/satoma-s.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 750"><path fill="#fff" transform="translate(0,710) scale(1,-1)" d="{path}"/></svg>\n')
# Favicon: the hero in miniature. White light enters from the upper right,
# passes behind the glass S and leaves as a spectrum toward the lower left.
# Shapes stay bold so the idea survives at 16 px.
spectrum=['#8b5cf6','#3b82f6','#06b6d4','#22c55e','#facc15','#fb923c','#ef4444']
apex=(330,470)
edge=[430+i*62 for i in range(len(spectrum)+1)]
fan=''.join(f'<path fill="{c}" d="M{apex[0]} {apex[1]}L-40 {edge[i]}L-40 {edge[i+1]}Z"/>' for i,c in enumerate(spectrum))
favicon=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
<defs>
<clipPath id="tile"><rect width="800" height="800" rx="176"/></clipPath>
<linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e4e8ef"/><stop offset="1" stop-color="#aeb6c4"/></linearGradient>
<radialGradient id="glow" cx="580" cy="312" r="160" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<g clip-path="url(#tile)">
<rect width="800" height="800" fill="#000"/>
{fan}
<path fill="#fff" d="M840 96L840 184L470 384L456 350Z"/>
<circle cx="580" cy="312" r="160" fill="url(#glow)"/>
<path fill="url(#glass)" stroke="#000" stroke-width="22" paint-order="stroke" transform="translate(163,680) scale(.8,-.8)" d="{path}"/>
</g>
</svg>
'''
(root/'public/favicon.svg').write_text(favicon)
