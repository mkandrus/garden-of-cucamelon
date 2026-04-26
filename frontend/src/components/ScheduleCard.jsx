import { useState, useEffect } from 'react'

const DEFAULT_SCHEDULE = {
  pump: { times: [], duration_minutes: 5 },
  lights: [],
}

export default function ScheduleCard() {
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE)
  const [saveStatus, setSaveStatus] = useState(null) // null | 'ok' | 'err'
  const [saveMsg, setSaveMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/schedule')
      .then(r => r.json())
      .then(data => setSchedule(data))
      .catch(() => {})
  }, [])

  function updatePumpDuration(val) {
    setSchedule(s => ({ ...s, pump: { ...s.pump, duration_minutes: parseInt(val) || 1 } }))
  }

  function updatePumpTime(idx, val) {
    setSchedule(s => {
      const times = [...s.pump.times]
      times[idx] = val
      return { ...s, pump: { ...s.pump, times } }
    })
  }

  function addPumpTime() {
    setSchedule(s => ({ ...s, pump: { ...s.pump, times: [...s.pump.times, '08:00'] } }))
  }

  function removePumpTime(idx) {
    setSchedule(s => {
      const times = s.pump.times.filter((_, i) => i !== idx)
      return { ...s, pump: { ...s.pump, times } }
    })
  }

  function updateLight(idx, field, val) {
    setSchedule(s => {
      const lights = s.lights.map((l, i) =>
        i === idx ? { ...l, [field]: field === 'brightness' ? parseInt(val) : val } : l
      )
      return { ...s, lights }
    })
  }

  function addLight() {
    setSchedule(s => ({ ...s, lights: [...s.lights, { time: '06:00', brightness: 50 }] }))
  }

  function removeLight(idx) {
    setSchedule(s => ({ ...s, lights: s.lights.filter((_, i) => i !== idx) }))
  }

  async function save() {
    setSaving(true)
    setSaveStatus(null)
    try {
      const res = await fetch('/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule),
      })
      const data = await res.json()
      if (res.ok) {
        setSaveStatus('ok')
        setSaveMsg('Schedule saved and crontab updated.')
      } else {
        setSaveStatus('err')
        setSaveMsg(data.error || 'Save failed')
      }
    } catch {
      setSaveStatus('err')
      setSaveMsg('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card card-wide">
      <p className="card-title">Schedule</p>

      <div className="schedule-cols">
        {/* Pump */}
        <div className="schedule-section">
          <h3>Pump</h3>
          <div className="schedule-meta">
            <label>
              Duration:
              <input
                type="number"
                min={1}
                max={60}
                value={schedule.pump.duration_minutes}
                onChange={e => updatePumpDuration(e.target.value)}
              />
              min
            </label>
            <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>(fixed at 30% speed)</span>
          </div>

          {schedule.pump.times.map((t, i) => (
            <div className="schedule-entry" key={i}>
              <input
                type="time"
                value={t}
                onChange={e => updatePumpTime(i, e.target.value)}
              />
              <button className="btn-remove" onClick={() => removePumpTime(i)} title="Remove">✕</button>
            </div>
          ))}
          <button className="btn-add" onClick={addPumpTime}>+ Add time</button>
        </div>

        {/* Lights */}
        <div className="schedule-section">
          <h3>Lights</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.6rem' }}>
            Set brightness to 0 to turn off
          </p>

          {schedule.lights.map((l, i) => (
            <div className="schedule-entry" key={i}>
              <input
                type="time"
                value={l.time}
                onChange={e => updateLight(i, 'time', e.target.value)}
              />
              <input
                type="number"
                min={0}
                max={100}
                value={l.brightness}
                onChange={e => updateLight(i, 'brightness', e.target.value)}
                title="Brightness (0 = off)"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>%</span>
              <button className="btn-remove" onClick={() => removeLight(i)} title="Remove">✕</button>
            </div>
          ))}
          <button className="btn-add" onClick={addLight}>+ Add entry</button>
        </div>
      </div>

      <div className="schedule-footer">
        <button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Schedule'}
        </button>
        {saveStatus && (
          <span className={`save-status ${saveStatus === 'ok' ? 'save-ok' : 'save-err'}`}>
            {saveMsg}
          </span>
        )}
      </div>
    </div>
  )
}
