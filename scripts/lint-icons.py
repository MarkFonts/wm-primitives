#!/usr/bin/env python3
"""lint-icons -- every icon name in the code is one the shipped face can draw.

fonts/MaterialSymbolsOutlined.woff2 is a SUBSET of Material Symbols (75 ligatures; scripts/cut-icon-subset.py grows it),
not the full face, whatever icon.css used to say. A name outside the subset does not print
as words: the ligature never forms and the browser draws whichever component glyphs happen
to be in the font -- `undo` came out as two strokes, `arrow_outward` as a circle -- and
both still looked like icons, which is why it went unnoticed until someone read a
screenshot closely (2026-09-20). Nothing else catches it: .tokenlint.json does not know
what a font contains. This does.

What it reads:
  - the font's GSUB ligatures, mapped back through the cmap to the names they spell
  - every `<Icon ... name="x">` in src/ (and in each consumer given by WM_CONSUMERS,
    name=dir pairs as gen-index.mjs takes them). A consumer that loads its own face
    rather than the subset names it in WM_CONSUMER_FACES (name=woff2 pairs) and is held
    to that file instead -- WORDMAKE ships the full face and draws `crop` and `blur_on`,
    which the subset never held and never needs to.
  - every snake_case string literal in a file that mentions `<Icon` -- the way
    ThemeSwitch keeps its three marks in a table -- so a name that reaches Icon through a
    variable is not invisible to this
  - `<... class="... material-symbols-outlined ...">name<` in HTML, the ligature written as text

A literal that is not an icon name can say so on its line:  icon-lint: allow -- reason
A name the face cannot draw fails the run and names its sites. The fix is one of two:
put the name into the subset (regenerate fonts/MaterialSymbolsOutlined.woff2 from the
full face with pyftsubset, --layout-features='liga' and the union of every name here) or
use a name that is in it. Either way, run this before trusting a screenshot.
"""
import os, re, sys
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, 'fonts', 'MaterialSymbolsOutlined.woff2')
# The system page draws from the full face (docs/fonts/…-full.woff2, see build.py FONTS),
# and its pages are held to THAT file, so a rename of it or a name outside even the full
# face fails here rather than as a stray letter on the published page.
DOCS_FONT = os.path.join(ROOT, 'docs', 'fonts', 'MaterialSymbolsOutlined-full.woff2')
DOCS_PAGES = os.path.join(ROOT, 'docs', 'system', 'pages')

def shipped_names(path=None):
    f = TTFont(path or FONT)
    cmap = f.getBestCmap()
    glyph_to_char = {g: chr(c) for c, g in cmap.items()}
    names = set()
    for lu in f['GSUB'].table.LookupList.Lookup:
        for st in lu.SubTable:
            st = getattr(st, 'ExtSubTable', st)
            for first, ligs in getattr(st, 'ligatures', {}).items():
                for l in ligs:
                    parts = [first] + list(l.Component)
                    try: names.add(''.join(glyph_to_char[g] for g in parts))
                    except KeyError: pass
    return names

ICON_TAG   = re.compile(r'<Icon\b[^>]*?\bname=\{?["\']([a-z][a-z0-9_]*)["\']')
LITERAL    = re.compile(r'["\']([a-z]+(?:_[a-z0-9]+)+)["\']')
HTML_LIGA  = re.compile(r'class="[^"]*material-symbols-outlined[^"]*"[^>]*>\s*([a-z][a-z0-9_]*)\s*<')
ALLOW      = re.compile(r'icon-lint:\s*allow\s*--\s*\S')
EXTS = ('.tsx', '.jsx', '.ts', '.js', '.html')

def walk(dir):
    if os.path.isfile(dir): yield dir; return
    for d, subdirs, files in os.walk(dir):
        subdirs[:] = [s for s in subdirs if s not in ('node_modules', 'dist', '.git', 'shared')]
        for fn in files:
            if fn.endswith(EXTS): yield os.path.join(d, fn)

def sites(dirs):
    out = []   # (name, where, sure)
    for label, dir in dirs:
        for path in walk(dir):
            try: text = open(path, encoding='utf-8', errors='replace').read()
            except OSError: continue
            rel = f'{label}:{os.path.relpath(path, dir)}'
            has_icon = '<Icon' in text or 'material-symbols-outlined' in text
            for i, line in enumerate(text.split('\n'), 1):
                if ALLOW.search(line): continue
                for m in ICON_TAG.finditer(line): out.append((m.group(1), f'{rel}:{i}', True))
                for m in HTML_LIGA.finditer(line): out.append((m.group(1), f'{rel}:{i}', True))
                if has_icon:
                    for m in LITERAL.finditer(line): out.append((m.group(1), f'{rel}:{i}', False))
    return out

def main():
    if not os.path.exists(FONT):
        print(f'lint-icons: {FONT} is missing'); return 2
    have = shipped_names()
    dirs = [('wm-primitives', os.path.join(ROOT, 'src'))]
    faces = {}
    for pair in filter(None, os.environ.get('WM_CONSUMER_FACES', '').split(',')):
        name, f = pair.split('=', 1); faces[name] = shipped_names(f)
    for pair in filter(None, os.environ.get('WM_CONSUMERS', '').split(',')):
        name, d = pair.split('=', 1); dirs.append((name, d))
    found = sites(dirs)
    problems = {}
    for name, where, sure in found:
        own = faces.get(where.split(':', 1)[0])
        if name in (own if own is not None else have): continue
        # an unsure literal only counts if it LOOKS like a Material name: two+ words, all known letters
        if not sure and not re.fullmatch(r'[a-z]+(_[a-z0-9]+)+', name): continue
        problems.setdefault(name, []).append(where)
    used = sorted({n for n, w, _ in found if n in have and w.split(':', 1)[0] not in faces})
    print(f'lint-icons: face ships {len(have)} ligatures; code uses {len(used)} of them')
    for label, own in faces.items():
        print(f'lint-icons: {label} draws from its own face ({len(own)} ligatures); it uses {len({n for n, w, _ in found if w.split(":", 1)[0] == label and n in own})}')
    if os.path.exists(DOCS_FONT) and os.path.isdir(DOCS_PAGES):
        docs_have = shipped_names(DOCS_FONT)
        docs_found = sites([('docs', DOCS_PAGES)])
        for name, where, sure in docs_found:
            if name in docs_have: continue
            if not sure and not re.fullmatch(r'[a-z]+(_[a-z0-9]+)+', name): continue
            problems.setdefault(name, []).append(where)
        print(f'lint-icons: the system page draws from the full face ({len(docs_have)} ligatures); its pages use {len({n for n, _, _ in docs_found if n in docs_have})}')
    if problems:
        print(f'\nlint-icons: {len(problems)} name(s) the shipped face cannot draw\n')
        for name, wheres in sorted(problems.items()):
            print(f'  {name:<28} {", ".join(wheres[:4])}{" …" if len(wheres) > 4 else ""}')
        print('\nEither add the name to the subset (fonts/MaterialSymbolsOutlined.woff2, pyftsubset from the')
        print('full face with --layout-features=liga and every name in use) or use one it has. A literal')
        print('that is not an icon name: `icon-lint: allow -- reason` on its line.')
        return 1
    print('lint-icons: clean'); return 0

if __name__ == '__main__': sys.exit(main())
