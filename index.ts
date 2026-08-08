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

// UI-kit board (component gallery preview). JS module — consumers on tsc need allowJs.
export { default as UiKitBoard } from './src/UiKitBoard'

// Auto-deploy: a push touching src/ or this file fires .github/workflows/notify.yml,
// which dispatches font-proofer + ReCal to rebuild against latest and redeploy to
// wordmark — so a primitive change ships everywhere without bumping each app.

export { AxisSlider } from './src/AxisSlider'
export type { AxisSliderProps } from './src/AxisSlider'

// Glyph-set matching + cmap parsing (Glyphs scene). Each app composes its own
// extra groups / alternates on top of the shared base groups.
export { makeGlyphSets, parseCmapRanges, isSupported } from './src/glyphset'
export type { CmapRanges, GlyphGroups } from './src/glyphset'

// Small text / number formatting helpers.
export { nbMinus } from './src/format'

// Canonical contentEditable text-block lifecycle (raw-while-focused, commit-on-blur,
// caret capture/restore). Pairs with caret.ts + editRail.css.
export { EditableTextBlock } from './src/EditableTextBlock'
export type { EditableTextBlockProps } from './src/EditableTextBlock'

// Interactive glyph browser: equal-sized cell grid + viewer/U+ readout, search,
// copy-to-clipboard, ssXX alternate groups (wm-primitives #2).
export { GlyphPicker } from './src/GlyphPicker'
export { measureGlyphMetrics } from './src/GlyphPicker'
export type { GlyphPickerProps, GlyphPickerGroup, GlyphPickerCell, GlyphPickerMetrics, GlyphCellState } from './src/GlyphPicker'
