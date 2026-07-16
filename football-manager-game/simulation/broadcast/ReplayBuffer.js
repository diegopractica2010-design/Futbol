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
    for (var i = 0; i < CAPACITY; i++) this._frames[i] = makeFrame();
  }

  // Grabar un frame del estado actual
  ReplayBuffer.prototype.record = function (match, ball) {
    var b = ball.ball;

    var frame = this._frames[this._head];
    frame.bx = b.x; frame.by = b.y; frame.bvx = b.vx; frame.bvy = b.vy;
    frame.score[0] = match.score[0];
    frame.score[1] = match.score[1];
    copyTeam(frame.u, match.userTeam);
    copyTeam(frame.a, match.aiTeam);

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

  function makeFrame() {
    return {
      bx: 0, by: 0, bvx: 0, bvy: 0,
      u: makeTeamSlots(),
      a: makeTeamSlots(),
      score: [0, 0]
    };
  }

  function makeTeamSlots() {
    var slots = new Array(11);
    for (var i = 0; i < slots.length; i++) slots[i] = { x: 0, y: 0, id: "" };
    return slots;
  }

  function copyTeam(target, source) {
    for (var i = 0; i < target.length; i++) {
      var src = source[i];
      var dst = target[i];
      if (src) {
        dst.x = src.x;
        dst.y = src.y;
        dst.id = src.id;
      } else {
        dst.x = 0;
        dst.y = 0;
        dst.id = "";
      }
    }
  }

  window.FMG.Phase20.ReplayBuffer = ReplayBuffer;
})();
