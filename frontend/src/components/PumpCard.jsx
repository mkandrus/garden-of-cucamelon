import { useState, useRef } from 'react'

function formatDuration(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')} remaining`
}

export default function PumpCard() {
  const [isOn, setIsOn] = useState(false)
  const [duration, setDuration] = useState(5)
  const [countdown, setCountdown] = useState(null)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)
  const tickRef = useRef(null)

  function clearTimers() {
    clearTimeout(timerRef.current)
    clearInterval(tickRef.current)
    timerRef.current = null
    tickRef.current = null
  }

  async function pumpOn() {
    try {
      await fetch('/pump/on', { method: 'POST' })
      setIsOn(true)
      setError(null)
    } catch {
      setError('Failed to turn pump on')
    }
  }

  async function pumpOff() {
    try {
      await fetch('/pump/off', { method: 'POST' })
      setIsOn(false)
      setCountdown(null)
      clearTimers()
      setError(null)
    } catch {
      setError('Failed to turn pump off')
    }
  }

  async function runFor() {
    await pumpOn()
    clearTimers()
    const secs = Math.max(1, duration) * 60

    let remaining = secs
    setCountdown(formatDuration(remaining))
    tickRef.current = setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        clearInterval(tickRef.current)
        setCountdown(null)
      } else {
        setCountdown(formatDuration(remaining))
      }
    }, 1000)

    timerRef.current = setTimeout(() => {
      pumpOff()
    }, secs * 1000)
  }

  return (
    <div className="card">
      <p className="card-title">
        Pump
        <span className={`dot ${isOn ? 'dot-on' : 'dot-off'}`} />
      </p>

      <div className="btn-row">
        <button onClick={pumpOn}>ON</button>
        <button className="btn-danger" onClick={pumpOff}>OFF</button>
      </div>

      <div className="run-row">
        <label>
          Run for
          <input
            type="number"
            min={1}
            max={60}
            value={duration}
            onChange={e => setDuration(parseInt(e.target.value) || 1)}
          />
          min
        </label>
        <button onClick={runFor}>Run</button>
      </div>

      {countdown && <p className="countdown">{countdown}</p>}
      {error && <p className="error-msg">{error}</p>}
    </div>
  )
}
