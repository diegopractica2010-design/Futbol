(function () {
  "use strict";

  // ============================================================
  // FASE 16 — CONSTANTS
  // Fuente unica de verdad. Ningun otro modulo define numeros magicos.
  // ============================================================

  window.FMG = window.FMG || {};
  window.FMG.Phase16 = window.FMG.Phase16 || {};

  window.FMG.Phase16.C = Object.freeze({
    // Cancha
    FIELD_W:      780,
    FIELD_H:      520,
    GOAL_W:       12,
    GOAL_H:       90,

    // Entidades
    BALL_R:       8,
    PLAYER_R:     12,

    // Velocidades
    PLAYER_SPEED: 2.8,
    AI_SPEED:     1.4,
    SHOOT_POWER:  9,
    PASS_POWER:   6,
    BALL_FRICTION: 0.985,
    SPIN_DECAY: 0.975,
    MAGNUS_FACTOR: 0.006,

    // Tiempo
    FPS:          60,
    MATCH_SECS:   60,   // duracion real del partido en segundos

    // Animacion
    GOAL_FLASH_FRAMES: 60,

    // Colores
    COLOR_GRASS:      "#2d7a3a",
    COLOR_GRASS_ALT:  "#2a7236",
    COLOR_LINE:       "rgba(255,255,255,0.85)",
    COLOR_GOAL:       "#ffffff",
    COLOR_USER_TEAM:  "#1a6fc4",
    COLOR_AI_TEAM:    "#c42b1a",
    COLOR_CONTROLLED: "#f0c040",
    COLOR_BALL:       "#f5f5f0",
    COLOR_HUD_BG:     "rgba(10,20,12,0.82)",
    COLOR_HUD_TEXT:   "#ffffff",
    COLOR_GOAL_FLASH: "rgba(255,220,50,0.22)"
  });
})();
