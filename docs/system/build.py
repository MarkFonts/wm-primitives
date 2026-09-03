#!/usr/bin/env python3
"""Assemble every wm-primitives visualisation into ONE page.

Each source page is a standalone document with its own <style>, its own ids and its own
@font-face. Concatenating them naively would (a) blow past the 16MB artifact ceiling,
since each embeds 1.9-3.9MB of base64 font, and (b) cross-contaminate: six pages that
all style `.card`, `body` and `*` would fight.

So: strip every @font-face and declare the faces ONCE at the top; then scope each page's
CSS to its own section id, rename its ids, and run its script against its own root.
"""
import pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
SD   = HERE / "pages"
DOCS = HERE.parent

# The Optical Size Proof is deliberately NOT here: it is a font-proofing instrument, not
# a page about the design system. (It also embeds CalSansUI.ttf rather than the full
# variable face, so it could not have shared this page's font anyway.)
SECTIONS = [
    ("type",    "Type",          SD/"type-tokens.built.html", "7 roles, 3 inks, 6 signals"),
    # Circles is the corner law's exclusion list, not a law of its own: it rides
    # inside 02. 03 is the control interface.
    ("corners",  "The corner law",    [SD/"corner-law.html", SD/"circles.html"],
                                       "superellipse(1.2), 2^k, and what opts out"),
    ("controls", "Interface",         SD/"controls.html",     "one dial, five ways"),
    ("space",   "Space",         SD/"space.html",             "the pad scale, cap + alignment"),
    ("color",  "Color",        SD/"color-audit.html",      "every declaration, audited"),
    ("usage",   "Who uses what", SD/"color-usage.html",      "the usage map"),
]

# ---------------------------------------------------------------- css scoping
def split_rules(css):
    """Yield (prelude, body_or_None, end) for top-level constructs."""
    out, i, n = [], 0, len(css)
    while i < n:
        brace = css.find("{", i)
        if brace == -1:
            out.append((css[i:], None)); break
        prelude = css[i:brace]
        depth, j = 1, brace + 1
        while j < n and depth:
            if css[j] == "{": depth += 1
            elif css[j] == "}": depth -= 1
            j += 1
        out.append((prelude, css[brace+1:j-1]))
        i = j
    return out

# :root / html / body, optionally QUALIFIED (:root[data-theme="dark"], body.past-app,
# body[data-force="on"]). The qualifier is stamped on the real root element by a theme
# toggle or a script, so it has to stay there -- the scope is appended after it. Handling
# only :root[...] here was why body.past-app and body[data-force] shipped as descendant
# selectors that match nothing.
ROOTISH = re.compile(r'^(:root|html|body)(?![-\w])((?:[.#\[:][^\s>+~,]*)*)\s*(.*)$')

def scope_selector(sel, root):
    sel = sel.strip()
    if not sel:
        return sel
    # `&` is the scope itself. The controls page carries its state on the section
    # element (.vert, .touch), and every other form here produces a DESCENDANT --
    # `#s-controls .vert`, or `body.vert #s-controls` -- neither of which is
    # `#s-controls.vert`. Without this the state toggles compile to selectors that
    # match nothing, which is how a section can look right and do nothing.
    if sel.startswith("&"):
        return root + sel[1:]
    m = ROOTISH.match(sel)
    if m:
        name, qual, rest = m.group(1), m.group(2), m.group(3).strip()
        if qual:
            return f'{name}{qual} {root}' + (f' {rest}' if rest else '')
        return f'{root} {rest}' if rest else root
    return f'{root} {sel}'

def scope_css(css, root, depth=0):
    parts = []
    for prelude, body in split_rules(css):
        if body is None:
            parts.append(prelude); continue
        p = prelude.strip()
        low = p.lower()
        if low.startswith("@keyframes") or low.startswith("@-webkit-keyframes"):
            parts.append(f"{p}{{{body}}}")           # keyframe steps are not selectors
        elif low.startswith("@font-face"):
            continue                                  # declared once, globally
        elif low.startswith("@"):
            parts.append(f"{p}{{{scope_css(body, root, depth+1)}}}")
        else:
            sels = ",".join(scope_selector(s, root) for s in p.split(",") if s.strip())
            parts.append(f"{sels}{{{body}}}")
    return "".join(parts)

# ---------------------------------------------------------------- per section
def build_section(sid, label, path, kicker):
    """`path` may be a list. Extra sources fold into the SAME section under a wrapper
    class -- corner-law and circles share fourteen class names (.bar, .grid, .tag,
    .zone-chip ...), so merging them at one scope would let the host page's rules
    reach into the guest's markup."""
    if isinstance(path, (list, tuple)):
        extras = list(path[1:]); path = path[0]
    else:
        extras = []
    raw = path.read_text(errors="replace")
    raw = re.sub(r'@font-face\s*\{.*?\}', '', raw, flags=re.S)
    title = (re.search(r'<title>(.*?)</title>', raw, re.S) or [None, label])[1]

    css = "\n".join(re.findall(r'<style[^>]*>(.*?)</style>', raw, re.S))
    # Strip CSS comments BEFORE scoping. split_rules() treats everything up to '{' as the
    # selector, so a comment sitting above a rule became part of its prelude -- and then
    # ':root' no longer compared equal to ':root', fell through to the descendant branch,
    # and shipped as '#s-x /*...*/ :root', which matches nothing. Every commented :root /
    # body / * rule silently lost its declarations; --radius-pill was one, which left
    # .zone-chip at border-radius 0 and therefore square, since corner-shape is a no-op
    # without a radius.
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    # SVG <style> is CDATA-wrapped. Those markers are legal in SVG and INVALID inside an
    # HTML <style>, so the CSS parser stops dead at '<![CDATA[' and silently drops every
    # rule after it -- which is how the GEOM map lost all its --g-* colors and painted
    # black while --radius, declared earlier, still resolved.
    css = css.replace('<![CDATA[', '').replace(']]>', '')
    js  = "\n".join(re.findall(r'<script[^>]*>(.*?)</script>', raw, re.S))

    html = re.sub(r'<style[^>]*>.*?</style>', '', raw, flags=re.S)
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.S)
    html = re.sub(r'<title>.*?</title>', '', html, flags=re.S)
    html = re.sub(r'<!doctype[^>]*>', '', html, flags=re.I)
    html = re.sub(r'</?(html|head|body)[^>]*>', '', html, flags=re.I)

    root = f"#s-{sid}"
    css = scope_css(css, root)

    for n, ex in enumerate(extras, 1):
        ex_raw = re.sub(r'@font-face\s*\{.*?\}', '', ex.read_text(errors="replace"), flags=re.S)
        ex_css = "\n".join(re.findall(r'<style[^>]*>(.*?)</style>', ex_raw, re.S))
        ex_css = re.sub(r'/\*.*?\*/', '', ex_css, flags=re.S)
        ex_css = ex_css.replace('<![CDATA[', '').replace(']]>', '')
        ex_js  = "\n".join(re.findall(r'<script[^>]*>(.*?)</script>', ex_raw, re.S))
        ex_html = re.sub(r'<style[^>]*>.*?</style>', '', ex_raw, flags=re.S)
        ex_html = re.sub(r'<script[^>]*>.*?</script>', '', ex_html, flags=re.S)
        ex_html = re.sub(r'<title>.*?</title>', '', ex_html, flags=re.S)
        ex_html = re.sub(r'<!doctype[^>]*>', '', ex_html, flags=re.I)
        ex_html = re.sub(r'</?(html|head|body)[^>]*>', '', ex_html, flags=re.I)
        part = f"part-{n}"
        css += scope_css(ex_css, f"{root} .{part}")
        html += f'<div class="{part}">{ex_html}</div>'
        js  += "\n" + ex_js


    # ids are document-global: prefix them, and every reference to them.
    ids = set(re.findall(r'\bid="([^"]+)"', html))
    for old in sorted(ids, key=len, reverse=True):
        new = f"{sid}-{old}"
        html = html.replace(f'id="{old}"', f'id="{new}"')
        html = html.replace(f'href="#{old}"', f'href="#{new}"')
        html = html.replace(f'for="{old}"', f'for="{new}"')
        js = js.replace(f"'{old}'", f"'{new}'").replace(f'"{old}"', f'"{new}"')
        css = css.replace(f"#{old}", f"#{new}")

    # Chapters: every h2 the page already writes becomes an anchor in the floating
    # outline. Ids are assigned here so the outline and the document cannot drift apart.
    chapters = []
    def tag_h2(m):
        # These headings carry a right-aligned note in a nested span ("THE 5 PILLS" +
        # "999px in situ - k comes from the toggle"). Flattening the whole element glued
        # the two together, so take only the heading's own leading text.
        inner = m.group(2)
        lead = inner.split("<")[0]
        text = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', lead)).strip()
        if not text:
            text = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', inner)).strip()
        if len(text) > 38:
            text = text[:37].rstrip(" ,.;:-") + "…"
        if not text:
            return m.group(0)
        cid = f"{sid}-c{len(chapters)+1}"
        chapters.append((cid, text))
        return f'<h2 id="{cid}"{m.group(1)}>{m.group(2)}</h2>'
    html = re.sub(r'<h2([^>]*)>(.*?)</h2>', tag_h2, html, flags=re.S)

    # each script gets its own scope, and its document queries are rebound to the section
    if js.strip():
        js = js.replace("document.querySelectorAll", "ROOT.querySelectorAll")
        js = js.replace("document.querySelector", "ROOT.querySelector")
        # a standalone page toggles state on <body>; inside the document that is the
        # section, and it has to agree with the `&.vert` selectors above.
        js = js.replace("document.body.classList", "ROOT.classList")
        js = js.replace("document.body.dataset", "ROOT.dataset")
        js = f"(function(){{var ROOT=document.getElementById('s-{sid}');if(!ROOT)return;\n{js}\n}})();"

    # The artifact wrapper supplies the <head>, and it carries no <meta charset>, so a
    # charset-less response decodes raw UTF-8 as windows-1252 ("ReCal only a<euro>" for an
    # em dash). Escape every non-ASCII character -- but PER CONTEXT, because the three
    # languages spell escapes differently and an HTML entity inside a CSS content: string
    # would render literally as "&#8212;".
    html  = "".join(c if ord(c) < 128 else f"&#{ord(c)};" for c in html)
    title = "".join(c if ord(c) < 128 else f"&#{ord(c)};" for c in title)
    css  = "".join(c if ord(c) < 128 else f"\\{ord(c):04X} " for c in css)
    js   = "".join(c if ord(c) < 128 else f"\\u{ord(c):04X}" for c in js)

    chapters = [(cid, "".join(c if ord(c) < 128 else f"&#{ord(c)};" for c in txt))
                for cid, txt in chapters]

    return dict(sid=sid, label=label, title=title, kicker=kicker,
                css=css, html=html, js=js, chapters=chapters)


GEOM_TOKENS = """<style>
:root{
  /* the GEOM chart's palette. The axis hues are the DISPLAY-P3 colour in OKLCH, so a
     wide-gamut screen gets the chroma each was picked at and sRGB gamut-maps back.
     They hold across both themes; only the twelve neutrals move. */
  --g-a11y:#ff6b35; --g-a11y:oklch(71.85% 0.2279 37.82);
  --g-base:#00a0ff; --g-base:oklch(68.25% 0.2027 239.51);
  --g-geo:#00c700; --g-geo:oklch(70.40% 0.3056 145.66);
  --g-bg:#f8f8f8; --g-bg:oklch(97.91% 0 0);
  --g-fg:#242424; --g-fg:oklch(26.03% 0 0);
  --g-fg2:#454545; --g-fg2:oklch(39.04% 0 0);
  --g-dim:#a1a1a1; --g-dim:oklch(70.90% 0 0);
  --g-rule:#e0e0e0; --g-rule:oklch(90.67% 0 0);
  --g-grid:#dcdcdc; --g-grid:oklch(89.45% 0 0);
  --g-tick:#d4d4d4; --g-tick:oklch(86.99% 0 0);
  --g-vgrid:#e8e8e8; --g-vgrid:oklch(93.10% 0 0);
  --g-hatch:#a1a1a1; --g-hatch:oklch(70.90% 0 0);
  --g-surface:#ffffff; --g-surface:oklch(100.00% 0 0);
  --g-onfg:#ffffff; --g-onfg:oklch(100.00% 0 0);
  --g-ui:#242424; --g-ui:oklch(26.03% 0 0);
  /* A wash is a MIX toward the ground -- the ground moves with the theme, so the wash
     has to know it. An ink level is alpha ON the colour. Neither is an opacity
     attribute: those composite against whatever is behind and keep the value out of
     the palette. 113 of them come off the chart on the way through the build. */
  --g-a11y-wash:color-mix(in oklab,var(--g-a11y),var(--g-bg) 93%);
  --g-base-wash:color-mix(in oklab,var(--g-base),var(--g-bg) 93%);
  --g-geo-wash: color-mix(in oklab,var(--g-geo), var(--g-bg) 93%);
  --g-ui-wash:  color-mix(in oklab,var(--g-ui),  var(--g-bg) 93%);
  --g-fg-wash:  color-mix(in oklab,var(--g-fg),  var(--g-bg) 93%);
  --g-a11y-45:oklch(from var(--g-a11y) l c h/.45); --g-a11y-85:oklch(from var(--g-a11y) l c h/.85);
  --g-base-45:oklch(from var(--g-base) l c h/.45); --g-base-85:oklch(from var(--g-base) l c h/.85);
  --g-geo-45: oklch(from var(--g-geo)  l c h/.45); --g-geo-85: oklch(from var(--g-geo)  l c h/.85);
  --g-ui-45:  oklch(from var(--g-ui)   l c h/.45); --g-ui-85:  oklch(from var(--g-ui)   l c h/.85);
  --g-grid-30:oklch(from var(--g-grid) l c h/.30);
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --g-bg:#151515; --g-bg:oklch(19.57% 0 0);
  --g-fg:#e6edf3; --g-fg:oklch(94.25% 0.0111 243.66);
  --g-fg2:#b8c0c8; --g-fg2:oklch(80.40% 0.0144 248.01);
  --g-dim:#6e7681; --g-dim:oklch(56.29% 0.0196 256.33);
  --g-rule:#2c3138; --g-rule:oklch(31.12% 0.0144 256.78);
  --g-grid:#262b31; --g-grid:oklch(28.66% 0.0131 253.03);
  --g-tick:#30363d; --g-tick:oklch(33.00% 0.0149 252.31);
  --g-vgrid:#22272d; --g-vgrid:oklch(27.03% 0.0133 253.05);
  --g-hatch:#7d8590; --g-hatch:oklch(61.37% 0.0191 256.32);
  --g-surface:#0d1117; --g-surface:oklch(17.63% 0.0140 258.36);
  --g-onfg:#151515; --g-onfg:oklch(19.57% 0 0);
  --g-ui:#e6edf3; --g-ui:oklch(94.25% 0.0111 243.66);
}}
:root[data-theme="dark"]{
  --g-bg:#151515; --g-bg:oklch(19.57% 0 0);
  --g-fg:#e6edf3; --g-fg:oklch(94.25% 0.0111 243.66);
  --g-fg2:#b8c0c8; --g-fg2:oklch(80.40% 0.0144 248.01);
  --g-dim:#6e7681; --g-dim:oklch(56.29% 0.0196 256.33);
  --g-rule:#2c3138; --g-rule:oklch(31.12% 0.0144 256.78);
  --g-grid:#262b31; --g-grid:oklch(28.66% 0.0131 253.03);
  --g-tick:#30363d; --g-tick:oklch(33.00% 0.0149 252.31);
  --g-vgrid:#22272d; --g-vgrid:oklch(27.03% 0.0133 253.05);
  --g-hatch:#7d8590; --g-hatch:oklch(61.37% 0.0191 256.32);
  --g-surface:#0d1117; --g-surface:oklch(17.63% 0.0140 258.36);
  --g-onfg:#151515; --g-onfg:oklch(19.57% 0 0);
  --g-ui:#e6edf3; --g-ui:oklch(94.25% 0.0111 243.66);
}
:root[data-theme="light"]{
  --g-bg:#f8f8f8; --g-bg:oklch(97.91% 0 0);
  --g-fg:#242424; --g-fg:oklch(26.03% 0 0);
  --g-fg2:#454545; --g-fg2:oklch(39.04% 0 0);
  --g-dim:#a1a1a1; --g-dim:oklch(70.90% 0 0);
  --g-rule:#e0e0e0; --g-rule:oklch(90.67% 0 0);
  --g-grid:#dcdcdc; --g-grid:oklch(89.45% 0 0);
  --g-tick:#d4d4d4; --g-tick:oklch(86.99% 0 0);
  --g-vgrid:#e8e8e8; --g-vgrid:oklch(93.10% 0 0);
  --g-hatch:#a1a1a1; --g-hatch:oklch(70.90% 0 0);
  --g-surface:#ffffff; --g-surface:oklch(100.00% 0 0);
  --g-onfg:#ffffff; --g-onfg:oklch(100.00% 0 0);
  --g-ui:#242424; --g-ui:oklch(26.03% 0 0);
}
.mono{font-family:"PaperMono",ui-monospace,SFMono-Regular,Menlo,monospace}
</style>
"""

def build_type_page():
    """type-tokens.html is a template: __FACE__/__SPEC__ are font URLs and __GEOMSVG__ is
    the GEOM axis map. Fonts are referenced, not embedded -- the assembler strips every
    @font-face anyway and declares the faces once for the whole document."""
    tpl = (SD/"type-tokens.html").read_text()
    svg = (SD/"geom-themed.svg").read_text()
    svg = svg[svg.index("<svg"):]
    svg = re.sub(r"@font-face\s*\{.*?\}", "", svg, flags=re.S)
    svg = svg.replace("font-family:'CalSansVF', sans-serif;", 'font-family:"Face", sans-serif;')
    svg = svg.replace("font-family: 'CalSansVF', sans-serif;", 'font-family: "Face", sans-serif;')
    # The svgshow build is 1920x1650 and carries its own light-only token block under
    # names that collide with :root -- --bg, --fg, --surface. Strip it, rename to --g-*,
    # and emit BOTH themes from GEOM_TOKENS instead of shipping a second file.
    svg = svg.replace('viewBox="0 0 1920 1650" width="1920" height="1650"',
                      'viewBox="0 0 1920 1650" preserveAspectRatio="xMidYMid meet"')
    svg = re.sub(r'<style>svg\{.*?\}</style>\s*', '', svg, flags=re.S)
    for t in ("bg","fg2","fg","dim","rule","grid","tick","vgrid","hatch","surface",
              "onfg","a11y","ui","base","geo"):
        svg = svg.replace(f"var(--{t})", f"var(--g-{t})")
    svg = svg.replace('id="card"','id="geom-card"').replace('url(#card)','url(#geom-card)')
    svg = svg.replace('id="hatch"','id="geom-hatch"').replace('url(#hatch)','url(#geom-hatch)')
    for t in ("a11y","base","geo","ui","fg"):
        svg = re.sub(r'(fill|stroke)="var\(--g-%s\)"([^/>]*?)\s*opacity="0\.07"'%t,
                     r'\1="var(--g-%s-wash)"\2'%t, svg)
    for t in ("a11y","base","geo","ui"):
        for a in ("45","85"):
            svg = re.sub(r'(fill|stroke)="var\(--g-%s\)"([^/>]*?)\s*opacity="0\.%s"'%(t,a),
                         r'\1="var(--g-%s-%s)"\2'%(t,a), svg)
    svg = re.sub(r'(fill|stroke)="var\(--g-grid\)"([^/>]*?)\s*opacity="0\.3"',
                 r'\1="var(--g-grid-30)"\2', svg)
    svg = re.sub(r'\s*opacity="1\.0"', '', svg)
    svg = GEOM_TOKENS + svg
    out = (tpl.replace("__FACE__", "../fonts/CalSansVF.ttf")
              .replace("__SPEC__", "../fonts/CalSansSpecimen.ttf")
              .replace("__GEOMSVG__", svg))
    assert not re.search(r"__[A-Z]+__", out), "unsubstituted placeholder"
    (SD/"type-tokens.built.html").write_text(out)

def six_outline():
    """The hero's 6, straight out of the Face at GEOM 100 -- real contours, not a
    drawing of them. Quadratic TT is compiled form; Qu2Cu gives back the cubic
    shape of the source drawing, which is what handles should feel like."""
    import json
    from fontTools.ttLib import TTFont
    from fontTools.pens.recordingPen import RecordingPen
    from fontTools.pens.qu2cuPen import Qu2CuPen
    f = TTFont(DOCS/"fonts"/"CalSansVF.ttf")
    gname = f.getBestCmap()[ord("6")]
    loc = {a.axisTag: a.defaultValue for a in f["fvar"].axes} if "fvar" in f else {}
    if "GEOM" in loc: loc["GEOM"] = 100
    gs = f.getGlyphSet(location=loc or None)
    rec = RecordingPen()
    gs[gname].draw(Qu2CuPen(rec, max_err=2.0, all_cubic=True))
    cmds, xs, ys = [], [], []
    for op, pts in rec.value:
        pts = [(round(x), round(-y)) for x, y in pts]   # y-flip once, here
        for x, y in pts: xs.append(x); ys.append(y)
        if op == "moveTo":  cmds.append(["M", *pts[0]])
        elif op == "lineTo": cmds.append(["L", *pts[0]])
        elif op == "curveTo": cmds.append(["C", *pts[0], *pts[1], *pts[2]])
        elif op == "closePath": cmds.append(["Z"])
        else: raise ValueError(f"unexpected op {op} in six outline")
    m = 70
    vb = f"{min(xs)-m} {min(ys)-m} {max(xs)-min(xs)+2*m} {max(ys)-min(ys)+2*m}"
    return json.dumps(cmds, separators=(",", ":")), vb

SIX_CMDS, SIX_VB = six_outline()

build_type_page()
secs = [build_section(*s) for s in SECTIONS]

# ---------------------------------------------------------------- the faces
def face(name):
    """Base64 the TTF straight out of docs/fonts. Encoding at build time keeps the repo
    free of megabyte base64 blobs while still allowing the self-contained build."""
    import base64
    raw = (DOCS/"fonts"/name).read_bytes()
    assert raw[:4] in (b"\x00\x01\x00\x00", b"OTTO", b"true"), f"{name} is not a TTF"
    return "data:font/ttf;base64," + base64.b64encode(raw).decode()

LINKED = "--linked" in sys.argv

if LINKED:
    FONTS = """
@font-face{font-family:"Face";src:url(fonts/CalSansVF.ttf) format("truetype");font-display:swap}
@font-face{font-family:"CalSansVF";src:url(fonts/CalSansVF.ttf) format("truetype");font-display:swap}
@font-face{font-family:"Specimen";src:url(fonts/CalSansSpecimen.ttf) format("truetype");font-display:swap}
@font-face{font-family:"PaperMono";src:url(fonts/PaperMono.woff2) format("woff2");font-display:swap}
"""
else:
    FACE, SPEC = face("CalSansVF.ttf"), face("CalSansSpecimen.ttf")
    FONTS = f"""
@font-face{{font-family:"Face";src:url({FACE}) format("truetype");font-display:swap}}
@font-face{{font-family:"CalSansVF";src:url({FACE}) format("truetype");font-display:swap}}
@font-face{{font-family:"Specimen";src:url({SPEC}) format("truetype");font-display:swap}}
"""

SHELL = """
/* ── THE COLOUR SYSTEM ─────────────────────────────────────────────────────────
   Four hues and one lightness ramp. A theme is not a second palette: it is where
   each role sits on that ramp, plus how hard the three inks press. Seven numbers,
   and everything else is derived with oklch(from ...) or color-mix().

   Each token is written twice, sRGB then OKLCH, so an engine without oklch() stops
   at the first line. Where a colour is an axis hue the OKLCH value is the DISPLAY-P3
   one -- a wide-gamut screen gets the chroma it was picked at, sRGB gamut-maps back.

   The --a11y/--ui/--base/--geo quartet that used to sit here was referenced nowhere
   and is gone; the axis hues that ARE used are the chart's --g-* set. */
:root{
  --hue-a11y:37.82; --hue-base:239.51; --hue-geo:145.66; --hue-signal:115.72;
  --l-ground:16.84%; --l-surface:21.78%; --l-surface-hi:26.45%; --l-ink:93.10%;
  --a-2:.62; --a-3:.38; --a-line:.14; --l-warn:74%;
  --signal:#eeff41; --signal:oklch(95.19% .2302 var(--hue-signal));
  /* the roles. These lines never change between themes -- only the numbers above do. */
  --bg:#0f0f0f;         --bg:oklch(var(--l-ground) 0 0);
  --surface:#1a1a1a;    --surface:oklch(var(--l-surface) 0 0);
  --surface-hi:#252525; --surface-hi:oklch(var(--l-surface-hi) 0 0);
  --ink:#e8e8e8;        --ink:oklch(var(--l-ink) 0 0);
  --ink-2:rgba(232,232,232,.62); --ink-2:oklch(from var(--ink) l c h / var(--a-2));
  --ink-3:rgba(232,232,232,.38); --ink-3:oklch(from var(--ink) l c h / var(--a-3));
  --line:rgba(232,232,232,.14);  --line:oklch(from var(--ink) l c h / var(--a-line));
  --ui-font:"Face","CalSansVF",system-ui,sans-serif;
  /* the column's own geometry. The colophon breaks OUT of it by exactly these, so
     they are tokens rather than three copies of 202 -- the alignment rule applies to
     a negative margin the same way it applies to padding: the sum has to agree. */
  --rail-w:202px; --edge-l:0px; --edge-r:28px;
  /* How far the colophon's glyphs may fly before the canvas raster cuts them off.
     letterbox.js READS this value and grows the canvas by it, then the negative
     margin below takes the same amount back out of the layout -- so the drawing
     surface is bigger than the box it occupies, and the box still ends on the
     wordmark's last row. Change it here and both halves follow. */
  --lb-bleed:520px;
}
@media (prefers-color-scheme: light){
  :root:not([data-theme="dark"]){
  --l-ground:96.66%; --l-surface:100%; --l-surface-hi:93.92%; --l-ink:20.02%;
    --a-2:.66; --a-3:.42; --a-line:.16; --l-warn:57%; --l-warn:57%;
    /* the light signal is a different COLOUR, not a step: olive, 4.5 degrees off */
    --signal:#5c6b00; --signal:oklch(49.43% .1370 120.20);
  }
}
:root[data-theme="dark"]{
  --l-ground:16.84%; --l-surface:21.78%; --l-surface-hi:26.45%; --l-ink:93.10%;
  --a-2:.62; --a-3:.38; --a-line:.14; --l-warn:74%;
  --signal:#eeff41; --signal:oklch(95.19% .2302 var(--hue-signal));
}
:root[data-theme="light"]{
  --l-ground:96.66%; --l-surface:100%; --l-surface-hi:93.92%; --l-ink:20.02%;
  --a-2:.66; --a-3:.42; --a-line:.16; --l-warn:57%;
  /* the light signal is a different COLOUR, not a step: olive, 4.5 degrees off */
  --signal:#5c6b00; --signal:oklch(49.43% .1370 120.20);
}

/* The linked build ships bare — no artifact wrapper, no reset — so the UA's 8px body
   margin shows the page-default white as a hairline gutter around .wm. Own the root. */
html,body{margin:0;padding:0;background:var(--bg)}
.wm{background:var(--bg);color:var(--ink);font-family:var(--ui-font);
  font-optical-sizing:auto;-webkit-font-smoothing:antialiased;min-height:100vh}
.wm *,.wm *::before,.wm *::after{corner-shape:superellipse(1.2)}
.wm-col{max-width:1180px;margin:0;padding:0 40px 0 0}

/* ---- Header: one full viewport, set like a poster ----
   Three moves, each with a name in the system:
   -- the statement is four short capitalised strings, which is GEO's declared job,
      so the stack runs GEOM 100 with the mandatory caps tracking, staggered on the
      grid, rule-fills running out to a shared right rail;
   -- the numeral 6 (six laws) is a MONSTER SAMPLE (SS.IV: past poster-5 lives
      "another instrument"), viewport-scale, cropped by the frame;
   -- it is painted in the faint ink, whose charter says "structural only: rules,
      disabled, WATERMARKS". opsz rides auto to its ceiling up there, which is the
      documented behaviour. The eyebrow runs vertical at the right margin. */
.wm-head{position:relative;min-height:100svh;box-sizing:border-box;display:flex;
  flex-direction:column;padding:44px 0 0;overflow:hidden}
/* The 6 is not a picture of the Face -- it is the Face: real contours extracted at
   GEOM 100, shown the way the editor shows them. Everything at FULL ink, outlines
   only. The nodes are live: hover gets the grab hand and the signal hue -- the
   node under your cursor is literally the thing under discussion. */
.wm-six{position:absolute;top:50%;right:clamp(28px,3.2vw,64px);transform:translateY(-50%);z-index:2;
  height:108svh;width:auto;overflow:visible;pointer-events:none;user-select:none;
  mix-blend-mode:difference}
/* difference lives on the dark ground only: on paper it would invert the whole
   drawing into fog, so light keeps normal paint */
@media (prefers-color-scheme:light){.wm-six{mix-blend-mode:normal}}
:root[data-theme="light"] .wm-six{mix-blend-mode:normal}
:root[data-theme="dark"] .wm-six{mix-blend-mode:difference}
.wm6-path{fill:none;stroke:var(--ink);stroke-width:1.5px;vector-effect:non-scaling-stroke}
.wm6-h{stroke:var(--ink);stroke-width:1px;vector-effect:non-scaling-stroke}
.wm6-on,.wm6-off{pointer-events:auto;cursor:grab;touch-action:none}
.wm6-on{fill:var(--ink)}
.wm6-off{fill:var(--bg);stroke:var(--ink);stroke-width:1.25px;vector-effect:non-scaling-stroke}
.wm6-on:hover,.wm6-off:hover,.wm6-on.drag,.wm6-off.drag{fill:var(--signal);stroke:var(--signal)}
.wm6-on.drag,.wm6-off.drag{cursor:grabbing}
.wm-eyebrow{position:absolute;top:44px;right:0;z-index:2;writing-mode:vertical-rl;
  font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);
  margin:0;font-variation-settings:"GEOM" 100}
.wm-stack{position:relative;display:flex;flex-direction:column;
  margin:clamp(16px,7vh,84px) 24px 0 0;font-size:clamp(2.4rem,8.6vw,10rem);line-height:1.07;
  font-weight:400;letter-spacing:.12em;text-transform:uppercase;
  font-variation-settings:"GEOM" 100}
.wm-stack span{display:flex;align-items:center;gap:.38em}
/* the rule-fill runs each open line out to the shared right rail; its weight sits
   near the caps' stroke and its seat at the optical mid of a 720 cap */
.wm-stack i{flex:1 1 0;height:.072em;background:currentColor;
  transform:translateY(-.035em);position:relative;z-index:3}
/* the rules and the bend ride ABOVE the blend layer: a hairline crossing a rule
   inverted it into a visible chop, and a rule is furniture, not type */
.wm-l2{margin-left:11vw}
.wm-l3{margin-left:3.5vw;position:relative}
.wm-l4{margin-left:16vw}
/* the EVERY rule does not stop at the rail: it bends and runs down the page, and
   the corner it turns is a lecture: a looping G0 -> G1 -> G2 morph wearing its own
   curvature comb, teeth on the outside, envelope in the signal hue -- position,
   tangent, curvature, the house law landing on G2. The label reads along the
   descender. The chevron now lives in the 6's counter and rides it. */
.wm-l3 i{margin-right:3em}
.wm-bendsvg{position:absolute;right:0;top:calc(50% - .071em);width:3em;height:5.6em;
  overflow:visible;pointer-events:none;z-index:3}
.wmb-path{fill:none;stroke:var(--ink);stroke-width:7.2}
.wmb-tooth{stroke:var(--ink);stroke-width:1.2}
.wmb-fill{fill:var(--signal);stroke:none}
.wm6-fill{fill:var(--signal);stroke:none}
.wm-bendlbl{position:absolute;right:.35em;top:1.15em;z-index:3;writing-mode:vertical-rl;
  text-decoration:none;font-style:normal;font-size:9px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--ink);font-variation-settings:"GEOM" 100;
  white-space:nowrap}
.wm6-combg line{stroke:var(--ink);stroke-width:1px;vector-effect:non-scaling-stroke}
.wm6-chev{fill:none;stroke:var(--ink);stroke-width:8;
  animation:wm6chev 2.6s ease-in-out infinite}
@keyframes wm6chev{0%{transform:translateY(-26px);opacity:0}35%{opacity:1}
  100%{transform:translateY(30px);opacity:0}}
@media (prefers-reduced-motion:reduce){.wm6-chev{animation:none}}
/* the bottom of the poster is its credit line: dek, then the counts on a hairline */
.wm-close{position:relative;z-index:1;margin-top:auto;padding-bottom:40px}
.wm-dek{font-size:18px;line-height:1.55;color:var(--ink-2);max-width:52ch;margin:0 0 40px}
.wm-dek b{color:var(--ink);font-weight:600}
/* Counts, not a claim. The type section's strip is boxed and spends the accent hue
   because it argues 44-sizes-today AGAINST 7/5/3 -- the hue points at the thing under
   discussion. Nothing here is under discussion, so this takes neither the box nor the
   hue; otherwise two near-identical strips compete and the accent means nothing. */
.wm-stats{display:flex;flex-wrap:wrap}
.wm-stat{padding:0 26px;border-left:1px solid var(--line)}
.wm-stat:first-child{padding-left:0;border-left:none}
.wm-stat b{display:block;font-size:30px;line-height:1;font-weight:600;letter-spacing:-.02em;
  font-variant-numeric:tabular-nums;color:var(--ink);font-variation-settings:"GEOM" 50}
.wm-stat i{display:block;font-style:normal;font-size:12px;color:var(--ink-3);margin-top:9px}
@media (max-width:720px){.wm-stat{padding:0 18px}}

/* ---- The outline is an AXIS, not a sidebar. No panel, no card, no active pill: a
   hairline rule with ticks, a diamond handle that slides to the current chapter, and the
   ink scale carrying the state. It is ReCal's own rail, which is the point -- this is a
   document about the instrument, so it is navigated like one. ---- */
/* The document is a two-column grid; the colophon is NOT in it. That single fact
   does three jobs that used to need three mechanisms: the rail can be sticky instead
   of fixed, so it leaves because it ran out of document rather than because a script
   faded it; the wordmark is full-bleed structurally, with no negative margins to keep
   in sync; and neither can overlap the other, because they are no longer siblings in
   the same column. */
.wm-doc{display:grid;grid-template-columns:var(--rail-w) minmax(0,1fr)}
/* Where the index stops. The rail travels the sections it indexes and no further: the
   closing note is not in the outline, so the outline has no business riding it down.
   That is what .wm-railcol is for -- a sticky box is bounded by its nearest ancestor's
   content box, and MEASURED, not assumed: Chrome bounds a sticky GRID ITEM by the grid
   container, so putting the footer in its own row moved nothing (verified, both unpinned
   at the same scroll). An ordinary wrapper that ends with row 1 does bound it. The
   footer keeps its own row in column 2 so the wrapper can end there without the closing
   note sliding under the rail. */
/* ITALIC IS AN AXIS HERE, NOT A SECOND FILE. <em> and <i> arrive italic from the UA
   sheet, and Face has no italic file to switch to -- so the browser slants the upright
   instead, skewing curves that were drawn, not sheared. Set the style back to normal and
   drive the axis. This lives in the shell because the trigger is the UA sheet, which
   reaches every section: fixing it per page fixed one page. */
.wm em,.wm i,.wm cite,.wm dfn,.wm var{font-style:normal;font-variation-settings:'ital' 1}
.wm-foot{grid-column:2}
.wm-railcol{grid-row:1;min-height:100%}
.wm-rail{position:sticky;top:0;height:100vh;z-index:90;
  display:flex;align-items:center;pointer-events:none}
.wm-axis{position:relative;padding:0 0 0 40px;width:100%;max-height:88vh;overflow-y:auto;
  scrollbar-width:none;pointer-events:auto}
.wm-axis::-webkit-scrollbar{display:none}
/* the rule itself, and the travelled portion of it */
.wm-axis::before{content:"";position:absolute;left:22px;top:6px;bottom:6px;width:2px;
  background:var(--line)}
.wm-axis::after{content:"";position:absolute;left:22px;top:6px;width:2px;
  height:calc(var(--prog,0) * (100% - 12px));background:var(--ink-3);transition:height .18s linear}
.wm-grp{margin:0 0 20px}
.wm-grp:last-child{margin-bottom:0}
/* HIERARCHY, on the house rules: one signal per distinction.
   level  = CASE. label and ui are both 12px in the token table, so caps against sentence
            separates them at equal size. Tracking and GEOM 100 ride along as the canonical
            caps pairing (Geo exists for short caps) -- compensations, not signals.
   state  = INK, and nothing else. .38 faint -> 1.0 full.
   depth  = INDENT off the axis, which is structure rather than type.
   No diamond: the rhombus already means "your defaults, baked into the export" in ReCal,
   and spending it as a generic cursor would empty it of that. */
.wm-lvl0{position:relative;display:block;text-decoration:none;padding:3px 0;
  font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);
  font-variation-settings:"GEOM" 100;transition:color .15s}
.wm-lvl0 u{text-decoration:none;font-variant-numeric:tabular-nums;margin-right:10px;opacity:.65}
.wm-lvl1{position:relative;display:block;text-decoration:none;padding:3px 0;
  margin-left:18px;font-size:12px;line-height:1.35;color:var(--ink-3);
  font-variation-settings:"GEOM" 25;transition:color .15s}
/* the section tick crosses the rule; the chapter tick sits clear of it, to the right */
.wm-lvl0::before{content:"";position:absolute;left:-22px;top:50%;width:14px;height:1px;
  background:var(--line)}
.wm-lvl1::before{content:"";position:absolute;left:-28px;top:50%;width:8px;height:1px;
  background:var(--line)}
.wm-lvl0:hover,.wm-lvl1:hover{color:var(--ink-2)}
.wm-lvl0.on,.wm-lvl1.on{color:var(--ink)}
/* No underline for "you are in this page": the chapters are already nested under their
   section, so a lit chapter shows its page by position. An underline would be a second
   device for something the grouping states, and the ink would then be doing cursor duty
   twice over. Ink marks the cursor; the thumb is that same state made physical on the
   track. */
.wm-lvl0.on::before,.wm-lvl1.on::before{width:14px;height:14px;margin-top:-7px;
  border-radius:50%;corner-shape:round;background:var(--ink)}
.wm-lvl0.on::before{left:-24px}
.wm-lvl1.on::before{left:-42px}
.wm-rail-foot{position:absolute;left:40px;bottom:0;font-size:9px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--ink-3)}

.wm-sec{padding:0}
.wm-sec-head{padding:64px 0 16px;border-top:1px solid var(--line);margin-top:56px}
.wm-sec:first-of-type .wm-sec-head{border-top:none;margin-top:8px}
.wm-n{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);
  font-variation-settings:"GEOM" 100;font-variant-numeric:tabular-nums}
/* No full-bleed: breaking the page out of the column pushed its wider demos past the
   viewport, where overflow clipped them. It stays in the column and scrolls its own
   overflow instead. */
.wm-body{position:relative;overflow-x:auto}
.wm-foot{padding:72px 0 40px;color:var(--ink-3);font-size:12.5px;
  border-top:1px solid var(--line);margin-top:64px;max-width:70ch}
/* The colophon: the house wordmark, scanned and packed with prose by letterbox.js
   (ported from wordmark.nyc). It is the last thing on the page for the same reason
   the 6 is the first -- the system signing its own document in its own face. */
/* THE COLOPHON MUST NEVER BE CLIPPED. Stated three times, on purpose: the canvas is
   deliberately taller than its box, so any ancestor that starts clipping silently
   decapitates the effect and it looks like a rendering bug rather than a CSS one.
   If you are adding overflow:hidden to a wrapper, it does not belong on this chain. */
.wm{overflow:visible}
.wm-main{overflow:visible}
.wm-lb{margin:12vh 0 0;padding:0;overflow:visible;position:relative;cursor:crosshair;
  /* flow-root, and it is load-bearing: with no border or padding here the canvas's
     negative top margin COLLAPSES with this element's own, which drags the box up
     instead of hanging the canvas above it -- the bleed silently becomes 0 and the
     glyphs clip again. A block formatting context stops the collapse, and unlike
     overflow:hidden it clips nothing. Do not "simplify" this away. */
  display:flow-root}
/*  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
 *
 *   YOU FOUND THE COLOPHON.
 *
 *   The wordmark below is not an image and not a font rendering. It is the word
 *   WORDMARK drawn at display size on an offscreen canvas, scanned row by row for
 *   runs of ink, and every run packed with prose -- Jerome K. Jerome, "Three Men
 *   in a Boat", 1889, public domain -- until the next glyph will not fit.
 *
 *   Push your cursor into it. The letters scatter and swell, and they are allowed
 *   to leave: NOTHING here clips to the box (see --lb-bleed above; there is no
 *   overflow:hidden on this rule, and that absence is deliberate). Hold the mouse
 *   down and the field gets stronger.
 *
 *   A seeded sixth of the glyphs fade to the signal hue on five phase groups.
 *   Seeded, not random -- resize the window and the same sixth comes back, because
 *   the pattern belongs to the wordmark rather than to when you loaded the page.
 *
 *   The knobs are the config this page passes to the primitive (src/letterbox.js,
 *   inlined below):  speckle.share (1/6) . speckle.groups (5) . speckle.speed (~4s)
 *   fillSize (10px) . minFillSize (6px) . axes (SHRP 0-100)
 *
 *   It is the same engine as the footer on wordmark.nyc, which runs two canvases so
 *   that work images can sit between the layers -- the primitive's `layers` option.
 *   There are no images here, so this one stays on a single canvas and computes the
 *   colour per glyph instead (`speckle`).
 *
 *   -- built by hand, in the open, with the same six laws the page argues for.
 *
 *  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  */
/* Nothing below this rule. The canvas is sized to the letterforms exactly, then grown
   by --lb-bleed and pulled back by the same amount -- so the document ends on the
   wordmark's last row and the scroll has nowhere further to go, while the glyphs still
   have somewhere to fly. */
.wm-lb canvas{display:block;margin:calc(-1 * var(--lb-bleed, 0px)) 0 0;
  background:transparent;
  /* The canvas does no hit-testing. It overhangs the content above it by --lb-bleed,
     and a transparent element that swallows clicks over half a page of text is a bug
     waiting to be reported; letterbox.js tracks the cursor on `window` instead, which
     also means the glyphs start reacting as you approach from above the box. */
  pointer-events:none}
.wm-foot a{color:var(--ink-2)}

/* The page sits to the right of the rail. Below the breakpoint the rail becomes a
   horizontal scroller pinned to the top, because a fixed column would eat the width the
   demos need. */
.wm-main{min-width:0;padding:0 var(--edge-r) 0 var(--edge-l)}
@media (max-width:1080px){
  .wm-doc{display:block}
  /* the rail is a top bar here, and a bar that stops at the end of the sections would
     stop being a bar -- display:contents takes the wrapper back out of the layout */
  .wm-railcol{display:contents}
  .wm-rail{position:sticky;top:0;height:auto;width:auto;
    background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(12px);
    border-bottom:1px solid var(--line)}
  .wm-axis{display:flex;gap:0;padding:0 20px;max-height:none;overflow-x:auto;overflow-y:hidden}
  .wm-axis::before,.wm-axis::after,.wm-rail-foot{display:none}
  .wm-grp{margin:0;display:flex;align-items:center;flex:0 0 auto}
  .wm-lvl1{display:none}
  .wm-lvl0{padding:14px 15px}
  .wm-lvl0::before,.wm-lvl0.on::before{display:none}
  :root{--rail-w:0px;--edge-l:20px;--edge-r:20px}
  .wm-head{padding:32px 0 0}
  .wm-lb{margin-top:8vh}
}
/* below ~90px of statement the five labels start colliding (asc-cap is .18em);
   keep the two that teach — x and base — and let the rules speak for the rest */
@media (max-width:720px){
  .wm-mr-asc u,.wm-mr-cap u,.wm-mr-desc u{display:none}
}
"""

CHAPTER_CAP = 7   # past this a page's own headings stop being an outline and become a list

rail = []
for i, s in enumerate(secs, 1):
    chapters = "".join(
        f'<a class="wm-lvl1" href="#{cid}">{txt}</a>' for cid, txt in s["chapters"][:CHAPTER_CAP])
    rail.append(
        f'<div class="wm-grp"><a class="wm-lvl0" href="#s-{s["sid"]}">'
        f'<u>{i:02d}</u>{s["label"]}</a>{chapters}</div>')
rail = "".join(rail)

body_parts = []
for i, s in enumerate(secs, 1):
    # Only a number and a rule. Every page already opens with its own H1, and printing the
    # title again above it read as a stutter.
    body_parts.append(f"""
<section class="wm-sec">
  <div class="wm-sec-head"><div class="wm-n">{i:02d} &middot; {s['label']}</div></div>
  <div class="wm-body" id="s-{s['sid']}">{s['html']}</div>
</section>""")

# Each source page styled its own <body> — max-width, auto margins, page padding, a
# background. Scoped, those land on the section wrapper and centre the content inside a
# column that no longer matches the shell's left-aligned headings. Neutralise the page
# furniture only; everything inside the section keeps its own layout untouched.
# Only the page BACKGROUND and min-height are neutralised. Each page keeps its own
# max-width, margins and padding, because it was composed for a full viewport and its
# internal proportions depend on that — the section runs full-bleed below its heading
# rather than being squeezed into the shell's column.
resets = "\n".join(
    f"#s-{s['sid']}{{max-width:none;margin:0;padding:0;background:none;min-height:0;"
    f"display:block;place-items:normal;width:auto}}" for s in secs)

# Only the type page wraps its content in a fixed 1000px column; the rest flow at body
# width. Release that one too, so all six share the shell's column rather than stacking
# six different measures down the page.
resets += "\n#s-type>.wrap{max-width:none;margin:0;padding:0;width:auto}"
resets += ("\n#s-corners .grid.g3,#s-circles .grid.g3,#s-space .grid.g3{grid-template-columns:repeat(auto-fit,minmax(430px,1fr))}")

css_parts = "\n".join(f"/* ===== {s['sid']} ===== */\n{s['css']}" for s in secs) + \
            "\n/* ===== page-furniture resets ===== */\n" + resets
js_parts  = "\n".join(s["js"] for s in secs if s["js"].strip())

HERO_TMPL = """
(function(){
  var svg=document.getElementById('wm6'); if(!svg||!svg.createSVGPoint) return;
  var CMDS=__SIX__, NS='http://www.w3.org/2000/svg';
  function mk(t,cls){var e=document.createElementNS(NS,t);if(cls)e.setAttribute('class',cls);return e}
  function se(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)}
  var P=[],K=[];
  CMDS.forEach(function(c){var op=c[0];
    if(op==='M'||op==='L'){P.push({x:c[1],y:c[2],on:1});K.push({op:op,i:[P.length-1]});}
    else if(op==='C'){P.push({x:c[1],y:c[2],on:0});P.push({x:c[3],y:c[4],on:0});
      P.push({x:c[5],y:c[6],on:1});K.push({op:'C',i:[P.length-3,P.length-2,P.length-1]});}
    else K.push({op:'Z',i:[]});});
  function d(){return K.map(function(k){if(k.op==='Z')return 'Z';
    return k.op+k.i.map(function(i){return P[i].x+' '+P[i].y}).join(' ');}).join('')}
  var fillG=mk('g'),combG=mk('g','wm6-combg');
  svg.appendChild(fillG);svg.appendChild(combG);
  var path=mk('path','wm6-path');svg.appendChild(path);
  var chev=mk('path','wm6-chev');svg.appendChild(chev);
  function onBefore(j){for(var t=j-1;t>=0;t--){if(K[t].i.length)return K[t].i[K[t].i.length-1]}return 0}
  var stems=[];K.forEach(function(k,j){if(k.op!=='C')return;
    stems.push([onBefore(j),k.i[0]]);stems.push([k.i[2],k.i[1]]);});
  var stemEls=stems.map(function(){var l=mk('line','wm6-h');svg.appendChild(l);return l});
  var nodeEls=P.map(function(p){var e;
    if(p.on){e=mk('rect','wm6-on');e.setAttribute('width',14);e.setAttribute('height',14);}
    else{e=mk('circle','wm6-off');e.setAttribute('r',7);}
    svg.appendChild(e);return e});
  var SEGJ=[],SEGC=[],ci=0;
  K.forEach(function(k,j){if(k.op==='Z'){ci++;return}
    if(k.op==='C'){SEGJ.push(j);SEGC.push(ci);}});
  var TN=9,NT=SEGJ.length*TN;
  var teeth=[],B=[];
  for(var t3=0;t3<NT;t3++){var l=mk('line');combG.appendChild(l);teeth.push(l);
    B.push({x:0,y:0,ox:0,oy:0,c:SEGC[Math.floor(t3/TN)]});}
  // contour ranges + fill quads between neighbouring teeth of the same contour
  var ranges={};B.forEach(function(b,i){if(!(b.c in ranges))ranges[b.c]={s:i,e:i};ranges[b.c].e=i;});
  var quads=[];
  Object.keys(ranges).forEach(function(c){for(var i=ranges[c].s;i<ranges[c].e;i++){
    var pg=mk('polygon','wm6-fill');pg.setAttribute('opacity',0);fillG.appendChild(pg);
    quads.push({el:pg,a:i,b:i+1});}
    // close the seam: the contour's last tooth back to its first
    var pw=mk('polygon','wm6-fill');pw.setAttribute('opacity',0);fillG.appendChild(pw);
    quads.push({el:pw,a:ranges[c].e,b:ranges[c].s});});
  function contours(){var cs=[],cur=[];
    K.forEach(function(k){if(k.op==='Z'){if(cur.length)cs.push(cur);cur=[];return}
      if(k.op==='M'&&cur.length){cs.push(cur);cur=[];}
      k.i.forEach(function(i){if(P[i].on)cur.push(i)});});
    if(cur.length)cs.push(cur);return cs}
  function areas(){return contours().map(function(c){var A=0;
    for(var i=0;i<c.length;i++){var a=P[c[i]],b=P[c[(i+1)%c.length]];A+=a.x*b.y-b.x*a.y}
    return A/2})}
  var AR=[];
  function comb(){AR=areas();var ti=0;
    var big=0;AR.forEach(function(A,i){if(Math.abs(A)>Math.abs(AR[big]))big=i});
    var flip=AR.map(function(A,i){var f=A>0?-1:1;return i===big?f:-f});
    SEGJ.forEach(function(j,si){var f=flip[SEGC[si]]||1;
      var k=K[j],a=P[onBefore(j)],b=P[k.i[0]],c=P[k.i[1]],e=P[k.i[2]];
      var x1=3*(b.x-a.x),y1=3*(b.y-a.y),x2=3*(c.x-b.x),y2=3*(c.y-b.y),x3=3*(e.x-c.x),y3=3*(e.y-c.y);
      for(var s2=0;s2<TN;s2++){var t=s2/(TN-1),mt=1-t;
        var dx=mt*mt*x1+2*mt*t*x2+t*t*x3, dy=mt*mt*y1+2*mt*t*y2+t*t*y3;
        var ddx=2*(mt*(x2-x1)+t*(x3-x2)), ddy=2*(mt*(y2-y1)+t*(y3-y2));
        var px=mt*mt*mt*a.x+3*mt*mt*t*b.x+3*mt*t*t*c.x+t*t*t*e.x;
        var py=mt*mt*mt*a.y+3*mt*mt*t*b.y+3*mt*t*t*c.y+t*t*t*e.y;
        var sp=Math.sqrt(dx*dx+dy*dy)||1;
        var kap=Math.abs((dx*ddy-dy*ddx)/(sp*sp*sp));
        var len=Math.min(110,kap*9000)*f;
        var bb=B[ti++];bb.x=px;bb.y=py;bb.ox=-dy/sp*len;bb.oy=dx/sp*len;}});}
  // the comb breathes: populate clockwise from each contour's origin, pause on the
  // full configuration, retract home, rest. A drag holds it out -- never edit blind.
  var POP=900,HOLD=1800,RET=900,HIDE=1100,CYC=POP+HOLD+RET+HIDE;
  var t0=performance.now(),drag=-1;
  function factor(u,now,c){
    if(drag>=0)return 1;
    var ph=(now-t0-(c||0)*650)%CYC;if(ph<0)ph+=CYC;
    if(ph<POP){return se((se(ph/POP)*1.18-u)/0.18)}
    ph-=POP;if(ph<HOLD)return 1;
    ph-=HOLD;if(ph<RET){return 1-se((se(ph/RET)*1.18-u)/0.18)}
    return 0}
  function applyComb(now){
    var i,n,u,f,b,tx,ty;
    for(i=0;i<NT;i++){b=B[i];var r=ranges[b.c];n=r.e-r.s;
      u=n?(i-r.s)/n:0;
      if((AR[b.c]||0)<=0)u=1-u;   // sweep visually clockwise on every contour
      f=factor(u,now,b.c);         // contours take turns: the counter trails a beat
      tx=b.x+b.ox*f;ty=b.y+b.oy*f;
      var l=teeth[i];
      l.setAttribute('x1',b.x);l.setAttribute('y1',b.y);
      l.setAttribute('x2',tx);l.setAttribute('y2',ty);
      b.fx=tx;b.fy=ty;b.f=f;}
    quads.forEach(function(q){var a=B[q.a],c=B[q.b];
      var mag=Math.max(Math.hypot(a.ox,a.oy),Math.hypot(c.ox,c.oy))/110;
      var op=Math.min(a.f,c.f)*Math.pow(mag,1.6)*.45;
      q.el.setAttribute('points',a.x+','+a.y+' '+c.x+','+c.y+' '+c.fx+','+c.fy+' '+a.fx+','+a.fy);
      q.el.setAttribute('opacity',op.toFixed(3));});}
  function chevPos(){var cs=contours();if(cs.length<2)return null;
    var best=null,bA=1e18;
    cs.forEach(function(c,i){var A=Math.abs(AR[i]||0);if(A<bA){bA=A;best=c}});
    var mx=0,my=0;best.forEach(function(i){mx+=P[i].x;my+=P[i].y});
    return{x:mx/best.length,y:my/best.length}}
  function paint(){path.setAttribute('d',d());
    stems.forEach(function(st,k2){var l=stemEls[k2];
      l.setAttribute('x1',P[st[0]].x);l.setAttribute('y1',P[st[0]].y);
      l.setAttribute('x2',P[st[1]].x);l.setAttribute('y2',P[st[1]].y);});
    P.forEach(function(p,i){var e=nodeEls[i];
      if(p.on){e.setAttribute('x',p.x-7);e.setAttribute('y',p.y-7);}
      else{e.setAttribute('cx',p.x);e.setAttribute('cy',p.y);}});
    comb();
    var cp=chevPos();
    if(cp){var w=46,h=26;
      chev.setAttribute('d','M'+(cp.x-w/2)+' '+(cp.y-h/2)+'L'+cp.x+' '+(cp.y+h/2)+'L'+(cp.x+w/2)+' '+(cp.y-h/2));}}
  paint();
  // start mid-HOLD so a still frame (hidden tab, screenshot) shows the configuration
  t0=performance.now()-POP-200;
  applyComb(performance.now());
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduce){(function tick(){applyComb(performance.now());requestAnimationFrame(tick)})();}
  window.__wm6={chev:chev,svg:svg};
  var hist=[];
  function snap(){return P.map(function(p){return{x:p.x,y:p.y,on:p.on}})}
  addEventListener('keydown',function(ev){
    if((ev.metaKey||ev.ctrlKey)&&!ev.shiftKey&&(ev.key==='z'||ev.key==='Z')){
      if(hist.length){P=hist.pop();paint();applyComb(performance.now());ev.preventDefault();}}});
  function loc(ev){var pt=svg.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse())}
  nodeEls.forEach(function(e,i){
    e.addEventListener('pointerdown',function(ev){
      hist.push(snap());if(hist.length>120)hist.shift();
      drag=i;e.classList.add('drag');e.setPointerCapture(ev.pointerId);ev.preventDefault();});
    e.addEventListener('pointermove',function(ev){if(drag!==i)return;
      var q=loc(ev);P[i].x=Math.round(q.x);P[i].y=Math.round(q.y);paint();applyComb(performance.now());});
    e.addEventListener('pointerup',function(){drag=-1;t0=performance.now()-POP;e.classList.remove('drag');});
    e.addEventListener('lostpointercapture',function(){drag=-1;t0=performance.now()-POP;e.classList.remove('drag');});
  });
})();
(function(){
  var svg=document.getElementById('wmbend'); if(!svg) return;
  var NS='http://www.w3.org/2000/svg';
  function mk(t,c){var e=document.createElementNS(NS,t);if(c)e.setAttribute('class',c);return e}
  function se(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)}
  var W=300,SW=7.2,R=85,xv=W-SW/2,hy=SW/2,x1=xv-R,cy=hy+R,H=300;
  var NC=40,NF=10,total=NF+NC+NF;
  function corner(mode){var pts=[],i,t;
    for(i=0;i<NC;i++){t=i/(NC-1);
      if(mode===1){pts.push(t<0.5?[x1+R*(t*2),hy]:[xv,hy+R*((t-0.5)*2)]);}
      else if(mode===2){var th=t*Math.PI/2;pts.push([x1+R*Math.sin(th),cy-R*Math.cos(th)]);}
      else{var n=2.2974,th2=t*Math.PI/2;
        pts.push([x1+R*Math.pow(Math.sin(th2),2/n),cy-R*Math.pow(Math.cos(th2),2/n)]);}}
    return pts}
  function flats(pts){var out=[],i;
    for(i=0;i<NF;i++)out.push([x1*(i/NF),hy]);
    out=out.concat(pts);
    for(i=1;i<=NF;i++)out.push([xv,cy+Math.max(20,H-cy)*(i/NF)]);
    return out}
  var MODES=[corner(0),corner(1),corner(2)];
  var LBL=['G2 · curvature','G0 · position','G1 · tangent'];
  var quads=[];for(var q2=0;q2<total-1;q2++){var pg=mk('polygon','wmb-fill');svg.appendChild(pg);quads.push(pg)}
  var TEETH=[];for(var i2=0;i2<total;i2++){var l2=mk('line','wmb-tooth');svg.appendChild(l2);TEETH.push(l2)}
  var path=mk('path','wmb-path');svg.appendChild(path);
  var lbl=document.getElementById('wmbendlbl');
  function render(pts,ff){
    path.setAttribute('d','M'+pts.map(function(p){return p[0].toFixed(1)+' '+p[1].toFixed(1)}).join('L'));
    var tips=[],lens=[],fs=[],n=pts.length;
    for(var i=0;i<n;i++){
      var a=pts[Math.max(0,i-1)],b=pts[i],c=pts[Math.min(n-1,i+1)];
      var ux=c[0]-a[0],uy=c[1]-a[1],ul=Math.sqrt(ux*ux+uy*uy)||1;
      var ax=b[0]-a[0],ay=b[1]-a[1],bx=c[0]-b[0],by=c[1]-b[1];
      var la=Math.sqrt(ax*ax+ay*ay),lb=Math.sqrt(bx*bx+by*by),
          lc=Math.sqrt((c[0]-a[0])*(c[0]-a[0])+(c[1]-a[1])*(c[1]-a[1]));
      var kap=(la&&lb&&lc)?2*(ax*by-ay*bx)/(la*lb*lc):0;
      var len=Math.max(-95,Math.min(95,kap*4600));
      var f=ff(i/(n-1));
      var tx=b[0]+uy/ul*len*f,ty=b[1]-ux/ul*len*f;
      var t=TEETH[i];
      t.setAttribute('x1',b[0]);t.setAttribute('y1',b[1]);
      t.setAttribute('x2',tx);t.setAttribute('y2',ty);
      tips.push([tx,ty]);lens.push(Math.abs(len));fs.push(f);}
    for(var q=0;q<total-1;q++){
      var op=Math.min(fs[q],fs[q+1])*(Math.max(lens[q],lens[q+1])/95)*.8;
      var el2=quads[q];
      el2.setAttribute('points',pts[q][0]+','+pts[q][1]+' '+pts[q+1][0]+','+pts[q+1][1]+' '+tips[q+1][0]+','+tips[q+1][1]+' '+tips[q][0]+','+tips[q][1]);
      el2.setAttribute('opacity',op.toFixed(3));}}
  function position(){
    var w6=window.__wm6; if(!w6||!w6.chev.getBBox) return;
    // measure the chevron's BASE, not its marching self: getBBox + the outer svg's
    // CTM sidesteps the CSS travel, then the descender clears the whole march
    var bb; try{bb=w6.chev.getBBox()}catch(e){return}
    if(!bb.width) return;
    var m=w6.svg.getScreenCTM(); if(!m) return;
    var pt=w6.svg.createSVGPoint();
    pt.x=bb.x+bb.width/2; pt.y=bb.y; var scr=pt.matrixTransform(m);
    var l3=svg.closest('.wm-l3'); if(!l3) return;
    var st=l3.parentElement.getBoundingClientRect();
    var chevX=scr.x, extra=st.right-chevX-4;
    if(extra>0&&extra<st.width*.6) l3.style.marginRight=extra+'px';
    var fpx=parseFloat(getComputedStyle(l3).fontSize);
    var l3r=l3.getBoundingClientRect(), barY=l3r.top+l3r.height/2;
    var dy=scr.y-40-barY;
    if(dy>fpx*.9){svg.style.height=dy+'px';H=dy*100/fpx;
      svg.setAttribute('viewBox','0 0 300 '+Math.round(H));}}
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  position();
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){position();
    if(reduce)render(flats(MODES[0]),function(){return 1});});
  addEventListener('resize',function(){position()});
  render(flats(MODES[0]),function(){return 1});if(lbl)lbl.textContent=LBL[0];
  if(reduce)return;
  // the corner stays G2 -- the law is not up for debate; only the comb breathes,
  // on the same grammar as the 6, off its beat
  var POP=700,HOLD2=1400,RET=700,GAP=1000,SEG=POP+HOLD2+RET+GAP;
  var t0=performance.now()-POP-200-1150;
  var G2PTS=flats(MODES[0]);
  function frame(now){var ph=(now-t0)%SEG,ff;
    if(ph<POP){var e=se(ph/POP);ff=function(u2){return se((e*1.18-u2)/0.18)}}
    else if(ph<POP+HOLD2){ff=function(){return 1}}
    else if(ph<POP+HOLD2+RET){var e2=se((ph-POP-HOLD2)/RET);
      ff=function(u2){return 1-se((e2*1.18-u2)/0.18)}}
    else{ff=function(){return 0}}
    G2PTS=flats(MODES[0]);   // H may change on resize/position
    render(G2PTS,ff);requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
})();
"""
HERO = HERO_TMPL.replace("__SIX__", SIX_CMDS)

# -- The gloss ---------------------------------------------------------------------
# THE LINKED BUILD ONLY. This is the one route that gets type above SDR white in a
# browser: real DOM text with an HDR AVIF as its background and background-clip:text,
# under dynamic-range-limit:no-limit. It needs the AVIF as a FILE beside the page, which
# the single-file build (CSP, everything a data URI) cannot have -- and 132KB of AVIF is
# 176KB of base64 on a page already near 4MB. So the poster glows on Pages and lands on
# the P3 acid everywhere else, which is a fallback nobody has to maintain.
#
# What wears it, and what deliberately does not:
#   the four headline lines  -- the whole point
#   the bending bar          -- masked by its PATH only (see below)
#   the eyebrow              -- no: it is 9px, and small type composites the headroom away
#   the rules                -- no: sized off the header, a short rule caught one static
#                               corner of the field and never moved with the rest
#   the 6                    -- no: it carries mix-blend-mode:difference, where added
#                               light inverts instead of adding
#   the comb                 -- no: it already emits its own colour
#
# ONE field for the whole header. A percentage background-size resolves against each
# element's OWN box, so every line scaled the map to itself and ran a private copy of it;
# sizing in px off the header and offsetting each element by its own left/top edge
# (--ox/--oy) makes one light source that travels ACROSS the words.
GLOSS = "" if not LINKED else r"""
<style id="gloss-css">
.wm-head{ --gx:0px; --gy:0px; --gw:0px; --gh:0px; --gloss:url(field-247.avif); }
/* The glyph is the mask, the field is the paint. The field never goes black (BASE is
   0.30 of reference white), so replacing the ink cannot make a letter disappear. */
.wm-head .wm-stack span{
  background-color:var(--ink);                /* if the AVIF 404s, the caps stay ink */
  background-image:var(--gloss);
  background-size:var(--gw) var(--gh);
  background-position:calc(var(--gx) - var(--ox,0px)) calc(var(--gy) - var(--oy,0px));
  background-repeat:no-repeat;                /* the pan never leaves the field */
  -webkit-background-clip:text;background-clip:text;
  color:transparent;
  dynamic-range-limit:no-limit;
}
/* The rule wears the field as well. It lives inside a span whose color is now
   transparent and used to paint itself with currentColor, so it needed a background
   of its own -- and that background may as well be the light. No background-clip
   here: the rule has no text to clip to, it IS the shape, so the field paints its
   whole box. It will go DARKER in places, which is correct: the field's base is 0.30
   of reference white and a light travelling across a bar is not a bar that only ever
   brightens. */
.wm-head .wm-stack i{
  background-color:var(--ink);                /* if the AVIF 404s, the rule stays ink */
  background-image:var(--gloss);
  background-size:var(--gw) var(--gh);
  background-position:calc(var(--gx) - var(--ox,0px)) calc(var(--gy) - var(--oy,0px));
  background-repeat:no-repeat;
  dynamic-range-limit:no-limit;
}
.wm-head .wm-bendsvg{ dynamic-range-limit:no-limit; }
.wm-head .wm-bendsvg rect[data-gloss]{ pointer-events:none; }
</style>
<script id="gloss-js">
(function(){
  var head=document.querySelector('.wm-head'); if(!head) return;
  var NS='http://www.w3.org/2000/svg';
  /* The crop the tuner landed on: 23.5% x 9.3% of the map. */
  var ZOOM_X=4.25, ZOOM_Y=10.75;

  /* The bending bar wears it too, masked by the PATH alone -- not the comb's quads or
     teeth, so nothing paints in the corner the comb already illuminates. No plus-lighter:
     the bar's stroke is near-white ink and adding to it saturated to flat white, so the
     gloss replaces the stroke inside the mask, the same way the headline wears the
     field. The path is drawn by the hero script, so this waits for it. */
  var bend=head.querySelector('.wm-bendsvg'), bpat=null, bspan=[0,0];
  function wireBend(){
    if(bpat || !bend) return;
    var path=bend.querySelector('.wmb-path'); if(!path) return;
    var vb=(bend.getAttribute('viewBox')||'').split(/[\s,]+/).map(Number);
    if(vb.length!==4) return;
    var X=vb[0],Y=vb[1],W=vb[2],H=vb[3];
    path.id=path.id||'bend-gloss-src';
    var defs=bend.querySelector('defs')||bend.insertBefore(document.createElementNS(NS,'defs'),bend.firstChild);

    var mask=document.createElementNS(NS,'mask');
    mask.id='bend-gloss-mask';
    mask.setAttribute('maskUnits','userSpaceOnUse');
    mask.setAttribute('x',X); mask.setAttribute('y',Y);
    mask.setAttribute('width',W); mask.setAttribute('height',H);
    var u=document.createElementNS(NS,'use');
    u.setAttribute('href','#'+path.id);
    u.style.stroke='#fff'; u.style.fill='none';
    mask.appendChild(u); defs.appendChild(mask);

    bpat=document.createElementNS(NS,'pattern');
    bpat.id='bend-gloss-pat';
    bpat.setAttribute('patternUnits','userSpaceOnUse');
    bpat.setAttribute('x',X); bpat.setAttribute('y',Y);
    bpat.setAttribute('width',W*ZOOM_X); bpat.setAttribute('height',H*ZOOM_Y);
    var im=document.createElementNS(NS,'image');
    im.setAttribute('href','field-247.avif');
    im.setAttribute('width',W*ZOOM_X); im.setAttribute('height',H*ZOOM_Y);
    im.setAttribute('preserveAspectRatio','none');
    bpat.appendChild(im); defs.appendChild(bpat);
    bspan=[W*(ZOOM_X-1), H*(ZOOM_Y-1)];

    var rect=document.createElementNS(NS,'rect');
    rect.setAttribute('x',X); rect.setAttribute('y',Y);
    rect.setAttribute('width',W); rect.setAttribute('height',H);
    rect.setAttribute('fill','url(#bend-gloss-pat)');
    rect.setAttribute('mask','url(#bend-gloss-mask)');
    rect.setAttribute('data-gloss','1');
    bend.appendChild(rect);
  }

  /* The field's size is the HEADER's, in px, and every element is offset by its own
     corner -- that is what makes it one light source instead of one per line. */
  function place(){
    var hb=head.getBoundingClientRect();
    head.style.setProperty('--gw',(hb.width  * ZOOM_X)+'px');
    head.style.setProperty('--gh',(hb.height * ZOOM_Y)+'px');
    /* the rule is in this list too: it is 940px wide against a 1050px header, so it
       has as much horizontal travel as the lines do -- it was left out, not left out
       on purpose. */
    [].forEach.call(head.querySelectorAll('.wm-stack span, .wm-stack i'),function(el){
      var r=el.getBoundingClientRect();
      el.style.setProperty('--ox',(r.left-hb.left)+'px');
      el.style.setProperty('--oy',(r.top -hb.top )+'px');
    });
  }

  /* Panning a zoomed crop, not sliding a slab: the window is a fraction of the field, so
     different structure comes through as it travels instead of arriving intact. */
  function apply(u,v){
    var hb=head.getBoundingClientRect();
    /* (u-1), not -u. Same travel, opposite direction. With -u the crop moved further
       negative as the pointer went right, which slides the image LEFT -- the field
       ran away from the cursor and the whole thing read as parallax behind glass
       rather than a light you are dragging across the words. */
    head.style.setProperty('--gx',((u-1)*hb.width *(ZOOM_X-1))+'px');
    head.style.setProperty('--gy',((v-1)*hb.height*(ZOOM_Y-1))+'px');
    if(bpat){ bpat.setAttribute('x',((u-1)*bspan[0])+''); bpat.setAttribute('y',((v-1)*bspan[1])+''); }
  }

  function boot(){ wireBend(); place(); apply(cu,cv); }
  var cu=0.5, cv=0.5, raf=null;
  boot(); addEventListener('resize',boot);
  /* the hero draws the bend after its own layout pass; catch it whenever it lands */
  var tries=0, t=setInterval(function(){ wireBend(); if(bpat||++tries>40) clearInterval(t); },150);

  /* The WINDOW, not the header. Bound to the header, the light froze the moment the
     pointer crossed into the rail or the right margin -- which is most of the page,
     and exactly where you are when you are reading the outline. The fraction is still
     measured against the header's box and clamped, so the light keeps travelling as
     you approach and parks at the edge instead of stopping dead. */
  addEventListener('mousemove',function(e){
    var r=head.getBoundingClientRect();
    var cl=function(n){ return n<0?0:n>1?1:n; };
    cu=cl((e.clientX-r.left)/r.width); cv=cl((e.clientY-r.top)/r.height);
    if(raf) return;
    raf=requestAnimationFrame(function(){ raf=null; apply(cu,cv); });
  });

  /* ── no pointer: the page itself moves the light ────────────────────────────
     A phone has no mousemove, so the field sat at its default forever -- the one
     input everybody already makes is the scroll. The header is at the top of the
     document, so scroll progress maps onto the field's vertical travel with nothing
     to explain: the light comes down the words as you come down the page. Gated on a
     coarse pointer so it cannot fight the mouse on a desktop that also has touch. */
  /* No load-time device gate. `matchMedia('(pointer: coarse)')` at script-eval time is
     a snapshot of something that changes -- a mouse gets plugged in, emulation turns
     on, a laptop has both -- and when the snapshot was wrong the scroll listener was
     never attached at all and the field sat at its initial 0.5 forever.

     Nor is there a latch. A `pointerUsed` flag set by the first mousemove looked
     tidy and was worse: one synthetic mousemove -- and something dispatches one on
     load -- disabled scroll for the rest of the session. Both inputs simply write,
     and the one that moved most recently is the one you see. You are not scrolling
     and moving the mouse in the same instant. */
  var onScroll=function(){
    var max=Math.max(1, document.documentElement.scrollHeight - innerHeight);
    cv = Math.min(1, Math.max(0, scrollY/max));
    if(raf) return;
    raf=requestAnimationFrame(function(){ raf=null; apply(cu,cv); });
  };
  addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  /* Tilt is opt-in and has to be: iOS sends no orientation events at all until
     requestPermission() resolves, and that call is only honoured inside a real user
     gesture. So the headline is the switch -- tap the words you want lit. Android
     needs no prompt, so there the same tap just starts listening. Once tilt drives,
     scroll stands down. */
  var tilting=false;
  var startTilt=function(){
    if(tilting) return; tilting=true;
    removeEventListener('scroll', onScroll);
    addEventListener('deviceorientation', function(e){
      if(e.gamma==null) return;
      cu = Math.min(1, Math.max(0, (e.gamma + 45) / 90));   /* -45..45 across */
      cv = Math.min(1, Math.max(0, (e.beta  - 15) / 60));   /*  15..75 tipped */
      if(raf) return;
      raf=requestAnimationFrame(function(){ raf=null; apply(cu,cv); });
    });
  };
  head.addEventListener('click', function(){
    var D = window.DeviceOrientationEvent;
    if(!D) return;
    if(typeof D.requestPermission === 'function'){
      D.requestPermission().then(function(r){ if(r === 'granted') startTilt(); })
                           .catch(function(){});   /* declined: scroll keeps it */
    } else { startTilt(); }
  });
})();
</script>
"""

# The colophon runs the shared primitive, src/letterbox.js -- the same engine
# wordmark.nyc's hero and footer use. It is inlined here like every other script on the
# page, and it stays ASCII so the single-file build cannot mojibake. It is an ES module,
# so it goes in its own <script type="module"> below; the config that makes it THIS
# page's colophon travels with it, in the same module scope.
LETTERBOX = (HERE.parent.parent / "src" / "letterbox.js").read_text()
assert not [c for c in LETTERBOX if ord(c) > 127], "letterbox.js must stay ASCII"

LB_BOOT = """
var lb = createLetterbox(document.getElementById('lb-footer'), {
  words:           ['WORDMARK'],
  largeFontFamily: '"Face", "CalSansVF", -apple-system, sans-serif',
  fillFontFamily:  '"Face", "CalSansVF", -apple-system, sans-serif',
  fillSize:        10,
  widthFraction:   0.98,
  // No animated axis. It never rendered: canvas 2D has no fontVariationSettings in
  // Chrome, so the SHRP animation this config used to carry -- and the 'wdth' one
  // wordmark.nyc carries, for an axis CalSansVF does not even have -- moved nothing at
  // all. Measured, not assumed: identical ink at GEOM 0 and GEOM 100.
  // A seeded sixth of the glyphs fade ink -> --signal on five phase groups. Not the
  // two-canvas juggle wordmark.nyc runs: nothing sits between the layers here, so the
  // split would buy an extra canvas and no effect.
  speckle:         { share: 1 / 6, groups: 5 },
  // The acid is a P3-SCALED token now, so the canvas needs a P3 buffer to hold it --
  // an sRGB buffer would clamp the speckle back to the hex the page falls back to.
  colorSpace:      'display-p3',
  // Read from --lb-bleed: the canvas grows at the top so repelled glyphs are not cut
  // off by the raster edge, and the CSS takes the same amount back out of the layout.
  bleedTop:        260,
  minFillSize:     6,
});
if (lb) {
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(lb.init);
  else lb.init();
}
"""

SPY = """
(function(){
  var rail=document.querySelector('.wm-axis'); if(!rail) return;
  var links=[].slice.call(rail.querySelectorAll('a[href^="#"]'));
  var targets=links.map(function(a){return document.getElementById(a.getAttribute('href').slice(1));});
  function tick(){
    var y=scrollY+innerHeight*0.28, best=-1;
    for(var i=0;i<targets.length;i++){
      var t=targets[i]; if(!t) continue;
      if(t.getBoundingClientRect().top+scrollY<=y) best=i;
    }
    links.forEach(function(a,i){a.classList.toggle('on',i===best);});

    var doc=document.documentElement;
    var p=doc.scrollHeight-innerHeight;
    rail.style.setProperty('--prog', p>0 ? Math.min(1,Math.max(0,scrollY/p)) : 0);
    if(best>-1){ var el=links[best];
      var rb=rail.getBoundingClientRect(), eb=el.getBoundingClientRect();
      if(eb.top<rb.top+8||eb.bottom>rb.bottom-8) el.scrollIntoView({block:'nearest'});
    }
  }
  addEventListener('scroll',tick,{passive:true}); addEventListener('resize',tick); tick();
})();
"""

HEAD = ("" if not LINKED else
  '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
  '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
  '<meta property="og:title" content="Six laws. Every surface.">\n'
  '<meta property="og:description" content="The WORDMARK house system &mdash; type, corners, circles, space, and color, each decided once. Grab the 6 by its handles.">\n'
  '<meta property="og:image" content="https://markfonts.github.io/wm-primitives/og.png">\n'
  '<meta property="og:image:width" content="2400"><meta property="og:image:height" content="1260">\n'
  '<meta property="og:type" content="website">\n'
  '<meta property="og:url" content="https://markfonts.github.io/wm-primitives/">\n'
  '<meta name="twitter:card" content="summary_large_image">\n')
TAIL = ("" if not LINKED else "\n</body></html>")

page = f"""{HEAD}<title>wm-primitives &mdash; the system</title>
<style>{FONTS}{SHELL}
{css_parts}
</style>
<div class="wm">
  <div class="wm-doc">
  <div class="wm-railcol"><nav class="wm-rail"><div class="wm-axis">{rail}
    <span class="wm-rail-foot">wm&#8209;primitives</span></div></nav></div>
  <div class="wm-main">
  <header class="wm-head">
    <svg class="wm-six" id="wm6" viewBox="{SIX_VB}" aria-hidden="true"></svg>
    <p class="wm-eyebrow">wm-primitives &middot; the house system</p>
    <h1 class="wm-stack"><span class="wm-l1">Six<i></i></span><span
      class="wm-l2">laws.</span><span class="wm-l3">Every<i></i><svg class="wm-bendsvg" id="wmbend"
      viewBox="0 0 300 560" aria-hidden="true"></svg><u class="wm-bendlbl" id="wmbendlbl"></u></span><span
      class="wm-l4">surface.</span></h1>
    <div class="wm-close">
      <p class="wm-dek">Type, corners, circles, space, and color, each decided once and written
        down here &mdash; so a <b>Glyphs plugin</b>, a <b>React proofing page</b>, and
        <b>wordmark.nyc</b> round the same corners, spend the same space, and mean the same thing
        by a color. This is the long form: every law in one scroll, with the outline on the
        left. Each parameter earns its own page as the system grows.</p>
      <div class="wm-stats">
        <div class="wm-stat"><b>6</b><i>laws, one page</i></div>
        <div class="wm-stat"><b>7</b><i>type roles</i></div>
        <div class="wm-stat"><b>12</b><i>space steps</i></div>
        <div class="wm-stat"><b>G2</b><i>corners, as the font is drawn</i></div>
      </div>
    </div>
  </header>
  {''.join(body_parts)}
  </div>
  <footer class="wm-foot">
    Built from the working pages, not screenshots &mdash; every demo here is live CSS, so the
    corners really are superellipses and the padding really is the token. Corner shapes need
    Chrome 148+; Safari falls back to plain radii, which is the intended degradation.
  </footer>
  </div>
  <div class="wm-lb"><canvas id="lb-footer" aria-label="WORDMARK"></canvas></div>
</div>
<script>{js_parts}
{HERO}
{SPY}</script>
<script type="module">{LETTERBOX}
{LB_BOOT}</script>{GLOSS}{TAIL}
"""

bad = [(i, repr(c)) for i, c in enumerate(page) if ord(c) > 127]
if not LINKED:
    assert not bad, f"{len(bad)} raw non-ASCII chars left, first at {bad[0]} - would mojibake"

out = (DOCS/"index.html" if LINKED else HERE/"wm-system.html")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(page)
print(f"wrote {out.name}: {len(page):,} bytes ({len(page)/1e6:.2f}MB)")
if LINKED:
    print("  fonts linked from fonts/ (not embedded)")
else:
    print(f"  fonts {(len(FACE)+len(SPEC))/1e6:.2f}MB   content {(len(page)-len(FACE)-len(SPEC))/1e6:.2f}MB")
for s in secs:
    print(f"  {s['sid']:<9} css={len(s['css'])/1000:>6.1f}KB  html={len(s['html'])/1000:>6.1f}KB  js={len(s['js'])/1000:>5.1f}KB")
