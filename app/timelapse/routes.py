import os
import re
import shutil
import subprocess
import threading
import uuid
from datetime import datetime
from flask import Blueprint, jsonify, request, send_file, current_app

timelapse_blueprint = Blueprint('timelapse', __name__)

_jobs = {}
_jobs_lock = threading.Lock()

TIMELAPSE_DIR = '/tmp/garden-timelapses'


def _photos_dir(app):
    return os.path.realpath(os.path.join(app.root_path, '..', 'photos'))


def _parse_photo_ts(filename):
    """Return (datetime, side) from YYYYMMDD_HHMMSS_upper.jpg, or (None, None)."""
    m = re.match(r'^(\d{8})_(\d{6})_(upper|lower)\.jpg$', filename)
    if not m:
        return None, None
    date_s, time_s, side = m.groups()
    try:
        ts = datetime.strptime(date_s + time_s, '%Y%m%d%H%M%S')
        return ts, side
    except ValueError:
        return None, None


def _render(app, job_id, photo_files, fps, fmt, output_path):
    os.makedirs(TIMELAPSE_DIR, exist_ok=True)
    list_path = output_path + '.txt'

    try:
        # Write concat file list
        duration = 1.0 / fps
        with open(list_path, 'w') as f:
            for p in photo_files:
                f.write(f"file '{p}'\nduration {duration:.6f}\n")
            # ffmpeg concat demuxer needs the last file twice
            f.write(f"file '{photo_files[-1]}'\n")

        if fmt == 'gif':
            # Two-pass GIF for good quality palette
            palette = output_path + '.png'
            palette_cmd = [
                'ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', list_path,
                '-vf', 'scale=640:-2:flags=lanczos,palettegen',
                palette
            ]
            render_cmd = [
                'ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', list_path,
                '-i', palette,
                '-filter_complex', 'scale=640:-2:flags=lanczos[x];[x][1:v]paletteuse',
                output_path
            ]
            for cmd in [palette_cmd, render_cmd]:
                r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
                if r.returncode != 0:
                    raise RuntimeError(r.stderr[-800:])
            try:
                os.unlink(palette)
            except OSError:
                pass
        else:
            # MP4 with H.264
            cmd = [
                'ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', list_path,
                '-vf', 'scale=1280:-2',
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                output_path
            ]
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
            if r.returncode != 0:
                raise RuntimeError(r.stderr[-800:])

        with _jobs_lock:
            _jobs[job_id]['status'] = 'done'
            _jobs[job_id]['output'] = output_path
            _jobs[job_id]['filename'] = os.path.basename(output_path)

    except Exception as e:
        with _jobs_lock:
            _jobs[job_id]['status'] = 'error'
            _jobs[job_id]['error'] = str(e)
    finally:
        try:
            os.unlink(list_path)
        except OSError:
            pass


@timelapse_blueprint.route('', methods=['POST'])
def create_timelapse():
    if not shutil.which('ffmpeg'):
        return jsonify(error='ffmpeg is not installed on the Pi'), 501

    data = request.get_json(force=True) or {}
    from_str = data.get('from')
    to_str   = data.get('to')
    camera   = data.get('camera', 'upper')
    fps      = max(1, min(60, int(data.get('fps', 24))))
    fmt      = data.get('format', 'mp4').lower()

    if fmt not in ('mp4', 'gif'):
        return jsonify(error='format must be mp4 or gif'), 400
    if camera not in ('upper', 'lower'):
        return jsonify(error='camera must be upper or lower'), 400
    if not from_str or not to_str:
        return jsonify(error='from and to are required'), 400

    try:
        from_dt = datetime.fromisoformat(from_str.replace('Z', '+00:00')).replace(tzinfo=None)
        to_dt   = datetime.fromisoformat(to_str.replace('Z', '+00:00')).replace(tzinfo=None)
    except ValueError:
        return jsonify(error='Invalid date format'), 400

    photos_dir = _photos_dir(current_app._get_current_object())
    try:
        all_files = sorted(os.listdir(photos_dir))
    except FileNotFoundError:
        return jsonify(error='No photos directory found'), 404

    selected = []
    for fname in all_files:
        ts, side = _parse_photo_ts(fname)
        if ts is None or side != camera:
            continue
        if from_dt <= ts <= to_dt:
            selected.append(os.path.join(photos_dir, fname))

    if len(selected) < 2:
        return jsonify(error=f'Not enough {camera} photos in range (found {len(selected)})'), 400

    job_id = str(uuid.uuid4())[:8]
    ext = 'gif' if fmt == 'gif' else 'mp4'
    output_path = os.path.join(TIMELAPSE_DIR, f'timelapse_{job_id}.{ext}')

    with _jobs_lock:
        _jobs[job_id] = {
            'status':      'rendering',
            'frame_count': len(selected),
            'fps':         fps,
            'camera':      camera,
            'format':      fmt,
            'output':      None,
            'filename':    None,
            'error':       None,
        }

    app = current_app._get_current_object()
    t = threading.Thread(
        target=_render,
        args=(app, job_id, selected, fps, fmt, output_path),
        daemon=True,
        name=f'timelapse-{job_id}',
    )
    t.start()

    return jsonify(job_id=job_id, frame_count=len(selected)), 202


@timelapse_blueprint.route('/<job_id>/status', methods=['GET'])
def job_status(job_id):
    with _jobs_lock:
        job = _jobs.get(job_id)
    if not job:
        return jsonify(error='Job not found'), 404
    return jsonify({k: v for k, v in job.items() if k != 'output'})


@timelapse_blueprint.route('/<job_id>/download', methods=['GET'])
def download(job_id):
    with _jobs_lock:
        job = _jobs.get(job_id)
    if not job:
        return jsonify(error='Job not found'), 404
    if job['status'] != 'done':
        return jsonify(error='Not ready yet', status=job['status']), 425
    mime = 'image/gif' if job['format'] == 'gif' else 'video/mp4'
    return send_file(job['output'], mimetype=mime, as_attachment=True,
                     download_name=job['filename'])


@timelapse_blueprint.route('/list', methods=['GET'])
def list_timelapses():
    """Return all completed timelapse files on disk."""
    results = []
    if os.path.isdir(TIMELAPSE_DIR):
        for fname in sorted(os.listdir(TIMELAPSE_DIR), reverse=True):
            if not (fname.endswith('.mp4') or fname.endswith('.gif')):
                continue
            fpath = os.path.join(TIMELAPSE_DIR, fname)
            stat = os.stat(fpath)
            # Derive job_id from filename: timelapse_<job_id>.ext
            parts = fname.rsplit('.', 1)
            job_id = parts[0].replace('timelapse_', '') if parts[0].startswith('timelapse_') else parts[0]
            fmt = parts[1] if len(parts) > 1 else 'mp4'
            results.append({
                'job_id':   job_id,
                'filename': fname,
                'format':   fmt,
                'size_mb':  round(stat.st_size / (1024 * 1024), 1),
                'created':  datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M'),
            })
    return jsonify(timelapses=results)
