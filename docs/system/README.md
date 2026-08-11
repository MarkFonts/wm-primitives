# The system page

The illustrated view of wm-primitives — type, corners, circles, space, and color — as one
long-form document. Published by GitHub Pages from `docs/`:

**https://markfonts.github.io/wm-primitives/**

## The rules live in code, not here

This page *illustrates* the rules. It does not define them. The authoritative copies are:

| rule | where it is enforced |
| --- | --- |
| type roles, inks, signals | `src/type.css`, `TYPOGRAPHY.md` |
| the corner law, circle exclusions | `src/corners.css` |
| the `--pad-*` scale, cap rule, alignment rule | `src/space.css` |

If the page and the CSS disagree, **the CSS is right** — it ships, gets diffed, and is what
the apps actually load. Fix the page.

## Rebuilding

```bash
python3 docs/system/build.py --linked      # -> docs/index.html, fonts referenced
python3 docs/system/build.py               # -> wm-system.html, fonts embedded as data URIs
```

`--linked` is the Pages build: it points `@font-face` at `docs/fonts/` so the HTML stays
~640KB and a rebuild is a small diff. The default build inlines both faces as data URIs and
produces one self-contained ~3.9MB file — that form exists because a published Claude
Artifact runs under a CSP that blocks every external host, fonts included, so a linked font
there fails silently and the page drops to system-ui.

## How it is assembled

`pages/` holds the six source documents, each of which was originally a standalone page.
They are gathered, not rewritten. Each one keeps its own CSS, markup, and behaviour; the
build makes them coexist:

- every `@font-face` is stripped and the faces are declared **once** for the document
- each page's CSS is scoped to its section id, so six pages that all style `.card`, `body`
  and `*` stop fighting
- ids are prefixed and each script is rebound to its own section root

Three things it has to handle, each of which broke silently once:

1. **CSS comments are stripped before scoping.** The rule splitter treats everything up to
   `{` as the selector, so a comment above a rule joined its prelude, `:root` stopped
   comparing equal to `:root`, and the rule shipped as `#s-x /*…*/ :root` — matching
   nothing. That silently emptied every commented `:root`/`body`/`*` rule.
2. **CDATA markers are removed.** SVG `<style>` is `<![CDATA[…]]>` wrapped, which is legal
   in SVG and invalid in an HTML `<style>`; the parser stops dead there and drops every
   following rule.
3. **Qualified roots are hoisted, not scoped.** `:root[data-theme="dark"]`, `body.past-app`
   and `body[data-force="on"]` are stamped on the real root by a theme toggle or a script,
   so the qualifier stays on `:root`/`body` and the scope is appended after it.

## Working on this from another session

Everything needed is in this repo — clone it and rebuild; nothing depends on a scratchpad.

```bash
git clone https://github.com/MarkFonts/wm-primitives.git
cd wm-primitives
python3 -m http.server 8795 --directory docs    # then open http://127.0.0.1:8795
```

Edit the source in `docs/system/pages/`, re-run the build, and check the result before
committing — the failure modes above are all invisible in the source and only show up in
the rendered page. Useful checks: every `var()` resolves (a dropped rule leaves
`border-radius: 0`, and `corner-shape` is a no-op without a radius), the GEOM map paints in
color rather than black, and no request 404s.
