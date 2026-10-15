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
ACCENT_CAP=out/cap.npz .venv/bin/python capture.py broad     # adds the light-mode spill's core and shoulder (b5-q5-*)
swiftc -O pq_write.swift -o out/pq_write
ACCENT_CAP=out/cap.npz .venv/bin/python gen_hdr.py           # q5's HDR sets, dark and light, straight to assets/accent/
.venv/bin/python gen_hdr.py clli                             # restamp MaxCLL only (the MAXCLL switch at the top)
ACCENT_CAP=out/cap.npz ACCENT_LIGHT_OUT=out/light/ .venv/bin/python gen_light.py   # light-mode SDR art; ships b-q5-*
```

| shipped file | what | script |
| --- | --- | --- |
| `q5-hdr-dark-pill.avif`, `-chip` | the spill, opaque PQ, floor #1a1a1a, 17 state frames stacked | `gen_hdr.py` |
| `q5-hdr-dark-rim-pill.avif`, `-chip` | the rim inside the face, opaque PQ, floor #1a1a1a | `gen_hdr.py` |
| `q5-hdr-dark-label.avif` | flat acid PQ field for the label | `gen_hdr.py` |
| `q5-hdr-mask-pill.avif`, `-rim-pill`, `-rim-chip` | footprint masks (straight alpha); the rim masks serve both themes | `gen_hdr.py` |
| `q5-hdr-light-pill.avif`, `-chip` | light mode: the "broad 300" spill (core + shoulder, +400, peak 605), floor #ffffff, 17 state frames | `gen_hdr.py` (from `capture.py broad`) |
| `q5-hdr-light-rim-pill.avif`, `-chip` | light mode: acid rim inside the ink face (floor #161616), peak 605 | `gen_hdr.py` |
| `q5-hdr-light-label.avif` | light mode: flat acid PQ field at 605 | `gen_hdr.py` |
| `q5-hdr-light-mask-pill.avif`, `-chip` | light mode: footprints of the widest frame (the chip's is a 9-slice mask) | `gen_hdr.py` |
| `q5-light-pill.avif`, `-chip`, `-rim-pill`, `-rim-chip` | light mode: `b-q5-pill`, `b-q5-chip`, `b-q5-rim-pill`, `b-q5-rim-chip` | `gen_light.py` |

`gen_light.py` renders the whole light proposal (treatments a, b, c and masks); only treatment b's q5 files ship.
Every PQ file carries its true peak as MaxCLL: a stamp below it clips, the 1000 sips writes tone-maps.
