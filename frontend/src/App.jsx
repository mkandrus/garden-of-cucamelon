import { useState, useEffect, useCallback } from 'react'
import SensorCard from './components/SensorCard'
import LightCard from './components/LightCard'
import PumpCard from './components/PumpCard'
import CameraCard from './components/CameraCard'
import ScheduleCard from './components/ScheduleCard'
import './App.css'

const POLL_MS = 30_000

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export default function App() {
  const [sensors, setSensors] = useState({})
  const [lightBrightness, setLightBrightness] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const [temp, hum, dist, pcb, light] = await Promise.all([
        fetchJSON('/temperature'),
        fetchJSON('/humidity'),
        fetchJSON('/distance'),
        fetchJSON('/pcb-temp'),
        fetchJSON('/light/brightness'),
      ])
      setSensors({
        temperature: temp.temperature,
        humidity: hum.humidity,
        distance: dist.distance,
        pcbTemp: pcb['pcb-temp'],
      })
      setLightBrightness(light.value)
      setLastUpdated(new Date().toLocaleTimeString())
    } catch {
      // leave stale values displayed
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Garden Monitor</h1>
        {lastUpdated && <span className="last-updated">Updated {lastUpdated}</span>}
      </header>

      <div className="grid">
        <SensorCard sensors={sensors} />
        <LightCard brightness={lightBrightness} onBrightnessChange={setLightBrightness} />
        <PumpCard />
        <CameraCard />
        <ScheduleCard />
      </div>
    </div>
  )
}
