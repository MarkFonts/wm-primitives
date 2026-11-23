/** Follow <html data-corners="eased">: mark pills (radius >= half the short side) with data-wm-pill /
 *  --pill-s so corners.css can clip their eased cap. Idempotent; runs on import. Returns a function
 *  that re-reads every element now. CHROME.md "Corners". */
export function wmCorners(doc?: Document): () => void
declare global { interface Window { wmCorners?: (doc?: Document) => () => void } }
