/* SpecimenNav — the tail of a work: read further, or leave.
 *
 * Shared because it was written twice, once per app, and two copies of a control drift.
 * The fade belongs to it too: it is not decoration but the signal that the text
 * continues, and it must appear exactly when "read more" does or the cut lies.
 */
import './Specimen.css'

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
      {more && <div className="specimen-fade" aria-hidden="true" />}
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
