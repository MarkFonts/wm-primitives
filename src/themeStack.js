/* themeStack.js -- dismissal for the vertical theme stack (themeSwitch.css
 * .wm-theme-stack--vertical). Plain script, no React, like zoomControl.js. GESTURES.md §13.
 *
 *   <div class="wm-theme-stack wm-theme-stack--vertical" data-hide="scroll swipe">…</div>
 *
 * Every .wm-theme-stack[data-hide] in the document at DOMContentLoaded is mounted; one rendered
 * later (React) is mounted by the host with wmThemeStack.mount(el) -- idempotent. data-hide is
 * a list, either word or both:
 *   scroll   scrolling DOWN hides it, scrolling UP shows it. Any vertical scroller counts (one
 *            capture-phase listener on the document, read passively), so the app's own text
 *            pane works without being named. A direction has to run 24px (eight units) before
 *            it counts, so a jitter does not flap it; within one stack's height of the top it
 *            always shows. data-scroller="selector" narrows it to that one scroller (a page
 *            with several, or a demo inside a page that scrolls).
 *   swipe    an upward swipe that STARTS ON THE STACK dismisses it: the stack follows the
 *            finger up, and past 24px (and clearly vertical) it goes; short of that it settles
 *            back. A tap in the top 27px of the screen, or a scroll up, brings it back.
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
  const EDGE = 27;   // px: the top band a tap brings the stack back from

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
    const hide = () => { if (vertical()) paint(true); };
    const show = () => paint(false);

    // SCROLL: per scroller, the last top and the run in the current direction
    const only = el.dataset.scroller ? document.querySelector(el.dataset.scroller) : null;
    const last = new WeakMap();   // the page's own scroller (or the named one) is primed, so its first scroll counts; any other is learnt on its first event
    const first = only ?? document.scrollingElement;
    if (first) last.set(first, first.scrollTop);
    let run = 0;
    const scrolled = e => {
      const t = e.target === document ? document.scrollingElement : e.target;
      if (!t || typeof t.scrollTop !== 'number' || (only && t !== only)) return;
      const top = t.scrollTop, prev = last.get(t);
      last.set(t, top);
      if (prev === undefined || top === prev) return;   // first sight, or a sideways scroll
      const d = top - prev;
      run = Math.sign(d) === Math.sign(run) ? run + d : d;
      if (top <= el.offsetHeight) { if (hidden) show(); return; }
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
    // the way back: a tap in the top band. Read on the document, never cancelled.
    const edge = e => { if (hidden && e.clientY <= EDGE && !el.contains(e.target)) show(); };   // not the lift that ended the swipe
    if (onSwipe) document.addEventListener('pointerup', edge, { passive: true });

    const api = {
      el, hide, show,
      hidden: () => hidden,
      destroy: () => {
        document.removeEventListener('scroll', scrolled, { capture: true });
        document.removeEventListener('pointerup', edge);
        ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((ev, i) => el.removeEventListener(ev, [down, move, up, up][i]));
        watch.disconnect(); paint(false); delete el.__wmThemeStack;
      },
    };
    el.__wmThemeStack = api;
    return api;
  }

  const auto = () => document.querySelectorAll('.wm-theme-stack[data-hide]').forEach(el => mount(el));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();
  // the host's hide (G81): only the attribute; mounted or not, the CSS does the rest
  const hide = (el, on = true) => el.toggleAttribute('data-hidden', !!on);
  window.wmThemeStack = { mount, hide };
})();
