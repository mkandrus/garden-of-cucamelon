import os
import sqlite3
import threading
import time
import logging

log = logging.getLogger(__name__)

DB_PATH = os.path.realpath(os.path.join(os.path.dirname(__file__), '..', 'garden.db'))

_interval_lock = threading.Lock()
_sample_interval = 600  # seconds, editable at runtime


def get_interval():
    with _interval_lock:
        return _sample_interval


def set_interval(seconds):
    global _sample_interval
    with _interval_lock:
        _sample_interval = max(60, int(seconds))


def _conn():
    return sqlite3.connect(DB_PATH)


def init_db():
    with _conn() as c:
        c.execute('''CREATE TABLE IF NOT EXISTS sensor_readings (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp   TEXT    NOT NULL,
            temperature REAL,
            humidity    REAL,
            distance    REAL,
            pcb_temp    REAL
        )''')
        c.execute('CREATE INDEX IF NOT EXISTS idx_ts ON sensor_readings(timestamp)')


def _sample_once():
    from datetime import datetime, timezone
    from .sensors.temperature.temperature import temperature_sensor
    from .sensors.humidity.humidity import humidity_sensor
    from .sensors.distance.routes import distance_control
    from .sensors.pcb_temp.pcb_temp import get_pcb_temperature

    def safe(fn):
        try:
            return float(fn())
        except Exception:
            return None

    temp = safe(temperature_sensor.read)
    hum  = safe(humidity_sensor.read)
    dist = safe(distance_control.measure_once)
    pcb  = safe(get_pcb_temperature)

    ts = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    with _conn() as c:
        c.execute(
            'INSERT INTO sensor_readings (timestamp, temperature, humidity, distance, pcb_temp) VALUES (?,?,?,?,?)',
            (ts, temp, hum, dist, pcb)
        )
    log.info('Sampled: temp=%s hum=%s dist=%s pcb=%s', temp, hum, dist, pcb)


def start_sampler():
    def loop():
        while True:
            try:
                _sample_once()
            except Exception as e:
                log.error('Sampler error: %s', e)
            time.sleep(get_interval())

    t = threading.Thread(target=loop, daemon=True, name='sensor-sampler')
    t.start()
