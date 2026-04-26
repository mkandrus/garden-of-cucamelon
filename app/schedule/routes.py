import json
import os
from flask import Blueprint, jsonify, request, current_app
from crontab import CronTab

schedule_blueprint = Blueprint('schedule', __name__)

CRON_TAG = 'gardyn-gui'


def _schedule_path():
    return os.path.join(current_app.root_path, '..', 'schedule.json')


def _project_root():
    return os.path.realpath(os.path.join(current_app.root_path, '..'))


def _apply_crontab(schedule):
    root = _project_root()
    python = os.path.join(root, 'venv', 'bin', 'python')
    pump_script  = os.path.join(root, 'app', 'sensors', 'pump', 'pump.py')
    light_script = os.path.join(root, 'app', 'sensors', 'light', 'light.py')
    photo_script = os.path.join(root, 'bin', 'take-pictures.sh')

    cron = CronTab(user=True)
    cron.remove_all(comment=CRON_TAG)

    # Pump
    pump = schedule.get('pump', {})
    duration_secs = int(pump.get('duration_minutes', 5)) * 60
    for t in pump.get('times', []):
        hour, minute = _parse_time(t)
        cmd = (
            f'"{python}" "{pump_script}" --on --speed 100 ; '
            f'sleep {duration_secs} ; '
            f'"{python}" "{pump_script}" --off'
        )
        job = cron.new(command=cmd, comment=CRON_TAG)
        job.hour.on(hour)
        job.minute.on(minute)

    # Lights
    for entry in schedule.get('lights', []):
        hour, minute = _parse_time(entry['time'])
        brightness = int(entry.get('brightness', 0))
        if brightness == 0:
            cmd = f'"{python}" "{light_script}" --off'
        else:
            cmd = f'"{python}" "{light_script}" --on --brightness {brightness}'
        job = cron.new(command=cmd, comment=CRON_TAG)
        job.hour.on(hour)
        job.minute.on(minute)

    # Camera
    camera = schedule.get('camera', {})
    interval_min = int(camera.get('interval_minutes', 0))
    if interval_min > 0:
        cmd = f'bash "{photo_script}"'
        job = cron.new(command=cmd, comment=CRON_TAG)
        if interval_min < 60:
            job.minute.every(interval_min)
        elif interval_min == 60:
            job.minute.on(0)
        else:
            hours = interval_min // 60
            job.minute.on(0)
            job.hour.every(hours)

    cron.write()


def _parse_time(t):
    parts = t.split(':')
    return int(parts[0]), int(parts[1])


@schedule_blueprint.route('', methods=['GET'])
def get_schedule():
    path = _schedule_path()
    try:
        with open(path) as f:
            data = json.load(f)
    except FileNotFoundError:
        data = {'pump': {'times': [], 'duration_minutes': 5}, 'lights': [], 'camera': {'interval_minutes': 30}}
    return jsonify(data), 200


@schedule_blueprint.route('', methods=['POST'])
def save_schedule():
    data = request.get_json(force=True)
    if not data:
        return jsonify(error='Invalid JSON'), 400

    # Basic validation
    pump = data.get('pump')
    lights = data.get('lights')
    if not isinstance(pump, dict) or not isinstance(lights, list):
        return jsonify(error='Invalid schedule format'), 400

    path = _schedule_path()
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

    try:
        _apply_crontab(data)
    except Exception as e:
        return jsonify(error=f'Schedule saved but crontab update failed: {e}'), 500

    return jsonify(ok=True), 200
