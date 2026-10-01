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
 * It reruns when fonts load, when a root resizes, and on window.wmGridSnap() -- call that
 * after a script of the page's own changes heights. */
(() => {
  const BL = root => parseFloat(getComputedStyle(root).getPropertyValue('--bl')) || 3;
  const probe = document.createElement('span');
  probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';

  function ownText(el) {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return n;
    return null;
  }
  function snapRoot(root) {
    const bl = BL(root), top0 = root.getBoundingClientRect().top;
    const blocks = [];
    for (const el of root.querySelectorAll('*')) {
      if (el.closest('[data-nosnap]')) continue;
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
    // measure everything first, then write: no layout thrash, and writes cannot move reads
    const out = blocks.map(([el, t]) => {
      el.style.removeProperty('--snap');
      return [el, t];
    }).map(([el, t]) => {
      t.parentNode.insertBefore(probe, t);
      const y = probe.getBoundingClientRect().top - top0;
      probe.remove();
      const m = ((y % bl) + bl) % bl;
      return [el, m < 0.02 || bl - m < 0.02 ? 0 : bl - m];
    });
    for (const [el, d] of out) {
      if (!d) continue;
      if (getComputedStyle(el).position === 'static') { el.style.position = 'relative'; el.style.top = 'var(--snap)'; }
      el.style.setProperty('--snap', d.toFixed(2) + 'px');
    }
  }
  let raf = 0;
  function run() { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => document.querySelectorAll('.wm-lines').forEach(snapRoot)); }
  window.wmGridSnap = run;
  const start = () => {
    run();
    document.fonts && document.fonts.ready.then(run);
    if ('ResizeObserver' in window) { const ro = new ResizeObserver(run); document.querySelectorAll('.wm-lines').forEach(r => ro.observe(r)); }
    addEventListener('load', run);
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();
