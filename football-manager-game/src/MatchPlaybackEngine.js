(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  const DEFAULT_DURATION_MINUTES = 90;
  const DEFAULT_TICK_MS = 1000;
  const MAX_SPEED = 30;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function asNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function getResult(matchData) {
    if (!matchData) return {};
    return matchData.result || matchData;
  }

  function normalizeType(type) {
    if (type === "yellowCard") return "yellow-card";
    if (type === "redCard") return "red-card";
    return type || "event";
  }

  function normalizeEvent(event, index, matchData) {
    const result = getResult(matchData);
    const homeTeamId = matchData.homeTeamId || result.homeTeamId;
    const awayTeamId = matchData.awayTeamId || result.awayTeamId;
    const teamId = event.teamId || (event.team === "home" ? homeTeamId : event.team === "away" ? awayTeamId : undefined);
    const minute = clamp(asNumber(event.minute, 0), 0, DEFAULT_DURATION_MINUTES);

    return Object.freeze({
      ...event,
      index,
      minute,
      type: normalizeType(event.type),
      teamId,
      team: event.team || (teamId === homeTeamId ? "home" : teamId === awayTeamId ? "away" : undefined),
      playbackTimeMs: minute * DEFAULT_TICK_MS
    });
  }

  function collectEvents(matchData) {
    const result = getResult(matchData);
    const source = Array.isArray(result.timeline)
      ? result.timeline
      : Array.isArray(result.events)
        ? result.events
        : [];

    return source
      .map((event, index) => normalizeEvent(event, index, matchData || {}))
      .sort((left, right) => left.minute - right.minute || left.index - right.index);
  }

  function createStats(result) {
    const stats = result.stats || {};
    return {
      home: { ...(stats.home || {}) },
      away: { ...(stats.away || {}) }
    };
  }

  class MatchPlaybackEngine {
    constructor(options = {}) {
      this.durationMinutes = clamp(asNumber(options.durationMinutes, DEFAULT_DURATION_MINUTES), 1, 130);
      this.tickMs = clamp(asNumber(options.tickMs, DEFAULT_TICK_MS), 1, 60000);
      this.durationMs = this.durationMinutes * this.tickMs;
      this.speed = clamp(asNumber(options.speed, 1), 0.25, MAX_SPEED);
      this.playing = false;
      this.currentTimeMs = 0;
      this.tickIndex = 0;
      this.eventCursor = 0;
      this.events = [];
      this.emittedEvents = [];
      this.result = {};
      this.matchMeta = {};
      this.listeners = { tick: [], event: [], state: [] };
    }

    load(matchData, options = {}) {
      const result = getResult(matchData);
      this.result = result || {};
      this.matchMeta = {
        homeTeamId: matchData?.homeTeamId || result.homeTeamId,
        awayTeamId: matchData?.awayTeamId || result.awayTeamId,
        seed: matchData?.seed || result.seed
      };
      this.events = collectEvents(matchData || {});
      this.currentTimeMs = this._minuteToTime(asNumber(options.minute, matchData?.minute || 0));
      this.tickIndex = asNumber(options.tickIndex, 0);
      this.eventCursor = this._cursorForTime(this.currentTimeMs);
      this.emittedEvents = [];
      this.playing = Boolean(options.playing);
      this._emit("state", this.getSnapshot());
      return this.getSnapshot();
    }

    sync(matchData) {
      const previousTime = this.currentTimeMs;
      const result = getResult(matchData);
      this.result = result || {};
      this.matchMeta = {
        homeTeamId: matchData?.homeTeamId || result.homeTeamId || this.matchMeta.homeTeamId,
        awayTeamId: matchData?.awayTeamId || result.awayTeamId || this.matchMeta.awayTeamId,
        seed: matchData?.seed || result.seed || this.matchMeta.seed
      };
      this.events = collectEvents(matchData || {});
      if (Number.isFinite(matchData?.minute)) {
        this.currentTimeMs = this._minuteToTime(matchData.minute);
      }
      this._emitEventsBetween(previousTime, this.currentTimeMs);
      this._emit("state", this.getSnapshot());
      return this.getSnapshot();
    }

    play() {
      this.playing = true;
      this._emit("state", this.getSnapshot());
      return this.getSnapshot();
    }

    pause() {
      this.playing = false;
      this._emit("state", this.getSnapshot());
      return this.getSnapshot();
    }

    toggle() {
      return this.playing ? this.pause() : this.play();
    }

    setSpeed(speed) {
      this.speed = clamp(asNumber(speed, this.speed), 0.25, MAX_SPEED);
      this._emit("state", this.getSnapshot());
      return this.speed;
    }

    tick(deltaMs = this.tickMs) {
      if (!this.playing) return this.getSnapshot();
      return this.advance(deltaMs * this.speed);
    }

    step(ticks = 1) {
      return this.advance(this.tickMs * clamp(asNumber(ticks, 1), 1, 100) * this.speed);
    }

    advance(deltaMs) {
      const previousTime = this.currentTimeMs;
      const nextTime = clamp(previousTime + Math.max(0, asNumber(deltaMs, 0)), 0, this.durationMs);
      this.currentTimeMs = nextTime;
      this.tickIndex += 1;
      this._emitEventsBetween(previousTime, nextTime);
      if (nextTime >= this.durationMs) this.playing = false;
      const snapshot = this.getSnapshot();
      this._emit("tick", snapshot);
      this._emit("state", snapshot);
      return snapshot;
    }

    seekToMinute(minute, options = {}) {
      return this.seek(this._minuteToTime(minute), options);
    }

    seek(timeMs, options = {}) {
      const previousTime = this.currentTimeMs;
      this.currentTimeMs = clamp(asNumber(timeMs, 0), 0, this.durationMs);
      this.eventCursor = this._cursorForTime(this.currentTimeMs);
      if (options.emitEvents) {
        this._emitEventsBetween(previousTime, this.currentTimeMs);
      }
      const snapshot = this.getSnapshot();
      this._emit("state", snapshot);
      return snapshot;
    }

    snapshot() {
      return {
        playback: {
          durationMinutes: this.durationMinutes,
          tickMs: this.tickMs,
          speed: this.speed,
          playing: this.playing,
          currentTimeMs: this.currentTimeMs,
          tickIndex: this.tickIndex,
          eventCursor: this.eventCursor
        },
        matchMeta: { ...this.matchMeta },
        result: this.result,
        events: this.events.map((event) => ({ ...event }))
      };
    }

    restore(snapshot) {
      if (!snapshot || !snapshot.playback) {
        throw new Error("MatchPlaybackEngine snapshot required");
      }
      const playback = snapshot.playback;
      this.durationMinutes = clamp(asNumber(playback.durationMinutes, DEFAULT_DURATION_MINUTES), 1, 130);
      this.tickMs = clamp(asNumber(playback.tickMs, DEFAULT_TICK_MS), 1, 60000);
      this.durationMs = this.durationMinutes * this.tickMs;
      this.speed = clamp(asNumber(playback.speed, 1), 0.25, MAX_SPEED);
      this.playing = Boolean(playback.playing);
      this.currentTimeMs = clamp(asNumber(playback.currentTimeMs, 0), 0, this.durationMs);
      this.tickIndex = asNumber(playback.tickIndex, 0);
      this.eventCursor = asNumber(playback.eventCursor, this._cursorForTime(this.currentTimeMs));
      this.matchMeta = { ...(snapshot.matchMeta || {}) };
      this.result = snapshot.result || {};
      this.events = Array.isArray(snapshot.events)
        ? snapshot.events.map((event, index) => Object.freeze({ ...event, index: event.index ?? index }))
        : collectEvents(this.result);
      this.emittedEvents = [];
      this._emit("state", this.getSnapshot());
      return this.getSnapshot();
    }

    drainEvents() {
      const events = this.emittedEvents.slice();
      this.emittedEvents.length = 0;
      return events;
    }

    on(type, listener) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(listener);
      return () => {
        this.listeners[type] = this.listeners[type].filter((item) => item !== listener);
      };
    }

    getSnapshot() {
      const minute = clamp(Math.floor(this.currentTimeMs / this.tickMs), 0, this.durationMinutes);
      const score = this._scoreAtMinute(minute);
      const possession = this._possessionAtMinute(minute);
      const nextEvent = this.events[this.eventCursor] || null;
      const lastEvent = this.events[this._cursorForTime(this.currentTimeMs) - 1] || null;

      return Object.freeze({
        playing: this.playing,
        speed: this.speed,
        tickIndex: this.tickIndex,
        currentTimeMs: this.currentTimeMs,
        durationMs: this.durationMs,
        minute,
        progress: this.durationMs ? this.currentTimeMs / this.durationMs : 0,
        homeGoals: score.home,
        awayGoals: score.away,
        possession,
        nextEvent,
        lastEvent,
        eventCursor: this.eventCursor,
        eventsPlayed: this.eventCursor,
        eventsTotal: this.events.length,
        homeTeamId: this.matchMeta.homeTeamId,
        awayTeamId: this.matchMeta.awayTeamId,
        seed: this.matchMeta.seed
      });
    }

    _minuteToTime(minute) {
      return clamp(asNumber(minute, 0), 0, this.durationMinutes) * this.tickMs;
    }

    _cursorForTime(timeMs) {
      const minute = timeMs / this.tickMs;
      let cursor = 0;
      while (cursor < this.events.length && this.events[cursor].minute <= minute) {
        cursor += 1;
      }
      return cursor;
    }

    _emitEventsBetween(previousTime, nextTime) {
      if (nextTime < previousTime) {
        this.eventCursor = this._cursorForTime(nextTime);
        return;
      }

      const nextMinute = nextTime / this.tickMs;
      while (this.eventCursor < this.events.length && this.events[this.eventCursor].minute <= nextMinute) {
        const event = this.events[this.eventCursor];
        this.eventCursor += 1;
        this.emittedEvents.push(event);
        this._emit("event", event);
      }
    }

    _scoreAtMinute(minute) {
      let home = 0;
      let away = 0;
      for (let index = 0; index < this.events.length; index += 1) {
        const event = this.events[index];
        if (event.minute > minute) break;
        if (event.type !== "goal") continue;
        if (event.team === "home" || event.teamId === this.matchMeta.homeTeamId) home += 1;
        if (event.team === "away" || event.teamId === this.matchMeta.awayTeamId) away += 1;
      }
      return {
        home: home || (minute >= this.durationMinutes ? asNumber(this.result.homeGoals, 0) : home),
        away: away || (minute >= this.durationMinutes ? asNumber(this.result.awayGoals, 0) : away)
      };
    }

    _possessionAtMinute() {
      const stats = createStats(this.result);
      return asNumber(stats.home.possession, 50);
    }

    _emit(type, payload) {
      const listeners = this.listeners[type] || [];
      for (let index = 0; index < listeners.length; index += 1) {
        listeners[index](payload);
      }
    }
  }

  class MatchPlaybackCanvasLayer {
    constructor(container, engine, options = {}) {
      if (!container) throw new Error("Playback container required");
      if (!engine || typeof engine.getSnapshot !== "function") {
        throw new Error("MatchPlaybackEngine required");
      }
      this.container = container;
      this.engine = engine;
      this.options = options;
      this.canvas = document.createElement("canvas");
      this.canvas.width = options.width || 960;
      this.canvas.height = options.height || 540;
      this.canvas.className = options.className || "match-playback-canvas";
      this.context = this.canvas.getContext("2d");
      this.pitchRenderer = FMG.TacticalPitchRenderer ? new FMG.TacticalPitchRenderer() : null;
      this.unsubscribe = [
        this.engine.on("state", (snapshot) => this.render(snapshot)),
        this.engine.on("event", (event) => {
          this.lastEvent = event;
          this.render(this.engine.getSnapshot());
        })
      ];
      container.appendChild(this.canvas);
      this.render(this.engine.getSnapshot());
    }

    render(snapshot = this.engine.getSnapshot()) {
      const ctx = this.context;
      const width = this.canvas.width;
      const height = this.canvas.height;
      const pitchRatio = 105 / 68;
      const marginX = 44;
      const topHud = 58;
      const availableW = width - marginX * 2;
      const availableH = height - topHud - 42;
      let pitchW = availableW;
      let pitchH = pitchW / pitchRatio;
      if (pitchH > availableH) {
        pitchH = availableH;
        pitchW = pitchH * pitchRatio;
      }
      const bounds = {
        x: (width - pitchW) / 2,
        y: topHud + (availableH - pitchH) / 2,
        width: pitchW,
        height: pitchH
      };

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#07130f";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#0b2118";
      ctx.fillRect(0, 0, width, 50);

      if (this.pitchRenderer) {
        this.pitchRenderer.draw(ctx, bounds);
      } else {
        ctx.fillStyle = "#14583a";
        ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
        ctx.strokeStyle = "rgba(255,255,255,0.82)";
        ctx.lineWidth = 3;
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      }

      this._drawPlayers(ctx, bounds);
      this._drawBall(ctx, snapshot, bounds);

      ctx.fillStyle = "#f7f7f2";
      ctx.font = "700 28px system-ui, sans-serif";
      ctx.fillText(`${snapshot.homeGoals} - ${snapshot.awayGoals}`, 42, 38);
      ctx.font = "500 18px system-ui, sans-serif";
      ctx.fillText(`${snapshot.minute}'`, width - 82, 36);
      ctx.fillText(`${Math.round(snapshot.possession)}%`, width / 2 - 20, 36);

      if (this.lastEvent) {
        ctx.font = "500 16px system-ui, sans-serif";
        ctx.fillText(`${this.lastEvent.minute}' ${this.lastEvent.text || this.lastEvent.type}`, 42, height - 22);
      }
    }

    dispose() {
      this.unsubscribe.forEach((unsubscribe) => unsubscribe());
      this.unsubscribe = [];
      if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
      this.canvas = null;
      this.context = null;
    }

    _drawPlayers(ctx, bounds) {
      const homeRows = [0.13, 0.28, 0.45, 0.63];
      const awayRows = [0.87, 0.72, 0.55, 0.37];
      this._drawTeam(ctx, bounds, homeRows, "#f5f5f5", "#111111");
      this._drawTeam(ctx, bounds, awayRows, "#1656a6", "#ffffff");
    }

    _drawTeam(ctx, bounds, rows, fill, stroke) {
      const rowCounts = [1, 4, 3, 3];
      rows.forEach((row, rowIndex) => {
        const count = rowCounts[rowIndex];
        for (let index = 0; index < count; index += 1) {
          const fieldPoint = {
            x: ((index + 1) / (count + 1)) * 105 - 52.5,
            z: row * 68 - 34
          };
          const point = this._toScreen(fieldPoint, bounds);
          ctx.beginPath();
          ctx.fillStyle = fill;
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 2;
          ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      });
    }

    _drawBall(ctx, snapshot, bounds) {
      const event = snapshot.lastEvent || snapshot.nextEvent;
      const direction = event && (event.team === "away" || event.teamId === snapshot.awayTeamId) ? -1 : 1;
      const progress = event ? (event.minute % 10) / 10 : snapshot.progress;
      const fieldPoint = {
        x: clamp(direction * (progress - 0.5) * 76, -46, 46),
        z: Math.sin((snapshot.tickIndex + progress) * 0.8) * 13
      };
      const point = this._toScreen(fieldPoint, bounds);
      ctx.beginPath();
      ctx.fillStyle = "#fff6d6";
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 2;
      ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    _toScreen(point, bounds) {
      if (this.pitchRenderer) return this.pitchRenderer.toScreen(point, bounds);
      return {
        x: bounds.x + ((point.x + 52.5) / 105) * bounds.width,
        y: bounds.y + ((point.z + 34) / 68) * bounds.height
      };
    }
  }

  FMG.MatchPlaybackEngine = MatchPlaybackEngine;
  FMG.MatchPlaybackCanvasLayer = MatchPlaybackCanvasLayer;
  FMG.createMatchPlaybackDevView = function (container, matchData, options = {}) {
    const engine = new MatchPlaybackEngine(options);
    const layer = new MatchPlaybackCanvasLayer(container, engine, options);
    let frameId = 0;
    let disposed = false;

    engine.load(matchData, {
      minute: options.minute || matchData?.minute || 0,
      playing: Boolean(options.playing)
    });

    function loop() {
      if (disposed) return;
      if (engine.playing) engine.tick(options.frameTickMs || engine.tickMs);
      if (typeof window.requestAnimationFrame === "function") {
        frameId = window.requestAnimationFrame(loop);
      }
    }

    if (options.autoLoop !== false && typeof window.requestAnimationFrame === "function") {
      frameId = window.requestAnimationFrame(loop);
    }

    return {
      engine,
      layer,
      play: () => engine.play(),
      pause: () => engine.pause(),
      setSpeed: (speed) => engine.setSpeed(speed),
      seekToMinute: (minute) => engine.seekToMinute(minute),
      dispose: () => {
        disposed = true;
        if (frameId && typeof window.cancelAnimationFrame === "function") {
          window.cancelAnimationFrame(frameId);
        }
        layer.dispose();
      }
    };
  };
})();
