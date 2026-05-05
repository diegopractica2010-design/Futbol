(function () {
  const FMG = (window.FMG = window.FMG || {});

  function ratingFromSquad(players) {
    const starters = [...players].sort((left, right) => right.overall - left.overall).slice(0, 11);
    const quality = FMG.average(starters.map((player) => player.overall));
    const morale = FMG.average(starters.map((player) => player.morale));
    const energy = FMG.average(starters.map((player) => player.energy));
    return quality * 0.58 + morale * 0.22 + energy * 0.2;
  }

  function pickAttacker(squad) {
    const attackers = squad.filter((player) => ["DEL", "EXT", "MED"].includes(player.position));
    const pool = attackers.length ? attackers : squad;
    const weighted = [];
    pool.forEach((player) => {
      const weight = player.position === "DEL" ? 5 : player.position === "EXT" ? 4 : player.position === "MED" ? 3 : 1;
      for (let index = 0; index < weight; index += 1) weighted.push(player);
    });
    return FMG.sample(weighted);
  }

  function pickDefender(squad) {
    const defenders = squad.filter((player) => ["DEF", "MED"].includes(player.position));
    return FMG.sample(defenders.length ? defenders : squad);
  }

  function emptyStats() {
    return {
      possession: 50,
      shots: 0,
      shotsOnTarget: 0,
      xg: 0,
      fouls: 0,
      yellowCards: 0,
      redCards: 0,
      corners: 0
    };
  }

  function addTimeline(timeline, minute, type, teamId, text, extra = {}) {
    timeline.push({ minute, type, teamId, text, ...extra });
  }

  function createSummary(homeTeam, awayTeam, homeGoals, awayGoals, homeStats, awayStats) {
    if (homeGoals === awayGoals) {
      return `Partido parejo: ${homeTeam.name} genero ${homeStats.xg.toFixed(1)} xG y ${awayTeam.name} respondio con ${awayStats.xg.toFixed(1)}.`;
    }
    const winner = homeGoals > awayGoals ? homeTeam : awayTeam;
    const winnerStats = homeGoals > awayGoals ? homeStats : awayStats;
    return `${winner.name} fue mas claro en las areas y cerro el partido con ${winnerStats.shotsOnTarget} remates al arco.`;
  }

  FMG.computeTeamStrength = function (team, players, state) {
    const squad = state ? FMG.getMatchSquad(state, team.id) : players.filter((player) => player.teamId === team.id);
    const base = ratingFromSquad(squad);
    const tacticalBonus = team.style === "Presion" ? 3 : team.style === "Posesion" ? 2 : 1;
    const availabilityPenalty = squad.length < 11 ? (11 - squad.length) * 4 : 0;
    return base + tacticalBonus + team.form * 0.6 - availabilityPenalty;
  };

  FMG.simulateMatch = function ({ homeTeam, awayTeam, players, state }) {
    const homePlayers = state ? FMG.getMatchSquad(state, homeTeam.id) : players.filter((player) => player.teamId === homeTeam.id).slice(0, 11);
    const awayPlayers = state ? FMG.getMatchSquad(state, awayTeam.id) : players.filter((player) => player.teamId === awayTeam.id).slice(0, 11);
    const homeStrength = FMG.computeTeamStrength(homeTeam, players, state) + 4;
    const awayStrength = FMG.computeTeamStrength(awayTeam, players, state);
    const strengthDelta = FMG.clamp(homeStrength - awayStrength, -24, 24);
    const homePossession = FMG.clamp(Math.round(50 + strengthDelta * 0.45 + FMG.randomInt(-5, 5)), 36, 64);
    const awayPossession = 100 - homePossession;
    const homeStats = emptyStats();
    const awayStats = emptyStats();
    const homeEvents = [];
    const awayEvents = [];
    const cards = [];
    const injuries = [];
    const timeline = [];

    homeStats.possession = homePossession;
    awayStats.possession = awayPossession;

    for (let minute = 2; minute <= 90; minute += FMG.randomInt(2, 4)) {
      const isHomeAttack = Math.random() * 100 < homePossession;
      const attackTeam = isHomeAttack ? homeTeam : awayTeam;
      const defendTeam = isHomeAttack ? awayTeam : homeTeam;
      const attackSquad = isHomeAttack ? homePlayers : awayPlayers;
      const defendSquad = isHomeAttack ? awayPlayers : homePlayers;
      const attackStats = isHomeAttack ? homeStats : awayStats;
      const attackEvents = isHomeAttack ? homeEvents : awayEvents;
      const attackStrength = isHomeAttack ? homeStrength : awayStrength;
      const defendStrength = isHomeAttack ? awayStrength : homeStrength;
      const attacker = pickAttacker(attackSquad);
      const defender = pickDefender(defendSquad);
      const pressure = FMG.clamp(0.64 + (attackStrength - defendStrength) / 90 + FMG.randomInt(-8, 8) / 100, 0.28, 0.88);

      if (!attacker || !defender) continue;

      if (Math.random() < 0.19) {
        const cardRoll = Math.random();
        const color = cardRoll > 0.96 ? "red" : cardRoll > 0.72 ? "yellow" : null;
        const defendingStats = isHomeAttack ? awayStats : homeStats;
        defendingStats.fouls += 1;
        if (color) {
          if (color === "red") defendingStats.redCards += 1;
          else defendingStats.yellowCards += 1;
          cards.push({ minute, teamId: defendTeam.id, playerId: defender.id, playerName: defender.name, color });
          addTimeline(timeline, minute, color === "red" ? "red-card" : "yellow-card", defendTeam.id, `${defender.name} recibe ${color === "red" ? "roja" : "amarilla"}.`, { playerId: defender.id });
        } else {
          addTimeline(timeline, minute, "foul", defendTeam.id, `${defender.name} corta el avance de ${attacker.name}.`);
        }
        continue;
      }

      if (Math.random() < pressure) {
        const shotQuality = FMG.clamp(0.07 + (attacker.overall - 62) / 210 + (attacker.energy - 70) / 800 + FMG.randomInt(0, 10) / 100, 0.05, 0.38);
        const onTargetChance = FMG.clamp(0.28 + attacker.overall / 260 + shotQuality * 0.45, 0.32, 0.78);
        const isGoal = Math.random() < shotQuality;
        const isOnTarget = isGoal || Math.random() < onTargetChance;
        attackStats.shots += 1;
        attackStats.xg += shotQuality;
        if (isOnTarget) attackStats.shotsOnTarget += 1;
        if (Math.random() < 0.16) attackStats.corners += 1;

        if (isGoal) {
          const goal = { minute, scorer: attacker.name, playerId: attacker.id, xg: shotQuality };
          attackEvents.push(goal);
          addTimeline(timeline, minute, "goal", attackTeam.id, `Gol de ${attacker.name} para ${attackTeam.name}.`, { playerId: attacker.id, xg: shotQuality });
        } else {
          addTimeline(
            timeline,
            minute,
            isOnTarget ? "shot-on-target" : "shot",
            attackTeam.id,
            isOnTarget ? `${attacker.name} exige al arquero.` : `${attacker.name} remata desviado.`,
            { playerId: attacker.id, xg: shotQuality }
          );
        }
      } else if (Math.random() < 0.35) {
        addTimeline(timeline, minute, "chance", attackTeam.id, `${attackTeam.name} progresa pero no encuentra remate claro.`);
      }

      if (Math.random() < 0.012) {
        const injured = FMG.sample([...attackSquad, ...defendSquad]);
        if (injured) {
          const duration = FMG.randomInt(1, 4);
          injuries.push({ minute, teamId: injured.teamId, playerId: injured.id, playerName: injured.name, duration });
          addTimeline(timeline, minute, "injury", injured.teamId, `${injured.name} queda sentido y sera baja ${duration} semana(s).`, { playerId: injured.id });
        }
      }
    }

    const homeGoals = homeEvents.length;
    const awayGoals = awayEvents.length;

    homePlayers.forEach((player) => {
      player.energy = FMG.clamp(player.energy - FMG.randomInt(5, 12), 35, 100);
      player.morale = FMG.clamp(player.morale + (homeGoals >= awayGoals ? 2 : -2), 40, 100);
    });

    awayPlayers.forEach((player) => {
      player.energy = FMG.clamp(player.energy - FMG.randomInt(5, 12), 35, 100);
      player.morale = FMG.clamp(player.morale + (awayGoals >= homeGoals ? 2 : -2), 40, 100);
    });

    return {
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeGoals,
      awayGoals,
      homeEvents: homeEvents.sort((left, right) => left.minute - right.minute),
      awayEvents: awayEvents.sort((left, right) => left.minute - right.minute),
      stats: {
        home: { ...homeStats, xg: Number(homeStats.xg.toFixed(2)) },
        away: { ...awayStats, xg: Number(awayStats.xg.toFixed(2)) }
      },
      cards,
      injuries,
      timeline: timeline.sort((left, right) => left.minute - right.minute),
      summary: createSummary(homeTeam, awayTeam, homeGoals, awayGoals, homeStats, awayStats)
    };
  };
})();
