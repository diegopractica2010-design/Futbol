(function () {
  const FMG = (window.FMG = window.FMG || {});

  function optionButtons(path, current, entries) {
    return entries.map(([value, label]) => `<button class="${current === value ? "active" : "btn-ghost"}" data-action="update-setting" data-setting="${path}" data-value="${value}">${label}</button>`).join("");
  }

  FMG.renderSettingsView = function (state) {
    FMG.ensureSettingsState(state);
    const settings = state.settings;
    const slots = FMG.listSaveSlots();
    const exportText = FMG.escapeHtml(FMG.exportSave(state));
    return `
      <section class="hero">
        <div class="panel hero-main">
          <span class="eyebrow">Sistema</span>
          <h1 class="hero-title">Centro de juego</h1>
          <p class="hero-copy">Administra guardados, dificultad, autosave y reglas de temporada.</p>
          <div class="chips">
            <span class="chip">Version ${state.version}</span>
            <span class="chip">Slot activo ${FMG.escapeHtml(state.saveMeta.activeSlotId)}</span>
            <span class="chip">${settings.autosave.enabled ? "Autosave activo" : "Autosave apagado"}</span>
          </div>
          <div class="hero-actions">
            <button class="btn-primary" data-action="save-slot" data-slot-id="${FMG.escapeHtml(state.saveMeta.activeSlotId)}" data-confirm="Sobrescribir ${FMG.escapeHtml(state.saveMeta.activeSlotId)}?">Guardar slot activo</button>
            <button class="btn-danger" data-action="safe-reset" data-confirm="Reiniciar partida actual? Se conservaran los saves guardados.">Reiniciar partida</button>
          </div>
        </div>
        <div class="side-stack">
          <section class="panel">
            <div class="section-title"><h2>Estado del sistema</h2></div>
            <div class="log-list">
              ${state.systemErrors.length ? state.systemErrors.map((error) => `<div class="log-item"><strong>${FMG.escapeHtml(error.message)}</strong><p class="muted">${FMG.escapeHtml(error.detail)}</p></div>`).join("") : `<div class="empty-state">No hay errores registrados.</div>`}
            </div>
          </section>
        </div>
      </section>
      <section class="content-grid">
        <section class="card">
          <div class="section-title"><h2>Slots de guardado</h2><span class="chip">${slots.length} disponibles</span></div>
          <div class="button-row">
            ${["slot-1", "slot-2", "slot-3", "autosave"].map((slotId) => `<button class="btn-secondary" data-action="save-slot" data-slot-id="${slotId}" data-confirm="Sobrescribir ${slotId}?">Guardar ${slotId}</button>`).join("")}
          </div>
          <div class="log-list" style="margin-top:16px;">
            ${slots.length ? slots.map((slot) => `<div class="list-row compact"><div><strong>${FMG.escapeHtml(slot.label || slot.slotId)}</strong><p class="muted">${FMG.escapeHtml(slot.teamName)} | T${slot.seasonNumber} semana ${slot.week} | v${slot.version} | ${FMG.escapeHtml(slot.savedAt)}</p><p class="chip">Balance y tabla visibles al cargar</p></div><button class="btn-primary" data-action="load-slot" data-slot-id="${slot.slotId}" data-confirm="Cargar ${FMG.escapeHtml(slot.label || slot.slotId)}? El progreso no guardado se perdera.">Cargar</button></div>`).join("") : `<div class="empty-state">Aun no hay slots guardados.</div>`}
          </div>
        </section>
        <section class="card">
          <div class="section-title"><h2>Autosave</h2></div>
          <div class="button-row">
            ${optionButtons("autosave.enabled", String(settings.autosave.enabled), [["true", "Activado"], ["false", "Desactivado"]])}
          </div>
          <div class="button-row">
            ${[1, 2, 4, 8].map((weeks) => `<button class="${settings.autosave.intervalWeeks === weeks ? "active" : "btn-ghost"}" data-action="update-setting" data-setting="autosave.intervalWeeks" data-value="${weeks}">Cada ${weeks} semana(s)</button>`).join("")}
          </div>
        </section>
      </section>
      <section class="content-grid">
        <section class="card">
          <div class="section-title"><h2>Configuracion de juego</h2></div>
          <strong>Dificultad</strong>
          <div class="button-row">${optionButtons("difficulty", settings.difficulty, [["easy", "Facil"], ["normal", "Normal"], ["hard", "Dificil"], ["expert", "Experto"]])}</div>
          <strong>Velocidad de simulacion</strong>
          <div class="button-row">${[3, 5, 10, 15, 30].map((speed) => `<button class="${settings.simulationSpeed === speed ? "active" : "btn-ghost"}" data-action="update-setting" data-setting="simulationSpeed" data-value="${speed}">${speed} min</button>`).join("")}</div>
          <strong>Opciones de temporada</strong>
          <div class="button-row">${optionButtons("season.format", settings.seasonOptions.format, [["full", "Ida y vuelta"], ["short", "Solo ida"]])}</div>
          <div class="button-row">${optionButtons("season.marketWindows", settings.seasonOptions.marketWindows, [["standard", "Mercado normal"], ["generous", "Mercado abierto"]])}</div>
          <div class="button-row">${optionButtons("season.financialPressure", settings.seasonOptions.financialPressure, [["relaxed", "Finanzas suaves"], ["normal", "Finanzas normal"], ["strict", "Finanzas estrictas"]])}</div>
        </section>
        <details class="ux-disclosure">
          <summary>Exportar / importar partida</summary>
          <section class="card">
            <div class="section-title"><h2>Exportar / importar</h2></div>
            <label class="muted" for="save-export">Exportacion de partida</label>
            <div class="button-row"><button class="btn-primary export-big" data-action="export-save">Exportar como archivo</button></div>
            <textarea id="save-export" readonly>${exportText}</textarea>
            <label class="muted" for="save-import">Importar partida</label>
            <textarea id="save-import" data-role="import-payload" aria-label="Pega aqui una partida exportada"></textarea>
            <div class="button-row">
              <button class="btn-primary" data-action="import-save" data-slot-id="${FMG.escapeHtml(state.saveMeta.activeSlotId)}" data-confirm="Importar y sobrescribir el slot activo?">Importar en slot activo</button>
            </div>
          </section>
        </details>
      </section>
    `;
  };
})();
