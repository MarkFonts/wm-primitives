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
  lede: `One curve, three channels. A scrim's alpha, a blend's colour and a blur's radius are one cubic B&#233;zier applied to three quantities: one sampler, three emitters, no third engine. Every gradient on this page is a string <code>src/gradient.ts</code> emitted; nothing here is typed in, so nothing here can go stale on its own.`,

  c1_title: `The curve`,
  c1_tag: `cubic-bezier(${v.EASES.clothoid.join(', ')})`,
  c2_title: `The edge`,
  c2_tag: `where a fade announces itself`,
  c3_title: `Where you mix`,
  c3_tag: `the midpoint, four spaces`,
  c4_title: `Steering a channel`,
  c4_tag: `Mass Driver's schema`,
  c5_title: `Progressive blur`,
  c5_tag: `${v.radii.join(' &#183; ')} px`,
  c6_title: `Banding`,
  c6_tag: `8-bit, and what no curve can fix`,

  note1: `Two CodePens make this fade by hand: seven stops, each typed in. A <code>cubic-bezier()</code> fitted to those seven lands within <b>${v.worst.toFixed(4)}</b> of every one, RMS <b>${v.rms.toFixed(5)}</b> &#8212; a third of one step in 8-bit. The fit is measured, not asserted, and it means the clothoid is a <b>preset</b> here, not a code path: the hand-written fade and the curve are the same fade. The white dots are the eight default stops. They crowd toward the transparent end because the curve is sampled by its own parameter, not at even positions &#8212; which is where the pens' own stops crowd too.`,

  note2: `A straight alpha ramp does not read as straight. Perceived lightness moves fastest at the transparent end, so a linear fade announces itself where it starts and then crawls; on live text that is a visible line across the second row of type, and it is the failure this curve was fitted to remove. The unveiled panel is the control: both scrims fade the same colour over the same text across the same distance, and only the curve differs.`,

  note3: `The received wisdom is that oklab rescues a gradient from the grey sRGB puts at its midpoint. <b>It does not.</b> For the pair above, the midpoint's saturation is <b>${v.sat.srgb}%</b> in sRGB and <b>${v.sat.oklab}%</b> in oklab: a straight line between opposite hues crosses the neutral axis in <b>any</b> rectangular space, because that is where the axis is. What oklab buys is even <b>lightness</b> &#8212; the red&#8594;green midpoint sits at luma ${v.luma.oklab} against sRGB's ${v.luma.srgb}, so the ramp no longer dips dark in the middle. Only <b>oklch</b> holds chroma, <b>${v.sat.oklch}%</b> at the same midpoint, by treating hue as an angle and going around the axis instead of through it; it pays with a hue nobody picked. The default stays oklab, the predictable one. The first draft of this page had the claim the wrong way round.`,

  note4: `One curve on the interpolation re-spaces the stops <b>along</b> a fixed path through colour space. A curve <b>per channel</b> moves the path. Left: the same two colours with one channel steered at a time &#8212; the ramp leaves the straight line between its endpoints, which is how a ramp escapes sRGB's grey without changing space. Right: the three channels of <code>${v.MD_A}</code> &#8594; <code>${v.MD_B}</code>, each on its own axis. R falls, B rises, and <b>G does not move</b>. That flat channel is why the pair never greys, and why steering G on it does nothing at all. <code>channelBlend()</code> reproduces Mass Driver's published output byte for byte; the equality is a test.`,

  note5: `variablur's effect as a stack of masked backdrop layers, each owning <b>one band</b> at full opacity with that band's absolute radius. Not a cumulative stack: that one <b>ghosts</b>. <code>backdrop-filter</code> blurs what is behind the layer, so at partial mask alpha the compositor blends a blurred copy over the still-sharp original and live text doubles. Bands are evenly spaced; only the radius follows the curve, and the default curve holds the start &#8212; text stops being legible around 4px, and the first band has to stay under that. The right-hand panel also holds the first lines with <code>start</code>: without it the smallest radius in the stack lands inside the first line's ascenders.`,

  /* note5b: the line under c5's radius table for while the two blur panels are withdrawn
     (2026-09-20: the stack renders as a uniform blur in the assembled page; mask-image is
     not clipping backdrop-filter there, cause not yet isolated). Wired by the generator
     only while the panels are out. cap5 and cap6 stay: the panels come back the moment
     blurLayers is fixed, and their captions should not be a writing job again. */
  note5b: `The two panels that belong here are withdrawn. In the assembled page the stack renders as one uniform blur from the first line to the last &#8212; sharpness measured flat at ${v.blur.smeared} down the panel, against ${v.blur.sharpLo}&#8211;${v.blur.sharpHi} with the stack hidden &#8212; so the figure showed a smear where the technique makes a progression, and a figure that misrepresents the technique is worse than none. The radii above are still the engine's; the panels return when the layer stack is fixed.`,

  note6: `It blurs pixels. It does not redact. The words stay in the DOM &#8212; selectable, copyable, findable, and read aloud in full by a screen reader, which sees no blur. Never use it to withhold anything.`,

  note7: `Eight bits give 256 levels of alpha, and one step between neighbours is about the same faint edge wherever it sits &#8212; <b>${v.band.dLdark}</b> &#916;L* at the dark end of the rows below, <b>${v.band.dLlight}</b> at the light end &#8212; and one edge that size is under what an eye resolves. Banding is not the edge. It is the <b>repetition</b>: steps close enough to read as a pattern, far enough apart not to fuse. Visibility peaks; it is not a slope. The control crosses <b>${v.band.steepLevels}</b> levels at <b>${v.band.steepPerLevel}px</b> each and fuses into a smooth ramp. The dark fade crosses <b>${v.band.levels}</b> at <b>${v.band.perLevel}px</b> each and bands unmistakably. Push the same steps out to 155px apart, as the previous draft of this chapter did, and the field goes flat and the edges vanish with it. <b>More stops cannot help</b>: an 8-stop ramp and a 2-stop ramp quantise to the same levels and band identically, and nothing in CSS asks for more output bits. Tone matters on its own: the third row has the same ${v.band.lightLevels} levels at the same ${v.band.lightPerLevel}px and a per-step &#916;L* within a twentieth of the dark row's, and it is clean. CIELAB is uniform for small patches, not for a one-level edge run across a wide smooth field, which is why every banding complaint is about the dark end.`,

  note8: `Mostly you do not need it. Skia dithers a <code>background-image</code> gradient and very nearly does not dither a <code>mask-image</code>: the same ramp measures a per-pixel deviation of <b>${v.dither.bg}</b> as a background against <b>${v.dither.mask}</b> as a mask. So a scrim is dithered for you, a mask over a flat ground is not, and that mask is the one place in this package that bands. <code>.wm-dither</code> goes <b>after</b> the quantiser, on the wrapper: inside the masked element the noise modulated the ink before the mask touched it and measurably did nothing. After the quantiser is also its limit. It composites over the steps rather than preventing them, so it breaks the widest identical run from <b>${v.band.run}px</b> to <b>${v.band.dithered}px</b> and hides the edge, but the one-level step survives in the column mean, <b>${v.band.jumpDither}</b> against the mask's <b>${v.band.jumpMask}</b>, and turning it up adds noise faster than it removes step. The background row is the one that halves the step itself, to <b>${v.band.jumpBg}</b>, because Skia dithers before it quantises. The first draft of this chapter said dither removes the staircase; the second said wide terraces are what make it visible. Both were wrong, and both were measured wrong before they were written wrong. <b>Nothing here makes a ${v.band.levels}-level fade at this density disappear.</b> The fix that works is a ramp that fuses or a scrim Skia dithers, not a mask across a wide dark field. Judge this chapter on a real display at 100%: a downscaled screenshot averages the steps away.`,

  ctl_stops: `stops`,
  ctl_radius: `radius`,
  ctl_layers: `layers`,
  ctl_hold: `hold`,
  ctl_dither: `dither`,

  cap1: `alpha against position &#183; dots = the engine's stops`,
  cap2: `the pens' seven stops against the fitted curve &#183; residual per stop`,
  cap3a: `no scrim &#183; the control`,
  cap3: `linear &#183; the line shows on row two`,
  cap4: `clothoid &#183; the default`,
  cap5: `start 0`,
  cap6: `start 'calc(12px + 2lh)' &#183; the first lines held`,
  cap7a: `the control &#183; alpha 0 &#8594; 1 &#183; ${v.band.steepLevels} levels at ${v.band.steepPerLevel}px &#183; too dense to separate &#183; fuses`,
  cap7b: `the same endpoints as a <code>background-image</code> &#183; Skia dithers before it quantises &#183; the step itself halves, to ${v.band.jumpBg}`,
  cap7: `the dark fade as a mask over flat ground &#183; ${v.band.levels} levels at ${v.band.perLevel}px &#183; column step ${v.band.jumpMask} &#183; bands`,
  cap7c: `the same ${v.band.lightLevels} levels at the same ${v.band.lightPerLevel}px, at the light end &#183; &#916;L* per step ${v.band.dLlight} against the dark row's ${v.band.dLdark} &#183; clean`,
  cap8: `the mask with <code>.wm-dither</code> on the wrapper &#183; widest run ${v.band.run}px &#8594; ${v.band.dithered}px, the step survives at ${v.band.jumpDither} &#183; hidden, not removed`,
})
