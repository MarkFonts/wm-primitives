/** Follow <html data-corners="eased">: mark pills (radius >= half the short side) with data-wm-pill /
 *  --pill-s so corners.css can clip their eased cap. Idempotent; runs on import. Returns a function
 *  that re-reads every element now. CHROME.md "Corners". */
export function wmCorners(doc?: Document): () => void
/** The eased cap's choke, L : (h/2), for a pill h px tall: 1.30 up to 24px, easing to 1.15 at 96px, held. */
export function pillRatio(h: number): number
/** One quarter of the cap for a choke ratio: three cubics from the straight to the nose, every point
 *  [along from the pill's end, across from the side] in units of the pill's height. */
export function pillCap(ratio: number): { L: number; start: [number, number]; segs: [number, number][][] }
/** The clip-path shape() string for a pill of this ratio (`size` names the custom property that holds h). */
export function pillShape(ratio: number, axis: 'x' | 'y', size?: string): string
declare global { interface Window { wmCorners?: (doc?: Document) => () => void } }
