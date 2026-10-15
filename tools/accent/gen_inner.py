"""Inner-falloff variants of the ?=2 rim-travel sprite (q6n4-travel-btn) and the chip rim pieces
(rim-bot / rim-cap / rim-top).  The ORIGINAL generators (scratchpad/sprite.py, proto3/gen_assets.py rimpieces)
are executed verbatim, with ONE change: the glow kernel Kg.  Original Kg = sum w/(1+d^2/r^2)^1.5 (long
Lorentzian tail).  Variant Kg = the 2-D kernel whose line integral across a straight lit rim is exactly
    P(d) = .55 exp(-d/t1) + .45 exp(-d/t2)         (same constants as gen_log.py: log 3/9 px, log2 2/5.5 px)
i.e.  k(r) = sum c_i K0(r/t_i) / (pi t_i)   (inverse Abel transform of an exponential is a Bessel K0).
Everything else (rim ring Kr, calibration 0.26 at 1.5px depth, depth window, colour drift, dither stream,
frame count, travel timing) is untouched, so the rim line stays put and only the inward falloff changes.
usage: gen_inner.py check   -> render originals into scratch/inner-orig and compare to the shipped avifs
       gen_inner.py ship    -> render log/log2 into src/assets/accent"""
import numpy as np, os, sys, re, copy
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
ASSETS = os.environ.get('ACCENT_OUT', 'out/')
# single exponentials: the spill's two-term mix (.55/.45 with a 9 / 5.5px tail) left the pill centre lit; here the inward falloff is ONE exponential
VAR = {'mid': ((1.0, 5.5), (0.0, 9.0)), 'log': ((1.0, 3.0), (0.0, 9.0)), 'log2': ((1.0, 2.0), (0.0, 5.5))}

def K0(x):
    x = np.asarray(x, np.float64); out = np.empty_like(x)
    m = x <= 2.0; xs = x[m]; y = (xs / 2) ** 2
    out[m] = -np.log(xs / 2) * np.i0(xs) + (-0.57721566 + 0.42278420 * y + 0.23069756 * y ** 2 + 0.03488590 * y ** 3
                                           + 0.00262698 * y ** 4 + 0.00010750 * y ** 5 + 0.00000740 * y ** 6)
    xl = x[~m]; z = 2 / xl
    out[~m] = np.exp(-xl) / np.sqrt(xl) * (1.25331414 - 0.07832358 * z + 0.02189568 * z ** 2 - 0.01062446 * z ** 3
                                           + 0.00587872 * z ** 4 - 0.00251540 * z ** 5 + 0.00053208 * z ** 6)
    return out.astype(np.float32)

def kern(variant):
    (c1, t1), (c2, t2) = VAR[variant]
    def KG(d2):
        r = np.sqrt(np.maximum(d2, 0.25 ** 2))        # floor: the rim samples are 0.5px apart
        return (c1 * K0(r / t1) / t1 + c2 * K0(r / t2) / t2).astype(np.float32)
    return KG

def load(path):
    a = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32); return a

# ---------------- sprite.py, verbatim except Kg ----------------
def sprite(variant, outdir):
    src = open(HERE + '/sprite.py').read()
    src = src[:src.index("build('q6n4-travel-btn'")]
    src = src.replace("OUT = os.environ.get('ACCENT_OUT', 'out/')", "OUT = %r" % (outdir,))
    old = "g = sum(w / (1 + d2 / (r * r)) ** 1.5 for w, r in zip(wk, r0))"
    assert old in src
    if variant: src = src.replace(old, "g = KG(d2)")
    ns = {'KG': kern(variant) if variant else None, '__name__': 'spr'}
    _a = sys.argv; sys.argv = ['sprite.py']
    exec(compile(src, 'sprite.py', 'exec'), ns)
    sys.argv = _a
    ns['build']('q6n4-travel-btn' + ('-' + variant if variant else ''), 227, 33)

# ---------------- gen_assets.rimpieces, verbatim except Kg ----------------
def pieces(variant, outdir):
    src = open(HERE + '/gen_assets.py').read()
    src = src[:src.index("if __name__")]
    old = "Kg = sum(w / (1 + d2 / (r * r)) ** 1.5 for w, r in zip(wk, r0)).astype(np.float32)"
    assert old in src
    if variant: src = src.replace(old, "Kg = KG(d2)")
    suf = '-' + variant if variant else ''
    src = src.replace("Image.fromarray(strip, 'RGBA').save(OUT + 'rim-cap.avif', quality=90, speed=4)", "Image.fromarray(strip, 'RGBA').save(OUT + 'rim-cap%s.avif', quality=90, speed=4)" % suf)
    src = src.replace("print('rim-cap', strip.shape, round(os.path.getsize(OUT + 'rim-cap.avif')", "print('rim-cap', strip.shape, round(os.path.getsize(OUT + 'rim-cap%s.avif')" % suf)
    src = src.replace("save(OUT + nm + '.avif'", "save(OUT + nm + '%s.avif'" % suf).replace("os.path.getsize(OUT + nm + '.avif')", "os.path.getsize(OUT + nm + '%s.avif')" % suf)
    src = src.replace("OUT = os.environ.get('ACCENT_OUT', 'out/')", "OUT = %r" % (outdir,))
    src = src.replace("PREV = OUT + 'prev/'", "PREV = %r" % (outdir + 'prev/',))
    ns = {'KG': kern(variant) if variant else None, '__file__': HERE + '/gen_assets.py', '__name__': 'ga'}
    exec(compile(src, 'gen_assets.py', 'exec'), ns)
    # replay the RNG consumption that preceded rimpieces() in gen_assets.__main__, so the dither stream is identical
    REF = 96; H = ns['H']
    for fn, a in ((ns['q5'], ('q5-under-btn', REF, H, 'btn')), (ns['q5'], ('q5-under-chip', REF, H, 'chip')),
                  (ns['q6_spill'], ('q6-spill-btn', REF, H, 'btn')), (ns['q6_spill'], ('q6-spill-chip', REF, H, 'chip'))):
        fn(*a)
    ns['q6_streak']('q6-streak-btn', 160, 6); ns['q6_streak']('q6-streak-chip', 160, 5)
    for n in ('q5-under-btn', 'q5-under-chip', 'q6-spill-btn', 'q6-spill-chip', 'q6-streak-btn', 'q6-streak-chip'):
        for ext in ('.avif',):
            p = outdir + n + ext
            if os.path.exists(p): os.remove(p)
    ns['rimpieces']()

if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'check':
        o = ASSETS + 'inner-orig/'; os.makedirs(o + 'prev/', exist_ok=True)
        sprite(None, o); pieces(None, o)
        for f in ('q6n4-travel-btn', 'rim-bot', 'rim-cap', 'rim-top'):
            a = load(o + f + '.avif'); b = load(ASSETS + f + '.avif')
            print(f, a.shape == b.shape, 'mean|diff| %.3f  max %.0f' % (np.abs(a - b).mean(), np.abs(a - b).max()))
    else:
        import shutil
        w = ASSETS + 'inner-work/'; os.makedirs(w + 'prev/', exist_ok=True)   # never render into the repo dir (the replay writes q5/q6 files)
        for v in (sys.argv[2:] or list(VAR)):
            sprite(v, w); pieces(v, w)
            for f in ('q6n4-travel-btn', 'rim-bot', 'rim-cap', 'rim-top'): shutil.copy(w + f + '-' + v + '.avif', ASSETS)
