// Barrel for WORDMARK's shared cross-app UI primitives. The component modules
// import their own token-based CSS, so consumers just import from here.
export { StyleScopeList, default as StyleScopeDropdown } from './src/StyleScopeDropdown'
export type {
  ScopeChipKind, ScopeChip, ScopeRow,
  StyleScopeDropdownProps, StyleScopeListProps,
} from './src/StyleScopeDropdown'

export { InlineEmphasisBubble } from './src/InlineEmphasisBubble'
export type { InlineEmphasisBubbleProps } from './src/InlineEmphasisBubble'

export { placeCaretAtStart, placeCaretAtEnd, placeCaretAtOffset, caretCharOffset } from './src/caret'

export { splitInlineMarkup, isPlainRun } from './src/inlineMarkup'
export type { InlineTokenType, InlineToken } from './src/inlineMarkup'
