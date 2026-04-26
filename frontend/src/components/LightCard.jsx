import { useState } from 'react'

export default function LightCard({ brightness, onBrightnessChange }) {
  const [isOn, setIsOn] = useState(false)
  const [localBrightness, setLocalBrightness] = useState(50)
  const [error, setError] = useState(null)

  const displayed = brightness ?? localBrightness

  async function lightOn() {
    try {
      await fetch('/light/on', { method: 'POST' })
      setIsOn(true)
      setError(null)
    } catch {
      setError('Failed to turn light on')
    }
  }

  async function lightOff() {
    try {
      await fetch('/light/off', { method: 'POST' })
      setIsOn(false)
      setError(null)
    } catch {
      setError('Failed to turn light off')
    }
  }

  async function applyBrightness(val) {
    try {
      await fetch('/light/brightness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: parseInt(val) }),
      })
      onBrightnessChange?.(parseInt(val))
      setLocalBrightness(parseInt(val))
      setError(null)
    } catch {
      setError('Failed to set brightness')
    }
  }

  return (
    <div className="card">
      <p className="card-title">
        Light
        <span className={`dot ${isOn ? 'dot-on' : 'dot-off'}`} />
      </p>

      <div className="btn-row">
        <button onClick={lightOn}>ON</button>
        <button className="btn-danger" onClick={lightOff}>OFF</button>
      </div>

      <div className="slider-label">
        <span>Brightness</span>
        <span>{displayed}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={displayed}
        onChange={e => {
          setLocalBrightness(parseInt(e.target.value))
          onBrightnessChange?.(parseInt(e.target.value))
        }}
        onMouseUp={e => applyBrightness(e.target.value)}
        onTouchEnd={e => applyBrightness(e.target.value)}
      />

      {error && <p className="error-msg">{error}</p>}
    </div>
  )
}
