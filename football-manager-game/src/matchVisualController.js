(function () {
  const FMG = (window.FMG = window.FMG || {});

  // =============================================================================
  // MATCH VISUAL CONTROLLER - SINCRONIZACIÓN DE EVENTOS Y POSICIONES
  // =============================================================================

  class MatchVisualController {
    constructor() {
      this.visualizer = null;
      this.matchState = null;
      this.eventQueue = [];
      this.isProcessingEvents = false;
      this._seenTimelineLength = 0;
    }

    // Inicializar visualizador cuando empieza el partido
    initMatch(container, matchData, state) {
      if (this.visualizer) {
        this.visualizer.dispose();
      }

      this.visualizer = new FMG.MatchVisualizer(container);
      this.visualizer.init();
      this._seenTimelineLength = matchData.result ? matchData.result.timeline.length : 0;

      // Configurar equipos
      const homeTeam = state.teams.find((t) => t.id === matchData.homeTeamId);
      const awayTeam = state.teams.find((t) => t.id === matchData.awayTeamId);

      const homeColor = this.getTeamColor(homeTeam);
      const awayColor = this.getTeamColor(awayTeam);

      this.visualizer.setTeamInfo(
        matchData.homeTeamId,
        homeColor,
        matchData.awayTeamId,
        awayColor
      );

      // Crear balón
      this.visualizer.createBall();

      // Agregar jugadores iniciales
      const homeSquad = FMG.getAvailablePlayers(state.players, matchData.homeTeamId);
      const awaySquad = FMG.getAvailablePlayers(state.players, matchData.awayTeamId);

      const homeLineup = matchData.homeLineupIds
        .map((id) => homeSquad.find((p) => p.id === id))
        .filter(Boolean);
      const awayLineup = matchData.awayLineupIds
        .map((id) => awaySquad.find((p) => p.id === id))
        .filter(Boolean);

      // Posición inicial: formación básica en cancha
      this.positionPlayersInFormation(
        homeLineup,
        true,
        matchData.homeFormation || "4-3-3"
      );
      this.positionPlayersInFormation(
        awayLineup,
        false,
        matchData.awayFormation || "4-3-3"
      );

      this.matchState = matchData;
    }

    // Obtener color del equipo (simplificado - usar colores reales si están en data)
    getTeamColor(team) {
      if (!team) return 0x333333;
      const colorMap = {
        "colo-colo": { home: 0xffffff, away: 0x000000, accent: 0xffffff },
        "u-de-chile": { home: 0x003087, away: 0xffffff, accent: 0xff0000 },
        "u-catolica": { home: 0x7b1c2a, away: 0xffffff, accent: 0xd4af37 },
        "cobreloa": { home: 0xff6600, away: 0x000000, accent: 0xff6600 },
        "huachipato": { home: 0x005bac, away: 0xffffff, accent: 0x005bac },
        "palestino": { home: 0x006233, away: 0xffffff, accent: 0xce1126 },
        "wanderers": { home: 0x006400, away: 0xffffff, accent: 0x006400 },
        "nublense": { home: 0xd71920, away: 0xffffff, accent: 0xd71920 },
        "la-serena": { home: 0xb11226, away: 0xffffff, accent: 0x111111 },
        "cobresal": { home: 0xff7f00, away: 0xffffff, accent: 0x0084c7 },
        "ohiggins": { home: 0x66b2ff, away: 0xffffff, accent: 0x003f7f },
        "everton": { home: 0x003f87, away: 0xffd200, accent: 0x003f87 },
        "deportes-antofagasta": { home: 0x00a3e0, away: 0xffffff, accent: 0x00a3e0 }
      };
      return (colorMap[team.id.toLowerCase()] || { home: 0x333333 }).home;
    }

    // Posicionar jugadores en formación inicial
    positionPlayersInFormation(players, isHome, formation) {
      const fieldWidth = 105;
      const fieldHeight = 68;

      // Formación simple: 4-3-3, 5-3-2, etc.
      const formations = {
        "4-3-3": { defenders: 4, midfielders: 3, forwards: 3 },
        "5-3-2": { defenders: 5, midfielders: 3, forwards: 2 },
        "3-5-2": { defenders: 3, midfielders: 5, forwards: 2 }
      };

      const form = formations[formation] || formations["4-3-3"];
      const startZ = isHome ? -fieldHeight / 2 + 10 : fieldHeight / 2 - 10;
      const direction = isHome ? 1 : -1;
      const defZ = startZ;
      const midZ = startZ + 15 * direction;
      const extZ = startZ + 22 * direction;
      const fwdZ = startZ + 30 * direction;
      const clampZ = (value) => FMG.clamp(value, -fieldHeight / 2 + 2, fieldHeight / 2 - 2);

      // Orden esperado: POR (1), DEF (4), MED (3-5), DEL (2-3)
      let defIndex = 0,
        midIndex = 0,
        fwdIndex = 0;

      players.forEach((player) => {
        let x, z;

        if (player.position === "POR") {
          x = 0;
          z = isHome ? -fieldHeight / 2 + 2 : fieldHeight / 2 - 2;
        } else if (["DEF"].includes(player.position) && defIndex < form.defenders) {
          const spacing = fieldWidth / (form.defenders + 1);
          x = -fieldWidth / 2 + spacing * (defIndex + 1);
          z = startZ;
          defIndex++;
        } else if (["MED", "EXT"].includes(player.position) && midIndex < form.midfielders) {
          const spacing = fieldWidth / (form.midfielders + 1);
          x = -fieldWidth / 2 + spacing * (midIndex + 1);
          z = player.position === "EXT" ? extZ : midZ;
          midIndex++;
        } else if (["DEL"].includes(player.position) && fwdIndex < form.forwards) {
          const spacing = fieldWidth / (form.forwards + 1);
          x = -fieldWidth / 2 + spacing * (fwdIndex + 1);
          z = fwdZ;
          fwdIndex++;
        } else {
          const spacing = fieldWidth / (form.forwards + 1);
          x = -fieldWidth / 2 + spacing * (Math.min(fwdIndex, form.forwards - 1) + 1);
          z = fwdZ;
          fwdIndex++;
        }

        this.visualizer.addPlayer(player.id, { x, y: 0, z: clampZ(z) }, isHome);
      });
    }

    // Actualizar estado del partido
    updateMatchState(minute, homeGoals, awayGoals, possession) {
      this.visualizer.updateMatchState(minute, homeGoals, awayGoals, possession);
    }

    syncLiveMatch(liveMatch) {
      if (!this.visualizer || !liveMatch || !liveMatch.result) return;
      const stats = liveMatch.result.stats || {};
      const possession = stats.home ? stats.home.possession : 50;
      this.visualizer.updateMatchState(
        liveMatch.minute,
        liveMatch.result.homeGoals,
        liveMatch.result.awayGoals,
        possession
      );

      const timeline = liveMatch.result.timeline || [];
      const fresh = timeline.slice(this._seenTimelineLength);
      this._seenTimelineLength = timeline.length;
      fresh.forEach((event) => this.queueTimelineEvent(event, liveMatch));
    }

    queueTimelineEvent(event, liveMatch) {
      const homeEvent = event.teamId === liveMatch.homeTeamId;
      const lineup = homeEvent ? liveMatch.homeLineupIds : liveMatch.awayLineupIds;
      const playerId = event.playerId || lineup[Math.min(8, lineup.length - 1)] || lineup[0];
      const targetGoal = homeEvent ? "away" : "home";

      if (event.type === "goal") {
        this.queueEvent("shot", { fromPlayer: playerId, toGoal: targetGoal });
        this.queueEvent("goal", { goalPos: targetGoal });
      } else if (event.type === "chance") {
        this.queueEvent("shot", { fromPlayer: playerId, toGoal: targetGoal });
      } else if (event.type === "foul" || event.type === "yellow-card" || event.type === "red-card") {
        this.queueEvent("tackle", { playerId });
      } else {
        const toPlayer = lineup.find((id) => id !== playerId);
        if (toPlayer) this.queueEvent("pass", { fromPlayer: playerId, toPlayer });
      }
    }

    // Cola de eventos para procesarlos secuencialmente
    queueEvent(eventType, data) {
      this.eventQueue.push({ type: eventType, data });
      this.processEventQueue();
    }

    async processEventQueue() {
      if (this.isProcessingEvents || this.eventQueue.length === 0) return;

      this.isProcessingEvents = true;

      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        await this.animateEvent(event.type, event.data);
        // Esperar 200ms entre eventos para fluidez
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      this.isProcessingEvents = false;
    }

    // Animar eventos del partido
    async animateEvent(type, data) {
      switch (type) {
        case "pass":
          await this.animatePass(data);
          break;
        case "shot":
          await this.animateShot(data);
          break;
        case "goal":
          await this.animateGoal(data);
          break;
        case "foul":
          await this.animateFoul(data);
          break;
        case "tackle":
          await this.animateTackle(data);
          break;
        default:
          break;
      }
    }

    async animatePass(data) {
      const { fromPlayer, toPlayer } = data;
      const from = this.visualizer.players[fromPlayer];
      const to = this.visualizer.players[toPlayer];

      if (!from || !to) return;

      const fromPos = from.mesh.position;
      const toPos = to.mesh.position;
      if (this.visualizer.ball) {
        this.visualizer.ball.position.copy(fromPos);
        this.visualizer.ball.position.y = fromPos.y + 0.5;
      }

      // Balón viaja del jugador A al jugador B
      this.visualizer.animateBallMove(
        { x: toPos.x, y: toPos.y + 0.5, z: toPos.z },
        400,
        1
      );

      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    async animateShot(data) {
      const { fromPlayer, toGoal } = data;
      const from = this.visualizer.players[fromPlayer];

      if (!from) return;

      // Tiro hacia el arco
      const goalPos = toGoal === "home" ? 
        { x: 0, y: 1.5, z: 34 } :
        { x: 0, y: 1.5, z: -34 };

      this.visualizer.animateShot(goalPos, 300);

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    async animateGoal(data) {
      const { goalPos } = data;

      // Animación de celebración: desplazar todos los jugadores del equipo que marcó hacia arriba
      // Por ahora, solo animamos el balón entrando a la red
      if (goalPos === "home") {
        this.visualizer.animateShot({ x: 0, y: 2, z: 34 }, 200);
      } else {
        this.visualizer.animateShot({ x: 0, y: 2, z: -34 }, 200);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    async animateFoul(data) {
      // Animación de caída/contacto
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    async animateTackle(data) {
      // Animación de colisión
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Limpiar visualizador
    dispose() {
      if (this.visualizer) {
        this.visualizer.dispose();
        this.visualizer = null;
      }
      this.eventQueue = [];
      this.matchState = null;
      this._seenTimelineLength = 0;
    }
  }

  // =============================================================================
  // INSTANCIA GLOBAL
  // =============================================================================

  FMG.matchVisualController = new MatchVisualController();
})();
