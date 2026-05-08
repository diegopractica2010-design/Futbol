(function () {
  "use strict";

  // ============================================================
  // FASE 17 — PlayerRenderer
  // Dibuja esqueleto 2D de un jugador usando la Pose del BlendTree.
  // Segmentos: torso, cabeza, pierna izq/der, brazo izq/der.
  // Aplica: facing angle, bobbing, lean, scale.
  // No conoce logica de juego. Solo recibe (ctx, state, pose, isControlled).
  // ============================================================

  window.FMG.Phase17 = window.FMG.Phase17 || {};

  var C = null; // lazy-init

  // Dimensiones del esqueleto (en px, relativas al PLAYER_R)
  var SK = {
    headR:      5,
    torsoLen:   9,
    legLen:     8,
    legW:       3,
    armLen:     7,
    armW:       2.5,
    shoulderW:  5   // mitad del ancho de hombros
  };

  // Colores por equipo
  var TEAM_COLORS = [
    { body: "#1a6fc4", shorts: "#0d3d6e", skin: "#f5c89a", sock: "#ffffff" },
    { body: "#c42b1a", shorts: "#6e1a0d", skin: "#f5c89a", sock: "#ffffff" }
  ];

  var CONTROLLED_RING = "#f0c040";

  function PlayerRenderer() {}

  PlayerRenderer.prototype.draw = function (ctx, state, pose, isControlled, renderOptimizer) {
    if (!C) C = window.FMG.Phase16.C;

    var x   = state.x;
    var y   = state.y + pose.bobY;
    if (renderOptimizer && !renderOptimizer.shouldDrawWorld(x, y, C.PLAYER_R + 22)) return;
    var ang = state.facingAngle;
    var col = TEAM_COLORS[state.team] || TEAM_COLORS[0];

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang + Math.PI / 2); // +90° porque el esqueleto mira "arriba" por defecto
    ctx.scale(pose.scaleX, pose.scaleY);

    // Sombra eliptica bajo el jugador (antes de rotar para que quede en el suelo)
    ctx.restore();
    ctx.save();
    ctx.translate(x + 2, y + C.PLAYER_R - 2);
    ctx.scale(1, 0.35);
    ctx.beginPath();
    ctx.arc(0, 0, C.PLAYER_R * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fill();
    ctx.restore();

    // Anillo de jugador controlado
    if (isControlled) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, C.PLAYER_R + 4, 0, Math.PI * 2);
      ctx.strokeStyle = CONTROLLED_RING;
      ctx.lineWidth   = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Dibujar esqueleto con rotacion de facing
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang + Math.PI / 2);
    ctx.scale(pose.scaleX, pose.scaleY);

    // Torso inclinado
    ctx.save();
    ctx.rotate(pose.torsoLean);
    this._drawTorso(ctx, col, pose);
    this._drawHead(ctx, col);
    this._drawArms(ctx, col, pose);
    ctx.restore();

    // Piernas (no rotan con el torso, anclan al suelo)
    this._drawLegs(ctx, col, pose);

    ctx.restore();
  };

  PlayerRenderer.prototype._drawTorso = function (ctx, col, pose) {
    // Torso: rectangulo redondeado desde 0 hacia arriba
    ctx.beginPath();
    ctx.roundRect(-SK.shoulderW, -SK.torsoLen, SK.shoulderW * 2, SK.torsoLen, 2);
    ctx.fillStyle = col.body;
    ctx.fill();
  };

  PlayerRenderer.prototype._drawHead = function (ctx, col) {
    ctx.beginPath();
    ctx.arc(0, -SK.torsoLen - SK.headR, SK.headR, 0, Math.PI * 2);
    ctx.fillStyle = col.skin;
    ctx.fill();
    // Pelo (semicirculo oscuro)
    ctx.beginPath();
    ctx.arc(0, -SK.torsoLen - SK.headR, SK.headR, Math.PI, 0);
    ctx.fillStyle = "#3a2510";
    ctx.fill();
  };

  PlayerRenderer.prototype._drawArms = function (ctx, col, pose) {
    // Brazo izquierdo
    this._drawLimb(ctx, -SK.shoulderW, -SK.torsoLen + 2, pose.armL, SK.armLen, SK.armW, col.body, col.skin);
    // Brazo derecho
    this._drawLimb(ctx,  SK.shoulderW, -SK.torsoLen + 2, pose.armR, SK.armLen, SK.armW, col.body, col.skin);
  };

  PlayerRenderer.prototype._drawLegs = function (ctx, col, pose) {
    // Pierna izquierda
    this._drawLimb(ctx, -SK.shoulderW * 0.5, 0, pose.legL, SK.legLen, SK.legW, col.shorts, col.sock);
    // Pierna derecha
    this._drawLimb(ctx,  SK.shoulderW * 0.5, 0, pose.legR, SK.legLen, SK.legW, col.shorts, col.sock);
  };

  // Dibuja un segmento de miembro (muslo + parte inferior)
  PlayerRenderer.prototype._drawLimb = function (ctx, ox, oy, angle, len, width, colorTop, colorBot) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(angle);

    // Parte superior (muslo/hombro)
    var halfLen = len * 0.55;
    ctx.beginPath();
    ctx.roundRect(-width / 2, 0, width, halfLen, 1.5);
    ctx.fillStyle = colorTop;
    ctx.fill();

    // Parte inferior (espinilla/antebrazo) — ligera rotacion adicional
    ctx.save();
    ctx.translate(0, halfLen);
    ctx.rotate(angle * 0.4); // rodilla/codo
    ctx.beginPath();
    ctx.roundRect(-width / 2, 0, width, len - halfLen, 1.5);
    ctx.fillStyle = colorBot;
    ctx.fill();
    ctx.restore();

    ctx.restore();
  };

  window.FMG.Phase17.PlayerRenderer = PlayerRenderer;
})();
