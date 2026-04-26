import os
import subprocess
from flask import Blueprint, jsonify, send_from_directory, current_app, abort

photos_blueprint = Blueprint('photos', __name__)

STORAGE_WARN_BYTES = 8 * 1024 * 1024 * 1024   # 8 GB


def _photos_dir():
    return os.path.realpath(os.path.join(current_app.root_path, '..', 'photos'))


def _dir_size_bytes(path):
    total = 0
    try:
        for entry in os.scandir(path):
            if entry.is_file(follow_symlinks=False):
                total += entry.stat().st_size
    except FileNotFoundError:
        pass
    return total


@photos_blueprint.route('/latest', methods=['GET'])
def get_latest():
    photos_dir = _photos_dir()
    try:
        all_files = sorted(os.listdir(photos_dir))
    except FileNotFoundError:
        return jsonify(upper=None, lower=None), 200

    upper_files = [f for f in all_files if f.endswith('_upper.jpg')]
    lower_files = [f for f in all_files if f.endswith('_lower.jpg')]

    latest_upper = upper_files[-1] if upper_files else None
    latest_lower = lower_files[-1] if lower_files else None

    return jsonify(
        upper=f'/photos/{latest_upper}' if latest_upper else None,
        lower=f'/photos/{latest_lower}' if latest_lower else None,
    ), 200


@photos_blueprint.route('', methods=['GET'])
def list_photos():
    photos_dir = _photos_dir()
    try:
        files = sorted(os.listdir(photos_dir), reverse=True)
    except FileNotFoundError:
        return jsonify(photos=[], storage_warning=False), 200

    photo_list = []
    for fname in files:
        if not fname.endswith('.jpg'):
            continue
        parts = fname.replace('.jpg', '').split('_')
        if len(parts) == 3:
            date_str, time_str, side = parts
            timestamp = (
                f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]} "
                f"{time_str[:2]}:{time_str[2:4]}:{time_str[4:]}"
            )
        else:
            timestamp = None
            side = None
        photo_list.append({
            'filename': fname,
            'url': f'/photos/{fname}',
            'timestamp': timestamp,
            'side': side,
        })

    storage_warning = _dir_size_bytes(photos_dir) >= STORAGE_WARN_BYTES
    return jsonify(photos=photo_list, storage_warning=storage_warning), 200


@photos_blueprint.route('/<filename>', methods=['GET'])
def serve_photo(filename):
    if '..' in filename or '/' in filename:
        abort(400)
    photos_dir = _photos_dir()
    return send_from_directory(photos_dir, filename)


@photos_blueprint.route('/capture', methods=['POST'])
def capture():
    project_root = os.path.join(current_app.root_path, '..')
    script = os.path.realpath(os.path.join(project_root, 'bin', 'take-pictures.sh'))
    result = subprocess.run(['bash', script], capture_output=True, text=True)
    if result.returncode != 0:
        return jsonify(error=result.stderr or 'Capture failed'), 500

    # Return updated latest photo URLs
    photos_dir = _photos_dir()
    try:
        all_files = sorted(os.listdir(photos_dir))
    except FileNotFoundError:
        return jsonify(upper=None, lower=None), 200

    upper_files = [f for f in all_files if f.endswith('_upper.jpg')]
    lower_files = [f for f in all_files if f.endswith('_lower.jpg')]

    return jsonify(
        upper=f'/photos/{upper_files[-1]}' if upper_files else None,
        lower=f'/photos/{lower_files[-1]}' if lower_files else None,
    ), 200
