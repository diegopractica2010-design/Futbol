(function () {
  const FMG = (window.FMG = window.FMG || {});

  const defaultSettings = {
    difficulty: "normal",
    simulationSpeed: 5,
    autosave: { enabled: true, slotId: "autosave", intervalWeeks: 1 },
    seasonOptions: { format: "full", marketWindows: "standard", financialPressure: "normal" }
  };

  function slotKey(slotId) {
    return `${FMG.SAVE_SLOT_PREFIX}${slotId || "slot-1"}`;
  }

  function readIndex() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FMG.SAVE_INDEX_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeIndex(index) {
    localStorage.setItem(FMG.SAVE_INDEX_KEY, JSON.stringify(index));
  }

  function cloneForPersistence(value) {
    try {
      return FMG.deepClone ? FMG.deepClone(value) : JSON.parse(JSON.stringify(value));
    } catch (error) {
      return JSON.parse(JSON.stringify(value));
    }
  }

  function persistenceMetaKey(slotId) {
    return `${slotKey(slotId)}.persistence`;
  }

  function validateLoadedSave(data) {
    const errors = [];
    if (!data || typeof data !== "object") errors.push("Save vacio");
    if (FMG.saveIntegrityValidator) {
      const validation = FMG.saveIntegrityValidator.validate(data);
      if (!validation.ok) errors.push(...validation.errors);
    } else if (FMG.Core?.diagnostics?.saveValidator) {
      const validation = FMG.Core.diagnostics.saveValidator.validate(data);
      if (!validation.ok) errors.push(...validation.errors);
    } else {
      if (!Array.isArray(data.teams)) errors.push("Save missing teams");
      if (!Array.isArray(data.players)) errors.push("Save missing players");
      if (!Array.isArray(data.fixtures)) errors.push("Save missing fixtures");
    }
    return { ok: errors.length === 0, errors };
  }

  function parseSlotPayload(raw, backupRaw) {
    try {
      return JSON.parse(raw);
    } catch (parseError) {
      if (!backupRaw) throw parseError;
      const parsedBackup = JSON.parse(backupRaw);
      parsedBackup.saveMeta = parsedBackup.saveMeta || {};
      parsedBackup.saveMeta.recoveredFromBackup = true;
      return parsedBackup;
    }
  }

  function normalizeSettings(settings) {
    const merged = FMG.deepClone(defaultSettings);
    const source = settings || {};
    merged.difficulty = ["easy", "normal", "hard", "expert"].includes(source.difficulty) ? source.difficulty : merged.difficulty;
    merged.simulationSpeed = FMG.clamp(Number(source.simulationSpeed || merged.simulationSpeed), 1, 30);
    merged.autosave.enabled = source.autosave?.enabled !== false;
    merged.autosave.slotId = source.autosave?.slotId || merged.autosave.slotId;
    merged.autosave.intervalWeeks = FMG.clamp(Number(source.autosave?.intervalWeeks || 1), 1, 8);
    merged.seasonOptions.format = ["short", "full"].includes(source.seasonOptions?.format) ? source.seasonOptions.format : merged.seasonOptions.format;
    merged.seasonOptions.marketWindows = ["standard", "generous"].includes(source.seasonOptions?.marketWindows) ? source.seasonOptions.marketWindows : merged.seasonOptions.marketWindows;
    merged.seasonOptions.financialPressure = ["relaxed", "normal", "strict"].includes(source.seasonOptions?.financialPressure) ? source.seasonOptions.financialPressure : merged.seasonOptions.financialPressure;
    return merged;
  }

  function validateImportedSave(data) {
    if (!data || typeof data !== "object") throw new Error("Save vacio");
    if (FMG.Core?.diagnostics?.saveValidator) {
      const validation = FMG.Core.diagnostics.saveValidator.validate(data.game || data);
      if (!validation.ok) throw new Error(validation.errors.join("; "));
    }
    if (data.finances?.balance > 10000000000) throw new Error("Balance invalido");
    (data.players || []).forEach((player) => {
      if (player.overall < 40 || player.overall > 99) throw new Error(`Overall invalido para ${player.name}`);
      player.energy = FMG.clamp(Number(player.energy) || 0, 0, 100);
      player.morale = FMG.clamp(Number(player.morale) || 0, 0, 100);
    });
    return data;
  }

  function saveSnapshot(state, slotId, overwrite = true) {
    const targetSlot = slotId || state.saveMeta?.activeSlotId || "slot-1";
    const key = slotKey(targetSlot);
    const backupKey = `${key}.bak`;
    const tempKey = `${key}.tmp`;
    const existing = localStorage.getItem(key);
    if (existing && !overwrite) return { ok: false, message: "El slot ya existe. Confirma antes de sobrescribir." };
    const savedAt = FMG.nowISO ? FMG.nowISO("save") : FMG.EPOCH_ISO;
    const snapshot = cloneForPersistence(state);
    if (FMG.syncLegacyStateFacets) FMG.syncLegacyStateFacets(snapshot);
    if (FMG.Core?.diagnostics?.validation) {
      const validation = FMG.Core.diagnostics.validation.validateLegacyState(snapshot);
      if (!validation.ok) return { ok: false, message: "La partida no paso la validacion de guardado.", errors: validation.errors };
    }
    snapshot.version = FMG.CURRENT_VERSION;
    snapshot.saveMeta = snapshot.saveMeta || {};
    snapshot.saveMeta.activeSlotId = targetSlot;
    snapshot.saveMeta.lastSavedAt = savedAt;
    snapshot.saveMeta.safeSave = { status: "committed", savedAt, slotId: targetSlot, storage: FMG.incrementalSavePipeline ? "dual-write" : "localStorage" };
    const persistable = FMG.Core?.diagnostics?.persistence ? FMG.Core.diagnostics.persistence.wrap(snapshot) : snapshot;
    const asyncSave = FMG.incrementalSavePipeline ? FMG.incrementalSavePipeline.enqueue(targetSlot, snapshot) : null;
    const payload = JSON.stringify(persistable);
    // localStorage has no transaction primitive: tmp -> main -> delete reduces
    // corruption windows, but IndexedDB manifests remain the atomic path.
    if (existing) localStorage.setItem(backupKey, existing);
    localStorage.setItem(tempKey, payload);
    localStorage.setItem(key, localStorage.getItem(tempKey));
    localStorage.removeItem?.(tempKey);
    localStorage.setItem(FMG.STORAGE_KEY, payload);
    localStorage.setItem(persistenceMetaKey(targetSlot), JSON.stringify({
      schema: "dual-write-v1",
      slotId: targetSlot,
      savedAt,
      localStorageBytes: payload.length,
      indexedDBQueued: Boolean(asyncSave),
      compatibilityPayload: true
    }));

    const teamName = state.userClub?.name || "Sin club";
    const index = readIndex().filter((slot) => slot.slotId !== targetSlot);
    index.unshift({
      slotId: targetSlot,
      label: targetSlot === "autosave" ? "Autosave" : `Slot ${targetSlot.replace("slot-", "")}`,
      savedAt,
      version: FMG.CURRENT_VERSION,
      teamName,
      seasonNumber: state.seasonNumber || 1,
      week: state.currentWeek || 1
    });
    writeIndex(index.slice(0, 12));
    return { ok: true, message: `Partida guardada en ${targetSlot}.`, slotId: targetSlot, savedAt, asyncSave };
  }

  FMG.defaultGameSettings = defaultSettings;

  FMG.ensureSettingsState = function (state) {
    state.settings = normalizeSettings(state.settings);
    state.saveMeta = state.saveMeta || {};
    state.saveMeta.activeSlotId = state.saveMeta.activeSlotId || "slot-1";
    state.saveMeta.lastSavedAt = state.saveMeta.lastSavedAt || null;
    state.saveMeta.lastLoadedAt = state.saveMeta.lastLoadedAt || null;
    state.saveMeta.autosaveWeek = Number.isFinite(state.saveMeta.autosaveWeek) ? state.saveMeta.autosaveWeek : 0;
    state.systemErrors = state.systemErrors || [];
    return state.settings;
  };

  FMG.pushSystemError = function (state, message, detail) {
    state.systemErrors = state.systemErrors || [];
    state.systemErrors.unshift({ id: FMG.uid("err"), week: state.currentWeek || 1, message, detail: detail || "", createdAt: FMG.nowISO ? FMG.nowISO("system-error") : FMG.EPOCH_ISO });
    state.systemErrors = state.systemErrors.slice(0, 8);
  };

  FMG.listSaveSlots = function () {
    const index = readIndex();
    const legacy = localStorage.getItem(FMG.STORAGE_KEY);
    if (legacy && !index.some((slot) => slot.slotId === "legacy")) {
      index.push({ slotId: "legacy", label: "Partida antigua", savedAt: "legacy", version: 1, teamName: "Save compatible", seasonNumber: 1, week: 1 });
    }
    return index;
  };

  FMG.saveToSlot = function (state, slotId, options = {}) {
    try {
      FMG.ensureSettingsState(state);
      const result = saveSnapshot(state, slotId, options.overwrite !== false);
      if (result.ok) {
        state.saveMeta.activeSlotId = result.slotId;
        state.saveMeta.lastSavedAt = result.savedAt;
      }
      return result;
    } catch (error) {
      FMG.pushSystemError(state, "No se pudo guardar la partida.", error.message);
      return { ok: false, message: "No se pudo guardar la partida." };
    }
  };

  FMG.loadFromSlot = function (slotId) {
    try {
      const key = slotKey(slotId);
      const raw = slotId === "legacy" ? localStorage.getItem(FMG.STORAGE_KEY) : localStorage.getItem(key);
      if (!raw) return { ok: false, message: "No hay partida en ese slot." };
      const parsed = parseSlotPayload(raw, localStorage.getItem(`${key}.bak`));
      const validation = validateLoadedSave(parsed);
      if (!validation.ok) throw new Error(validation.errors.join("; "));
      const migrated = FMG.migrateSaveState(parsed);
      migrated.saveMeta.activeSlotId = slotId === "legacy" ? "slot-1" : slotId;
      migrated.saveMeta.lastLoadedAt = FMG.nowISO ? FMG.nowISO("load") : FMG.EPOCH_ISO;
      FMG.replaceGameState(migrated);
      // Restaurar RNG si hay un liveMatch activo
      if (migrated.liveMatch) {
        FMG.restoreRNGFromLiveMatch(migrated.liveMatch);
      }
      return { ok: true, message: `Partida cargada desde ${slotId}.` };
    } catch (error) {
      FMG.pushSystemError(FMG.gameState, "No se pudo cargar la partida.", error.message);
      return { ok: false, message: "La partida guardada esta danada." };
    }
  };

  FMG.loadFromSlotAsync = function (slotId) {
    if (FMG.incrementalSavePipeline && slotId !== "legacy") {
      return FMG.incrementalSavePipeline.load(slotId).then((chunked) => {
        if (!chunked) return FMG.loadFromSlot(slotId);
        const validation = validateLoadedSave(chunked);
        if (!validation.ok) throw new Error(validation.errors.join("; "));
        const migrated = FMG.migrateSaveState(chunked);
        migrated.saveMeta.activeSlotId = slotId;
        migrated.saveMeta.lastLoadedAt = FMG.nowISO ? FMG.nowISO("load-async") : FMG.EPOCH_ISO;
        migrated.saveMeta.loadedFrom = "indexedDB";
        FMG.replaceGameState(migrated);
        if (migrated.liveMatch) FMG.restoreRNGFromLiveMatch(migrated.liveMatch);
        return { ok: true, message: `Partida cargada desde ${slotId}.`, storage: "indexedDB" };
      }).catch((error) => {
        FMG.pushSystemError(FMG.gameState, "No se pudo cargar la partida incremental.", error.message);
        return FMG.loadFromSlot(slotId);
      });
    }
    return Promise.resolve(FMG.loadFromSlot(slotId));
  };

  FMG.autosaveIfNeeded = function (state, reason) {
    FMG.ensureSettingsState(state);
    const autosave = state.settings.autosave;
    if (!autosave.enabled) return { ok: false, message: "Autosave desactivado." };
    const seasonWeek = (state.seasonNumber * 1000) + (state.currentWeek || 1);
    if (seasonWeek - (state.saveMeta.autosaveWeek || 0) < autosave.intervalWeeks) return { ok: false, message: "Autosave aun no corresponde." };
    state.saveMeta.autosaveWeek = seasonWeek;
    return FMG.saveToSlot(state, autosave.slotId, { overwrite: true, reason });
  };

  FMG.exportSave = function (state) {
    FMG.ensureSettingsState(state);
    return JSON.stringify({ exportedAt: FMG.nowISO ? FMG.nowISO("export-save") : FMG.EPOCH_ISO, game: state }, null, 2);
  };

  FMG.importSave = function (payload, targetSlotId = "slot-1") {
    try {
      const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
      const rawState = validateImportedSave(parsed.game || parsed);
      const migrated = FMG.migrateSaveState(rawState);
      const result = FMG.saveToSlot(migrated, targetSlotId, { overwrite: true });
      if (!result.ok) return result;
      FMG.replaceGameState(migrated);
      FMG.gameState.saveMeta.activeSlotId = targetSlotId;
      return { ok: true, message: "Partida importada correctamente." };
    } catch (error) {
      FMG.pushSystemError(FMG.gameState, "No se pudo importar la partida.", error.message);
      return { ok: false, message: "El archivo de importacion no es compatible." };
    }
  };

  FMG.updateGameSetting = function (state, path, value) {
    FMG.ensureSettingsState(state);
    if (path === "difficulty") state.settings.difficulty = ["easy", "normal", "hard", "expert"].includes(value) ? value : state.settings.difficulty;
    if (path === "simulationSpeed") state.settings.simulationSpeed = FMG.clamp(Number(value || 5), 1, 30);
    if (path === "autosave.enabled") state.settings.autosave.enabled = value === true || value === "true";
    if (path === "autosave.intervalWeeks") state.settings.autosave.intervalWeeks = FMG.clamp(Number(value || 1), 1, 8);
    if (path === "season.format") state.settings.seasonOptions.format = value === "short" ? "short" : "full";
    if (path === "season.marketWindows") state.settings.seasonOptions.marketWindows = value === "generous" ? "generous" : "standard";
    if (path === "season.financialPressure") state.settings.seasonOptions.financialPressure = ["relaxed", "normal", "strict"].includes(value) ? value : "normal";
    localStorage.setItem(FMG.SETTINGS_KEY, JSON.stringify(state.settings));
    return { ok: true, message: "Configuracion actualizada." };
  };
})();
