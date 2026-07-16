(function () {
  "use strict";

  // ============================================================
  // FASE 17 — AnimationClip
  // Keyframes procedurales para cada animacion.
  // Cada clip es una funcion pura: (time, speed) -> Pose
  // Pose = { legL, legR, armL, armR, torsoLean, bobY, scaleX, scaleY }
  // Angulos en radianes. bobY = desplazamiento vertical del cuerpo.
  // Sin estado. Completamente reciclable y mezclable.
  // ============================================================

  window.FMG.Phase17 = window.FMG.Phase17 || {};

  var PI  = Math.PI;
  var TAU = PI * 2;

  // Utilidad: oscilacion sinusoidal
  function osc(time, freq, amp, phase) {
    return Math.sin(time * freq * TAU + (phase || 0)) * amp;
  }

  // Pose neutra (referencia para blend)
  function neutralPose() {
    return { legL: 0, legR: 0, armL: 0, armR: 0, torsoLean: 0, bobY: 0, scaleX: 1, scaleY: 1 };
  }

  // Lerp entre dos poses
  function lerpPose(a, b, t) {
    var u = 1 - t;
    return {
      legL:      a.legL      * u + b.legL      * t,
      legR:      a.legR      * u + b.legR      * t,
      armL:      a.armL      * u + b.armL      * t,
      armR:      a.armR      * u + b.armR      * t,
      torsoLean: a.torsoLean * u + b.torsoLean * t,
      bobY:      a.bobY      * u + b.bobY      * t,
      scaleX:    a.scaleX    * u + b.scaleX    * t,
      scaleY:    a.scaleY    * u + b.scaleY    * t
    };
  }

  // ---- Clips individuales ----

  // IDLE: respiracion suave, peso en un pie
  function clipIdle(t) {
    var breath = osc(t, 0.4, 0.04);
    return {
      legL:      osc(t, 0.3, 0.06),
      legR:      osc(t, 0.3, 0.06, 0.5),
      armL:      osc(t, 0.3, 0.05, 0.25),
      armR:      osc(t, 0.3, 0.05, 0.75),
      torsoLean: breath * 0.3,
      bobY:      breath * 0.8,
      scaleX:    1,
      scaleY:    1 + breath * 0.015
    };
  }

  // WALK: zancada lenta, brazos opuestos a piernas
  function clipWalk(t) {
    var freq = 1.4;
    var leg  = osc(t, freq, 0.38);
    var arm  = osc(t, freq, 0.22);
    return {
      legL:      leg,
      legR:     -leg,
      armL:     -arm,
      armR:      arm,
      torsoLean: osc(t, freq, 0.04),
      bobY:      Math.abs(osc(t, freq * 2, 1.2)),
      scaleX:    1,
      scaleY:    1
    };
  }

  // TROT: zancada media, mas energia
  function clipTrot(t) {
    var freq = 2.2;
    var leg  = osc(t, freq, 0.52);
    var arm  = osc(t, freq, 0.32);
    return {
      legL:      leg,
      legR:     -leg,
      armL:     -arm,
      armR:      arm,
      torsoLean: osc(t, freq, 0.07),
      bobY:      Math.abs(osc(t, freq * 2, 2.0)),
      scaleX:    1,
      scaleY:    1
    };
  }

  // SPRINT: zancada maxima, inclinacion hacia adelante
  function clipSprint(t) {
    var freq = 3.2;
    var leg  = osc(t, freq, 0.72);
    var arm  = osc(t, freq, 0.48);
    return {
      legL:      leg,
      legR:     -leg,
      armL:     -arm,
      armR:      arm,
      torsoLean: 0.22,           // inclinado hacia adelante siempre
      bobY:      Math.abs(osc(t, freq * 2, 3.0)),
      scaleX:    1.05,           // ligero estiramiento horizontal
      scaleY:    0.96
    };
  }

  // PASS: swing de pierna de pase (t=0..1 normalizado)
  function clipPass(t) {
    // t viene de actionTimer normalizado externamente
    var swing = Math.sin(t * PI);
    return {
      legL:      swing * 0.7,
      legR:     -swing * 0.2,
      armL:      swing * 0.5,
      armR:     -swing * 0.3,
      torsoLean: swing * 0.15,
      bobY:      swing * 1.5,
      scaleX:    1,
      scaleY:    1
    };
  }

  // SHOOT: backswing + impacto + followthrough
  function clipShoot(t) {
    // t = 0..1: 0-0.3 backswing, 0.3-0.5 impacto, 0.5-1 followthrough
    var phase;
    if (t < 0.3) {
      phase = -(t / 0.3);       // backswing negativo
    } else if (t < 0.5) {
      phase = (t - 0.3) / 0.2 * 1.2; // impacto rapido
    } else {
      phase = 1.2 * (1 - (t - 0.5) / 0.5); // followthrough
    }
    return {
      legL:      phase * 0.9,
      legR:     -phase * 0.3,
      armL:     -phase * 0.4,
      armR:      phase * 0.6,
      torsoLean: phase * 0.25,
      bobY:      Math.abs(phase) * 2.0,
      scaleX:    1 + Math.abs(phase) * 0.04,
      scaleY:    1 - Math.abs(phase) * 0.03
    };
  }

  // CONTROL: recepcion de balon, cuerpo bajo
  function clipControl(t) {
    var freq = 1.8;
    var leg  = osc(t, freq, 0.28);
    return {
      legL:      leg * 0.6,
      legR:     -leg * 0.6,
      armL:      osc(t, freq, 0.18, 0.5),
      armR:      osc(t, freq, 0.18),
      torsoLean: 0.12,
      bobY:      Math.abs(osc(t, freq * 2, 1.0)),
      scaleX:    1,
      scaleY:    0.94  // cuerpo mas bajo
    };
  }

  // TACKLE: deslizamiento lateral
  function clipTackle(t) {
    var slide = Math.sin(t * PI);
    return {
      legL:      slide * 1.1,
      legR:      slide * 0.3,
      armL:      slide * 0.6,
      armR:     -slide * 0.4,
      torsoLean: slide * 0.35,
      bobY:     -slide * 3.0,   // cuerpo baja al suelo
      scaleX:    1 + slide * 0.08,
      scaleY:    1 - slide * 0.12
    };
  }

  // FALL: caida y recuperacion
  function clipFall(t) {
    var down = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
    return {
      legL:      down * 0.8,
      legR:      down * 1.1,
      armL:      down * 1.2,
      armR:      down * 0.9,
      torsoLean: down * 0.5,
      bobY:     -down * 5.0,
      scaleX:    1 + down * 0.1,
      scaleY:    1 - down * 0.18
    };
  }

  // CELEBRATE: salto con brazos arriba
  function clipCelebrate(t) {
    var jump  = Math.abs(Math.sin(t * PI * 2.5));
    var arms  = Math.sin(t * PI * 2.5);
    return {
      legL:      jump * 0.5,
      legR:     -jump * 0.5,
      armL:     -arms * 1.1,   // brazos arriba
      armR:      arms * 1.1,
      torsoLean: osc(t, 2.5, 0.1),
      bobY:     -jump * 6.0,   // salta hacia arriba (negativo = arriba)
      scaleX:    1,
      scaleY:    1 + jump * 0.05
    };
  }

  // TURN: giro rapido de cadera
  function clipTurn(t) {
    var twist = Math.sin(t * PI);
    return {
      legL:      twist * 0.4,
      legR:     -twist * 0.6,
      armL:      twist * 0.5,
      armR:     -twist * 0.5,
      torsoLean: twist * 0.2,
      bobY:      Math.abs(twist) * 1.5,
      scaleX:    1,
      scaleY:    1
    };
  }

  // ---- API publica ----

  window.FMG.Phase17.AnimationClip = {
    neutral:    neutralPose,
    lerp:       lerpPose,
    idle:       clipIdle,
    walk:       clipWalk,
    trot:       clipTrot,
    sprint:     clipSprint,
    pass:       clipPass,
    shoot:      clipShoot,
    control:    clipControl,
    tackle:     clipTackle,
    fall:       clipFall,
    celebrate:  clipCelebrate,
    turn:       clipTurn
  };
})();
