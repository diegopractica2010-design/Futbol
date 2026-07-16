(function () {
  "use strict";
  const FMG = (window.FMG = window.FMG || {});

  let _game = null;
  let _gameState = null;

  function mount(container, gameState) {
    if (_game) { _game.dispose(); _game = null; }
    _gameState = gameState;
    const C = FMG.Phase16.C;
    const M = FMG.Phase21.StadiumRenderer.MARGIN;
    const tw = C.FIELD_W + M.left + M.right;
    const th = C.FIELD_H + M.top + M.bottom;
    container.innerHTML =
      '<canvas id="p24-canvas" width="' + tw + '" height="' + th + '" ' +
      'style="display:block;max-width:100%;border-radius:8px;"></canvas>';
    const canvas = container.querySelector("#p24-canvas");
    _game = FMG.Phase24.createGame(canvas, gameState);
    _game.input.bind();
    _game.start();
  }

  function unmount() {
    if (_game) { _game.dispose(); _game = null; }
    _gameState = null;
  }

  FMG.renderPhase24View = function () {
    const plan = FMG.gameState.tactics.teamSettings[FMG.gameState.userTeamId];
    const formation = plan?.formation || "4-3-3";
    const mentality = plan?.mentality || "balanced";
    const pressing = plan?.pressing || "medium";

    return `
      <section class="card">
        <div class="section-title">
          <h2>Fase 24 - Tácticas en Cancha</h2>
          <span class="chip">Manager ↔ Partido · Atributos · Fatiga · Moral</span>
        </div>
        <p class="muted" style="margin-bottom:16px;">
          Tus decisiones manager afectan directamente el partido. Formación, mentalidad, roles e instrucciones modifican 
          velocidad, presión, precisión y agresividad. Fatiga, moral y lesiones impactan rendimiento en tiempo real.
        </p>
        <div class="stat-grid" style="margin-bottom:16px;">
          <div class="stat-item">
            <span class="stat-label">Formación</span>
            <span class="stat-value">${FMG.escapeHtml(formation)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Mentalidad</span>
            <span class="stat-value">${FMG.escapeHtml(mentality)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Presión</span>
            <span class="stat-value">${FMG.escapeHtml(pressing)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Tempo</span>
            <span class="stat-value">${FMG.escapeHtml(plan?.tempo || "normal")}</span>
          </div>
        </div>
        <div id="p24-mount" style="width:100%;overflow:hidden;border-radius:8px;background:#050a14;"></div>
        <div class="button-row" style="margin-top:14px;">
          <button class="btn-primary" data-action="p24-start">Iniciar / Reiniciar</button>
          <button class="btn-ghost" data-action="p24-pause">Pausa / Reanudar</button>
          <button class="btn-ghost" data-action="p24-stats">Estad. Jugadores</button>
          <button class="btn-ghost" data-action="change-route" data-route="dashboard">Volver</button>
        </div>
        <div class="log-item" style="margin-top:14px;">
          <strong>¿Cómo funcionan las tácticas?</strong>
          <ul style="margin:8px 0;padding-left:20px;font-size:0.9em;">
            <li><strong>Formación:</strong> posiciones iniciales de jugadores</li>
            <li><strong>Mentalidad:</strong> afecta presión y línea defensiva</li>
            <li><strong>Presión:</strong> intensidad de pressing al rival</li>
            <li><strong>Roles:</strong> modifican comportamiento ofensivo/defensivo</li>
            <li><strong>Instrucciones:</strong> modifican agresividad individual</li>
            <li><strong>Fatiga:</strong> reduce velocidad y precisión con el tiempo</li>
            <li><strong>Moral:</strong> afecta precisión de pases y tiros</li>
            <li><strong>Lesiones:</strong> reducen velocidad</li>
            <li><strong>Atributos:</strong> precisión de pase/tiro según técnica</li>
          </ul>
        </div>
        <div class="log-item" style="margin-top:14px;">
          <strong>Controles</strong>
          <p class="muted">Mover: WASD/Flechas &nbsp;|&nbsp; Sprint: Shift &nbsp;|&nbsp; Cambio: Q/E &nbsp;|&nbsp; Pase: Z/J &nbsp;|&nbsp; Pase largo: Espacio/L &nbsp;|&nbsp; Entrada: C &nbsp;|&nbsp; Tiro: X/K &nbsp;|&nbsp; Pausa: P</p>
        </div>
      </section>
    `;
  };

  FMG.handlePhase24Action = function (action) {
    if (action === "p24-start") {
      const m = document.querySelector("#p24-mount");
      if (m) mount(m, FMG.gameState);
      return true;
    }
    if (action === "p24-pause") {
      if (_game) _game.match.paused = !_game.match.paused;
      return true;
    }
    if (action === "p24-stats") {
      if (_game) {
        const team = _game.match.userTeam;
        const stats = team.map(p => {
          const fatigue = Math.round(p.fatigue || 0);
          const acc = (p._passAccuracy || 0.82).toFixed(2);
          return `${p.id}: Fatiga ${fatigue}%, Precisión ${acc}`;
        }).join(" | ");
        FMG.pushNotification(`Stats: ${stats}`);
      }
      return true;
    }
    return false;
  };

  FMG.unmountPhase24 = unmount;
})();
