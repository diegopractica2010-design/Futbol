(function () {
  "use strict";

  // ============================================================
  // FASE 20 — ReplayPlayer.js
  // Reproduce frames del ReplayBuffer a velocidad reducida.
  // Interpola posiciones entre frames para suavidad.
  // Velocidad: 0.3x (cada frame real avanza 0.3 frames de replay).
  // ============================================================

  window.FMG.Phase20 = window.FMG.Phase20 || {};

  var REPLAY_SPEED  = 0.3;   // fraccion de velocidad normal
  var REPLAY_FRAMES = 180;   // ultimos 3 segundos para el replay

  function ReplayPlayer() {
    this.active      = false;
    this._frames     = [];
    this._cursor     = 0;     // posicion actual (puede ser decimal)
    this._onComplete = null;
  }

  // Iniciar replay con los frames dados
  ReplayPlayer.prototype.start = function (frames, onComplete) {
    this._frames     = frames;
    this._cursor     = 0;
    this.active      = true;
    this._onComplete = onComplete || null;
  };

  // Avanzar un tick de replay. Devuelve el frame interpolado actual.
  ReplayPlayer.prototype.tick = function () {
    if (!this.active || this._frames.length === 0) return null;

    this._cursor += REPLAY_SPEED;

    if (this._cursor >= this._frames.length - 1) {
      this.active = false;
      if (this._onComplete) this._onComplete();
      return this._frames[this._frames.length - 1];
    }

    var i0 = Math.floor(this._cursor);
    var i1 = Math.min(i0 + 1, this._frames.length - 1);
    var t  = this._cursor - i0;

    return this._interpolate(this._frames[i0], this._frames[i1], t);
  };

  // Interpolacion lineal entre dos frames
  ReplayPlayer.prototype._interpolate = function (f0, f1, t) {
    var u = 1 - t;
    return {
      bx:  f0.bx  * u + f1.bx  * t,
      by:  f0.by  * u + f1.by  * t,
      bvx: f0.bvx * u + f1.bvx * t,
      bvy: f0.bvy * u + f1.bvy * t,
      score: f1.score,
      u: f0.u.map(function (p, i) {
        var p1 = f1.u[i] || p;
        return { x: p.x * u + p1.x * t, y: p.y * u + p1.y * t, id: p.id };
      }),
      a: f0.a.map(function (p, i) {
        var p1 = f1.a[i] || p;
        return { x: p.x * u + p1.x * t, y: p.y * u + p1.y * t, id: p.id };
      })
    };
  };

  ReplayPlayer.REPLAY_FRAMES = REPLAY_FRAMES;
  window.FMG.Phase20.ReplayPlayer = ReplayPlayer;
})();
