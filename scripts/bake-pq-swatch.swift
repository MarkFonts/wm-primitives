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

let nits = Double(CommandLine.arguments[1])!
let side = Int(CommandLine.arguments[2])!
let out  = URL(fileURLWithPath: CommandLine.arguments[3])
let code = pqCode(nits: nits)

let pq = CGColorSpace(name: CGColorSpace.itur_2100_PQ)!
guard let ctx = CGContext(data: nil, width: side, height: side, bitsPerComponent: 16,
                          bytesPerRow: 0, space: pq,
                          bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
                                    | CGBitmapInfo.byteOrder16Little.rawValue)
else { fatalError("context") }
ctx.setFillColor(CGColor(colorSpace: pq, components: [CGFloat(code), CGFloat(code), CGFloat(code), 1])!)
ctx.fill(CGRect(x: 0, y: 0, width: side, height: side))
guard let img = ctx.makeImage(),
      let d = CGImageDestinationCreateWithURL(out as CFURL, "public.png" as CFString, 1, nil)
else { fatalError("png destination") }
CGImageDestinationAddImage(d, img, nil)
guard CGImageDestinationFinalize(d) else { fatalError("png finalize") }
print(String(format: "%@  %.0f nits  PQ code %.4f (%.2f%% of range)", out.lastPathComponent, nits, code, code * 100))
