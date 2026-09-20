/* ── THE COPY ─────────────────────────────────────────────────────────────────────────
 *
 * Every word on the page is in this object and nowhere else. Nothing below it is prose,
 * so a writing pass never touches markup and cannot break the build by editing a tag.
 *
 * ${...} IS A LIVE VALUE FROM THE ENGINE, NOT DECORATION. Those are measured -- the
 * clothoid's four numbers, the fitted residual, the blur radii -- and they change when
 * the engine changes. Keep every one of them; write around them. If a sentence needs a
 * number that is not already in a slot, ask for it rather than typing it in: the whole
 * point of generating this page is that no figure on it can go stale silently.
 *
 * Entities are HTML: &#8212; em dash, &#8594; arrow, &#183; middot, &#916; delta.
 * Inline markup allowed in notes: <b> (reads as emphasis, not weight) and <code>.
 *
 * House voice, from the rest of this repo: state the thing, then why it is that way, and
 * name the failure it came from. Numbers over adjectives. No hedging, no "simply", no
 * "just". A sentence earns its place by saying something that was not obvious.
 *
 * THIS FILE IS THE ONLY ONE A WRITING PASS TOUCHES. build-ramps.mjs is machinery: it
 * computes the measured values, draws the markup and writes the page. Keeping the two
 * apart means a copy edit cannot break the build and two people can work at once.
 *
 * `v` carries the live values -- measured, and they move when the engine moves.
 * ────────────────────────────────────────────────────────────────────────────────── */
export const copy = v => ({

  title: `Ramps`,
  lede: `One curve, three channels. The alpha of a scrim, the colour of a blend and the radius of a blur are the same cubic B&#233;zier applied to different quantities &#8212; one sampler and three emitters, not three engines. Every gradient on this page is a string emitted by <code>src/gradient.ts</code>; none of it is typed in.`,
  c1_title: `The curve`,
  c1_tag: `cubic-bezier(${v.EASES.clothoid.join(', ')})`,
  c2_title: `The edge`,
  c2_tag: `why linear will not do`,
  c3_title: `Where you mix`,
  c3_tag: `the midpoint, four spaces`,
  c4_title: `Steering a channel`,
  c4_tag: `Mass Driver's schema`,
  c5_title: `Progressive blur`,
  c5_tag: `${v.radii.join(' &#183; ')} px`,
  c6_title: `Banding`,
  c6_tag: `8-bit, and what the engine cannot fix`,
  note1: `Two CodePens make the same fade by hand, seven stops written out one at a time. Fitting a <code>cubic-bezier()</code> to those seven numbers lands within <b>${v.worst.toFixed(4)}</b> of every one of them, RMS <b>${v.rms.toFixed(5)}</b> &#8212; about a third of one step in 8-bit. The hand-written version and the curve are the same fade, so the clothoid is a preset here, not a code path. The white dots are where the eight default stops fall: they crowd toward the transparent end, because the curve is sampled by its own parameter rather than at even positions.`,
  note2: `Interpolate alpha in a straight line and it does not read as straight: perceived lightness moves fastest at the transparent end, so the fade announces itself where it starts and then crawls. Against the unveiled panel, both scrims fade the same colour over the same text across the same distance &#8212; only the curve differs. This is the whole argument for the file.`,
  note3: `The received wisdom is that oklab rescues a gradient from the grey midpoint sRGB gives you. <b>It does not.</b> A straight line between opposite hues passes through the neutral axis in any rectangular space, because that is where the axis is. What oklab buys is even <b>lightness</b>. Only <b>oklch</b> holds the chroma, by interpolating hue as an angle and going around rather than through &#8212; at the cost of a hue nobody picked. The default stays oklab because it is the predictable one.`,
  note4: `One curve on the interpolation re-spaces the stops <b>along</b> a fixed path through colour space. A curve <b>per channel</b> moves the path itself. Below left: the same two colours with one channel steered at a time &#8212; the ramp leaves the straight line between its endpoints, which is how the tool escapes sRGB's mud without changing space. Below right: the three graphs for <code>${v.MD_A}</code> &#8594; <code>${v.MD_B}</code>, plotted on each channel's own axis. R falls, B rises, and <b>G does not move at all</b> &#8212; which is why that pair never goes grey, and why a curve on G there does nothing.`,
  note5: `variablur's effect, as a stack of masked backdrop layers. Each layer owns <b>one band</b> at full opacity carrying that band's absolute radius &#8212; not a cumulative stack, which ghosts: <code>backdrop-filter</code> blurs what is behind the layer, so at partial mask alpha the compositor blends a blurred copy over the still-sharp original and live text shows a double image. Bands are evenly spaced; only the radius follows the curve. The right-hand panel holds the first lines with <code>start</code>, because the smallest stop in the stack still lands inside the first line's ascenders otherwise.`,
  note6: `It blurs pixels; it does not redact. The words stay in the DOM &#8212; selectable, copyable, findable, and read aloud in full by a screen reader, which sees no blur at all. Never use it to withhold anything.`,
  note7: `A ramp crossing ~94 of the 256 available levels over 190px spends about two pixels per level, and the eye finds those edges. <b>More stops cannot help</b> &#8212; an 8-stop ramp and a 2-stop ramp band identically. Nothing in CSS asks for more output bits, so sub-level noise is the only control there is, and every band on this page carries it. The bands below cross a narrow slice of the range at full width, so each level lands wide enough to point at.`,
  note8: `Mostly you do not need it: Skia already dithers a background gradient and very nearly does not dither a mask &#8212; the same ramp measures a per-pixel deviation of <b>2.98</b> as <code>background-image</code> against <b>0.22</b> as <code>mask-image</code>. So a scrim is dithered for you and a mask over a flat ground is not, which is the one place in this package that bands.`,
  ctl_stops: `stops`,
  ctl_radius: `radius`,
  ctl_layers: `layers`,
  ctl_hold: `hold`,
  ctl_dither: `dither`,
  cap1: `alpha against position &#183; dots = the engine's stops`,
  cap2: `the pens' seven stops, against the fitted curve`,
  cap3a: `no scrim &#183; the control`,
  cap3: `linear`,
  cap4: `clothoid &#183; the default`,
  cap5: `start 0`,
  cap6: `start 'calc(12px + 2lh)'`,
  cap7: `a narrow alpha range over a wide box &#183; no dither &#183; the terraces are the bug`,
  cap8: `the same ramp, the same levels, with .wm-dither`,
})
