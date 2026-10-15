"""One entry point for the HDR light sets:  tools/hdr/build.sh <target> [--ship-avif] [--lossless-report]

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
        return hdr.rgba(unit * P, np.clip(gmax / (P - floor), 0, 1), rng=rng)
    rng = np.random.default_rng(133); light = {}
    for name, (c, mt, bh) in gh.GEO_L.items():                 # the spill: 17 state frames, one sheet
        glow = gh.broad(cap, c, mt, bh)
        fr = [gh.resample(glow, sc, mt + bh + 1) * (1 - 0.15 * np.clip((1 - sc) / 0.1, 0, 1)) for sc in np.linspace(gh.S0, gh.S1, gh.NF)]
        light[name] = (np.clip(np.concatenate(fr, 0), 0, None), F)
    for name, c in gh.RIM_L.items():                           # the rim, inside the ink face
        g = gh.law_r2(cap[c + '|A'], cap[c + '|W'], 1.6); light[name] = (g * (P - INK) / g.max(), INK)
    t = step('render the light (17 frames x 2 shapes, 2 rims)', t)
    px = {n: transparent(g, fl, rng) for n, (g, fl) in light.items()}
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

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'q5-light'
    T = time.time()
    rows = {'q5-light': q5_light}[target]('--ship-avif' in sys.argv, '--lossless-report' in sys.argv)
    print(f'\n{"step":64s} {"time":>7s}'); [print(f'{n:64s} {s:6.2f}s') for n, s in steps]
    print(f'{"total (wall)":64s} {time.time() - T:6.2f}s\n'); print(hdr.table(rows))
