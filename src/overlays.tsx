/* overlays.tsx — the behavior under every popover, menu and modal, and none of the look.
 *
 * An audit found about twelve hand-rolled popovers across the apps: no Escape on some, no
 * aria-expanded or aria-haspopup on most, focus never moved in and never came back to the
 * trigger. Each app wrote its own outside-click listener, and each got a different corner
 * of it wrong. This is the one copy. GESTURES.md §17 (G112–G124) is the promise.
 *
 *   const pop = usePopoverTrigger()                       // { type: 'menu' | 'listbox' | 'dialog' }
 *   <button className="align-btn" ref={pop.triggerRef} {...pop.triggerProps}>…</button>
 *   <Popover trigger={pop} className="para-styles-panel" aria-label="Type roles">…</Popover>
 *
 *   const menu = usePopoverTrigger({ type: 'menu' })
 *   <Menu trigger={menu} className="coss-ctx-menu">
 *     <MenuItem className="coss-ctx-item" onAction={duplicate}>Duplicate</MenuItem>
 *   </Menu>
 *
 *   const dlg = usePopoverTrigger({ type: 'dialog' })      // or { isOpen, onOpenChange }
 *   <Dialog trigger={dlg} underlayClassName="modal-scrim" className="modal" aria-label="Export">…</Dialog>
 *
 * UNSTYLED. Every element is the consumer's, with the consumer's class names, rendered where
 * the consumer renders it: nothing is portaled, nothing is positioned, no style is written.
 * A panel that cannot take a wrapper (a component that renders its own root, like
 * StyleScopeList) uses the hook instead: usePopoverPanel(trigger, ref) returns the props to
 * spread on whatever element it is.
 *
 * React Aria (Adobe, Apache-2.0) does the hard parts: the overlay stack (only the topmost
 * answers Escape or an outside press), the outside press itself, the modal's inert siblings
 * and scroll lock, the focus trap. Imported by subpath, and only the low-level hooks:
 * usePopover was left out because it positions the panel (inline top/left/maxHeight), which
 * would move every panel off its house anchor; useMenu because its collection API would make
 * every menu be rebuilt as <Item>s and costs 27KB gzipped more (CHANGELOG 2026-11-23).
 *
 * NOT IN index.ts. react-aria and react-stately are peer dependencies the consumers have not
 * installed yet, and font-proofer and ReCal import the barrel: one re-export there would
 * break both builds. Import this file by path, after `npm i react-aria react-stately`.
 *
 * No motion of its own (G124): open and close are immediate, and every focus move is
 * preventScroll. A host that animates its panel does it in CSS, behind
 * prefers-reduced-motion: no-preference, like every other transition in the house. */
import {
  createContext, createElement, useContext, useEffect, useRef,
  type FocusEvent as ReactFocusEvent, type HTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject,
} from 'react'
import { useOverlay } from 'react-aria/useOverlay'
import { useOverlayTrigger } from 'react-aria/useOverlayTrigger'
import { useModalOverlay } from 'react-aria/useModalOverlay'
import { FocusScope } from 'react-aria/FocusScope'
import { mergeProps } from 'react-aria/mergeProps'
import { useOverlayTriggerState, type OverlayTriggerState } from 'react-stately/useOverlayTriggerState'

export type OverlayType = 'dialog' | 'menu' | 'listbox'

export interface PopoverTriggerOptions {
  /** What the panel is. `menu` and `listbox` get arrow keys over their items (G118); `dialog`,
   *  the default, is a panel of controls. Sets the trigger's aria-haspopup and the panel's role. */
  type?: OverlayType
  /** Controlled. Leave both out and the trigger keeps its own state. */
  isOpen?: boolean
  defaultOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
}

export interface PopoverTrigger {
  state: OverlayTriggerState
  type: OverlayType
  /** Put it on the trigger. A trigger that cannot take a ref (a component on React 18 that does
   *  not forward one) is still found, by its aria-controls, at the moment the panel opens. */
  triggerRef: RefObject<HTMLElement | null>
  /** aria-haspopup, aria-expanded, aria-controls, onClick, and for a menu or listbox onKeyDown.
   *  A trigger with a handler of its own chains it: onClick={e => { t.triggerProps.onClick(e); … }}. */
  triggerProps: {
    'aria-haspopup'?: boolean | 'menu' | 'listbox' | 'dialog'
    'aria-expanded': boolean
    'aria-controls'?: string
    onClick: (e?: unknown) => void
    onKeyDown?: (e: ReactKeyboardEvent) => void
  }
  /** The panel's id: aria-controls points here. */
  panelId: string
  /** Internal: which item an arrow-key open should land on. */
  openWith: { current: 'first' | 'last' }
}

export function usePopoverTrigger(opts: PopoverTriggerOptions = {}): PopoverTrigger {
  const type = opts.type ?? 'dialog'
  const state = useOverlayTriggerState(opts)
  const triggerRef = useRef<HTMLElement | null>(null)
  const openWith = useRef<'first' | 'last'>('first')
  const { triggerProps, overlayProps } = useOverlayTrigger({ type }, state, triggerRef)
  // React Aria leaves aria-haspopup off a dialog on purpose (screen readers read any value as
  // "menu"). Ours carry it: the audit asked for it on every trigger, and `dialog` is the value
  // the spec gives a panel of controls.
  const haspopup = type === 'dialog' ? 'dialog' : triggerProps['aria-haspopup'] as boolean | 'listbox'
  const onKeyDown = type === 'dialog' ? undefined : (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    openWith.current = e.key === 'ArrowUp' ? 'last' : 'first'
    state.open()
  }
  return {
    state, type, triggerRef, panelId: overlayProps.id!, openWith,
    triggerProps: {
      'aria-haspopup': haspopup,
      'aria-expanded': state.isOpen,
      'aria-controls': triggerProps['aria-controls'],
      // onClick, not React Aria's onPress: the outside press is cancelled on the document's
      // capture phase, so a press on the trigger while open (outside the panel) closes it, and
      // the click that follows never reaches this handler to reopen it.
      onClick: () => state.toggle(),
      onKeyDown,
    },
  }
}

const ITEMS = '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="option"]'
const items = (panel: HTMLElement) => Array.from(panel.querySelectorAll<HTMLElement>(ITEMS))
  .filter(el => el.getAttribute('aria-disabled') !== 'true' && !(el as HTMLButtonElement).disabled)
const isTextEntry = (el: EventTarget | null) => el instanceof HTMLElement
  && (el.isContentEditable || el instanceof HTMLTextAreaElement
    || (el instanceof HTMLInputElement && !/^(button|checkbox|radio|range|submit|reset|color|file|image)$/.test(el.type)))
const focusQuiet = (el: HTMLElement | null | undefined) => el?.focus({ preventScroll: true })

/* The part every panel shares, modal or not: role and id, focus in on open (G114) and back
   out on close (G115), arrow keys over items (G118), and Escape in a field (G117). The
   overlay hook's own props come in, so its Escape can be wrapped rather than doubled. */
function usePanelFocus(trigger: PopoverTrigger, ref: RefObject<HTMLElement | null>, overlayProps: HTMLAttributes<HTMLElement>) {
  const { state, type, panelId, triggerRef, openWith } = trigger
  const roving = type !== 'dialog'
  const blurredTo = useRef<Element | null>(null)

  useEffect(() => {
    const panel = ref.current
    if (!state.isOpen || !panel) return
    blurredTo.current = null
    // Taken at the open: aria-controls is only on the trigger while the panel is open.
    const opener = triggerRef.current
      ?? document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(panelId)}"]`)
    if (!panel.contains(document.activeElement)) {
      const list = roving ? items(panel) : []
      const chosen = list.find(el => el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-selected') === 'true')
      // A menu lands on an item, the chosen one first. Anything else lands on the panel
      // itself -- never on a field, which on a phone would raise the keyboard (G114).
      focusQuiet(list.length ? (openWith.current === 'last' ? list[list.length - 1] : chosen ?? list[0]) : panel)
    }
    openWith.current = 'first'
    return () => {
      // Back to the trigger, unless focus has already gone somewhere on purpose: a Tab out, or
      // a press on another field (the blur said where). Lost focus -- the panel took it with it
      // -- is not on purpose. Synchronous: a key pressed next must find the trigger focused.
      const a = document.activeElement
      if (blurredTo.current && blurredTo.current.isConnected) return
      if (!a || a === document.body || !a.isConnected || panel.contains(a)) focusQuiet(opener)
    }
  }, [state.isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    const panel = ref.current
    if (!panel) return
    if (e.key === 'Escape' && e.target !== panel && isTextEntry(e.target)) {
      // A field that answered Escape itself -- dropped its draft and let go (AxisSlider's value
      // field), or prevented the key (AxisTriplet) -- keeps the panel open: focus comes back to
      // the panel, and the next Escape closes it. A field that ignored the key, closes it.
      if (e.nativeEvent.isComposing) return
      if (e.nativeEvent.defaultPrevented || e.isDefaultPrevented() || document.activeElement !== e.target) {
        if (!panel.contains(document.activeElement)) focusQuiet(panel)
        return
      }
    }
    if (roving && /^(ArrowDown|ArrowUp|Home|End)$/.test(e.key)) {
      const list = items(panel)
      if (!list.length) return
      e.preventDefault()
      const i = list.indexOf(document.activeElement as HTMLElement)
      const n = list.length
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1
        : e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n
      focusQuiet(list[next])
      list[next].scrollIntoView?.({ block: 'nearest' })
      return
    }
    overlayProps.onKeyDown?.(e)
  }

  // Where focus went when it left. During that blur activeElement is <body>, which on its own
  // would read as "lost" and pull focus back to the trigger, out of the field just pressed.
  const onBlur = (e: ReactFocusEvent<HTMLElement>) => {
    const to = e.relatedTarget as Element | null
    if (to && !ref.current?.contains(to)) blurredTo.current = to
  }

  return {
    // overlayProps' own onKeyDown is called from ours (after the field and arrow-key cases), not chained
    panelProps: mergeProps({ ...overlayProps, onKeyDown: undefined }, {
      id: panelId,
      role: type,
      tabIndex: -1,
      onBlur,
    }, { onKeyDown }) as HTMLAttributes<HTMLElement>,
  }
}

/** The props for a non-modal panel, to spread on any element: Escape, a press outside and
 *  focus leaving all close it (G113); focus moves in and comes back (G114, G115). For a panel
 *  that renders its own root. Render the element only while trigger.state.isOpen. */
export function usePopoverPanel(trigger: PopoverTrigger, ref: RefObject<HTMLElement | null>) {
  const { state, triggerRef, panelId } = trigger
  const findTrigger = () => triggerRef.current
    ?? document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(panelId)}"]`)
  // The trigger is not "outside": a press on it is the toggle's (G113), and focus moving to it
  // (Shift+Tab, or the press itself in Chrome) must not close the panel the press then toggles.
  const notTrigger = (el: Element) => !findTrigger()?.contains(el)
  // Not React Aria's dismissable mode: it cancels the outside pointerdown (so a dial or a
  // switch under it never hears the press) but not the click or the focus, so the press half
  // lands. A non-modal panel leaves the page live: the press closes it AND lands (G113).
  const { overlayProps } = useOverlay({
    isOpen: state.isOpen, onClose: state.close,
    isDismissable: false, shouldCloseOnBlur: true, shouldCloseOnInteractOutside: notTrigger,
  }, ref)
  useEffect(() => {
    if (!state.isOpen) return
    const down = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (e.button > 0 || !t?.isConnected || ref.current?.contains(t) || !notTrigger(t)) return
      state.close()
    }
    document.addEventListener('pointerdown', down, true)
    return () => document.removeEventListener('pointerdown', down, true)
  }, [state.isOpen]) // eslint-disable-line react-hooks/exhaustive-deps
  return usePanelFocus(trigger, ref, overlayProps)
}

const CloseContext = createContext<(() => void) | null>(null)

type Tag = 'div' | 'span' | 'section' | 'ul' | 'nav'
export interface PopoverProps extends HTMLAttributes<HTMLElement> {
  trigger: PopoverTrigger
  /** The element the panel is. `div` by default; WORDMAKE's rail pops are spans. */
  as?: Tag
  children?: ReactNode
}

/** A non-modal panel: rendered in place, only while open, as the consumer's own element with
 *  the consumer's own class. Every prop but `trigger` and `as` goes on the element. */
export function Popover({ trigger, as = 'div', children, ...rest }: PopoverProps) {
  const ref = useRef<HTMLElement>(null)
  const { panelProps } = usePopoverPanel(trigger, ref)
  if (!trigger.state.isOpen) return null
  return (
    <CloseContext.Provider value={trigger.state.close}>
      {createElement(as, { ...mergeProps(panelProps, rest), ref }, children)}
    </CloseContext.Provider>
  )
}

/** A Popover whose trigger is `type: 'menu'`: role="menu", arrows, Home and End over its
 *  MenuItems, and an item's action closes it (G118, G119). */
export function Menu(props: PopoverProps) {
  return <Popover {...props} />
}

export interface MenuItemProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'onClick'> {
  onAction?: () => void
  /** Given, the item is a menuitemradio with aria-checked, and the menu opens onto it. */
  selected?: boolean
  disabled?: boolean
  /** false keeps the menu open after the action (a multi-pick). */
  closeOnAction?: boolean
  children?: ReactNode
}

export function MenuItem({ onAction, selected, disabled, closeOnAction = true, children, ...rest }: MenuItemProps) {
  const close = useContext(CloseContext)
  return (
    <button
      type="button"
      role={selected === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      {...rest}
      onClick={() => {
        if (disabled) return
        onAction?.()
        if (closeOnAction) close?.()
      }}
    >
      {children}
    </button>
  )
}

export interface DialogProps extends HTMLAttributes<HTMLElement> {
  trigger: PopoverTrigger
  /** The scrim's class. The scrim is a div around the panel; a press on it closes (G121). */
  underlayClassName?: string
  /** false: only Escape and the panel's own controls close it. */
  isDismissable?: boolean
  children?: ReactNode
}

/** A modal: the rest of the page inert and unscrolled while it is open, Tab held inside,
 *  focus to the panel (or the child with autoFocus) and back to the opener (G120–G122). */
export function Dialog({ trigger, underlayClassName, isDismissable = true, children, ...rest }: DialogProps) {
  const ref = useRef<HTMLElement>(null)
  // Declared before usePanelFocus, so on close its cleanup -- which lifts the inert -- runs
  // first, and the opener can take focus again (G122).
  const { modalProps, underlayProps } = useModalOverlay({ isDismissable }, trigger.state, ref)
  const { panelProps } = usePanelFocus(trigger, ref, modalProps)
  if (!trigger.state.isOpen) return null
  return (
    <div className={underlayClassName} {...underlayProps}>
      <FocusScope contain>
        <CloseContext.Provider value={trigger.state.close}>
          <div {...mergeProps(panelProps, rest)} aria-modal="true" ref={ref as RefObject<HTMLDivElement>}>
            {children}
          </div>
        </CloseContext.Provider>
      </FocusScope>
    </div>
  )
}

/** The close function of the panel this is inside -- for a close button in a Dialog, or an
 *  action in a Popover that is not a MenuItem. */
export function useOverlayClose() {
  return useContext(CloseContext) ?? (() => {})
}
