"""q6n4's HDR light, dark and light, and its light-mode SDR art. The same construction as q5's (gen_hdr.py, whose
writer, colour path and MaxCLL stamp this uses): every lit layer is an OPAQUE PQ image whose value is floor + glow
per pixel, stamped with its TRUE peak as MaxCLL, and every state that the SDR button reaches with an opacity is a
pre-rendered frame instead (an HDR layer under an opacity below 1 or a transform is clamped to SDR in Chrome).

DARK (acid, the black-floor rows of the accent proposal at the 1x falloff; Mark: "dark = acid HDR")
  spill    the SHIPPED log spill's footprint (Mark, on the hero preview: the boosted one's "black is too far out"),
           gamma-space law at V_peak 1.35 as q5's (~400 nits), so it reads as the SDR light, brighter; 9 fade frames (the SDR fade, opacity max(0, 1 - 1.5 p)); floor #1a1a1a. The chip's 9-slice middle is held
           flat (its x peak would squeeze into a hairline on a narrow chip; a PQ plane's brightness is not coverage,
           so the SDR flatten mask cannot correct it)
  rim      cap (47 frames), bot, top on the chip face (#1a1a1a), the 48-frame travel sprite on the pill face
           (#0a0a0a), V_peak 1.9; the top as 5 fade frames (the SDR fade is an opacity)
  streak   5 fade frames (the SDR .9 -> 0 fade), V_peak 2.0, on each face
  THE CAP: round 2's V_peaks put the dark rim at ~880 nits and the streak at ~990, past Mark's screen's ceiling
  (+400 over white, 605 nits; round 5); a plane brighter than the headroom is tone-mapped whole, floor included
  (a grey box). So each dark layer's V_peak is lowered until its peak is 605: the law lifts only the core, so the
  tail stays where the SDR art has it. (The rounds he saw were stamped MaxCLL 203, which clipped their cores.)
  label    a flat acid field at 605, the light's peak (q6n4-hdr-label, both themes)
LIGHT (acid on the white floor; Mark: "light = Broad 300, acid, white floor")
  spill    round 5b's broad 300 at the +200 step (Mark: "300 / 408 is best for both"): the core ((A / A_pk)^1.5, unit
           peak) plus a long shoulder, the band 32px below the button as near 300 nits as a 405 peak allows, the peak
           +200 over the floor (405 nits, MaxCLL true peak); 9 fade frames
  rim, travel, streak   round 2's law on the ink face (#161616), scaled so the peak is 405
  label    q6n4-hdr-label (acid, 605), as dark: "the white is finally visible"
  SDR      treatment b (ink on paper): the boosted spill as an apple coloured shadow (gain 1.7); the rims, travel
           and streak are gen_light.py's b-q6n4-* (same capture, same palette), copied
A spill takes no footprint mask: its edges are the floor, and its own mask carries the host's bounds.
Run after capture.py (and `capture.py boost`, `capture.py broad`) and gen_light.py."""
import numpy as np, os, sys, shutil
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import gen_hdr as gh
from PIL import Image
z0 = np.load(gh.CAPF); z = {k: z0[k] for k in z0.files}
get = lambda k: (z[k + '|A'], z[k + '|W'])
SHIP, OUT = gh.SHIP, gh.OUT
LIGHT_SDR = os.path.join(HERE, 'out/light/')
rows = []

def flat_mid(a, e):
    a = a.copy(); a[:, e:a.shape[1] - e] = a[:, e - 1:e]; return a

def emit(frames, floor, name, P=None):
    """frames: glow arrays stacked top to bottom. P: scale them together so floor + the brightest channel is P."""
    g = np.concatenate(frames, 0)
    if P is not None: g = g * (P - floor) / max(float(g.max()), 1e-9)
    plane = floor + np.clip(g, 0, None)
    s = gh.write(plane, (g.max(-1) > 0.01).astype(np.float32), SHIP + name + '.avif')
    pk = float(plane.max()); gh.set_clli(SHIP + name + '.avif', gh.clli_for(pk))
    rows.append(f'{name:30s} floor {floor:6.2f}  peak {pk:6.1f} nits (PQ {gh.pq(pk):.4f})  MaxCLL {gh.clli_for(pk):4d}  '
                f'{len(frames):2d} frame(s) {plane.shape[1]} x {plane.shape[0]}  {s/1024:5.1f} KB')
    return pk

def mask(A, name, thresh=None):
    if thresh is None: s = gh.mask_footprint(A, SHIP + name + '.avif')
    else:
        t = np.clip(A / thresh, 0, 1); m = t * t * (3 - 2 * t)
        assert A.shape[0] % 2 == 0 and A.shape[1] % 2 == 0, (name, A.shape)
        Image.fromarray(np.dstack([np.full(A.shape + (3,), 255, np.uint8), np.rint(m * 255).astype(np.uint8)]), 'RGBA').save(SHIP + name + '.avif', quality=92, speed=4)
        s = os.path.getsize(SHIP + name + '.avif')
    rows.append(f'{name:30s} mask  {s/1024:5.1f} KB')

DARK_CAP = 605.0                  # the dark in-face light's ceiling (Mark's screen, round 5)
DK, PILLFACE, INK = gh.grey_nits(26), gh.grey_nits(10), gh.grey_nits(22)    # #1a1a1a, #0a0a0a, #161616
def capped(A, W, vpk, floor, cap=None):
    """round 2's law at V_peak, or lower: the largest V_peak whose plane peaks at or under `cap` nits"""
    cap = cap or DARK_CAP
    g = gh.law_r2(A, W, vpk)
    if floor + g.max() <= cap: return g
    lo, hi = 1.0, vpk
    for _ in range(40):
        v = (lo + hi) / 2
        lo, hi = (v, hi) if floor + gh.law_r2(A, W, v).max() <= cap else (lo, v)
    return gh.law_r2(A, W, lo)

fades = lambda g, n: [g * (1 - i / (n - 1)) for i in range(n)]
ramp = lambda g, n: [g * (i / (n - 1)) for i in range(n)]                   # the top fades IN

def dark():
    peaks = []
    for sh in ('pill', 'chip'):      # the SHIPPED spill (log, 1x): its footprint, V_peak 1.35 as q5's (~400 nits)
        A, W = get(f'q6n4-spill-{sh}')
        if sh == 'chip': A, W = flat_mid(A, 132), flat_mid(W, 132)
        peaks.append(emit(fades(capped(A, W, 1.35, DK), 9), DK, f'q6n4-hdr-dark-spill-{sh}'))
    for sh, fl in (('pill', PILLFACE), ('chip', DK)):
        A, W = get(f'q6n4-streak-{sh}'); mask(A, f'q6n4-hdr-mask-streak-{sh}')
        peaks.append(emit(fades(capped(A, W, 2.0, fl), 5), fl, f'q6n4-hdr-dark-streak-{sh}'))
    for nm, fl in (('rim-cap', DK), ('rim-bot', DK), ('travel-pill', PILLFACE)):
        A, W = get(f'q6n4-{nm}'); mask(A, f'q6n4-hdr-mask-{nm}')
        peaks.append(emit([capped(A, W, 1.9, fl)], fl, f'q6n4-hdr-dark-{nm}'))
    A, W = get('q6n4-rim-top'); mask(A, 'q6n4-hdr-mask-rim-top')
    peaks.append(emit(ramp(capped(A, W, 1.9, DK), 5), DK, 'q6n4-hdr-dark-rim-top'))
    nits = gh.LABEL_NITS
    s = gh.write(gh.field(gh.ACID, nits), np.zeros((16, 16), np.float32), SHIP + 'q6n4-hdr-label.avif')
    gh.set_clli(SHIP + 'q6n4-hdr-label.avif', gh.clli_for(nits))
    rows.append(f'q6n4-hdr-label                 acid field, peak channel {nits:6.1f} nits = PQ {gh.pq(nits):.4f} (10-bit code {gh.pq(nits) * 1023:5.1f})  '
                f'MaxCLL {gh.clli_for(nits)}  {s/1024:.1f} KB  (dark peaks {", ".join(f"{p:.0f}" for p in peaks)})')

GEO_L = {'pill': ('b5-q6n4-pill', 30, 33), 'chip': ('b5-q6n4-chip', 26, 32)}
def broad(cap, mt, bh, chip):
    """round 5b, q6n4: core (A / A_pk)^1.5 at unit peak, plus the shoulder; the band 32px below at TARGET_L"""
    A, W = get(cap + '-core'); apk = float(A.max()); C = np.stack(gh.PAL)
    core = (np.clip(A / apk, 0, 1) ** 1.5)[..., None] * gh.to_nits(W @ C) / max(float(gh.to_nits(C[0]).max()), 1e-6)
    core = core / core.max()
    S = z[cap + '-sh|A']; col = gh.to_nits(gh.PAL[0]); shl = S[..., None] * (col / col.max())
    if chip:
        e = 2 * (110 + 26); core, shl, S = flat_mid(core, e), flat_mid(shl, e), flat_mid(S, e)
    cx = core.shape[1] // 2; r32 = int(round((mt + bh) * 2)) + 64
    ipk = np.unravel_index(core.max(-1).argmax(), core.shape[:2]); s_pk = float(S[ipk])
    F = gh.WHITE_FLOOR_NITS
    total = lambda H: F + (gh.PEAK_L - F - H * s_pk) * core + H * shl
    lo, hi = 0.0, min(400.0, (gh.PEAK_L - F) / s_pk)
    for _ in range(40):
        H = (lo + hi) / 2
        lo, hi = (H, hi) if total(H)[r32, cx].max() < gh.TARGET_L else (lo, H)
    pl = total(H); yb = int(round((mt + bh) * 2))
    prof = '  '.join(f'{d}px {pl[yb + 2 * d - 1, cx].max():.0f}' for d in gh.PROFILE_PX if yb + 2 * d - 1 < pl.shape[0])
    print(f'{cap}: H {H:.1f}  Kc {gh.PEAK_L - F - H * s_pk:.1f}  peak-channel nits below the button: {prof}')
    return pl - F

def light():
    for sh, (cap, mt, bh) in GEO_L.items():
        g = broad(cap, mt, bh, sh == 'chip')
        emit(fades(g, 9), gh.WHITE_FLOOR_NITS, f'q6n4-hdr-light-spill-{sh}')
    for sh in ('pill', 'chip'):
        A, W = get(f'q6n4-streak-{sh}')
        emit(fades(gh.law_r2(A, W, 2.0), 5), INK, f'q6n4-hdr-light-streak-{sh}', P=gh.PEAK_L)
    for nm in ('rim-cap', 'rim-bot', 'travel-pill'):
        A, W = get(f'q6n4-{nm}')
        emit([gh.law_r2(A, W, 1.9)], INK, f'q6n4-hdr-light-{nm}', P=gh.PEAK_L)
    A, W = get('q6n4-rim-top')
    emit(ramp(gh.law_r2(A, W, 1.9), 5), INK, 'q6n4-hdr-light-rim-top', P=gh.PEAK_L)

def light_sdr():
    """treatment b. The spill: the boosted spill (as the light-mode HDR's SDR twin) as an apple coloured shadow."""
    rng = np.random.default_rng(29)
    APPLE8, INK8 = np.array([150, 213, 0.]), np.array([85, 123, 0.])
    pal = np.stack((APPLE8 * .5 + INK8 * .5, APPLE8, APPLE8))
    for sh in ('pill', 'chip'):
        A, W = get(f'q6n4-spillB-{sh}')
        n = lambda: rng.random(A.shape) + rng.random(A.shape) - 1.0
        a8 = np.clip(np.rint(np.clip(A * 1.7, 0, 1) * 255 + n()), 0, 255)
        c8 = np.clip(np.rint(W @ pal + np.stack([n(), n(), n()], -1)), 0, 255)
        p = SHIP + f'q6n4-light-spill-{sh}.avif'
        Image.fromarray(np.dstack([c8, a8]).astype(np.uint8), 'RGBA').save(p, quality=92, speed=4)
        rows.append(f'q6n4-light-spill-{sh:25s} SDR  {os.path.getsize(p)/1024:5.1f} KB')
    for nm in ('rim-cap', 'rim-bot', 'rim-top', 'travel-pill', 'streak-pill', 'streak-chip'):
        shutil.copy(LIGHT_SDR + f'b-q6n4-{nm}.avif', SHIP + f'q6n4-light-{nm}.avif')
        rows.append(f'q6n4-light-{nm:24s} SDR  {os.path.getsize(SHIP + f"q6n4-light-{nm}.avif")/1024:5.1f} KB  (gen_light b-q6n4-{nm})')

if __name__ == '__main__':
    dark(); light(); light_sdr()
    print('\n'.join(rows))
