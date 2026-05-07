(function () {
  "use strict";

  // ============================================================
  // FASE 20 — ReplayBuffer.js
  // Ring buffer de frames del estado del juego.
  // Graba: posiciones de jugadores + balon cada tick.
  // Liviano: solo coordenadas numericas, sin clonar objetos.
  // Capacidad: 5 segundos a 60fps = 300 frames.
  // ============================================================

  window.FMG.Phase20 = window.FMG.Phase20 || {};

  var CAPACITY = 300; // 5 segundos a 60fps

  function ReplayBuffer() {
    this._frames = new Array(CAPACITY);
    this._head   = 0;   // indice del frame mas reciente
    this._count  = 0;   // frames grabados (hasta CAPACITY)
  }

  // Grabar un frame del estado actual
  ReplayBuffer.prototype.record = function (match, ball) {
    var b = ball.ball;

    // Snapshot liviano: solo coordenadas
    var frame = {
      bx: b.x, by: b.y, bvx: b.vx, bvy: b.vy,
      u: match.userTeam.map(function (p) { return { x: p.x, y: p.y, id: p.id }; }),
      a: match.aiTeam.map(function (p)   { return { x: p.x, y: p.y, id: p.id }; }),
      score: [match.score[0], match.score[1]]
    };

    this._frames[this._head] = frame;
    this._head  = (this._head + 1) % CAPACITY;
    this._count = Math.min(this._count + 1, CAPACITY);
  };

  // Obtener los ultimos N frames en orden cronologico
  ReplayBuffer.prototype.getLast = function (n) {
    var count  = Math.min(n, this._count);
    var result = new Array(count);
    for (var i = 0; i < count; i++) {
      var idx = (this._head - count + i + CAPACITY) % CAPACITY;
      result[i] = this._frames[idx];
    }
    return result;
  };

  ReplayBuffer.prototype.reset = function () {
    this._head  = 0;
    this._count = 0;
  };

  window.FMG.Phase20.ReplayBuffer = ReplayBuffer;
})();
