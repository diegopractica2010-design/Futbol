(function () {
  "use strict";

  // ============================================================
  // FASE 16 — AudioSystem
  // Stub silencioso. Misma API que un sistema de audio real.
  // Para agregar sonidos: implementar los metodos sin cambiar
  // la interfaz ni los otros modulos.
  // ============================================================

  function AudioSystem() {
    this.enabled = false; // activar cuando haya assets de audio
  }

  AudioSystem.prototype.playGoal    = function () {};
  AudioSystem.prototype.playKick    = function () {};
  AudioSystem.prototype.playWhistle = function () {};
  AudioSystem.prototype.playBounce  = function () {};

  window.FMG.Phase16.AudioSystem = AudioSystem;
})();
