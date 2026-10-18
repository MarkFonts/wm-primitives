"""The shared HDR encoder: absolute-nit float arrays in, PQ files out, two containers.

  JPEG XL  TRANSPARENT HDR. 16-bit RGBA whose RGB are Rec.2100 PQ code values (BT.2020 primaries) and whose alpha is
           straight coverage -> cjxl -x color_space=Rec2100PQ --intensity_target=<true peak>. A JXL light composites on
           any ground with no box (wm-primitives#133: Safari, Chrome with the flag or from 155, iPhone Safari). Still
           images only: animated JXL does not play on iOS, so a state sprite is ONE sheet stepped by CSS.
  AVIF     OPAQUE HDR, the fallback: PQ + alpha AVIF decodes fully transparent in Chrome, so these carry no alpha and
           bake their floor (tools/accent/gen_hdr.py's route 2b). 16-bit RGBX -> pq_write.swift (itur_2100_PQ) ->
           PNG -> sips. The clli box is rewritten to the true peak (sips stamps 1000).

Checks, every file: the stamp is the TRUE peak (a stamp below it clips; 203 and 1000 are refused unless they are the
peak); AVIF sides are even (Chrome decodes a PQ AVIF with an odd side as fully transparent; a JXL may be odd).

The path is short on purpose: numpy for every per-pixel step; the JXL intermediate is a raw 16-bit PAM written
straight from the array (no zlib PNG) to a temp file that is deleted; each job is hashed (array bytes + parameters)
and skipped when its output already matches; jobs run in parallel (the encoders are separate processes).

  import hdr
  px = hdr.rgba(nits_rgb, alpha)                         # floats -> 16-bit PQ RGBA (dithered alpha)
  px = hdr.rgba(*hdr.constant_light(glow, floor, peak, acid))   # one colour, the falloff in alpha
  rows, secs = hdr.run([hdr.Jxl(px, 'x.jxl', peak), hdr.Avif(nits, lit, 'x.avif', peak)])
  print(hdr.table(rows))
"""
import numpy as np, os, struct, subprocess, tempfile, hashlib, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
PQ_WRITE = os.environ.get('PQ_WRITE', os.path.join(HERE, '../accent/out/pq_write'))
CACHE = os.environ.get('HDR_CACHE', os.path.join(HERE, '../accent/out/.hdr-cache'))

def pq(nits):
    """SMPTE ST 2084 inverse EOTF: absolute nits -> 0..1"""
    m1, m2, c1, c2, c3 = 0.1593017578125, 78.84375, 0.8359375, 18.8515625, 18.6875
    y = np.clip(np.asarray(nits, np.float64) / 10000.0, 0, 1) ** m1
    return ((c1 + c2 * y) / (1 + c3 * y)) ** m2

def _peak_ok(peak, true_peak, path):
    p = int(np.ceil(true_peak))
    assert int(peak) >= p, f'{path}: stamped {peak} under its true peak {true_peak:.1f} -- it would clip there'
    assert int(peak) not in (203, 1000) or int(peak) == p, f'{path}: stamp {peak} is a default, not this image\'s peak ({p})'

def rgba(nits_rgb, alpha, rng=None, dither=True):
    """nits (H x W x 3, linear BT.2020, absolute) + straight alpha (H x W, 0..1) -> 16-bit PQ RGBA (uint16).
    The colour sits on 10-bit codes; the alpha, which carries the falloff, on 8-bit steps with triangular dither
    between them, so a long falloff does not band (the shipped SDR art is dithered the same way)."""
    rng = rng or np.random.default_rng(7)
    a = np.clip(np.asarray(alpha, np.float64), 0, 1)
    c = np.rint(pq(nits_rgb) * 1023) / 1023
    c = np.where((a > 0)[..., None], c, c.reshape(-1, 3)[np.argmax(a)])     # no light: one colour (never seen)
    if dither:
        tri = rng.random(a.shape) + rng.random(a.shape) - 1.0
        a = np.where((a > 0) & (a < 1), np.rint(a * 255 + tri) / 255, a)
    return np.rint(np.dstack([np.clip(c, 0, 1), np.clip(a, 0, 1)[..., None]]) * 65535).astype(np.uint16)

def enc(nits):
    """the extended sRGB curve on nits / 203 (203 = SDR white): the gamma-encoded space a browser composites in"""
    x = np.maximum(np.asarray(nits, np.float64), 0) / 203.0
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)

def coverage(glow_max, floor, peak):
    """the alpha that puts a light of colour `peak` over `floor` at floor + glow, compositing in the gamma-encoded space
    (as the page does): a = (enc(floor + glow) - enc(floor)) / (enc(peak) - enc(floor)). A linear-light alpha, glow /
    (peak - floor), is far too small in a long tail over a dark floor (a 5-nit glow on 2 nits came out at 1/7)."""
    return np.clip((enc(floor + glow_max) - enc(floor)) / (enc(peak) - enc(floor)), 0, 1)

def dec(e):
    """enc()'s inverse: the gamma-encoded value -> nits"""
    e = np.maximum(np.asarray(e, np.float64), 0)
    return np.where(e <= 0.04045, e / 12.92, ((e + 0.055) / 1.055) ** 2.4) * 203.0

LUMA = np.array([0.2627, 0.6780, 0.0593])                # BT.2020 luminance weights (the arrays are linear BT.2020 nits)

def composite(rgb, a, floor):
    """what the page shows: `rgb` (nits) at straight alpha `a` over a grey `floor` (nits), composited in the
    gamma-encoded space, per channel -> nits"""
    a = np.asarray(a, np.float64)[..., None]
    return dec(enc(floor) + a * (enc(rgb) - enc(floor)))

def constant_light(glow, floor, peak, hue=None, iters=32):
    """ONE colour per asset, all of the falloff in alpha (wm-primitives, jxl-drift). glow: H x W x 3 nits over `floor`.
    hue: the colour at full level, (3,) for the whole asset or H x W x 3 (the streak's white-hot core, kept); its
    brightest channel is put at `peak`. The alpha is solved, per pixel, so the composite over `floor` has the
    LUMINANCE the old encoding gave (the glow's own colour at the peak, hdr.coverage()): the shape is unchanged, and
    only the hue stops drifting. The old encoding stored glow / max(glow), which carried the SDR ramp's pale tail and
    the gamma law's own lean toward blue at low levels up to the peak; at low alpha that read as a pale ~400-nit
    colour, and iPhone Safari tone-mapped it into a grey-teal band (wordmark#69). Returns (rgb nits, alpha)."""
    g = np.clip(np.asarray(glow, np.float64), 0, None); gmax = g.max(-1)
    hue = np.asarray(hue, np.float64)
    unit = np.where(gmax[..., None] > 1e-6, g / np.maximum(gmax, 1e-9)[..., None], hue / hue.max(-1, keepdims=True))
    a0 = coverage(gmax, floor, peak)
    target = composite(unit * peak, a0, floor) @ LUMA
    col = np.broadcast_to(hue / hue.max(-1, keepdims=True) * peak, g.shape)
    y0, y1 = composite(col, np.zeros_like(a0), floor) @ LUMA, composite(col, np.ones_like(a0), floor) @ LUMA
    assert np.all(y1 > y0), 'the colour must be brighter than the floor'
    lo, hi = np.zeros_like(a0), np.ones_like(a0)
    for _ in range(iters):                               # monotonic in a: bisect
        mid = (lo + hi) / 2; up = composite(col, mid, floor) @ LUMA < target
        lo, hi = np.where(up, mid, lo), np.where(up, hi, mid)
    a = np.where(a0 > 0, (lo + hi) / 2, 0.0)
    return np.ascontiguousarray(col), a

def pam16(px, path):
    """raw 16-bit PAM (RGB_ALPHA), big-endian, straight from the array"""
    h, w = px.shape[:2]
    with open(path, 'wb') as f:
        f.write(f'P7\nWIDTH {w}\nHEIGHT {h}\nDEPTH 4\nMAXVAL 65535\nTUPLTYPE RGB_ALPHA\nENDHDR\n'.encode())
        f.write(px.astype('>u2').tobytes())

def _hash(arrs, params):
    h = hashlib.sha256(repr(params).encode())
    for a in arrs: h.update(np.ascontiguousarray(a).tobytes())
    return h.hexdigest()

class Job:
    def fresh(self):
        os.makedirs(CACHE, exist_ok=True)
        self._stamp = os.path.join(CACHE, os.path.basename(self.path) + '.sha')
        return os.path.exists(self.path) and os.path.exists(self._stamp) and open(self._stamp).read() == self.key
    def done(self): open(self._stamp, 'w').write(self.key)

class Jxl(Job):
    def __init__(self, px, path, true_peak, distance=1.0, alpha_distance=1.0, effort=7):
        self.px, self.path = px, path
        self.peak = int(np.ceil(true_peak)); _peak_ok(self.peak, true_peak, path)
        self.args = ['-x', 'color_space=Rec2100PQ', f'--intensity_target={self.peak}', '-d', str(distance),
                     '-a', str(alpha_distance), '-e', str(effort), '--quiet']
        self.key = _hash([px], ('jxl', self.args)); self.fmt, self.dist = 'jxl', f'{distance}/{alpha_distance}'
    def encode(self):
        with tempfile.NamedTemporaryFile(suffix='.pam') as t:
            pam16(self.px, t.name)
            subprocess.run(['cjxl', t.name, self.path] + self.args, check=True, capture_output=True)

class Avif(Job):
    def __init__(self, nits_rgb, lit, path, true_peak, seed=31):
        h, w = nits_rgb.shape[:2]
        assert h % 2 == 0 and w % 2 == 0, f'{path}: {w} x {h} -- a PQ AVIF with an odd side decodes transparent'
        self.nits, self.lit, self.path, self.seed, self.px = nits_rgb, lit, path, seed, nits_rgb
        self.peak = int(np.ceil(true_peak)); _peak_ok(self.peak, true_peak, path)
        self.key = _hash([nits_rgb, lit], ('avif', self.peak, seed)); self.fmt, self.dist = 'avif', '-'
    def encode(self):
        rng = np.random.default_rng(self.seed)
        code = pq(self.nits) * 1023
        code = np.clip(np.rint(code + (rng.random(code.shape) + rng.random(code.shape) - 1.0) * self.lit[..., None]), 0, 1023)
        u16 = np.rint(code * 65535 / 1023).astype('<u2'); h, w = u16.shape[:2]
        with tempfile.TemporaryDirectory() as td:
            rp, pp = os.path.join(td, 'in.u16'), os.path.join(td, 'in.png')
            np.dstack([u16, np.full((h, w, 1), 65535, '<u2')]).tofile(rp)
            subprocess.run([PQ_WRITE, rp, str(w), str(h), pp], check=True)
            subprocess.run(['sips', '-s', 'format', 'avif', '-s', 'formatOptions', '95', pp, '--out', self.path], check=True, capture_output=True)
        d = bytearray(open(self.path, 'rb').read()); i = d.find(b'clli'); assert i > 0
        d[i + 4:i + 8] = struct.pack('>HH', self.peak, 64); open(self.path, 'wb').write(d)

def run(jobs, workers=None):
    """encode in parallel, skipping fresh jobs; returns (rows, seconds)"""
    t0 = time.time(); todo = [j for j in jobs if not j.fresh()]
    def one(j):
        s = time.time(); j.encode(); j.done(); return time.time() - s
    with ThreadPoolExecutor(max_workers=workers or os.cpu_count()) as ex:
        times = dict(zip(todo, ex.map(one, todo)))
    rows = [(os.path.basename(j.path), j.fmt, j.px.shape[1], j.px.shape[0], j.peak, j.dist, os.path.getsize(j.path),
             'skipped' if j not in times else f'{times[j]:.1f}s') for j in jobs]
    return rows, time.time() - t0

def table(rows):
    out = [f'{"file":34s} {"fmt":4s} {"w x h":>12s} {"peak":>5s} {"d/a":>8s} {"KB":>8s}  encode']
    for n, f, w, h, p, d, s, t in rows: out.append(f'{n:34s} {f:4s} {f"{w} x {h}":>12s} {p:5d} {d:>8s} {s / 1024:8.1f}  {t}')
    return '\n'.join(out)
