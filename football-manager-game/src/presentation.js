(function () {
  const FMG = (window.FMG = window.FMG || {});

  const identities = {
    "colo-colo": { primary: "#f4f1e8", secondary: "#111111", accent: "#d6a632", initials: "CC" },
    "u-de-chile": { primary: "#143c8c", secondary: "#d8242f", accent: "#ffffff", initials: "U" },
    "u-catolica": { primary: "#1b57a6", secondary: "#ffffff", accent: "#d7b35a", initials: "UC" },
    cobreloa: { primary: "#f06a22", secondary: "#ffffff", accent: "#1f1f1f", initials: "COB" },
    huachipato: { primary: "#0b2b52", secondary: "#111111", accent: "#4fa3ff", initials: "HUA" },
    palestino: { primary: "#1d8a4d", secondary: "#d8272f", accent: "#111111", initials: "PAL" },
    wanderers: { primary: "#177a68", secondary: "#ffffff", accent: "#d5372f", initials: "SW" },
    nublense: { primary: "#d71920", secondary: "#ffffff", accent: "#111111", initials: "N" },
    "la-serena": { primary: "#b11226", secondary: "#ffffff", accent: "#111111", initials: "LS" },
    cobresal: { primary: "#ff7f00", secondary: "#ffffff", accent: "#0084c7", initials: "CS" },
    ohiggins: { primary: "#66b2ff", secondary: "#ffffff", accent: "#003f7f", initials: "OH" },
    everton: { primary: "#003f87", secondary: "#ffd200", accent: "#003f87", initials: "EV" },
    "deportes-antofagasta": { primary: "#00a3e0", secondary: "#ffffff", accent: "#00a3e0", initials: "DA" }
  };

  FMG.ensureUIState = function (state) {
    state.ui = state.ui || {};
    state.ui.selectedRivalId = state.ui.selectedRivalId || state.teams?.find((team) => team.id !== state.userTeamId)?.id || null;
    state.ui.tableSort = state.ui.tableSort || "points";
    state.ui.tableFilter = state.ui.tableFilter || "all";
    state.ui.calendarFilter = state.ui.calendarFilter || "all";
    state.ui.reducedMotion = Boolean(state.ui.reducedMotion);
    return state.ui;
  };

  FMG.getClubIdentity = function (teamId) {
    return identities[teamId] || { primary: "#2f6f4f", secondary: "#f6f2e8", accent: "#d98c2b", initials: String(teamId || "FC").slice(0, 3).toUpperCase() };
  };

  FMG.clubBadge = function (team, size = "md") {
    const identity = FMG.getClubIdentity(team?.id);
    const label = team ? `${team.name} emblema` : "Club emblema";
    return `<span class="club-badge club-badge-${size}" aria-label="${FMG.escapeHtml(label)}" title="${FMG.escapeHtml(label)}" style="--club-primary:${identity.primary};--club-secondary:${identity.secondary};--club-accent:${identity.accent};">${FMG.escapeHtml(identity.initials)}</span>`;
  };

  FMG.setTableViewOption = function (state, key, value) {
    FMG.ensureUIState(state);
    if (key === "sort") state.ui.tableSort = value || "points";
    if (key === "filter") state.ui.tableFilter = value || "all";
    return { ok: true, message: "Tabla actualizada." };
  };

  FMG.setCalendarFilter = function (state, filter) {
    FMG.ensureUIState(state);
    state.ui.calendarFilter = filter || "all";
    return { ok: true, message: "Calendario actualizado." };
  };

  FMG.selectRivalClub = function (state, teamId) {
    FMG.ensureUIState(state);
    const rival = state.teams.find((team) => team.id === teamId && team.id !== state.userTeamId);
    if (!rival) return { ok: false, message: "Club rival no disponible." };
    state.ui.selectedRivalId = rival.id;
    state.route = FMG.ROUTES.rival;
    return { ok: true, message: `Informe rival: ${rival.name}.` };
  };
})();
