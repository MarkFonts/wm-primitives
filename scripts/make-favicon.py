#!/usr/bin/env python3
"""make-favicon.py CODE [--ssNN ...] [--alt X=glyph ...] [out.svg]
A WORDMARK app favicon: Mark's drawn WM over the app's two letters.

Four letters in a 2x2 grid on a 1485 square, the construction font-proofer's and ReCal's
Illustrator exports use. W and M are ALWAYS Mark's drawn glyphs, taken verbatim from
font-proofer's icon (wm-top.txt) and moved to whichever cell they occupy: they are
custom for the few pixels a favicon has, and the font's W and M are not (2026-09-26).
Every other letter comes from WM Mono at one uniform scale -- never stretched -- cap
height to the cell height, so each keeps its own width and round letters their
overshoot; left column flush on the square's left edge, right column on its right.
--ssNN picks the font's stylistic alternates for the bottom pair; --alt G=G.ss02 picks one
glyph directly. Black; white under prefers-color-scheme: dark."""
import os, sys, re
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.environ.get('WM_MONO', '/Users/Mark/Dropbox (Personal)/_WS Mono/WMMono-Regular.ttf')   # Mark's font, not in this repo
SIZE, CELL_W, CELL_H, CAP = 1485, 704, 714, 700
CELLS = [(0, 0), (SIZE - CELL_W, 0), (0, SIZE - CELL_H), (SIZE - CELL_W, SIZE - CELL_H)]
DRAWN = dict(zip('WM', open(os.path.join(HERE, 'wm-top.txt')).read().split('\n')))   # W at cell 0, M at cell 1
DRAWN_AT = {'W': CELLS[0], 'M': CELLS[1]}

def moved(ch, cell):
    """The drawn polygon for ch, moved from its home cell to `cell`."""
    (hx, hy), (cx, cy) = DRAWN_AT[ch], cell
    if (hx, hy) == (cx, cy):                     # in its own cell: the drawing, byte for byte
        return f'  <polygon points="{DRAWN[ch]}"/>'
    nums = [float(n) for n in DRAWN[ch].split()]
    pts = [(nums[i] + cx - hx, nums[i + 1] + cy - hy) for i in range(0, len(nums), 2)]
    return f'  <polygon points="{" ".join(f"{x:.3f} {y:.3f}" for x, y in pts)}"/>'

def build(code, sets=(), pick=None):
    code = code.upper()
    if len(code) == 4:
        assert code[:2] == 'WM', 'the top row is always the drawn WM'
        code = code[2:]
    assert len(code) == 2, 'two letters under the WM'
    pick = pick or {}
    f = TTFont(FONT); gs = f.getGlyphSet(); cmap = f.getBestCmap()
    sub = {}
    for tag in sets:
        for fr in f['GSUB'].table.FeatureList.FeatureRecord:
            if fr.FeatureTag != tag: continue
            for li in fr.Feature.LookupListIndex:
                for st in f['GSUB'].table.LookupList.Lookup[li].SubTable:
                    sub.update(getattr(getattr(st, 'ExtSubTable', st), 'mapping', {}) or {})
    shapes = [moved('W', CELLS[0]), moved('M', CELLS[1])]
    for ch, cell in zip(code, CELLS[2:]):
        if ch in DRAWN and ch not in pick:
            shapes.append(moved(ch, cell)); continue
        g = pick.get(ch) or sub.get(cmap[ord(ch)], cmap[ord(ch)])
        bp = BoundsPen(gs); gs[g].draw(bp); x0, _, x1, _ = bp.bounds
        k = CELL_H / CAP                                   # one scale, both axes
        cx, cy = cell
        tx = -x0 * k if cx == 0 else SIZE - x1 * k         # flush to the square's edge
        pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, tx, cy + CAP * k)))
        shapes.append(f'  <path d="{pen.getCommands()}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">\n'
            '  <style>\n    path, polygon { fill: #000; }\n    @media (prefers-color-scheme: dark) { path, polygon { fill: #fff; } }\n  </style>\n'
            + '\n'.join(shapes) + '\n</svg>\n')

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    sets = [a[2:] for a in sys.argv[1:] if a.startswith('--ss')]
    pick = dict(a[6:].split('=', 1) for a in sys.argv[1:] if a.startswith('--alt='))
    code = args[0]
    out = args[1] if len(args) > 1 else f'{code.lower()}.svg'
    open(out, 'w').write(build(code, sets, pick)); print(out)
