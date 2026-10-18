# The accent-button light

The AVIFs in `assets/accent/` are rendered, not drawn: numpy computes the light, adds dither, and
Pillow writes straight-alpha acid, so the images composite on any dark ground. These are the
scripts as they were run for the ReCal accent prototype (branch `accent-proto`), moved here so the
art can be rebuilt. Output goes to `$ACCENT_OUT` (default `out/`).

```bash
python3 -m venv .venv && .venv/bin/pip install numpy pillow      # Pillow 11.3+ writes AVIF
ACCENT_OUT=out/ .venv/bin/python gen_assets.py     # chip spills, streaks, rim-cap/bot/top (the default falloff)
ACCENT_OUT=out/ .venv/bin/python gen_dl.py         # the q5 pill (225 x 32)
ACCENT_OUT=out/ .venv/bin/python gen_log.py log    # the faster, logarithmic falloff (q6-spill-*-log, q5-under-*-log)
ACCENT_OUT=out/ .venv/bin/python gen_inner.py ship log   # the inner glow: travel sprite and rim pieces, log falloff
```

Re-rendered from this directory the images match the shipped ones to within encoder noise (mean
difference under 0.4 of 255). The dither is seeded, so a render is repeatable. `render.py` and
`sprite.py` made the q6-N4 page's own originals (the streak and the 48-frame travel sprite);
`gen_inner.py` runs `sprite.py` and `gen_assets.py` with only the glow kernel swapped.

| shipped file | source name | script |
| --- | --- | --- |
| `q5-pill.avif` | `q5-under-dl` | `gen_dl.py` (default falloff) |
| `q5-chip.avif` | `q5-under-chip` | `gen_assets.py` (default falloff) |
| `q6n4-spill-pill.avif` | `q6-spill-btn-log` | `gen_log.py log` (227 x 33) |
| `q6n4-spill-chip.avif` | `q6-spill-chip-log` | `gen_log.py log` |
| `q6n4-streak-pill.avif` | `q6-streak-btn` | `render.py` |
| `q6n4-streak-chip.avif` | `q6-streak-chip` | `gen_assets.py` |
| `q6n4-travel-pill.avif` | `q6n4-travel-btn-log` | `gen_inner.py ship log` (from `sprite.py`) |
| `q6n4-rim-bot.avif`, `-top`, `-cap` | `rim-bot-log`, `rim-top-log`, `rim-cap-log` | `gen_inner.py ship log` (from `gen_assets.py`) |

q6n4 ships the log falloff only. Ported from ReCal `accent-proto` at the commit named in the PR.

## q5 in HDR, and q5's light mode

Both start from the light as floats: `capture.py` runs the generators above with hooks in place of their 8-bit
writers (and renders q5's rim, which ships as a CSS gradient in SDR), so every set is the same computed light.
`pq_write.swift` hands 16-bit PQ code values to an `itur_2100_PQ` context untouched; `sips` makes the AVIF.

```bash
ACCENT_CAP=out/cap.npz .venv/bin/python capture.py           # the captured light, out/cap.npz (~40 s)
ACCENT_CAP=out/cap.npz .venv/bin/python capture.py boost     # adds q6n4's boosted spill (q6n4-spillB-*)
ACCENT_CAP=out/cap.npz .venv/bin/python capture.py broad     # adds the light-mode spills' core and shoulder (b5-*)
swiftc -O pq_write.swift -o out/pq_write
ACCENT_CAP=out/cap.npz .venv/bin/python gen_hdr.py           # q5's HDR sets, dark and light, straight to assets/accent/
.venv/bin/python gen_hdr.py clli                             # restamp MaxCLL only (the MAXCLL switch at the top)
ACCENT_CAP=out/cap.npz ACCENT_LIGHT_OUT=out/light/ .venv/bin/python gen_light.py   # light-mode SDR art; ships b-q5-*, b-q6n4-*
ACCENT_CAP=out/cap.npz .venv/bin/python gen_q6n4.py          # q6n4's HDR sets, dark and light, and its light SDR spill
```

| shipped file | what | script |
| --- | --- | --- |
| `q5-hdr-dark-pill.avif`, `-chip` | the spill, opaque PQ, floor #1a1a1a, 17 state frames stacked | `gen_hdr.py` |
| `q5-hdr-dark-rim-pill.avif`, `-chip` | the rim inside the face, opaque PQ, floor #1a1a1a: the SDR rim in linear light, one factor for both pieces, peak 589 | `gen_hdr.py`, or `../hdr/build.sh q5-rim-dark` (with the JXL) |
| `q5-hdr-dark-label.avif` | flat acid PQ field for the label | `gen_hdr.py` |
| `q5-hdr-mask-pill.avif`, `-rim-pill`, `-rim-chip` | footprint masks (straight alpha); the rim masks serve both themes | `gen_hdr.py` |
| `q5-hdr-light-pill.avif`, `-chip` | light mode: the "broad 300" spill (core + shoulder, +200, peak 405), floor #ffffff, 17 state frames | `gen_hdr.py` (from `capture.py broad`) |
| `q5-hdr-light-rim-pill.avif`, `-chip` | light mode: acid rim inside the ink face (floor #161616), the SDR rim's shape, peak 405 | `gen_hdr.py`, or `../hdr/build.sh q5-rim-light` (with the JXL) |
| `q5-hdr-light-label.avif` | light mode: flat acid PQ field at 605 | `gen_hdr.py` |
| `q5-hdr-light-mask-pill.avif` | light mode: footprint of the widest frame (a chip's spill takes none) | `gen_hdr.py` |
| `q6n4-hdr-dark-spill-pill.avif`, `-chip` | the shipped log spill's footprint, floor #1a1a1a, 9 fade frames, peak 398 | `gen_q6n4.py` |
| `q6n4-hdr-dark-rim-cap.avif`, `-rim-bot`, `-rim-top` | the chip's rim pieces on its face (#1a1a1a); cap 47 frames, top 5 fade-in frames | `gen_q6n4.py` |
| `q6n4-hdr-dark-travel-pill.avif` | the 48-frame travel sprite on the pill face (#0a0a0a) | `gen_q6n4.py` |
| `q6n4-hdr-dark-streak-pill.avif`, `-chip` | the bottom streak, 5 fade frames, on each face | `gen_q6n4.py` |
| `q6n4-hdr-light-*` | the same pieces in light mode: the broad-300 spill on #ffffff, the rest on the ink face (#161616), peak 405 | `gen_q6n4.py` |
| `q6n4-hdr-label.avif` | flat acid PQ field at 605 nits, both themes | `gen_q6n4.py` |
| `q6n4-hdr-mask-*` | footprints of the rim pieces, travel and streak (straight alpha), both themes | `gen_q6n4.py` |
| `q6n4-light-spill-pill.avif`, `-chip` | light mode SDR: the boosted spill as an apple colored shadow | `gen_q6n4.py` |
| `q6n4-light-rim-*`, `-travel-pill`, `-streak-*` | light mode SDR: `b-q6n4-*` | `gen_light.py` (copied by `gen_q6n4.py`) |
| `q5-light-pill.avif`, `-chip`, `-rim-pill`, `-rim-chip` | light mode: `b-q5-pill`, `b-q5-chip`, `b-q5-rim-pill`, `b-q5-rim-chip` | `gen_light.py` |

`gen_light.py` renders the whole light proposal (treatments a, b, c and masks); only treatment b's q5 files ship.
Every PQ file carries its true peak as MaxCLL: a stamp below it clips, the 1000 sips writes tone-maps. And every
PQ file has even sides: Chrome decodes a PQ AVIF with an odd width or height as fully transparent (`gen_hdr.write`
asserts it).

To contain the light, give its box `overflow: clip`. Never a mask, `overflow: hidden` on a scroller, opacity, or
transform on an ancestor.

## q5's and q6n4's light in JPEG XL (transparent HDR)

Where the browser decodes JPEG XL (`html.wm-jxl`, set by `src/jxl.js`), q5's light-mode light is a TRANSPARENT HDR
image: light only, straight alpha, no baked floor and no mask, so it sits on any ground with no box
(wm-primitives#133). The AVIF set above stays as the fallback. One command builds it, from the capture, in seconds:

```bash
PYTHON=.venv/bin/python ../hdr/build.sh q5-light                     # JXL to assets/accent/, AVIF from the same arrays to out/hdr-avif/
PYTHON=.venv/bin/python ../hdr/build.sh q5-light --lossless-report   # also near-lossless (-d 0.2) and lossless JXL, for the sizes
PYTHON=.venv/bin/python ../hdr/build.sh q5-dark                      # q5's dark light
PYTHON=.venv/bin/python ../hdr/build.sh q6n4-dark                    # q6n4's light, from gen_q6n4.py's own layers (and q6n4-light)
```

| shipped file | what | made by |
| --- | --- | --- |
| `q5-jxl-light-pill.jxl`, `-chip` | the broad-300 spill, 17 state frames as one sheet, peak 405, Rec.2100 PQ, straight alpha | `tools/hdr/build.sh q5-light` |
| `q5-jxl-light-rim-pill.jxl`, `-chip` | the rim inside the ink face, peak 405 | `tools/hdr/build.sh q5-light` |
| `q6n4-jxl-{dark,light}-spill-pill.jxl`, `-spill-chip` | q6n4's spill, 9 fade frames (dark 399, light 405 / 364) | `tools/hdr/build.sh q6n4-dark`, `q6n4-light` |
| `q6n4-jxl-{dark,light}-travel-pill.jxl` | the 48-frame travel sprite, the pill's streak baked in (dark 605, light 405) | the same |
| `q6n4-jxl-{dark,light}-rim-cap.jxl`, `-rim-bot`, `-rim-top`, `-streak-chip` | the chip's in-face light: end pieces, bottom edge, top edge's 5 frames, the streak's 5 frames | the same |

Every JXL light stores ONE colour, the acid at its true peak (the streak's white-hot core excepted), with all of the
falloff in alpha (`hdr.constant_light()`): the alpha is solved per pixel so the composite over the layer's floor has the
luminance the old encoding gave. Storing the glow's own colour (`glow / max(glow)`) carried the SDR ramp's pale tail
(`gen_assets.finish`'s TAIL, "scattering on a matte surface") and the gamma law's lean toward blue at low levels up to
the peak: a pale ~400-600-nit colour at low alpha, which iPhone Safari tone-mapped into a grey-teal band (wordmark#69).
The AVIF planes keep it; there the tail sits at about 1 nit and cannot show.

`tools/hdr/hdr.py` is the shared encoder (JXL and AVIF from the same float arrays: true-peak stamps, even AVIF sides,
a hash per asset so unchanged ones are skipped, encodes in parallel); `tools/hdr/build.py` holds the targets.
