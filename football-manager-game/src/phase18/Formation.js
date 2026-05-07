(function () {
  "use strict";

  // ============================================================
  // FASE 18 — Formation.js
  // Posiciones base por formacion y fase de juego.
  // Soporta equipos de 11 jugadores (1 portero + 10 de campo).
  // Devuelve coordenadas absolutas segun lado del equipo.
  // ============================================================

  window.FMG = window.FMG || {};
  window.FMG.Phase18 = window.FMG.Phase18 || {};

  var C = null; // lazy-init

  // Formacion relativa: x en [0,1] (0=arco propio, 1=arco rival), y en [0,1]
  // Indices: 0=portero, 1-4 defensas, 5-7 medios, 8-10 delanteros
  var FORMATION_BASE = [
    { rx: 0.06, ry: 0.50 }, // portero
    { rx: 0.22, ry: 0.18 },
    { rx: 0.20, ry: 0.38 },
    { rx: 0.20, ry: 0.62 },
    { rx: 0.22, ry: 0.82 },
    { rx: 0.46, ry: 0.24 },
    { rx: 0.42, ry: 0.50 },
    { rx: 0.46, ry: 0.76 },
    { rx: 0.68, ry: 0.24 },
    { rx: 0.76, ry: 0.50 },
    { rx: 0.68, ry: 0.76 }
  ];

  // Compresion defensiva: todos retroceden cuando el rival tiene el balon
  var DEFENSIVE_COMPRESS = [
    { rx: 0.05, ry: 0.50 },
    { rx: 0.15, ry: 0.18 },
    { rx: 0.14, ry: 0.38 },
    { rx: 0.14, ry: 0.62 },
    { rx: 0.15, ry: 0.82 },
    { rx: 0.30, ry: 0.24 },
    { rx: 0.28, ry: 0.50 },
    { rx: 0.30, ry: 0.76 },
    { rx: 0.46, ry: 0.28 },
    { rx: 0.50, ry: 0.50 },
    { rx: 0.46, ry: 0.72 }
  ];

  // Presion alta: todos suben cuando el equipo tiene el balon
  var ATTACKING_PUSH = [
    { rx: 0.06, ry: 0.50 },
    { rx: 0.32, ry: 0.18 },
    { rx: 0.30, ry: 0.38 },
    { rx: 0.30, ry: 0.62 },
    { rx: 0.32, ry: 0.82 },
    { rx: 0.56, ry: 0.22 },
    { rx: 0.58, ry: 0.50 },
    { rx: 0.56, ry: 0.78 },
    { rx: 0.82, ry: 0.24 },
    { rx: 0.88, ry: 0.50 },
    { rx: 0.82, ry: 0.76 }
  ];

  function Formation() {}

  // Obtener posicion base de un jugador segun su indice y fase
  // attackingRight: true = el equipo ataca hacia la derecha (x creciente)
  // phase: "neutral" | "defending" | "attacking"
  Formation.prototype.getBase = function (playerIndex, attackingRight, phase) {
    if (!C) C = window.FMG.Phase16.C;

    var template =
      phase === "defending" ? DEFENSIVE_COMPRESS :
      phase === "attacking" ? ATTACKING_PUSH :
      FORMATION_BASE;

    var slot = template[playerIndex] || template[template.length - 1];

    // Espejo segun lado
    var rx = attackingRight ? slot.rx : 1 - slot.rx;
    var ry = slot.ry;

    return {
      x: rx * C.FIELD_W,
      y: ry * C.FIELD_H
    };
  };

  // Determinar fase de juego para un equipo
  // hasBall: el equipo posee el balon
  // ballX: posicion x del balon
  // attackingRight: true si el equipo ataca hacia la derecha
  Formation.prototype.getPhase = function (hasBall, ballX, attackingRight) {
    if (!C) C = window.FMG.Phase16.C;
    if (hasBall) return "attacking";
    // Si el balon esta en campo propio, defender; si esta lejos, neutral
    var ownHalf = attackingRight ? ballX < C.FIELD_W * 0.5 : ballX > C.FIELD_W * 0.5;
    return ownHalf ? "defending" : "neutral";
  };

  window.FMG.Phase18.Formation = Formation;
})();
