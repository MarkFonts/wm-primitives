/* dialHandle.js -- the dial whose value rides in the handle. Plain script, no React.
 *
 * Variant 03 of the system page ("Value in the handle"), promoted from a docs demo into a
 * primitive (2026-10-02) because the Cal Sans case study needed it: six axes beside a word
 * on a page that loads no React. The docs card mounts this same code, so the demo and the
 * shipped control cannot drift.
 *
 *   const d = wmHandleDial.mount(el, {
 *     label: 'Optical size', tag: 'opsz', icon: 'mystery',    // icon: a Material ligature, optional
 *     caption: 'opsz',                                         // optional: shown instead of the label
 *     min: 8, max: 45, step: 1, value: 45, unit: '',
 *     orient: 'vertical',                                      // or 'horizontal' (default)
 *     auto: { value: 14 },                                     // optional: an ○/● auto state
 *     onChange: v => ...                                       // v is a number, or 'auto'
 *   })
 *   d.get() / d.set(v) / d.setOrient('vertical') / d.destroy()
 *
 * Anatomy: an id column (icon, name, tag) and a rail with a hairline; the lozenge on the
 * rail holds the typeable number and its unit, and sits where the value is. Press the rail
 * and the value jumps there, then follows; the rail is keyboard-operable (arrows, Home,
 * End, shift x10); the number is typed in the lozenge. No stepper arrows in the handle: the
 * lozenge is positioned BY the value, so an arrow would move out from under your finger.
 * Vertical: the column stacks id over rail, the hairline runs down, the lozenge never rotates.
 * Styles in dialHandle.css. */
(() => {
  const mk = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const clamp = (v, d) => Math.min(d.max, Math.max(d.min, v));
  const dec = d => (String(d.step).split('.')[1] || '').length;
  const fmt = (v, d) => (v === 'auto' ? 'auto' : Number(v).toFixed(dec(d)).replace('-', '−'));   // real minus
  const parse = s => parseFloat(String(s).replace('−', '-').trim());

  function mount(el, props) {
    const d = { min: 0, max: 100, step: 1, unit: '', orient: 'horizontal', label: '', ...props };
    let value = d.value ?? d.min;
    const num = v => (v === 'auto' ? (d.auto ? d.auto.value : d.min) : Number(v));
    const pct = () => ((num(value) - d.min) / (d.max - d.min)) * 100;

    const root = mk('div', 'wm-hd' + (d.orient === 'vertical' ? ' wm-hd--vertical' : ''));
    // the id column: icon, then the name it never had, then the tag -- centred, one object
    const id = mk('span', 'wm-hd-id');
    if (d.icon) {
      const ic = mk('span', 'wm-hd-icon material-symbols-outlined');
      ic.textContent = d.icon; ic.setAttribute('aria-hidden', 'true'); ic.setAttribute('translate', 'no');
      ic.title = d.label + (d.tag ? ' · ' + d.tag : '');
      id.appendChild(ic);
    }
    // caption: what the column SHOWS, when the full label is too long for it (the case study
    // shows the axis tag and keeps the name for aria)
    if (d.caption || d.label) { const n = mk('span', 'wm-hd-name'); n.textContent = d.caption || d.label; id.appendChild(n); }
    if (d.tag) { const t = mk('span', 'wm-hd-tag d-tag'); t.textContent = d.tag; id.appendChild(t); }

    const rail = mk('div', 'wm-hd-rail');
    const line = mk('i');
    const pill = mk('span', 'wm-hd-pill');
    const field = mk('span', 'wm-hd-field');
    const inp = mk('input');
    inp.type = 'text'; inp.inputMode = 'decimal'; inp.setAttribute('aria-label', d.label);
    field.appendChild(inp);
    pill.appendChild(field);
    const unit = mk('span', 'wm-hd-unit d-unit');
    unit.textContent = d.unit || '';
    if (!d.unit) unit.setAttribute('aria-hidden', 'true');
    pill.appendChild(unit);
    rail.append(line, pill);
    root.append(id, rail);

    // auto: the ○/● pill under the id column, as the docs draw it for opsz
    let autoBtn = null;
    if (d.auto) {
      autoBtn = mk('button', 'wm-hd-auto'); autoBtn.type = 'button';
      const dot = mk('span', 'wm-hd-auto-dot'); dot.setAttribute('aria-hidden', 'true');
      const word = mk('span', 'wm-hd-auto-word'); word.textContent = 'auto';
      autoBtn.append(dot, word); autoBtn.title = d.auto.title || 'follow automatically';
      autoBtn.addEventListener('click', () => nudge(value === 'auto' ? d.auto.value : 'auto'));
      id.appendChild(autoBtn);
      root.__dot = dot;
    }

    let echo = false;
    const render = () => {
      // a sync must not clobber what you are TYPING; an arrow or a drag is not typing
      if (document.activeElement !== inp || echo) inp.value = fmt(value, d);
      const p = pct();
      rail.setAttribute('aria-valuenow', String(num(value)));
      rail.setAttribute('aria-valuetext', fmt(value, d) + (d.unit ? ' ' + d.unit : ''));
      // the lozenge's CENTRE travels the rail less an inset at each end (--hd-inset, half the
      // lozenge when vertical), so at its ends it sits inside the rail instead of overhanging
      // into the caption above or whatever is below
      pill.style.setProperty('--p', String(p / 100));
      if (root.classList.contains('wm-hd--vertical')) { pill.style.top = ''; pill.style.left = ''; }
      else { pill.style.left = ''; pill.style.top = ''; }
      if (autoBtn) {
        const on = value === 'auto';
        autoBtn.classList.toggle('on', on); autoBtn.setAttribute('aria-pressed', String(on));
        root.__dot.textContent = on ? '●' : '○';   // ● / ○, drawn at 76% of the em, unlike • and ◦
      }
    };
    // force: a deliberate change -- a drag, an arrow key, the auto button -- rewrites the
    // field even while it has focus. A value arriving from OUTSIDE (the host's set) while
    // you are typing does not: the host echoing a clamped "9" back as "75.0" mid-word was
    // how "90" became 75 (found by the docs test, 2026-10-02).
    const set = (v, quiet, force) => {
      const next = v === 'auto' ? 'auto' : clamp(parse(v), d);
      if (Number.isNaN(next)) return;
      value = next; echo = !!force; render(); echo = false;
      if (!quiet && d.onChange) d.onChange(value);
    };
    const nudge = v => set(v, false, true);

    // the number: typed, blurred back to the formatted value, nudged by arrow keys
    inp.addEventListener('input', () => { const n = parse(inp.value); if (!Number.isNaN(n)) { value = clamp(n, d); render(); if (d.onChange) d.onChange(value); } });
    inp.addEventListener('blur', () => { inp.value = fmt(value, d); });
    inp.addEventListener('keydown', e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      nudge(num(value) + (e.key === 'ArrowUp' ? d.step : -d.step) * (e.shiftKey ? 10 : 1));
    });

    // the rail: press anywhere and the value jumps there, then follows; capture is
    // released from three places, because a release the rail never hears would leave the
    // whole page delivering its clicks to a control nobody is touching
    const fromPoint = e => {
      const r = rail.getBoundingClientRect();
      const t = root.classList.contains('wm-hd--vertical') ? 1 - (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
      return clamp(d.min + t * (d.max - d.min), d);
    };
    let dragging = false;
    rail.addEventListener('pointerdown', e => {
      if (e.target.closest('input, button')) return;
      dragging = true;
      nudge(fromPoint(e));
      try { rail.setPointerCapture(e.pointerId); } catch {}
      e.preventDefault();
    });
    rail.addEventListener('pointermove', e => { if (dragging) nudge(fromPoint(e)); });
    const endDrag = e => { dragging = false; if (e && e.pointerId != null) { try { if (rail.hasPointerCapture(e.pointerId)) rail.releasePointerCapture(e.pointerId); } catch {} } };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => rail.addEventListener(ev, endDrag));
    ['pointerup', 'pointercancel'].forEach(ev => window.addEventListener(ev, endDrag));
    window.addEventListener('blur', () => { dragging = false; });
    // no wheel: a control that moves on scroll steals the page's scroll the moment the
    // pointer crosses it, and you cannot scroll PAST a rail of them
    rail.tabIndex = 0; rail.setAttribute('role', 'slider'); rail.setAttribute('aria-label', d.label);
    rail.setAttribute('aria-valuemin', String(d.min)); rail.setAttribute('aria-valuemax', String(d.max));
    rail.addEventListener('keydown', e => {
      const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
      if (k === undefined) {
        if (e.key === 'Home') { e.preventDefault(); nudge(d.min); }
        if (e.key === 'End') { e.preventDefault(); nudge(d.max); }
        return;
      }
      e.preventDefault();
      nudge(num(value) + k * d.step * (e.shiftKey ? 10 : 1));
    });

    el.appendChild(root);
    render();
    return {
      el: root,
      get: () => value,
      set: (v, quiet) => set(v, quiet),
      setOrient: o => { root.classList.toggle('wm-hd--vertical', o === 'vertical'); render(); },
      destroy: () => root.remove(),
    };
  }
  window.wmHandleDial = { mount };
})();
