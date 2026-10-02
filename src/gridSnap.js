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
 * subtree marked [data-nosnap] -- an interactive demo with its own type keeps it.
 *
 * Plain script, no module, no dependency: <script src="shared/src/gridSnap.js" defer>.
 * In a .wm-baselines container, items in one row also share their first baseline -- or, for an
 * item marked data-baseline="last", meet it with their last line (below).
 * It reruns when fonts load, when a root resizes, and on window.wmGridSnap() -- call that
 * after a script of the page's own changes heights. Add ?grid to the URL to see the columns
 * and the lines drawn over the page. */
(() => {
  const BL = root => parseFloat(getComputedStyle(root).getPropertyValue('--bl')) || 3;
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
      if (el.closest('[data-nosnap]')) continue;
      if (units.some(u => u.contains(el))) {
        if (units.includes(el)) { const t = firstText(el); if (t) blocks.push([el, t]); }
        continue;
      }
      const cs = getComputedStyle(el);
      if (cs.display === 'inline' || cs.display === 'contents' || cs.display === 'none') continue;
      if (/absolute|fixed|sticky/.test(cs.position)) continue;
      // relatively placed for its own reasons (not by grid.css) -- leave it alone
      if (cs.position === 'relative' && !el.matches('.wm-lines :where(p, li, h1, h2, h3, h4, h5, figcaption, .t-display, .t-title, .t-lede, .t-ui, .t-label, .t-micro, [data-line])')) {
        if (!el.hasAttribute('data-snap')) continue;
      }
      const t = ownText(el);
      if (t) blocks.push([el, t]);
    }
    // A block inside another block travels with it: the outer one's shift moves its whole
    // subtree, so measuring the inner one too would shift it twice (a link's 56px ring, once).
    for (let i = blocks.length - 1; i >= 0; i--)
      if (blocks.some(([o], j) => j !== i && o !== blocks[i][0] && o.contains(blocks[i][0]))) blocks.splice(i, 1);
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
      const rows = new Map();
      for (const child of box.children) {
        const r = child.getBoundingClientRect(); if (!r.height) continue;
        const f = firstOf(child); if (!f) continue;
        const key = Math.round(r.top);
        const row = [...rows.keys()].find(k => Math.abs(k - key) <= 1) ?? key;
        if (!rows.has(row)) rows.set(row, []);
        // data-baseline="last": the item meets the row by its LAST line (a two-line caption
        // beside one big word ends on the word's baseline instead of hanging below it)
        if (child.getAttribute('data-baseline') === 'last') {
          const l = lastOf(child);
          rows.get(row).push([child, l[0], l[1] + delta.get(l[0]), true]);
        } else rows.get(row).push([child, f[0], ys.get(f[0]) + delta.get(f[0])]);
      }
      for (const items of rows.values()) {
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
      // tagged, so the next pass knows this `relative` is ours and measures it again
      if (getComputedStyle(el).position === 'static') { el.style.position = 'relative'; el.style.top = 'var(--snap)'; el.setAttribute('data-snap', ''); }
      el.style.setProperty('--snap', d.toFixed(2) + 'px');
    }
  }
  let raf = 0;
  function run() { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { refused.length = 0; measured.length = 0; document.querySelectorAll('.wm-lines').forEach(snapRoot); }); }
  window.wmGridSnap = run;
  run.refused = refused;
  // what the last pass measured: every block it put on the line (the CI check reads this,
  // so it judges exactly the blocks the snapper judged, not a copy of the rules)
  run.blocks = measured;
  run.firstLine = el => units_or_own(el);

  /* ?grid on any page: the columns (pink) and the 3px lines (blue), drawn over each .wm-lines
     root -- a checking tool, never on by default. Lines are canvas at the screen's own pixel
     density, one device pixel each: a CSS gradient at a fractional zoom smears them. */
  function overlay() {
    const css = document.createElement('style');
    css.textContent = `.wm-ov{position:absolute;pointer-events:none;z-index:2147483646}
      .wm-ov-cols{position:fixed;inset:0;pointer-events:none;z-index:2147483646;display:grid;
        grid-template-columns:repeat(var(--grid-cols),minmax(0,1fr));column-gap:var(--grid-gutter);padding-inline:var(--grid-margin)}
      .wm-ov-cols>i{background:rgba(255,40,140,.06);border-inline:1px solid rgba(255,40,140,.4)}`;
    document.head.appendChild(css);
    const cols = document.createElement('div'); cols.className = 'wm-ov-cols'; document.body.appendChild(cols);
    const drawCols = () => { const n = +getComputedStyle(document.documentElement).getPropertyValue('--grid-cols') || 24;
      cols.innerHTML = '<i></i>'.repeat(n); };
    const canv = [...document.querySelectorAll('.wm-lines')].map(root => { const c = document.createElement('canvas'); c.className = 'wm-ov'; document.body.appendChild(c); return [root, c]; });
    const drawLines = () => canv.forEach(([root, c]) => {
      const r = root.getBoundingClientRect(), dpr = devicePixelRatio || 1, bl = BL(root);
      Object.assign(c.style, { left: r.left + scrollX + 'px', top: r.top + scrollY + 'px', width: r.width + 'px', height: r.height + 'px' });
      c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
      const g = c.getContext('2d'); g.fillStyle = 'rgba(40,120,255,.45)';
      for (let y = 0; y * dpr < c.height; y += bl) g.fillRect(0, Math.round(y * dpr) - 1, c.width, 1);
    });
    const draw = () => { drawCols(); drawLines(); };
    draw(); addEventListener('resize', draw); document.fonts && document.fonts.ready.then(draw);
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(document.body);
  }
  const start = () => {
    run();
    if (/[?&]grid\b/.test(location.search)) overlay();
    document.fonts && document.fonts.ready.then(run);
    if ('ResizeObserver' in window) { const ro = new ResizeObserver(run); document.querySelectorAll('.wm-lines').forEach(r => ro.observe(r)); }
    addEventListener('load', run);
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();
