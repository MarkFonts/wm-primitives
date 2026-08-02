// Inline-markup tokenizer — the shared parse step behind both apps' renderInline
// (and ReCal's flash-wrapping variant). Splits text into runs by the matched-
// delimiter markup **bold** / *italic* / __underline__ (non-greedy, no nesting).
// Pure text → tokens: font-agnostic, no React. Each app renders the tokens with
// its own styles (variable axes, italic face, compare mode, flash highlighting).

export type InlineTokenType = 'text' | 'bold' | 'italic' | 'underline'
export interface InlineToken { type: InlineTokenType; value: string }

const INLINE_RE = /(\*\*|__|\*)(.+?)\1/g

export function splitInlineMarkup(text: string): InlineToken[] {
  // Fast path: no markup delimiters at all → one text run.
  if (!/[*_]/.test(text)) return [{ type: 'text', value: text }]
  const out: InlineToken[] = []
  let last = 0
  let m: RegExpExecArray | null
  const re = new RegExp(INLINE_RE) // fresh lastIndex per call
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) })
    const delim = m[1]
    out.push({
      type: delim === '**' ? 'bold' : delim === '*' ? 'italic' : 'underline',
      value: m[2],
    })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out
}

/** True when the text contains no inline markup (single text token). */
export function isPlainRun(tokens: InlineToken[]): boolean {
  return tokens.length === 1 && tokens[0].type === 'text'
}
