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
