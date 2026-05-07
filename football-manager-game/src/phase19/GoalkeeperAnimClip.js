(function () {
  "use strict";

  // ============================================================
  // FASE 19 — GoalkeeperAnimClip.js
  // Clips de animacion exclusivos del portero.
  // Extiende AnimationClip de Fase 17 sin modificarlo.
  // Cada clip devuelve Pose compatible con PlayerRenderer.
  // Clips: ready, dive-left, dive-right, high-left, high-right, punch, throw, punt
  // ============================================================

  window.FMG.Phase19 = window.FMG.Phase19 || {};

  var PI = Math.PI;

  // Pose de listo: piernas separadas, brazos abiertos, cuerpo bajo
  function clipReady(t) {
    var sway = Math.sin(t * 2.8 * PI * 2) * 0.06;
    return {
      legL:      -0.22 + sway,
      legR:       0.22 - sway,
      armL:      -0.55,
      armR:       0.55,
      torsoLean:  0.08,
      bobY:       Math.abs(Math.sin(t * 2.8 * PI * 2)) * 1.2,
      scaleX:     1,
      scaleY:     0.92   // cuerpo mas bajo, listo para saltar
    };
  }

  // Dive lateral (izquierda o derecha): t=0..1
  function clipDive(t, direction) {
    // direction: -1=izquierda, 1=derecha
    var reach = Math.sin(t * PI);
    var fall  = t < 0.5 ? t * 2 : 1;
    return {
      legL:      direction * reach * 0.9,
      legR:      direction * reach * 0.4,
      armL:      direction < 0 ? -reach * 1.3 : reach * 0.4,
      armR:      direction > 0 ?  reach * 1.3 : -reach * 0.4,
      torsoLean: direction * reach * 0.4,
      bobY:      fall * 4.0,          // cuerpo cae hacia el suelo
      scaleX:    1 + reach * 0.06,
      scaleY:    1 - fall * 0.14
    };
  }

  // Atajada alta (salto): t=0..1
  function clipHighSave(t, direction) {
    var jump  = Math.sin(t * PI);
    var reach = Math.sin(t * PI * 0.8);
    return {
      legL:      jump * 0.5,
      legR:     -jump * 0.5,
      armL:      direction < 0 ? -reach * 1.4 : -reach * 0.3,
      armR:      direction > 0 ?  reach * 1.4 :  reach * 0.3,
      torsoLean: direction * reach * 0.2,
      bobY:     -jump * 8.0,          // salta hacia arriba
      scaleX:    1,
      scaleY:    1 + jump * 0.04
    };
  }

  // Punch / despeje con punos: t=0..1
  function clipPunch(t) {
    var swing = Math.sin(t * PI);
    return {
      legL:      swing * 0.3,
      legR:     -swing * 0.3,
      armL:     -swing * 1.1,
      armR:     -swing * 1.1,
      torsoLean: swing * 0.2,
      bobY:     -swing * 3.0,
      scaleX:    1,
      scaleY:    1
    };
  }

  // Saque corto (lanzamiento): t=0..1
  function clipThrow(t) {
    var wind  = t < 0.4 ? -(t / 0.4) : 0;
    var throw_ = t >= 0.4 ? (t - 0.4) / 0.6 : 0;
    return {
      legL:      throw_ * 0.4,
      legR:     -throw_ * 0.2,
      armL:      wind * 0.8 + throw_ * (-0.3),
      armR:      wind * 1.2 + throw_ * (-1.4),
      torsoLean: throw_ * 0.3,
      bobY:      throw_ * 2.0,
      scaleX:    1,
      scaleY:    1
    };
  }

  // Saque largo (patada): t=0..1
  function clipPunt(t) {
    var backswing = t < 0.35 ? -(t / 0.35) : 0;
    var kick      = t >= 0.35 && t < 0.6 ? (t - 0.35) / 0.25 * 1.3 : 0;
    var follow    = t >= 0.6 ? 1.3 * (1 - (t - 0.6) / 0.4) : 0;
    var phase     = backswing + kick + follow;
    return {
      legL:      phase * 1.0,
      legR:     -phase * 0.2,
      armL:     -phase * 0.5,
      armR:      phase * 0.4,
      torsoLean: phase * 0.28,
      bobY:      Math.abs(phase) * 2.5,
      scaleX:    1 + Math.abs(phase) * 0.03,
      scaleY:    1 - Math.abs(phase) * 0.02
    };
  }

  // ---- Selector por zona ----
  // Devuelve el clip correcto segun la zona de atajada y el progreso t
  function clipForZone(zone, t) {
    switch (zone) {
      case "dive-left":   return clipDive(t, -1);
      case "dive-right":  return clipDive(t,  1);
      case "high-left":   return clipHighSave(t, -1);
      case "high-right":  return clipHighSave(t,  1);
      case "center":      return clipPunch(t);
      default:            return clipReady(t);
    }
  }

  window.FMG.Phase19.GoalkeeperAnimClip = {
    ready:      clipReady,
    diveLeft:   function (t) { return clipDive(t, -1); },
    diveRight:  function (t) { return clipDive(t,  1); },
    highLeft:   function (t) { return clipHighSave(t, -1); },
    highRight:  function (t) { return clipHighSave(t,  1); },
    punch:      clipPunch,
    throw:      clipThrow,
    punt:       clipPunt,
    forZone:    clipForZone
  };
})();
