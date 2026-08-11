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
    ("corners", "The corner law",SD/"corner-law.html",        "superellipse(1.2), and 2^k"),
    ("circles", "Circles",       SD/"circles.html",           "what opts out, and why"),
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


def build_type_page():
    """type-tokens.html is a template: __FACE__/__SPEC__ are font URLs and __GEOMSVG__ is
    the GEOM axis map. Fonts are referenced, not embedded -- the assembler strips every
    @font-face anyway and declares the faces once for the whole document."""
    tpl = (SD/"type-tokens.html").read_text()
    svg = (SD/"geom-themed.svg").read_text()
    svg = svg[svg.index("<svg"):]
    svg = re.sub(r"@font-face\s*\{.*?\}", "", svg, flags=re.S)
    svg = svg.replace("font-family: 'CalSansVF', sans-serif;", 'font-family: "Face", sans-serif;')
    svg = svg.replace('viewBox="0 0 1920 1080" width="1920" height="1080"',
                      'viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid meet"')
    out = (tpl.replace("__FACE__", "../fonts/CalSansVF.ttf")
              .replace("__SPEC__", "../fonts/CalSansSpecimen.ttf")
              .replace("__GEOMSVG__", svg))
    assert not re.search(r"__[A-Z]+__", out), "unsubstituted placeholder"
    (SD/"type-tokens.built.html").write_text(out)

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
"""
else:
    FACE, SPEC = face("CalSansVF.ttf"), face("CalSansSpecimen.ttf")
    FONTS = f"""
@font-face{{font-family:"Face";src:url({FACE}) format("truetype");font-display:swap}}
@font-face{{font-family:"CalSansVF";src:url({FACE}) format("truetype");font-display:swap}}
@font-face{{font-family:"Specimen";src:url({SPEC}) format("truetype");font-display:swap}}
"""

SHELL = """
:root{
  --ink:#e8e8e8; --ink-2:rgba(232,232,232,.62); --ink-3:rgba(232,232,232,.38);
  --bg:#0f0f0f; --surface:#1a1a1a; --surface-hi:#252525; --line:rgba(232,232,232,.14);
  --a11y:#c97050; --ui:#999; --base:#4a7fd4; --geo:#4aad5c; --signal:#eeff41;
  --ui-font:"Face","CalSansVF",system-ui,sans-serif;
}
@media (prefers-color-scheme: light){
  :root{--ink:#161616;--ink-2:rgba(22,22,22,.66);--ink-3:rgba(22,22,22,.42);
    --bg:#f4f4f2;--surface:#fff;--surface-hi:#ebebe8;--line:rgba(22,22,22,.16);
    --a11y:#a85136;--ui:#6b6b6b;--base:#2f5fae;--geo:#2f8a44;--signal:#5c6b00}
}
:root[data-theme="dark"]{--ink:#e8e8e8;--ink-2:rgba(232,232,232,.62);--ink-3:rgba(232,232,232,.38);
  --bg:#0f0f0f;--surface:#1a1a1a;--surface-hi:#252525;--line:rgba(232,232,232,.14);
  --a11y:#c97050;--ui:#999;--base:#4a7fd4;--geo:#4aad5c;--signal:#eeff41}
:root[data-theme="light"]{--ink:#161616;--ink-2:rgba(22,22,22,.66);--ink-3:rgba(22,22,22,.42);
  --bg:#f4f4f2;--surface:#fff;--surface-hi:#ebebe8;--line:rgba(22,22,22,.16);
  --a11y:#a85136;--ui:#6b6b6b;--base:#2f5fae;--geo:#2f8a44;--signal:#5c6b00}

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
.wm-six{position:absolute;top:50%;right:-4vw;transform:translateY(-50%);z-index:0;
  font-size:175svh;line-height:1;font-variation-settings:"GEOM" 100;
  color:var(--line);pointer-events:none;user-select:none}
.wm-eyebrow{position:absolute;top:44px;right:0;z-index:2;writing-mode:vertical-rl;
  font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);
  margin:0;font-variation-settings:"GEOM" 100}
.wm-stack{position:relative;z-index:1;display:flex;flex-direction:column;
  margin:clamp(16px,7vh,84px) 24px 0 0;font-size:clamp(2.4rem,8.6vw,10rem);line-height:1.07;
  font-weight:400;letter-spacing:.12em;text-transform:uppercase;
  font-variation-settings:"GEOM" 100}
.wm-stack span{display:flex;align-items:center;gap:.38em}
/* the rule-fill runs each open line out to the shared right rail; its weight sits
   near the caps' stroke and its seat at the optical mid of a 720 cap */
.wm-stack i{flex:1 1 0;height:.072em;background:currentColor;
  transform:translateY(-.035em)}
.wm-l2{margin-left:11vw}
.wm-l3{margin-left:3.5vw}
.wm-l4{margin-left:16vw}
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
.wm-rail{position:fixed;left:0;top:0;height:100vh;width:202px;z-index:90;
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
.wm-foot{padding:72px 0 110px;color:var(--ink-3);font-size:12.5px;
  border-top:1px solid var(--line);margin-top:64px;max-width:70ch}
.wm-foot a{color:var(--ink-2)}

/* The page sits to the right of the rail. Below the breakpoint the rail becomes a
   horizontal scroller pinned to the top, because a fixed column would eat the width the
   demos need. */
.wm-main{margin-left:202px;padding:0 28px 0 0}
@media (max-width:1080px){
  .wm-rail{position:sticky;top:0;height:auto;width:auto;
    background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(12px);
    border-bottom:1px solid var(--line)}
  .wm-axis{display:flex;gap:0;padding:0 20px;max-height:none;overflow-x:auto;overflow-y:hidden}
  .wm-axis::before,.wm-axis::after,.wm-rail-foot{display:none}
  .wm-grp{margin:0;display:flex;align-items:center;flex:0 0 auto}
  .wm-lvl1{display:none}
  .wm-lvl0{padding:14px 15px}
  .wm-lvl0::before,.wm-lvl0.on::before{display:none}
  .wm-main{margin-left:0;padding:0 20px}
  .wm-head{padding:32px 0 0}
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
  '<meta name="viewport" content="width=device-width,initial-scale=1">\n')
TAIL = ("" if not LINKED else "\n</body></html>")

page = f"""{HEAD}<title>wm-primitives &mdash; the system</title>
<style>{FONTS}{SHELL}
{css_parts}
</style>
<div class="wm">
  <nav class="wm-rail"><div class="wm-axis">{rail}
    <span class="wm-rail-foot">wm&#8209;primitives</span></div></nav>
  <div class="wm-main">
  <header class="wm-head">
    <div class="wm-six" aria-hidden="true">6</div>
    <p class="wm-eyebrow">wm-primitives &middot; the house system</p>
    <h1 class="wm-stack"><span class="wm-l1">Six<i></i></span><span
      class="wm-l2">laws.</span><span class="wm-l3">Every<i></i></span><span
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
  <footer class="wm-foot">
    Built from the working pages, not screenshots &mdash; every demo here is live CSS, so the
    corners really are superellipses and the padding really is the token. Corner shapes need
    Chrome 148+; Safari falls back to plain radii, which is the intended degradation.
  </footer>
  </div>
</div>
<script>{js_parts}
{SPY}</script>{TAIL}
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
