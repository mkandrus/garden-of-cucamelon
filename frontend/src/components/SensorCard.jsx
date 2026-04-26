export default function SensorCard({ sensors }) {
  const rows = [
    { label: 'Temperature', value: sensors.temperature, unit: '°C' },
    { label: 'Humidity',    value: sensors.humidity,    unit: '%'  },
    { label: 'Water level', value: sensors.distance,    unit: 'cm' },
    { label: 'PCB temp',    value: sensors.pcbTemp,     unit: '°C' },
  ]

  return (
    <div className="card">
      <p className="card-title">Sensors</p>
      {rows.map(({ label, value, unit }) => (
        <div className="sensor-row" key={label}>
          <span className="sensor-label">{label}</span>
          <span>
            <span className="sensor-value">{value ?? '—'}</span>
            {value != null && <span className="sensor-unit">{unit}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}
