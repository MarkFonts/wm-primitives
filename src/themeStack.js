/* themeStack.js -- dismissal for the vertical theme stack (themeSwitch.css
 * .wm-theme-stack--vertical). Plain script, no React, like zoomControl.js. GESTURES.md §13.
 *
 *   <div class="wm-theme-stack wm-theme-stack--vertical" data-hide="scroll swipe">…</div>
 *
 * Every .wm-theme-stack with data-hide or data-below in the document at DOMContentLoaded is mounted; one rendered
 * later (React) is mounted by the host with wmThemeStack.mount(el) -- idempotent. data-hide is
 * a list, either word or both:
 *   scroll   scrolling DOWN hides it, scrolling UP shows it. Any vertical scroller counts (one
 *            capture-phase listener on the document, read passively), so the app's own text
 *            pane works without being named. A direction has to run 24px (eight units) before
 *            it counts, so a jitter does not flap it. On the PAGE's own scroller it always shows
 *            near the top (until the content under its rest footprint has scrolled past); on a
 *            named or inner scroller -- which holds the stack inside its box -- the run alone. data-scroller="selector" narrows it to that one scroller (a page
 *            with several, or a demo inside a page that scrolls).
 *   swipe    an upward swipe that STARTS ON THE STACK dismisses it: the stack follows the
 *            finger up, and past 24px (and clearly vertical) it goes; short of that it settles
 *            back. A press inside the stack's rest footprint (its column x its rest height, at
 *            its rest top), or a scroll up, brings it back. While stowed the footprint is the
 *            STACK's: the press is taken on the document's capture phase and nothing under it
 *            sees it (no focus, no click).
 * data-below="selector" (commas allowed): the stack rests UNDER the host's top chrome. The
 * script takes the LOWEST bottom among every element the selector matches and writes
 * --stack-top = that + 6px, rounded up to the 3px line, onto the stack; nothing matching, it
 * removes it and the default (6px) stands. Re-measured on resize, orientation, a resize of a
 * match, a class/hidden/style change on a match, a child added or removed beside one, the end
 * of a scroll, and a tap. --stack-top by hand is the escape hatch for a host without a selector to give.
 * Hidden by scroll or swipe: data-stowed on the stack -- CSS translates it off the top edge
 * over 180ms on the house curve -- and inert, so focus cannot land on a mark nobody can see. Hiding folds an open
 * zoom inside it. Only while the stack is vertical: without the class nothing hides.
 * Nothing outside the stack is captured: the scroll and the top-edge tap are read, never
 * cancelled, and the zoom control's own capture (data-capture) is untouched.
 * THE HOST'S HIDE (G81): data-hidden on the stack forces it hidden, the same way, whatever the
 * scroll or swipe say -- a phone sheet over the corner. This script never adds or removes it;
 * removed, the stack is wherever data-stowed says (shown, unless a scroll down stowed it).
 * wmThemeStack.hide(el, on) only toggles that attribute, for a host that prefers a call.
 * Returns { el, hide, show, hidden, destroy } -- hide/show/hidden are the scroll/swipe state. */
(() => {
  const RUN = 24;    // px a direction must run before it counts: eight units

  function mount(el) {
    if (el.__wmThemeStack) return el.__wmThemeStack;
    const modes = (el.dataset.hide || '').split(/[\s,]+/);
    const onScroll = modes.includes('scroll'), onSwipe = modes.includes('swipe');
    const vertical = () => el.classList.contains('wm-theme-stack--vertical');
    let hidden = false;
    const paint = h => {
      if (h === hidden) return;
      hidden = h;
      el.toggleAttribute('data-stowed', h);
      sync();
      el.dispatchEvent(new CustomEvent('wm-theme-stack', { detail: { hidden: h }, bubbles: true }));
    };
    // inert and the zoom's fold follow EITHER cause; the host's attribute is only read
    let gone = false;
    const sync = () => {
      const g = hidden || el.hasAttribute('data-hidden');
      el.inert = g;
      if (g && !gone) el.querySelectorAll('.wm-zoom').forEach(z => z.__wmZoom?.isOpen() && z.matches('[data-collapse]') && z.__wmZoom.setOpen(false));
      gone = g;
    };
    const watch = new MutationObserver(sync);
    watch.observe(el, { attributes: true, attributeFilter: ['data-hidden'] });
    sync();

    // DATA-BELOW: rest under the host's chrome (G82). One rect per match. Watched narrowly -- a
    // contentEditable host restyles inline all the time, so nothing body-wide: a ResizeObserver on
    // each match, attributes (class, hidden, style) on the matches themselves, childList on their
    // parents (a row added or removed beside them); every parent ever seen stays watched, so a row
    // that leaves and comes back is caught. A row that appears where none ever was is caught on
    // resize, orientation, scroll end, or the next tap (a mode switch is a tap).
    const below = el.dataset.below;
    // data-fit (the zoom's foot, G83) is watched the same way: its boxes move, the open rail re-fits
    const fitSel = el.dataset.fit ?? el.querySelector('.wm-zoom[data-fit]')?.dataset.fit;
    const watched = [below, fitSel].filter(Boolean).join(', ');
    let ro = null, mo = null, raf = 0, seen = [];
    const parents = new Set();
    const place = () => {
      raf = 0;
      if (!watched) return;
      let bottom = -Infinity, matches = [];
      try { matches = [...document.querySelectorAll(watched)]; } catch { return; }
      if (below) {
        for (const m of matches) { if (!m.matches(below)) continue; const r = m.getBoundingClientRect(); if (r.width || r.height) bottom = Math.max(bottom, r.bottom); }
        if (bottom === -Infinity) el.style.removeProperty('--stack-top');
        else el.style.setProperty('--stack-top', Math.ceil((Math.max(0, bottom) + 6) / 3) * 3 + 'px');
      }
      // observe the matches -- re-observing only when the set changed, since observe() itself fires once
      if (matches.length !== seen.length || matches.some((m, i) => m !== seen[i])) {
        ro?.disconnect(); mo.disconnect();
        matches.forEach(m => { ro?.observe(m); mo.observe(m, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] }); if (m.parentNode) parents.add(m.parentNode); });
        parents.forEach(p => { if (p.isConnected) mo.observe(p, { childList: true }); else parents.delete(p); });
        seen = matches;
      }
      el.querySelectorAll('.wm-zoom').forEach(z => z.__wmZoom?.fit?.());
    };
    const replace = () => { if (!raf) raf = requestAnimationFrame(place); };
    if (watched) {
      if ('ResizeObserver' in window) ro = new ResizeObserver(replace);
      mo = new MutationObserver(replace);
      document.addEventListener('pointerup', replace, { passive: true });
      window.addEventListener('resize', replace);
      window.addEventListener('orientationchange', replace);
      place();
    }
    // the REST footprint, in viewport px: where the stack sits when it is not stowed or dragged.
    // offsetTop/Left of a fixed box ignore its translate, which is the point.
    const rest = () => ({ top: el.offsetTop, bottom: el.offsetTop + el.offsetHeight, left: el.offsetLeft, right: el.offsetLeft + el.offsetWidth });

    const hide = () => { if (vertical()) paint(true); };
    const show = () => paint(false);

    // SCROLL: per scroller, the last top and the run in the current direction
    const only = el.dataset.scroller ? document.querySelector(el.dataset.scroller) : null;
    const last = new WeakMap();   // the page's own scroller (or the named one) is primed, so its first scroll counts; any other is learnt on its first event
    const first = only ?? document.scrollingElement;
    if (first) last.set(first, first.scrollTop);
    let run = 0, settle = 0;
    const scrolled = e => {
      if (watched) { clearTimeout(settle); settle = setTimeout(replace, 120); }   // the end of a scroll: the chrome may have moved
      const t = e.target === document ? document.scrollingElement : e.target;
      if (!t || typeof t.scrollTop !== 'number' || (only && t !== only)) return;
      const top = t.scrollTop, prev = last.get(t);
      last.set(t, top);
      if (prev === undefined || top === prev) return;   // first sight, or a sideways scroll
      const d = top - prev;
      run = Math.sign(d) === Math.sign(run) ? run + d : d;
      // near the top it shows -- for the PAGE's own scroller only. A named scroller (data-scroller),
      // or any inner one, holds the stack inside its box (data-below puts it there): the run alone.
      if (t === document.scrollingElement && !only && top <= rest().bottom) { if (hidden) show(); return; }
      if (run >= RUN && onScroll) hide();
      else if (run <= -RUN) show();                     // scroll up shows, in either mode
    };
    document.addEventListener('scroll', scrolled, { capture: true, passive: true });

    // SWIPE: on the stack only. Not from the zoom's rail, whose drag is a value.
    let sw = null;
    const down = e => {
      if (!onSwipe || !vertical() || hidden || e.target.closest('.wm-hd-rail')) return;
      sw = { id: e.pointerId, x: e.clientX, y: e.clientY, dy: 0, live: false };
    };
    const move = e => {
      if (!sw || e.pointerId !== sw.id) return;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
      if (!sw.live && dy < -6 && -dy > 1.5 * Math.abs(dx)) {
        sw.live = true;
        el.toggleAttribute('data-dragging', true);
        try { el.setPointerCapture(e.pointerId); } catch {}
      }
      if (sw.live) { sw.dy = Math.min(0, dy); el.style.setProperty('--stack-drag', sw.dy + 'px'); }
    };
    const swallow = e => { e.stopPropagation(); e.preventDefault(); };
    const up = e => {
      if (!sw || (e.pointerId !== undefined && e.pointerId !== sw.id)) return;
      const { live, dy } = sw;
      sw = null;
      if (!live) return;
      // the press that became a swipe is not also a press on the mark it began on
      el.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 400);
      if (dy <= -RUN) paint(true);
      el.removeAttribute('data-dragging');
      el.style.removeProperty('--stack-drag');
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    // the way back: a press inside the rest footprint. While stowed (by scroll or swipe -- not the
    // host's data-hidden) the footprint is the STACK's: taken on the document's capture phase, so
    // nothing under it sees the press -- no focus, no keyboard, no click -- and the stack returns.
    const swallowClick = e => { e.stopPropagation(); e.preventDefault(); };
    const edge = e => {
      if (!hidden || el.hasAttribute('data-hidden') || el.contains(e.target)) return;
      const f = rest();
      if (!(e.clientX >= f.left && e.clientX <= f.right && e.clientY >= f.top && e.clientY <= f.bottom)) return;
      e.preventDefault(); e.stopPropagation();
      ['click', 'mousedown', 'mouseup', 'focusin'].forEach(ev => document.addEventListener(ev, swallowClick, { capture: true, once: true }));
      setTimeout(() => ['click', 'mousedown', 'mouseup', 'focusin'].forEach(ev => document.removeEventListener(ev, swallowClick, { capture: true })), 500);
      show();
    };
    if (onSwipe) document.addEventListener('pointerdown', edge, { capture: true });

    const api = {
      el, hide, show,
      hidden: () => hidden,
      destroy: () => {
        document.removeEventListener('scroll', scrolled, { capture: true });
        document.removeEventListener('pointerdown', edge, { capture: true }); document.removeEventListener('pointerup', replace);
        ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((ev, i) => el.removeEventListener(ev, [down, move, up, up][i]));
        watch.disconnect(); ro?.disconnect(); mo?.disconnect(); cancelAnimationFrame(raf); clearTimeout(settle);
        window.removeEventListener('resize', replace); window.removeEventListener('orientationchange', replace);
        paint(false); delete el.__wmThemeStack;
      },
    };
    el.__wmThemeStack = api;
    return api;
  }

  const auto = () => document.querySelectorAll('.wm-theme-stack:is([data-hide], [data-below], [data-fit]), .wm-theme-stack:has(.wm-zoom[data-fit])').forEach(el => mount(el));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();
  // the host's hide (G81): only the attribute; mounted or not, the CSS does the rest
  const hide = (el, on = true) => el.toggleAttribute('data-hidden', !!on);
  window.wmThemeStack = { mount, hide };
})();
