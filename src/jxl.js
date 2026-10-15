/* jxl.js -- does this browser decode JPEG XL? Sets html.wm-jxl if it does (wm-primitives#133).
 *
 * CSS cannot ask which image formats a browser decodes, and the two HDR paths are different structures: a
 * JPEG XL light is TRANSPARENT (light only, straight alpha, on any ground), while the AVIF fallback is an opaque
 * plane that bakes its floor and needs a mask. So the stylesheet keys the JXL path on a class: this decodes a
 * one-pixel JXL once, and on success adds `wm-jxl` to <html> (document.documentElement). Safari decodes JXL,
 * Chrome does behind chrome://flags/#enable-jxl-image-format and by default from 155; elsewhere the class never
 * appears and the AVIF path stays exactly as it was.
 *
 * Plain script, no React, like zoomControl.js. It runs on import (AccentButton imports it, so an app that draws
 * an AccentButton gets the class for free); wmJxl() returns the one shared promise, resolving true or false.
 *
 *   import { wmJxl } from '@markfonts/wm-primitives'     // or <script src="src/jxl.js">
 *   wmJxl().then(ok => …)                                // html.wm-jxl is already set when ok is true
 */
const WM_JXL_PROBE = 'data:image/jxl;base64,/woAELCguBAIABAAGABLGIsVggE='   // 1 x 1, transparent, lossless (20 bytes)
let wmJxlProbe = null

export function wmJxl() {
  if (wmJxlProbe) return wmJxlProbe
  wmJxlProbe = new Promise(resolve => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') return resolve(false)
    const img = new Image()
    img.onload = () => {
      const ok = img.naturalWidth === 1
      if (ok) document.documentElement.classList.add('wm-jxl')
      resolve(ok)
    }
    img.onerror = () => resolve(false)
    img.src = WM_JXL_PROBE
  })
  return wmJxlProbe
}

if (typeof window !== 'undefined') window.wmJxl = wmJxl
wmJxl()
