# Cucamelon Fork — Change Log

This file documents significant changes made in this fork of [garden-of-eden](https://github.com/iot-root/garden-of-eden) and how to use them.

---

## Web GUI

**What it is:** A browser-based dashboard served by the existing Flask server. Access it from any device on the same LAN at `http://<pi-ip>:5000/`.

**Features:**
- Live sensor readings (temperature, humidity, water level, PCB temp) — auto-refreshes every 30 seconds
- Light controls: on/off + brightness slider
- Pump controls: on/off + "run for N minutes" with countdown timer (always runs at safe 30% duty cycle)
- Camera: view latest upper/lower photos, take a photo on demand, browse the full album with lightbox
- Schedule editor: edit pump run times/duration and light brightness schedule — saves to `schedule.json` and updates the crontab automatically

**Setup (run on the Pi via SSH):**
```bash
# Install new Python dependency
pip install python-crontab==3.2.0

# Build the frontend (must run on Pi — npm doesn't work over SSHFS)
npm install --prefix ~/garden-of-cucamelon/frontend
npm run build --prefix ~/garden-of-cucamelon/frontend

# Start Flask as usual
python run.py
```

**Development (hot-reload):**
```bash
# Terminal 1: Flask API
python run.py

# Terminal 2: Vite dev server (proxies API calls to Flask at :5000)
npm run dev --prefix ~/garden-of-cucamelon/frontend
# → open http://<pi-ip>:5173/ in browser
```

**Files added:**
- `frontend/` — React + Vite SPA source
- `app/photos/routes.py` — photo listing, serving, and on-demand capture endpoints
- `app/schedule/routes.py` — schedule read/write endpoints + crontab management
- `schedule.json` — schedule config (source of truth; edit here or via the GUI)

---

## Persistent Photo Storage

**What changed:** `bin/take-pictures.sh` previously saved only to `/tmp/` (overwritten each capture). It now saves timestamped copies to `photos/` in the project root.

**File naming:** `YYYYMMDD_HHMMSS_upper.jpg` / `YYYYMMDD_HHMMSS_lower.jpg`

**Storage limit:** The script automatically deletes the oldest photos when the `photos/` directory exceeds 10 GB. The GUI shows a warning banner when storage is above 8 GB.

**Backward compatibility:** `/tmp/upper_cam.jpg` and `/tmp/lower_cam.jpg` are kept as symlinks to the latest photos, so any existing scripts that read those paths still work.

---

## Schedule Management

**What changed:** Pump and light schedules can now be edited from the GUI instead of manually editing the crontab.

**How it works:**
1. The GUI reads/writes `schedule.json` at the project root
2. On save, the Flask app uses `python-crontab` to rewrite the relevant cron entries
3. All GUI-managed cron entries are tagged with `# gardyn-gui` so they can be cleanly updated without touching anything else in your crontab

**Manual edit:** You can also edit `schedule.json` directly and then trigger a crontab sync by hitting `POST /schedule` with the file contents, or just edit the crontab directly as before.
