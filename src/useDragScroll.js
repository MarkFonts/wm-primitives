// Drag/wheel → continuous offset, with inertia on release. Seth Thompson's engine for
// panning an infinite 2D grid (https://seththompson.com/articles/infinite-image-grids) —
// distinct from Cheng Lou's PreText line-breaking work behind letterbox.js/flattersatz.js;
// this is a separate technique (grid panning, not text layout) by a separate author.
// Ported near-verbatim; UiKitBoard is the only current call site.
import { useEffect, useRef } from 'react'
import { useDrag, useWheel } from '@use-gesture/react'

const INERTIA_TIME_CONSTANT_MS = 325

export const useDragScroll = (onOffset, config) => {
  const { target, eventOptions, window, enabled, transform, ...gestureConfig } =
    config ?? {}
  const onOffsetRef = useRef(onOffset)
  const wheelOffsetRef = useRef([0, 0])
  const dragOffsetRef = useRef([0, 0])
  const releaseVelocityRef = useRef([0, 0])
  const releaseOffsetRef = useRef([0, 0])
  const frameRef = useRef(null)
  const lastInertiaTimestampRef = useRef(null)

  onOffsetRef.current = onOffset

  const emitOffset = () => {
    onOffsetRef.current({
      offset: [
        -(
          wheelOffsetRef.current[0] +
          dragOffsetRef.current[0] +
          releaseOffsetRef.current[0]
        ),
        -(
          wheelOffsetRef.current[1] +
          dragOffsetRef.current[1] +
          releaseOffsetRef.current[1]
        ),
      ],
    })
  }

  const stopInertia = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    lastInertiaTimestampRef.current = null
  }

  const stepInertia = (timestamp) => {
    const previousTimestamp = lastInertiaTimestampRef.current ?? timestamp
    const deltaMs = timestamp - previousTimestamp
    const damping = Math.exp(-deltaMs / INERTIA_TIME_CONSTANT_MS)

    lastInertiaTimestampRef.current = timestamp
    releaseOffsetRef.current = [
      releaseOffsetRef.current[0] + releaseVelocityRef.current[0] * deltaMs,
      releaseOffsetRef.current[1] + releaseVelocityRef.current[1] * deltaMs,
    ]
    releaseVelocityRef.current = [
      releaseVelocityRef.current[0] * damping,
      releaseVelocityRef.current[1] * damping,
    ]
    emitOffset()

    if (
      Math.abs(releaseVelocityRef.current[0]) < 0.005 &&
      Math.abs(releaseVelocityRef.current[1]) < 0.005
    ) {
      releaseVelocityRef.current = [0, 0]
      frameRef.current = null
      return
    }

    frameRef.current = requestAnimationFrame(stepInertia)
  }

  // Drag stays on React's SYNTHETIC events (no `target` — bind() is spread onto JSX by the
  // caller): pointer events aren't hardcoded passive by React the way wheel/touch are, so
  // preventDefault already works here without needing a real DOM listener. That matters
  // because @use-gesture's target-attached listeners are torn down and rebuilt on EVERY
  // render (its effect has no dependency array, by design) — harmless for the stateless
  // wheel gesture below, but it corrupts an in-progress DRAG if this component re-renders
  // mid-gesture (which UiKitBoard's column/row virtualization does, constantly, while
  // panning). Keeping drag on the synthetic/bind path sidesteps that entirely.
  // useDrag's single handler covers the whole gesture (not separate onDragStart/onDrag/
  // onDragEnd callbacks — that named-key convention only exists on the combined
  // useGesture), so phase transitions are read off `first`/`last` instead.
  const bind = useDrag(
    ({ event, first, last, offset: [x, y], velocity: [vx, vy], direction: [dirx, diry] }) => {
      event.preventDefault()
      if (first) {
        releaseVelocityRef.current = [0, 0]
        stopInertia()
      }
      dragOffsetRef.current = [x, y]
      emitOffset()
      if (last) {
        releaseVelocityRef.current =
          Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001 ? [vx * dirx, vy * diry] : [0, 0]
        stopInertia()
        frameRef.current = requestAnimationFrame(stepInertia)
      }
    },
    { filterTaps: true, window, enabled, transform, ...gestureConfig },
  )

  // Wheel DOES need `target` + non-passive eventOptions (see useDragScroll's caller): a
  // synthetic onWheel prop can never preventDefault, since React forces that listener
  // passive at its root regardless of config. Wheel has no persistent "gesture in
  // progress" state the way drag does, so being rebuilt every render is harmless here.
  useWheel(
    ({ event, offset: [x, y] }) => {
      event.preventDefault()
      wheelOffsetRef.current = [-x, -y]
      emitOffset()
    },
    { target, eventOptions, window, enabled, transform, ...gestureConfig },
  )

  useEffect(() => stopInertia, [])

  return bind
}
