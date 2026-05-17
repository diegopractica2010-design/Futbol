(function () {
  "use strict";

  var FMG = window.FMG = window.FMG || {};
  FMG.Performance = FMG.Performance || {};
  FMG._deterministicClock = FMG._deterministicClock || {
    epochMs: Date.UTC(2025, 0, 1, 12, 0, 0),
    tickMs: 60000,
    tickIndex: 0
  };
  FMG._fallbackRngState = FMG._fallbackRngState || 1;

  if (!FMG.rng) {
    FMG.rng = function () {
      FMG._fallbackRngState = (FMG._fallbackRngState + 0x6D2B79F5) >>> 0;
      var t = FMG._fallbackRngState;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  FMG.randomFloat = FMG.randomFloat || function () {
    return FMG.rng();
  };
  FMG.nowMs = FMG.nowMs || function () {
    return FMG._deterministicClock.epochMs + FMG._deterministicClock.tickIndex * FMG._deterministicClock.tickMs;
  };
  FMG.tickMs = FMG.tickMs || function () {
    FMG._deterministicClock.tickIndex += 1;
    return FMG.nowMs();
  };
  FMG.nowISO = FMG.nowISO || function () {
    return new Date(FMG.tickMs()).toISOString();
  };

  function nowMs() {
    if (typeof performance !== "undefined" && performance.now) return performance.now();
    return FMG.nowMs();
  }

  function Profiler(options) {
    options = options || {};
    this.enabled = options.enabled !== false;
    this.sampleWindow = options.sampleWindow || 60;
    this.frame = 0;
    this.lastFrameMs = 0;
    this.avgFrameMs = 0;
    this.maxFrameMs = 0;
    this.droppedFrames = 0;
    this.sections = {};
    this._open = {};
    this._frameStart = 0;
  }

  Profiler.prototype.beginFrame = function () {
    if (!this.enabled) return;
    this._frameStart = nowMs();
  };

  Profiler.prototype.endFrame = function () {
    if (!this.enabled) return;
    var dt = nowMs() - this._frameStart;
    this.lastFrameMs = dt;
    this.frame++;
    this.avgFrameMs += (dt - this.avgFrameMs) / Math.min(this.frame, this.sampleWindow);
    this.maxFrameMs = Math.max(this.maxFrameMs * 0.985, dt);
    if (dt > 19) this.droppedFrames++;
  };

  Profiler.prototype.begin = function (name) {
    if (!this.enabled) return;
    this._open[name] = nowMs();
  };

  Profiler.prototype.end = function (name) {
    if (!this.enabled || this._open[name] === undefined) return;
    var elapsed = nowMs() - this._open[name];
    var section = this.sections[name] || (this.sections[name] = { lastMs: 0, avgMs: 0, maxMs: 0, calls: 0 });
    section.lastMs = elapsed;
    section.calls++;
    section.avgMs += (elapsed - section.avgMs) / Math.min(section.calls, this.sampleWindow);
    section.maxMs = Math.max(section.maxMs * 0.985, elapsed);
    delete this._open[name];
  };

  Profiler.prototype.snapshot = function () {
    return {
      frame: this.frame,
      lastFrameMs: round2(this.lastFrameMs),
      avgFrameMs: round2(this.avgFrameMs),
      maxFrameMs: round2(this.maxFrameMs),
      fps: this.avgFrameMs > 0 ? Math.round(1000 / this.avgFrameMs) : 0,
      droppedFrames: this.droppedFrames,
      sections: this.sections
    };
  };

  function ObjectPool(factory, reset, initialSize, maxSize) {
    this._factory = factory;
    this._reset = reset || null;
    this._items = [];
    this._maxSize = maxSize || 2048;
    this.created = 0;
    this.reused = 0;

    for (var i = 0; i < (initialSize || 0); i++) {
      this._items.push(this._create());
    }
  }

  ObjectPool.prototype._create = function () {
    this.created++;
    return this._factory();
  };

  ObjectPool.prototype.acquire = function () {
    if (this._items.length) {
      this.reused++;
      return this._items.pop();
    }
    return this._create();
  };

  ObjectPool.prototype.release = function (item) {
    if (!item || this._items.length >= this._maxSize) return false;
    if (this._reset) this._reset(item);
    this._items.push(item);
    return true;
  };

  ObjectPool.prototype.size = function () {
    return this._items.length;
  };

  function RenderOptimizer() {
    this.enabled = true;
    this.margin = 64;
    this.view = { x: 0, y: 0, w: 99999, h: 99999 };
    this.culled = 0;
    this.drawn = 0;
  }

  RenderOptimizer.prototype.beginFrame = function (canvas, cameraState, fieldW, fieldH) {
    this.culled = 0;
    this.drawn = 0;
    if (!this.enabled || !canvas || !cameraState) {
      this.view.x = -this.margin;
      this.view.y = -this.margin;
      this.view.w = (fieldW || canvas.width || 0) + this.margin * 2;
      this.view.h = (fieldH || canvas.height || 0) + this.margin * 2;
      return;
    }

    var zoom = cameraState.zoom || 1;
    var halfW = (canvas.width || fieldW || 0) / (2 * zoom);
    var halfH = (canvas.height || fieldH || 0) / (2 * zoom);
    var cx = (cameraState.x || fieldW / 2 || 0) + (cameraState.shakeX || 0);
    var cy = (cameraState.y || fieldH / 2 || 0) + (cameraState.shakeY || 0);
    this.view.x = cx - halfW - this.margin;
    this.view.y = cy - halfH - this.margin;
    this.view.w = halfW * 2 + this.margin * 2;
    this.view.h = halfH * 2 + this.margin * 2;
  };

  RenderOptimizer.prototype.shouldDrawWorld = function (x, y, radius) {
    if (!this.enabled) return true;
    radius = radius || 0;
    var v = this.view;
    var visible = x + radius >= v.x && x - radius <= v.x + v.w && y + radius >= v.y && y - radius <= v.y + v.h;
    if (visible) this.drawn++;
    else this.culled++;
    return visible;
  };

  RenderOptimizer.prototype.drawSimplePlayers = function (ctx, players, controlled, radius, colors) {
    if (!players || !players.length) return;
    var team = players[0] ? players[0].team : 0;
    ctx.fillStyle = colors && colors[team] ? colors[team] : "#ffffff";
    ctx.beginPath();
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      if (!this.shouldDrawWorld(p.x, p.y, radius + 6)) continue;
      ctx.moveTo(p.x + radius, p.y);
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    }
    ctx.fill();

    if (controlled && this.shouldDrawWorld(controlled.x, controlled.y, radius + 8)) {
      ctx.strokeStyle = "#f0c040";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(controlled.x, controlled.y, radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  FMG.Performance.Profiler = Profiler;
  FMG.Performance.ObjectPool = ObjectPool;
  FMG.Performance.RenderOptimizer = RenderOptimizer;
})();
