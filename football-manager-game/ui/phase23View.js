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
      '<canvas id="p23-canvas" width="' + tw + '" height="' + th + '" ' +
      'style="display:block;max-width:100%;border-radius:8px;"></canvas>';
    const canvas = container.querySelector("#p23-canvas");
    _game = FMG.Phase23.createGame(canvas);
    _game.input.bind();
    _game.start();
  }

  function unmount() {
    if (_game) { _game.dispose(); _game = null; }
  }

  FMG.renderPhase23View = function () {
    return `
      <section class="card">
        <div class="section-title">
          <h2>Fase 23 - Audio de Partido</h2>
          <span class="chip">Público dinámico · Gol · Casi gol · Faltas · Balón · Pasos · Cánticos</span>
        </div>
        <p class="muted" style="margin-bottom:16px;">
          Audio procedural con ambiente de estadio, reacción del público según peligro, silbato, golpe de balón, pasos, cánticos y música de menú.
        </p>
        <div id="p23-mount" style="width:100%;overflow:hidden;border-radius:8px;background:#050a14;"></div>
        <div class="button-row" style="margin-top:14px;">
          <button class="btn-primary" data-action="p23-start">Iniciar / Reiniciar</button>
          <button class="btn-ghost" data-action="p23-pause">Pausa / Reanudar</button>
          <button class="btn-ghost" data-action="p23-foul">Probar falta</button>
          <button class="btn-ghost" data-action="change-route" data-route="dashboard">Volver</button>
        </div>
        <div class="log-item" style="margin-top:14px;">
          <strong>Controles</strong>
          <p class="muted">Mover: WASD/Flechas &nbsp;|&nbsp; Sprint: Shift &nbsp;|&nbsp; Cambio: Q/E &nbsp;|&nbsp; Pase: Z/J &nbsp;|&nbsp; Pase largo: Espacio/L &nbsp;|&nbsp; Entrada: C &nbsp;|&nbsp; Tiro: X/K &nbsp;|&nbsp; Pausa: P</p>
        </div>
      </section>
    `;
  };

  FMG.handlePhase23Action = function (action) {
    if (action === "p23-start") {
      const m = document.querySelector("#p23-mount");
      if (m) mount(m);
      return true;
    }
    if (action === "p23-pause") {
      if (_game) _game.match.paused = !_game.match.paused;
      return true;
    }
    if (action === "p23-foul") {
      if (_game && _game.playFoulAudio) _game.playFoulAudio();
      return true;
    }
    return false;
  };

  FMG.unmountPhase23 = unmount;
})();
