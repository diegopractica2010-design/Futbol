(function () {
  "use strict";

  // ============================================================
  // FASE 16 — AnimationSystem
  // Responsabilidad: estado de efectos visuales.
  // No renderiza directamente — expone datos que HUDSystem consume.
  // ============================================================

  const C = window.FMG.Phase16.C;

  function AnimationSystem() {
    this.goalFlash  = 0;   // frames restantes de flash
    this.goalTeam   = -1;  // 0 = usuario, 1 = IA, -1 = ninguno
  }

  AnimationSystem.prototype.triggerGoal = function (team) {
    this.goalFlash = C.GOAL_FLASH_FRAMES;
    this.goalTeam  = team;
  };

  AnimationSystem.prototype.tick = function () {
    if (this.goalFlash > 0) this.goalFlash--;
    else this.goalTeam = -1;
  };

  AnimationSystem.prototype.isGoalFlashing = function () {
    return this.goalFlash > 0;
  };

  window.FMG.Phase16.AnimationSystem = AnimationSystem;
})();
