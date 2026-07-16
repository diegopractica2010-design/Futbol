(function () {
  "use strict";

  // ============================================================
  // FASE 17 — BlendTree
  // Mezcla clips segun blendWeight y accion activa.
  // Entrada: PlayerState  ->  Salida: Pose final
  // Sin estado propio. Funcion pura por jugador.
  // ============================================================

  window.FMG.Phase17 = window.FMG.Phase17 || {};

  var Clip    = null; // se asigna en evaluate() para evitar orden de carga
  var ACTIONS = null;

  // Tiempo normalizado para acciones forzadas (0..1)
  var ACTION_DURATION = {
    pass:      18,   // ticks
    shoot:     22,
    tackle:    20,
    fall:      30,
    celebrate: 90,
    turn:      12
  };

  function BlendTree() {}

  BlendTree.prototype.evaluate = function (state) {
    // Lazy-init referencias (evita problema de orden de scripts)
    if (!Clip)    Clip    = window.FMG.Phase17.AnimationClip;
    if (!ACTIONS) ACTIONS = window.FMG.Phase17.ACTIONS;

    var t  = state.animTime / 60; // tiempo en segundos
    var bw = state.blendWeight;   // 0..1
    var action = state.action;

    // ---- Acciones forzadas (no se mezclan con locomocion) ----
    var dur = ACTION_DURATION[action];
    if (dur) {
      var progress = 1 - (state.actionTimer / dur); // 0..1
      progress = Math.max(0, Math.min(1, progress));
      var actionPose = Clip[action](progress);

      // Blend suave de salida: los ultimos 20% de la accion mezclan con locomocion
      if (progress > 0.8) {
        var exitT = (progress - 0.8) / 0.2;
        var locoPose = this._locoBlend(t, bw);
        return Clip.lerp(actionPose, locoPose, exitT);
      }
      return actionPose;
    }

    // ---- Locomocion (idle / walk / trot / sprint / control) ----
    return this._locoBlend(t, bw);
  };

  BlendTree.prototype._locoBlend = function (t, bw) {
    if (!Clip) Clip = window.FMG.Phase17.AnimationClip;

    // bw: 0=idle, 0.33=walk, 0.66=trot, 1=sprint
    if (bw <= 0.33) {
      var localT = bw / 0.33;
      return Clip.lerp(Clip.idle(t), Clip.walk(t), localT);
    }
    if (bw <= 0.66) {
      var localT = (bw - 0.33) / 0.33;
      return Clip.lerp(Clip.walk(t), Clip.trot(t), localT);
    }
    var localT = (bw - 0.66) / 0.34;
    return Clip.lerp(Clip.trot(t), Clip.sprint(t), localT);
  };

  // Duraciones exportadas para que PlayerState las use al forzar acciones
  BlendTree.ACTION_DURATION = ACTION_DURATION;

  window.FMG.Phase17.BlendTree = BlendTree;
})();
