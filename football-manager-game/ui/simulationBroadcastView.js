(function () {
  "use strict";
  const FMG = (window.FMG = window.FMG || {});

  let _game = null;

  function mount(container) {
    if (_game) { _game.dispose(); _game = null; }
    const C = FMG.Phase16.C;
    container.innerHTML =
      '<canvas id="p20-canvas" width="' + C.FIELD_W + '" height="' + C.FIELD_H + '" ' +
      'style="display:block;max-width:100%;border-radius:8px;"></canvas>';
    const canvas = container.querySelector("#p20-canvas");
    _game = FMG.Phase20.createGame(canvas);
    _game.input.bind();
    _game.start();
  }

  function unmount() {
    if (_game) { _game.dispose(); _game = null; }
  }

  FMG.renderPhase20View = function () {
    return `
      <section class="card">
        <div class="section-title">
          <h2>Fase 20 — Cámara Broadcast y Replays</h2>
          <span class="chip">TV · Zoom · Replay · Marcador FIFA</span>
        </div>
        <p class="muted" style="margin-bottom:16px;">
          Cámara TV lateral · Zoom contextual · Cámara de tiro · Cámara de celebración · Replay automático de goles · Cámara lenta 0.3× · Marcador televisivo
        </p>
        <div id="p20-mount" style="width:100%;overflow:hidden;border-radius:8px;background:#0a1208;"></div>
        <div class="button-row" style="margin-top:14px;">
          <button class="btn-primary" data-action="p20-start">Iniciar / Reiniciar</button>
          <button class="btn-ghost"   data-action="p20-pause">Pausa / Reanudar</button>
          <button class="btn-ghost"   data-action="change-route" data-route="dashboard">Volver</button>
        </div>
        <div class="log-item" style="margin-top:14px;">
          <strong>Controles</strong>
          <p class="muted">Mover: WASD / Flechas &nbsp;|&nbsp; Sprint: Shift &nbsp;|&nbsp; Cambio: Q/E &nbsp;|&nbsp; Pase: Z o J &nbsp;|&nbsp; Pase largo: Espacio/L &nbsp;|&nbsp; Entrada: C &nbsp;|&nbsp; Tiro: X o K &nbsp;|&nbsp; Pausa: P &nbsp;|&nbsp; Reiniciar: R</p>
        </div>
      </section>
    `;
  };

  FMG.handlePhase20Action = function (action) {
    if (action === "p20-start") {
      const m = document.querySelector("#p20-mount");
      if (m) mount(m);
      return true;
    }
    if (action === "p20-pause") {
      if (_game) _game.match.paused = !_game.match.paused;
      return true;
    }
    return false;
  };

  FMG.unmountPhase20 = unmount;
})();
