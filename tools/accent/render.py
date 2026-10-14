import numpy as np, os, sys
from PIL import Image
OUT = os.environ.get('ACCENT_OUT', 'out/')
S = 2  # render scale
rng = np.random.default_rng(7)
ACID = np.array([238, 255, 65], np.float32)
TAIL = np.array([186, 214, 108], np.float32)   # tail drifts greener and less saturated, like scattering on a matte surface

def sdf_rrect(x, y, cx, cy, hw, hh, r):
    """signed distance to a rounded rect (negative inside)"""
    qx = np.abs(x - cx) - (hw - r); qy = np.abs(y - cy) - (hh - r)
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r

def falloff(d, a=(0.14, 0.10, 0.05), r=(2.5, 9.0, 24.0), p=(1.0, 1.2, 1.5), reach=60.0):
    """a tight core plus a long soft tail, roughly inverse-square (Lorentzian) terms, windowed to zero at `reach`"""
    d = np.maximum(d, 0)
    I = sum(ai / (1 + (d / ri) ** 2) ** pi for ai, ri, pi in zip(a, r, p))
    w = np.clip((reach - d) / (reach * 0.45), 0, 1); w = w * w * (3 - 2 * w)
    return I * w

def finish(alpha, tdist, name, scale_tail=40.0):
    """alpha: float [0..1] straight alpha; color drifts from acid to the greener tail with distance. dithers, quantizes, writes AVIF + returns size"""
    t = np.clip(tdist / scale_tail, 0, 1)[..., None]; t = t * t * (3 - 2 * t)
    rgb = ACID * (1 - t) + TAIL * t
    # triangular dither of +-1 LSB on every channel before rounding
    n = lambda: (rng.random(alpha.shape) + rng.random(alpha.shape) - 1.0)
    a8 = np.clip(np.rint(alpha * 255 + n()), 0, 255)
    rgb8 = np.clip(np.rint(rgb + np.stack([n(), n(), n()], -1)), 0, 255)
    img = np.dstack([rgb8, a8]).astype(np.uint8)
    im = Image.fromarray(img, 'RGBA')
    path = OUT + name + '.avif'
    im.save(path, quality=92, speed=4)
    Image.fromarray(img, 'RGBA').save(OUT + 'prev-' + name + '.png')
    return os.path.getsize(path)

def grid(wc, hc):
    W, H = int(wc * S), int(hc * S)
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    return (xs + .5) / S, (ys + .5) / S, W, H

report = {}

# ---------- bloom boxes: button box sits at (mx, my) inside a canvas of (bw+2mx) x (bh+mt+mb) ----------
def bloom(name, bw, bh, mx, mt, mb, weight_fn, a, r, p, reach, ykind='sym'):
    wc, hc = bw + 2 * mx, bh + mt + mb
    x, y, W, H = grid(wc, hc)
    cx, cy = wc / 2, mt + bh / 2
    d = sdf_rrect(x, y, cx, cy, bw / 2, bh / 2, bh / 2)
    dd = np.where(d > 0, d, 0)
    if ykind == 'down':   # light spilling down: the tail reaches further below than to the sides/top (smooth blend, no seam)
        sg = 1 / (1 + np.exp(-((y - cy) / (bh * 0.5))))
        dd = dd * (1.25 * (1 - sg) + 0.62 * sg)
    I = falloff(dd, a, r, p, reach) * weight_fn(x, y, cx, cy, bh)
    # (no hole under the button: it is opaque, and a hole would show as a dark ring when the bloom scales on hover)
    # window to zero at the canvas border so the box edge never shows
    edge = np.minimum.reduce([x, wc - x, y, hc - y])
    wv = np.clip(edge / 30.0, 0, 1); I *= wv * wv * (3 - 2 * wv)
    report[name] = finish(I, dd, name)

def w_top(x, y, cx, cy, bh):  # strongest above the top edge, a little round the ends, almost none below
    s = 1 / (1 + np.exp(-((cy - y) / (bh * 0.26))))
    return 0.035 + 0.965 * s
def w_bottom(x, y, cx, cy, bh):
    s = 1 / (1 + np.exp(-((y - cy) / (bh * 0.45))))
    return 0.06 + 0.94 * s
def w_all(x, y, cx, cy, bh): return np.ones_like(x)

BW, BH = 227, 33
CW, CH = 74, 32
for pref, bw, bh in (('btn', BW, BH), ('chip', CW, CH)):
    k = 1.0 if pref == 'btn' else 0.62
    bloom(f'q1-bloom-{pref}', bw, bh, 56, 46 if pref == 'btn' else 34, 12, w_top, a=(0.12, 0.085, 0.045), r=(2.5, 9.0 * k + 2, 24.0 * k + 4), p=(1.0, 1.2, 1.5), reach=58 * k + 16)
    bloom(f'q4-halo-{pref}', bw, bh, 48, 48 if pref == 'btn' else 38, 48 if pref == 'btn' else 38, w_all, a=(0.10, 0.07, 0.04), r=(2.5, 8.0 * k + 2, 22.0 * k + 4), p=(1.0, 1.2, 1.5), reach=52 * k + 14)
    bloom(f'a-spill-{pref}', bw, bh, 52, 14, 62 if pref == 'btn' else 46, w_bottom, a=(0.20, 0.14, 0.075), r=(2.5, 10.0 * k + 2, 28.0 * k + 4), p=(1.0, 1.2, 1.5), reach=64 * k + 14, ykind='down')
    bloom(f'q5-under-{pref}', bw, bh, 52, 14, 62 if pref == 'btn' else 46, w_bottom, a=(0.14, 0.10, 0.055), r=(2.5, 10.0 * k + 2, 28.0 * k + 4), p=(1.0, 1.2, 1.5), reach=64 * k + 14, ykind='down')

# ---------- inner glows (N4 pill, N5 mitered) ----------
def inner(name, w, h, kind, depth, a):
    x, y, W, H = grid(w, h)
    if kind == 'pill':
        d = -sdf_rrect(x, y, w / 2, h / 2, w / 2, h / 2, h / 2)  # distance inside
    else:
        d = np.minimum.reduce([x, w - x, y, h - y])  # min distance to the four edges: exact 45-degree miters
    d = np.maximum(d, 0)
    I = falloff(d, a=a, r=(1.2, 4.0, 10.0), p=(1.0, 1.3, 1.6), reach=depth)
    I = np.where(d >= 0, I, 0)
    report[name] = finish(I, d, name, scale_tail=depth)

for kind in ('pill', 'miter'):
    inner(f'n-{kind}-btn', BW, BH, kind, 15.0, a=(0.15, 0.12, 0.07))
    inner(f'n-{kind}-chip', CW, CH, kind, 13.0, a=(0.15, 0.12, 0.07))

# ---------- Q2: one travelling spot (symmetric tail) and one tapered rim streak ----------
def spot(name, size, a):
    x, y, W, H = grid(size, size)
    r = np.hypot(x - size / 2, y - size / 2)
    I = falloff(r, a=a, r=(2.5, 9.0, 22.0), p=(1.0, 1.2, 1.5), reach=size / 2)
    report[name] = finish(I, r, name, scale_tail=size / 2)
spot('q2-spot-btn', 110, (0.20, 0.12, 0.06)); spot('q2-spot-chip', 70, (0.20, 0.12, 0.06))

def streak(name, length, thick):
    x, y, W, H = grid(length, thick)
    u = (x - length / 2) / (length / 2); v = (y - thick / 2) / (thick / 2)
    along = (1 - np.abs(u)) ** 2.2                     # tapered to nothing at both ends
    across = np.exp(-(v * v) * 3.0)
    I = np.clip(along * across, 0, 1) * 0.95
    core = np.exp(-(u * u) * 60) * np.exp(-(v * v) * 5)  # a tiny hot core
    img = np.zeros((H, W, 4), np.float32)
    rgb = np.clip(ACID * (1 - core[..., None] * 0.6) + np.array([255, 255, 235], np.float32) * core[..., None] * 0.6, 0, 255)
    n = lambda: (rng.random(I.shape) + rng.random(I.shape) - 1.0)
    a8 = np.clip(np.rint(np.clip(I + core * 0.05, 0, 1) * 255 + n()), 0, 255)
    out = np.dstack([np.rint(rgb), a8]).astype(np.uint8)
    path = OUT + name + '.avif'; Image.fromarray(out, 'RGBA').save(path, quality=92, speed=4); report[name] = os.path.getsize(path)
streak('q2-streak-btn', 90, 7); streak('q2-streak-chip', 48, 6)


# ---------- Q6: bottom-lit smoky glass: an under-spill and a thin rim streak ----------
def q6_spill(pref, bw, bh):
    k = 1.0 if pref == 'btn' else 0.62
    sx = bw * 0.30
    def wfn(x, y, cx, cy, bh_):
        sg = 1 / (1 + np.exp(-((y - cy) / (bh_ * 0.4))))
        return (0.03 + 0.97 * sg) * np.exp(-0.5 * ((x - cx) / sx) ** 2)
    bloom(f'q6-spill-{pref}', bw, bh, 40, 10, 52 if pref == 'btn' else 40, wfn, a=(0.17, 0.12, 0.065), r=(2.5, 9.0 * k + 2, 26.0 * k + 4), p=(1.0, 1.2, 1.5), reach=56 * k + 14, ykind='down')

def q6_streak(name, bw, thick):
    x, y, W, H = grid(bw, thick)
    u = (x - bw / 2) / (bw * 0.46)
    along = np.clip(1 - np.abs(u), 0, 1) ** 2.4                     # hottest at the centre, tapering to nothing toward the sides
    dy = (thick - y)                                                 # distance up from the very bottom edge
    across = np.exp(-(dy / 1.1) ** 2 * 0.5) + 0.25 * np.exp(-(dy / 2.4) ** 2 * 0.5)
    I = np.clip(along * across, 0, 1) * 0.98
    core = np.exp(-(u * u) * 70) * np.exp(-(dy / 1.0) ** 2 * 0.5)    # a tiny near-white core
    rgb = np.clip(ACID * (1 - core[..., None] * 0.65) + np.array([255, 255, 240], np.float32) * core[..., None] * 0.65, 0, 255)
    n = lambda: (rng.random(I.shape) + rng.random(I.shape) - 1.0)
    a8 = np.clip(np.rint(np.clip(I, 0, 1) * 255 + n()), 0, 255)
    out = np.dstack([np.rint(rgb), a8]).astype(np.uint8)
    path = OUT + name + '.avif'; Image.fromarray(out, 'RGBA').save(path, quality=92, speed=4); report[name] = os.path.getsize(path)

q6_spill('btn', BW, BH); q6_spill('chip', CW, CH)
q6_streak('q6-streak-btn', BW, 6); q6_streak('q6-streak-chip', CW, 5)

for k, v in report.items(): print(f'{k:20s} {v/1024:6.1f} KB')
