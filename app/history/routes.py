import sqlite3
from datetime import datetime, timezone, timedelta
from flask import Blueprint, jsonify, request
from ..db import DB_PATH, _conn, get_interval, set_interval

history_blueprint = Blueprint('history', __name__)


def _parse_dt(s, default):
    if not s:
        return default
    try:
        return datetime.fromisoformat(s.replace('Z', '+00:00'))
    except ValueError:
        return None


@history_blueprint.route('', methods=['GET'])
def get_history():
    now = datetime.now(timezone.utc)
    from_dt = _parse_dt(request.args.get('from'), now - timedelta(hours=24))
    to_dt   = _parse_dt(request.args.get('to'),   now)

    if from_dt is None or to_dt is None:
        return jsonify(error='Invalid date format'), 400

    from_iso = from_dt.strftime('%Y-%m-%dT%H:%M:%SZ')
    to_iso   = to_dt.strftime('%Y-%m-%dT%H:%M:%SZ')

    try:
        with _conn() as c:
            c.row_factory = sqlite3.Row
            rows = c.execute(
                '''SELECT timestamp, temperature, humidity, distance, pcb_temp
                   FROM sensor_readings
                   WHERE timestamp >= ? AND timestamp <= ?
                   ORDER BY timestamp ASC''',
                (from_iso, to_iso)
            ).fetchall()
        return jsonify(readings=[dict(r) for r in rows])
    except Exception as e:
        return jsonify(error=str(e)), 500


@history_blueprint.route('/interval', methods=['GET'])
def get_interval_route():
    return jsonify(interval_seconds=get_interval())


@history_blueprint.route('/interval', methods=['POST'])
def set_interval_route():
    data = request.get_json(force=True) or {}
    seconds = data.get('interval_seconds')
    if seconds is None:
        return jsonify(error='interval_seconds required'), 400
    try:
        set_interval(int(seconds))
        return jsonify(interval_seconds=get_interval())
    except (ValueError, TypeError):
        return jsonify(error='Invalid value'), 400
