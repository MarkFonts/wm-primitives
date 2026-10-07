/* zoomControl.js -- the zoom control. Plain script, no React, like dialHandle.js.
 *
 *   <div class="wm-zoom" data-target="#page" data-min="50" data-max="400" data-step="10"></div>
 *
 * Every .wm-zoom in the document at DOMContentLoaded is mounted; one rendered later (React)
 * is mounted by the host with wmZoom.mount(el, opts?) -- idempotent, opts override data-*:
 *   target   selector, element or list the zoom is applied to (none: the control only emits).
 *            A selector may match several boxes -- the blocks under a sticky header that holds
 *            the control, say -- and each is zoomed and anchored on its own
 *   min / max / step   percent, default 50 / 400 / 10; the value snaps to step from min
 *   key      localStorage key (data-key), default 'wm-zoom'
 *   keys     'local' (data-keys="local"): + − 0 only while focus is inside this control
 *   value    the start value when nothing is stored, default 100
 * Returns { el, get, set(v), destroy }.
 *
 * What it does (GESTURES.md §12):
 *   - renders zoom_out · the rail (dialHandle.css's hairline + lozenge, the % inside) · zoom_in
 *     · fit_screen. The rail is the slider: role=slider, aria-valuemin/max/now, label "Zoom".
 *   - applies CSS `zoom` to the target, anchored top-left: the target keeps its 100% width and
 *     left edge, so it grows right and down, the page scrolls, nothing reflows, and the type is
 *     re-rasterised at the new size rather than scaled as a bitmap. (A <canvas> inside the
 *     target is the exception: its bitmap is scaled. Redraw it at canvas.currentCSSZoom on
 *     the event below.)
 *   - + / = in, − / - out, 0 back to 100 -- while focus is in the control, or anywhere on the
 *     page that is not a field. Never with Cmd/Ctrl/Alt: those are the browser's own zoom.
 *   - stores the value under the key, in try/catch (private mode, a sandboxed frame).
 *   - fires `wm-zoom` on the control (bubbling) with detail = the percent, on every change and
 *     once at mount.
 *
 * The control owns the target's inline zoom, width and margin-inline while it is not at 100%. */
(() => {
  const mk = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const field = t => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  const live = new Set();

  function mount(el, opts = {}) {
    if (el.__wmZoom) return el.__wmZoom;
    const ds = el.dataset;
    const num = (a, b, d) => { const n = parseFloat(a ?? b); return Number.isFinite(n) ? n : d; };
    const min = num(opts.min, ds.min, 50), max = num(opts.max, ds.max, 400), step = num(opts.step, ds.step, 10);
    const key = opts.key ?? ds.key ?? 'wm-zoom';
    const local = (opts.keys ?? ds.keys) === 'local';
    const target = opts.target ?? ds.target ?? null;
    const targets = typeof target === 'string' ? [...document.querySelectorAll(target)]
      : !target ? [] : target instanceof Element ? [target] : [...target];
    const snap = v => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
    const fmt = v => v + '%';

    el.setAttribute('role', 'group');
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Zoom');
    const btn = (icon, label, title) => {
      const b = mk('button', 'wm-icon-btn'); b.type = 'button';
      b.setAttribute('aria-label', label); b.title = title;
      const m = mk('span', 'wm-icon'); m.textContent = icon;
      m.setAttribute('aria-hidden', 'true'); m.setAttribute('translate', 'no');
      b.appendChild(m); return b;
    };
    const out = btn('zoom_out', 'Zoom out', 'Zoom out (−)');
    const into = btn('zoom_in', 'Zoom in', 'Zoom in (+)');
    const fit = btn('fit_screen', 'Back to 100%', 'Back to 100% (0)');
    const rail = mk('div', 'wm-hd-rail');
    const pill = mk('span', 'wm-hd-pill');
    const read = mk('output');
    pill.appendChild(read);
    rail.append(mk('i'), pill);
    rail.tabIndex = 0;
    rail.setAttribute('role', 'slider');
    rail.setAttribute('aria-label', 'Zoom');
    rail.setAttribute('aria-valuemin', String(min));
    rail.setAttribute('aria-valuemax', String(max));
    el.replaceChildren(out, rail, into, fit);

    // the target, anchored top-left: its 100% width and left margin, measured with the zoom off
    let base = null;
    const clear = () => targets.forEach(t => { const s = t.style; s.zoom = ''; s.width = ''; s.marginLeft = ''; s.marginRight = ''; });
    const measure = () => { clear(); base = targets.map(t => { const cs = getComputedStyle(t); return { w: cs.width, ml: parseFloat(cs.marginLeft) || 0 }; }); };
    const zoomTarget = z => {
      if (!targets.length) return;
      if (z === 1) { clear(); base = null; return; }
      if (!base) measure();
      targets.forEach((t, i) => {
        const s = t.style, b = base[i];
        s.zoom = String(z);
        s.width = b.w;                    // a length on a zoomed box is drawn x z: the 100% line, grown
        s.marginLeft = b.ml / z + 'px';   // ... so the left edge is divided back to where it was
        s.marginRight = '0';
      });
    };

    let value = 100;
    const set = (v, save = true) => {
      v = snap(Number(v));
      if (!Number.isFinite(v)) return;
      value = v;
      read.textContent = fmt(v);
      rail.setAttribute('aria-valuenow', String(v));
      rail.setAttribute('aria-valuetext', fmt(v));
      pill.style.setProperty('--p', String((v - min) / (max - min)));   // dialHandle.css declares --p on the pill
      zoomTarget(v / 100);
      if (save) { try { localStorage.setItem(key, String(v)); } catch { /* private mode */ } }
      el.dispatchEvent(new CustomEvent('wm-zoom', { detail: v, bubbles: true }));
    };

    // the lozenge is one width: its widest value, measured in the face it is drawn in; the
    // hairline and the travel stop half of it from each end
    const size = () => {
      read.style.minInlineSize = '';
      const now = read.textContent; let w = 0;
      for (const v of [min, max, 100]) { read.textContent = fmt(v); w = Math.max(w, read.getBoundingClientRect().width); }
      read.textContent = now;
      read.style.minInlineSize = w + 'px';
      rail.style.setProperty('--hd-inset', pill.getBoundingClientRect().width / 2 + 'px');
    };

    // the rail: a press on the lozenge grabs it where it is (no jump); a press elsewhere jumps
    // there; either way the value follows until lift. Capture released from three places, as
    // in dialHandle.js. No wheel (GESTURES.md G33).
    let grab = null;
    const at = x => {
      const r = rail.getBoundingClientRect(), inset = pill.getBoundingClientRect().width / 2;
      return min + ((x - r.left - inset) / Math.max(1, r.width - 2 * inset)) * (max - min);
    };
    rail.addEventListener('pointerdown', e => {
      const p = pill.getBoundingClientRect();
      grab = e.clientX >= p.left && e.clientX <= p.right ? e.clientX - (p.left + p.width / 2) : 0;
      set(at(e.clientX - grab));
      try { rail.setPointerCapture(e.pointerId); } catch {}
      rail.focus({ preventScroll: true });
      e.preventDefault();
    });
    rail.addEventListener('pointermove', e => { if (grab !== null) { const v = snap(at(e.clientX - grab)); if (v !== value) set(v); } });
    const end = () => { grab = null; };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => rail.addEventListener(ev, end));
    window.addEventListener('pointerup', end);
    window.addEventListener('blur', end);
    rail.addEventListener('keydown', e => {
      const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
      if (d !== undefined) set(value + d * step);
      else if (e.key === 'Home') set(min);
      else if (e.key === 'End') set(max);
      else return;
      e.preventDefault();
    });

    out.addEventListener('click', () => set(value - step));
    into.addEventListener('click', () => set(value + step));
    fit.addEventListener('click', () => set(100));
    const resize = () => { if (targets.length && value !== 100) { base = null; zoomTarget(value / 100); } };
    window.addEventListener('resize', resize);

    const api = {
      el, local, step,
      get: () => value,
      set: v => set(v),
      destroy: () => {
        window.removeEventListener('resize', resize); window.removeEventListener('pointerup', end); window.removeEventListener('blur', end);
        clear();
        live.delete(api); el.replaceChildren(); delete el.__wmZoom;
      },
    };
    el.__wmZoom = api;
    live.add(api);

    let start = num(opts.value, ds.value, 100);
    try { const s = parseFloat(localStorage.getItem(key)); if (Number.isFinite(s)) start = s; } catch { /* private mode */ }
    set(start, false);
    size();
    if (document.fonts) document.fonts.ready.then(() => { if (el.__wmZoom === api) size(); });
    return api;
  }

  // + − 0: the control that holds focus, else the first page-level one. Not in a field, and
  // never with a modifier -- Cmd/Ctrl + and − are the browser's zoom, and stay so.
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || field(e.target)) return;
    const d = { '+': 1, '=': 1, '-': -1, '_': -1, '−': -1, '0': 0 }[e.key];
    if (d === undefined) return;
    let c = null;
    for (const z of live) if (z.el.contains(document.activeElement)) { c = z; break; }
    if (!c) for (const z of live) if (!z.local) { c = z; break; }
    if (!c) return;
    c.set(d === 0 ? 100 : c.get() + d * c.step);
    e.preventDefault();
  });

  const auto = () => document.querySelectorAll('.wm-zoom').forEach(el => mount(el));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();
  window.wmZoom = { mount };
})();
