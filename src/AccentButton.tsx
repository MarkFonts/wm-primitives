// AccentButton -- the two acid buttons (accentButton.css), as a native <button>.
//
// Q5 needs no markup beyond the label: its light is the button's own pseudo-elements. Q6 to N4
// carries layers (a tone, the rim sprite, the bottom streak) that the CSS drives off one
// registered number, so they are rendered here and only here. The shapes differ in what the
// light is made of: the pill is one full render at its own size, the chip is a 9-slice of
// end pieces and a stretched middle.
//
// `children` is the label (and a mark beside it, if any). It goes inside .wm-accent__lab, which
// is where q6n4 paints its metallic text; a Chevron there takes the same ink.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './accentButton.css'

export interface AccentButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** `q5`: underlit, the light deepens on hover. `q6n4`: the light travels round the rim on hover. */
  look: 'q5' | 'q6n4'
  /** `pill`: the Download button, a full render at 225 x 32 (q5) or 227 x 33 (q6n4) -- the sizes
   *  the light was rendered for, so the box is fixed. `chip`: 32 tall, 8px radius, any width. */
  shape: 'pill' | 'chip'
  /** `false` renders a plain <button> (no look, no layers): a toggle whose off state is the host's
   *  own control keeps ONE element across both states, so focus and transitions survive. */
  lit?: boolean
  children?: ReactNode
}

const Face = ({ pill }: { pill: boolean }) => (
  <i className="wm-accent__face" aria-hidden="true"><i className="wm-accent__tone" />
    {pill
      ? <i className="wm-accent__spr"><i className="wm-accent__fr"><i className="wm-accent__sa" /><i className="wm-accent__sb" /></i></i>
      : <i className="wm-accent__spr">
          <i className="wm-accent__bot" /><i className="wm-accent__top" />
          <i className="wm-accent__cap"><i className="wm-accent__sa" /><i className="wm-accent__sb" /></i>
          <i className="wm-accent__cap wm-accent__cap--r"><i className="wm-accent__sa" /><i className="wm-accent__sb" /></i>
        </i>}
  </i>
)

export function AccentButton({ look, shape, lit = true, className, type = 'button', children, ...rest }: AccentButtonProps) {
  if (!lit) return <button type={type} className={className} {...rest}>{children}</button>
  return (
    <button
      type={type}
      className={`wm-accent${className ? ' ' + className : ''}`}
      data-look={look}
      data-shape={shape}
      {...rest}
    >
      {look === 'q6n4' && <Face pill={shape === 'pill'} />}
      <span className="wm-accent__lab">{children}</span>
    </button>
  )
}
