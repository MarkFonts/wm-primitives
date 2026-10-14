"""Rounded-rect light for the accent prototype: the REAL control geometry (radius 8, 32px tall),
not a pill. Derived from ../render.py (bloom / q6 spill / q6 streak) and ../sprite.py (rim travel),
with the stadium replaced by a rounded rectangle. Straight-alpha acid: composites on any ground."""
import numpy as np, os, sys
from PIL import Image
OUT = os.environ.get('ACCENT_OUT', 'out/')
PREV = OUT + 'prev/'
os.makedirs(PREV, exist_ok=True)
S = 2; R = 8.0; H = 32
rng = np.random.default_rng(7)
ACID = np.array([238, 255, 65], np.float32); TAIL = np.array([186, 214, 108], np.float32)

def sdf_rrect(x, y, cx, cy, hw, hh, r):
    qx = np.abs(x - cx) - (hw - r); qy = np.abs(y - cy) - (hh - r)
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r

def falloff(d, a, r, p, reach):
    d = np.maximum(d, 0)
    I = sum(ai / (1 + (d / ri) ** 2) ** pi for ai, ri, pi in zip(a, r, p))
    w = np.clip((reach - d) / (reach * 0.45), 0, 1); w = w * w * (3 - 2 * w)
    return I * w

def save(img, name):
    Image.fromarray(img, 'RGBA').save(OUT + name + '.avif', quality=92, speed=4)
    Image.fromarray(img, 'RGBA').save(PREV + name + '.png')
    print(f'{name:22s} {img.shape[1]}x{img.shape[0]} {os.path.getsize(OUT + name + ".avif")/1024:.1f} KB')

def finish(alpha, tdist, name, scale_tail=40.0):
    t = np.clip(tdist / scale_tail, 0, 1)[..., None]; t = t * t * (3 - 2 * t)
    rgb = ACID * (1 - t) + TAIL * t
    n = lambda: (rng.random(alpha.shape) + rng.random(alpha.shape) - 1.0)
    a8 = np.clip(np.rint(alpha * 255 + n()), 0, 255)
    rgb8 = np.clip(np.rint(rgb + np.stack([n(), n(), n()], -1)), 0, 255)
    save(np.dstack([rgb8, a8]).astype(np.uint8), name)

def grid(wc, hc):
    W, Hh = int(wc * S), int(hc * S)
    ys, xs = np.mgrid[0:Hh, 0:W].astype(np.float32)
    return (xs + .5) / S, (ys + .5) / S

def bloom(name, bw, bh, mx, mt, mb, weight_fn, a, r, p, reach):
    wc, hc = bw + 2 * mx, bh + mt + mb
    x, y = grid(wc, hc)
    cx, cy = wc / 2, mt + bh / 2
    d = sdf_rrect(x, y, cx, cy, bw / 2, bh / 2, R)
    dd = np.where(d > 0, d, 0)
    sg = 1 / (1 + np.exp(-((y - cy) / (bh * 0.5))))
    dd = dd * (1.25 * (1 - sg) + 0.62 * sg)
    I = falloff(dd, a, r, p, reach) * weight_fn(x, y, cx, cy, bh)
    edge = np.minimum.reduce([x, wc - x, y, hc - y])
    wv = np.clip(edge / 30.0, 0, 1); I *= wv * wv * (3 - 2 * wv)
    finish(I, dd, name)

def w_bottom(x, y, cx, cy, bh):
    s = 1 / (1 + np.exp(-((y - cy) / (bh * 0.45))))
    return 0.06 + 0.94 * s

def q5(name, bw, bh, pref):
    k = 1.0 if pref == 'btn' else 0.62
    bloom(name, bw, bh, 52, 14, 62 if pref == 'btn' else 46, w_bottom, a=(0.14, 0.10, 0.055),
          r=(2.5, 10.0 * k + 2, 28.0 * k + 4), p=(1.0, 1.2, 1.5), reach=64 * k + 14)

def q6_spill(name, bw, bh, pref):
    k = 1.0 if pref == 'btn' else 0.62
    sx = bw * 0.30
    def wfn(x, y, cx, cy, bh_):
        sg = 1 / (1 + np.exp(-((y - cy) / (bh_ * 0.4))))
        return (0.03 + 0.97 * sg) * np.exp(-0.5 * ((x - cx) / sx) ** 2)
    bloom(name, bw, bh, 40, 10, 52 if pref == 'btn' else 40, wfn, a=(0.17, 0.12, 0.065),
          r=(2.5, 9.0 * k + 2, 26.0 * k + 4), p=(1.0, 1.2, 1.5), reach=56 * k + 14)

def q6_streak(name, bw, thick):
    x, y = grid(bw, thick)
    u = (x - bw / 2) / (bw * 0.46)
    along = np.clip(1 - np.abs(u), 0, 1) ** 2.4
    dy = (thick - y)
    across = np.exp(-(dy / 1.1) ** 2 * 0.5) + 0.25 * np.exp(-(dy / 2.4) ** 2 * 0.5)
    I = np.clip(along * across, 0, 1) * 0.98
    core = np.exp(-(u * u) * 70) * np.exp(-(dy / 1.0) ** 2 * 0.5)
    rgb = np.clip(ACID * (1 - core[..., None] * 0.65) + np.array([255, 255, 240], np.float32) * core[..., None] * 0.65, 0, 255)
    n = lambda: (rng.random(I.shape) + rng.random(I.shape) - 1.0)
    a8 = np.clip(np.rint(np.clip(I, 0, 1) * 255 + n()), 0, 255)
    save(np.dstack([np.rint(rgb), a8]).astype(np.uint8), name)


# ---------------------------------------------------------------------------------------------
# Width-independent rim light. Reference box W0 x 32, R=8. Every piece is rendered from the SAME
# kernel sum as the old one-piece sprite (sprite.py), split along the outline:
#   cap  (left, 26px wide, mirrored for the right): everything the left end of the control shows --
#        the bottom edge entering the window, the lower corner, the short side, then the top fading in.
#        39 frames: 0..30 the front travels (bottom edge at the window -> lower arc -> side), 30..38 the
#        top (upper arc + top edge) fades in. Rendered at 2x, dithered.
#   bot  (1 css px wide column, STRETCHED across the middle): the lit bottom edge. Revealed from the
#        centre outward by a CSS mask driven by --p (the linear stretched transition).
#   top  (same, for the top edge): lit all at once, opacity = the top fade.
# ---------------------------------------------------------------------------------------------
W0 = 225; XS = 26; N0 = 8; N1 = 30; N2 = 8; NF = N0 + N1 + N2 + 1

def rimpieces():
    a = W0 / 2.0 - R; side = H - 2 * R
    L = 2 * a + np.pi * R + side
    cx = W0 / 2.0
    ds = 0.5; n = int(2 * L / ds)
    ts = (np.arange(n) + 0.5) * (2 * L / n) - L
    def rim(t):
        sgn = 1 if t >= 0 else -1; u = abs(t)
        if u <= a: return cx + sgn * u, H
        u -= a; q = np.pi * R / 2
        if u <= q:
            phi = u / R; return cx + sgn * (a + R * np.sin(phi)), (H - R) + R * np.cos(phi)
        u -= q
        if u <= side: return cx + sgn * (a + R), H - R - u
        u -= side
        if u <= q:
            th = u / R; return cx + sgn * (a + R * np.cos(th)), R - R * np.sin(th)
        u -= q; return cx + sgn * (a - u), 0.0
    pts = np.array([rim(t) for t in ts], np.float32); sarc = np.abs(ts).astype(np.float32)
    W2, H2 = W0 * S, H * S
    # pixel set: left cap window (cols 0..XS*S-1) + two centre columns
    cols = list(range(0, XS * S)) + [W2 // 2 - 1, W2 // 2]
    ys_i, xs_i = np.meshgrid(np.arange(H2), np.array(cols), indexing='ij')
    xs = ((xs_i + .5) / S).ravel().astype(np.float32); ys = ((ys_i + .5) / S).ravel().astype(np.float32)
    depth = (-sdf_rrect(xs, ys, W0 / 2, H / 2, W0 / 2, H / 2, R)).astype(np.float32)
    inside = np.clip(depth * S + 0.5, 0, 1)
    r0 = np.array([1.3, 4.2, 10.0], np.float32); wk = np.array([0.5, 0.32, 0.18], np.float32)
    d2 = (xs[:, None] - pts[None, :, 0]) ** 2 + (ys[:, None] - pts[None, :, 1]) ** 2
    Kg = sum(w / (1 + d2 / (r * r)) ** 1.5 for w, r in zip(wk, r0)).astype(np.float32); Kr = np.exp(-d2 / (0.85 ** 2)).astype(np.float32)
    # calibration identical to sprite.py: fully lit rim, peak .26 just inside the top edge, ring .55, at the top centre
    pix = lambda cy, cxp: (int(cy)) * len(cols) + cols.index(cxp)
    Gfull = Kg.sum(1); Rfull = Kr.sum(1)
    sg = 0.26 / Gfull[pix(round(1.5 * S - .5), W2 // 2)]; sr = 0.55 / Rfull[pix(round(0.5 * S - .5), W2 // 2)]
    wnd = np.clip((15.0 - depth) / (15.0 * 0.45), 0, 1); wnd = wnd * wnd * (3 - 2 * wnd)
    t = np.clip(depth / 15.0, 0, 1); t = (t * t * (3 - 2 * t))[:, None]
    rgb = ACID[None, :] * (1 - t) + TAIL[None, :] * t
    def render(w):
        G = (Kg @ w) * sg * wnd; Rg = np.clip((Kr @ w) * sr, 0, 0.6)
        A = (1 - (1 - np.clip(G, 0, 1)) * (1 - Rg)) * inside
        return A
    nc = len(cols)
    def sel(A, c0, c1):          # (H2, nc) grid -> columns c0..c1 as an image
        return A.reshape(H2, nc)[:, c0:c1], rgb.reshape(H2, nc, 3)[:, c0:c1]
    def to8(A, C):
        nz = lambda: (rng.random(A.shape, dtype=np.float32) + rng.random(A.shape, dtype=np.float32) - 1.0)
        a8 = np.clip(np.rint(A * 255 + nz()), 0, 255)
        c8 = np.clip(np.rint(C + np.stack([nz(), nz(), nz()], -1)), 0, 255)
        return np.dstack([c8, a8[..., None]]).astype(np.uint8)
    a_b = a; q = np.pi * R / 2
    t_start = W0 / 2 - XS                    # |t| where the bottom edge enters the cap window
    t_side_end = a_b + q + side              # |t| at the top of the short side
    bottom = (sarc <= a_b)
    top = (sarc > t_side_end)
    frames = []
    for k in range(NF):
        w = np.zeros(n, np.float32)
        if k <= N0:                          # stage 0: the lit middle's tail arrives at the window
            w[sarc <= t_start] = k / N0
        elif k <= N0 + N1:                   # stage 1: the front travels window -> lower arc -> side
            front = t_start + ((k - N0) / N1) * (t_side_end - t_start)
            z = np.clip((front - sarc) / 3.0, 0, 1); w = (z * z * (3 - 2 * z)).astype(np.float32)
            w[top] = 0
        else:                                # stage 2: top edge + upper arcs all at once
            w[sarc <= t_side_end] = 1
            w[top] = (k - N0 - N1) / N2
        A = render(w); a_img, c_img = sel(A, 0, XS * S)
        frames.append(to8(a_img, c_img))
    strip = np.concatenate(frames, 0)
    Image.fromarray(strip, 'RGBA').save(OUT + 'rim-cap.avif', quality=90, speed=4)
    Image.fromarray(strip, 'RGBA').save(PREV + 'rim-cap.png')
    print('rim-cap', strip.shape, round(os.path.getsize(OUT + 'rim-cap.avif') / 1024, 1), 'KB')
    for nm, mask in (('rim-bot', bottom), ('rim-top', (sarc >= a_b + q + side + q))):
        w = mask.astype(np.float32)
        A = render(w); a_img, c_img = sel(A, nc - 2, nc)
        img = to8(a_img, c_img)
        Image.fromarray(img, 'RGBA').save(OUT + nm + '.avif', quality=90, speed=4)
        Image.fromarray(img, 'RGBA').save(PREV + nm + '.png')
        print(nm, img.shape, round(os.path.getsize(OUT + nm + '.avif') / 1024, 1), 'KB')

if __name__ == '__main__':
    # ---- 9-slice spill and streak: reference box 96 wide, stretched by border-image / 100% ----
    REF = 96
    q5('q5-under-btn', REF, H, 'btn'); q5('q5-under-chip', REF, H, 'chip')
    q6_spill('q6-spill-btn', REF, H, 'btn'); q6_spill('q6-spill-chip', REF, H, 'chip')
    q6_streak('q6-streak-btn', 160, 6); q6_streak('q6-streak-chip', 160, 5)
    rimpieces()
