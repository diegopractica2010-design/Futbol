(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  const EVENT_TYPES = Object.freeze({
    GOAL_SCORED: "GOAL_SCORED",
    PLAYER_INJURED: "PLAYER_INJURED",
    MATCH_STARTED: "MATCH_STARTED",
    MATCH_ENDED: "MATCH_ENDED",
    TRANSFER_COMPLETED: "TRANSFER_COMPLETED",
    PLAYER_MORALE_CHANGED: "PLAYER_MORALE_CHANGED",
    TRAINING_COMPLETED: "TRAINING_COMPLETED",
    BOARD_OBJECTIVE_UPDATED: "BOARD_OBJECTIVE_UPDATED"
  });

  function EventBus(options = {}) {
    this._handlers = {};
    this._queue = [];
    this._history = [];
    this._maxHistory = options.maxHistory || 120;
    this._dispatching = false;
  }

  EventBus.prototype.on = function (type, handler) {
    if (!type || typeof handler !== "function") return function () {};
    const list = this._handlers[type] || (this._handlers[type] = []);
    list.push(handler);
    return () => this.off(type, handler);
  };

  EventBus.prototype.once = function (type, handler) {
    const off = this.on(type, (event) => {
      off();
      handler(event);
    });
    return off;
  };

  EventBus.prototype.off = function (type, handler) {
    const list = this._handlers[type];
    if (!list) return false;
    const index = list.indexOf(handler);
    if (index < 0) return false;
    list.splice(index, 1);
    return true;
  };

  EventBus.prototype.emit = function (type, payload = {}) {
    const event = {
      id: FMG.uid ? FMG.uid("evt") : "evt-0",
      type,
      payload,
      createdAt: FMG.nowISO ? FMG.nowISO("event") : "2025-01-01T12:00:00.000Z"
    };
    this._queue.push(event);
    if (!this._dispatching) this.flush();
    return event;
  };

  EventBus.prototype.flush = function () {
    this._dispatching = true;
    while (this._queue.length) {
      const event = this._queue.shift();
      this._history.unshift(event);
      this._history.length = Math.min(this._history.length, this._maxHistory);
      const handlers = this._handlers[event.type] || [];
      for (let index = 0; index < handlers.length; index += 1) {
        handlers[index](event);
      }
      const allHandlers = this._handlers["*"] || [];
      for (let index = 0; index < allHandlers.length; index += 1) {
        allHandlers[index](event);
      }
    }
    this._dispatching = false;
  };

  EventBus.prototype.history = function (type) {
    return type ? this._history.filter((event) => event.type === type) : this._history.slice();
  };

  function defaultMatchState() {
    return {
      status: "idle",
      matchId: null,
      homeTeamId: null,
      awayTeamId: null,
      week: 0,
      minute: 0,
      score: [0, 0],
      events: []
    };
  }

  function defaultUIState() {
    return {
      route: "dashboard",
      selectedRivalId: null,
      tableSort: "points",
      tableFilter: "all",
      calendarFilter: "all",
      reducedMotion: false,
      modalStack: []
    };
  }

  function defaultAudioState() {
    return {
      masterVolume: 1,
      crowdVolume: 0.78,
      sfxVolume: 0.9,
      musicVolume: 0.45,
      context: "menu",
      lastCue: null
    };
  }

  function defaultReplayState() {
    return {
      enabled: true,
      mode: "idle",
      lastReplayId: null,
      highlightQueue: [],
      maxFrames: 300
    };
  }

  function defaultCareerState() {
    return {
      status: "employed",
      reputation: 45,
      objectives: [],
      narrativeLog: [],
      relations: { fans: 60, players: 60, press: 55 }
    };
  }

  function defaultSimulationState() {
    return {
      week: 1,
      seasonNumber: 1,
      pendingJobs: [],
      completedJobs: [],
      lastRunAt: null
    };
  }

  FMG.EventTypes = EVENT_TYPES;
  FMG.EventBus = EventBus;
  FMG.eventBus = FMG.eventBus || new EventBus();

  FMG.emitGameEvent = function (type, payload) {
    if (!FMG.eventBus) FMG.eventBus = new EventBus();
    return FMG.eventBus.emit(type, payload || {});
  };

  FMG.createSeparatedState = function () {
    return {
      gameState: { initialized: false, version: FMG.CURRENT_VERSION || 1 },
      matchState: defaultMatchState(),
      uiState: defaultUIState(),
      audioState: defaultAudioState(),
      replayState: defaultReplayState(),
      careerState: defaultCareerState(),
      simulationState: defaultSimulationState()
    };
  };

  FMG.ensureSeparatedState = function (state) {
    if (!state) return state;
    state.architecture = state.architecture || { phase: 2, modular: true, networkingReady: false };
    state.matchState = Object.assign(defaultMatchState(), state.matchState || {});
    state.uiState = Object.assign(defaultUIState(), state.uiState || state.ui || {});
    state.audioState = Object.assign(defaultAudioState(), state.audioState || {});
    state.replayState = Object.assign(defaultReplayState(), state.replayState || {});
    state.careerState = Object.assign(defaultCareerState(), state.careerState || state.career || {});
    state.simulationState = Object.assign(defaultSimulationState(), state.simulationState || {});
    state.simulationState.week = state.currentWeek || state.simulationState.week;
    state.simulationState.seasonNumber = state.seasonNumber || state.simulationState.seasonNumber;
    return state;
  };

  FMG.syncLegacyStateFacets = function (state) {
    if (!state) return state;
    FMG.ensureSeparatedState(state);
    state.ui = Object.assign(state.ui || {}, state.uiState);
    state.career = Object.assign(state.career || {}, state.careerState);
    state.simulationState.week = state.currentWeek || state.simulationState.week;
    state.simulationState.seasonNumber = state.seasonNumber || state.simulationState.seasonNumber;
    return state;
  };

  FMG.createNetworkAdapter = function () {
    return {
      mode: "offline",
      send() { return false; },
      poll() { return []; }
    };
  };

  FMG.networkAdapter = FMG.networkAdapter || FMG.createNetworkAdapter();
})();
