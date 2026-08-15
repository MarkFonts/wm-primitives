import { useEffect, useRef } from 'react'
import { createLetterbox, type LetterboxConfig } from './letterbox'

/* React wrapper around the letterbox engine (src/letterbox.js). The engine is plain JS
 * because two call sites are static HTML; this is the React-app form.
 *
 * `config` is a dependency of the effect, so define it OUTSIDE the component or memoize
 * it — a fresh object literal per render tears the letterbox down and rebuilds it.
 *
 * The juggle's front layers are rendered as siblings inside the same container and are
 * the caller's to position (they want `position:absolute; inset:0` and something drawn
 * between them, which is the only arrangement the split pays for). A call site that
 * needs the layers somewhere else in the DOM should use `createLetterbox` directly.
 */
export interface LetterboxProps {
  config?: LetterboxConfig
  /** Extra front canvases for the juggle. Default 0 — one canvas, no split. */
  frontLayers?: number
  className?: string
  frontClassName?: string
  /** The canvas carries the word as its accessible name; the fill is decorative. */
  ariaLabel?: string
}

export function Letterbox({
  config,
  frontLayers = 0,
  className = 'wm-lb',
  frontClassName = 'wm-lb-front',
  ariaLabel = 'WORDMARK',
}: LetterboxProps) {
  const backRef = useRef<HTMLCanvasElement>(null)
  const frontRefs = useRef<HTMLCanvasElement[]>([])

  useEffect(() => {
    const canvas = backRef.current
    if (!canvas) return
    const front = frontRefs.current.filter(Boolean).slice(0, frontLayers)
    const lb = createLetterbox(canvas, {
      ...config,
      layers: front.length ? { ...config?.layers, front } : config?.layers ?? null,
    })
    if (!lb) return

    // Draw once with whatever is loaded, then lay out again on the real faces: the
    // scan measures the display word, so a fallback face would pack the wrong mask.
    lb.init()
    let cancelled = false
    document.fonts?.ready.then(() => { if (!cancelled) lb.init() })

    return () => { cancelled = true; lb.destroy() }
  }, [config, frontLayers])

  return (
    <div className={className}>
      <canvas ref={backRef} aria-label={ariaLabel} />
      {Array.from({ length: frontLayers }, (_, i) => (
        <canvas
          key={i}
          className={frontClassName}
          aria-hidden="true"
          ref={el => { if (el) frontRefs.current[i] = el }}
        />
      ))}
    </div>
  )
}
