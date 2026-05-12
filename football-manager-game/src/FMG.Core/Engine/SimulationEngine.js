(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Engine = FMG.Core.Engine || {};

  /**
   * SimulationEngine: Orchestrates deterministic week simulation
   * Owns: command execution, state transitions, event emission
   * All mutations go through here and return new GameState instances
   */
  function SimulationEngine(config) {
    config = config || {};

    this.eventBus = config.eventBus || (FMG.Core.Events && new FMG.Core.Events.EventBus());
    this.matchSimulator = config.matchSimulator || (FMG.Core.Services && new FMG.Core.Services.MatchSimulator());
    this.stateValidator = config.stateValidator || (FMG.Core.Engine && new FMG.Core.Engine.StateValidator());

    this._executionLog = [];
  }

  /**
   * Execute AdvanceWeekCommand: single week simulation
   * Returns: {gameState: GameState, events: DomainEvent[]}
   */
  SimulationEngine.prototype.advanceWeek = function (gameState, command) {
    if (!gameState) {
      throw new Error("GameState required");
    }

    const commandId = Math.random().toString(36).slice(2, 8);
    const startTime = Date.now();

    try {
      // 1. VALIDATE
      const errors = this.stateValidator.validate(gameState);
      if (errors.length > 0) {
        throw new Error("Invalid GameState: " + errors.join("; "));
      }

      // 2. PREPARE: Auto-select lineups for all clubs
      let clubs = gameState.clubs.map((club) => this._autoSelectLineup(club));

      // 3. SIMULATE: Run all matches for current week fixture
      const currentFixture = gameState.season.currentFixture();
      if (!currentFixture) {
        throw new Error("No fixture for current week");
      }

      let season = gameState.season;
      const matchResults = [];
      const weekSeed = command.weekSeed || FMG.Core.Utils.deriveSeed(gameState.season.startSeed, gameState.season.week);

      for (let i = 0; i < currentFixture.matches.length; i++) {
        const match = currentFixture.matches[i];
        const homeClub = clubs.find((c) => c.teamId === match.homeTeamId);
        const awayClub = clubs.find((c) => c.teamId === match.awayTeamId);

        if (!homeClub || !awayClub) continue;

        const homeTeam = FMG.gameState.teams.find((t) => t.id === match.homeTeamId);
        const awayTeam = FMG.gameState.teams.find((t) => t.id === match.awayTeamId);

        const matchSeed = FMG.Core.Utils.deriveSeed(weekSeed, i, FMG.Core.Utils.hashSeed(match.homeTeamId + match.awayTeamId));

        const result = this.matchSimulator.run(
          homeTeam || { id: match.homeTeamId, form: 10 },
          awayTeam || { id: match.awayTeamId, form: 10 },
          homeClub.squad,
          awayClub.squad,
          matchSeed
        );

        matchResults.push(result);

        // Update squad stats
        homeClub = this._applyMatchStats(homeClub, result, true);
        awayClub = this._applyMatchStats(awayClub, result, false);

        // Update standings
        season = this._updateStandings(season, result);

        this.eventBus.emit(FMG.Core.Events.EventTypes.MATCH_COMPLETED, {
          matchResult: result,
          week: gameState.season.week
        });
      }

      // Update clubs in state
      clubs = clubs.map((c) => {
        const updated = matchResults.reduce((club, result) => {
          if (club.teamId === result.homeTeamId) {
            return this._applyMatchStats(club, result, true);
          } else if (club.teamId === result.awayTeamId) {
            return this._applyMatchStats(club, result, false);
          }
          return club;
        }, c);
        return updated;
      });

      // 4. APPLY WEEKLY EFFECTS
      clubs = clubs.map((c) => this._applyWeeklyEffects(c));

      // 5. APPLY WEEKLY FINANCIALS
      clubs = clubs.map((c) => this._applyWeeklyFinances(c));

      // 6. ADVANCE WEEK
      season = season.nextWeek();

      // 7. BUILD NEW STATE
      const gameState_ = gameState.with({
        season,
        clubs,
        timestamp: new Date().toISOString()
      });

      // 8. EMIT FINAL EVENT
      this.eventBus.emit(FMG.Core.Events.EventTypes.WEEK_ADVANCED, {
        gameState: gameState_,
        week: gameState.season.week,
        matchResults,
        weekSeed
      });

      return {
        gameState: gameState_,
        events: this.eventBus.history(),
        executionMs: Date.now() - startTime,
        commandId
      };
    } catch (err) {
      console.error(`SimulationEngine error (${commandId}):`, err);
      throw err;
    }
  };

  SimulationEngine.prototype._autoSelectLineup = function (club) {
    if (!club.squad || club.squad.length < 11) {
      return club;
    }

    const lineup = club.squad
      .filter((p) => !p.injuredWeeks || p.injuredWeeks <= 0)
      .slice(0, 11);

    return club.withSquad(Object.freeze(lineup));
  };

  SimulationEngine.prototype._applyMatchStats = function (club, matchResult, isHome) {
    if (!club.squad) return club;

    const startingXI = club.getStartingXI();
    const updatedSquad = club.squad.map((player) => {
      if (!startingXI.find((p) => p.id === player.id)) {
        return player;
      }

      // Update player stats
      const energy = Math.max(0, (player.energy || 80) - 12);
      const morale = Math.max(0, Math.min(100, (player.morale || 70) + (isHome ? 3 : -2)));
      const seasonStats = player.seasonStats || { appearances: 0, goals: 0, assists: 0 };
      seasonStats.appearances = (seasonStats.appearances || 0) + 1;
      seasonStats.minutes = (seasonStats.minutes || 0) + 90;

      return Object.freeze({
        ...player,
        energy,
        morale,
        seasonStats: Object.freeze(seasonStats)
      });
    });

    return club.withSquad(updatedSquad);
  };

  SimulationEngine.prototype._updateStandings = function (season, matchResult) {
    if (!season.standings) {
      season = season.withStandings([]);
    }

    let standings = season.standings.slice();

    const updateTeam = (teamId, homeGoals, awayGoals, isHome) => {
      let entry = standings.find((s) => s.teamId === teamId);
      if (!entry) {
        entry = { teamId, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
      } else {
        entry = { ...entry };
      }

      entry.played++;

      if (isHome) {
        entry.goalsFor += homeGoals;
        entry.goalsAgainst += awayGoals;
        if (homeGoals > awayGoals) {
          entry.wins++;
          entry.points += 3;
        } else if (homeGoals === awayGoals) {
          entry.draws++;
          entry.points += 1;
        } else {
          entry.losses++;
        }
      } else {
        entry.goalsFor += awayGoals;
        entry.goalsAgainst += homeGoals;
        if (awayGoals > homeGoals) {
          entry.wins++;
          entry.points += 3;
        } else if (awayGoals === homeGoals) {
          entry.draws++;
          entry.points += 1;
        } else {
          entry.losses++;
        }
      }

      const idx = standings.findIndex((s) => s.teamId === teamId);
      if (idx >= 0) {
        standings[idx] = entry;
      } else {
        standings.push(entry);
      }
    };

    updateTeam(matchResult.homeTeamId, matchResult.homeGoals, matchResult.awayGoals, true);
    updateTeam(matchResult.awayTeamId, matchResult.homeGoals, matchResult.awayGoals, false);

    // Sort by points, then goal difference
    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
    });

    return season.withStandings(standings);
  };

  SimulationEngine.prototype._applyWeeklyEffects = function (club) {
    if (!club.squad) return club;

    // Random events: injuries, morale changes
    const squad = club.squad.map((player) => {
      let updatedPlayer = { ...player };

      // Injury chance
      if (Math.random() < 0.02) {
        updatedPlayer.injuredWeeks = Math.ceil(Math.random() * 4);
      }

      // Energy recovery
      updatedPlayer.energy = Math.min(100, (updatedPlayer.energy || 50) + 8);

      return Object.freeze(updatedPlayer);
    });

    return club.withSquad(squad);
  };

  SimulationEngine.prototype._applyWeeklyFinances = function (club) {
    if (!club.finances) return club;

    const finances = { ...club.finances };

    // Weekly wage expense
    const totalWages = (club.squad || []).reduce((sum, p) => sum + (p.salary || 0), 0);
    finances.balance = (finances.balance || 0) - totalWages;

    // Weekly income (sponsor, TV rights)
    const weeklyIncome = Math.round((club.budget * 0.15) / 38);
    finances.balance += weeklyIncome;

    return club.withFinances(finances);
  };

  FMG.Core.Engine.SimulationEngine = SimulationEngine;
})();
