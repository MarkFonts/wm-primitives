// Barrel for WORDMARK's shared cross-app UI primitives. The component modules
// import their own token-based CSS, so consumers just import from here.

// The named-style / scope picker: rows + label + spec chips, single- or multi-select.
export { StyleScopeList, default as StyleScopeDropdown } from './src/StyleScopeDropdown'
export type {
  ScopeChipKind, ScopeChip, ScopeRow,
  StyleScopeDropdownProps, StyleScopeListProps,
} from './src/StyleScopeDropdown'

// A one-word emphasis toggle that sits in the text it marks up.
export { InlineEmphasisBubble } from './src/InlineEmphasisBubble'
export type { InlineEmphasisBubbleProps } from './src/InlineEmphasisBubble'

// Caret capture and restore for contentEditable blocks.
export { placeCaretAtStart, placeCaretAtEnd, placeCaretAtOffset, caretCharOffset } from './src/caret'

// The inline-markup tokeniser the editable blocks share.
export { splitInlineMarkup, isPlainRun } from './src/inlineMarkup'
export type { InlineTokenType, InlineToken } from './src/inlineMarkup'

// UI-kit board (component gallery preview). JS module — consumers on tsc need allowJs.
export { default as UiKitBoard } from './src/UiKitBoard'

// (A push touching src/ or this file runs .github/workflows/consumers.yml: every consumer
// is built and tested against the commit, then told to redeploy.)

// The dial: one number on one axis, with a rail, a field and a stepper. Four variants.
// The spec is DIAL.md, the promises GESTURES.md, the tests tests/behaviour.
export { AxisSlider } from './src/AxisSlider'
export type { AxisSliderProps } from './src/AxisSlider'

// min / desired / max as ONE control. Extracted from ReCal's H&J rail, which had the
// right layout on native number inputs -- platform steppers that cannot be themed and
// a hyphen where a minus belongs.
export { AxisTriplet } from './src/AxisTriplet'
export type { AxisTripletProps, Band } from './src/AxisTriplet'

// Named stops with a thumb that travels between them -- a different control from the
// dial, not a variant of it. Extracted from docs card 04 (SLIDERS.md, row 13) for
// WORDMAKE's GEOM rail; it takes its stops as a prop and names none of them.
export { StopSlider } from './src/StopSlider'
export type { StopSliderProps, Stop } from './src/StopSlider'

// The one chevron, at the house angle, with a stroke derived from its width.
export { Chevron } from './src/Chevron'
export type { ChevronProps } from './src/Chevron'

// Icon — a Material Symbols mark on the same axes as the type beside it. The HOST loads
// the font (see Icon.tsx for the link tag and its four axes); this exports the component
// and the ink/weight contract only.
export { Icon } from './src/Icon'
export type { IconProps } from './src/Icon'

// ThemeSwitch -- Auto / Light / Dark, both looks (marks, words) over one engine. The
// engine is plain JS so a page without React (Kernpare) drives the same control with
// mountThemeSwitch(); the head-script stamp before first paint is bootTheme().
export { ThemeSwitch } from './src/ThemeSwitch'
export type { ThemeSwitchProps } from './src/ThemeSwitch'
// The theme engine itself, for a page without React (bootTheme in a head script).
export { THEMES, THEME_KEY, readTheme, applyTheme, bootTheme, mountThemeSwitch } from './src/theme.js'
export type { Theme } from './src/theme.js'

// BlockStyleRail — h1/h2/h3/¶ stacked in the margin of the block being edited, at the
// bottom of the ink ladder until you reach for them.
export { BlockStyleRail } from './src/BlockStyleRail'
export type { BlockStyleRailProps } from './src/BlockStyleRail'

// Glyph-set matching + cmap parsing (Glyphs scene). Each app composes its own
// extra groups / alternates on top of the shared base groups.
export { makeGlyphSets, parseCmapRanges, isSupported, enumerateCmap } from './src/glyphset'
export type { CmapRanges, GlyphGroups } from './src/glyphset'

// A real minus (U+2212) for readouts, never a hyphen.
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

// The house button (src/button.css -- no JS to export). The boxed one: .wm-btn, with
// .active, --solid, --quiet. The mark (.wm-icon-btn) lives in icon.css, the pill (.ui-seg)
// in toggleGroup.css. CHROME.md is the census that produced it.

// A native <select> wearing the house chevron (src/select.css -- no JS to export):
// .wm-select-wrap around .wm-select, with a <Chevron/> hung off the wrapper.

// Motion tokens. Additive like type.css -- it defines --dur-* and styles no element.
// Apps import it from their entry stylesheet, beside type.css. Before it existed the
// system had three "fast" values and a --dur-fast only ReCal defined, at 140ms, against
// a .12s fallback everywhere else: one component, two speeds, depending on the app.
// (src/motion.css -- no JS to export.)

// Colour tokens. color.css is additive like type.css and motion.css -- it declares the
// ramp (--bg/--surface/--surface-hi/--text/--text-muted/--text-dim/--border) and styles
// no element. A theme is seven numbers, not a second palette. It sits in @layer wm.color
// so an app's unlayered :root always wins no matter the import order. These are DEFAULTS
// under the host contract, not a replacement for it: before them, 150 var() reads in this
// package resolved to nothing and INHERITED a colour rather than falling back to one.
// (src/color.css -- no JS to export. Read them from JS via the engine, never a regex:
// they compute to oklch(), and a number sweep paints 93.1% grey as rgb(93, 0, 0).)

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

// A disclosure box that measures its own content, so a section's height is never a
// number anyone has to keep up to date. Used by the fitting panel's two sections.
export { Collapse } from './src/Collapse'
export type { CollapseProps } from './src/Collapse'

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
// The four paragraph styles both paragraph views show, and the one-liner that turns a
// style plus the font's H&J bands into fit options. The keys, labels, numbers and the
// resolver only; each app keeps the font fields it draws with, and its own block CSS.
export { PARA_STYLE_ORDER, PARA_STYLE_LABEL, PARA_STYLE_DEFAULTS, fitOptionsFor } from './src/paraStyles'
export type { ParaStyleKey, ParaStyleBase } from './src/paraStyles'

export type { FittingControlsProps, Alignment } from './src/Fitting'
export type { FitMode, FitOptions, FittedLine } from './src/flattersatz'

// Gradients — the shape of a ramp, and the three things a ramp can carry. The package
// already faded in three places and spelled it two ways; one of those spellings was the
// two-stop fade the other one wrote a paragraph explaining you must not use. Same shape
// as --dur-fast before motion.css. GRADIENTS.md has the reasoning.
//
// One mechanism, because the four techniques it was built from are one: a cubic Bézier's
// control points, sampled by curve parameter. The "clothoid gradient" of Lukas Hermann's
// and Takehiko Ono's pens IS cubic-bezier(0.416, 0.657, 0.695, 1) — fitted to their seven
// hand-written stops, RMS 0.00065 in alpha. Mass Driver's resampler eases colour with the
// same control points; variablur eases a blur radius with them.
export { EASES, resolveEase, bezierPoint, bezierY, rampStops, scrim, maskRamp, blend, blurLayers, declaration } from './src/gradient'
export type { Bezier, Ease, EaseName, RampOptions, Stop, Space,
              BlurLayer, BlurOptions } from './src/gradient'

// Mass Driver's schema: a curve PER CHANNEL, not one curve on the interpolation. The
// difference is the path — one ease re-spaces the stops along a fixed line through
// colour space, three curves move the line. Reproduces their published output exactly
// (tests/unit). It is the one thing here that resolves a colour, because steering a
// channel means knowing what the channel is; it resolves through a 1x1 canvas, the way
// letterbox.js does, and never with a regex.
export { channelBlend, resolveRGB, CHANNEL_NAMES } from './src/gradient'
export type { Triple, ChannelSpace, ChannelBlendOptions } from './src/gradient'

// A scrim and a blend are declarations and need no component. Progressive blur is not a
// declaration — it is a stack of masked backdrop layers, so it is DOM, and the stack is
// here once instead of in each consumer (where the Gaussian quadrature gets dropped and
// the blur arrives far too fast). GradientControls is the curve editor, because the
// numbers that matter in a gradient are the two control points and you cannot type those.
// Named for the headline export: ./src/Gradient and ./src/gradient are one module on a
// case-insensitive filesystem, the same trap SpecimenNav is named around.
export { ProgressiveBlur, CurveEditor, ChannelCurves, GradientControls, GradientPreview, gradientCss, GRADIENT_DEFAULTS } from './src/GradientControls'
export type { ProgressiveBlurProps, CurveEditorProps, GradientControlsProps,
              GradientSpec, GradientKind } from './src/GradientControls'
