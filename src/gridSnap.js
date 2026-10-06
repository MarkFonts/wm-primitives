/* gridSnap.js -- puts every text baseline inside a .wm-lines root on its --bl line, after layout.
 *
 * grid.css does what CSS can: leadings in whole units, and a per-face nudge that lands a
 * block's baselines on the line when its BOX starts on one. What CSS cannot know is where a
 * box starts after an image, an embed, a cube or a 1px rule -- anything in the flow whose
 * height is not in units. This measures each text block's first rendered baseline and sets
 * --snap on it to the remainder (0 <= snap < --bl), which grid.css adds to the block's `top`:
 * the glyphs move down a fraction of a unit, the layout does not move at all, so nothing
 * below is disturbed and one pass is enough.
 *
 * A "text block" is an in-flow element with its own text (a direct, non-blank text node):
 * p, h1-h5, li, figcaption, a pill's label, a byline. Skipped: anything positioned
 * absolute/fixed/sticky, anything already relatively placed for its own reasons, and any
 * subtree marked [data-nosnap] -- an interactive demo with its own type keeps it. (A
 * --snap-unit: 1 component is the exception to "relatively placed": a row a host made
 * `relative` for a guide still moves whole, by the `top` this writes on it.)
 *
 * Plain script, no module, no dependency: <script src="shared/src/gridSnap.js" defer>.
 * In a .wm-baselines container, items in one row also share their first baseline -- or, for an
 * item marked data-baseline="last", meet it with their last line (below). Before that, a row of
 * side-by-side TEXT shares its lines: the larger lead takes the next multiple of the smaller
 * (the lead rule, below; data-lead="own" on a block keeps its own).
 * It reruns when fonts load, when a root resizes, and on window.wmGridSnap() -- call that
 * after a script of the page's own changes heights. Add ?grid to the URL to see the columns
 * and the lines drawn over the page. */
(() => {
  const BL = root => parseFloat(getComputedStyle(root).getPropertyValue('--bl')) || 3;
  // what grid.css already nudges (it writes `position: relative` and a `top` that includes --snap)
  const NUDGED = '.wm-lines :where(p, li, h1, h2, h3, h4, h5, figcaption, .t-display, .t-title, .t-lede, .t-ui, .t-label, .t-micro, [data-line])';
  const probe = document.createElement('span');
  probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';

  // The block's first line of text: a direct text node, or one inside inline children (a
  // specimen split into per-letter spans is still one line of type) -- but never through a
  // child that is a block of its own, which is measured as itself.
  function ownText(el) {
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { if (n.textContent.trim()) return n; continue; }
      if (n.nodeType !== 1) continue;
      const d = getComputedStyle(n).display;
      if (d === 'inline' || d === 'inline-block' || d === 'contents') { const t = ownText(n); if (t) return t; }
    }
    return null;
  }
  const refused = [], measured = [];
  const isUnitEl = el => getComputedStyle(el).getPropertyValue('--snap-unit').trim() === '1';
  const units_or_own = el => {
    if (isUnitEl(el)) { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => n.textContent.trim() ? 1 : 3 }); return w.nextNode(); }
    return ownText(el);
  };
  // A ROW of a .wm-baselines container: its children grouped by the BOX's top, before grid.css's
  // baseline nudge -- a column that is itself the text block carries the nudge as a relative
  // `top` (up to 2px, and unlike for unlike leads), which would otherwise split two columns that
  // start on one row (the Cal Sans hero at 1024px, line 1 three px apart). The lead rule and the
  // row rule both read rows from here.
  function rowsOf(box) {
    const rows = new Map();
    for (const child of box.children) {
      const r = child.getBoundingClientRect(); if (!r.height) continue;
      const cs = getComputedStyle(child);
      const key = Math.round(r.top - (cs.position === 'relative' ? parseFloat(cs.top) || 0 : 0));
      const row = [...rows.keys()].find(k => Math.abs(k - key) <= 1) ?? key;
      if (!rows.has(row)) rows.set(row, []);
      rows.get(row).push(child);
    }
    return [...rows.values()];
  }

  /* THE LEAD RULE (Mark 2026-10-06). The baseline grid is 3px and never changes. In a row of
     side-by-side text -- blocks in text roles (body, lede, title, display) that each wrap to more
     than one line -- the block with the larger lead takes the next multiple of the smaller
     block's lead, so every one of its lines lands on a line of the smaller text (the Cal Sans
     hero: a lede at 39 beside a sub at 27 goes to 54). Annotation roles (micro, label, ui) and
     one-line blocks are left alone: they keep their lead and share only the first baseline,
     which the row rule gives them. data-lead="own" on a block (or around it) keeps its lead.
     Where a row's leads cannot work (a 27 body beside a 24 caption would go to 48) the PAGE sets
     the token; this does not guess. It is a lead rule: the line stays 3px.

     A block's role is read from the tokens it resolves to: a .t-micro / .t-ui / .t-label block
     is an annotation, and so is any block whose leading is under body's (--lead-body, resolved
     in the root). Wrapping is its height over its leading. Line counts change with the width,
     so every pass first hands back what the last one set and counts again.

     The lead is written INLINE, as both `line-height` and `--lh`: inline beats any host rule
     that sets line-height on the block (a page's `.hero-lede { --lh: ... }` or a bare
     `line-height`), and --lh keeps grid.css's baseline nudge -- which is computed from --lh --
     in step with the leading actually used. What the host had inline is kept and restored. */
  // Lines are counted from the text, not the box: a grid item is stretched to its row's height,
  // so a one-line label beside a paragraph has a box three lines tall.
  function linesOf(el, lh) {
    const rg = document.createRange(); rg.selectNodeContents(el);
    const tops = [];
    for (const r of rg.getClientRects()) if (r.width && r.height && !tops.some(t => Math.abs(t - r.bottom) < lh / 2)) tops.push(r.bottom);
    return tops.length;
  }
  const ANNOTATION = '.t-micro, .t-ui, .t-label';
  const leadSet = new Map();   // element -> [its own inline line-height, its own inline --lh]
  function bodyLead(root) {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;visibility:hidden;height:0;padding:0;border:0;font-size:var(--type-body-size,1rem);line-height:var(--lead-body,24px)';
    root.appendChild(d); const v = parseFloat(getComputedStyle(d).lineHeight); d.remove();
    return v || 24;
  }
  function leadRule(root, blocks, bl) {
    for (const [el, [lh, v]] of leadSet) {
      if (!root.contains(el)) continue;
      el.style.lineHeight = lh; v ? el.style.setProperty('--lh', v) : el.style.removeProperty('--lh');
      leadSet.delete(el);
    }
    const boxes = root.querySelectorAll('.wm-baselines'); if (!boxes.length) return;
    const body = bodyLead(root), set = [];
    const text = el => {
      if (el.closest('[data-lead="own"]') || el.matches(ANNOTATION) || el.closest(ANNOTATION) || isUnitEl(el)) return 0;
      const lh = parseFloat(getComputedStyle(el).lineHeight);
      if (!lh || lh < body - 0.5) return 0;
      return linesOf(el, lh) > 1 ? lh : 0;
    };
    for (const box of boxes) for (const items of rowsOf(box)) {
      if (items.length < 2) continue;
      const found = items.map(child => blocks.filter(([el]) => child === el || child.contains(el)).map(([el]) => [el, text(el)]).filter(b => b[1]));
      if (found.filter(f => f.length).length < 2) continue;
      // each block answers to the smallest lead in the OTHER items of its row -- the text beside it
      found.forEach((mine, i) => {
        const others = found.filter((_, j) => j !== i).flat().map(b => b[1]);
        if (!others.length) return;
        const L = Math.min(...others);
        for (const [el, lh] of mine) {
          if (lh <= L + 0.01) continue;
          const k = lh / L; if (Math.abs(k - Math.round(k)) < 0.01) continue;
          set.push([el, Math.ceil(k) * L]);
        }
      });
    }
    for (const [el, lead] of set) {
      if (leadSet.has(el)) continue;
      leadSet.set(el, [el.style.lineHeight, el.style.getPropertyValue('--lh')]);
      const px = (Math.round(lead / bl) * bl) + 'px';
      el.style.lineHeight = px; el.style.setProperty('--lh', px);
    }
  }

  function snapRoot(root) {
    const bl = BL(root), top0 = root.getBoundingClientRect().top;
    const blocks = [], ys = new Map();
    // A COMPONENT moves as one: an element whose computed --snap-unit is 1 (a slider row, a
    // control with a track beside its words) is shifted whole, by its first line of text,
    // and nothing inside it is snapped on its own -- that would pull the words off the thumb.
    const isUnit = el => getComputedStyle(el).getPropertyValue('--snap-unit').trim() === '1'
      && !(el.parentElement && getComputedStyle(el.parentElement).getPropertyValue('--snap-unit').trim() === '1');
    const firstText = el => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => n.textContent.trim() ? 1 : 3 }); return w.nextNode(); };
    const units = [...root.querySelectorAll('*')].filter(isUnit);
    for (const el of root.querySelectorAll('*')) {
      // a stage, or a flagged screenshot (its box is cut to the window on purpose, below)
      if (el.closest('[data-nosnap], [data-shot]')) continue;
      if (units.some(u => u.contains(el))) {
        if (units.includes(el)) { const t = firstText(el); if (t) blocks.push([el, t]); }
        continue;
      }
      const cs = getComputedStyle(el);
      if (cs.display === 'inline' || cs.display === 'contents' || cs.display === 'none') continue;
      if (/absolute|fixed|sticky/.test(cs.position)) continue;
      // relatively placed for its own reasons (not by grid.css) -- leave it alone
      if (cs.position === 'relative' && !el.matches(NUDGED)) {
        if (!el.hasAttribute('data-snap')) continue;
      }
      const t = ownText(el);
      if (t) blocks.push([el, t]);
    }
    // A block inside another block travels with it: the outer one's shift moves its whole
    // subtree, so measuring the inner one too would shift it twice (a link's 56px ring, once).
    for (let i = blocks.length - 1; i >= 0; i--)
      if (blocks.some(([o], j) => j !== i && o !== blocks[i][0] && o.contains(blocks[i][0]))) blocks.splice(i, 1);
    // side-by-side text shares its lines (the lead rule, above) -- before anything is measured,
    // since a new leading moves everything below it
    leadRule(root, blocks, bl);
    // measure everything first, then write: no layout thrash, and writes cannot move reads
    const out = blocks.map(([el, t]) => {
      el.style.removeProperty('--snap');
      return [el, t];
    }).map(([el, t]) => {
      t.parentNode.insertBefore(probe, t);
      const y = probe.getBoundingClientRect().top - top0;
      probe.remove();
      ys.set(el, y);
      const m = ((y % bl) + bl) % bl;
      return [el, m < 0.02 || bl - m < 0.02 ? 0 : bl - m];
    });
    // ROWS SHARE A FIRST BASELINE. In a .wm-baselines container, children that sit in one
    // row (same box top) have their first text block moved so its baseline meets the lowest
    // first baseline in the row: a label beside its specimen, two columns of a hero, two cards.
    const delta = new Map(out);
    const firstOf = child => out.find(([el]) => child === el || child.contains(el));
    // the last line of a child's last text block: a probe after its last text node
    const lastOf = child => {
      const mine = out.filter(([el]) => child === el || child.contains(el));
      const [el] = mine[mine.length - 1];
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => n.textContent.trim() ? 1 : 3 });
      let t, last = null; while ((t = w.nextNode())) last = t;
      last.parentNode.insertBefore(probe, last.nextSibling);
      const y = probe.getBoundingClientRect().top - top0; probe.remove();
      return [el, y];
    };
    for (const box of root.querySelectorAll('.wm-baselines')) {
      const rows = [];
      for (const kids of rowsOf(box)) {
        const row = [];
        for (const child of kids) {
          const f = firstOf(child); if (!f) continue;
          // data-baseline="last": the item meets the row by its LAST line (a two-line caption
          // beside one big word ends on the word's baseline instead of hanging below it)
          if (child.getAttribute('data-baseline') === 'last') {
            const l = lastOf(child);
            row.push([child, l[0], l[1] + delta.get(l[0]), true]);
          } else row.push([child, f[0], ys.get(f[0]) + delta.get(f[0])]);
        }
        rows.push(row);
      }
      for (const items of rows) {
        if (items.length < 2) continue;
        // the row's line: the lowest FIRST baseline (a last-line item may need to move up to it)
        const firsts = items.filter(i => !i[3]).map(i => i[2]);
        const target = firsts.length ? Math.max(...firsts) : Math.max(...items.map(i => i[2]));
        // A REAL shift is at most the gap between two first lines' ascents -- less than the
        // bigger line's own size. More than that means the row matched the wrong text (a
        // slider label instead of the specimen above it once pushed a paragraph 212px), so it
        // is refused and reported: window.wmGridSnap.refused, which the CI check reads.
        const tgt = items.find(i => Math.abs(i[2] - target) < 0.02);
        const cap = tgt ? parseFloat(getComputedStyle(tgt[1]).fontSize) : 0;
        for (const [child, el, y] of items) {
          const extra = target - y; if (Math.abs(extra) < 0.02) continue;
          if (Math.abs(extra) > cap) {
            refused.push({ row: box, item: child, shift: +extra.toFixed(1), cap });
            console.warn('gridSnap: refused a ' + extra.toFixed(1) + 'px row shift (cap ' + cap + 'px)', child);
            continue;
          }
          // ONLY the block being aligned moves. Every other block in the item keeps the snap it
          // measured for itself -- it is on a line already. Moving the whole item put a card's
          // bottom-anchored text 3px (and once 45px) below its neighbour's (2026-10-02).
          delta.set(el, delta.get(el) + extra);
        }
      }
    }
    for (const [el] of out) measured.push(el);
    for (const [el, d] of delta) {
      if (Math.abs(d) < 0.02) continue;
      // A static one is made `relative`, tagged so the next pass knows that `relative` is ours.
      // One a host made `relative` itself (a unit row with a guide or a badge hung off it) is
      // already placed and still has to MOVE, so it gets the `top` too -- but not the tag, the
      // position was never ours. Absolute, fixed and sticky boxes are the host's and untouched.
      const pos = getComputedStyle(el).position;
      if (pos === 'static') { el.style.position = 'relative'; el.style.top = 'var(--snap)'; el.setAttribute('data-snap', ''); }
      else if (pos === 'relative' && !el.matches(NUDGED)) el.style.top = 'var(--snap)';
      else if (pos !== 'relative') continue;
      el.style.setProperty('--snap', d.toFixed(2) + 'px');
    }
  }
  /* MAC SHOTS. grid.css cuts a [data-shot="mac"] image's shadow out of the layout, and for
     that it needs the file's pixel width, which CSS cannot read. Written inline as --shot-w
     (its rules wait for it: [style*="--shot-w"]): the loaded image's naturalWidth, or until it
     loads the width attribute, then corrected on load -- so a page with width/height set lays
     out once, at DOMContentLoaded. A value the page set itself (inline, or in a stylesheet)
     is kept. On a <picture> the flag sits on the picture and its img inherits the width.
     Every pass looks again, so an app that renders its shots later is covered by wmGridSnap(). */
  const waiting = new WeakSet();
  function shots() {
    for (const el of document.querySelectorAll('[data-shot="mac"]')) {
      if (el.style.getPropertyValue('--shot-w')) continue;
      const own = getComputedStyle(el).getPropertyValue('--shot-w').trim();
      if (own) { el.style.setProperty('--shot-w', own); continue; }
      const m = el.matches('picture') ? el.querySelector('img') : el;
      if (!m) continue;
      const loaded = m.tagName === 'VIDEO' ? m.videoWidth : (m.complete && m.naturalWidth);
      const w = loaded || +m.getAttribute('width');
      if (w) el.style.setProperty('--shot-w', String(w));
      if (!loaded && !waiting.has(m)) waiting.add(m), m.addEventListener(m.tagName === 'VIDEO' ? 'loadedmetadata' : 'load', () => {
        const n = m.tagName === 'VIDEO' ? m.videoWidth : m.naturalWidth;
        if (n) { el.style.setProperty('--shot-w', String(n)); run(); }
      }, { once: true });
    }
  }
  let raf = 0;
  function run() { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { shots(); refused.length = 0; measured.length = 0; document.querySelectorAll('.wm-lines').forEach(snapRoot); }); }
  window.wmGridSnap = run;
  run.refused = refused;
  // what the last pass measured: every block it put on the line (the CI check reads this,
  // so it judges exactly the blocks the snapper judged, not a copy of the rules)
  run.blocks = measured;
  run.firstLine = el => units_or_own(el);
  // how many lines a block's text runs to, and the leads the lead rule set on the last pass: [element, px] (the CI check reads it)
  run.lines = linesOf;
  run.leads = () => [...leadSet.keys()].filter(e => e.isConnected).map(e => [e, parseFloat(e.style.lineHeight)]);
  run.shots = shots;

  /* ?grid on any page: the columns (pink) and the 3px lines (blue), drawn over each .wm-lines
     root -- a checking tool, never on by default. Lines are canvas at the screen's own pixel
     density, one device pixel each: a CSS gradient at a fractional zoom smears them. */
  function overlay() {
    const css = document.createElement('style');
    css.textContent = `.wm-ov{position:fixed;left:0;top:0;pointer-events:none;z-index:2147483646}
      .wm-ov-cols{position:fixed;inset:0;pointer-events:none;z-index:2147483646;display:grid;
        grid-template-columns:repeat(var(--grid-cols),minmax(0,1fr));column-gap:var(--grid-gutter);padding-inline:var(--grid-margin)}
      .wm-ov-cols>i{background:rgba(255,40,140,.06);border-inline:1px solid rgba(255,40,140,.4)}`;
    document.head.appendChild(css);
    const cols = document.createElement('div'); cols.className = 'wm-ov-cols'; document.body.appendChild(cols);
    // the margin of the first root, not the document's: a tool's .wm-grid--bleed on main or
    // body sets it to 0 below <html>, and the columns must be drawn where the page has them
    const drawCols = () => { const n = +getComputedStyle(document.documentElement).getPropertyValue('--grid-cols') || 24;
      const r0 = document.querySelector('.wm-lines');
      if (r0) cols.style.setProperty('--grid-margin', getComputedStyle(r0).getPropertyValue('--grid-margin').trim() || '0px');
      cols.innerHTML = '<i></i>'.repeat(n); };
    // ONE viewport-sized fixed canvas, redrawn on scroll. A canvas the height of the root went
    // blank past 65,535 device pixels (the system page is ~47,000 CSS px: blank at 2x), and a
    // page that tall is the page that needs the lines. Each root's lines are drawn where the
    // root's top is NOW, one every --bl from it, clipped to what is on screen.
    const c = document.createElement('canvas'); c.className = 'wm-ov';
    document.body.appendChild(c);
    const roots = [...document.querySelectorAll('.wm-lines')];
    const drawLines = () => {
      const dpr = devicePixelRatio || 1, vw = document.documentElement.clientWidth, vh = innerHeight;
      c.style.width = vw + 'px'; c.style.height = vh + 'px';
      if (c.width !== Math.round(vw * dpr) || c.height !== Math.round(vh * dpr)) { c.width = Math.round(vw * dpr); c.height = Math.round(vh * dpr); }
      const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.fillStyle = 'rgba(40,120,255,.45)';
      for (const root of roots) {
        const r = root.getBoundingClientRect(), bl = BL(root);
        const x0 = Math.max(0, r.left), x1 = Math.min(vw, r.right), y0 = Math.max(0, r.top), y1 = Math.min(vh, r.bottom);
        if (x1 <= x0 || y1 <= y0) continue;
        for (let k = Math.max(0, Math.ceil((y0 - r.top) / bl)); r.top + k * bl < y1; k++) {
          const y = Math.round((r.top + k * bl) * dpr) - 1;
          g.fillRect(Math.round(x0 * dpr), y, Math.round((x1 - x0) * dpr), 1);
        }
      }
    };
    let ovRaf = 0;
    const redraw = () => { cancelAnimationFrame(ovRaf); ovRaf = requestAnimationFrame(drawLines); };
    addEventListener('scroll', redraw, { passive: true });
    const draw = () => { drawCols(); drawLines(); };
    draw(); addEventListener('resize', draw); document.fonts && document.fonts.ready.then(draw);
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(document.body);
  }
  const start = () => {
    shots();   // now, not a frame later: a shot with a width attribute lays out once
    run();
    if (/[?&]grid\b/.test(location.search)) overlay();
    document.fonts && document.fonts.ready.then(run);
    if ('ResizeObserver' in window) { const ro = new ResizeObserver(run); document.querySelectorAll('.wm-lines').forEach(r => ro.observe(r)); }
    addEventListener('load', run);
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();
