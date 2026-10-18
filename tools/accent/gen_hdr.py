"""q5's HDR light, route 2b: every lit layer is an OPAQUE PQ image whose value IS the light, per pixel,
    L(x) = L_floor + glow(x)          absolute luminance, BT.2020 nits
so where the glow dies the image is exactly the floor it sits on, and a mask-image only bounds its footprint.
The glow is the SDR art's own light (capture.py runs the shipped generators with hooks in place of their
writers; q5's spill keeps the ORIGINAL falloff), lifted in gamma terms by boost(A) = 1 + b (A / A_pk)^2, which
leaves the tail where the SDR art has it and raises only the core to V_peak. Ported from the round-2 accent
proposal (route 2b): q5, acid. q6n4 has no HDR set. The light-mode set (acid on the white floor) is the proposal's
round 5b, "broad 300" at +400, which Mark picked ("broad 300. ship it. perfect."): see LIGHT MODE below.

THE FLOOR (measured in the consumers, not assumed -- the plane bakes its floor, so a mismatch is a faint box):
  spill on #1a1a1a   ReCal's rail under Download (.rail-dl) and its Try bar (.try) are both var(--surface),
                     #1a1a1a (ReCal tokens.css); the docs stage pins --surface #1a1a1a; color.css's dark --surface
                     is oklch(21.78% 0 0) = #1a1a1a to within 0.01 of a level.
  rim   on #1a1a1a   the face, which is var(--surface) too.
So every surface q5 sits on is one floor, and one set serves all of them. A new ground needs its own bake (FLOOR).
In light mode q5 sits on the house light --surface, #ffffff (color.css; the docs stage pins it). The floor is put
on PQ code 595, just above 203 nits, so it cannot decode under page white. The rim's floor is the ink face, #161616.
Colour: acid, display-p3 components mixed by the capture's core / tail / hot weights, linearised, P3 -> BT.2020. Encode: ST 2084 inverse EOTF, triangular dither at 10-bit steps, 16-bit raw
-> pq_write (Swift, itur_2100_PQ) -> PNG -> sips -s format avif.

MAXCLL. sips stamps every PQ AVIF with clli 1000 / 64, and Chrome reads MaxCLL as the content's maximum: a stamp
BELOW the real peak clips every channel there (the accent proposal's cream slabs, round 5), a stamp above it makes
Chrome tone-map more than it needs to. So every file here is stamped with its TRUE peak (ceil, nits), the clli box
rewritten in place (it is fixed size). MAXCLL below is the switch ('peak', or a number of nits);
`gen_hdr.py clli` restamps the shipped files from it without rendering anything.

STATES ARE FRAMES. Any HDR layer under a transform or an opacity below 1 goes through an intermediate surface that
clamps to SDR (round 4: hover and pressed lost their glow). So the spill's three states are pre-rendered: 17 frames
of the light scaled .9 -> 1.1 about the shipped transform origin (50%, --ab-oy), the frames under 1 dimmed toward
.85 as the shipped opacity does; rest is frame 8, hover 16, pressed 0. accentButton.css steps them from one
registered number. The pill's frames stack vertically (background-position); the chip's too (border-image-slice).

THE LABEL: a flat PQ field, acid at the q5 light's peak (the brightest pixel of any plane, the rim's, peak
channel), so the text and the light read as one source. accentButton.css paints it through the glyphs
with background-clip: text. The house bright level is 1216 nits (PQ 0.7732); nothing here exceeds it.

  ACCENT_CAP=out/cap.npz python capture.py            # once: the captured light (needs gen_assets/sprite/gen_inner)
  swiftc -O pq_write.swift -o out/pq_write
  ACCENT_CAP=out/cap.npz PQ_WRITE=out/pq_write python gen_hdr.py
"""
import numpy as np, os, sys, subprocess, struct
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('ACCENT_HDR_OUT', os.path.join(HERE, 'out/hdr/')); os.makedirs(OUT, exist_ok=True)
CAPF = os.environ.get('ACCENT_CAP', os.path.join(HERE, 'out/cap.npz'))
PQW = os.environ.get('PQ_WRITE', os.path.join(HERE, 'out/pq_write'))
SHIP = os.path.join(HERE, '../../assets/accent/')
TMP = OUT + '.tmp/'; os.makedirs(TMP, exist_ok=True)

# THE SWITCH: the MaxCLL the shipped files carry. 'peak' = each file's true peak, or a number of nits (e.g. 203).
MAXCLL = 'peak'
NF, S0, S1 = 17, 0.9, 1.1                       # spill state frames: scale S0 .. S1
OY = {'q5-pill': 47, 'q5-chip': 46}             # accentButton.css --ab-oy, css px from the spill's top
FLOOR = 26                                      # #1a1a1a, as an 8-bit grey

rng = np.random.default_rng(31)
REF = 203.0                                     # nits per SDR unit (BT.2408 reference white, the level sips gives sRGB white)

def xyz_m(prim):
    wx, wy = 0.3127, 0.3290
    P = np.array([[x / y, 1, (1 - x - y) / y] for x, y in prim]).T
    Wt = np.array([wx / wy, 1, (1 - wx - wy) / wy])
    return P * np.linalg.solve(P, Wt)
P3 = xyz_m([(0.680, 0.320), (0.265, 0.690), (0.150, 0.060)])
R2020 = xyz_m([(0.708, 0.292), (0.170, 0.797), (0.131, 0.046)])
P3_TO_2020 = np.linalg.solve(R2020, P3)
def p3(*c):
    c = np.array(c, np.float32); return c / c.max()            # gamma-encoded display-p3, peak channel 1
mixc = lambda a, b, t: tuple(x * (1 - t) + y * t for x, y in zip(a, b))

ACID = (0.9333, 1.0, 0.2549)                    # --ab-acid, display-p3 (#eeff41)
PAL = (p3(*ACID), p3(0.75, 0.83, 0.47), p3(*mixc(ACID, (1, 1, 1), .6)))   # core, tail, hot (display-p3, gamma)

def pq(n):
    m1, m2, c1, c2, c3 = 0.1593017578125, 78.84375, 0.8359375, 18.8515625, 18.6875
    y = np.clip(n / 10000.0, 0, 1) ** m1
    return ((c1 + c2 * y) / (1 + c3 * y)) ** m2
def pq_inv(code):
    m1, m2, c1, c2, c3 = 0.1593017578125, 78.84375, 0.8359375, 18.8515625, 18.6875
    e = np.float64(code) ** (1 / m2)
    return 10000 * (np.maximum(e - c1, 0) / (c2 - c3 * e)) ** (1 / m1)

def to_nits(v):
    """gamma-encoded display-p3 (may exceed 1) -> linear BT.2020 nits"""
    a = np.abs(v); l = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    return np.clip(np.einsum('ij,...j->...i', P3_TO_2020, l), 0, None) * REF
def grey_nits(g8):
    c = g8 / 255; return (c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4) * REF

def write(nits, lit, path):
    """nits: H x W x 3 linear BT.2020 nits -> opaque PQ AVIF (PQ + alpha decodes transparent in Chrome).
    lit: where there is light; only there is dithered, so the floor stays one exact code."""
    code = pq(nits) * 1023
    tri = (rng.random(code.shape) + rng.random(code.shape) - 1.0) * lit[..., None]
    c10 = np.clip(np.rint(code + tri), 0, 1023)
    u16 = np.rint(c10 * 65535 / 1023).astype('<u2')
    H, W = u16.shape[:2]
    assert H % 2 == 0 and W % 2 == 0, f'{path}: {W} x {H} -- Chrome decodes a PQ AVIF with an odd side as fully transparent'
    raw = np.dstack([u16, np.full((H, W, 1), 65535, '<u2')])
    name = os.path.basename(path)[:-5]
    rp, pp = TMP + name + '.u16', TMP + name + '.png'
    raw.tofile(rp)
    subprocess.run([PQW, rp, str(W), str(H), pp], check=True)
    subprocess.run(['sips', '-s', 'format', 'avif', '-s', 'formatOptions', '95', pp, '--out', path], check=True, capture_output=True)
    os.remove(rp)
    return os.path.getsize(path)

def set_clli(path, maxcll, maxfall=64):
    d = bytearray(open(path, 'rb').read()); i = d.find(b'clli')
    assert i > 0, 'no clli box'; d[i + 4:i + 8] = struct.pack('>HH', int(maxcll), int(maxfall))
    open(path, 'wb').write(d)
def get_clli(path):
    d = open(path, 'rb').read(); i = d.find(b'clli'); return struct.unpack('>HH', d[i + 4:i + 8])

T_FOOT = 1 / 255
def mask_footprint(A, path):
    """the footprint: m = smoothstep(0, T, A), ~1 wherever there is any light, fading only where the plane
    already equals its floor, so its edge cannot show. Straight-alpha SDR AVIF (it is only ever a mask)."""
    from PIL import Image
    t = np.clip(A / T_FOOT, 0, 1); m = t * t * (3 - 2 * t)
    n = rng.random(A.shape) + rng.random(A.shape) - 1.0
    a8 = np.clip(np.rint(m * 255 + n * (m > 0) * (m < 1)), 0, 255).astype(np.uint8)
    assert A.shape[0] % 2 == 0 and A.shape[1] % 2 == 0, f'{path}: odd mask size {A.shape}'   # kept even, as the planes
    Image.fromarray(np.dstack([np.full(A.shape + (3,), 255, np.uint8), a8]), 'RGBA').save(path, quality=92, speed=4)
    return os.path.getsize(path)

# shipped name -> (capture name, V_peak in gamma terms): spill 1.35 = ~400 nits, rim 1.6 = ~590
LAYERS = {
    'q5-hdr-dark-pill':     ('q5-pill',     1.35),
    'q5-hdr-dark-chip':     ('q5-chip',     1.35),
    'q5-hdr-dark-rim-pill': ('q5-rim-pill', 1.6),
    'q5-hdr-dark-rim-chip': ('q5-rim-chip', 1.6),
}
MASKS = {'q5-hdr-mask-pill': 'q5-pill', 'q5-hdr-mask-rim-pill': 'q5-rim-pill', 'q5-hdr-mask-rim-chip': 'q5-rim-chip'}
FRAMED = ('q5-pill', 'q5-chip')                 # the spills: their masks bound the WIDEST frame
LABEL = 'q5-hdr-dark-label'

def resample(a, s, oy, S=2):
    """a (H, W[, C]) scaled by s about (W/2, oy css px), bilinear, zero outside (the accent proposal, round 5)"""
    H, W = a.shape[:2]
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float64)
    ox, oyp = W / 2.0, oy * S
    sx = ox + (xs + .5 - ox) / s - .5; sy = oyp + (ys + .5 - oyp) / s - .5
    x0 = np.floor(sx).astype(int); y0 = np.floor(sy).astype(int); fx = sx - x0; fy = sy - y0
    def at(yy, xx):
        ok = (yy >= 0) & (yy < H) & (xx >= 0) & (xx < W)
        v = a[np.clip(yy, 0, H - 1), np.clip(xx, 0, W - 1)]
        return np.where(ok[..., None], v, 0) if a.ndim == 3 else np.where(ok, v, 0)
    if a.ndim == 3: fx, fy = fx[..., None], fy[..., None]
    return (at(y0, x0) * (1 - fx) * (1 - fy) + at(y0, x0 + 1) * fx * (1 - fy) + at(y0 + 1, x0) * (1 - fx) * fy + at(y0 + 1, x0 + 1) * fx * fy).astype(np.float32)

def frames(z, cap):
    """the state frames, stacked vertically: (A, W) per frame, scaled and (under 1) dimmed as the SDR states are"""
    A, W = z[cap + '|A'], z[cap + '|W']
    out = []
    for sc in np.linspace(S0, S1, NF):
        m = 1 - 0.15 * np.clip((1 - sc) / 0.1, 0, 1)          # pressed: scale .9 at opacity .85
        out.append((resample(A, sc, OY[cap]) * m, resample(W, sc, OY[cap])))
    return out

def bake(z, cap, vpk):
    A, Wt = z[cap + '|A'], z[cap + '|W']
    apk0 = float(A.max())
    if cap in FRAMED:
        fr = frames(z, cap); A = np.concatenate([f[0] for f in fr], 0); Wt = np.concatenate([f[1] for f in fr], 0)
    col = Wt @ np.stack(PAL)
    apk = apk0; b = vpk / apk - 1                         # the rest frame's law, for every frame
    glow = to_nits((A * (1 + b * (A / apk) ** 2))[..., None] * col)
    fl = grey_nits(FLOOR)
    return fl + glow, glow, fl

def clli_for(peak):
    return int(np.ceil(peak)) if MAXCLL == 'peak' else int(MAXCLL)

def field(rgb_p3, nits, side=16):
    unit = to_nits(p3(*rgb_p3))                              # the colour at SDR level, nits per channel
    return np.broadcast_to(unit * nits / unit.max(), (side, side, 3)).copy()   # peak channel lands on `nits`

# ═══════════ LIGHT MODE: acid on the white floor, round 5b "broad 300" at +400 ═══════════
# glow = Kc * core + H * shoulder (capture.py broad): the core is q5's spill under its own law, unit peak; the
# shoulder a long super-Lorentzian. H is solved so the band 32px below the button sits at 300 nits on the peak
# channel (as far as the peak allows), and Kc so the brightest pixel is exactly PEAK_L -- +200 over the floor: Mark,
# on the hero preview, "300 / 408 is best for both" (round 5b shipped +400, 605) -- so
# MaxCLL is the true peak. The rim (on the ink face) and the label field are scaled to the same peak.
def pq_inv(code):
    m1, m2, c1, c2, c3 = 0.1593017578125, 78.84375, 0.8359375, 18.8515625, 18.6875
    e = np.float64(code) ** (1 / m2)
    return 10000 * (np.maximum(e - c1, 0) / (c2 - c3 * e)) ** (1 / m1)
WHITE_FLOOR_NITS = float(pq_inv(595 / 1023))
PEAK_L, TARGET_L, VPEAK_LIGHT_SPILL, FACE_L = 405.0, 300.0, 1.9, 22   # FACE_L: #161616, the light ink face
LABEL_NITS = 605.0              # the light label stays at 605 (Mark: "the white is finally visible")
PROFILE_PX = (8, 16, 32, 64, 96)
GEO_L = {'q5-hdr-light-pill': ('b5-q5-pill', 40, 32), 'q5-hdr-light-chip': ('b5-q5-chip', 36, 32)}   # capture, mt, button h
RIM_L = {'q5-hdr-light-rim-pill': 'q5-rim-pill', 'q5-hdr-light-rim-chip': 'q5-rim-chip'}
LABEL_L = 'q5-hdr-light-label'
LIGHT = list(GEO_L) + list(RIM_L) + [LABEL_L]

def law_r2(A, W, vpk):                     # the gamma-space law above, unit-free
    apk = float(A.max()); b = vpk / apk - 1
    return to_nits((A * (1 + b * (A / apk) ** 2))[..., None] * (W @ np.stack(PAL)))

def broad(z, cap, mt, bh):
    core = law_r2(z[cap + '-core|A'], z[cap + '-core|W'], VPEAK_LIGHT_SPILL); core = core / core.max()
    S = z[cap + '-sh|A']; col = to_nits(PAL[0]); shl = S[..., None] * (col / col.max())
    cx = core.shape[1] // 2; r32 = int(round((mt + bh) * 2)) + 64          # 32px below the button, 2x
    ipk = np.unravel_index(core.max(-1).argmax(), core.shape[:2]); s_pk = float(S[ipk])
    total = lambda H: WHITE_FLOOR_NITS + (PEAK_L - WHITE_FLOOR_NITS - H * s_pk) * core + H * shl
    lo, hi = 0.0, min(400.0, (PEAK_L - WHITE_FLOOR_NITS) / s_pk)           # Kc >= 0: the core never goes negative
    for _ in range(40):                                                      # solve H: the band at TARGET_L
        H = (lo + hi) / 2
        lo, hi = (H, hi) if total(H)[r32, cx].max() < TARGET_L else (lo, H)
    pl = total(H); yb = int(round((mt + bh) * 2))
    prof = '  '.join(f'{d}px {pl[yb + 2 * d - 1, cx].max():.0f}' for d in PROFILE_PX if yb + 2 * d - 1 < pl.shape[0])
    print(f'{cap}: H {H:.1f}  Kc {PEAK_L - WHITE_FLOOR_NITS - H * s_pk:.1f}  peak-channel nits below the button: {prof}')
    return pl - WHITE_FLOOR_NITS

def light(z, rows):
    for name, (cap, mt, bh) in GEO_L.items():
        glow = broad(z, cap, mt, bh)
        fr = [resample(glow, sc, mt + bh + 1) * (1 - 0.15 * np.clip((1 - sc) / 0.1, 0, 1)) for sc in np.linspace(S0, S1, NF)]
        big = fr[-1].max(-1); t = np.clip(big / 1.0, 0, 1); mm = t * t * (3 - 2 * t)   # footprint: > 1 nit in the widest frame
        mpath = SHIP + name.replace('light-', 'light-mask-') + '.avif'
        from PIL import Image
        if 'pill' in name:      # the pill's only: a chip's spill takes no footprint mask (accentButton.css)
            Image.fromarray(np.dstack([np.full(big.shape + (3,), 255, np.uint8), np.rint(mm * 255).astype(np.uint8)]), 'RGBA').save(mpath, quality=92, speed=4)
        g = np.concatenate(fr, 0); plane = WHITE_FLOOR_NITS + np.clip(g, 0, None)
        s = write(plane, (g.max(-1) > 0.01).astype(np.float32), SHIP + name + '.avif')
        pk = float(plane.max()); open(OUT + name + '.peak', 'w').write(f'{pk:.3f}'); set_clli(SHIP + name + '.avif', clli_for(pk))
        rows.append(f'{name:22s} floor {WHITE_FLOOR_NITS:6.2f} nits (code 595)  peak {pk:6.1f} nits (PQ {pq(pk):.4f})  MaxCLL {clli_for(pk):4d}  '
                    f'{NF} frames {plane.shape[1]} x {plane.shape[0]}  {s/1024:5.1f} KB')
    fl = grey_nits(FACE_L)
    for name, cap in RIM_L.items():
        g = law_r2(z[cap + '|A'], z[cap + '|W'], 1.6); g = g * (PEAK_L - fl) / g.max(); plane = fl + g
        s = write(plane, (g.max(-1) > 0.01).astype(np.float32), SHIP + name + '.avif')
        pk = float(plane.max()); open(OUT + name + '.peak', 'w').write(f'{pk:.3f}'); set_clli(SHIP + name + '.avif', clli_for(pk))
        rows.append(f'{name:22s} floor {fl:6.2f} nits (the ink face)  peak {pk:6.1f} nits (PQ {pq(pk):.4f})  MaxCLL {clli_for(pk):4d}  {s/1024:5.1f} KB')
    s = write(field(ACID, LABEL_NITS), np.zeros((16, 16), np.float32), SHIP + LABEL_L + '.avif')
    open(OUT + LABEL_L + '.peak', 'w').write(f'{LABEL_NITS:.3f}'); set_clli(SHIP + LABEL_L + '.avif', clli_for(LABEL_NITS))
    rows.append(f'{LABEL_L:22s} acid field, peak channel {LABEL_NITS:6.1f} nits = PQ {pq(LABEL_NITS):.4f} (10-bit code {pq(LABEL_NITS) * 1023:5.1f})  '
                f'MaxCLL {clli_for(LABEL_NITS):4d}  {s/1024:5.1f} KB')

if __name__ == '__main__' and sys.argv[1:] == ['clli']:
    for name in list(LAYERS) + [LABEL] + LIGHT:
        pk = float(open(OUT + name + '.peak').read())
        set_clli(SHIP + name + '.avif', clli_for(pk)); print(name, get_clli(SHIP + name + '.avif'))
    sys.exit()

if __name__ == '__main__':
    z = np.load(CAPF)
    rows, peaks = [], {}
    for name, cap in MASKS.items():
        A = frames(z, cap)[-1][0] if cap in FRAMED else z[cap + '|A']
        s = mask_footprint(A, SHIP + name + '.avif')
        rows.append(f'{name:22s} mask {s/1024:5.1f} KB')
    for cap in FRAMED:                                     # where the widest frame's light starts (the chip's CSS box trim)
        A = frames(z, cap)[-1][0]; ys, xs = np.nonzero(A >= T_FOOT)
        rows.append(f'{cap:22s} widest frame lit from {ys.min() / 2:.1f}px top, {(A.shape[0] - 1 - ys.max()) / 2:.1f}px bottom, '
                    f'{xs.min() / 2:.1f}px left, {(A.shape[1] - 1 - xs.max()) / 2:.1f}px right')
    for name, (cap, vpk) in LAYERS.items():
        plane, glow, fl = bake(z, cap, vpk)
        nfr = NF if cap in FRAMED else 1
        pk = float(plane.max()); peaks[name] = pk
        open(OUT + name + '.peak', 'w').write(f'{pk:.3f}')
        s = write(plane, (glow.max(-1) > 0.01).astype(np.float32), SHIP + name + '.avif')
        set_clli(SHIP + name + '.avif', clli_for(pk))
        rows.append(f'{name:22s} floor {fl:5.2f} nits (code {pq(fl) * 1023:5.1f})  peak {pk:6.1f} nits (PQ {pq(pk):.4f})  '
                    f'MaxCLL {clli_for(pk):4d}  {nfr:2d} frame(s) {plane.shape[1]} x {plane.shape[0]}  {s/1024:5.1f} KB')
    nits = max(peaks.values()); assert nits <= 1216, nits     # the light's peak; house bright is 1216 (PQ 0.7732)
    open(OUT + LABEL + '.peak', 'w').write(f'{nits:.3f}')
    s = write(field(ACID, nits), np.zeros((16, 16), np.float32), SHIP + LABEL + '.avif')
    set_clli(SHIP + LABEL + '.avif', clli_for(nits))           # a flat field's true peak is its level
    rows.append(f'{LABEL:22s} acid field, peak channel {nits:6.1f} nits = PQ {pq(nits):.4f} (10-bit code {pq(nits) * 1023:5.1f})  '
                f'MaxCLL {clli_for(nits):4d}  {s/1024:5.1f} KB')
    light(z, rows)
    print('\n'.join(rows))
