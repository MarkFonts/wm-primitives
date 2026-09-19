/* SpecimenNav — the tail of a work: read further, or leave.
 *
 * Shared because it was written twice, once per app, and two copies of a control drift.
 * The fade belongs to it too: it is not decoration but the signal that the text
 * continues, and it must appear exactly when "read more" does or the cut lies.
 */
import { scrim } from './gradient'
import './Specimen.css'

/* Module scope: the ramp is four numbers and a token name, identical on every render, so
   it is built once rather than per paragraph tail. `to top` runs it from full --bg at
   the bottom to nothing at the top -- see Specimen.css, and GRADIENTS.md for the curve. */
const FADE = scrim('var(--bg)', { dir: 'to top' })

export function SpecimenNav({ more, onMore, nextLabel, onNext }: {
  /** More chunks remain — shows the fade and the read-more control. */
  more: boolean
  onMore: () => void
  /** Where "next" goes. Naming the destination is the point: "next" alone makes you
   *  click to find out. Omit to hide the control. */
  nextLabel?: string
  onNext?: () => void
}) {
  return (
    <>
      {more && <div className="specimen-fade" aria-hidden="true" style={{ backgroundImage: FADE }} />}
      <div className="specimen-nav">
        {more && <button className="specimen-more" onClick={onMore}>Read more</button>}
        {nextLabel && onNext && (
          <button className="specimen-more specimen-next" onClick={onNext}>
            Next specimen: {nextLabel}
          </button>
        )}
      </div>
    </>
  )
}
