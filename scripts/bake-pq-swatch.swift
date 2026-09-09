// Bake a flat PQ swatch. Swift authors the code value; sips does the AVIF encode.
//
// ImageIO here creates a "public.avif" destination and then refuses to finalize it, in
// every pixel format tried -- 16-bit and 8-bit, three alpha configs. It writes PQ-tagged
// PNG happily, and `sips -s format avif` encodes that to AVIF with the nclx intact. So
// the split is not a workaround for the colour, only for the container.
import Foundation
import CoreGraphics
import ImageIO

func pqCode(nits: Double) -> Double {          // SMPTE ST 2084 inverse EOTF
    let m1 = 0.1593017578125, m2 = 78.84375, c1 = 0.8359375, c2 = 18.8515625, c3 = 18.6875
    let y = min(max(nits / 10000.0, 0), 1), yp = pow(y, m1)
    return pow((c1 + c2 * yp) / (1 + c3 * yp), m2)
}

/* Optional 4th argument: an #rrggbb to carry the boost instead of white.
   THE GAMMA TRAP, and it is the one that makes a colour look wrong rather than merely
   dim: an sRGB hex is GAMMA-ENCODED. Scaling those numbers straight into a PQ context
   greys the colour out -- the same mistake documented for display-p3 components. So
   linearise first, gain, then PQ-encode per channel.
   The gain is set so the BRIGHTEST channel lands on the requested nits: that preserves
   the hue and saturation ratios exactly while pushing the colour as far above SDR white
   as it can go. Multiplying every channel by the same absolute figure instead would wash
   a saturated hue toward white as it brightened. */
func srgbToLinear(_ c: Double) -> Double {
    return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
}
/* sRGB-linear -> BT.2020-linear. THE CONTAINER IS BT.2020 (nclx 9), not sRGB and not P3,
   so linear sRGB components handed to it are REINTERPRETED as BT.2020 coordinates -- and
   because BT.2020's primaries sit further out, every channel that is not the peak lands
   too low and the colour is pushed outward. Measured on the zone green: written [0.203,
   1, 0.333] where the true BT.2020 value is [0.502, 1, 0.415]. The result looks vivid,
   which is why it passed the eye, but it means the HDR swatch is a DIFFERENT colour from
   the flat background-color sitting under it as the SDR fallback -- so the chip shifts hue
   as the boost engages. Convert properly instead: sRGB -> XYZ(D65) -> BT.2020, folded into
   one matrix. */
let SRGB_TO_2020: [[Double]] = [
    [0.627404, 0.329283, 0.043313],
    [0.069097, 0.919540, 0.011362],
    [0.016391, 0.088013, 0.895595],
]
func toRec2020(_ v: [Double]) -> [Double] {
    return SRGB_TO_2020.map { row in max(0, row[0]*v[0] + row[1]*v[1] + row[2]*v[2]) }
}
func parseHex(_ h: String) -> [Double] {
    let x = h.hasPrefix("#") ? String(h.dropFirst()) : h
    let n = UInt32(x, radix: 16) ?? 0xffffff
    return [Double((n >> 16) & 255) / 255, Double((n >> 8) & 255) / 255, Double(n & 255) / 255]
}
let nits = Double(CommandLine.arguments[1])!
let side = Int(CommandLine.arguments[2])!
let out  = URL(fileURLWithPath: CommandLine.arguments[3])
let hex  = CommandLine.arguments.count > 4 ? CommandLine.arguments[4] : "#ffffff"
let lin  = toRec2020(parseHex(hex).map(srgbToLinear))
let peak = max(lin.max() ?? 1, 1e-6)
let rgb  = lin.map { pqCode(nits: nits * ($0 / peak)) }
let code = rgb[0]   // kept for the white path's own arithmetic

let pq = CGColorSpace(name: CGColorSpace.itur_2100_PQ)!
guard let ctx = CGContext(data: nil, width: side, height: side, bitsPerComponent: 16,
                          bytesPerRow: 0, space: pq,
                          bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
                                    | CGBitmapInfo.byteOrder16Little.rawValue)
else { fatalError("context") }
ctx.setFillColor(CGColor(colorSpace: pq, components: [CGFloat(rgb[0]), CGFloat(rgb[1]), CGFloat(rgb[2]), 1])!)
ctx.fill(CGRect(x: 0, y: 0, width: side, height: side))
/* RADIAL MODE (5th argument = edge nits). A CSS radial-gradient() cannot carry this: every
   CSS colour syntax clamps at reference white, which is measured and settled. So the ramp
   has to be baked -- the hue at full boost in the centre, falling to its SDR level at the
   rim -- and then PANNED under the element by background-position so the bright spot sits
   wherever the cursor is.
   Interpolation runs in PQ code space rather than linear light. That is not photometrically
   linear, but PQ is a perceptual curve by construction, so an even ramp in code values is
   an even ramp to the eye -- which is what a glow wants. */
if CommandLine.arguments.count > 5, let edgeNits = Double(CommandLine.arguments[5]) {
    /* A GAUSSIAN FALLOFF, not two stops. A straight line from centre to rim puts the same
       amount of change everywhere, so the ramp reads as a disc with a hard-ish boundary --
       there is a visible radius where it stops. exp(-k t^2) holds the centre bright over a
       small core and then trails off with no edge to find, which is what makes a specular
       look like light rather than like a shape. k = 4.5 leaves ~1% at the rim, so the tail
       lands on the SDR colour without a step.
       Sampled into 24 stops: CGGradient interpolates linearly BETWEEN stops, so the curve
       has to be carried by their spacing rather than assumed. */
    /* Optional 6th argument: the falloff constant. Bigger = a tighter bright core inside
       the same image. That separation is the point -- the image stays LARGE so it always
       covers the element, because an image edge inside the chip is an SDR/HDR seam and
       there is no nit value that hides one: on macOS EDR, SDR white tracks the brightness
       slider, so the level a flat colour composites to is a moving target. Cover the whole
       element and the question never arises. Reach and core size stop being one knob.
       64 stops rather than 24: a steep core needs samples where it is steep, and
       CGGradient interpolates linearly between stops. */
    let k = CommandLine.arguments.count > 6 ? (Double(CommandLine.arguments[6]) ?? 4.5) : 4.5
    let N = 64
    var locs: [CGFloat] = []
    var comps: [CGFloat] = []
    for i in 0...N {
        let t = Double(i) / Double(N)
        let f = exp(-k * t * t)
        locs.append(CGFloat(t))
        for ch in 0..<3 {
            let n = edgeNits + (nits - edgeNits) * f
            comps.append(CGFloat(pqCode(nits: n * (lin[ch] / peak))))
        }
        comps.append(1)
    }
    guard let grad = CGGradient(colorSpace: pq, colorComponents: comps, locations: locs, count: N + 1)
    else { fatalError("gradient") }
    let c = CGPoint(x: side / 2, y: side / 2)
    ctx.drawRadialGradient(grad, startCenter: c, startRadius: 0,
                           endCenter: c, endRadius: CGFloat(side) / 2,
                           options: [.drawsAfterEndLocation])
    FileHandle.standardError.write("  radial: centre \(nits) nits -> rim \(edgeNits) nits\n".data(using: .utf8)!)
}

guard let img = ctx.makeImage(),
      let d = CGImageDestinationCreateWithURL(out as CFURL, "public.png" as CFString, 1, nil)
else { fatalError("png destination") }
CGImageDestinationAddImage(d, img, nil)
guard CGImageDestinationFinalize(d) else { fatalError("png finalize") }
print(String(format: "%@  %.0f nits  PQ code %.4f (%.2f%% of range)", out.lastPathComponent, nits, code, code * 100))
