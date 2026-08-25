// UiPreview — a pannable 2D catalog of real UI "particles" (cal.com/oss-style), each a neutral
// panel rendering the proofed font so it's a working specimen of the font doing UI
// micro-typography. Ported from ReCal's CossScene (de-typed to plain JSX, store dependency
// removed). No images. No external deps beyond React.
//
// The catalog is rendered in several PASSES; each pass pulls the next entry from shared copy
// pools, so every component reappears with fresh realistic copy as you scroll — the board
// feels endless without hand-authoring each tile.
//
// Weight model: text INHERITS the default weight (--w-default); headings/emphasis marked
// .coss-b use --w-bold, so raising the default raises both. Italic text maps to the ital
// axis on top of the current variation settings (--vs).
import './UiKitBoard.css'
import { useState, useEffect, useLayoutEffect, useRef, Fragment } from 'react'
import { motion, useMotionValue, useMotionValueEvent } from 'motion/react'
import { useDragScroll } from './useDragScroll'

// ── Copy pools (rotated by pass index so panels vary as you scroll) ──────────────
const at = (a, i) => a[((i % a.length) + a.length) % a.length]
const ini = (n) => n.split(' ').map(w => w[0]).join('').slice(0, 2)

const NAMES = ['Ava Chen', 'Marcus Vale', 'Priya Nair', 'Diego Ruiz', 'Lena Fischer', 'Omar Said', 'Jordan Miles', 'Sofia Marin', 'Kai Tran', 'Noah Webb']
const ROLES = ['Product designer', 'Engineering lead', 'Founder', 'Head of Design', 'Marketing lead', 'Support engineer']
const CITIES = ['San Diego', 'Berlin', 'Lisbon', 'Toronto', 'Austin', 'Kyoto']
const EMAILS = ['jordan@acme.co', 'ava@loop.dev', 'sofia@northwind.io', 'kai@vela.app', 'noah@monta.co', 'lena@kestrel.io']
const HANDLES = ['jordan', 'ava', 'sofia', 'kai', 'noah', 'lena']
const FAQ = [
  ['How do reminders work?', 'Attendees get an email and an optional text a day before, timed to their zone.'],
  ['Can I use my own domain?', 'Point a CNAME at us and bookings live on your own subdomain.'],
  ['Is there an API?', 'Yes — a REST API and webhooks for every booking event.'],
  ['Do you support teams?', 'Round-robin and collective scheduling are built in.'],
]
const TOASTS = [
  ['Event has been created', 'Monday, January 3rd at 6:00pm'],
  ['Booking confirmed', 'With Ava Chen · Thursday at 2:30pm'],
  ['Link copied', 'Paste it anywhere to share your availability.'],
  ['Changes saved', 'Your availability was updated just now.'],
]
const DIALOGS = [
  ['Delete event type?', 'This can’t be undone. Existing bookings stay on your calendar.', 'Delete'],
  ['Cancel this booking?', 'We’ll let the attendee know by email right away.', 'Cancel booking'],
  ['Publish changes?', 'Your booking page will update for everyone immediately.', 'Publish'],
]
const ALERTS = [
  ['Payment failed', 'Your card was declined. Update it to keep your plan active.'],
  ['Storage almost full', 'You’ve used 92% of your plan’s storage this month.'],
  ['Verify your email', 'Check your inbox to finish setting up your workspace.'],
]
const STATS = [
  ['Monthly revenue', '$48,200', '▲ 12.4% vs last month'],
  ['Bookings this week', '1,284', '▲ 6.1% vs last week'],
  ['Show-up rate', '98.2%', '▲ 2.0% vs last month'],
  ['Active members', '342', '▲ 18 new this month'],
]
const SELECTS = [
  ['Role', ['Owner', 'Editor', 'Viewer']],
  ['Plan', ['Free', 'Pro', 'Team']],
  ['Priority', ['Low', 'Medium', 'High']],
]
const TABSETS = [['Overview', 'Analytics', 'Settings'], ['Inbox', 'Sent', 'Drafts'], ['Design', 'Code', 'Preview']]
const TABBODY = ['Your workspace booked 214 meetings this month across 6 event types.', 'You have 3 unread messages and 12 archived this week.', 'Live preview updates as you edit the component source.']
const COMMANDS = [
  [['New event type', 'E'], ['Invite teammate', 'I'], ['Go to settings', 'G S']],
  [['Create booking', 'B'], ['Search people', '/'], ['Open calendar', 'G C']],
  [['New workflow', 'W'], ['Import contacts', 'G I'], ['Toggle theme', '⌘ T']],
]
const PROJECTS = [
  ['Website Redesign', 'ok', '$12,500'], ['Mobile App', '', '$8,750'], ['API Integration', 'warn', '$5,200'],
  ['Database Migration', 'ok', '$3,800'], ['Security Audit', 'err', '$2,100'], ['User Dashboard', 'ok', '$7,200'],
  ['Billing Revamp', 'warn', '$4,600'], ['Docs Refresh', 'ok', '$1,900'],
]
const LABELS = { ok: 'Paid', warn: 'Pending', err: 'Failed', '': 'Unpaid' }
const BOOKINGS = [
  ['Ava Chen', '9:00', 'ok', 'Confirmed'], ['Marcus Vale', '10:30', 'ok', 'Confirmed'], ['Priya Nair', '1:00', 'warn', 'Pending'],
  ['Diego Ruiz', '2:30', 'ok', 'Confirmed'], ['Lena Fischer', '11:15', 'warn', 'Pending'], ['Omar Said', '4:00', 'err', 'Canceled'],
  ['Sofia Marin', '3:15', 'ok', 'Confirmed'], ['Kai Tran', '5:30', 'warn', 'Pending'],
]
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June']
const BARSETS = [[40, 66, 52, 80, 58, 92, 70], [55, 44, 72, 60, 86, 50, 76], [62, 70, 48, 88, 64, 58, 95]]
const CODES = [
  ['const cal = useCal()', 'await cal.book({', '  slot: "09:00",', '})'],
  ['export const load = () =>', '  fetch("/api/events")', '    .then(r => r.json())'],
  ['type Booking = {', '  when: string', '  host: string', '}'],
  ['function greet(name) {', '  return `Hi, ${name}`', '}'],
]
const TIMELINES = [
  [['Booking created', '2 min ago'], ['Reminder sent', '1 hour ago'], ['Invite accepted', 'Yesterday']],
  [['Payment received', 'Just now'], ['Invoice issued', '3 hours ago'], ['Trial started', '6 days ago']],
  [['Signed up', '5 min ago'], ['Verified email', '20 min ago'], ['First booking', '2 days ago']],
]
const CARDS = [
  ['Weekly report', 'Your team booked 214 meetings across 6 event types.'],
  ['New feature', 'Round-robin routing is now available on every plan.'],
  ['Welcome aboard', 'Finish setup to start taking bookings today.'],
  ['Usage summary', 'You’re at 62% of your monthly booking limit.'],
]
// Pools for the previously-static particles, so every instance varies per pass.
const BADGESETS = [
  [['Active', 'dot-ok'], ['Pending', 'dot-warn'], ['Failed', 'dot-err']],
  [['Online', 'dot-ok'], ['Away', 'dot-warn'], ['Offline', '']],
  [['Shipped', 'dot-ok'], ['Processing', 'dot-warn'], ['Returned', 'dot-err']],
  [['Live', 'dot-ok'], ['Draft', ''], ['Archived', 'dot-warn']],
]
const SWITCHSETS = [
  ['Email notifications', 'SMS reminders'], ['Two-factor auth', 'Login alerts'],
  ['Auto-accept bookings', 'Add buffer time'], ['Public profile', 'Show availability'],
]
const TOOLTIPS = [['Copy booking link', 'Share'], ['Duplicate event', 'Duplicate'], ['Add to calendar', 'Add'], ['Export as CSV', 'Export']]
const CHECKSETS = [
  ['Send me product updates', 'Notify me about bookings', 'Share anonymous usage data'],
  ['Require confirmation', 'Allow rescheduling', 'Collect payment upfront'],
  ['Weekdays only', 'Hide weekends', 'Auto-decline conflicts'],
  ['Email receipts', 'Add to calendar', 'Follow up after'],
]
const RADIOSETS = [['Round-robin', 'Collective', 'Managed by host'], ['Card', 'Bank transfer', 'Invoice'], ['Every day', 'Weekdays', 'Custom'], ['15 min', '30 min', '60 min']]
const TEXTAREAS = [
  ['Meeting notes', 'Walk through the Q3 illustration set and agree on final delivery dates.'],
  ['Bio', 'Designer and illustrator focused on editorial and product work.'],
  ['Description', 'A 30-minute intro call to scope your project and timeline.'],
  ['Feedback', 'The new booking flow is much faster — nice work on the reminders.'],
]
const TOGGLESETS = [['Day', 'Week', 'Month'], ['Left', 'Center', 'Right'], ['List', 'Board', 'Calendar'], ['S', 'M', 'L']]
const NAVSETS = [
  ['Workspace', ['Event types', 'Bookings', 'Availability'], 'Account', ['Members']],
  ['Library', ['All tracks', 'Playlists', 'Artists'], 'You', ['Liked songs']],
  ['Store', ['Products', 'Orders', 'Customers'], 'Config', ['Shipping']],
]
const FIELDSETS = [
  ['Notifications', [['Email', true], ['SMS', false], ['Calendar invite', true]]],
  ['Privacy', [['Public profile', true], ['Show email', false], ['Index in search', false]]],
  ['Reminders', [['1 day before', true], ['1 hour before', true], ['At start', false]]],
]
const EMPTIES = [
  ['No bookings yet', 'Share your link and your first meeting will show up here.', 'Copy link'],
  ['Inbox zero', 'You’ve handled every message. Nice work.', 'Compose'],
  ['No results', 'Try a different search or clear your filters.', 'Clear filters'],
]
const KBDS = [
  ['⌘', 'K', 'to open the command menu.'], ['⌘', 'S', 'to save your changes.'],
  ['⌘', '⏎', 'to confirm and continue.'], ['⌘', '/', 'to jump straight to search.'],
]
const STEPSETS = [
  ['Details', 'Times', 'Done', 1], ['Cart', 'Shipping', 'Pay', 0], ['Account', 'Profile', 'Finish', 2],
]
const RATINGS = [[4, '1,284 reviews'], [5, '892 reviews'], [3, '421 reviews'], [4, '2,058 reviews']]
const SLIDERS = [
  ['Buffer', p => `${Math.round(p / 100 * 60)} min`, 46],
  ['Volume', p => `${Math.round(p)}`, 72],
  ['Duration', p => `${Math.round(p / 100 * 90)} min`, 60],
  ['Radius', p => `${Math.round(p / 100 * 24)} px`, 30],
]
const PAGES = [[1, 8], [3, 12], [2, 5], [4, 20]]
const TOGGLE_ACTIVE = [1, 0, 2, 1]

// Skeleton placeholder sized to the tile's estimated body height (and full width) so the
// card reserves ~the right box → minimal reflow/thrash when the real content resolves.
function SkeletonBlock({ h }) {
  return <div className="ui-sk" style={{ height: Math.max(44, h), width: '100%', borderRadius: 8 }} />
}

// Wraps a tile body: shows the sized skeleton first, then reveals the real content after a
// short staggered delay — so newly mounted tiles (initial + lazy-loaded) load in smoothly.
function Reveal({ children, h }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 350 + Math.random() * 450)
    return () => clearTimeout(t)
  }, [])
  return on ? <div className="ui-fade-in" style={{ width: '100%' }}>{children}</div> : <SkeletonBlock h={h} />
}

// Functioning dropdown menu: opens on click, closes on outside-click, with a live toggle.
function MenuDemo() {
  const [open, setOpen] = useState(false)
  const [autosave, setAutosave] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [open])
  return (
    <div className="ui-menu-wrap" ref={ref}>
      <span className="ui-btn" onClick={() => setOpen(o => !o)}>{open ? 'Close menu' : 'Open menu'}</span>
      {open && (
        <div className="ui-menu">
          <div className="ui-menu-sec">Playback</div>
          <div className="ui-menu-item">▶ Play<span className="ui-kbd">⌘P</span></div>
          <div className="ui-menu-item">❚❚ Pause<span className="ui-kbd">⇧⌘P</span></div>
          <div className="ui-menu-item">◁ Previous<span className="ui-kbd">⌘[</span></div>
          <div className="ui-menu-item">▷ Next<span className="ui-kbd">⌘]</span></div>
          <div className="ui-sep" />
          <div className="ui-menu-item">Shuffle</div>
          <div className="ui-menu-item">Repeat</div>
          <div className="ui-menu-item ui-muted">Enhanced Audio</div>
          <div className="ui-sep" />
          <div className="ui-menu-sec">Sort by</div>
          <div className="ui-menu-item">Artist</div>
          <div className="ui-menu-item">Album</div>
          <div className="ui-menu-item">Title</div>
          <div className="ui-sep" />
          <div className="ui-menu-item" onClick={e => { e.stopPropagation(); setAutosave(v => !v) }}>
            Auto save<span className={`ui-switch${autosave ? '' : ' ui-switch--off'}`} />
          </div>
          <div className="ui-menu-item">Add to Playlist<span className="ui-dim">›</span></div>
          <div className="ui-sep" />
          <div className="ui-menu-item ui-menu-del">🗑 Delete<span className="ui-kbd">⌘⌫</span></div>
        </div>
      )}
    </div>
  )
}

// Interactive accordion: clicking a heading expands/collapses its panel.
function AccordionDemo({ seed }) {
  const items = [at(FAQ, seed), at(FAQ, seed + 1), at(FAQ, seed + 2)]
  const [open, setOpen] = useState(0)
  return (
    <div>
      {items.map(([q, a], i) => (
        <div key={i}>
          <div className="ui-acc-row coss-b" onClick={() => setOpen(open === i ? -1 : i)}>
            {q}<span className="ui-chev">{open === i ? '▲' : '▾'}</span>
          </div>
          {open === i && <div className="ui-acc-ans">{a}</div>}
        </div>
      ))}
    </div>
  )
}

// ── Functional interactive controls (shared, so behaviour is consistent) ─────────
function Toggle({ labels }) {
  const [on, setOn] = useState([true, false])
  return (
    <div className="ui-col">
      {labels.map((l, i) => (
        <div key={l} className="ui-between">
          <span className={i ? 'ui-muted' : undefined} style={{ fontSize: 13 }}>{l}</span>
          <span className={`ui-switch${on[i] ? '' : ' ui-switch--off'}`} onClick={() => setOn(s => s.map((x, j) => j === i ? !x : x))} />
        </div>
      ))}
    </div>
  )
}
function Checks({ items, init }) {
  const [on, setOn] = useState(() => items.map((_, i) => (init ? !!init[i] : i < 2)))
  return (
    <div className="ui-col" style={{ gap: 2 }}>
      {items.map((c, i) => (
        <label key={c} className={`ui-opt${on[i] ? '' : ' ui-muted'}`} onClick={() => setOn(s => s.map((x, j) => j === i ? !x : x))}>
          <span className={`ui-check${on[i] ? ' on' : ''}`}>{on[i] ? '✓' : ''}</span>{c}
        </label>
      ))}
    </div>
  )
}
function Radios({ items }) {
  const [sel, setSel] = useState(0)
  return (
    <div className="ui-col" style={{ gap: 2 }}>
      {items.map((r, i) => (
        <label key={r} className="ui-opt" onClick={() => setSel(i)}><span className={`ui-radio${i === sel ? ' on' : ''}`} />{r}</label>
      ))}
    </div>
  )
}
function TabsCtl({ tabs, body }) {
  const [sel, setSel] = useState(0)
  return (
    <div>
      <div className="ui-tabs">{tabs.map((t, i) => <span key={t} className={`ui-tab${i === sel ? ' on coss-b' : ''}`} onClick={() => setSel(i)}>{t}</span>)}</div>
      <p className="ui-muted" style={{ fontSize: 12.5, lineHeight: 1.45, margin: 0 }}>{body}</p>
    </div>
  )
}
function Seg({ items, init }) {
  const [sel, setSel] = useState(init)
  return <div className="ui-seg">{items.map((t, i) => <span key={t} className={i === sel ? 'on coss-b' : ''} onClick={() => setSel(i)}>{t}</span>)}</div>
}
function Stars({ init, reviews }) {
  const [n, setN] = useState(init)
  return (
    <div className="ui-col" style={{ gap: 6 }}>
      <div className="ui-stars">{[1, 2, 3, 4, 5].map(i => <span key={i} className={i <= n ? 'on' : 'off'} style={{ cursor: 'pointer' }} onClick={() => setN(i)}>★</span>)}</div>
      <span className="ui-muted" style={{ fontSize: 12 }}>{n.toFixed(1)} · {reviews}</span>
    </div>
  )
}
function Pages({ cur, total }) {
  const [p, setP] = useState(cur)
  return (
    <div className="ui-pages">
      <span className="ui-page" onClick={() => setP(x => Math.max(1, x - 1))}>‹</span>
      {[p - 1, p, p + 1].filter(n => n >= 1 && n <= total).map(n => <span key={n} className={`ui-page${n === p ? ' on' : ''}`} onClick={() => setP(n)}>{n}</span>)}
      <span className="ui-page ui-dim">…</span>
      <span className="ui-page" onClick={() => setP(total)}>{total}</span>
      <span className="ui-page" onClick={() => setP(x => Math.min(total, x + 1))}>›</span>
    </div>
  )
}
function SelectBox({ label, opts }) {
  const [sel, setSel] = useState(1)
  return (
    <div className="ui-col">
      <label className="ui-label coss-b">{label}</label>
      <div className="ui-field ui-between">{opts[sel]} <span className="ui-dim">▾</span></div>
      <div className="ui-list">{opts.map((o, i) => <div key={o} className={`ui-item${i === sel ? ' on' : ''}`} onClick={() => setSel(i)}>{o}</div>)}</div>
    </div>
  )
}
function Picklist({ items }) {
  const [sel, setSel] = useState(0)
  return (
    <div className="ui-list">{items.map(([label, k], i) => (
      <div key={label} className={`ui-item${i === sel ? ' on' : ''}`} onClick={() => setSel(i)}>{label}{k && <span className="ui-kbd">{k}</span>}</div>
    ))}</div>
  )
}
function NavList({ sec, items, sec2, items2 }) {
  const [sel, setSel] = useState('0-0')
  const Item = (g, i, label) => (
    <span key={label} className={`ui-nav-item${sel === `${g}-${i}` ? ' on' : ''}`} onClick={() => setSel(`${g}-${i}`)}>{label}</span>
  )
  return (
    <nav className="ui-nav">
      <div className="ui-nav-sec">{sec}</div>{items.map((it, i) => Item(0, i, it))}
      <div className="ui-nav-sec">{sec2}</div>{items2.map((it, i) => Item(1, i, it))}
    </nav>
  )
}
function CalendarCtl({ month, init }) {
  const [sel, setSel] = useState(init)
  return (
    <div>
      <div className="ui-cal-head"><span className="coss-b">{month} 2026</span><span className="ui-dim">‹ ›</span></div>
      <div className="ui-cal">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="ui-cal-w">{d}</span>)}
        {[28, 29, 30].map(d => <span key={'p' + d} className="ui-cal-d dim">{d}</span>)}
        {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <span key={d} className={`ui-cal-d${d === sel ? ' on' : ''}`} onClick={() => setSel(d)}>{d}</span>)}
      </div>
    </div>
  )
}

// Textarea + formatting toolbar over an editable field. B/I/U format the current selection
// (execCommand); the field is contentEditable so the text is really editable. The content is
// set once via dangerouslySetInnerHTML so re-renders never clobber what the user typed.
function Editor({ label, text }) {
  const ref = useRef(null)
  return (
    <div>
      <label className="ui-label coss-b">{label}</label>
      <div className="ui-toolbar" style={{ marginBottom: 8 }}>
        <span className="ui-tool coss-b" onMouseDown={e => { e.preventDefault(); document.execCommand('bold'); ref.current?.focus() }}>B</span>
        <span className="ui-tool" style={{ fontStyle: 'italic' }} onMouseDown={e => { e.preventDefault(); document.execCommand('italic'); ref.current?.focus() }}>I</span>
        <span className="ui-tool" style={{ textDecoration: 'underline' }} onMouseDown={e => { e.preventDefault(); document.execCommand('underline'); ref.current?.focus() }}>U</span>
      </div>
      <div ref={ref} className="ui-field ui-editable" contentEditable suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: text }} />
    </div>
  )
}

// Draggable slider — pointer-capture drag sets the value; the readout tracks it live.
function SliderCtl({ label, fmt, init }) {
  const [pct, setPct] = useState(init)
  const ref = useRef(null)
  const set = (clientX) => {
    const r = ref.current.getBoundingClientRect()
    setPct(Math.min(100, Math.max(0, Math.round(((clientX - r.left) / r.width) * 100))))
  }
  return (
    <div className="ui-col">
      <div className="ui-between"><span style={{ fontSize: 13 }}>{label}</span><span className="ui-num coss-b" style={{ fontSize: 13 }}>{fmt(pct)}</span></div>
      <div ref={ref} className="ui-track ui-track--drag"
        onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); set(e.clientX) }}
        onPointerMove={e => { if (e.buttons) set(e.clientX) }}>
        <span className="ui-track-fill" style={{ width: `${pct}%` }} />
        <span className="ui-thumb" style={{ left: `${pct}%` }} />
      </div>
    </div>
  )
}

// Build the catalog for pass `v`. Every panel pulls its copy from the pools offset by `v`.
function makeParticles(v) {
  const [selLabel, selOpts] = at(SELECTS, v)
  const tabs = at(TABSETS, v)
  const [alTitle, alMsg] = at(ALERTS, v)
  const [stLabel, stNum, stDelta] = at(STATS, v)
  const [toTitle, toSub] = at(TOASTS, v)
  const [dgTitle, dgSub, dgAction] = at(DIALOGS, v)
  const cmds = at(COMMANDS, v)
  const bars = at(BARSETS, v), barMax = Math.max(...bars)
  const code = at(CODES, v)
  const tl = at(TIMELINES, v)
  const [cardH, cardP] = at(CARDS, v)
  const month = at(MONTHS, v), calHi = at([12, 18, 24, 8], v)
  const badges = at(BADGESETS, v)
  const [swA, swB] = at(SWITCHSETS, v)
  const [ttBubble, ttBtn] = at(TOOLTIPS, v)
  const checks = at(CHECKSETS, v)
  const radios = at(RADIOSETS, v)
  const [taLabel, taText] = at(TEXTAREAS, v)
  const toggles = at(TOGGLESETS, v), toggleOn = at(TOGGLE_ACTIVE, v)
  const [navSec, navItems, navSec2, navItems2] = at(NAVSETS, v)
  const [fsLegend, fsOpts] = at(FIELDSETS, v)
  const [emH, emP, emBtn] = at(EMPTIES, v)
  const [kA, kB, kText] = at(KBDS, v)
  const [stp1, stp2, stp3, stpOn] = at(STEPSETS, v)
  const [rateN, rateReviews] = at(RATINGS, v)
  const [slLabel, slFmt, slInit] = at(SLIDERS, v)
  const [pgCur, pgTotal] = at(PAGES, v)

  return [
    { name: 'Button', desc: 'A button or a component that looks like a button.', node: (
      <div className="ui-row ui-wrap">
        <span className="ui-btn ui-btn--primary">{at(['Save changes', 'Publish', 'Confirm'], v)}</span>
        <span className="ui-btn">Cancel</span>
        <span className="ui-btn ui-btn--ghost ui-muted">Learn more</span>
      </div>
    ) },
    { name: 'Input', desc: 'A field with a label, placeholder and helper text.', node: (
      <div>
        <label className="ui-label coss-b">Work email</label>
        <div className="ui-field">{at(EMAILS, v)}</div>
        <div className="ui-help">We’ll only use this to send booking receipts.</div>
      </div>
    ) },
    { name: 'Select', desc: 'Displays a list of options for the user to pick from.', node: <SelectBox label={selLabel} opts={selOpts} /> },
    { name: 'Tabs', desc: 'Toggles between related panels on the same page.', node: <TabsCtl tabs={tabs} body={at(TABBODY, v)} /> },
    { name: 'Accordion', desc: 'A set of collapsible panels with headings and content.', node: <AccordionDemo seed={v} /> },
    { name: 'Alert', desc: 'A callout for displaying important information.', node: (
      <div className="ui-alert">
        <span className="ui-alert-ic">!</span>
        <div><div className="ui-alert-title coss-b">{alTitle}</div><div className="ui-alert-msg">{alMsg}</div></div>
      </div>
    ) },
    { name: 'Badge', desc: 'A badge or a component that looks like a badge.', node: (
      <div className="ui-row ui-wrap">
        {badges.map(([label, dot]) => (
          <span key={label} className="ui-chip"><span className={`ui-dot ${dot}`} />{label}</span>
        ))}
      </div>
    ) },
    { name: 'Table', desc: 'A simple table component for displaying tabular data.', wide: true, node: (
      <div>
        <table className="ui-table">
          <thead><tr><th className="coss-b">Project</th><th className="coss-b">Status</th><th className="coss-b">Budget</th></tr></thead>
          <tbody>
            {[0, 1, 2, 3, 4].map(i => { const [p, tone, amt] = at(PROJECTS, v + i); return (
              <tr key={i}><td>{p}</td><td><span className="ui-chip"><span className={`ui-dot${tone ? ' dot-' + tone : ''}`} />{LABELS[tone]}</span></td><td className="ui-num">{amt}</td></tr>
            ) })}
            <tr className="total"><td className="coss-b">Total</td><td /><td className="ui-num coss-b">$32,350</td></tr>
          </tbody>
        </table>
        <div className="ui-cap">A list of current projects.</div>
      </div>
    ) },
    { name: 'Avatar', desc: 'An image element with a fallback for representing the user.', node: (
      <div className="ui-row">
        <div className="ui-avatars">{[0, 1, 2].map(i => <span key={i} className="ui-avatar coss-b">{ini(at(NAMES, v + i))}</span>)}<span className="ui-avatar coss-b">+4</span></div>
        <span className="ui-muted" style={{ fontSize: 12.5 }}>7 attendees</span>
      </div>
    ) },
    { name: 'Switch', desc: 'A control that indicates whether a setting is on or off.', node: <Toggle labels={[swA, swB]} /> },
    { name: 'Slider', desc: 'An input where the user selects a value from within a range.', node: <SliderCtl label={slLabel} fmt={slFmt} init={slInit} /> },
    { name: 'Tooltip', desc: 'A popup with a hint that appears on hover or focus.', node: (
      <div className="ui-tooltip"><span className="ui-bubble">{ttBubble}</span><span className="ui-btn ui-btn--sm">{ttBtn}</span></div>
    ) },
    { name: 'Command', desc: 'A command menu for fast keyboard-driven navigation.', node: (
      <div className="ui-col" style={{ gap: 6 }}>
        <div className="ui-field ui-between"><span className="ui-dim">Search…</span><span className="ui-kbd">⌘K</span></div>
        <Picklist items={cmds} />
      </div>
    ) },
    { name: 'Pagination', desc: 'Navigates between pages of a larger result set.', node: <Pages cur={pgCur} total={pgTotal} /> },
    { name: 'Stat', desc: 'A metric card with a value and a change indicator.', node: (
      <div><div className="ui-stat-label">{stLabel}</div><div className="ui-stat-num coss-b">{stNum}</div><div className="ui-delta">{stDelta}</div></div>
    ) },
    { name: 'Toast', desc: 'A temporary notification that appears on screen.', node: (
      <div className="ui-toast"><div className="ui-toast-title coss-b">{toTitle}</div><div className="ui-toast-sub">{toSub}</div></div>
    ) },
    { name: 'Dialog', desc: 'A modal that interrupts the user to confirm an action.', node: (
      <div className="ui-dialog">
        <div className="ui-dialog-title coss-b">{dgTitle}</div><div className="ui-dialog-sub">{dgSub}</div>
        <div className="ui-dialog-actions"><span className="ui-btn ui-btn--sm">Cancel</span><span className="ui-btn ui-btn--sm ui-btn--primary">{dgAction}</span></div>
      </div>
    ) },
    { name: 'Checkbox', desc: 'A control that toggles between checked and unchecked.', node: <Checks items={checks} /> },
    { name: 'Radio Group', desc: 'A set of options where only one can be selected.', node: <Radios items={radios} /> },
    { name: 'Progress', desc: 'Shows the completion progress of a task.', node: (
      <div className="ui-col">
        <div className="ui-between"><span style={{ fontSize: 13 }}>Onboarding</span><span className="ui-num coss-b" style={{ fontSize: 13 }}>{at([68, 42, 91], v)}%</span></div>
        <div className="ui-track"><span className="ui-track-fill" style={{ width: `${at([68, 42, 91], v)}%` }} /></div>
      </div>
    ) },
    { name: 'Textarea', desc: 'An editable field with a formatting toolbar.', node: <Editor label={taLabel} text={taText} /> },
    { name: 'Toggle Group', desc: 'A shared state across a series of toggle buttons.', node: <Seg items={toggles} init={toggleOn} /> },
    { name: 'Menu', desc: 'A dropdown menu of actions, opened from a trigger.', pop: true, node: <MenuDemo /> },
    { name: 'Navigation', desc: 'A sidebar of sections and links for a workspace.', node: <NavList sec={navSec} items={navItems} sec2={navSec2} items2={navItems2} /> },
    { name: 'Group', desc: 'Related controls visually attached into one unit.', node: (
      <div>
        <label className="ui-label coss-b">Your booking link</label>
        <div className="ui-group"><div className="ui-field"><span className="ui-dim">cal.com/</span>{at(HANDLES, v)}</div><span className="ui-btn">Copy</span></div>
      </div>
    ) },
    { name: 'Fieldset', desc: 'Groups related form controls under a shared legend.', node: (
      <fieldset className="ui-fieldset">
        <div className="ui-legend coss-b">{fsLegend}</div>
        <Checks items={fsOpts.map(([l]) => l)} init={fsOpts.map(([, b]) => b)} />
      </fieldset>
    ) },
    { name: 'Empty State', desc: 'A placeholder shown when there’s nothing yet.', node: (
      <div className="ui-empty">
        <div className="ui-empty-h coss-b">{emH}</div>
        <div className="ui-empty-p">{emP}</div>
        <span className="ui-btn ui-btn--sm ui-btn--primary">{emBtn}</span>
      </div>
    ) },
    { name: 'Card', desc: 'A container that groups related content and actions.', node: (
      <div className="ui-card2">
        <div className="ui-card2-h coss-b">{cardH}</div>
        <div className="ui-card2-p">{cardP}</div>
        <div className="ui-btn-row"><span className="ui-btn ui-btn--sm">View report</span></div>
      </div>
    ) },
    { name: 'Calendar', desc: 'A date grid for picking a day.', node: <CalendarCtl month={month} init={calHi} /> },
    { name: 'Chart', desc: 'A compact bar chart with axis labels.', node: (
      <div>
        <div className="ui-chart">{bars.map((h, i) => <span key={i} className={`ui-bar${h === barMax ? ' hi' : ''}`} style={{ height: `${h}%` }} />)}</div>
        <div className="ui-chart-x">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
      </div>
    ) },
    { name: 'Code', desc: 'A block for displaying formatted source code.', node: (
      <pre className="ui-code" style={{ margin: 0 }}>{code.map((l, i) => <div key={i}>{l}</div>)}</pre>
    ) },
    { name: 'Kbd', desc: 'Displays a keyboard key or shortcut.', node: (
      <div className="ui-kbdrow">Press <span className="ui-kbd">{kA}</span><span className="ui-kbd">{kB}</span> {kText}</div>
    ) },
    { name: 'Timeline', desc: 'An activity feed of events over time.', node: (
      <div className="ui-tl">{tl.map(([t, s], i) => (
        <div key={t} className="ui-tl-row">
          <div className="ui-tl-rail"><span className={`ui-tl-dot${i === 0 ? '' : ' o'}`} />{i < tl.length - 1 && <span className="ui-tl-line" />}</div>
          <div className="ui-tl-body"><div className="ui-tl-t coss-b">{t}</div><div className="ui-tl-s">{s}</div></div>
        </div>
      ))}</div>
    ) },
    { name: 'Stepper', desc: 'Shows progress through a sequence of steps.', node: (
      <div className="ui-steps">
        {[stp1, stp2, stp3].map((s, i) => (
          <Fragment key={s}>
            {i > 0 && <span className="ui-step-bar" />}
            <span className={`ui-step${i <= stpOn ? ' on' : ''}`}><span className="ui-step-n">{i + 1}</span>{s}</span>
          </Fragment>
        ))}
      </div>
    ) },
    { name: 'Rating', desc: 'Displays a star rating for an item.', node: <Stars init={rateN} reviews={rateReviews} /> },
    { name: 'Hover Card', desc: 'A rich preview shown when hovering a reference.', node: (
      <div className="ui-panel">
        <div className="ui-row" style={{ gap: 10 }}>
          <span className="ui-avatar coss-b" style={{ width: 34, height: 34, marginLeft: 0 }}>{ini(at(NAMES, v))}</span>
          <div><div className="coss-b" style={{ fontSize: 13.5 }}>{at(NAMES, v)}</div><div className="ui-muted" style={{ fontSize: 12 }}>@{at(HANDLES, v)}</div></div>
        </div>
        <div className="ui-muted" style={{ fontSize: 12, marginTop: 9, lineHeight: 1.45 }}>{at(ROLES, v)} in {at(CITIES, v)}. Booked 128 meetings this year.</div>
      </div>
    ) },
    { name: 'Login', desc: 'A sign-in form with email and password.', node: (
      <div className="ui-panel">
        <div className="ui-panel-h coss-b">Sign in to your account</div>
        <div className="ui-col">
          <div className="ui-field"><span className="ui-dim">{at(EMAILS, v)}</span></div>
          <div className="ui-field"><span className="ui-dim">••••••••</span></div>
          <span className="ui-btn ui-btn--primary ui-btn--block">Continue</span>
        </div>
      </div>
    ) },
    { name: 'List', desc: 'A paginated list of records with a header.', node: (
      <div className="ui-col" style={{ gap: 11 }}>
        <div className="ui-crumbs" style={{ fontSize: 12 }}><span>Home</span><span>/</span><span className="on coss-b">Bookings</span></div>
        <div className="ui-list" style={{ gap: 1 }}>
          {[0, 1, 2, 3, 4].map(i => { const [who, when, tone, label] = at(BOOKINGS, v + i); return (
            <div key={i} className="ui-rec"><span>{who}<span className="ui-rec-sub"> · {when}</span></span><span className="ui-chip"><span className={`ui-dot dot-${tone}`} />{label}</span></div>
          ) })}
        </div>
        <div className="ui-pages"><span className="ui-page">‹</span><span className="ui-page on">1</span><span className="ui-page">2</span><span className="ui-page">3</span><span className="ui-page ui-dim">…</span><span className="ui-page">›</span></div>
      </div>
    ) },
  ]
}

const INIT_SIDE = 6   // columns each side of centre at start (→ ~12 columns)
const OVERSCAN_PX = 600 // keep this much extra mounted past each visible edge
const COL_W = 270, COL_WIDE_W = 420, COL_GAP = 16

// Real measured tile heights (incl. header) — used to fill columns AND to size the loading
// skeleton so the card reserves ~the right box (minimal reflow when content resolves).
const EST = {
  Button: 199, Input: 213, Select: 282, Tabs: 200, Accordion: 275, Alert: 200, Badge: 168,
  Table: 354, Avatar: 168, Switch: 185, Slider: 185, Tooltip: 185, Command: 243, Pagination: 185,
  Stat: 177, Toast: 204, Dialog: 244, Checkbox: 202, 'Radio Group': 202, Progress: 168, Textarea: 248,
  'Toggle Group': 185, Menu: 168, Navigation: 277, Group: 185, Fieldset: 251,
  'Empty State': 237, Card: 232, Calendar: 277, Chart: 214, Code: 224, Kbd: 168, Timeline: 232,
  Stepper: 168, Rating: 168, 'Hover Card': 231, Login: 280, List: 390,
}

// Distinct permutation of catalog indices per column seed → no two columns share an order.
// Module-level (not per-render) since colWidth/colX below need it too.
function hash(i, seed) {
  let x = ((i + 1) * 374761393 + (seed * 2 + 1) * 668265263) >>> 0
  x = ((x ^ (x >>> 13)) * 1274126177) >>> 0
  return x
}

// Column width is decided by INDEX ALONE, never by which tile lands there — that's what
// keeps panning O(1) (see colX below). An occasional wide column then prefers a wide-flagged
// tile (Table, List) so the extra width earns its keep; narrow columns skip those tiles
// entirely, since they're sized to fill 420px, not 270px.
const WIDE_PERIOD = 5
const isWideCol = (c) => hash(c, 0) % WIDE_PERIOD === 0
const colWidth = (c) => (isWideCol(c) ? COL_WIDE_W : COL_W)

// Left edge of column c, in board-content pixels, with column 0 pinned at x=0. O(|range|)
// is fine — the mounted range is a few dozen columns at most.
function colX(c) {
  let x = 0
  if (c >= 0) { for (let i = 0; i < c; i++) x += colWidth(i) + COL_GAP }
  else { for (let i = -1; i >= c; i--) x -= colWidth(i) + COL_GAP }
  return x
}

export default function UiKitBoard({ fontStyle, weight = 400, boldWeight = 700, topInset = 0 }) {
  // Board style built from the incoming proof props: spread the font style object (fontFamily,
  // fontVariationSettings, fontFeatureSettings, fontStyle, fontOpticalSizing), then expose the
  // weight/variation CSS vars the ported coss.css relies on (--w-default, --w-bold, --vs).
  const style = {
    ...fontStyle,
    '--w-default': String(weight),
    '--w-bold': String(boldWeight),
    '--vs': (fontStyle && fontStyle.fontVariationSettings) || 'normal',
  }

  // topInset: how much of the board's top the consuming app's own chrome floats OVER
  // (nav tabs, mode label — see ReCal's Shell.tsx / font-proofer's App.jsx). The STRIP
  // itself always spans the full height it's given — this only sets where row 0 RESTS,
  // so on load it clears whatever's overlaid on top, same as before there was an overlay.
  // Panning down from rest slides later rows up underneath that chrome (see topFadeOpacity
  // below); each app supplies its own value since the overlay heights differ per app.

  // ── 2D infinite board ───────────────────────────────────────────────────────────
  // Each column is an INDEPENDENT vertical strip that draws components from its OWN
  // deterministic shuffle of the catalog (distinct order per column → no columns look alike),
  // filled down to `targetH`. Panning is Seth Thompson's drag/wheel engine (useDragScroll,
  // https://seththompson.com/articles/infinite-image-grids) driving plain motion values —
  // there's no native scrollLeft/scrollTop, so nothing to fight with reflow-driven centring
  // hacks. Columns mount/unmount on BOTH horizontal edges as you pan (real virtualization —
  // panning far in one direction doesn't grow the DOM forever); rows only grow downward,
  // same as an ordinary infinite-scroll feed, and both grow synchronously on the same tick
  // the edge is crossed — no artificial loading delay, nothing to fetch.
  const [left, setLeft] = useState(INIT_SIDE)
  const [right, setRight] = useState(INIT_SIDE)
  const [rows, setRows] = useState(1)
  const stripRef = useRef(null)
  const baseX = useRef(0)
  const panX = useMotionValue(0)
  const panY = useMotionValue(0)
  const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 900))
  useEffect(() => {
    const on = () => setVh(window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  // Start ~2 screens tall so the board is comfortably bigger than the viewport in both axes
  // (edge-checks aren't trivially satisfied on mount).
  const targetH = Math.round(vh * 2.2) * rows

  // Centre the initial view once the strip has a measured width: column 0's left edge lands
  // at mid-viewport, so the already-mounted negative AND positive columns are both reachable
  // with a single drag, instead of starting flush against the left edge.
  useLayoutEffect(() => {
    const s = stripRef.current
    if (!s || baseX.current) return
    baseX.current = s.clientWidth / 2
    panX.set(baseX.current)
  }, [])

  // topInset arrives at 0 and is patched in asynchronously (the consuming app measures
  // its own overlaid nav via ResizeObserver, after it's actually rendered) — panY only
  // reads it inside the drag callback, so without this it would sit at the stale value
  // until the next gesture. Keep tracking topInset until the user actually interacts;
  // once they have, their own position takes over and this stops touching panY.
  const hasPannedRef = useRef(false)
  useEffect(() => {
    if (!hasPannedRef.current) panY.set(topInset)
  }, [topInset])

  // Negated: useDragScroll's offset already flips drag/wheel direction once (see its
  // emitOffset), and its OWN reference usage (virtual-grid.jsx) applies a second flip via
  // `column - position` before turning a position into a CSS value. Since we skip that
  // indirection and feed the transform directly, we need that second flip here instead —
  // otherwise content drags backwards relative to the pointer.
  // `bind` is drag-only now (see useDragScroll: wheel binds itself directly to `target`,
  // drag stays on the synthetic events this spreads onto the strip below).
  const bind = useDragScroll(
    ({ offset }) => {
      hasPannedRef.current = true
      panX.set(baseX.current - offset[0])
      // Clamped at topInset (row 0's rest position): nothing lives above row 0, so
      // panning past that point would just reveal empty strip background.
      panY.set(Math.min(topInset, topInset - offset[1]))
    },
    // `target` makes wheel attach a REAL DOM listener to the strip itself, instead of a
    // synthetic React handler — required for eventOptions to have any effect. React
    // hardcodes wheel/touch listeners as passive at its root regardless of what a synthetic
    // onWheel prop does, so the wheel handler's preventDefault() (stop this from ALSO
    // scrolling the page underneath) would silently no-op without this.
    { target: stripRef, eventOptions: { passive: false } },
  )


  // Grow or shrink the mounted column range so it always covers the visible viewport plus
  // OVERSCAN_PX of slack on each side. Calling setLeft/setRight with an unchanged value is a
  // React no-op (Object.is bails the re-render), so this can run on every pan tick with no
  // extra throttling — it only actually mounts/unmounts when an edge is really crossed.
  useMotionValueEvent(panX, 'change', () => {
    const s = stripRef.current
    if (!s) return
    const viewLeft = -panX.get()
    const viewRight = viewLeft + s.clientWidth
    setLeft((n) => {
      if (colX(-n) > viewLeft - OVERSCAN_PX) return n + 1
      if (n > INIT_SIDE && colX(-(n - 1)) < viewLeft - OVERSCAN_PX * 2) return n - 1
      return n
    })
    setRight((n) => {
      if (colX(n) < viewRight + OVERSCAN_PX) return n + 1
      if (n > INIT_SIDE && colX(n - 1) > viewRight + OVERSCAN_PX * 2) return n - 1
      return n
    })
  })
  useMotionValueEvent(panY, 'change', () => {
    const s = stripRef.current
    if (!s) return
    const viewBottom = -panY.get() + s.clientHeight
    if (viewBottom > targetH - OVERSCAN_PX) setRows((n) => n + 1)
  })

  // Wide columns are decided by index alone (isWideCol), never by content — a wide column
  // then leads with a wide-flagged tile (Table, List) so the extra width earns its keep;
  // narrow columns skip those tiles, since they're sized to fill 420px, not 270px.
  const column = (c) => {
    const wide = isWideCol(c)
    const list = makeParticles(c)
    const order = list.map((_, i) => i).sort((a, b) => hash(a, c) - hash(b, c))
    const [wideIdx, narrowIdx] = order.reduce(
      (acc, oi) => { acc[list[oi].wide ? 0 : 1].push(oi); return acc },
      [[], []],
    )
    const sequence = wide ? [...wideIdx, ...narrowIdx] : narrowIdx
    const out = []; let h = 0
    for (const oi of sequence) {
      const p = list[oi]
      out.push({ ...p, key: `c${c}i${oi}` })
      h += (EST[p.name] ?? 180) + 16
      if (h >= targetH) break
    }
    return out
  }
  // Absolutely positioned at colX(c), NOT flex-flow order — flex would lay columns out in
  // DOM order (the mounted range starts at -left), which doesn't match colX's coordinate
  // frame (column 0 pinned at x=0, stable regardless of which range is currently mounted).
  const cols = []
  for (let c = -left; c < right; c++) cols.push({ c, x: colX(c), tiles: column(c) })

  // The fade MUST end exactly at topInset (see UiKitBoard.css) — row 0 rests there, so a
  // longer span would still be resolving over its own cards at rest, a visible "permafade"
  // with no overlay above it to justify one. Gentle rather than a full fade-to-nothing:
  // dips to ~55% opacity at the very top edge, never vanishing.
  const topMask = topInset > 0
    ? `linear-gradient(to bottom, rgba(0,0,0,.55), black ${topInset}px)`
    : undefined

  return (
    <div className="ukit-strip" ref={stripRef} {...bind()}
      style={topMask ? { maskImage: topMask, WebkitMaskImage: topMask } : undefined}>
      <motion.div className="coss-board" style={{ ...style, x: panX, y: panY }}>
        {cols.map(({ c, x, tiles }) => (
          <div key={c} className="coss-col" style={{ left: x, width: colWidth(c) }}>
            {tiles.map(p => (
              <div key={p.key} className={`coss-card${p.pop ? ' coss-card--pop' : ''}`}>
                <div className="coss-card-head">
                  <div className="coss-card-name">{p.name}</div>
                  <div className="ukit-card-desc">{p.desc}</div>
                </div>
                <div className="coss-card-body"><Reveal h={(EST[p.name] ?? 200) - 118}>{p.node}</Reveal></div>
              </div>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  )
}
