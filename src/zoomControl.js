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
 *            have a FILL drawing (frame_inspect has none). Filled while open, and at rest whenever
 *            the zoom is not 100, so a zoomed page is never mistaken for one at its own size.
 *   capture  (data-capture) take over the browser's own zoom while the pointer is over the
 *            target (or a selector given as the value), or focus is inside it: a trackpad pinch
 *            (ctrl+wheel; Safari's gesture events) and Cmd/Ctrl + - 0 drive this control instead,
 *            opening it if it is shut. Off by default. GESTURES.md G72-G74.
 *            Pressed, it is the default view: back to 100.
 *   fit      (data-fit, here or on the enclosing .wm-theme-stack) .wm-zoom--down only: a selector
 *            for the box the open control ends 12px inside -- the lowest match; default the
 *            stack's data-scroller box, else the viewport. GESTURES.md G83.
 *   .wm-zoom--down  (class) the rail runs DOWN from the mark, max at the top: the vertical
 *            theme stack's zoom (zoomControl.css). The rail, the rule's stretch
 *            and the lozenge's slide go on the block axis; the lozenge's count does not rotate.
 *   collapse (data-collapse) rest as that ONE mark and open leftwards out of it on press; the
 *            mark stays, filled, and pressing it again closes it. Closing never changes the zoom:
 *            the reset is a press on the lozenge (or 0). Shut at a zoom other than 100, the value
 *            stays on show left of the mark. Escape or a press outside closes too.
 *            data-open="true" starts open; the open state is kept with the value.
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
  // THE CURVE: motion.css's --ease, read where the control sits, as --dur-med is; the literal is
  // for a host that has not loaded motion.css.
  const easeOf = el => getComputedStyle(el).getPropertyValue('--ease').trim() || 'cubic-bezier(0.2, 0.7, 0.2, 1)';

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
    // .wm-zoom--down: the rail is vertical, max at the top. Every along-the-rail measure below
    // goes through these: the pointer's coordinate, a rect's start / length on the axis.
    const down = el.classList.contains('wm-zoom--down');
    const along = e => down ? e.clientY : e.clientX;
    const lo = r => down ? r.top : r.left, len = r => down ? r.height : r.width;
    const shift = d => down ? `translate(-50%, calc(-50% + ${d}px))` : `translate(calc(-50% + ${d}px), -50%)`;

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
    if (down) rail.setAttribute('aria-orientation', 'vertical');
    // the box is what grows: zoom_out, the rail, zoom_in, then THE MARK at the right end. The
    // mark is the default view: pressed, it goes back to 100. When the control collapses it is
    // also what it rests as -- the box shrinks to the mark alone, and opens leftwards out of it.
    const collapse = !!(opts.collapse ?? ('collapse' in ds));
    const box = mk('div', 'wm-zoom-box');
    const toggle = btn(opts.icon ?? ds.icon ?? 'pageview', 'Back to 100%', 'Back to 100% (0)');   // relabelled by paint() when it collapses
    toggle.classList.add('wm-zoom-toggle');
    box.append(out, rail, into, toggle);
    // shut at a zoom other than 100, the value stays on show beside the mark (no pill)
    const note = mk('span', 'wm-zoom-note');
    note.setAttribute('aria-hidden', 'true');
    el.replaceChildren(box);
    if (collapse) el.appendChild(note);

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
      note.textContent = fmt(v);
      el.toggleAttribute('data-zoomed', v !== 100);
      rail.setAttribute('aria-valuenow', String(v));
      rail.setAttribute('aria-valuetext', fmt(v));
      pill.style.setProperty('--p', String((v - min) / (max - min)));   // dialHandle.css declares --p on the pill
      zoomTarget(v / 100);
      if (save) store();
      el.dispatchEvent(new CustomEvent('wm-zoom', { detail: v, bubbles: true }));
    };

    // THE RESET, animated: the lozenge slides home to 100 over --dur-med while the readout counts
    // down (or up) to it a step at a time. Reduced motion, a hidden page, or a shut control: at once.
    let counting = 0, slide = null;
    const reset = () => {
      if (value === 100) return;
      const from = value, still = document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches || !open;
      const x0 = lo(pill.getBoundingClientRect());
      set(100);
      // THE RECEIPT (GESTURES.md G89): the lozenge blinks its fill -- if confirm.js is loaded, and
      // only when it is on show. A shut control's reset shows on the note (G73), not here.
      if (open) window.wmConfirm?.(pill);
      if (still) return;
      const dx = x0 - lo(pill.getBoundingClientRect());
      const dur = parseFloat(getComputedStyle(el).getPropertyValue('--dur-med')) || 240;
      slide?.cancel();
      slide = pill.animate([{ transform: shift(dx) }, { transform: 'translate(-50%, -50%)' }], { duration: dur, easing: easeOf(el) });
      cancelAnimationFrame(counting);
      const t0 = performance.now(), n = Math.abs(from - 100) / step;
      const tick = now => {
        const k = Math.min(1, (now - t0) / dur), eased = 1 - Math.pow(1 - k, 3);
        read.textContent = fmt(Math.round((from + (100 - from) * eased) / step) * step);   // display only: the value is already 100
        if (k < 1 && n > 1) counting = requestAnimationFrame(tick); else read.textContent = fmt(value);
      };
      counting = requestAnimationFrame(tick);
    };

    // the lozenge is one width: its widest value, measured in the face it is drawn in; the
    // hairline and the travel stop half of it from each end
    const size = () => {
      read.style.minInlineSize = '';
      const now = read.textContent; let w = 0;
      for (const v of [min, max, 100]) { read.textContent = fmt(v); w = Math.max(w, read.getBoundingClientRect().width); }
      read.textContent = now;
      read.style.minInlineSize = w + 'px';
      rail.style.setProperty('--hd-inset', len(pill.getBoundingClientRect()) / 2 + 'px');
      fit();
    };
    // .wm-zoom--down only (G79): the glasses and the rail stay on the mark's axis; the lozenge is
    // centred on it unless that would cross the viewport's right edge (its 3px ring included),
    // when it ALONE moves inward by the least that keeps it on screen (an inline margin, so the
    // morph's transforms are untouched); and the rail is --zoom-rail at most, shortened to what
    // the viewport -- and the stack's data-scroller, if named -- has under the open box less 12px, on the 3px line, down to the floor: 45px, the least at which the lozenge (21px) still travels min to max with the glasses clear of its ring. A host's --zoom-rail is the nominal, honoured as-is, the floor its only minimum. The pill's
    // travel is a percentage of the rail, so it scales with it. Run at mount, on open and resize.
    function fit() {
      if (!down) return;
      const T = toggle.getBoundingClientRect(), pw = pill.getBoundingClientRect().width;
      const over = T.left + T.width / 2 + pw / 2 + 3 - document.documentElement.clientWidth;
      pill.style.marginInlineStart = over > 0 ? -Math.ceil(over) + 'px' : '';
      rail.style.blockSize = '';
      const nominal = rail.offsetHeight;
      const rest = toggle.offsetHeight + out.offsetHeight + into.offsetHeight + 6;   // the open box less the rail (3px each side of it)
      // the foot the open box ends 12px inside: data-fit (on the control, or on its stack) -- the
      // LOWEST bottom among its matches; else the stack's data-scroller box; else the viewport.
      // Never past the viewport. A data-fit that matches nothing falls back the same way.
      const stack = el.closest('.wm-theme-stack'), fitSel = ds.fit ?? stack?.dataset.fit;
      let box = -Infinity;
      if (fitSel) { try { document.querySelectorAll(fitSel).forEach(m => { const r = m.getBoundingClientRect(); if (r.width || r.height) box = Math.max(box, r.bottom); }); } catch {} }
      if (box === -Infinity) { const sel = stack?.dataset.scroller, sc = sel && document.querySelector(sel); box = sc ? sc.getBoundingClientRect().bottom : Infinity; }
      const foot = Math.min(innerHeight, box);
      const room = foot - 12 - el.getBoundingClientRect().top - rest;
      const n = Math.max(45, Math.min(nominal, Math.floor(room / 3) * 3));   // the floor, fifteen units
      if (n !== nominal) rail.style.blockSize = n + 'px';
    }

    // the rail: a press on the lozenge grabs it where it is (no jump); a press elsewhere jumps
    // there; either way the value follows until lift. Capture released from three places, as
    // in dialHandle.js. No wheel (GESTURES.md G33).
    let grab = null;
    const at = x => {
      const r = rail.getBoundingClientRect(), inset = len(pill.getBoundingClientRect()) / 2;
      const f = (x - lo(r) - inset) / Math.max(1, len(r) - 2 * inset);
      return min + (down ? 1 - f : f) * (max - min);
    };
    let downX = 0, moved = false, onPill = false;
    rail.addEventListener('pointerdown', e => {
      const p = pill.getBoundingClientRect();
      onPill = along(e) >= lo(p) && along(e) <= lo(p) + len(p);
      downX = along(e); moved = false;
      grab = onPill ? along(e) - (lo(p) + len(p) / 2) : 0;
      if (!onPill) { moved = true; set(at(along(e) - grab)); }
      try { rail.setPointerCapture(e.pointerId); } catch {}
      rail.focus({ preventScroll: true });
      e.preventDefault();
    });
    rail.addEventListener('pointermove', e => { if (grab !== null) { if (Math.abs(along(e) - downX) > 3) moved = true; if (moved) { const v = snap(at(along(e) - grab)); if (v !== value) set(v); } } });
    // A PRESS ON THE LOZENGE IS THE RESET (Mark, 2026-10-07): down and up on the pill without a
    // drag snaps to 100 -- the pill slides home while its numerals count down. A drag from the
    // pill still drags (no jump on down: it was grabbed where it is).
    const end = e => {
      if (grab !== null && onPill && !moved && e && e.type === 'pointerup') reset();
      grab = null; onPill = false;
    };
    rail.addEventListener('pointerup', end);
    ['pointercancel', 'lostpointercapture'].forEach(ev => rail.addEventListener(ev, () => { grab = null; onPill = false; }));
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
    // OPEN AND CLOSE: ONE GLASS, SPLIT IN TWO, PULLING THE RULE (Mark, 2026-10-07). The layout
    // jumps to its end state at once; everything that moves is transform, opacity and clip-path,
    // on the Web Animations API, so the open is one seekable 600ms timeline (2.5 x --dur-med):
    //     0-100   one magnifier (search) zips out of the mark to where the lozenge sits at 100;
    //             the mark fills in place as it leaves (FILL 0 -> 1, 0-120)
    //   100-120   at that centre it splits: zoom_out and zoom_in appear on top of each other
    //   120-330   they travel outward to the ends, and the rule stretches with them -- a clip on
    //             the full-length hairline, opening from the centre at the glyphs' pace
    //   330-380   each crossfades into the real button it has arrived on
    //   300       the lozenge appears as a DOT on the rule at the centre (6px, six hairlines)
    //   340-490   it grows round the readout, a numeral a beat -- 1, 10, 100, 100% -- (a clip-path
    //             with round ends, not layout)
    //   500-600   it slides to the saved value, if that is not 100
    // CLOSE (300ms) is the open folded back: the two glasses zip to the lozenge, merge, the rule
    // retracting into them; the numerals collapse as the lozenge shrinks; the one glass zips
    // home, and the mark unfills. Reduced motion, or a hidden page: the states, swapped.
    const parts = [out, rail, into];
    const paint = () => {
      el.dataset.open = String(open);
      if (!collapse) return;
      toggle.setAttribute('aria-expanded', String(open));
      const label = open ? 'Close zoom' : 'Zoom';
      toggle.setAttribute('aria-label', label); toggle.title = label;
      parts.forEach(p => { p.inert = !open; });
    };
    // motion.css's --ease, the case study tester's unlock curve -- read when a morph is built, never
    // at mount: a style read there flushed the mark's FILL before it was set and transitioned it
    let EASE = '';
    let morph = [], fly = [];
    const stop = () => { morph.forEach(a => a.cancel()); morph = []; fly.forEach(f => f.remove()); fly = []; delete el.dataset.moving; };
    // the shared geometry, measured from the end layout, in the box's coordinates
    const measure2 = (centreAt) => {
      const B = box.getBoundingClientRect();
      const c = e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2 - B.left, y: r.top + r.height / 2 - B.top }; };
      const R = rail.getBoundingClientRect(), P = pill.getBoundingClientRect();
      const inset = len(P) / 2, span = Math.max(1, len(R) - 2 * inset);
      const f = v => (v - min) / (max - min);
      const pAt = v => lo(R) - lo(B) + inset + span * (down ? 1 - f(v) : f(v));   // a position on the rail's axis
      const now = pAt(value), cx = pAt(centreAt);
      // the readout's prefixes: where each numeral ends, in the output's own box
      const O = read.getBoundingClientRect(), tn = read.firstChild, rg = document.createRange();
      const stops = [];
      for (let i = 1; i <= tn.length; i++) { rg.setStart(tn, 0); rg.setEnd(tn, i); const rr = rg.getBoundingClientRect(); stops.push({ left: rr.left - O.left, w: rr.width }); }
      return { mark: c(toggle.querySelector('.wm-icon')), out: c(out.querySelector('.wm-icon')), in: c(into.querySelector('.wm-icon')),
        y: P.top + P.height / 2 - B.top, x: P.left + P.width / 2 - B.left, cx, now, rail: { l: lo(R) - lo(B), r: lo(R) + len(R) - lo(B) }, pw: P.width, ph: P.height,
        ox: O.left - P.left, ow: O.width, stops };
    };
    const flyer = (name, at) => {
      const f = mk('span', 'wm-icon wm-zoom-fly'); f.textContent = name; f.setAttribute('aria-hidden', 'true'); f.setAttribute('translate', 'no');
      f.style.left = at.x + 'px'; f.style.top = at.y + 'px'; box.appendChild(f); fly.push(f); return f;
    };
    // a point on the rail at axis position a, in the box's coordinates; the rule's clip, open from l to r on the axis
    const onRail = (g, a) => down ? { x: g.x, y: a } : { x: a, y: g.y };
    const ruleAt = (l, r) => down ? `inset(${l}px -1px ${r}px -1px)` : `inset(-1px ${r}px -1px ${l}px)`;
    const T = (x, y, s = 1) => `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${s})`;
    // the lozenge at each numeral stage: its clip (round ends), the readout's clip and shift
    const stage = (g, i) => {
      const pad = (g.pw - g.ow) / 2 + (g.ow - (g.stops.at(-1).w)) / 2;   // the pill's air beside the full text
      if (i < 0) {                                                      // a dot on the rule, six hairlines across: nothing showing
        const h = (g.ph - 6) / 2, w = (g.pw - 6) / 2;
        return { pill: `inset(${h}px ${w}px ${h}px ${w}px round 999px)`, read: `inset(0px ${g.ow}px 0px 0px)`, tx: 0 };
      }
      const s = g.stops[i], sw = Math.min(g.pw, s.w + 2 * Math.min(pad, 8)), side = (g.pw - sw) / 2;
      const tx = g.pw / 2 - (g.ox + s.left + s.w / 2);
      return { pill: `inset(-3px ${side - 3}px -3px ${side - 3}px round 999px)`, read: `inset(0px ${g.ow - (s.left + s.w)}px 0px 0px)`, tx };
    };
    const fvsOf = n => { const v = getComputedStyle(toggle.querySelector('.wm-icon')).fontVariationSettings; return v.replace(/"FILL" [\d.]+/, `"FILL" ${n}`); };
    const choreograph = () => {
      EASE = easeOf(el);
      const beat = parseFloat(getComputedStyle(el).getPropertyValue('--dur-med')) || 240;
      const total = 2.5 * beat, at = ms => Math.min(1, Math.max(0, ms / 600));   // the script is written in 600ths
      const k = { duration: total, fill: 'both' }, g = measure2(100), C = onRail(g, g.cx);
      const rel = p => ({ x: p.x - g.mark.x, y: p.y - g.mark.y }), cR = rel(C);
      const A = [];
      // 1 . one glass zips from the mark to the centre; the mark fills
      A.push(flyer('search', g.mark).animate([
        { transform: T(0, 0, .6), opacity: 0, offset: 0, easing: EASE },
        { transform: T(cR.x * .1, cR.y, .8), opacity: 1, offset: at(20), easing: EASE },
        { transform: T(cR.x, cR.y, 1), opacity: 1, offset: at(100) },
        { transform: T(cR.x, cR.y, 1), opacity: 0, offset: at(120) },
        { transform: T(cR.x, cR.y, 1), opacity: 0, offset: 1 },
      ], k));
      A.push(toggle.querySelector('.wm-icon').animate([{ fontVariationSettings: fvsOf(value === 100 ? 0 : 1), offset: 0, easing: EASE }, { fontVariationSettings: fvsOf(1), offset: at(120) }, { fontVariationSettings: fvsOf(1), offset: 1 }], k));
      // 2 . it splits; the two travel to the ends and cross into the real buttons
      for (const [name, to, btn] of [['zoom_out', g.out, out], ['zoom_in', g.in, into]]) {
        const d = rel(to);
        A.push(flyer(name, g.mark).animate([
          { transform: T(cR.x, cR.y), opacity: 0, offset: 0 },
          { transform: T(cR.x, cR.y), opacity: 0, offset: at(100) },
          { transform: T(cR.x, cR.y), opacity: 1, offset: at(120), easing: EASE },
          { transform: T(d.x, d.y), opacity: 1, offset: at(330) },
          { transform: T(d.x, d.y), opacity: 0, offset: at(380) },
          { transform: T(d.x, d.y), opacity: 0, offset: 1 },
        ], k));
        A.push(btn.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: at(330) }, { opacity: 1, offset: at(380) }, { opacity: 1, offset: 1 }], k));
      }
      // ... pulling the rule out of the centre with them (the rule's own box: the whole rail)
      const rw = g.rail.r - g.rail.l, cl = g.cx - g.rail.l;
      A.push(rail.querySelector('i').animate([
        { clipPath: ruleAt(cl, rw - cl), offset: 0 }, { clipPath: ruleAt(cl, rw - cl), offset: at(120), easing: EASE },
        { clipPath: ruleAt(0, 0), offset: at(330) }, { clipPath: ruleAt(0, 0), offset: 1 },
      ], k));
      // 3 . the readout, a numeral at a time, the lozenge growing round it; then the slide
      const d100 = g.cx - g.now, P = shift;
      // 5 . a dot at the centre once the rule is out (300); 6 . a numeral a beat: 1, 10, 100, 100%
      const times = [300, ...g.stops.map((_, i) => 340 + i * Math.min(50, 150 / Math.max(1, g.stops.length - 1)))];
      const st = [-1, ...g.stops.map((_, i) => i)].map(i => stage(g, i));
      A.push(pill.animate([
        ...st.map((s, i) => ({ clipPath: s.pill, transform: P(d100), opacity: i ? 1 : 0, offset: at(times[i]) - (i ? 0 : 1e-6) * 0, easing: EASE })),
        { clipPath: st.at(-1).pill, transform: P(d100), opacity: 1, offset: at(500), easing: EASE },
        { clipPath: st.at(-1).pill, transform: P(0), opacity: 1, offset: 1 },
      ].map((f, i, a) => i === 0 ? { ...f, offset: 0 } : f).flatMap((f, i) => i === 0 ? [f, { ...f, offset: at(times[0]) }] : [f]), k));
      A.push(read.animate([
        { clipPath: st[0].read, transform: `translateX(${st[0].tx}px)`, offset: 0 },
        ...st.map((s, i) => ({ clipPath: s.read, transform: `translateX(${s.tx}px)`, offset: at(times[i]), easing: 'steps(1, end)' })),
        { clipPath: st.at(-1).read, transform: `translateX(${st.at(-1).tx}px)`, offset: 1 },
      ], k));
      return A;
    };
    const closing = () => {
      EASE = easeOf(el);
      const total = 300, at = ms => ms / total, k = { duration: total, fill: 'both' };
      const g = measure2(value), C = onRail(g, g.now), rel = p => ({ x: p.x - g.mark.x, y: p.y - g.mark.y }), cR = rel(C);
      const A = [];
      // the two glasses zip to the lozenge and merge, the rule retracting into them
      for (const [name, from, btn] of [['zoom_out', g.out, out], ['zoom_in', g.in, into]]) {
        const d = rel(from);
        A.push(flyer(name, g.mark).animate([
          { transform: T(d.x, d.y), opacity: 1, offset: 0, easing: 'ease-in-out' },
          { transform: T(cR.x, cR.y), opacity: 1, offset: at(120) },
          { transform: T(cR.x, cR.y), opacity: 0, offset: at(140) },
          { transform: T(cR.x, cR.y), opacity: 0, offset: 1 },
        ], k));
        A.push(btn.animate([{ opacity: 0 }, { opacity: 0 }], k));
      }
      const rw = g.rail.r - g.rail.l, cl = g.now - g.rail.l;
      A.push(rail.querySelector('i').animate([{ clipPath: ruleAt(0, 0), offset: 0, easing: 'ease-in-out' }, { clipPath: ruleAt(cl, rw - cl), offset: at(120) }, { clipPath: ruleAt(cl, rw - cl), offset: 1 }], k));
      // the numerals collapse as the lozenge shrinks to a dot on the rule
      const st = [-1, ...g.stops.map((_, i) => i)].map(i => stage(g, i)).reverse(), n = st.length - 1;
      const tt = st.map((_, i) => at(i * 140 / n));
      A.push(pill.animate([
        ...st.map((s, i) => ({ clipPath: s.pill, opacity: i === n ? 0 : 1, offset: tt[i], easing: EASE })),
        { clipPath: st[n].pill, opacity: 0, offset: 1 },
      ], k));
      A.push(read.animate([
        ...st.map((s, i) => ({ clipPath: s.read, transform: `translateX(${s.tx}px)`, offset: tt[i], easing: 'steps(1, end)' })),
        { clipPath: st[n].read, transform: `translateX(${st[n].tx}px)`, offset: 1 },
      ], k));
      // the one glass zips home; the mark unfills as it lands
      A.push(flyer('search', g.mark).animate([
        { transform: T(cR.x, cR.y), opacity: 0, offset: 0 },
        { transform: T(cR.x, cR.y), opacity: 0, offset: at(120) },
        { transform: T(cR.x, cR.y), opacity: 1, offset: at(140), easing: EASE },
        { transform: T(0, 0, .6), opacity: 1, offset: at(260) },
        { transform: T(0, 0, .6), opacity: 0, offset: at(280) },
        { transform: T(0, 0, .6), opacity: 0, offset: 1 },
      ], k));
      const restFill = value === 100 ? 0 : 1;   // shut at a zoom, the mark stays filled
      A.push(toggle.querySelector('.wm-icon').animate([{ fontVariationSettings: fvsOf(1), offset: 0 }, { fontVariationSettings: fvsOf(1), offset: at(200), easing: EASE }, { fontVariationSettings: fvsOf(restFill), offset: 1 }], k));
      return A;
    };
    const setOpen = (o, { animate = true, save = true } = {}) => {
      if (!collapse || o === open && !morph.length) return;
      if (o) fit();
      const still = !animate || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    // the mark: shut, it opens; open, it closes -- and keeps the zoom. Never collapsing, it is the
    // reset (there is nothing to open). Escape and a press outside close too.
    toggle.addEventListener('click', () => {
      if (!collapse) { reset(); return; }
      if (!open) { setOpen(true); rail.focus({ preventScroll: true }); return; }
      setOpen(false);
    });
    el.addEventListener('keydown', e => { if (e.key === 'Escape' && open && collapse) { setOpen(false); toggle.focus({ preventScroll: true }); e.preventDefault(); } });
    // a touch on a capture region may be the first finger of a pinch: the close waits for the lift
    // and is dropped if a second finger came down (onTouchDown / onTouchUp, below)
    let pendingClose = false;
    const outside = e => {
      if (!open || !collapse || el.contains(e.target)) return;
      if (e.pointerType === 'touch' && regions.some(r => r.contains(e.target))) { if (touches.size < 2) pendingClose = true; return; }
      setOpen(false);
    };
    document.addEventListener('pointerdown', outside);

    // CAPTURE (data-capture): over the target -- or the region its value names -- the browser's own
    // zoom gestures drive this control instead. Listeners are on the region, not the window
    // (wheel non-passive so it may be cancelled), so outside it the browser zooms as ever.
    //   ctrl+wheel   a trackpad pinch in Chrome, Firefox and Edge (and ctrl + a mouse wheel):
    //                continuous, x e^(-deltaY/100), snapped to the step
    //   gesture*     Safari's pinch -- the trackpad on a Mac, two fingers on iOS: the scale from
    //                gesturestart, applied to the value it began at; cancelled, so the page does not zoom
    //   two touches  a pinch on a touch screen elsewhere (Chrome Android, ...): two pointers on the
    //                region, the ratio of their distance to the distance at the second touch-down,
    //                applied to the value it began at. The region gets touch-action: pan-x pan-y
    //                so the browser never claims the pinch first (a one-finger pan still scrolls),
    //                and a two-touch touchmove is cancelled as well, for engines that ignore it.
    //                Where gesture events exist (iOS) they drive it and the pointers do not, so a
    //                pinch is never counted twice. Because the native zoom never happens, a
    //                position: fixed control stays where it is (GESTURES.md G80).
    //   Cmd/Ctrl + - 0 while the pointer is over the region or focus is inside it -- in a text
    //                field too: the chord types nothing, and the page zooming under a field you
    //                are typing in is the thing this exists to stop
    // A shut control opens (with its morph) on the first captured gesture.
    const capSel = opts.capture ?? ds.capture;
    const capture = capSel !== undefined && capSel !== false && capSel !== 'false';
    const regions = !capture ? [] : (typeof capSel === 'string' && capSel.trim()) ? [...document.querySelectorAll(capSel)] : targets;
    let over = false, pinch = null, gestureFrom = 100;
    const wake = () => { if (collapse && !open) setOpen(true); };
    const onWheel = e => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      wake();
      pinch = (pinch ?? value) * Math.exp(-e.deltaY / 100);
      pinch = Math.min(max, Math.max(min, pinch));
      if (snap(pinch) !== value) set(pinch);
      clearTimeout(onWheel.t); onWheel.t = setTimeout(() => { pinch = null; }, 200);
    };
    const onGesture = e => {
      e.preventDefault();
      if (e.type === 'gesturestart') { gestureFrom = value; pendingClose = false; wake(); return; }
      if (e.type === 'gesturechange') { const v = snap(gestureFrom * e.scale); if (v !== value) set(v); }
    };
    const touches = new Map(), gestures = 'ongesturestart' in window;
    let pinchFrom = null;   // { d, v }: the distance at the second touch-down, and the value then
    const dist = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    const onTouchDown = e => {
      if (e.pointerType !== 'touch') return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) { pendingClose = false; if (!gestures) { pinchFrom = { d: Math.max(1, dist()), v: value }; wake(); } }
    };
    const onTouchMove = e => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size !== 2 || !pinchFrom || gestures) return;
      e.preventDefault();
      const v = snap(pinchFrom.v * dist() / pinchFrom.d);
      if (v !== value) set(v);
    };
    const onTouchUp = e => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinchFrom = null;
      if (!touches.size && pendingClose) { pendingClose = false; setOpen(false); }
    };
    const noNativePinch = e => { if (e.touches.length > 1) e.preventDefault(); };
    const enter = () => { over = true; }, leave = () => { over = false; };
    regions.forEach(r => {
      r.style.touchAction = 'pan-x pan-y';
      r.addEventListener('pointerdown', onTouchDown);
      r.addEventListener('pointermove', onTouchMove);
      ['pointerup', 'pointercancel'].forEach(ev => r.addEventListener(ev, onTouchUp));
      r.addEventListener('touchmove', noNativePinch, { passive: false });
      r.addEventListener('wheel', onWheel, { passive: false });
      ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => r.addEventListener(ev, onGesture, { passive: false }));
      r.addEventListener('pointerenter', enter); r.addEventListener('pointerleave', leave);
    });
    const onChord = e => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const d = { '+': 1, '=': 1, '-': -1, '_': -1, '0': 0 }[e.key];
      if (d === undefined) return;
      if (!over && !regions.some(r => r.contains(document.activeElement))) return;
      e.preventDefault();
      wake();
      if (d === 0) reset(); else set(value + d * step);
    };
    if (capture) document.addEventListener('keydown', onChord, true);

    const resize = () => { fit(); if (targets.length && value !== 100) { base = null; zoomTarget(value / 100); } };
    window.addEventListener('resize', resize);

    const api = {
      el, local, step,
      get: () => value,
      set: v => set(v),
      reset,
      isOpen: () => open,
      morph: () => morph,   // the running timeline, for a test or a frame grab
      fit,                  // .wm-zoom--down: re-measure the shift and the rail (themeStack.js calls it when the stack moves)
      setOpen: o => setOpen(!!o),
      destroy: () => {
        document.removeEventListener('pointerdown', outside); stop();
        document.removeEventListener('keydown', onChord, true);
        regions.forEach(r => { r.removeEventListener('wheel', onWheel); ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => r.removeEventListener(ev, onGesture)); r.removeEventListener('pointerenter', enter); r.removeEventListener('pointerleave', leave); r.style.touchAction = ''; r.removeEventListener('pointerdown', onTouchDown); r.removeEventListener('pointermove', onTouchMove); ['pointerup', 'pointercancel'].forEach(ev => r.removeEventListener(ev, onTouchUp)); r.removeEventListener('touchmove', noNativePinch); });
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
    if (d === 0) c.reset(); else c.set(c.get() + d * c.step);
    e.preventDefault();
  });

  const auto = () => document.querySelectorAll('.wm-zoom').forEach(el => mount(el));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();
  window.wmZoom = { mount };
})();
