(function () {
  "use strict";

  // ============================================================
  // FASE 20 — CameraState.js
  // Estado puro de la camara. Sin logica de decision ni render.
  // Todos los valores son en coordenadas de MUNDO (cancha).
  // El renderer aplica la transformacion ctx antes de dibujar.
  // ============================================================

  window.FMG = window.FMG || {};
  window.FMG.Phase20 = window.FMG.Phase20 || {};

  var MODES = {
    BROADCAST:  "broadcast",   // vista lateral completa
    ZOOM:       "zoom",        // zoom contextual al balon
    SHOT:       "shot",        // zoom al tirador + portero
    CELEBRATE:  "celebrate",   // zoom al goleador
    REPLAY:     "replay"       // reproduccion de replay
  };

  function CameraState() {
    // Posicion actual del centro de la camara (coordenadas de mundo)
    this.x    = 0;
    this.y    = 0;
    // Zoom actual (1 = cancha completa visible)
    this.zoom = 1;
    // Modo actual
    this.mode = MODES.BROADCAST;
    // Duracion restante del modo actual (ticks)
    this.modeTicks = 0;

    // Targets para lerp suave
    this.targetX    = 0;
    this.targetY    = 0;
    this.targetZoom = 1;

    // Velocidad de lerp (0=instantaneo, 1=nunca llega)
    this.lerpSpeed = 0.08;

    // Shake (para goles)
    this.shakeX       = 0;
    this.shakeY       = 0;
    this.shakeMag     = 0;
    this.shakeDecay   = 0.85;
  }

  // Avanzar lerp un tick
  CameraState.prototype.tick = function () {
    var s = this.lerpSpeed;
    this.x    += (this.targetX    - this.x)    * s;
    this.y    += (this.targetY    - this.y)    * s;
    this.zoom += (this.targetZoom - this.zoom) * s;

    // Shake
    if (this.shakeMag > 0.1) {
      this.shakeX   = (Math.random() - 0.5) * this.shakeMag;
      this.shakeY   = (Math.random() - 0.5) * this.shakeMag;
      this.shakeMag *= this.shakeDecay;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
      this.shakeMag = 0;
    }

    if (this.modeTicks > 0) this.modeTicks--;
  };

  CameraState.prototype.triggerShake = function (magnitude) {
    this.shakeMag = magnitude;
  };

  CameraState.MODES = MODES;
  window.FMG.Phase20.CameraState = CameraState;
  window.FMG.Phase20.CAMERA_MODES = MODES;
})();
