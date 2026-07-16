(function () {
  "use strict";

  // ============================================================
  // FASE 21 — index.js
  // Inicializa todos los renderers de estadio.
  // Expande el canvas para incluir gradas y publicidad.
  // Reemplaza game.hud._drawField() con el render premium.
  // No modifica ningun archivo anterior.
  // ============================================================

  window.FMG = window.FMG || {};
  window.FMG.Phase21 = window.FMG.Phase21 || {};

  var C = null;

  window.FMG.Phase21.createGame = function (canvas) {
    C = window.FMG.Phase16.C;

    var P21 = window.FMG.Phase21;
    var M   = P21.StadiumRenderer.MARGIN;
    var BH  = P21.AdvertRenderer.BANNER_H;

    // Dimensiones totales del canvas (cancha + estadio)
    var totalW = C.FIELD_W + M.left + M.right;
    var totalH = C.FIELD_H + M.top  + M.bottom;

    // Redimensionar canvas
    canvas.width  = totalW;
    canvas.height = totalH;

    // Offset de la cancha dentro del canvas total
    var fieldOffX = M.left;
    var fieldOffY = M.top;

    // Crear juego base (Fase 20)
    var game = window.FMG.Phase20.createGame(canvas);
    var ctx  = canvas.getContext("2d");

    // ---- Inicializar renderers ----
    var stadiumR = new P21.StadiumRenderer();
    var crowdR   = new P21.CrowdRenderer();
    var advertR  = new P21.AdvertRenderer();
    var pitchR   = new P21.PitchRenderer();
    var goalR    = new P21.GoalRenderer();

    stadiumR.init(totalW, totalH);
    crowdR.init(totalW, totalH);
    advertR.init(totalW, totalH, fieldOffX, fieldOffY, C.FIELD_W, C.FIELD_H);
    pitchR.init(C.FIELD_W, C.FIELD_H);
    goalR.init(totalW, totalH, fieldOffX, fieldOffY, C.FIELD_W, C.FIELD_H);

    game._stadiumRenderers = { stadiumR, crowdR, advertR, pitchR, goalR };
    game._fieldOffset = { x: fieldOffX, y: fieldOffY };

    // ---- Reemplazar _drawField() del HUDSystem ----
    var tick = 0;
    game.hud._drawField = function () {
      tick++;
      ctx.save();
      ctx.translate(-fieldOffX, -fieldOffY);
      stadiumR.draw(ctx);
      crowdR.draw(ctx, tick);
      advertR.draw(ctx);
      goalR.draw(ctx);
      ctx.restore();

      pitchR.draw(ctx, 0, 0);
    };

    // ---- Ajustar CameraController para el canvas expandido ----
    // El mundo de juego sigue siendo C.FIELD_W x C.FIELD_H
    // La camara debe centrar en el campo, no en el canvas total
    // Parchear beginWorldTransform para incluir el offset del campo
    var origBegin = game.camCtrl.beginWorldTransform.bind(game.camCtrl);
    game.camCtrl.beginWorldTransform = function () {
      var cam    = game.camCtrl.state;
      var zoom   = cam.zoom;
      var cx     = cam.x + cam.shakeX;
      var cy     = cam.y + cam.shakeY;

      ctx.save();
      // Centro del canvas total
      ctx.translate(totalW / 2, totalH / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);
      return true;
    };

    // Ajustar target inicial de camara al centro del campo
    game.camCtrl.state.x       = C.FIELD_W / 2;
    game.camCtrl.state.y       = C.FIELD_H / 2;
    game.camCtrl.state.targetX = C.FIELD_W / 2;
    game.camCtrl.state.targetY = C.FIELD_H / 2;

    // Ajustar BroadcastHUD para el canvas expandido
    var origScoreboard = game.hud._drawScorebar
      ? game.hud._drawScorebar.bind(game.hud)
      : null;

    // El BroadcastHUD de Fase 20 ya usa C.FIELD_W para posicionar elementos
    // Parchear para usar totalW
    var origBroadHUD = game._broadHUD || null;

    return game;
  };
})();
