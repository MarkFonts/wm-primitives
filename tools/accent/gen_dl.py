import numpy as np, os, sys, io
from PIL import Image
OUT = os.environ.get('ACCENT_OUT', 'out/')
S = 2
rng = np.random.default_rng(11)
ACID = np.array([238, 255, 65], np.float32); TAIL = np.array([186, 214, 108], np.float32)
N = int(sys.argv[1]) if len(sys.argv) > 1 else 48

def build(name, Wc, Hc, depth=15.0, feather=7.0, f0=7.0):
    W2, H2 = Wc * S, Hc * S
    R = Hc / 2.0; a = (Wc - Hc) / 2.0          # half straight length
    L = 2 * a / 2 + np.pi * R                    # arc length from bottom centre to top centre, one way = a + pi R
    L = 2 * a + np.pi * R
    cx, cy = Wc / 2.0, Hc / 2.0
    # rim sample points: parametrise by signed arc t in [-L, L] from the bottom centre (t>0 goes right, round the right end to the top centre)
    ds = 0.5; n = int(2 * L / ds)
    ts = (np.arange(n) + 0.5) * (2 * L / n) - L
    def rim(t):
        sgn = np.sign(t) if t != 0 else 1; u = abs(t)
        if u <= a: return cx + sgn * u, Hc
        u2 = u - a
        if u2 <= np.pi * R:
            phi = u2 / R; return cx + sgn * (a + R * np.sin(phi)), cy + R * np.cos(phi)
        u3 = u2 - np.pi * R; return cx + sgn * (a - u3), 0.0
    pts = np.array([rim(t) for t in ts], np.float32); sarc = np.abs(ts).astype(np.float32)
    ys, xs = np.mgrid[0:H2, 0:W2].astype(np.float32); xs = (xs + .5) / S; ys = (ys + .5) / S
    xs = xs.ravel(); ys = ys.ravel()
    # inside distance (stadium SDF)
    qx = np.abs(xs - cx) - a; qy = np.abs(ys - cy)
    # exact stadium sdf: distance to segment (cx-a..cx+a, cy) minus R
    dseg = np.hypot(np.maximum(np.abs(xs - cx) - a, 0), ys - cy)
    depth = (R - dseg).astype(np.float32)        # positive inside
    inside = np.clip(depth * S + 0.5, 0, 1)      # antialiased coverage
    # kernel matrices
    r0 = np.array([1.3, 4.2, 10.0], np.float32); wk = np.array([0.5, 0.32, 0.18], np.float32)
    Kg = np.zeros((xs.size, n), np.float32); Kr = np.zeros_like(Kg)
    for c0 in range(0, xs.size, 6000):
        sl = slice(c0, c0 + 6000)
        d2 = (xs[sl, None] - pts[None, :, 0]) ** 2 + (ys[sl, None] - pts[None, :, 1]) ** 2
        g = sum(w / (1 + d2 / (r * r)) ** 1.5 for w, r in zip(wk, r0))
        Kg[sl] = g; Kr[sl] = np.exp(-d2 / (0.85 ** 2))
    # calibrate so a fully lit rim gives the N4 look: peak ~0.26 just inside the top edge, ring 0.55
    iy = int(round(1.5 * S - .5)); ix = W2 // 2
    pid = iy * W2 + ix
    Gfull = Kg.sum(1); Rfull = Kr.sum(1)
    sg = 0.26 / Gfull[pid]; sr = 0.55 / Rfull[int(round(0.5 * S - .5)) * W2 + ix]
    # window the glow to zero at `depth` px in
    wnd = np.clip((15.0 - depth) / (15.0 * 0.45), 0, 1)
    wnd = wnd * wnd * (3 - 2 * wnd)
    t = np.clip(depth / 15.0, 0, 1)
    t = (t * t * (3 - 2 * t))[:, None]
    rgb = ACID[None, :] * (1 - t) + TAIL[None, :] * t
    frames = []
    Ltot = L
    for k in range(N):
        p = k / (N - 1)
        front = f0 + p * (Ltot + feather - f0)
        z = np.clip((front - sarc) / feather, 0, 1); w = (z * z * (3 - 2 * z)).astype(np.float32)
        G = (Kg @ w) * sg * wnd
        Rg = np.clip((Kr @ w) * sr, 0, 0.6)
        A = 1 - (1 - np.clip(G, 0, 1)) * (1 - Rg)
        A = A * inside
        nz = lambda: (rng.random(A.shape, dtype=np.float32) + rng.random(A.shape, dtype=np.float32) - 1.0)
        a8 = np.clip(np.rint(A * 255 + nz()), 0, 255)
        c = np.clip(np.rint(rgb + np.stack([nz(), nz(), nz()], -1)), 0, 255)
        frames.append(np.dstack([c.reshape(H2, W2, 3), a8.reshape(H2, W2, 1)]).astype(np.uint8))
    strip = np.concatenate(frames, 0)
    im = Image.fromarray(strip, 'RGBA')
    path = OUT + name + '.avif'
    im.save(path, quality=90, speed=4)
    Image.fromarray(np.concatenate([frames[i] for i in (0, N // 4, N // 2, 3 * N // 4, N - 6, N - 1)], 0), 'RGBA').save(f'{OUT}prev-{name}.png')
    print(name, strip.shape, round(os.path.getsize(path) / 1024, 1), 'KB')


import gen_assets as ga
ga.R = 16.0                      # the Download button is a PILL: radius = height / 2
ga.q5('q5-under-dl', 225, 32, 'btn')
ga.q6_spill('q6-spill-dl', 225, 32, 'btn')
ga.q6_streak('q6-streak-dl', 225, 6)
build('q6n4-dl-225', 225, 32)       # the proposal's sprite.py renderer, traced along the stadium outline, fronts meet at the top
