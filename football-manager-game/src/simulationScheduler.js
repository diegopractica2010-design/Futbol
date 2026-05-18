(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  function SimulationScheduler() {
    this.jobs = [];
    this._log = [];
  }

  SimulationScheduler.prototype.register = function (job) {
    if (!job || !job.id || typeof job.run !== "function") return false;
    if (this.jobs.some((item) => item.id === job.id)) return false;
    this.jobs.push({
      id: job.id,
      group: job.group || "general",
      intervalWeeks: Math.max(1, job.intervalWeeks || 1),
      offset: job.offset || 0,
      budgetMs: job.budgetMs || 2,
      enabled: job.enabled !== false,
      run: job.run
    });
    return true;
  };

  SimulationScheduler.prototype.runDue = function (state, context = {}) {
    FMG.ensureSeparatedState && FMG.ensureSeparatedState(state);
    const week = state.currentWeek || 1;
    const executed = [];
    for (let index = 0; index < this.jobs.length; index += 1) {
      const job = this.jobs[index];
      if (!job.enabled) continue;
      if ((week + job.offset) % job.intervalWeeks !== 0) continue;
      const startedAt = nowMs();
      const result = job.run(state, context) || null;
      const elapsedMs = nowMs() - startedAt;
      const record = { id: job.id, group: job.group, week, elapsedMs: Math.round(elapsedMs * 100) / 100, result };
      executed.push(record);
      this._log.unshift(record);
    }
    this._log = this._log.slice(0, 80);
    if (state.simulationState) {
      state.simulationState.lastRunAt = FMG.nowISO ? FMG.nowISO("simulation-scheduler") : FMG.EPOCH_ISO;
      state.simulationState.completedJobs = this._log.slice(0, 20);
    }
    return executed;
  };

  SimulationScheduler.prototype.log = function () {
    return this._log.slice();
  };

  function nowMs() {
    if (typeof performance !== "undefined" && performance.now) return performance.now();
    return FMG.nowMs ? FMG.nowMs() : Date.UTC(2025, 0, 1, 12, 0, 0);
  }

  FMG.createDefaultSimulationScheduler = function () {
    const scheduler = new SimulationScheduler();
    scheduler.register({
      id: "league-week",
      group: "leagues",
      intervalWeeks: 1,
      run(state) {
        return { fixturesPending: (state.fixtures || []).filter((fixture) => !fixture.played).length };
      }
    });
    scheduler.register({
      id: "news-week",
      group: "news",
      intervalWeeks: 1,
      run(state) {
        if (FMG.generateContextualWeeklyNews) return { created: FMG.generateContextualWeeklyNews(state, null).length };
        return { created: 0 };
      }
    });
    scheduler.register({
      id: "scouting-week",
      group: "scouting",
      intervalWeeks: 2,
      run(state) {
        if (FMG.generateMarketRumors) return { rumors: FMG.generateMarketRumors(state).length };
        return { rumors: 0 };
      }
    });
    scheduler.register({
      id: "transfers-week",
      group: "transfers",
      intervalWeeks: 1,
      run(state) {
        if (FMG.runRivalAIWeek) return { actions: FMG.runRivalAIWeek(state, { afterMatches: true }).length };
        return { actions: 0 };
      }
    });
    scheduler.register({
      id: "injuries-week",
      group: "injuries",
      intervalWeeks: 1,
      run(state) {
        const injured = (state.players || []).filter((player) => (player.injuredWeeks || 0) > 0).length;
        return { injured };
      }
    });
    scheduler.register({
      id: "economy-week",
      group: "economy",
      intervalWeeks: 1,
      run(state) {
        return { balance: state.finances ? state.finances.balance : 0 };
      }
    });
    return scheduler;
  };

  FMG.SimulationScheduler = SimulationScheduler;
  FMG.simulationScheduler = FMG.simulationScheduler || FMG.createDefaultSimulationScheduler();
})();
