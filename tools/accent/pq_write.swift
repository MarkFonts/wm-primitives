// pq_write.swift -- write a raw buffer of PQ code values as a BT.2100 PQ PNG.
//
//   swift pq_write.swift <in.u16> <width> <height> <out.png>
//
// <in.u16> is width * height * 4 little-endian UInt16 (R, G, B, X), already PQ-encoded by
// gen_hdr.py (the ST 2084 inverse EOTF, BT.2020 primaries, dithered at 10-bit steps). This
// file only hands those numbers to an itur_2100_PQ context untouched, the way
// scripts/bake-pq-swatch.swift does for a flat swatch: no extendedLinearSRGB, no
// copy(colorSpace:), which reinterprets. OPAQUE (noneSkipLast): PQ + alpha decodes fully
// transparent in Chrome. sips -s format avif does the container afterwards.
import Foundation
import CoreGraphics
import ImageIO

let a = CommandLine.arguments
let w = Int(a[2])!, h = Int(a[3])!
var data = try! Data(contentsOf: URL(fileURLWithPath: a[1]))
precondition(data.count == w * h * 8, "size mismatch")
let pq = CGColorSpace(name: CGColorSpace.itur_2100_PQ)!
let img: CGImage = data.withUnsafeMutableBytes { (p: UnsafeMutableRawBufferPointer) -> CGImage in
    guard let ctx = CGContext(data: p.baseAddress, width: w, height: h, bitsPerComponent: 16,
                              bytesPerRow: w * 8, space: pq,
                              bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue | CGBitmapInfo.byteOrder16Little.rawValue)
    else { fatalError("context") }
    return ctx.makeImage()!
}
guard let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: a[4]) as CFURL, "public.png" as CFString, 1, nil)
else { fatalError("png destination") }
CGImageDestinationAddImage(d, img, nil)
guard CGImageDestinationFinalize(d) else { fatalError("png finalize") }
