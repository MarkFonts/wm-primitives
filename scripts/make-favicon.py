#!/usr/bin/env python3
"""make-favicon.py CODE [--ssNN ...] [--alt X=glyph ...] [--fill] [--colorway=ink|light|dark] [out.svg]
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

def build(code, sets=(), pick=None, fill=False, colorway='ink'):
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
    # A round or pointed letter reaches below the baseline (G.ss02 by 36 units), and the
    # bottom row's baseline IS the square's edge, so it would be cut. The row lifts by the
    # deepest letter's overshoot -- both letters together, so their baselines still agree.
    k = CELL_H / CAP
    def glyph_for(ch):
        return None if (ch in DRAWN and ch not in pick and not sets) else (pick.get(ch) or sub.get(cmap[ord(ch)], cmap[ord(ch)]))
    lows = []
    for ch in code:
        g = glyph_for(ch)
        if g: bp = BoundsPen(gs); gs[g].draw(bp); lows.append(bp.bounds[1])
    lift = max(0, -min(lows, default=0)) * k
    for ch, cell in zip(code, CELLS[2:]):
        if ch in DRAWN and ch not in pick and not sets:
            shapes.append(moved(ch, cell)); continue
        g = pick.get(ch) or sub.get(cmap[ord(ch)], cmap[ord(ch)])
        bp = BoundsPen(gs); gs[g].draw(bp); x0, _, x1, _ = bp.bounds
        k = CELL_H / CAP                                   # one scale, both axes
        # fill=True widens the ink to the cell, as the drawn WM fills it: for letters that
        # sit beside or under the WM and would otherwise read narrower (WORDMAKE's W M).
        kx = CELL_W / (x1 - x0) if fill else k
        cx, cy = cell
        tx = -x0 * kx if cx == 0 else SIZE - x1 * kx       # flush to the square's edge
        pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (kx, 0, 0, -k, tx, cy + CAP * k - lift)))
        shapes.append(f'  <path d="{pen.getCommands()}"/>')
    # ink: black, white under a dark scheme -- the one a page links. light / dark: fixed,
    # for a surface whose colour is known (a dock, a README, a slide).
    style = {'ink': '    path, polygon { fill: #000; }\n    @media (prefers-color-scheme: dark) { path, polygon { fill: #fff; } }\n',
             'light': '    path, polygon { fill: #000; }\n',
             'dark': '    path, polygon { fill: #fff; }\n'}[colorway]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">\n'
            '  <style>\n' + style + '  </style>\n'
            + '\n'.join(shapes) + '\n</svg>\n')

def specimen(tag='ss01', per_letter=None, out=None):
    """The 26 capitals for the system page (docs/favicons/<tag>-uppercase.json): each in `tag`
    where the font has it, in the set `per_letter` names for that letter (M and W come from
    ss06, the drawn WM), and the default otherwise. Font units, y flipped, baseline 0, cap
    -700. The page cannot read the font -- it is Mark's and not in this repo -- so it draws these."""
    import json
    per_letter = {'M': 'ss06', 'W': 'ss06'} if per_letter is None else per_letter
    f = TTFont(FONT); gs = f.getGlyphSet(); cmap = f.getBestCmap(); maps = {}
    for fr in f['GSUB'].table.FeatureList.FeatureRecord:
        if not fr.FeatureTag.startswith('ss'): continue
        for li in fr.Feature.LookupListIndex:
            for st in f['GSUB'].table.LookupList.Lookup[li].SubTable:
                maps.setdefault(fr.FeatureTag, {}).update(getattr(getattr(st, 'ExtSubTable', st), 'mapping', {}) or {})
    glyphs = []
    for ch in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
        base = cmap[ord(ch)]; want = per_letter.get(ch, tag)
        g = maps.get(want, {}).get(base)
        used = want if g else None
        g = g or base
        pen = SVGPathPen(gs); gs[g].draw(TransformPen(pen, (1, 0, 0, -1, 0, 0)))
        glyphs.append({'char': ch, 'glyph': g, 'set': used, 'advance': gs[g].width, 'd': pen.getCommands()})
    data = {'_': f'WM Mono capitals: {tag} where the font has it, ' + ', '.join(f'{k} from {v}' for k, v in per_letter.items())
                 + ', the default otherwise. Outlines in font units, y flipped (baseline 0, cap -700). Exported by '
                 "scripts/make-favicon.py --specimen from Mark's font, which is not in this repo; build.py draws it in the page ink.",
            'font': os.path.basename(FONT), 'upm': f['head'].unitsPerEm, 'cap': CAP, 'glyphs': glyphs}
    out = out or os.path.join(HERE, '..', 'docs', 'favicons', f'{tag}-uppercase.json')
    json.dump(data, open(out, 'w'), separators=(',', ':')); return out

if __name__ == '__main__':
    if '--specimen' in sys.argv:
        tag = next((a[2:] for a in sys.argv[1:] if a.startswith('--ss')), 'ss01')
        print(specimen(tag)); sys.exit()
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    sets = [a[2:] for a in sys.argv[1:] if a.startswith('--ss')]
    pick = dict(a[6:].split('=', 1) for a in sys.argv[1:] if a.startswith('--alt='))
    fill = '--fill' in sys.argv
    colorway = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--colorway=')), 'ink')
    code = args[0]
    out = args[1] if len(args) > 1 else f'{code.lower()}.svg'
    open(out, 'w').write(build(code, sets, pick, fill, colorway)); print(out)
