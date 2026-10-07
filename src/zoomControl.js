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
 *   icon     (data-icon) the mark at the right end: pageview (default) | feature_search -- both
 *            have a FILL drawing, which the open state needs (frame_inspect has none).
 *            Pressed, it is the default view: back to 100.
 *   collapse (data-collapse) rest as that ONE mark and open leftwards out of it on press; the
 *            mark stays, filled (FILL 1), and pressing it again closes AND goes back to 100.
 *            Escape or a press outside closes and keeps the value. data-open="true" starts open;
 *            the open state is kept with the value.
 * Returns { el, get, set(v), destroy }.
 *
 * What it does (GESTURES.md §12):
 *   - renders zoom_out · the rail (dialHandle.css's hairline + lozenge, the % inside) · zoom_in
 *     · the mark. The rail is the slider: role=slider, aria-valuemin/max/now, label "Zoom".
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
    // the box is what grows: zoom_out, the rail, zoom_in, then THE MARK at the right end. The
    // mark is the default view: pressed, it goes back to 100. When the control collapses it is
    // also what it rests as -- the box shrinks to the mark alone, and opens leftwards out of it.
    const collapse = !!(opts.collapse ?? ('collapse' in ds));
    const box = mk('div', 'wm-zoom-box');
    const toggle = btn(opts.icon ?? ds.icon ?? 'pageview', 'Back to 100%', 'Back to 100% (0)');
    toggle.classList.add('wm-zoom-toggle');
    box.append(out, rail, into, toggle);
    el.replaceChildren(box);

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

    let value = 100, open = !collapse;
    // one key for both: "170", or "170 open" / "170 closed" when the control collapses -- a
    // reader that only wants the number still gets it from parseFloat
    const store = () => { try { localStorage.setItem(key, String(value) + (collapse ? (open ? ' open' : ' closed') : '')); } catch { /* private mode */ } };
    const set = (v, save = true) => {
      v = snap(Number(v));
      if (!Number.isFinite(v)) return;
      value = v;
      read.textContent = fmt(v);
      rail.setAttribute('aria-valuenow', String(v));
      rail.setAttribute('aria-valuetext', fmt(v));
      pill.style.setProperty('--p', String((v - min) / (max - min)));   // dialHandle.css declares --p on the pill
      zoomTarget(v / 100);
      if (save) store();
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
    // OPEN AND CLOSE: THREE MAGNIFIERS OUT OF A BOX (Mark, 2026-10-07: "three magnifying glasses
    // animating out of a box, one goes back into the button with a fill, the last two lead to
    // the extremes and the 100% pill pulls out of a rule"). The layout jumps to its end state at
    // once; everything that moves is transform and opacity, on the Web Animations API, so the
    // whole open is one seekable timeline of 600ms (2.5 x --dur-med):
    //     0-120   three small magnifiers (search, zoom_out, zoom_in) rise out of the mark, overlapping
    //   120-300   search goes back into the box, and the mark fills (FILL 0 -> 1)
    //    60-420   zoom_out flies left to the far end, crossfading into the real button on arrival
    //   100-380   zoom_in flies to the near end (left of the mark), likewise
    //   120-420   the hairline draws leftwards between them (scaleX from the right)
    //   360-480   the lozenge pulls out of the rule at 100%: a thickened stretch of the hairline
    //             that inflates to the lozenge, its readout fading in
    //   480-600   it slides to the saved value, if that is not 100
    // Closing is its own single beat (below). Reduced motion: the states, swapped.
    const parts = [out, rail, into];
    const paint = () => {
      el.dataset.open = String(open);
      if (!collapse) return;
      toggle.setAttribute('aria-expanded', String(open));
      const label = open ? 'Close zoom, back to 100%' : 'Zoom';
      toggle.setAttribute('aria-label', label); toggle.title = label;
      parts.forEach(p => { p.inert = !open; });
    };
    const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';   // the case study tester's unlock curve; motion.css holds durations, no easings
    let morph = [], fly = [];
    const stop = () => { morph.forEach(a => a.cancel()); morph = []; fly.forEach(f => f.remove()); fly = []; delete el.dataset.moving; };
    const choreograph = () => {
      const beat = parseFloat(getComputedStyle(el).getPropertyValue('--dur-med')) || 240;
      const total = 2.5 * beat, at = ms => Math.min(1, Math.max(0, ms / 600));   // the script below is written in 600ths
      const k = { duration: total, fill: 'both' };
      const B = box.getBoundingClientRect(), c = e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2 - B.left, r.top + r.height / 2 - B.top]; };
      const markIcon = toggle.querySelector('.wm-icon');
      const [mx, my] = c(markIcon), [ox, oy] = c(out.querySelector('.wm-icon')), [ix, iy] = c(into.querySelector('.wm-icon'));
      const flyer = name => { const f = mk('span', 'wm-icon wm-zoom-fly'); f.textContent = name; f.setAttribute('aria-hidden', 'true'); f.setAttribute('translate', 'no');
        f.style.left = mx + 'px'; f.style.top = my + 'px'; box.appendChild(f); fly.push(f); return f; };
      const T = (x, y, s = 1) => `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${s})`;
      const anims = [];
      // the one that goes back into the box
      anims.push(flyer('search').animate([
        { transform: T(0, 0, .3), opacity: 0, offset: 0, easing: EASE },
        { transform: T(-3, -9, .7), opacity: 1, offset: at(120), easing: EASE },
        { transform: T(0, 0, .2), opacity: 0, offset: at(260) },
        { transform: T(0, 0, .2), opacity: 0, offset: 1 },
      ], k));
      // the two that lead to the extremes, landing on the real buttons
      const travel = (name, [tx, ty], start, arrive, btn) => {
        const dx = tx - mx, dy = ty - my, spread = name === 'zoom_out' ? -8 : 4;
        anims.push(flyer(name).animate([
          { transform: T(0, 0, .3), opacity: 0, offset: 0 },
          { transform: T(0, 0, .3), opacity: 0, offset: at(start), easing: EASE },
          { transform: T(spread, -8, .7), opacity: 1, offset: at(start + 80), easing: EASE },
          { transform: T(dx, dy, 1), opacity: 1, offset: at(arrive), easing: 'ease-out' },
          { transform: T(dx, dy, 1), opacity: 0, offset: at(arrive + 60) },
          { transform: T(dx, dy, 1), opacity: 0, offset: 1 },
        ], k));
        anims.push(btn.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: at(arrive) }, { opacity: 1, offset: at(arrive + 60) }, { opacity: 1, offset: 1 }], k));
      };
      travel('zoom_out', [ox, oy], 60, 420, out);
      travel('zoom_in', [ix, iy], 100, 380, into);
      // the mark fills as the first one lands back in it
      const fvs = getComputedStyle(markIcon).fontVariationSettings, fill = n => fvs.replace(/"FILL" [\d.]+/, `"FILL" ${n}`);
      anims.push(markIcon.animate([{ fontVariationSettings: fill(0), offset: 0 }, { fontVariationSettings: fill(0), offset: at(160) }, { fontVariationSettings: fill(1), offset: at(300) }, { fontVariationSettings: fill(1), offset: 1 }], k));
      // the rule draws leftwards between them
      const rule = { transformOrigin: '100% 50%' };
      anims.push(rail.querySelector('i').animate([
        { ...rule, transform: 'scaleX(0)', offset: 0 }, { ...rule, transform: 'scaleX(0)', offset: at(120), easing: EASE },
        { ...rule, transform: 'scaleX(1)', offset: at(420) }, { ...rule, transform: 'scaleX(1)', offset: 1 },
      ], k));
      // the lozenge pulls out of the rule at 100, then slides to the value
      const r = rail.getBoundingClientRect(), pr = pill.getBoundingClientRect();
      const inset = pr.width / 2, span = Math.max(1, r.width - 2 * inset);
      const d100 = span * ((100 - min) / (max - min) - (value - min) / (max - min));
      const P = (x, sx, sy) => `translate(calc(-50% + ${x}px), -50%) scale(${sx}, ${sy})`;
      const thin = 3 / pr.height;
      anims.push(pill.animate([
        { transform: P(d100, .6, thin), opacity: 0, offset: 0 },
        { transform: P(d100, .6, thin), opacity: 0, offset: at(340) },
        { transform: P(d100, .6, thin), opacity: 1, offset: at(360), easing: EASE },
        { transform: P(d100, 1, 1), opacity: 1, offset: at(480), easing: EASE },
        { transform: P(0, 1, 1), opacity: 1, offset: 1 },
      ], k));
      anims.push(read.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: at(420) }, { opacity: 1, offset: at(500) }, { opacity: 1, offset: 1 }], k));
      return anims;
    };
    // CLOSE is one beat (--dur-med), not the open backwards: the two end magnifiers lift off
    // their buttons and fly back into the mark while the rule retracts and the lozenge fades
    // under them, and the mark unfills as they arrive.
    const closing = () => {
      const beat = parseFloat(getComputedStyle(el).getPropertyValue('--dur-med')) || 240;
      const k = { duration: beat, fill: 'both' };
      const B = box.getBoundingClientRect(), c = e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2 - B.left, r.top + r.height / 2 - B.top]; };
      const markIcon = toggle.querySelector('.wm-icon');
      const [mx, my] = c(markIcon);
      const T = (x, y, s = 1) => `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${s})`;
      const anims = [];
      for (const [btn, lag] of [[out, 0], [into, .12]]) {
        const ic = btn.querySelector('.wm-icon'), [x, y] = c(ic);
        const f = mk('span', 'wm-icon wm-zoom-fly'); f.textContent = ic.textContent; f.setAttribute('aria-hidden', 'true');
        f.style.left = mx + 'px'; f.style.top = my + 'px'; box.appendChild(f); fly.push(f);
        anims.push(f.animate([
          { transform: T(x - mx, y - my), opacity: 1, offset: 0 },
          { transform: T(x - mx, y - my - 4), opacity: 1, offset: lag, easing: 'ease-in-out' },
          { transform: T((x - mx) * .2, y - my - 6, .85), opacity: 1, offset: .7, easing: 'ease-in' },
          { transform: T(0, 0, .3), opacity: 1, offset: .9 },
          { transform: T(0, 0, .2), opacity: 0, offset: 1 },
        ], k));
        anims.push(btn.animate([{ opacity: 0 }, { opacity: 0 }], k));
      }
      anims.push(rail.querySelector('i').animate([{ transform: 'scaleX(1)', transformOrigin: '100% 50%', easing: EASE }, { transform: 'scaleX(0)', transformOrigin: '100% 50%' }], k));
      anims.push(pill.animate([{ opacity: 1 }, { opacity: 0, offset: .5 }, { opacity: 0 }], k));
      const fvs = getComputedStyle(markIcon).fontVariationSettings, fill = n => fvs.replace(/"FILL" [\d.]+/, `"FILL" ${n}`);
      anims.push(markIcon.animate([{ fontVariationSettings: fill(1), offset: 0 }, { fontVariationSettings: fill(1), offset: .7 }, { fontVariationSettings: fill(0), offset: 1 }], k));
      return anims;
    };
    const setOpen = (o, { animate = true, save = true } = {}) => {
      if (!collapse || o === open && !morph.length) return;
      const still = !animate || matchMedia('(prefers-reduced-motion: reduce)').matches;
      stop();
      if (save) { const was = open; open = o; store(); open = was; }
      el.dispatchEvent(new CustomEvent('wm-zoom-open', { detail: o, bubbles: true }));
      const land = () => { stop(); open = o; paint(); };
      if (still) { land(); return; }
      if (o) { open = true; paint(); }                    // opening: the end layout at once
      else parts.forEach(p => { p.inert = true; });       // closing: the layout holds until it lands
      el.dataset.moving = '';
      morph = o ? choreograph() : closing();
      const mine = morph;
      Promise.all(mine.map(a => a.finished)).then(() => { if (morph === mine) land(); }, () => {});
    };
    // the mark: shut, it opens; open, it closes AND goes back to 100 (the default view);
    // never collapsing, it only goes back to 100. Escape and a press outside close and keep.
    toggle.addEventListener('click', () => {
      if (collapse && !open) { setOpen(true); rail.focus({ preventScroll: true }); return; }
      set(100);
      if (collapse) setOpen(false);
    });
    el.addEventListener('keydown', e => { if (e.key === 'Escape' && open && collapse) { setOpen(false); toggle.focus({ preventScroll: true }); e.preventDefault(); } });
    const outside = e => { if (open && collapse && !el.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);

    const resize = () => { if (targets.length && value !== 100) { base = null; zoomTarget(value / 100); } };
    window.addEventListener('resize', resize);

    const api = {
      el, local, step,
      get: () => value,
      set: v => set(v),
      isOpen: () => open,
      morph: () => morph,   // the running timeline, for a test or a frame grab
      setOpen: o => setOpen(!!o),
      destroy: () => {
        document.removeEventListener('pointerdown', outside); stop();
        window.removeEventListener('resize', resize); window.removeEventListener('pointerup', end); window.removeEventListener('blur', end);
        clear();
        live.delete(api); el.replaceChildren(); delete el.__wmZoom;
      },
    };
    el.__wmZoom = api;
    live.add(api);

    let start = num(opts.value, ds.value, 100);
    let o0 = collapse ? (opts.open ?? ds.open) === true || (opts.open ?? ds.open) === 'true' : true;
    try {
      const raw = localStorage.getItem(key) ?? '', s = parseFloat(raw);
      if (Number.isFinite(s)) start = s;
      if (collapse && /\b(open|closed)\b/.test(raw)) o0 = /\bopen\b/.test(raw);
    } catch { /* private mode */ }
    open = o0; paint();
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
