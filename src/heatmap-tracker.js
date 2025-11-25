/**
 * Lightweight pointer dwell-time heatmap for any container.
 * Session-aware (each start/stop/new run is a session) with raw traces.
 * Stays isolated from the rest of the visualization code.
 */
class HeatmapTracker {
  constructor({
    container,
    listenTo = container,
    cellSize = 28,
    paintIntervalMs = 120,
    maxAlpha = 0.85
  } = {}) {
    if (!container || !listenTo) {
      throw new Error('HeatmapTracker requires container and listenTo elements.');
    }
    this.container = container;
    this.listenTo = listenTo;
    this.cellSize = cellSize;
    this.paintIntervalMs = paintIntervalMs;
    this.maxAlpha = maxAlpha;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'heatmap-overlay';
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      mixBlendMode: 'multiply',
      opacity: '0.7',
      zIndex: '10',
      display: 'none'
    });
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.pointer = null;
    this.lastTs = null;
    this.rafId = null;
    this.paintTimer = null;
    this.isRunning = false;
    this.isVisible = false;

    this.sessions = [];
    this.currentSessionIndex = null;

    this._handleMove = this._handleMove.bind(this);
    this._handleLeave = this._handleLeave.bind(this);
    this._frame = this._frame.bind(this);
    this._attachListeners = this._attachListeners.bind(this);
    this._detachListeners = this._detachListeners.bind(this);

    this._setupResizeObserver();
  }

  _setupResizeObserver() {
    const resize = () => this._fitCanvas();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(resize);
      this.resizeObserver.observe(this.container);
    } else {
      this._fallbackResizeHandler = resize;
      window.addEventListener('resize', resize);
    }
    resize();
  }

  _fitCanvas() {
    const rect = this.container.getBoundingClientRect();
    const docEl = document.documentElement || {};
    const width = Math.max(
      rect.width,
      this.container.scrollWidth || 0,
      docEl.scrollWidth || 0
    );
    const height = Math.max(
      rect.height,
      this.container.scrollHeight || 0,
      docEl.scrollHeight || 0
    );
    if (width === 0 || height === 0) return;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  _binKey(x, y) {
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    return `${gx},${gy}`;
  }

  _currentSession() {
    if (this.currentSessionIndex === null) return null;
    return this.sessions[this.currentSessionIndex] || null;
  }

  _ensureSession() {
    if (this._currentSession()) return this._currentSession();
    return this._createSession();
  }

  _createSession() {
    const session = {
      id: this.sessions.length + 1,
      startedAt: Date.now(),
      endedAt: null,
      bins: new Map(), // "gx,gy" -> ms
      traces: [] // {t, x, y}
    };
    this.sessions.push(session);
    this.currentSessionIndex = this.sessions.length - 1;
    this.pointer = null;
    this.lastTs = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    return session;
  }

  _attachListeners() {
    this.listenTo.addEventListener('pointermove', this._handleMove);
    this.listenTo.addEventListener('pointerleave', this._handleLeave);
    this.listenTo.addEventListener('pointerdown', this._handleMove);
  }

  _detachListeners() {
    this.listenTo.removeEventListener('pointermove', this._handleMove);
    this.listenTo.removeEventListener('pointerleave', this._handleLeave);
    this.listenTo.removeEventListener('pointerdown', this._handleMove);
  }

  _handleMove(e) {
    const session = this._currentSession();
    if (!session) return;
    const rect = this.container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = performance.now();

    // Log raw trace point
    session.traces.push({ t: now, x, y });

    // Update dwell tracking
    this.pointer = { x, y };
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this._frame);
    }
  }

  _handleLeave() {
    this.pointer = null;
    this.lastTs = null;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  _frame(ts) {
    const session = this._currentSession();
    if (this.pointer && session) {
      if (this.lastTs === null) {
        this.lastTs = ts;
      } else {
        const dt = ts - this.lastTs;
        const key = this._binKey(this.pointer.x, this.pointer.y);
        session.bins.set(key, (session.bins.get(key) || 0) + dt);
        this.lastTs = ts;
      }
      this.rafId = requestAnimationFrame(this._frame);
    } else {
      this.lastTs = null;
      this.rafId = null;
    }
  }

  _paint() {
    if (this.canvas.style.display === 'none') return;
    const session = this._currentSession();
    if (!session) return;
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    ctx.clearRect(0, 0, width, height);

    let max = 0;
    session.bins.forEach(v => { if (v > max) max = v; });
    if (max === 0) return;

    const cell = this.cellSize;
    session.bins.forEach((value, key) => {
      const [gx, gy] = key.split(',').map(Number);
      const alpha = Math.min(this.maxAlpha, (value / max) * this.maxAlpha);
      ctx.fillStyle = `rgba(255, 69, 0, ${alpha})`;
      ctx.fillRect(gx * cell, gy * cell, cell, cell);
    });
  }

  startSession() {
    if (this.isRunning) return this._currentSession();
    const session = this._ensureSession();
    session.endedAt = null;
    this.isRunning = true;
    this._attachListeners();
    this.paintTimer = window.setInterval(() => this._paint(), this.paintIntervalMs);
    return session;
  }

  stopSession() {
    if (!this.isRunning) return this._currentSession();
    this.isRunning = false;
    this._detachListeners();
    clearInterval(this.paintTimer);
    this._handleLeave();
    const session = this._currentSession();
    if (session && !session.endedAt) {
      session.endedAt = Date.now();
    }
    return session;
  }

  newSession({ autoStart = false } = {}) {
    const wasRunning = this.isRunning;
    this.stopSession();
    const session = this._createSession();
    const shouldStart = autoStart || wasRunning;
    if (shouldStart) {
      this.startSession();
    }
    return session;
  }

  setVisible(isVisible) {
    this.isVisible = isVisible;
    this.canvas.style.display = isVisible ? 'block' : 'none';
    if (isVisible) this._paint();
  }

  clearCurrentSession() {
    const session = this._currentSession();
    if (!session) return;
    session.bins.clear();
    session.traces.length = 0;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  _exportSession(session) {
    return {
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      bins: Array.from(session.bins.entries()).map(([key, ms]) => {
        const [gx, gy] = key.split(',').map(Number);
        return { gx, gy, ms };
      }),
      traces: session.traces.map(pt => ({ t: pt.t, x: pt.x, y: pt.y }))
    };
  }

  exportSessions() {
    return {
      cellSize: this.cellSize,
      sessions: this.sessions.map(s => this._exportSession(s))
    };
  }

  downloadAll(filename = 'heatmap-sessions.json') {
    const data = this.exportSessions();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  destroy() {
    this.stopSession();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this._fallbackResizeHandler) {
      window.removeEventListener('resize', this._fallbackResizeHandler);
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

function setupHeatmapControls(tracker) {
  const startBtn = document.getElementById('heatmapStart');
  const toggleBtn = document.getElementById('heatmapToggle');
  const exportBtn = document.getElementById('heatmapExport');
  const statusEl = document.getElementById('heatmapStatus');
  if (!tracker || !startBtn || !toggleBtn || !exportBtn) return;

  function updateStatus() {
    if (!statusEl) return;
    const session = tracker._currentSession();
    const sessionId = session ? session.id : (tracker.sessions.length + 1);
    const totalMs = session ? [...session.bins.values()].reduce((a, b) => a + b, 0) : 0;
    const seconds = Math.round(totalMs / 100) / 10;
    const mode = tracker.isRunning ? 'Recording' : 'Stopped';
    const overlay = tracker.isVisible ? 'heatmap visible' : 'overlay hidden';
    statusEl.textContent = `Session ${sessionId} · ${mode} · ${overlay} · ${seconds}s this session`;
  }

  startBtn.addEventListener('click', () => {
    // Each click starts a fresh session; if one is running, roll to a new one.
    tracker.newSession({ autoStart: true });
    startBtn.textContent = 'Start';
    updateStatus();
  });

  toggleBtn.addEventListener('click', () => {
    tracker.setVisible(!tracker.isVisible);
    toggleBtn.textContent = tracker.isVisible ? 'Hide Heatmap' : 'Show Heatmap';
    updateStatus();
  });

  exportBtn.addEventListener('click', () => {
    tracker.downloadAll();
    updateStatus();
  });

  tracker.setVisible(false);
  startBtn.textContent = 'Start';
  updateStatus();
}

export { HeatmapTracker, setupHeatmapControls };
