"""Light-mode proposal, SDR: the captured light (capture.py) written as straight-alpha, dithered
AVIF in the light-mode signal, exactly the way the dark set is written -- only the palette and
the gain change. Never acid: the light ground's signal is granny apple, #96d500 fill and #557b00
ink; every colour below is one of those two, mixed, or the ink token #161616.

  a-*   (a) light face, apple light   the spill and the rim tuned to read on white
  b-*   (b) ink on paper              a deeper apple spill (a coloured shadow) and an apple rim inside the ink face
  c-*   (c) inset                     the light pooled inside a recess; the recess itself
  m-*   masks: the SAME render's alpha at gain 1 (white rgb), for gen_hdr's route 2
Output: $ACCENT_LIGHT_OUT (default out/light/)."""
import numpy as np, os, sys
from PIL import Image
OUT = os.environ.get('ACCENT_LIGHT_OUT', 'out/light/'); os.makedirs(OUT, exist_ok=True)
CAPF = os.environ.get('ACCENT_CAP', 'out/cap.npz')
rng = np.random.default_rng(23)
APPLE = np.array([150, 213, 0], np.float32)     # --signal (light)      #96d500
INK = np.array([85, 123, 0], np.float32)        # --signal-ink (light)  #557b00
TEXT = np.array([22, 22, 22], np.float32)       # --text (light)        #161616
WHITE = np.array([255, 255, 255], np.float32)
mix = lambda a, b, t: a * (1 - t) + b * t

def write(A, W, pal, gain, name):
    """A: alpha float, W: core/tail/hot weights, pal: 3 x rgb. Triangular dither, as finish() does."""
    rgb = W @ np.stack(pal)
    n = lambda: rng.random(A.shape) + rng.random(A.shape) - 1.0
    a8 = np.clip(np.rint(np.clip(A * gain, 0, 1) * 255 + n()), 0, 255)
    c8 = np.clip(np.rint(rgb + np.stack([n(), n(), n()], -1)), 0, 255)
    img = np.dstack([c8, a8]).astype(np.uint8)
    Image.fromarray(img, 'RGBA').save(OUT + name + '.avif', quality=92, speed=4)
    return os.path.getsize(OUT + name + '.avif')

SPILLS = ('q5-pill', 'q5-chip', 'q6n4-spill-pill', 'q6n4-spill-chip')
INFACE = ('q6n4-streak-pill', 'q6n4-streak-chip', 'q6n4-rim-cap', 'q6n4-rim-bot', 'q6n4-rim-top', 'q6n4-travel-pill', 'q5-rim-pill', 'q5-rim-chip')
PLAN = {
    # (a) light face. Spill: deepest at the edge (a third of the way to the ink), apple in the tail.
    'a': [(SPILLS[:2], (mix(APPLE, INK, .35), APPLE, APPLE), 2.3),
          (SPILLS[2:], (mix(APPLE, INK, .35), APPLE, APPLE), 2.0),
          # the rim on a white face: apple, its hot core toward the ink rather than toward white
          (INFACE, (mix(APPLE, INK, .2), APPLE, mix(APPLE, INK, .6)), 1.15)],
    # (b) ink on paper. Spill: a coloured shadow, half way to the ink at the edge. Rim: light on black, so apple with a pale hot core.
    'b': [(SPILLS[:2], (mix(APPLE, INK, .5), APPLE, APPLE), 2.3),
          (SPILLS[2:], (mix(APPLE, INK, .5), APPLE, APPLE), 2.0),
          (INFACE, (APPLE, mix(APPLE, INK, .3), mix(APPLE, WHITE, .5)), 1.0)],
    # (c) inset. The under-glow inside the recess; the recess in the ink; q6n4's travelling rim is (a)'s.
    'c': [(('q5-under-pill', 'q5-under-chip'), (mix(APPLE, INK, .2), APPLE, APPLE), 1.0),
          (('well-q5-pill', 'well-q6n4-pill', 'well-chip'), (TEXT, TEXT, TEXT), 1.0)],
}

if __name__ == '__main__':
    z = np.load(CAPF)
    get = lambda k: (z[k + '|A'], z[k + '|W'])
    for t, jobs in PLAN.items():
        for names, pal, gain in jobs:
            for nm in names:
                A, W = get(nm); kb = write(A, W, pal, gain, f'{t}-{nm}') / 1024
                print(f'{t}-{nm:20s} {A.shape[1]:4d} x {A.shape[0]:5d}  {kb:6.1f} KB')
    # masks for HDR route 2: the same render's alpha, gain 1, nothing else
    for nm in SPILLS + INFACE:
        A, W = get(nm); kb = write(A, W, (WHITE, WHITE, WHITE), 1.0, 'm-' + nm) / 1024
        print(f'm-{nm:22s} {kb:6.1f} KB')
