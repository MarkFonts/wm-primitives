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
export { makeGlyphSets, parseCmapRanges, isSupported, enumerateCmap } from './src/glyphset'
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

// The letterbox: the house wordmark scanned and packed with prose (Charlie Clark's
// pretext effect). Plain-JS engine, because wordmark.nyc and this repo's system page
// script-tag it directly, and ReCal's landing pages load it as a module. No React
// wrapper: three of the four call sites have no React at all, and a Letterbox.tsx
// cannot sit beside a letterbox.js on a case-insensitive filesystem.
export { createLetterbox, JEROME } from './src/letterbox.js'
export type {
  LetterboxConfig, LetterboxHandle, LetterboxSpeckle, LetterboxLayers,
} from './src/letterbox.js'

// Type tokens (TYPOGRAPHY.md). type.css is additive — it defines --type-*/--poster-*/
// --ink-*/--track-caps and the opt-in `t-*` classes, and styles no element type, so
// importing it cannot reach existing markup. Apps import the CSS from their entry
// stylesheet and must supply --ui-font and --text-rgb (comma-separated).
export { ROLES, POSTER, INK, TRACK_CAPS, LANDINGS, type as typeStyle, ink } from './src/type'
export type { Role, Landing } from './src/type'

// Optical line fitting: justified, or flattersatz (an alternating measure fitted line
// by line). Plain JS so a static page can script-tag it; `applyTo` fits an element in
// place, `layoutParagraph` + `lineStyle` are for consumers that render their own lines.
// Ported from Seth Thompson's demo, built on Cheng Lou's PreText.
export { layoutParagraph, lineStyle, applyTo as applyFlattersatz,
         DEFAULTS as FLATTERSATZ_DEFAULTS, SWISS_PRESET } from './src/flattersatz'

// The line-fitting controls. The engine above is consumed directly by static pages; this
// is the interface both paragraph views render — font-proofer in its sidebar, ReCal in
// the floating Type panel. Alignment stays with the app; everything downstream travels.
export { FittingControls, fittingMode, AlignmentButtons, ALIGNMENTS, FittedParagraph } from './src/Fitting'

// Long public-domain works: authored whole in specimens/<slug>.txt, served as the chunks
// build-specimens.mjs cuts at each FORM FEED, fetched only as far as the reader asks.
export { SPECIMENS, specimenChunks, parseSpecimen, loadSpecimen,
         type SpecimenBlock } from './src/specimen'
// The tail control travels with the loader: both apps draw the same buttons because
// they render the same component, not because two files agree today. Named for the
// component and not "Specimen", which on a case-insensitive filesystem resolves to
// specimen.ts — the loader — and fails at build with a confusing missing export.
export { SpecimenNav } from './src/SpecimenNav'
export type { FittingControlsProps, Alignment } from './src/Fitting'
export type { FitMode, FitOptions, FittedLine } from './src/flattersatz'
