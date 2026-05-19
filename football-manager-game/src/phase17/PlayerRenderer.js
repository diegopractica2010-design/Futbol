(function () {
  "use strict";

  window.FMG.Phase17 = window.FMG.Phase17 || {};

  var CONTROLLED_RING = "#f0c040";

  function PlayerRenderer() {}

  PlayerRenderer.prototype.draw = function (ctx, state, pose, isControlled, renderOptimizer) {
    var x = state.x;
    var y = state.y + (pose ? pose.bobY : 0);
    var r = 14;
    if (renderOptimizer && !renderOptimizer.shouldDrawWorld(x, y, r + 22)) return;

    var identity = getTeamIdentity(state);
    var fill = state.team === 0 ? identity.primary : identity.secondary;
    var number = String(state.number || state.id || "").replace(/\D/g, "").slice(-2) || String(state.id || "").slice(-2);

    ctx.save();
    ctx.translate(x + 2, y + r - 2);
    ctx.scale(1, 0.35);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fill();
    ctx.restore();

    if (isControlled) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = CONTROLLED_RING;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = fill;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (state.hasBall) {
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "rgba(255,255,0,0.4)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 10px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(number, 0, 0.5);
    ctx.restore();
  };

  function getTeamIdentity(state) {
    var id = state.teamId || (state.team === 0 ? "home" : "away");
    if (window.FMG.getClubIdentity) return window.FMG.getClubIdentity(id);
    return state.team === 0
      ? { primary: "#1a6fc4", secondary: "#ffffff" }
      : { primary: "#c42b1a", secondary: "#ffffff" };
  }

  window.FMG.Phase17.PlayerRenderer = PlayerRenderer;
})();
