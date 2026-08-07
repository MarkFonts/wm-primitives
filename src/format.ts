// Small text / number formatting helpers shared across ReCal + font-proofer.

// Replace a leading hyphen-minus with a typographic minus (U+2212) — for numeric
// readouts (tracking, axis values) that must show a real minus, never a hyphen.
export function nbMinus(s: string | number): string {
  return String(s).replace('-', '−')
}
