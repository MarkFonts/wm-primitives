"""One entry point for the HDR light sets:  tools/hdr/build.sh <target> [--ship-avif] [--lossless-report]

  q5-rim-dark, q5-rim-light   q5's rim alone, AVIF and JXL from the same arrays (the SDR rim's shape, gen_hdr.rim_glow)
  q6n4-dark, q6n4-light   q6n4's light as transparent JXL (the AVIF sets are gen_q6n4.py's, unchanged)
  q5-dark    q5's dark light as transparent JXL (the AVIF dark set is gen_hdr.py's, unchanged)
  q5-light   q5's light-mode light: the transparent JXL set (shipped) and, from the SAME float arrays, the opaque AVIF
             fallback (written to tools/accent/out/hdr-avif/; --ship-avif replaces the shipped AVIFs, which gen_hdr.py
             made and which are otherwise left byte for byte as they are)

The light is simulated once (tools/accent/capture.py -> out/cap.npz) and only read here; every format is an encode of
the same arrays. Prints a per-step timing table and a size table."""
import numpy as np, os, sys, time, shutil
HERE = os.path.dirname(os.path.abspath(__file__)); ACC = os.path.join(HERE, '../accent')
sys.path.insert(0, HERE); sys.path.insert(0, ACC)
import hdr

steps = []
def step(name, t0): steps.append((name, time.time() - t0)); return time.time()

def q5_light(ship_avif=False, lossless_report=False):
    t = time.time()
    import gen_hdr as gh
    z = np.load(gh.CAPF); keys = set(z.files)
    cap = {k: z[k] for k in ('b5-q5-pill-core|A', 'b5-q5-pill-core|W', 'b5-q5-pill-sh|A', 'b5-q5-chip-core|A', 'b5-q5-chip-core|W',
                             'b5-q5-chip-sh|A', 'q5-rim-pill|A', 'q5-rim-pill|W', 'q5-rim-chip|A', 'q5-rim-chip|W')}
    t = step('load the capture (cap.npz)', t)
    P, F, INK = gh.PEAK_L, gh.WHITE_FLOOR_NITS, gh.grey_nits(gh.FACE_L)
    acid = gh.to_nits(gh.PAL[0]); acid = acid / acid.max()
    def transparent(glow, floor, rng):
        gmax = glow.max(-1)
        unit = np.where(gmax[..., None] > 1e-6, glow / np.maximum(gmax, 1e-9)[..., None], acid)
        return hdr.rgba(unit * P, hdr.coverage(gmax, floor, P), rng=rng)
    rng = np.random.default_rng(133); light = {}
    for name, (c, mt, bh) in gh.GEO_L.items():                 # the spill: 17 state frames, one sheet
        glow = gh.broad(cap, c, mt, bh)
        fr = [gh.resample(glow, sc, mt + bh + 1) * (1 - 0.15 * np.clip((1 - sc) / 0.1, 0, 1)) for sc in np.linspace(gh.S0, gh.S1, gh.NF)]
        light[name] = (np.clip(np.concatenate(fr, 0), 0, None), F)
    for name, c in gh.RIM_L.items():                           # the rim, inside the ink face
        light[name] = (gh.rim_glow(cap, c, P - INK), INK)        # the SDR rim's shape (gen_hdr.rim_glow)
    t = step('render the light (17 frames x 2 shapes, 2 rims)', t)
    # the spills' glow is already one colour (the acid shoulder carries the tail); the rims get one too (constant_light)
    px = {n: transparent(g, fl, rng) if n in gh.GEO_L else hdr.rgba(*hdr.constant_light(g, fl, P, acid), rng=rng)
          for n, (g, fl) in light.items()}
    t = step('quantise + dither (16-bit PQ RGBA)', t)
    jobs = [hdr.Jxl(px[n], os.path.join(gh.SHIP, n.replace('q5-hdr-light', 'q5-jxl-light') + '.jxl'), P) for n in light]
    avif_dir = gh.SHIP if ship_avif else os.path.join(ACC, 'out/hdr-avif/'); os.makedirs(avif_dir, exist_ok=True)
    jobs += [hdr.Avif(fl + g, (g.max(-1) > 0.01).astype(np.float32), os.path.join(avif_dir, n + '.avif'), fl + g.max()) for n, (g, fl) in light.items()]
    if lossless_report:
        rep = os.path.join(ACC, 'out/jxl-report/'); os.makedirs(rep, exist_ok=True)
        for d, a, tag in ((0.2, 0, 'd0.2'), (0, 0, 'lossless')):
            jobs += [hdr.Jxl(px[n], os.path.join(rep, n.replace('q5-hdr-light', 'q5-jxl-light') + f'-{tag}.jxl'), P, distance=d, alpha_distance=a) for n in light]
    rows, secs = hdr.run(jobs)
    t = step(f'encode {len(jobs)} files in parallel ({sum(r[7] != "skipped" for r in rows)} run, the rest unchanged)', t)
    return rows

def q5_dark(ship_avif=False, lossless_report=False):
    """q5's dark light: the same planes as gen_hdr.py's dark set (the shipped log spill's footprint at 398 nits, the rim
    at 589 on the #1a1a1a face), as transparent JXL: one acid colour at the peak, all of the falloff in alpha
    (hdr.constant_light: the luminance hdr.coverage() gave, without the drifting hue)"""
    t = time.time()
    import gen_hdr as gh
    z = np.load(gh.CAPF); cap = {k: z[k] for k in ('q5-pill|A', 'q5-pill|W', 'q5-chip|A', 'q5-chip|W', 'q5-rim-pill|A', 'q5-rim-pill|W', 'q5-rim-chip|A', 'q5-rim-chip|W')}
    t = step('load the capture (cap.npz)', t)
    light = {}
    for name, (c, vpk) in gh.LAYERS.items():                     # spills: 17 frames (gen_hdr.bake frames them); rims
        plane, glow, fl = gh.bake(cap, c, vpk); light[name] = (np.clip(glow, 0, None), fl, float(plane.max()))
    t = step('render the light (17 frames x 2 shapes, 2 rims)', t)
    acid = gh.to_nits(gh.PAL[0]); acid = acid / acid.max(); rng = np.random.default_rng(134); px = {}
    for n, (g, fl, pk) in light.items():                         # one colour, the acid; the falloff in alpha
        px[n] = (hdr.rgba(*hdr.constant_light(g, fl, pk, acid), rng=rng), pk)
    t = step('quantise + dither (16-bit PQ RGBA)', t)
    jobs = [hdr.Jxl(p, os.path.join(gh.SHIP, n.replace('q5-hdr-dark', 'q5-jxl-dark') + '.jxl'), pk) for n, (p, pk) in px.items()]
    if lossless_report:
        rep = os.path.join(ACC, 'out/jxl-report/'); os.makedirs(rep, exist_ok=True)
        for d, a, tag in ((0.2, 0, 'd0.2'), (0, 0, 'lossless')):
            jobs += [hdr.Jxl(p, os.path.join(rep, n.replace('q5-hdr-dark', 'q5-jxl-dark') + f'-{tag}.jxl'), pk, distance=d, alpha_distance=a) for n, (p, pk) in px.items()]
    rows, secs = hdr.run(jobs)
    t = step(f'encode {len(jobs)} files in parallel ({sum(r[7] != "skipped" for r in rows)} run, the rest unchanged)', t)
    return rows

def hot_hue(gh, W):
    """the colour at full level of a captured light's palette weights W (core / tail / hot), with the TAIL folded into
    the core: the SDR ramp's drift toward a pale olive by distance is not carried into a transparent HDR light, the
    streak's white-hot core is. Unit peak channel, per pixel."""
    Wf = W.copy(); Wf[..., 0] += Wf[..., 1]; Wf[..., 1] = 0
    h = gh.to_nits(Wf @ np.stack(gh.PAL)); return h / np.maximum(h.max(-1, keepdims=True), 1e-9)

def travel_hue(q, gh, acid):
    """the travel sprite's colour, frame by frame: acid, and over the bottom rows the pill's baked streak mixed in by
    its share of the light (gen_q6n4.travel_with_streak, the same frames and opacities)"""
    A, W = q.get('q6n4-travel-pill'); As, Ws = q.get('q6n4-streak-pill'); s_hue = hot_hue(gh, Ws)
    H = 66; n = A.shape[0] // H; hs = As.shape[0]; out = []
    for f in range(n):
        o = max(.2, .9 - 1.2 * f / (n - 1))
        h = np.broadcast_to(acid, (H, A.shape[1], 3)).copy()
        gt = q.lin(A[f * H:(f + 1) * H], W[f * H:(f + 1) * H])[H - hs:].max(-1)[..., None]
        gs = q.lin(As, Ws, o).max(-1)[..., None]
        h[H - hs:] = np.where(gt + gs > 0, (gt * acid + gs * s_hue) / np.maximum(gt + gs, 1e-12), acid)
        out.append(h / h.max(-1, keepdims=True))
    return np.concatenate(out, 0)

def q6n4(theme):
    """q6n4's light, dark or light, as transparent JXL: the same planes as gen_q6n4.py's AVIF sets (the spill's 9 fade
    frames, the chip's streak frames, the rim cap / bot / top, the 48-frame travel sprite with the pill's streak baked
    in), each as ONE colour at its peak with all of the falloff in alpha (hdr.constant_light, the luminance
    hdr.coverage() gave over its floor); the light spills, already one colour, as they were"""
    t = time.time()
    import gen_q6n4 as q, gen_hdr as gh
    t = step('load the capture (cap.npz)', t)
    L = []                                                       # (name, frames, floor)
    if theme == 'dark':
        cap, F_sp, F_in = q.DARK_CAP, q.DK, q.DK
        for sh in ('pill', 'chip'):
            A, W = q.get(f'q6n4-spill-{sh}')
            if sh == 'chip': A, W = q.flat_mid(A, 132), q.flat_mid(W, 132)
            L.append((f'spill-{sh}', q.fades(q.capped(A, W, 1.35, q.DK), 9), F_sp))
    else:
        cap, F_sp, F_in = gh.PEAK_L, gh.WHITE_FLOOR_NITS, q.INK
        for sh, (c, mt, bh) in q.GEO_L.items():
            L.append((f'spill-{sh}', q.fades(q.broad(c, mt, bh, sh == 'chip'), 9), F_sp))
    A, W = q.get('q6n4-streak-chip'); k = (cap - F_in) / float(q.lin(A, W, .9).max())
    L.append(('streak-chip', [q.lin(A, W, o) * k for o in q.STREAK_O], F_in))
    K = q.rim_scale(cap, F_in)
    for nm in ('rim-cap', 'rim-bot'):
        L.append((nm, [q.lin(*q.get(f'q6n4-{nm}')) * K], F_in))
    L.append(('rim-top', q.ramp(q.lin(*q.get('q6n4-rim-top')) * K, 5), F_in))
    fr, _ = q.travel_with_streak(cap, F_in); L.append(('travel-pill', fr, F_in))
    t = step(f'render the light ({len(L)} layers, {sum(len(f) for _, f, _ in L)} frames)', t)
    acid = gh.to_nits(gh.PAL[0]); acid = acid / acid.max(); rng = np.random.default_rng(1330 + (theme == 'light')); px = {}
    # ONE colour per layer, the falloff in alpha (hdr.constant_light): the acid, except the streak's white-hot core
    # (gen_assets.q6_streak's 65% mix toward (255, 255, 240), the palette's 'hot'), which is the look and is kept as a
    # colour that does not change with level. The light spills already store one colour and are left as they are.
    A, W = q.get('q6n4-streak-chip'); s_hue = hot_hue(gh, W)
    hue = {'streak-chip': np.concatenate([s_hue] * len(q.STREAK_O), 0), 'travel-pill': travel_hue(q, gh, acid)}
    for n, frames, fl in L:
        g = np.clip(np.concatenate(frames, 0), 0, None); gmax = g.max(-1); pk = fl + float(gmax.max())
        if theme == 'light' and n.startswith('spill-'):
            unit = np.where(gmax[..., None] > 1e-6, g / np.maximum(gmax, 1e-9)[..., None], acid)
            px[n] = (hdr.rgba(unit * pk, hdr.coverage(gmax, fl, pk), rng=rng), pk)
        else:
            px[n] = (hdr.rgba(*hdr.constant_light(g, fl, pk, hue.get(n, acid)), rng=rng), pk)
    t = step('quantise + dither (16-bit PQ RGBA)', t)
    jobs = [hdr.Jxl(p, os.path.join(gh.SHIP, f'q6n4-jxl-{theme}-{n}.jxl'), pk) for n, (p, pk) in px.items()]
    rows, secs = hdr.run(jobs)
    t = step(f'encode {len(jobs)} files in parallel ({sum(r[7] != "skipped" for r in rows)} run, the rest unchanged)', t)
    return rows

def q5_rim(theme):
    """q5's rim alone, dark or light, for BOTH paths from the same arrays: the opaque PQ AVIF (floor + glow, the
    shipped footprint masks unchanged) and the transparent JXL. The SDR rim in linear light, one factor for both
    pieces (gen_hdr.rim_glow), peaking where it did; the spills are left alone"""
    t = time.time()
    import gen_hdr as gh
    z = np.load(gh.CAPF); cap = {k: z[k] for c in gh.RIM_CAPS for k in (c + '|A', c + '|W')}
    t = step('load the capture (cap.npz)', t)
    if theme == 'dark': fl, pk, names = gh.grey_nits(gh.FLOOR), gh.RIM_PEAK_D, {n: c for n, (c, _) in gh.LAYERS.items() if c in gh.RIM_CAPS}
    else: fl, pk, names = gh.grey_nits(gh.FACE_L), gh.PEAK_L, gh.RIM_L
    light = {n: gh.rim_glow(cap, c, pk - fl) for n, c in names.items()}
    t = step(f'render the rim ({len(light)} pieces)', t)
    acid = gh.to_nits(gh.PAL[0]); acid = acid / acid.max(); rng = np.random.default_rng(1340 + (theme == 'light')); px = {}
    for n, g in light.items():                                   # one colour, the acid; the falloff in alpha
        px[n] = hdr.rgba(*hdr.constant_light(g, fl, pk, acid), rng=rng)
    t = step('quantise + dither (16-bit PQ RGBA)', t)
    jobs = [hdr.Jxl(px[n], os.path.join(gh.SHIP, n.replace('-hdr-', '-jxl-') + '.jxl'), pk) for n in light]
    jobs += [hdr.Avif(fl + g, (g.max(-1) > 0.01).astype(np.float32), os.path.join(gh.SHIP, n + '.avif'), fl + float(g.max())) for n, g in light.items()]
    rows, secs = hdr.run(jobs)
    t = step(f'encode {len(jobs)} files in parallel ({sum(r[7] != "skipped" for r in rows)} run, the rest unchanged)', t)
    return rows

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'q5-light'
    T = time.time()
    targets = {'q5-light': lambda: q5_light('--ship-avif' in sys.argv, '--lossless-report' in sys.argv),
               'q5-dark': lambda: q5_dark(False, '--lossless-report' in sys.argv),
               'q6n4-dark': lambda: q6n4('dark'), 'q6n4-light': lambda: q6n4('light'),
               'q5-rim-dark': lambda: q5_rim('dark'), 'q5-rim-light': lambda: q5_rim('light')}
    rows = targets[target]()
    print(f'\n{"step":64s} {"time":>7s}'); [print(f'{n:64s} {s:6.2f}s') for n, s in steps]
    print(f'{"total (wall)":64s} {time.time() - T:6.2f}s\n'); print(hdr.table(rows))
