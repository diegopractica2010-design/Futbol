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
  // Indices: 0=portero, resto segun el once elegido por el manager.
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

  var FORMATION_TEMPLATES = {
    "4-3-3": {
      neutral: FORMATION_BASE,
      defending: DEFENSIVE_COMPRESS,
      attacking: ATTACKING_PUSH
    },
    "4-4-2": {
      neutral: [
        { rx: 0.06, ry: 0.50 },
        { rx: 0.22, ry: 0.18 }, { rx: 0.20, ry: 0.38 }, { rx: 0.20, ry: 0.62 }, { rx: 0.22, ry: 0.82 },
        { rx: 0.48, ry: 0.16 }, { rx: 0.42, ry: 0.38 }, { rx: 0.42, ry: 0.62 }, { rx: 0.48, ry: 0.84 },
        { rx: 0.74, ry: 0.40 }, { rx: 0.74, ry: 0.60 }
      ],
      defending: [
        { rx: 0.05, ry: 0.50 },
        { rx: 0.15, ry: 0.18 }, { rx: 0.14, ry: 0.38 }, { rx: 0.14, ry: 0.62 }, { rx: 0.15, ry: 0.82 },
        { rx: 0.32, ry: 0.18 }, { rx: 0.29, ry: 0.40 }, { rx: 0.29, ry: 0.60 }, { rx: 0.32, ry: 0.82 },
        { rx: 0.50, ry: 0.42 }, { rx: 0.50, ry: 0.58 }
      ],
      attacking: [
        { rx: 0.06, ry: 0.50 },
        { rx: 0.31, ry: 0.16 }, { rx: 0.29, ry: 0.38 }, { rx: 0.29, ry: 0.62 }, { rx: 0.31, ry: 0.84 },
        { rx: 0.58, ry: 0.14 }, { rx: 0.56, ry: 0.40 }, { rx: 0.56, ry: 0.60 }, { rx: 0.58, ry: 0.86 },
        { rx: 0.84, ry: 0.40 }, { rx: 0.84, ry: 0.60 }
      ]
    },
    "3-5-2": {
      neutral: [
        { rx: 0.06, ry: 0.50 },
        { rx: 0.20, ry: 0.28 }, { rx: 0.18, ry: 0.50 }, { rx: 0.20, ry: 0.72 },
        { rx: 0.44, ry: 0.12 }, { rx: 0.40, ry: 0.32 }, { rx: 0.38, ry: 0.50 }, { rx: 0.40, ry: 0.68 }, { rx: 0.44, ry: 0.88 },
        { rx: 0.74, ry: 0.40 }, { rx: 0.74, ry: 0.60 }
      ],
      defending: [
        { rx: 0.05, ry: 0.50 },
        { rx: 0.13, ry: 0.28 }, { rx: 0.12, ry: 0.50 }, { rx: 0.13, ry: 0.72 },
        { rx: 0.26, ry: 0.14 }, { rx: 0.28, ry: 0.32 }, { rx: 0.27, ry: 0.50 }, { rx: 0.28, ry: 0.68 }, { rx: 0.26, ry: 0.86 },
        { rx: 0.48, ry: 0.42 }, { rx: 0.48, ry: 0.58 }
      ],
      attacking: [
        { rx: 0.06, ry: 0.50 },
        { rx: 0.28, ry: 0.28 }, { rx: 0.26, ry: 0.50 }, { rx: 0.28, ry: 0.72 },
        { rx: 0.62, ry: 0.10 }, { rx: 0.56, ry: 0.30 }, { rx: 0.58, ry: 0.50 }, { rx: 0.56, ry: 0.70 }, { rx: 0.62, ry: 0.90 },
        { rx: 0.84, ry: 0.40 }, { rx: 0.84, ry: 0.60 }
      ]
    }
  };

  function Formation() {}

  // Obtener posicion base de un jugador segun su indice y fase
  // attackingRight: true = el equipo ataca hacia la derecha (x creciente)
  // phase: "neutral" | "defending" | "attacking"
  Formation.prototype.getBase = function (playerIndex, attackingRight, phase, tacticsPlan) {
    if (!C) C = window.FMG.Phase16.C;

    var formationName = (tacticsPlan && tacticsPlan.formation) || "4-3-3";
    var formation = FORMATION_TEMPLATES[formationName] || FORMATION_TEMPLATES["4-3-3"];
    var template = formation[phase] || formation.neutral;

    var slot = template[playerIndex] || template[template.length - 1];
    var rx = slot.rx;
    var ry = slot.ry;

    if (tacticsPlan && playerIndex > 0) {
      var depthOffset = 0;
      if (tacticsPlan.mentality === "attacking") depthOffset += 0.045;
      else if (tacticsPlan.mentality === "defensive") depthOffset -= 0.045;

      if (tacticsPlan.defensiveLine === "high") depthOffset += 0.035;
      else if (tacticsPlan.defensiveLine === "deep") depthOffset -= 0.045;

      rx = Math.max(0.08, Math.min(0.92, rx + depthOffset));

      var width = tacticsPlan.width;
      var widthScale = width === "wide" ? 1.13 : width === "narrow" ? 0.84 : 1;
      ry = 0.5 + (ry - 0.5) * widthScale;
      ry = Math.max(0.08, Math.min(0.92, ry));
    }

    // Espejo segun lado
    rx = attackingRight ? rx : 1 - rx;

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
