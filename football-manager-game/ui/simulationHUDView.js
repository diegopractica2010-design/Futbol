(function () {
  "use strict";
  const FMG = (window.FMG = window.FMG || {});

  let _game = null;

  function mount(container) {
    if (_game) { _game.dispose(); _game = null; }
    const C = FMG.Phase16.C;
    const M = FMG.Phase21.StadiumRenderer.MARGIN;
    const tw = C.FIELD_W + M.left + M.right;
    const th = C.FIELD_H + M.top + M.bottom;
    container.innerHTML =
      '<canvas id="p22-canvas" width="' + tw + '" height="' + th + '" ' +
      'style="display:block;max-width:100%;border-radius:8px;"></canvas>';
    const canvas = container.querySelector("#p22-canvas");
    _game = FMG.Phase22.createGame(canvas);
    _game.input.bind();
    _game.start();
  }

  function unmount() {
    if (_game) { _game.dispose(); _game = null; }
  }

  FMG.renderPhase22View = function () {
    return `
      <section class="card">
        <div class="section-title">
          <h2>Fase 22 - HUD Final de Partido</h2>
          <span class="chip">Marcador TV · Radar · Stamina · Stats · Lower thirds</span>
        </div>
        <p class="muted" style="margin-bottom:16px;">
          Overlay competitivo con marcador, reloj, minimapa, jugador activo, stamina, potencia de pase/tiro, disciplina, cambios y estadisticas rapidas.
        </p>
        <div id="p22-mount" style="width:100%;overflow:hidden;border-radius:8px;background:#050a14;"></div>
        <div class="button-row" style="margin-top:14px;">
          <button class="btn-primary" data-action="p22-start">Iniciar / Reiniciar</button>
          <button class="btn-ghost" data-action="p22-pause">Pausa / Reanudar</button>
          <button class="btn-ghost" data-action="change-route" data-route="dashboard">Volver</button>
        </div>
        <div class="log-item" style="margin-top:14px;">
          <strong>Controles</strong>
          <p class="muted">Mover: WASD / Flechas &nbsp;|&nbsp; Sprint: Shift &nbsp;|&nbsp; Cambio: Q/E &nbsp;|&nbsp; Mantener y soltar pase: Z/J &nbsp;|&nbsp; Pase largo: Espacio/L &nbsp;|&nbsp; Entrada: C &nbsp;|&nbsp; Mantener y soltar tiro: X/K &nbsp;|&nbsp; Pausa: P &nbsp;|&nbsp; Reiniciar: R</p>
        </div>
      </section>
    `;
  };

  FMG.handlePhase22Action = function (action) {
    if (action === "p22-start") {
      const m = document.querySelector("#p22-mount");
      if (m) mount(m);
      return true;
    }
    if (action === "p22-pause") {
      if (_game) _game.match.paused = !_game.match.paused;
      return true;
    }
    return false;
  };

  FMG.unmountPhase22 = unmount;
})();
