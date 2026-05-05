(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.STORAGE_KEY = "football-manager-game-save";

  FMG.clamp = function (value, min, max) {
    return Math.max(min, Math.min(max, value));
  };

  FMG.randomInt = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  FMG.sample = function (list) {
    return list[Math.floor(Math.random() * list.length)];
  };

  FMG.currency = function (value) {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0
    }).format(Math.round(value));
  };

  FMG.uid = function (prefix) {
    const safePrefix = prefix || "id";
    return `${safePrefix}-${Math.random().toString(36).slice(2, 10)}`;
  };

  FMG.average = function (values) {
    if (!values.length) return 0;
    return values.reduce((sum, current) => sum + current, 0) / values.length;
  };

  FMG.deepClone = function (value) {
    return JSON.parse(JSON.stringify(value));
  };

  FMG.escapeHtml = function (value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  FMG.validateSeedData = function (teams, players) {
    if (!Array.isArray(teams) || teams.length < 2) {
      throw new Error("Se necesitan al menos dos equipos para iniciar la liga.");
    }
    if (!Array.isArray(players) || players.length === 0) {
      throw new Error("No se encontraron jugadores para iniciar la partida.");
    }

    const teamIds = new Set();
    teams.forEach((team) => {
      ["id", "name", "city", "stadium", "style"].forEach((field) => {
        if (!team[field]) throw new Error(`Equipo invalido: falta ${field}.`);
      });
      ["budget", "fanBase", "sponsor", "infrastructureCost", "form"].forEach((field) => {
        if (!Number.isFinite(team[field])) throw new Error(`Equipo ${team.name} tiene ${field} invalido.`);
      });
      if (teamIds.has(team.id)) throw new Error(`Equipo duplicado: ${team.id}.`);
      teamIds.add(team.id);
    });

    const playerIds = new Set();
    players.forEach((player) => {
      ["id", "name", "teamId", "position"].forEach((field) => {
        if (!player[field]) throw new Error(`Jugador invalido: falta ${field}.`);
      });
      ["age", "overall", "morale", "energy", "value", "salary"].forEach((field) => {
        if (!Number.isFinite(player[field])) throw new Error(`Jugador ${player.name} tiene ${field} invalido.`);
      });
      if (!teamIds.has(player.teamId)) throw new Error(`Jugador ${player.name} apunta a un equipo inexistente.`);
      if (playerIds.has(player.id)) throw new Error(`Jugador duplicado: ${player.id}.`);
      playerIds.add(player.id);
    });
  };
})();
