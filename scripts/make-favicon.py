#!/usr/bin/env python3
"""make_favicon.py CODE [out.svg] -- a WORDMARK app favicon: Mark's WM over two WM Mono letters.

Four letters in a 2x2 grid on a 1485 square, the construction font-proofer's and ReCal's
Illustrator exports use. The top row is Mark's own redrawn WM, taken verbatim from
font-proofer's icon (wm-top.txt) -- never regenerated from the font. The bottom row is
the app's two letters from WM Mono. Never stretched: one uniform scale for every letter, cap height
to the cell height (714 of 1485), so each keeps the width the font gave it and round
letters keep their overshoot. The left column sits flush on the square's left edge and
the right column flush on its right, so the block is the square and the gutter is
whatever the pair leaves. Black; white under prefers-color-scheme: dark, the same
<style> the existing icons carry."""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

FONT = os.environ.get('WM_MONO', '/Users/Mark/Dropbox (Personal)/_WS Mono/WMMono-Regular.otf')   # the font is Mark's and not in this repo
SIZE, CELL_W, CELL_H, CAP = 1485, 704, 714, 700
CELLS = [(0, 0), (SIZE - CELL_W, 0), (0, SIZE - CELL_H), (SIZE - CELL_W, SIZE - CELL_H)]

import os
WM_TOP = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wm-top.txt')).read().split('\n')

def build(code):
    code = code.upper()
    if len(code) == 4:
        assert code[:2] == 'WM', 'the top row is always the drawn WM'
        code = code[2:]
    assert len(code) == 2, 'two letters under the WM'
    f = TTFont(FONT); gs = f.getGlyphSet(); cmap = f.getBestCmap()
    paths = [f'  <polygon points="{pts}"/>' for pts in WM_TOP]
    for ch, (cx, cy) in zip(code, CELLS[2:]):
        g = cmap[ord(ch)]
        bp = BoundsPen(gs); gs[g].draw(bp); x0, _, x1, _ = bp.bounds
        k = CELL_H / CAP                                   # one scale, both axes
        left = cx == 0
        tx = -x0 * k if left else SIZE - x1 * k            # flush to the square's edge
        pen = SVGPathPen(gs)
        # font units are y-up from the baseline; the cell is y-down from its top
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, tx, cy + CAP * k)))
        paths.append(f'  <path d="{pen.getCommands()}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">\n'
            '  <style>\n    path, polygon { fill: #000; }\n    @media (prefers-color-scheme: dark) { path, polygon { fill: #fff; } }\n  </style>\n'
            + '\n'.join(paths) + '\n</svg>\n')

if __name__ == '__main__':
    code = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else f'{code.lower()}.svg'
    open(out, 'w').write(build(code)); print(out)
