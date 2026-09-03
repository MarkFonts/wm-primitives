// field.swift -- bakes docs/field-247.avif, the HDR field the hero's headline masks.
//
//   swift docs/system/field.swift && mv field-247.avif docs/
//
// Rebuild only to change the look. The AVIF is committed, so a normal build.py run does
// not need Swift, and CI never sees this file.
//
// Why Swift: macOS ImageIO is the whole toolchain. Draw in extendedLinearDisplayP3 at
// values above 1.0 (PEAK 6.0 is six times reference white), convert to Rec.2100 PQ, and
// write "public.avif". No third-party encoder, and `sips -g profile` verifies it.
//
// The field at the tuner's numbers: ROT 247, RIDGES 3.5, WARP 0.3, TERMS 4.
// RIDGES went 1 -> 3.5 after seeing the six-up: at 1 the field is one broad sweep and
// reads as a gradient, not a field. Five band cycles cross the crop, so a headline
// gets structure travelling through it rather than a single edge passing by. The
// half cycle is deliberate: RIDGES is a Float and the map does not tile, so a whole
// number is worth nothing here -- 3.5 ends the crop mid-band, which is what keeps
// the pattern from reading as a repeat.
// Rotation rotates the sampling frame, so 247 is 247 -- not an axis swap.
// It does not tile and does not need to: the pan runs 0..100% of the field's own extent,
// so the crop never leaves it and there is no edge to meet.
import Foundation; import CoreGraphics; import CoreImage; import ImageIO

let W = 2400, H = 2400
let ROT_DEG: Float = 247, RIDGES: Float = 3.5, WARP_AMOUNT: Float = 0.3
let TERMS_USED = 4
let PEAK: Float = 6.0, BASE: Float = 0.30
let WARP: [(Float,Float,Float)] = [(1,0.46,0.0),(2,0.26,1.7),(3,0.14,3.1),(5,0.09,0.6),(8,0.05,2.4)]

let p3lin = CGColorSpace(name: CGColorSpace.extendedLinearDisplayP3)!
let pq    = CGColorSpace(name: CGColorSpace.itur_2100_PQ)!
let rad = ROT_DEG * .pi/180, ca = cos(rad), sa = sin(rad)

let buf = UnsafeMutablePointer<Float32>.allocate(capacity: W*H*4)
defer { buf.deallocate() }
for y in 0..<H {
  let fy = Float(y)/Float(H) - 0.5
  for x in 0..<W {
    let fx = Float(x)/Float(W) - 0.5
    let a = fx*ca - fy*sa + 0.5
    let b = fx*sa + fy*ca + 0.5
    var warp: Float = 0
    for k in 0..<TERMS_USED { warp += WARP[k].1 * sin(a * .pi * 2 * WARP[k].0 + WARP[k].2) }
    warp *= WARP_AMOUNT
    let t = 0.5 + 0.5 * sin((b*RIDGES + warp) * .pi * 2)
    let band = powf(t, 2.6), core = powf(t, 16.0)
    let swell = 0.5 + 0.5 * sin(b * .pi * 2 * 2 + 0.9)
    let lum = BASE + (PEAK - BASE) * min(band*0.55 + core*0.55, 1.0) * (0.55 + 0.45*swell)
    let i = (y*W+x)*4
    buf[i]=lum; buf[i+1]=lum; buf[i+2]=lum; buf[i+3]=1
  }
}
let info = CGBitmapInfo.floatComponents.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
guard let ctx = CGContext(data: buf, width: W, height: H, bitsPerComponent: 32, bytesPerRow: W*16,
                          space: p3lin, bitmapInfo: info),
      let img = ctx.makeImage(),
      let conv = CIContext().createCGImage(CIImage(cgImage: img), from: CGRect(x:0,y:0,width:W,height:H),
                                           format: .RGBA16, colorSpace: pq),
      let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: "field-247.avif") as CFURL,
                                                 "public.avif" as CFString, 1, nil)
else { fatalError("encode") }
CGImageDestinationAddImage(dest, conv, [kCGImageDestinationLossyCompressionQuality: 0.96] as CFDictionary)
print(CGImageDestinationFinalize(dest) ? "wrote field-247.avif" : "fail")