/* GESTURES.md §17 -- the page tests/behaviour/overlays.spec.ts drives. Bundled by the spec
   with esbuild (write: false) and added to tests/fixtures/overlays.html as a script tag, the
   way ios-focus-guard.spec.ts mounts EditableTextBlock. No house look: the primitives have
   none, and what is asserted is focus, ARIA and who closes what. */
import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  usePopoverTrigger, usePopoverPanel, Popover, Menu, MenuItem, Dialog, useOverlayClose,
} from '../../src/overlays'
import { AxisSlider } from '../../src/AxisSlider'
import { iosFocusGuard } from '../../src/iosFocusGuard.js'

const w = window as any
w.log = [] as string[]

// A component that takes no ref, as AccentButton on React 18 (the trigger is found by aria-controls).
function NoRefButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} />
}

function Panel() {
  const pop = usePopoverTrigger()
  const [v, setV] = useState(400)
  return (
    <div className="row">
      <button id="pop-btn" className="house-btn" ref={pop.triggerRef as React.Ref<HTMLButtonElement>} {...pop.triggerProps}>Panel</button>
      <Popover trigger={pop} id="pop" className="house-panel" aria-label="Panel">
        <button id="pop-first">first</button>
        {/* AxisSlider's value field: Escape drops the draft and blurs */}
        <AxisSlider label="Weight" value={v} min={100} max={900} step={1} onChange={n => setV(Number(n))} />
        <input id="pop-plain" aria-label="plain" defaultValue="ignores Escape" />
        <CloseButton />
      </Popover>
    </div>
  )
}
function CloseButton() {
  const close = useOverlayClose()
  return <button id="pop-close" onClick={close}>done</button>
}

function NoRef() {
  const pop = usePopoverTrigger()
  return (
    <div className="row">
      <NoRefButton id="noref-btn" {...pop.triggerProps}>No ref</NoRefButton>
      <Popover trigger={pop} as="span" id="noref" className="rail-pop" aria-label="No ref">
        <button id="noref-a">a</button>
      </Popover>
    </div>
  )
}

function MenuDemo() {
  const menu = usePopoverTrigger({ type: 'menu' })
  const [pick, setPick] = useState('Regular')
  return (
    <div className="row">
      <button id="menu-btn" ref={menu.triggerRef as React.Ref<HTMLButtonElement>} {...menu.triggerProps}>{pick}</button>
      <Menu trigger={menu} id="menu" className="house-menu" aria-label="Weight">
        {['Light', 'Regular', 'Medium', 'Bold'].map(n => (
          <MenuItem key={n} id={'mi-' + n} className="house-item" selected={n === pick} disabled={n === 'Medium'}
            onAction={() => { setPick(n); w.log.push('pick ' + n) }}>{n}</MenuItem>
        ))}
      </Menu>
    </div>
  )
}

// StyleScopeList's shape: a component that renders its own root, so the panel props go on it.
function ListboxDemo() {
  const t = usePopoverTrigger({ type: 'listbox' })
  const ref = useRef<HTMLDivElement>(null)
  const { panelProps } = usePopoverPanel(t, ref)
  const [sel, setSel] = useState('h2')
  return (
    <div className="row ssd">
      <button id="lb-btn" className="ssd-btn" ref={t.triggerRef as React.Ref<HTMLButtonElement>} {...t.triggerProps}>{sel}</button>
      {t.state.isOpen && (
        <div ref={ref} {...panelProps} className="ssd-list" aria-label="Style">
          {['h1', 'h2', 'h3', 'p'].map(k => (
            <button key={k} id={'opt-' + k} role="option" aria-selected={k === sel} className="ssd-row" tabIndex={-1}
              onClick={() => { setSel(k); t.state.close() }}>{k}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function DialogDemo() {
  const dlg = usePopoverTrigger({ type: 'dialog' })
  return (
    <div className="row">
      <button id="dlg-btn" ref={dlg.triggerRef as React.Ref<HTMLButtonElement>} {...dlg.triggerProps}>Export</button>
      <Dialog trigger={dlg} id="dlg" underlayClassName="modal-scrim" className="modal" aria-label="Export">
        <button id="dlg-a">a</button>
        <input id="dlg-field" aria-label="name" />
        <button id="dlg-z" onClick={dlg.state.close}>close</button>
        <InnerMenu />
      </Dialog>
    </div>
  )
}
function InnerMenu() {
  const m = usePopoverTrigger({ type: 'menu' })
  return (
    <span>
      <button id="inner-btn" ref={m.triggerRef as React.Ref<HTMLButtonElement>} {...m.triggerProps}>more</button>
      <Menu trigger={m} id="inner-menu" aria-label="More">
        <MenuItem id="inner-a" onAction={() => w.log.push('inner a')}>Inner A</MenuItem>
      </Menu>
    </span>
  )
}

function Page() {
  return (
    <>
      <Panel />
      <NoRef />
      <MenuDemo />
      <ListboxDemo />
      <DialogDemo />
      <div className="row">
        <button id="outside" onClick={() => w.log.push('outside click')}>outside</button>
        <input id="outside-field" aria-label="outside field" />
        <div id="editable" contentEditable suppressContentEditableWarning>editable text</div>
      </div>
      <div style={{ height: 1600 }} />
    </>
  )
}

createRoot(document.getElementById('root')!).render(<Page />)
w.iosFocusGuard = iosFocusGuard
w.ready = true
