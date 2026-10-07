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
      const label = open ? 'Close zoom, back to 100%' : 'Zoom';
      toggle.setAttribute('aria-label', label); toggle.title = label;
      parts.forEach(p => { p.inert = !open; });
    };
    const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';   // the case study tester's unlock curve; motion.css holds durations, no easings
    let morph = [], fly = [];
    const stop = () => { morph.forEach(a => a.cancel()); morph = []; fly.forEach(f => f.remove()); fly = []; delete el.dataset.moving; };
    // the shared geometry, measured from the end layout, in the box's coordinates
    const measure2 = (centreAt) => {
      const B = box.getBoundingClientRect();
      const c = e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2 - B.left, y: r.top + r.height / 2 - B.top }; };
      const R = rail.getBoundingClientRect(), P = pill.getBoundingClientRect();
      const inset = P.width / 2, span = Math.max(1, R.width - 2 * inset);
      const pAt = v => R.left - B.left + inset + span * ((v - min) / (max - min));
      const now = pAt(value), cx = pAt(centreAt);
      // the readout's prefixes: where each numeral ends, in the output's own box
      const O = read.getBoundingClientRect(), tn = read.firstChild, rg = document.createRange();
      const stops = [];
      for (let i = 1; i <= tn.length; i++) { rg.setStart(tn, 0); rg.setEnd(tn, i); const rr = rg.getBoundingClientRect(); stops.push({ left: rr.left - O.left, w: rr.width }); }
      return { mark: c(toggle.querySelector('.wm-icon')), out: c(out.querySelector('.wm-icon')), in: c(into.querySelector('.wm-icon')),
        y: P.top + P.height / 2 - B.top, cx, now, rail: { l: R.left - B.left, r: R.right - B.left }, pw: P.width, ph: P.height,
        ox: O.left - P.left, ow: O.width, stops };
    };
    const flyer = (name, at) => {
      const f = mk('span', 'wm-icon wm-zoom-fly'); f.textContent = name; f.setAttribute('aria-hidden', 'true'); f.setAttribute('translate', 'no');
      f.style.left = at.x + 'px'; f.style.top = at.y + 'px'; box.appendChild(f); fly.push(f); return f;
    };
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
      const beat = parseFloat(getComputedStyle(el).getPropertyValue('--dur-med')) || 240;
      const total = 2.5 * beat, at = ms => Math.min(1, Math.max(0, ms / 600));   // the script is written in 600ths
      const k = { duration: total, fill: 'both' }, g = measure2(100), C = { x: g.cx, y: g.y };
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
      A.push(toggle.querySelector('.wm-icon').animate([{ fontVariationSettings: fvsOf(0), offset: 0, easing: EASE }, { fontVariationSettings: fvsOf(1), offset: at(120) }, { fontVariationSettings: fvsOf(1), offset: 1 }], k));
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
      const ruleAt = (l, r) => `inset(-1px ${r}px -1px ${l}px)`;
      A.push(rail.querySelector('i').animate([
        { clipPath: ruleAt(cl, rw - cl), offset: 0 }, { clipPath: ruleAt(cl, rw - cl), offset: at(120), easing: EASE },
        { clipPath: ruleAt(0, 0), offset: at(330) }, { clipPath: ruleAt(0, 0), offset: 1 },
      ], k));
      // 3 . the readout, a numeral at a time, the lozenge growing round it; then the slide
      const d100 = g.cx - g.now, P = (x) => `translate(calc(-50% + ${x}px), -50%)`;
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
      const total = 300, at = ms => ms / total, k = { duration: total, fill: 'both' };
      const g = measure2(value), C = { x: g.now, y: g.y }, rel = p => ({ x: p.x - g.mark.x, y: p.y - g.mark.y }), cR = rel(C);
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
      const rw = g.rail.r - g.rail.l, cl = g.now - g.rail.l, ruleAt = (l, r) => `inset(-1px ${r}px -1px ${l}px)`;
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
      A.push(toggle.querySelector('.wm-icon').animate([{ fontVariationSettings: fvsOf(1), offset: 0 }, { fontVariationSettings: fvsOf(1), offset: at(200), easing: EASE }, { fontVariationSettings: fvsOf(0), offset: 1 }], k));
      return A;
    };
    const setOpen = (o, { animate = true, save = true } = {}) => {
      if (!collapse || o === open && !morph.length) return;
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
