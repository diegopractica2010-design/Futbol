(function () {
  "use strict";

  // ============================================================
  // FASE 20 — CameraController.js
  // Decide modo de camara y actualiza CameraState.
  // Aplica transformacion ctx: translate + scale.
  // Todo el render posterior usa coordenadas de mundo normales.
  // ============================================================

  window.FMG.Phase20 = window.FMG.Phase20 || {};

  var C     = null;
  var MODES = null;

  // Configuracion por modo
  var MODE_CFG = {
    broadcast: { zoom: 1.00, lerpSpeed: 0.06 },
    zoom:      { zoom: 1.55, lerpSpeed: 0.07 },
    shot:      { zoom: 1.80, lerpSpeed: 0.10 },
    celebrate: { zoom: 2.20, lerpSpeed: 0.08 },
    replay:    { zoom: 1.65, lerpSpeed: 0.05 }
  };

  // Duraciones de modos especiales (ticks)
  var MODE_DURATION = {
    shot:      90,   // ~1.5s
    celebrate: 180,  // ~3s
    zoom:      60    // ~1s
  };

  function CameraController(canvas) {
    this._canvas = canvas;
    this._state  = new window.FMG.Phase20.CameraState();
    this._ctx    = canvas.getContext("2d");
  }

  // Tick: actualizar modo y targets segun estado del juego
  CameraController.prototype.tick = function (match, ball, events) {
    if (!C)     C     = window.FMG.Phase16.C;
    if (!MODES) MODES = window.FMG.Phase20.CAMERA_MODES;

    var cam = this._state;
    var b   = ball.ball;

    // Procesar eventos externos (gol, tiro, celebracion)
    if (events) {
      if (events.goal) {
        this._setMode(MODES.CELEBRATE, events.goalX, events.goalY, MODE_DURATION.celebrate);
        cam.triggerShake(8);
      } else if (events.shot) {
        this._setMode(MODES.SHOT, events.shotX, events.shotY, MODE_DURATION.shot);
      }
    }

    // Si el modo especial expiro, volver a broadcast o zoom
    if (cam.modeTicks === 0 && cam.mode !== MODES.BROADCAST && cam.mode !== MODES.ZOOM && cam.mode !== MODES.REPLAY) {
      this._setMode(MODES.BROADCAST, C.FIELD_W / 2, C.FIELD_H / 2, 0);
    }

    // Zoom contextual: si el balon esta en zona de peligro, hacer zoom
    if (cam.mode === MODES.BROADCAST || cam.mode === MODES.ZOOM) {
      var inDangerZone = b.x < C.FIELD_W * 0.22 || b.x > C.FIELD_W * 0.78;
      var ballSpeed    = Math.hypot(b.vx, b.vy);

      if (inDangerZone && ballSpeed > 2 && cam.mode !== MODES.ZOOM) {
        this._setMode(MODES.ZOOM, b.x, b.y, MODE_DURATION.zoom);
      } else if (!inDangerZone && cam.mode === MODES.ZOOM && cam.modeTicks === 0) {
        this._setMode(MODES.BROADCAST, C.FIELD_W / 2, C.FIELD_H / 2, 0);
      }
    }

    // Actualizar target de posicion segun modo
    if (cam.mode === MODES.BROADCAST) {
      // Seguir el balon horizontalmente, centrado verticalmente
      cam.targetX = C.FIELD_W / 2 + (b.x - C.FIELD_W / 2) * 0.15;
      cam.targetY = C.FIELD_H / 2;
    } else if (cam.mode === MODES.ZOOM || cam.mode === MODES.SHOT) {
      // Centrar en el balon
      cam.targetX = b.x;
      cam.targetY = b.y;
    }
    // CELEBRATE y REPLAY mantienen su target fijo

    cam.tick();
  };

  CameraController.prototype._setMode = function (mode, targetX, targetY, duration) {
    var cam = this._state;
    var cfg = MODE_CFG[mode] || MODE_CFG.broadcast;

    cam.mode       = mode;
    cam.modeTicks  = duration;
    cam.targetX    = targetX;
    cam.targetY    = targetY;
    cam.targetZoom = cfg.zoom;
    cam.lerpSpeed  = cfg.lerpSpeed;
  };

  // Aplicar transformacion al ctx ANTES de dibujar el mundo
  // Devuelve true si se aplico (siempre llamar restore() despues)
  CameraController.prototype.beginWorldTransform = function () {
    if (!C) C = window.FMG.Phase16.C;

    var cam    = this._state;
    var ctx    = this._ctx;
    var zoom   = cam.zoom;
    var cx     = cam.x + cam.shakeX;
    var cy     = cam.y + cam.shakeY;
    var canvasW = C.FIELD_W;
    var canvasH = C.FIELD_H;

    ctx.save();
    // Trasladar para que el punto focal quede en el centro del canvas
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -cy);

    return true;
  };

  CameraController.prototype.endWorldTransform = function () {
    this._ctx.restore();
  };

  // Modo replay: fijar camara en posicion dada
  CameraController.prototype.setReplayTarget = function (x, y) {
    if (!MODES) MODES = window.FMG.Phase20.CAMERA_MODES;
    this._setMode(MODES.REPLAY, x, y, 9999);
  };

  CameraController.prototype.exitReplay = function () {
    if (!C)     C     = window.FMG.Phase16.C;
    if (!MODES) MODES = window.FMG.Phase20.CAMERA_MODES;
    this._setMode(MODES.BROADCAST, C.FIELD_W / 2, C.FIELD_H / 2, 0);
  };

  Object.defineProperty(CameraController.prototype, "state", {
    get: function () { return this._state; }
  });

  window.FMG.Phase20.CameraController = CameraController;
})();
