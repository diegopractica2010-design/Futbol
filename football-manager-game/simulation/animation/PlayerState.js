(function () {
  "use strict";

  // ============================================================
  // FASE 17 — PlayerState
  // Estado de animacion por jugador.
  // Calcula: velocidad, angulo, accion activa, peso de blend.
  // No dibuja. No conoce canvas.
  // ============================================================

  window.FMG = window.FMG || {};
  window.FMG.Phase17 = window.FMG.Phase17 || {};

  // Acciones posibles — orden importa para blend priority
  var ACTIONS = {
    IDLE:        "idle",
    WALK:        "walk",
    TROT:        "trot",
    SPRINT:      "sprint",
    PASS:        "pass",
    SHOOT:       "shoot",
    CONTROL:     "control",
    TACKLE:      "tackle",
    FALL:        "fall",
    CELEBRATE:   "celebrate",
    TURN:        "turn"
  };

  // Umbrales de velocidad para blend automático
  var SPEED_IDLE   = 0.05;
  var SPEED_WALK   = 0.8;
  var SPEED_TROT   = 1.8;
  // > SPEED_TROT = sprint

  function PlayerState(playerId) {
    this.id          = playerId;
    this.x           = 0;
    this.y           = 0;
    this.prevX       = 0;
    this.prevY       = 0;
    this.speed       = 0;       // magnitud de velocidad actual (px/tick)
    this.angle       = 0;       // angulo de movimiento en radianes
    this.facingAngle = 0;       // angulo al que mira el jugador (suavizado)
    this.action      = ACTIONS.IDLE;
    this.actionTimer = 0;       // ticks restantes de accion forzada
    this.blendWeight = 0;       // 0=idle, 1=sprint (interpolado por velocidad)
    this.animTime    = 0;       // tiempo acumulado de animacion (en ticks)
    this.hasBall     = false;
    this.team        = 0;
  }

  // Actualizar desde posicion del jugador del MatchSystem
  PlayerState.prototype.update = function (player, hasBall) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x     = player.x;
    this.y     = player.y;

    var dx = this.x - this.prevX;
    var dy = this.y - this.prevY;
    this.speed = Math.hypot(dx, dy);

    // Angulo de movimiento
    if (this.speed > SPEED_IDLE) {
      this.angle = Math.atan2(dy, dx);
      // Suavizar facing angle (lerp 0.18 para giro fluido)
      var da = this.angle - this.facingAngle;
      // Normalizar diferencia a [-PI, PI]
      while (da >  Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      this.facingAngle += da * 0.18;
    }

    this.hasBall = hasBall;
    this.animTime++;

    // Decrementar timer de accion forzada
    if (this.actionTimer > 0) {
      this.actionTimer--;
      return; // no cambiar accion mientras esta activa
    }

    // Blend weight: 0=idle, 0.33=walk, 0.66=trot, 1=sprint
    if (this.speed <= SPEED_IDLE) {
      this.blendWeight = 0;
      this.action = ACTIONS.IDLE;
    } else if (this.speed <= SPEED_WALK) {
      this.blendWeight = this.speed / SPEED_WALK * 0.33;
      this.action = ACTIONS.WALK;
    } else if (this.speed <= SPEED_TROT) {
      this.blendWeight = 0.33 + (this.speed - SPEED_WALK) / (SPEED_TROT - SPEED_WALK) * 0.33;
      this.action = ACTIONS.TROT;
    } else {
      this.blendWeight = 0.66 + Math.min((this.speed - SPEED_TROT) / 1.0, 1) * 0.34;
      this.action = ACTIONS.SPRINT;
    }

    // Control de balon modifica blend
    if (hasBall && this.speed > SPEED_IDLE) {
      this.action = ACTIONS.CONTROL;
      this.blendWeight = Math.min(this.blendWeight, 0.55); // no sprint con balon
    }
  };

  // Forzar accion por N ticks (pase, tiro, entrada, caida, celebracion)
  PlayerState.prototype.forceAction = function (action, durationTicks) {
    this.action      = action;
    this.actionTimer = durationTicks;
    this.animTime    = 0; // reiniciar ciclo de animacion
  };

  PlayerState.ACTIONS = ACTIONS;

  window.FMG.Phase17.PlayerState  = PlayerState;
  window.FMG.Phase17.ACTIONS      = ACTIONS;
})();
