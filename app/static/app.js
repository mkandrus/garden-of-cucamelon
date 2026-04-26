(() => {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function api(method, path, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
    return res.json();
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function setDot(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('dot-on', on);
    el.classList.toggle('dot-off', !on);
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg || '';
  }

  // ── Sensors ───────────────────────────────────────────────────────────────

  async function fetchSensors() {
    try {
      const [temp, hum, dist, pcb] = await Promise.allSettled([
        api('GET', '/temperature'),
        api('GET', '/humidity'),
        api('GET', '/distance'),
        api('GET', '/pcb-temp'),
      ]);
      if (temp.status === 'fulfilled') setText('val-temp', temp.value.temperature ?? '—');
      if (hum.status === 'fulfilled') setText('val-humidity', hum.value.humidity ?? '—');
      if (dist.status === 'fulfilled') setText('val-distance', dist.value.distance ?? '—');
      if (pcb.status === 'fulfilled') setText('val-pcbtemp', pcb.value['pcb-temp'] ?? '—');
      setText('last-updated', 'Updated ' + new Date().toLocaleTimeString());
    } catch (_) { /* keep stale values */ }
  }

  // ── Light ─────────────────────────────────────────────────────────────────

  async function fetchLightState() {
    try {
      const data = await api('GET', '/light/brightness');
      const brightness = data.value ?? 50;
      document.getElementById('slider-brightness').value = brightness;
      setText('val-brightness', brightness);
      setDot('light-dot', brightness > 0);
    } catch (_) {}
  }

  function initLight() {
    document.getElementById('btn-light-on').addEventListener('click', async () => {
      try {
        await api('POST', '/light/on');
        setDot('light-dot', true);
        showError('light-error', '');
      } catch (e) { showError('light-error', e.message); }
    });

    document.getElementById('btn-light-off').addEventListener('click', async () => {
      try {
        await api('POST', '/light/off');
        setDot('light-dot', false);
        showError('light-error', '');
      } catch (e) { showError('light-error', e.message); }
    });

    const slider = document.getElementById('slider-brightness');
    slider.addEventListener('input', () => setText('val-brightness', slider.value));
    slider.addEventListener('change', async () => {
      try {
        await api('POST', '/light/brightness', { value: Number(slider.value) });
        showError('light-error', '');
      } catch (e) { showError('light-error', e.message); }
    });
  }

  // ── Pump ──────────────────────────────────────────────────────────────────

  let pumpCountdownTimer = null;

  async function fetchPumpState() {
    try {
      const data = await api('GET', '/pump/speed');
      setDot('pump-dot', (data.value ?? 0) > 0);
    } catch (_) {}
  }

  function clearCountdown() {
    if (pumpCountdownTimer) { clearInterval(pumpCountdownTimer); pumpCountdownTimer = null; }
    setText('pump-countdown', '');
  }

  function startCountdown(seconds, onDone) {
    clearCountdown();
    let remaining = seconds;
    const tick = () => {
      if (remaining <= 0) {
        clearCountdown();
        onDone();
        return;
      }
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      setText('pump-countdown', `Auto-off in ${m}:${String(s).padStart(2, '0')}`);
      remaining--;
    };
    tick();
    pumpCountdownTimer = setInterval(tick, 1000);
  }

  function initPump() {
    document.getElementById('btn-pump-on').addEventListener('click', async () => {
      try {
        await api('POST', '/pump/on');
        setDot('pump-dot', true);
        clearCountdown();
        showError('pump-error', '');
      } catch (e) { showError('pump-error', e.message); }
    });

    document.getElementById('btn-pump-off').addEventListener('click', async () => {
      try {
        await api('POST', '/pump/off');
        setDot('pump-dot', false);
        clearCountdown();
        showError('pump-error', '');
      } catch (e) { showError('pump-error', e.message); }
    });

    document.getElementById('btn-pump-run').addEventListener('click', async () => {
      const minutes = Number(document.getElementById('pump-duration').value) || 5;
      try {
        await api('POST', '/pump/on');
        setDot('pump-dot', true);
        showError('pump-error', '');
        startCountdown(minutes * 60, async () => {
          try { await api('POST', '/pump/off'); } catch (_) {}
          setDot('pump-dot', false);
        });
      } catch (e) { showError('pump-error', e.message); }
    });
  }

  // ── Camera ────────────────────────────────────────────────────────────────

  function showImg(imgId, phId, src) {
    const img = document.getElementById(imgId);
    const ph = document.getElementById(phId);
    if (src) {
      img.src = src + '?t=' + Date.now();
      img.style.display = '';
      ph.style.display = 'none';
    } else {
      img.style.display = 'none';
      ph.style.display = '';
    }
  }

  async function fetchLatestPhotos() {
    try {
      const data = await api('GET', '/photos/latest');
      showImg('img-upper', 'ph-upper', data.upper || '');
      showImg('img-lower', 'ph-lower', data.lower || '');
      showError('camera-error', '');
    } catch (e) { showError('camera-error', e.message); }
  }

  async function fetchAlbum() {
    try {
      const data = await api('GET', '/photos');
      document.getElementById('storage-warning').style.display = data.storage_warning ? '' : 'none';
      const album = document.getElementById('album');
      album.innerHTML = '';
      (data.photos || []).forEach(photo => {
        const { filename, timestamp, side } = photo;
        const div = document.createElement('div');
        div.className = 'album-thumb';
        const label = (timestamp ? timestamp.slice(0, 16) + ' ' : '') + (side || '');
        div.innerHTML = `<img src="/photos/${encodeURIComponent(filename)}" alt="${filename}" loading="lazy"><p>${label}</p>`;
        div.querySelector('img').addEventListener('click', () => openLightbox('/photos/' + encodeURIComponent(filename)));
        album.appendChild(div);
      });
      showError('camera-error', '');
    } catch (e) { showError('camera-error', e.message); }
  }

  function initCamera() {
    document.getElementById('btn-refresh-photos').addEventListener('click', fetchLatestPhotos);

    document.getElementById('btn-take-photo').addEventListener('click', async () => {
      const btn = document.getElementById('btn-take-photo');
      btn.disabled = true;
      try {
        const data = await api('POST', '/photos/capture');
        showImg('img-upper', 'ph-upper', data.upper || '');
        showImg('img-lower', 'ph-lower', data.lower || '');
        showError('camera-error', '');
      } catch (e) { showError('camera-error', e.message); }
      finally { btn.disabled = false; }
    });

    document.getElementById('btn-load-album').addEventListener('click', fetchAlbum);
  }

  // ── Lightbox ──────────────────────────────────────────────────────────────

  window.openLightbox = function(src) {
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox').classList.add('open');
  };

  window.closeLightbox = function() {
    document.getElementById('lightbox').classList.remove('open');
    document.getElementById('lightbox-img').src = '';
  };

  // ── Schedule ──────────────────────────────────────────────────────────────

  function makeTimeInput(value) {
    const inp = document.createElement('input');
    inp.type = 'time';
    inp.value = value || '08:00';
    return inp;
  }

  function makeRemoveBtn(onClick) {
    const btn = document.createElement('button');
    btn.className = 'btn-remove';
    btn.textContent = '×';
    btn.addEventListener('click', onClick);
    return btn;
  }

  function addPumpTimeRow(time) {
    const container = document.getElementById('pump-times');
    const row = document.createElement('div');
    row.className = 'schedule-entry';
    const inp = makeTimeInput(time);
    const rm = makeRemoveBtn(() => row.remove());
    row.append(inp, rm);
    container.appendChild(row);
  }

  function addLightEntryRow(entry) {
    const container = document.getElementById('light-entries');
    const row = document.createElement('div');
    row.className = 'schedule-entry';

    const timeInp = makeTimeInput(entry?.time);

    const brightInp = document.createElement('input');
    brightInp.type = 'number';
    brightInp.min = 0;
    brightInp.max = 100;
    brightInp.value = entry?.brightness ?? 70;

    const unit = document.createElement('span');
    unit.className = 'unit';
    unit.textContent = '%';

    const rm = makeRemoveBtn(() => row.remove());
    row.append(timeInp, brightInp, unit, rm);
    container.appendChild(row);
  }

  function readScheduleFromForm() {
    const pumpTimes = [...document.querySelectorAll('#pump-times .schedule-entry')]
      .map(row => row.querySelector('input[type="time"]').value)
      .filter(Boolean);

    const durationEl = document.getElementById('pump-duration-sched');
    const duration = Number(durationEl.value) || 5;

    const lights = [...document.querySelectorAll('#light-entries .schedule-entry')]
      .map(row => ({
        time: row.querySelector('input[type="time"]').value,
        brightness: Number(row.querySelector('input[type="number"]').value),
      }))
      .filter(e => e.time);

    return { pump: { times: pumpTimes, duration_minutes: duration }, lights };
  }

  async function loadSchedule() {
    try {
      const data = await api('GET', '/schedule');
      document.getElementById('pump-times').innerHTML = '';
      document.getElementById('light-entries').innerHTML = '';

      const dur = data.pump?.duration_minutes ?? 5;
      document.getElementById('pump-duration-sched').value = dur;

      (data.pump?.times || []).forEach(t => addPumpTimeRow(t));
      (data.lights || []).forEach(e => addLightEntryRow(e));
    } catch (e) { showError('save-status', 'Load failed: ' + e.message); }
  }

  function initSchedule() {
    document.getElementById('btn-add-pump-time').addEventListener('click', () => addPumpTimeRow(''));
    document.getElementById('btn-add-light-entry').addEventListener('click', () => addLightEntryRow(null));

    document.getElementById('btn-save-schedule').addEventListener('click', async () => {
      const statusEl = document.getElementById('save-status');
      statusEl.textContent = 'Saving…';
      statusEl.className = '';
      try {
        await api('POST', '/schedule', readScheduleFromForm());
        statusEl.textContent = 'Saved';
        statusEl.className = 'save-ok';
      } catch (e) {
        statusEl.textContent = 'Error: ' + e.message;
        statusEl.className = 'save-err';
      }
      setTimeout(() => { statusEl.textContent = ''; statusEl.className = ''; }, 4000);
    });
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
        btn.classList.add('tab-active');
        document.getElementById('tab-' + btn.dataset.tab).style.display = '';
        if (btn.dataset.tab === 'advanced') refreshCharts();
      });
    });
  }

  // ── Advanced: Charts ──────────────────────────────────────────────────────

  let charts = {};
  let activePresetHours = 1;

  const CHART_COLOR = '#5d9c59';
  const CHART_WARN  = '#e67e22';

  function makeChart(canvasId, unit, color) {
    return new Chart(document.getElementById(canvasId), {
      type: 'line',
      data: {
        datasets: [{
          data: [],
          borderColor: color,
          backgroundColor: color + '18',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 1.5,
        }]
      },
      options: {
        responsive: true,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            type: 'time',
            time: { tooltipFormat: 'MMM d, HH:mm' },
            ticks: { color: '#8a9a8a', maxTicksLimit: 8 },
            grid: { color: '#3a4a3a' },
          },
          y: {
            ticks: { color: '#8a9a8a', callback: v => v + ' ' + unit },
            grid: { color: '#3a4a3a' },
          },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  function initCharts() {
    charts.temp     = makeChart('chart-temp',     '°C', CHART_COLOR);
    charts.humidity = makeChart('chart-humidity',  '%',  CHART_COLOR);
    charts.distance = makeChart('chart-distance', 'cm', CHART_COLOR);
    charts.pcbtemp  = makeChart('chart-pcbtemp',  '°C', CHART_WARN);
  }

  async function loadHistory(fromDate, toDate) {
    try {
      showError('history-error', '');
      const from = fromDate.toISOString();
      const to   = toDate.toISOString();
      const data = await api('GET', `/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const readings = data.readings || [];
      const toPoints = key => readings
        .filter(r => r[key] !== null)
        .map(r => ({ x: new Date(r.timestamp), y: r[key] }));

      charts.temp.data.datasets[0].data     = toPoints('temperature');
      charts.humidity.data.datasets[0].data = toPoints('humidity');
      charts.distance.data.datasets[0].data = toPoints('distance');
      charts.pcbtemp.data.datasets[0].data  = toPoints('pcb_temp');
      Object.values(charts).forEach(c => c.update());
    } catch (e) { showError('history-error', 'Failed to load history: ' + e.message); }
  }

  function refreshCharts() {
    const now  = new Date();
    const from = new Date(now - activePresetHours * 3600 * 1000);
    loadHistory(from, now);
  }

  function initAdvanced() {
    // Range preset buttons
    document.querySelectorAll('.range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('range-active'));
        btn.classList.add('range-active');
        activePresetHours = Number(btn.dataset.hours);
        refreshCharts();
      });
    });

    // Custom range apply
    document.getElementById('btn-range-apply').addEventListener('click', () => {
      const fromVal = document.getElementById('range-from').value;
      const toVal   = document.getElementById('range-to').value;
      if (!fromVal || !toVal) return;
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('range-active'));
      loadHistory(new Date(fromVal), new Date(toVal));
    });

    // Sample interval
    api('GET', '/history/interval').then(data => {
      document.getElementById('sample-interval').value = Math.round(data.interval_seconds / 60);
    }).catch(() => {});

    document.getElementById('btn-interval-save').addEventListener('click', async () => {
      const minutes = Number(document.getElementById('sample-interval').value) || 10;
      const statusEl = document.getElementById('interval-status');
      try {
        await api('POST', '/history/interval', { interval_seconds: minutes * 60 });
        statusEl.textContent = 'Saved';
        statusEl.style.color = 'var(--accent)';
      } catch (e) {
        statusEl.textContent = 'Error';
        statusEl.style.color = 'var(--danger)';
      }
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    });

    initCharts();
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  async function init() {
    initTabs();
    initLight();
    initPump();
    initCamera();
    initSchedule();
    initAdvanced();

    await Promise.allSettled([
      fetchSensors(),
      fetchLightState(),
      fetchPumpState(),
      fetchLatestPhotos(),
      loadSchedule(),
    ]);

    setInterval(fetchSensors, 30_000);
    setInterval(fetchLightState, 30_000);
    setInterval(fetchPumpState, 30_000);
  }

  init();
})();
