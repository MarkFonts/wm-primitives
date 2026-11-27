/* scrollover.js -- builds the track for every [data-scrollover] (scrollover.css has the
 * recipe and the design note). A plain script, like dialHandle.js and zoomControl.js, so a
 * static page script-tags it:
 *
 *   <script src="shared/src/scrollover.js" defer></script>
 *
 * Every [data-scrollover] in the document is mounted at DOMContentLoaded. For one added
 * later, or a label that changed:
 *
 *   wmScrollover.mount(el)      build (or rebuild) the track; safe to call twice
 *   wmScrollover.measure(el?)   re-seat the rest position -- one element, or all of them.
 *                               Called for you on resize and when the fonts land.
 *   wmScrollover.unmount(el)    put the original children back, drop the listeners
 *
 * The label stays in the DOM as .so-lab (the accessible text, and what sets the element's
 * width); the track is aria-hidden CLONES of it, so an icon or a mark in the label is
 * carried into every repeat. A child with [data-scrollover-sep] (or .arrow) is the
 * separator: it stays on the label and rides after each repeat. */
(() => {
  const SEP = '[data-scrollover-sep], .arrow'
  const RUNS = 3            // the anchor is the first copy of the middle run: a run's worth either side
  const MIN_COPIES = 5
  const LAND_MS = 380
  const mounted = new Set()

  function mount(el) {
    if (!el || el.nodeType !== 1) return null
    if (el.__wmScrollover) unmount(el)
    // the stylesheet keys on the attribute, so an element handed to mount() without it gets it:
    // otherwise the track is built, unstyled, and lies in the flow beside the label
    if (!el.hasAttribute('data-scrollover')) el.setAttribute('data-scrollover', '')

    const original = [...el.childNodes]
    const lab = document.createElement('span'); lab.className = 'so-lab'
    original.forEach(n => lab.appendChild(n))
    el.appendChild(lab)
    lab.querySelectorAll(SEP).forEach(s => s.setAttribute('aria-hidden', 'true'))

    // enough copies that a run is at least as wide as the element, however short the label
    const labW = lab.getBoundingClientRect().width || 1
    const n = Math.max(MIN_COPIES, Math.ceil(el.clientWidth / labW) + 1)

    const track = document.createElement('span'); track.className = 'so-track'
    track.setAttribute('aria-hidden', 'true')
    for (let k = 0; k < RUNS; k++) {
      const run = document.createElement('span'); run.className = 'so-run'
      for (let i = 0; i < n; i++) {
        const c = document.createElement('span')
        lab.childNodes.forEach(node => c.appendChild(node.cloneNode(true)))
        c.querySelectorAll('[id]').forEach(d => d.removeAttribute('id'))   // a clone must not repeat an id
        if (k === 1 && i === 0) c.className = 'so-anchor'
        run.appendChild(c)
      }
      track.appendChild(run)
    }
    el.appendChild(track)

    let out = 0
    const copies = [...track.querySelectorAll('.so-run > span')]

    const enter = () => {
      clearTimeout(out)
      track.style.transition = ''; track.style.transform = ''; track.style.animation = ''   // restarts at rest
      el.classList.remove('is-out'); el.classList.add('is-on')
    }
    const leave = () => {
      if (!el.classList.contains('is-on')) return
      const tx = new DOMMatrixReadOnly(getComputedStyle(track).transform).m41
      track.style.animation = 'none'; track.style.transform = `translateX(${tx}px)`
      const labMid = lab.getBoundingClientRect().left + lab.offsetWidth / 2
      const dir = +getComputedStyle(el).getPropertyValue('--so-dir') || 1
      const pitch = copies.length > 1
        ? Math.abs(copies[1].getBoundingClientRect().left - copies[0].getBoundingClientRect().left) : 0
      // the copy that just passed the label comes back; one approaching within 10% of the
      // pitch finishes forward instead
      let passed = null, approaching = null, pe = Infinity, ae = Infinity
      copies.forEach(c => {
        c.classList.remove('so-landing')
        const r = c.getBoundingClientRect(), e = ((r.left + r.width / 2) - labMid) * dir
        if (e >= -1 && e < pe) { pe = e; passed = c }
        if (e < -1 && -e < ae) { ae = -e; approaching = c }
      })
      const landing = (approaching && ae <= 0.10 * pitch) ? approaching : passed
      const best = landing ? (landing.getBoundingClientRect().left + landing.offsetWidth / 2) - labMid : 0
      if (landing) landing.classList.add('so-landing')
      el.classList.remove('is-on'); el.classList.add('is-out')
      void track.offsetWidth
      track.style.transition = `transform ${LAND_MS}ms cubic-bezier(.2, .8, .2, 1)`
      track.style.transform = `translateX(${tx - best}px)`
      out = setTimeout(() => {
        // the silent reset: the landed picture equals the rest state one pitch over, so the
        // swap happens with every transition off (otherwise the landed copy's sep flashes at
        // the element's edge)
        copies.forEach(c => { c.style.transition = 'none'; c.classList.remove('so-landing') })
        track.style.transition = 'none'; track.style.transform = ''; track.style.animation = ''
        el.classList.remove('is-out')
        void track.offsetWidth
        requestAnimationFrame(() => { copies.forEach(c => { c.style.transition = '' }); track.style.transition = '' })
      }, LAND_MS + 20)
    }
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointerleave', leave)

    el.__wmScrollover = { lab, track, original, enter, leave, stop: () => clearTimeout(out) }
    mounted.add(el)
    measure(el)
    return el
  }

  // the anchor copy's centre meets the label's centre: that translate is the rest state
  function measureOne(el) {
    const s = el.__wmScrollover; if (!s) return
    const a = s.track.querySelector('.so-anchor'), run = s.track.querySelector('.so-run')
    const labMid = s.lab.offsetLeft + s.lab.offsetWidth / 2, aMid = a.offsetLeft + a.offsetWidth / 2
    el.style.setProperty('--so-x0', (labMid - aMid).toFixed(2) + 'px')
    el.style.setProperty('--so-runw', run.getBoundingClientRect().width.toFixed(2) + 'px')
  }
  function measure(el) {
    if (el) return measureOne(el)
    mounted.forEach(e => { if (e.isConnected) measureOne(e); else mounted.delete(e) })
  }

  function unmount(el) {
    const s = el && el.__wmScrollover; if (!s) return
    s.stop()
    el.removeEventListener('pointerenter', s.enter)
    el.removeEventListener('pointerleave', s.leave)
    el.classList.remove('is-on', 'is-out')
    el.style.removeProperty('--so-x0'); el.style.removeProperty('--so-runw')
    s.track.remove()
    ;[...s.lab.childNodes].forEach(n => el.insertBefore(n, s.lab))
    s.lab.remove()
    delete el.__wmScrollover
    mounted.delete(el)
  }

  const auto = () => {
    document.querySelectorAll('[data-scrollover]').forEach(el => { if (!el.__wmScrollover) mount(el) })
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => measure())
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto)
  else auto()
  addEventListener('resize', () => measure())

  window.wmScrollover = { mount, measure, unmount }
})()
