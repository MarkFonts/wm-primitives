#!/usr/bin/env python3
"""cut-icon-subset -- the shipped Material Symbols face, from the full one, by name.

    python3 scripts/cut-icon-subset.py [name ...]

fonts/MaterialSymbolsOutlined.woff2 is a subset: the ligatures the apps draw, nothing
else (lint-icons.py holds every consumer to it). Growing it is not `pyftsubset --text`:
the face keeps its icons under `rlig`, and a cut that keeps rlig keeps EVERY icon
spellable from the letters in the names you asked for -- 3,954 of them, 3MB, the first
time it was tried (2026-09-25). So this prunes first: it walks the full face's ligature
subtables, keeps only the entries that spell a wanted name, then cuts with the wanted
names' letters and the surviving ligature glyphs. 25 names, 54 glyphs, 16KB.

The wanted set is what the shipped face already holds plus every name on the command
line. Writes fonts/ and the synced copy in docs/fonts/ (build.py SYNCED_FACES; the faces
job in lint.yml holds them equal). Needs fonttools + brotli, like lint-icons.py."""
import os, subprocess, sys, tempfile
from fontTools.ttLib import TTFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location('li', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lint-icons.py'))
li = importlib.util.module_from_spec(spec); spec.loader.exec_module(li)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FULL = os.path.join(ROOT, 'docs', 'fonts', 'MaterialSymbolsOutlined-full.woff2')
OUT = [os.path.join(ROOT, 'fonts', 'MaterialSymbolsOutlined.woff2'), os.path.join(ROOT, 'docs', 'fonts', 'MaterialSymbolsOutlined.woff2')]

want = li.shipped_names() | set(sys.argv[1:])
full = TTFont(FULL)
cmap = full.getBestCmap(); g2c = {g: chr(c) for c, g in cmap.items()}
kept = set()
for lu in full['GSUB'].table.LookupList.Lookup:
    for st in lu.SubTable:
        st = getattr(st, 'ExtSubTable', st)
        ligs = getattr(st, 'ligatures', None)
        if not ligs: continue
        for first in list(ligs):
            keep = []
            for l in ligs[first]:
                try: name = ''.join(g2c[x] for x in [first] + list(l.Component))
                except KeyError: name = None
                if name in want: keep.append(l); kept.add(l.LigGlyph)
            if keep: ligs[first] = keep
            else: del ligs[first]
with tempfile.TemporaryDirectory() as d:
    pruned = os.path.join(d, 'pruned.ttf'); full.flavor = None; full.save(pruned)
    out = os.path.join(d, 'subset.woff2')
    letters = ''.join(sorted({ch for n in want for ch in n}))
    subprocess.run(['pyftsubset', pruned, '--text=' + letters, '--glyphs=' + ','.join(sorted(kept)),
                    '--layout-features=rlig', '--flavor=woff2', '--output-file=' + out], check=True)
    have = li.shipped_names(out)
    gone = sorted(want - have)
    if gone: sys.exit(f'cut-icon-subset: the full face does not spell {", ".join(gone)}')
    for p in OUT:
        with open(out, 'rb') as src, open(p, 'wb') as dst: dst.write(src.read())
    print(f'{len(have)} ligatures, {len(TTFont(out).getGlyphOrder())} glyphs, {os.path.getsize(out)} bytes -> fonts/ and docs/fonts/')
