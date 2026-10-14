"""Fast-falloff (log-feeling) variants of the Q5 / Q6 spill renders. Same geometry, canvases, weights,
dither and colour drift as the current renders; only the radial falloff law changes:
   I(d) = I0 * (.55 exp(-d/t1) + .45 exp(-d/t2)), windowed to zero well inside the canvas.
I0 is the same edge intensity as the current falloff (sum of its amplitudes)."""
import numpy as np, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_assets as ga
VAR = {'log': dict(t=(3.0, 9.0), reach=40.0), 'log2': dict(t=(2.0, 5.5), reach=26.0)}
cur = None
ORIG = ga.falloff
ONLY = sys.argv[1:] or list(VAR) 
def make(v):
    def falloff(d, a, r, p, reach):
        d = np.maximum(d, 0); I0 = sum(a)
        I = I0 * (0.55 * np.exp(-d / v['t'][0]) + 0.45 * np.exp(-d / v['t'][1]))
        rc = v['reach']; w = np.clip((rc - d) / (rc * 0.5), 0, 1); w = w * w * (3 - 2 * w)
        return I * w
    return falloff
VAR['mid'] = dict(t=None, reach=None)
def make_mid():
    lg = make(VAR['log'])
    # halfway in LOG intensity between the original falloff and the log one (geometric mean), same window logic
    return lambda d, a, r, p, reach: np.sqrt(ORIG(d, a, r, p, reach) * lg(d, a, r, p, reach))
for name, v in VAR.items():
    if name not in ONLY: continue
    ga.falloff = make_mid() if name == 'mid' else make(v)
    ga.OUT = os.environ.get('ACCENT_OUT', 'out/')
    ga.PREV = ga.OUT + 'prev-' + name + '/'; os.makedirs(ga.PREV, exist_ok=True)
    orig = ga.save
    def save(img, nm, orig=orig, name=name): orig(img, nm + '-' + name)
    ga.save = save
    ga.R = 16.0; ga.q5('q5-under-dl', 225, 32, 'btn')          # ?=1 Download (pill, 225x32)
    ga.R = 16.5; ga.q6_spill('q6-spill-btn', 227, 33, 'btn')    # ?=2 Download (the page's 227x33 pill)
    ga.R = 8.0
    ga.q5('q5-under-chip', 96, 32, 'chip'); ga.q6_spill('q6-spill-chip', 96, 32, 'chip')
    ga.save = orig
