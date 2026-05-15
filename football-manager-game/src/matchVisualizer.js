(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  const FIELD_WIDTH = 105;
  const FIELD_HEIGHT = 68;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function colorToCss(color, fallback) {
    if (typeof color === "number") {
      return `#${color.toString(16).padStart(6, "0")}`;
    }
    return color || fallback;
  }

  function makePosition(x = 0, y = 0, z = 0) {
    return {
      x,
      y,
      z,
      set(nextX, nextY, nextZ) {
        this.x = Number(nextX) || 0;
        this.y = Number(nextY) || 0;
        this.z = Number(nextZ) || 0;
        return this;
      },
      copy(source) {
        this.x = Number(source?.x) || 0;
        this.y = Number(source?.y) || 0;
        this.z = Number(source?.z) || 0;
        return this;
      }
    };
  }

  class TacticalPitchRenderer {
    constructor(options = {}) {
      this.options = {
        lineColor: "rgba(242, 247, 239, 0.9)",
        pitchColor: "#14583a",
        pitchAltColor: "#176541",
        borderColor: "#0a2b1d",
        ...options
      };
      this._pitch = null;
      this._signature = "";
    }

    draw(ctx, bounds) {
      const signature = `${Math.round(bounds.x)},${Math.round(bounds.y)},${Math.round(bounds.width)},${Math.round(bounds.height)}`;
      if (!this._pitch || this._signature !== signature) {
        this._pitch = this._createPitchBitmap(bounds);
        this._signature = signature;
      }
      ctx.drawImage(this._pitch, bounds.x, bounds.y, bounds.width, bounds.height);
    }

    toScreen(point, bounds) {
      const nx = clamp(((Number(point?.x) || 0) + FIELD_WIDTH / 2) / FIELD_WIDTH, 0, 1);
      const ny = clamp(((Number(point?.z) || 0) + FIELD_HEIGHT / 2) / FIELD_HEIGHT, 0, 1);
      return {
        x: bounds.x + nx * bounds.width,
        y: bounds.y + ny * bounds.height
      };
    }

    fromScreen(point, bounds) {
      const nx = clamp((point.x - bounds.x) / bounds.width, 0, 1);
      const ny = clamp((point.y - bounds.y) / bounds.height, 0, 1);
      return {
        x: nx * FIELD_WIDTH - FIELD_WIDTH / 2,
        y: 0,
        z: ny * FIELD_HEIGHT - FIELD_HEIGHT / 2
      };
    }

    _createPitchBitmap(bounds) {
      const canvas = document.createElement("canvas");
      const scale = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = Math.max(1, Math.round(bounds.width * scale));
      canvas.height = Math.max(1, Math.round(bounds.height * scale));

      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      this._drawPitch(ctx, bounds.width, bounds.height);
      return canvas;
    }

    _drawPitch(ctx, width, height) {
      const line = this.options.lineColor;
      const meterX = width / FIELD_WIDTH;
      const meterY = height / FIELD_HEIGHT;
      const map = (x, z) => ({
        x: (x + FIELD_WIDTH / 2) * meterX,
        y: (z + FIELD_HEIGHT / 2) * meterY
      });

      ctx.fillStyle = this.options.borderColor;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.beginPath();
      this._roundRect(ctx, 0, 0, width, height, 12);
      ctx.clip();

      ctx.fillStyle = this.options.pitchColor;
      ctx.fillRect(0, 0, width, height);
      for (let index = 0; index < 12; index += 1) {
        ctx.fillStyle = index % 2 === 0 ? this.options.pitchAltColor : "rgba(255,255,255,0.018)";
        ctx.fillRect(index * width / 12, 0, width / 12, height);
      }

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      for (let index = 1; index < 12; index += 1) {
        const x = index * width / 12;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      ctx.strokeStyle = line;
      ctx.lineWidth = Math.max(2, Math.min(width, height) * 0.006);
      ctx.lineJoin = "round";
      ctx.strokeRect(1.5, 1.5, width - 3, height - 3);

      const mid = map(0, 0);
      ctx.beginPath();
      ctx.moveTo(mid.x, 0);
      ctx.lineTo(mid.x, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(mid.x, mid.y, 9.15 * meterX, 0, Math.PI * 2);
      ctx.stroke();
      this._spot(ctx, mid.x, mid.y, width);

      this._drawPenaltyArea(ctx, map, meterX, meterY, -FIELD_WIDTH / 2, 1);
      this._drawPenaltyArea(ctx, map, meterX, meterY, FIELD_WIDTH / 2, -1);
      this._drawGoals(ctx, map, meterX, meterY);
      this._drawCornerArcs(ctx, width, height, 1.5 * Math.min(meterX, meterY));

      ctx.restore();
    }

    _drawPenaltyArea(ctx, map, meterX, meterY, goalX, direction) {
      const areaDepth = 16.5;
      const areaWidth = 40.32;
      const sixDepth = 5.5;
      const sixWidth = 18.32;
      const areaLeft = goalX;
      const areaRight = goalX + direction * areaDepth;
      const boxTop = -areaWidth / 2;
      const boxBottom = areaWidth / 2;
      const sixRight = goalX + direction * sixDepth;
      const sixTop = -sixWidth / 2;
      const sixBottom = sixWidth / 2;

      this._strokeFieldRect(ctx, map, areaLeft, boxTop, areaRight, boxBottom);
      this._strokeFieldRect(ctx, map, areaLeft, sixTop, sixRight, sixBottom);

      const penalty = map(goalX + direction * 11, 0);
      this._spot(ctx, penalty.x, penalty.y, meterX * FIELD_WIDTH);

      ctx.beginPath();
      if (direction > 0) {
        ctx.arc(penalty.x, penalty.y, 9.15 * meterX, -Math.PI * 0.36, Math.PI * 0.36);
      } else {
        ctx.arc(penalty.x, penalty.y, 9.15 * meterX, Math.PI * 0.64, Math.PI * 1.36);
      }
      ctx.stroke();
    }

    _drawGoals(ctx, map, meterX) {
      ctx.save();
      ctx.strokeStyle = "rgba(245,248,242,0.92)";
      ctx.lineWidth = Math.max(2, meterX * 0.8);
      const leftTop = map(-FIELD_WIDTH / 2, -3.66);
      const leftBottom = map(-FIELD_WIDTH / 2, 3.66);
      const rightTop = map(FIELD_WIDTH / 2, -3.66);
      const rightBottom = map(FIELD_WIDTH / 2, 3.66);

      ctx.beginPath();
      ctx.moveTo(leftTop.x, leftTop.y);
      ctx.lineTo(leftTop.x - 8 * meterX, leftTop.y);
      ctx.lineTo(leftBottom.x - 8 * meterX, leftBottom.y);
      ctx.lineTo(leftBottom.x, leftBottom.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rightTop.x, rightTop.y);
      ctx.lineTo(rightTop.x + 8 * meterX, rightTop.y);
      ctx.lineTo(rightBottom.x + 8 * meterX, rightBottom.y);
      ctx.lineTo(rightBottom.x, rightBottom.y);
      ctx.stroke();
      ctx.restore();
    }

    _drawCornerArcs(ctx, width, height, radius) {
      const corners = [
        [0, 0, 0, Math.PI * 0.5],
        [width, 0, Math.PI * 0.5, Math.PI],
        [width, height, Math.PI, Math.PI * 1.5],
        [0, height, Math.PI * 1.5, Math.PI * 2]
      ];
      corners.forEach(([x, y, start, end]) => {
        ctx.beginPath();
        ctx.arc(x, y, radius, start, end);
        ctx.stroke();
      });
    }

    _strokeFieldRect(ctx, map, x1, z1, x2, z2) {
      const a = map(Math.min(x1, x2), Math.min(z1, z2));
      const b = map(Math.max(x1, x2), Math.max(z1, z2));
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }

    _spot(ctx, x, y, width) {
      ctx.save();
      ctx.fillStyle = this.options.lineColor;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2.2, width * 0.004), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    _roundRect(ctx, x, y, width, height, radius) {
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + width, y, x + width, y + height, radius);
      ctx.arcTo(x + width, y + height, x, y + height, radius);
      ctx.arcTo(x, y + height, x, y, radius);
      ctx.arcTo(x, y, x + width, y, radius);
      ctx.closePath();
    }
  }

  class TacticalAnimationSystem {
    constructor(options = {}) {
      this.defaultDuration = Math.max(1, Number(options.defaultDuration) || 600);
      this.animations = [];
      this.sequence = 0;
    }

    movePosition(position, targetPos, duration = this.defaultDuration, options = {}) {
      if (!position) return null;
      const animation = {
        id: this.sequence += 1,
        position,
        start: {
          x: Number(position.x) || 0,
          y: Number(position.y) || 0,
          z: Number(position.z) || 0
        },
        target: {
          x: Number(targetPos?.x) || 0,
          y: Number(targetPos?.y) || 0,
          z: Number(targetPos?.z) || 0
        },
        duration: Math.max(1, Number(duration) || this.defaultDuration),
        elapsed: 0,
        easing: options.easing || "smooth",
        onComplete: options.onComplete || null
      };
      this.animations = this.animations.filter((item) => item.position !== position);
      this.animations.push(animation);
      return animation.id;
    }

    update(deltaMs) {
      const delta = Math.max(0, Number(deltaMs) || 0);
      if (!this.animations.length || delta === 0) return;
      const completed = [];
      this.animations = this.animations.filter((animation) => {
        animation.elapsed = Math.min(animation.duration, animation.elapsed + delta);
        const progress = clamp(animation.elapsed / animation.duration, 0, 1);
        const eased = this._ease(progress, animation.easing);
        animation.position.x = animation.start.x + (animation.target.x - animation.start.x) * eased;
        animation.position.y = animation.start.y + (animation.target.y - animation.start.y) * eased;
        animation.position.z = animation.start.z + (animation.target.z - animation.start.z) * eased;
        if (progress >= 1) {
          animation.position.x = animation.target.x;
          animation.position.y = animation.target.y;
          animation.position.z = animation.target.z;
          completed.push(animation);
          return false;
        }
        return true;
      });
      completed.forEach((animation) => {
        if (typeof animation.onComplete === "function") animation.onComplete(animation);
      });
    }

    snapshot() {
      return {
        sequence: this.sequence,
        animations: this.animations.map((animation) => ({
          id: animation.id,
          start: { ...animation.start },
          target: { ...animation.target },
          duration: animation.duration,
          elapsed: animation.elapsed,
          easing: animation.easing
        }))
      };
    }

    clear() {
      this.animations = [];
    }

    _ease(progress, easing) {
      if (easing === "linear") return progress;
      if (easing === "quick") return 1 - Math.pow(1 - progress, 2);
      return progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    }
  }

  class MatchVisualizer {
    constructor(containerElement) {
      this.container = containerElement;
      this.canvas = null;
      this.context = null;
      this.renderer = null;
      this.pitchRenderer = new TacticalPitchRenderer();
      this.players = {};
      this.ball = null;
      this.animationFrameId = null;
      this.isRunning = false;
      this.bounds = { x: 0, y: 0, width: 0, height: 0 };
      this.animationSystem = new TacticalAnimationSystem({ defaultDuration: 600 });
      this.config = {
        fieldWidth: FIELD_WIDTH,
        fieldHeight: FIELD_HEIGHT,
        targetFrameTime: 1000 / 60
      };
      this.matchState = {
        homeTeamId: null,
        awayTeamId: null,
        homeGoals: 0,
        awayGoals: 0,
        minute: 0,
        possession: 50,
        playerPositions: {}
      };
      this.teamColors = {
        home: "#f6f6f1",
        away: "#1763a6"
      };
    }

    init() {
      if (this.canvas) return;
      this.canvas = document.createElement("canvas");
      this.canvas.className = "match-tactical-canvas";
      this.canvas.style.display = "block";
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      this.context = this.canvas.getContext("2d");
      this.renderer = {
        domElement: this.canvas,
        setSize: (width, height) => this._resizeCanvas(width, height),
        render: () => this.render()
      };
      this.container.appendChild(this.canvas);
      this._resizeHandler = () => this.onWindowResize();
      window.addEventListener("resize", this._resizeHandler);
      this.onWindowResize();
      this.startRendering();
    }

    setTeamInfo(homeTeamId, homeTeamColor, awayTeamId, awayTeamColor) {
      this.matchState.homeTeamId = homeTeamId;
      this.matchState.awayTeamId = awayTeamId;
      this.teamColors.home = colorToCss(homeTeamColor, "#f6f6f1");
      this.teamColors.away = colorToCss(awayTeamColor, "#1763a6");
    }

    addPlayer(playerId, startPos, isHome) {
      const position = makePosition(startPos?.x, startPos?.y, startPos?.z);
      this.players[playerId] = {
        id: playerId,
        isHome,
        mesh: { position },
        position,
        targetPosition: makePosition(position.x, position.y, position.z)
      };
      this.matchState.playerPositions[playerId] = {
        x: position.x,
        y: position.y,
        z: position.z,
        isHome
      };
    }

    createBall() {
      const position = makePosition(0, 0.22, 0);
      this.ball = {
        position,
        targetPosition: makePosition(0, 0.22, 0)
      };
    }

    updateMatchState(minute, homeGoals, awayGoals, possession = 50) {
      this.matchState.minute = minute;
      this.matchState.homeGoals = homeGoals;
      this.matchState.awayGoals = awayGoals;
      this.matchState.possession = possession;
    }

    animatePlayerMove(playerId, targetPos, duration = 1000) {
      const player = this.players[playerId];
      if (!player) return;
      player.targetPosition.copy(targetPos);
      this.animationSystem.movePosition(player.mesh.position, targetPos, duration);
    }

    animateBallMove(targetPos, duration = 1000) {
      if (!this.ball) this.createBall();
      this.ball.targetPosition.copy(targetPos);
      this.animationSystem.movePosition(this.ball.position, targetPos, duration, { easing: "quick" });
    }

    animateShot(targetPos, duration = 400) {
      this.animateBallMove(targetPos, duration);
    }

    animatePass(fromPlayerId, toPlayerId) {
      const from = this.players[fromPlayerId];
      const to = this.players[toPlayerId];
      if (!from || !to) return;
      if (!this.ball) this.createBall();
      this.ball.position.copy(from.mesh.position);
      this.animateBallMove(to.mesh.position, 480);
    }

    startRendering() {
      if (this.isRunning) return;
      this.isRunning = true;
      const loop = () => {
        if (!this.isRunning) return;
        this.updateAnimations(this.config.targetFrameTime);
        this.render();
        this.animationFrameId = requestAnimationFrame(loop);
      };
      this.animationFrameId = requestAnimationFrame(loop);
    }

    stopRendering() {
      this.isRunning = false;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }

    render() {
      if (!this.context || !this.canvas) return;
      const ctx = this.context;
      const width = this.canvas.width;
      const height = this.canvas.height;
      this._computeBounds(width, height);

      ctx.clearRect(0, 0, width, height);
      this._drawBroadcastFrame(ctx, width, height);
      this.pitchRenderer.draw(ctx, this.bounds);
      this._drawTacticalZones(ctx);
      this._drawPlayers(ctx);
      this._drawBall(ctx);
      this._drawHUD(ctx, width, height);
    }

    renderHUDOverlay() {
      this.render();
    }

    onWindowResize() {
      if (!this.container || !this.canvas) return;
      const width = Math.max(640, this.container.clientWidth || 960);
      const height = Math.max(420, this.container.clientHeight || Math.round(width * 0.58));
      this._resizeCanvas(width, height);
    }

    dispose() {
      this.stopRendering();
      if (this._resizeHandler) {
        window.removeEventListener("resize", this._resizeHandler);
      }
      if (this.canvas && this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
      this.canvas = null;
      this.context = null;
      this.renderer = null;
      this.players = {};
      this.ball = null;
      this.animationSystem.clear();
    }

    updateAnimations(deltaMs = this.config.targetFrameTime) {
      this.animationSystem.update(deltaMs);
      this._syncPositionState();
    }

    getAnimationSnapshot() {
      return {
        players: Object.fromEntries(Object.keys(this.players).map((id) => [
          id,
          {
            x: this.players[id].mesh.position.x,
            y: this.players[id].mesh.position.y,
            z: this.players[id].mesh.position.z,
            target: {
              x: this.players[id].targetPosition.x,
              y: this.players[id].targetPosition.y,
              z: this.players[id].targetPosition.z
            }
          }
        ])),
        ball: this.ball
          ? {
              x: this.ball.position.x,
              y: this.ball.position.y,
              z: this.ball.position.z,
              target: {
                x: this.ball.targetPosition.x,
                y: this.ball.targetPosition.y,
                z: this.ball.targetPosition.z
              }
            }
          : null,
        animations: this.animationSystem.snapshot()
      };
    }

    _resizeCanvas(width, height) {
      const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      this.canvas.width = Math.round(width * ratio);
      this.canvas.height = Math.round(height * ratio);
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
      this._cssWidth = width;
      this._cssHeight = height;
    }

    _computeBounds(width, height) {
      const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const cssWidth = this._cssWidth || width / ratio;
      const cssHeight = this._cssHeight || height / ratio;
      const topHud = 54;
      const margin = 28;
      const availableW = cssWidth - margin * 2;
      const availableH = cssHeight - topHud - margin * 1.6;
      const pitchRatio = FIELD_WIDTH / FIELD_HEIGHT;
      let pitchW = availableW;
      let pitchH = pitchW / pitchRatio;
      if (pitchH > availableH) {
        pitchH = availableH;
        pitchW = pitchH * pitchRatio;
      }
      this.bounds = {
        x: (cssWidth - pitchW) / 2,
        y: topHud + (availableH - pitchH) / 2,
        width: pitchW,
        height: pitchH
      };
    }

    _drawBroadcastFrame(ctx, width, height) {
      const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const cssWidth = this._cssWidth || width / ratio;
      const cssHeight = this._cssHeight || height / ratio;
      ctx.fillStyle = "#07130f";
      ctx.fillRect(0, 0, cssWidth, cssHeight);
      ctx.fillStyle = "#0b2118";
      ctx.fillRect(0, 0, cssWidth, 54);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(0, 53, cssWidth, 1);
    }

    _drawTacticalZones(ctx) {
      const b = this.bounds;
      ctx.save();
      ctx.strokeStyle = "rgba(250,250,245,0.12)";
      ctx.lineWidth = 1;
      for (let index = 1; index < 3; index += 1) {
        const x = b.x + (b.width / 3) * index;
        ctx.beginPath();
        ctx.moveTo(x, b.y);
        ctx.lineTo(x, b.y + b.height);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawPlayers(ctx) {
      Object.keys(this.players).forEach((id) => {
        const player = this.players[id];
        const screen = this.pitchRenderer.toScreen(player.mesh.position, this.bounds);
        const color = player.isHome ? this.teamColors.home : this.teamColors.away;
        const stroke = player.isHome ? "#111111" : "#f8f8f2";
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = color;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowColor = "transparent";
        ctx.fillStyle = player.isHome ? "#111111" : "#ffffff";
        ctx.font = "700 9px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(id).slice(-2), screen.x, screen.y + 0.5);
        ctx.restore();
      });
    }

    _drawBall(ctx) {
      if (!this.ball) return;
      const screen = this.pitchRenderer.toScreen(this.ball.position, this.bounds);
      const lift = clamp(Number(this.ball.position.y) || 0, 0, 4);
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(screen.x + 2, screen.y + 5, 8, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff8d8";
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - lift * 5, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    _drawHUD(ctx, width, height) {
      const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const cssWidth = this._cssWidth || width / ratio;
      ctx.save();
      ctx.fillStyle = "#f6f7ee";
      ctx.font = "700 24px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${this.matchState.homeGoals} - ${this.matchState.awayGoals}`, 28, 35);
      ctx.font = "600 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(this.matchState.possession)}% POS`, cssWidth / 2, 33);
      ctx.textAlign = "right";
      ctx.fillText(`${this.matchState.minute}'`, cssWidth - 28, 33);
      ctx.restore();
    }

    _syncPositionState() {
      Object.keys(this.players).forEach((id) => {
        const player = this.players[id];
        this.matchState.playerPositions[id] = {
          x: player.mesh.position.x,
          y: player.mesh.position.y,
          z: player.mesh.position.z,
          isHome: player.isHome
        };
      });
    }
  }

  FMG.TacticalAnimationSystem = TacticalAnimationSystem;
  FMG.TacticalPitchRenderer = TacticalPitchRenderer;
  FMG.MatchVisualizer = MatchVisualizer;
})();
