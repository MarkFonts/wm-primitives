import { useState } from 'react'
import { AxisSlider } from '../shared/index'

export default function App() {
  const [wght, setWght] = useState<number | 'auto'>(400)
  return (
    <div style={{ width: 320, padding: 24 }}>
      <AxisSlider label="Weight" tag="wght" value={wght} min={100} max={900} step={1} onChange={setWght} />
    </div>
  )
}
