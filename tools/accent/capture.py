"""Light-mode proposal: CAPTURE the accent light as floats, from the shipped generators.

Runs gen_assets.py / sprite.py (and gen_log / gen_inner's falloff swaps) with hooks in place of
their 8-bit writers, so every light-mode output -- the SDR tints, the PQ renders, the masks --
comes from the SAME computed light. The colour ramp is captured as weights: ACID, TAIL and the
streak's hot core are set to the unit vectors (1,0,0), (0,1,0), (0,0,1) before running, so the
captured "rgb" IS the mix of core / tail / hot at every pixel, and any palette is one matrix
multiply away (palettes live in gen_light.py and gen_hdr.py).

Also adds the three pieces of light the dark version does not render:
  q5 face rim   the q5 bottom rim, which ships as a CSS linear gradient; here it is rendered
                (pill 225 x 33, chip 96 x 33 for a 9-slice) so the HDR face can carry it
  under glow    (c) inset: the q5 light pooled INSIDE the face, rising from the bottom edge
  well          (c) inset: the recess -- a soft inner occlusion along the top edge and a hairline
Output: $ACCENT_CAP (default out/cap.npz)."""
import numpy as np, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
CAP = {}
UNIT = "np.array([1, 0, 0], np.float32)", "np.array([0, 1, 0], np.float32)", "np.array([0, 0, 1], np.float32)"

def src_of(fname, cut):
    s = open(os.path.join(HERE, fname)).read()
    return s[:s.index(cut)] if cut else s

def unitise(s):
    s = s.replace("np.array([238, 255, 65], np.float32)", UNIT[0]).replace("np.array([186, 214, 108], np.float32)", UNIT[1])
    s = s.replace("np.array([255, 255, 240], np.float32)", UNIT[2]).replace("np.array([255, 255, 235], np.float32)", UNIT[2])
    return s

# ---------- gen_assets: blooms (q5 / q6 spills), streaks, rim pieces ----------
def ga_ns(kernel=None):
    s = unitise(src_of('gen_assets.py', "if __name__"))
    s = s.replace("os.makedirs(PREV, exist_ok=True)", "")
    # streak: hand the float light to the hook instead of writing it
    old = "    save(np.dstack([np.rint(rgb), a8]).astype(np.uint8), name)\n"
    assert old in s; s = s.replace(old, "    HOOK(name, np.clip(I, 0, 1), rgb)\n")
    # rim pieces: every frame passes through to8(A, C) -- record it, then let the original run on
    old = "    def to8(A, C):\n"
    assert old in s; s = s.replace(old, "    def to8(A, C):\n        HOOK_TO8(A, C)\n")
    for o in ("Image.fromarray(strip, 'RGBA').save(OUT + 'rim-cap.avif', quality=90, speed=4)",
              "Image.fromarray(strip, 'RGBA').save(PREV + 'rim-cap.png')",
              "print('rim-cap', strip.shape, round(os.path.getsize(OUT + 'rim-cap.avif') / 1024, 1), 'KB')",
              "Image.fromarray(img, 'RGBA').save(OUT + nm + '.avif', quality=90, speed=4)",
              "Image.fromarray(img, 'RGBA').save(PREV + nm + '.png')",
              "print(nm, img.shape, round(os.path.getsize(OUT + nm + '.avif') / 1024, 1), 'KB')"):
        assert o in s, o; s = s.replace(o, "pass")
    if kernel:
        old = "Kg = sum(w / (1 + d2 / (r * r)) ** 1.5 for w, r in zip(wk, r0)).astype(np.float32)"
        assert old in s; s = s.replace(old, "Kg = KG(d2)")
    ns = {'__name__': 'ga', 'KG': kernel, 'HOOK': None, 'HOOK_TO8': None}
    exec(compile(s, 'gen_assets.py', 'exec'), ns)
    ns['finish'] = lambda alpha, tdist, name, scale_tail=40.0: CAP.__setitem__(name, _ramp(alpha, tdist, scale_tail))
    ns['HOOK'] = lambda name, I, rgb: CAP.__setitem__(name, (I.astype(np.float32), rgb.astype(np.float32)))
    return ns

def _ramp(alpha, tdist, scale_tail):        # gen_assets.finish's colour drift, as weights
    t = np.clip(tdist / scale_tail, 0, 1)[..., None]; t = t * t * (3 - 2 * t)
    W = np.concatenate([1 - t, t, np.zeros_like(t)], -1)
    return alpha.astype(np.float32), W.astype(np.float32)

def log_falloff():                           # gen_log.py's 'log' variant, verbatim
    t1, t2, rc = 3.0, 9.0, 40.0
    def falloff(d, a, r, p, reach):
        d = np.maximum(d, 0); I0 = sum(a)
        I = I0 * (0.55 * np.exp(-d / t1) + 0.45 * np.exp(-d / t2))
        w = np.clip((rc - d) / (rc * 0.5), 0, 1); w = w * w * (3 - 2 * w)
        return I * w
    return falloff

def run_blooms():
    ns = ga_ns()
    ns['R'] = 16.0; ns['q5']('q5-pill', 225, 32, 'btn')                  # = q5-pill.avif (gen_dl.py)
    ns['R'] = 8.0;  ns['q5']('q5-chip', 96, 32, 'chip')                  # = q5-chip.avif (gen_assets.py)
    ns['falloff'] = log_falloff()
    ns['R'] = 16.5; ns['q6_spill']('q6n4-spill-pill', 227, 33, 'btn')    # = q6n4-spill-pill.avif (gen_log.py log)
    ns['R'] = 8.0;  ns['q6_spill']('q6n4-spill-chip', 96, 32, 'chip')    # = q6n4-spill-chip.avif
    ns['q6_streak']('q6n4-streak-pill', 227, 6)                          # render.py's q6_streak is the same code
    ns['q6_streak']('q6n4-streak-chip', 160, 5)

def run_rim():
    import gen_inner
    ns = ga_ns(kernel=gen_inner.kern('log'))
    got = []
    ns['HOOK_TO8'] = lambda A, C: got.append((A.copy(), C.copy()))
    ns['OUT'] = os.environ.get('TMPDIR', '/tmp') + '/'; ns['PREV'] = ns['OUT']
    ns['rimpieces']()
    NF = ns['NF']; H2 = ns['H'] * ns['S']
    capA = np.concatenate([g[0] for g in got[:NF]], 0); capW = np.concatenate([g[1] for g in got[:NF]], 0)
    CAP['q6n4-rim-cap'] = (capA.astype(np.float32), capW.astype(np.float32))
    CAP['q6n4-rim-bot'] = (got[NF][0].astype(np.float32), got[NF][1].astype(np.float32))
    CAP['q6n4-rim-top'] = (got[NF + 1][0].astype(np.float32), got[NF + 1][1].astype(np.float32))

def run_sprite():
    import gen_inner
    s = unitise(src_of('sprite.py', "build('q6n4-travel-btn'"))
    old = "        A = A * inside\n"
    assert old in s; s = s.replace(old, old + "        HOOK_SPR(A.reshape(H2, W2), rgb.reshape(H2, W2, 3))\n")
    old = "g = sum(w / (1 + d2 / (r * r)) ** 1.5 for w, r in zip(wk, r0))"
    assert old in s; s = s.replace(old, "g = KG(d2)")
    for o in ("im.save(path, quality=90, speed=4)",
              "Image.fromarray(np.concatenate([frames[i] for i in (0, N // 4, N // 2, 3 * N // 4, N - 6, N - 1)], 0), 'RGBA').save(f'{OUT}prev-{name}.png')",
              "print(name, strip.shape, round(os.path.getsize(path) / 1024, 1), 'KB')"):
        assert o in s, o; s = s.replace(o, "pass")
    fr = []
    ns = {'__name__': 'spr', 'KG': gen_inner.kern('log'), 'HOOK_SPR': lambda A, C: fr.append((A.copy(), C.copy()))}
    a = sys.argv; sys.argv = ['sprite.py']; exec(compile(s, 'sprite.py', 'exec'), ns); sys.argv = a
    ns['build']('q6n4-travel-pill', 227, 33)                             # = q6n4-travel-pill.avif (gen_inner ship log)
    CAP['q6n4-travel-pill'] = (np.concatenate([f[0] for f in fr], 0).astype(np.float32),
                               np.concatenate([f[1] for f in fr], 0).astype(np.float32))

# ---------- the new light: rendered along the outline with the shipped rim kernels ----------
S = 2
def sdf_rrect(x, y, cx, cy, hw, hh, r):
    qx = np.abs(x - cx) - (hw - r); qy = np.abs(y - cy) - (hh - r)
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r

def outline(w, h, R, ds=0.5):
    """points round a w x h rounded rect, radius R, ~ds apart"""
    a = w - 2 * R; b = h - 2 * R
    segs = []
    n = lambda L: max(1, int(np.ceil(L / ds)))
    for i in range(n(a)): segs.append((R + (i + .5) * a / n(a), h))           # bottom
    for i in range(n(a)): segs.append((R + (i + .5) * a / n(a), 0.0))         # top
    for i in range(n(b)): segs.append((0.0, R + (i + .5) * b / n(b))); segs.append((w, R + (i + .5) * b / n(b)))
    q = np.pi * R / 2
    for k in range(n(q)):
        th = (k + .5) / n(q) * np.pi / 2
        for cx, cy, sx, sy in ((R, R, -1, -1), (w - R, R, 1, -1), (R, h - R, -1, 1), (w - R, h - R, 1, 1)):
            segs.append((cx + sx * R * np.sin(th), cy + sy * R * np.cos(th)))
    return np.array(segs, np.float32)

def edge_light(name, w, h, R, wfun, peak, ring, kernel, depth=15.0):
    """light (or shadow) laid along the outline with weights wfun(px, py), seen from INSIDE: the
    same construction as sprite.py -- a glow kernel Kg and a 0.85px rim ring Kr, calibrated so a
    fully weighted edge gives `peak` at 1.5px in and `ring` on the edge, windowed at `depth`"""
    W2, H2 = int(w * S), int(h * S)
    ys, xs = np.mgrid[0:H2, 0:W2].astype(np.float32); xs = ((xs + .5) / S).ravel(); ys = ((ys + .5) / S).ravel()
    pts = outline(w, h, R); wt = wfun(pts[:, 0], pts[:, 1]).astype(np.float32)
    dep = (-sdf_rrect(xs, ys, w / 2, h / 2, w / 2, h / 2, R)).astype(np.float32)
    inside = np.clip(dep * S + 0.5, 0, 1)
    G = np.zeros(xs.size, np.float32); Rr = np.zeros(xs.size, np.float32)
    Gu = np.zeros(xs.size, np.float32); Ru = np.zeros(xs.size, np.float32)
    for c0 in range(0, xs.size, 4000):
        sl = slice(c0, c0 + 4000)
        d2 = (xs[sl, None] - pts[None, :, 0]) ** 2 + (ys[sl, None] - pts[None, :, 1]) ** 2
        K = kernel(d2); Kr = np.exp(-d2 / (0.85 ** 2))
        G[sl] = K @ wt; Rr[sl] = Kr @ wt; Gu[sl] = K.sum(1); Ru[sl] = Kr.sum(1)
    # calibrate against a fully weighted straight edge: bottom centre
    ib = (int(round((h - 1.5) * S - .5))) * W2 + W2 // 2; ir = (int(round((h - .5) * S - .5))) * W2 + W2 // 2
    sg = peak / max(Gu[ib], 1e-9); sr = ring / max(Ru[ir], 1e-9)
    wnd = np.clip((depth - dep) / (depth * 0.45), 0, 1); wnd = wnd * wnd * (3 - 2 * wnd)
    A = (1 - (1 - np.clip(G * sg * wnd, 0, 1)) * (1 - np.clip(Rr * sr, 0, 0.6))) * inside
    t = np.clip(dep / depth, 0, 1); t = (t * t * (3 - 2 * t))[:, None]
    Wt = np.concatenate([1 - t, t, np.zeros_like(t)], -1)
    CAP[name] = (A.reshape(H2, W2).astype(np.float32), Wt.reshape(H2, W2, 3).astype(np.float32))

def lorentz(d2):   # the original rim glow kernel (q5's falloff family)
    return sum(wk / (1 + d2 / (r * r)) ** 1.5 for wk, r in zip((0.5, 0.32, 0.18), (1.3, 4.2, 10.0)))

def run_new():
    import gen_inner
    logk = gen_inner.kern('log')
    def bottom(h, R):   # the bottom edge and lower corners, fading up the short sides
        return lambda px, py: np.clip((py - (h - R - 2)) / (R + 2), 0, 1) ** 1.5
    def top(h, R):
        return lambda px, py: np.clip(((R + 2) - py) / (R + 2), 0, 1) ** 1.5
    allw = lambda px, py: np.ones_like(px)
    # q5 face rim (shipped as a CSS gradient: 38% at the edge, 12% at 14% up, 0 by 42%): face is 1px proud
    edge_light('q5-rim-pill', 225, 33, 16.5, bottom(33, 16.5), peak=0.22, ring=0.30, kernel=lorentz, depth=14)
    edge_light('q5-rim-chip', 96, 33, 8.0, bottom(33, 8.0), peak=0.22, ring=0.30, kernel=lorentz, depth=14)
    # (c) inset: the q5 light pooled inside, rising from the bottom (the original falloff, like q5's spill)
    edge_light('q5-under-pill', 225, 32, 16.0, bottom(32, 16.0), peak=0.26, ring=0.45, kernel=lorentz, depth=13)
    edge_light('q5-under-chip', 96, 32, 8.0, bottom(32, 8.0), peak=0.26, ring=0.45, kernel=lorentz, depth=13)
    # (c) inset: the recess. A soft occlusion under the top lip, a hairline all round
    for nm, w, h, R in (('well-q5-pill', 225, 32, 16.0), ('well-q6n4-pill', 227, 33, 16.5), ('well-chip', 96, 32, 8.0)):
        edge_light(nm + '-top', w, h, R, top(h, R), peak=0.08, ring=0.0, kernel=logk, depth=10)
        edge_light(nm + '-line', w, h, R, allw, peak=0.0, ring=0.13, kernel=logk, depth=4)
        A1, W1 = CAP.pop(nm + '-top'); A2, _ = CAP.pop(nm + '-line')
        CAP[nm] = (1 - (1 - A1) * (1 - A2), W1)

# ---------- round 3: the q6n4 underglow, boosted ----------
# Mark: q6n4's underglow was "nonexistent" next to its pinprick and edge light. Same family -- the log falloff
# he loved, the same x weighting (a gaussian, sigma .30 of the box) and the same downward stretch -- with more
# energy (1.4x) and a longer second exponential (9 -> 14 px), on a deeper canvas (pill 52 -> 76 px below the
# box, chip 40 -> 62) so the canvas-edge window no longer cuts it short. The CSS reads the new reach as --ab-mb.
Q6B = dict(t=(3.0, 14.0), reach=60.0, gain=1.4, mb_pill=76, mb_chip=62)
def run_boost():
    ns = ga_ns()
    t1, t2 = Q6B['t']; rc = Q6B['reach']
    def falloff(d, a, r, p, reach):
        d = np.maximum(d, 0); I0 = sum(a)
        I = I0 * (0.55 * np.exp(-d / t1) + 0.45 * np.exp(-d / t2))
        w = np.clip((rc - d) / (rc * 0.5), 0, 1); w = w * w * (3 - 2 * w)
        return I * w
    ns['falloff'] = falloff
    def spill(name, bw, bh, mb, R, pref):
        ns['R'] = R; k = 1.0 if pref == 'btn' else 0.62; sx = bw * 0.30
        def wfn(x, y, cx, cy, bh_):
            sg = 1 / (1 + np.exp(-((y - cy) / (bh_ * 0.4))))
            return (0.03 + 0.97 * sg) * np.exp(-0.5 * ((x - cx) / sx) ** 2)
        a = tuple(Q6B['gain'] * v for v in (0.17, 0.12, 0.065))
        ns['bloom'](name, bw, bh, 40, 10, mb, wfn, a, (2.5, 9.0 * k + 2, 26.0 * k + 4), (1.0, 1.2, 1.5), 56 * k + 14)
    spill('q6n4-spillB-pill', 227, 33, Q6B['mb_pill'], 16.5, 'btn')
    spill('q6n4-spillB-chip', 96, 32, Q6B['mb_chip'], 8.0, 'chip')

if __name__ == '__main__':
    out = os.environ.get('ACCENT_CAP', 'out/cap.npz')
    if sys.argv[1:] == ['boost']:
        z = np.load(out); keys = {k.split('|')[0] for k in z.files}
        for k in keys: CAP[k] = (z[k + '|A'], z[k + '|W'])
        run_boost()
        for k in ('q6n4-spill-pill', 'q6n4-spillB-pill', 'q6n4-spill-chip', 'q6n4-spillB-chip'):
            A = CAP[k][0]; H2 = A.shape[0]; c = A[:, A.shape[1] // 2]
            print(f'{k:18s} {A.shape[1]} x {A.shape[0]}  peak {A.max():.3f}  centre column below the box:', np.round(c[int(H2*0.25)::12], 3))
        np.savez_compressed(out, **{k + '|A': v[0] for k, v in CAP.items()}, **{k + '|W': v[1] for k, v in CAP.items()})
        sys.exit(0)
    if sys.argv[1:] == ['new'] and os.path.exists(out):     # re-render only the new light, keep the rest
        z = np.load(out); keys = {k.split('|')[0] for k in z.files}
        for k in keys: CAP[k] = (z[k + '|A'], z[k + '|W'])
    else:
        run_blooms(); run_rim(); run_sprite()
    run_new()
    for k, (A, W) in CAP.items(): print(f'{k:22s} {A.shape[1]:4d} x {A.shape[0]:5d}   peak {A.max():.3f}')
    np.savez_compressed(out, **{k + '|A': v[0] for k, v in CAP.items()}, **{k + '|W': v[1] for k, v in CAP.items()})
