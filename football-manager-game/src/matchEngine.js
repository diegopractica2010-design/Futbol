(function () {
  const FMG = (window.FMG = window.FMG || {});

  function ratingFromSquad(players) {
    const starters = [...players].sort((left, right) => right.overall - left.overall).slice(0, 11);
    const quality = FMG.average(starters.map((player) => player.overall));
    const morale = FMG.average(starters.map((player) => player.morale));
    const energy = FMG.average(starters.map((player) => player.energy));
    return quality * 0.58 + morale * 0.22 + energy * 0.2;
  }

  function createGoalEvents(goals, squad) {
    if (goals === 0 || !squad.length) return [];
    const scorers = squad.filter((player) => ["DEL", "MED", "EXT"].includes(player.position));
    return Array.from({ length: goals }, (_, index) => {
      const scorer = FMG.sample(scorers.length ? scorers : squad);
      return {
        minute: FMG.randomInt(6, 89),
        scorer: scorer ? scorer.name : `Jugador ${index + 1}`
      };
    }).sort((left, right) => left.minute - right.minute);
  }

  FMG.computeTeamStrength = function (team, players) {
    const squad = players.filter((player) => player.teamId === team.id);
    const base = ratingFromSquad(squad);
    const tacticalBonus = team.style === "Presion" ? 3 : team.style === "Posesion" ? 2 : 1;
    return base + tacticalBonus + team.form * 0.6;
  };

  FMG.simulateMatch = function ({ homeTeam, awayTeam, players }) {
    const homePlayers = players.filter((player) => player.teamId === homeTeam.id);
    const awayPlayers = players.filter((player) => player.teamId === awayTeam.id);
    const homeStrength = FMG.computeTeamStrength(homeTeam, players) + 4;
    const awayStrength = FMG.computeTeamStrength(awayTeam, players);

    let homeGoals = FMG.clamp(Math.round((homeStrength - 48) / 12) + FMG.randomInt(0, 2), 0, 5);
    let awayGoals = FMG.clamp(Math.round((awayStrength - 50) / 12) + FMG.randomInt(0, 2), 0, 5);

    if (Math.abs(homeStrength - awayStrength) < 4 && Math.random() > 0.56) {
      homeGoals = FMG.clamp(homeGoals - 1, 0, 4);
      awayGoals = FMG.clamp(awayGoals - 1, 0, 4);
    }

    if (homeStrength - awayStrength > 8 && Math.random() > 0.45) homeGoals = FMG.clamp(homeGoals + 1, 0, 5);
    if (awayStrength - homeStrength > 8 && Math.random() > 0.45) awayGoals = FMG.clamp(awayGoals + 1, 0, 5);

    homePlayers.forEach((player) => {
      player.energy = FMG.clamp(player.energy - FMG.randomInt(4, 10), 42, 100);
      player.morale = FMG.clamp(player.morale + (homeGoals >= awayGoals ? 2 : -2), 45, 100);
    });

    awayPlayers.forEach((player) => {
      player.energy = FMG.clamp(player.energy - FMG.randomInt(4, 10), 42, 100);
      player.morale = FMG.clamp(player.morale + (awayGoals >= homeGoals ? 2 : -2), 45, 100);
    });

    return {
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeGoals,
      awayGoals,
      homeEvents: createGoalEvents(homeGoals, homePlayers),
      awayEvents: createGoalEvents(awayGoals, awayPlayers),
      summary:
        homeGoals === awayGoals
          ? "Partido equilibrado con reparto de puntos."
          : homeGoals > awayGoals
            ? `${homeTeam.name} impuso su ritmo y fue mas efectivo.`
            : `${awayTeam.name} golpeo en los momentos clave.`
    };
  };
})();
