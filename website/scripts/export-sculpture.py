"""Export the shipped Satoma S outline for the 3D specimen. Never edit the font."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
root=Path(__file__).resolve().parents[1]
font=TTFont(root/'public/fonts/satoma-sans-700.ttf')
glyphs=font.getGlyphSet();pen=SVGPathPen(glyphs);glyphs['S'].draw(pen)
path=pen.getCommands()
(root/'public/satoma-s.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 750"><path fill="#fff" transform="translate(0,710) scale(1,-1)" d="{path}"/></svg>\n')
(root/'public/favicon.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><rect width="800" height="800" rx="140" fill="#ff6936"/><path fill="#000" transform="translate(95,720) scale(.9,-.9)" d="{path}"/></svg>\n')
