(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function hashText(value) {
    const text = String(value || "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function getTeam(state, id) {
    return (state?.teams || []).find((team) => team.id === id) || null;
  }

  function getRivalry(state, homeTeamId, awayTeamId) {
    const rivalries = state?.rivalries || [];
    const stored = rivalries.find((item) =>
      (item.teamAId === homeTeamId && item.teamBId === awayTeamId) ||
      (item.teamAId === awayTeamId && item.teamBId === homeTeamId)
    );
    if (stored) return stored;
    const key = [homeTeamId, awayTeamId].sort().join("-");
    const classic = {
      "colo-colo-u-de-chile": "Superclasico",
      "colo-colo-u-catolica": "Clasico historico",
      "u-catolica-u-de-chile": "Clasico universitario",
      "cobreloa-colo-colo": "Rivalidad historica"
    }[key];
    return classic ? { name: classic, intensity: 86, teamAId: homeTeamId, teamBId: awayTeamId } : null;
  }

  function weatherFor(match) {
    const seed = hashText(`${match?.seed || 0}-${match?.week || 0}`);
    const roll = seed % 100;
    if (roll > 86) return { label: "Lluvia fina", code: "rain", particleRate: 0.42, tint: "rgba(120,170,190,0.10)" };
    if (roll > 70) return { label: "Noche fria", code: "cold", particleRate: 0.12, tint: "rgba(100,140,180,0.08)" };
    if (roll > 54) return { label: "Tarde humeda", code: "humid", particleRate: 0.18, tint: "rgba(90,150,120,0.08)" };
    return { label: "Cielo despejado", code: "clear", particleRate: 0.06, tint: "rgba(240,210,120,0.05)" };
  }

  function matchStage(match) {
    if (!match) return "idle";
    if (match.completed) return "fulltime";
    const minute = Number(match.minute) || 0;
    if (minute <= 2) return "intro";
    if (minute >= 45 && minute <= 47) return "halftime";
    if (minute >= 88) return "late";
    return "live";
  }

  function latestEvent(match) {
    const minute = Number(match?.minute) || 0;
    return (match?.result?.timeline || [])
      .filter((event) => Number(event.minute) <= minute)
      .slice(-1)[0] || null;
  }

  class PresentationStateManager {
    build(state, match) {
      const home = getTeam(state, match?.homeTeamId);
      const away = getTeam(state, match?.awayTeamId);
      const rivalry = getRivalry(state, match?.homeTeamId, match?.awayTeamId);
      const tension = rivalry && FMG.Rivalries?.calculateRivalryTension
        ? FMG.Rivalries.calculateRivalryTension(rivalry, state)
        : 42;
      const event = latestEvent(match);
      const homeIdentity = FMG.getClubIdentity?.(home?.id);
      const awayIdentity = FMG.getClubIdentity?.(away?.id);
      const stats = match?.result?.stats || {};
      const scoreDiff = Math.abs(Number(match?.result?.homeGoals || 0) - Number(match?.result?.awayGoals || 0));
      const minute = Number(match?.minute) || 0;
      const importance = clamp(42 + tension * 0.32 + (match?.week <= 3 ? 4 : 0) + (minute > 75 && scoreDiff <= 1 ? 18 : 0), 25, 96);
      const momentum = Number(match?.momentum) || 50;
      const pressure = clamp(Math.abs(momentum - 50) * 1.35 + (event?.type === "shot-on-target" ? 28 : 0) + (event?.type === "goal" ? 40 : 0), 0, 100);
      const stage = matchStage(match);
      const weather = weatherFor(match);
      const tournament = state?.seasonComplete ? "Post temporada" : `Liga Chile | Fecha ${match?.week || state?.currentWeek || 1}`;

      return {
        home,
        away,
        homeIdentity,
        awayIdentity,
        rivalry,
        rivalryName: rivalry?.name || "Duelo de liga",
        derby: tension >= 70,
        tension,
        importance,
        pressure,
        momentum,
        event,
        stage,
        weather,
        tournament,
        crowd: clamp(28 + importance * 0.46 + pressure * 0.3 + (event?.type === "goal" ? 22 : 0), 20, 100),
        lighting: clamp(36 + importance * 0.3 + pressure * 0.18, 30, 82),
        headline: this._headline(stage, home, away, rivalry, event),
        strapline: this._strapline(stage, tension, weather, tournament)
      };
    }

    _headline(stage, home, away, rivalry, event) {
      if (event?.type === "goal") return "GOL EN DIRECTO";
      if (stage === "intro") return `${home?.name || "Local"} vs ${away?.name || "Visita"}`;
      if (stage === "halftime") return "ENTRETIEMPO";
      if (stage === "fulltime") return "FINAL DEL PARTIDO";
      if (stage === "late") return "TRAMO DECISIVO";
      return rivalry?.name || "PARTIDO EN VIVO";
    }

    _strapline(stage, tension, weather, tournament) {
      if (stage === "intro") return `${tournament} | ${weather.label}`;
      if (stage === "halftime") return "Ajustes, energia y lectura tactica";
      if (stage === "fulltime") return "Resumen, impacto y cierre de fecha";
      if (tension >= 80) return "Ambiente de clasico, maxima tension";
      if (tension >= 62) return "Ritmo alto y estadio encendido";
      return `${tournament} | ${weather.label}`;
    }
  }

  class CrowdAmbienceController {
    constructor() {
      this.level = 30;
      this.phase = 0;
    }

    update(presentation, deltaMs) {
      const target = presentation?.crowd || 30;
      this.level += (target - this.level) * 0.08;
      this.phase += (deltaMs || 16) * (0.0007 + this.level / 180000);
      return this.level;
    }
  }

  class OverlayTransitionManager {
    constructor() {
      this.currentKey = "";
      this.alpha = 0;
    }

    update(key, deltaMs) {
      if (key !== this.currentKey) {
        this.currentKey = key;
        this.alpha = 1;
      } else {
        this.alpha = Math.max(0, this.alpha - (deltaMs || 16) / 1400);
      }
      return this.alpha;
    }
  }

  class LightweightVisualEffectsController {
    constructor() {
      this.particles = [];
      this.sequence = 0;
    }

    update(presentation, bounds, deltaMs) {
      const delta = deltaMs || 16;
      const rate = presentation?.weather?.particleRate || 0.04;
      const desired = Math.min(42, Math.round(8 + rate * 50 + (presentation?.crowd || 0) / 7));
      while (this.particles.length < desired) this.particles.push(this._create(bounds, presentation));
      this.particles = this.particles.slice(-desired);
      this.particles.forEach((particle) => {
        particle.y += particle.vy * delta;
        particle.x += particle.vx * delta;
        particle.life -= delta;
        if (particle.life <= 0 || particle.y > bounds.y + bounds.height + 30) {
          Object.assign(particle, this._create(bounds, presentation));
          particle.y = bounds.y - 20;
        }
      });
      return this.particles;
    }

    _create(bounds, presentation) {
      this.sequence += 1;
      const seed = hashText(`${presentation?.tournament || ""}-${this.sequence}`);
      return {
        x: bounds.x + (seed % 1000) / 1000 * bounds.width,
        y: bounds.y + ((seed >>> 8) % 1000) / 1000 * bounds.height,
        vx: (((seed >>> 18) % 100) - 50) / 10000,
        vy: 0.012 + ((seed >>> 12) % 100) / 7000,
        size: 1 + ((seed >>> 4) % 3),
        life: 1400 + (seed % 1200)
      };
    }
  }

  class MatchAtmosphereController {
    constructor() {
      this.stateManager = new PresentationStateManager();
      this.crowd = new CrowdAmbienceController();
      this.transitions = new OverlayTransitionManager();
      this.effects = new LightweightVisualEffectsController();
      this.presentation = null;
      this.particles = [];
      this.transitionAlpha = 0;
    }

    sync(gameState, match) {
      this.presentation = this.stateManager.build(gameState, match);
      return this.presentation;
    }

    update(bounds, deltaMs) {
      if (!this.presentation || !bounds) return;
      this.crowd.update(this.presentation, deltaMs);
      this.transitionAlpha = this.transitions.update(`${this.presentation.stage}-${this.presentation.event?.type || "none"}-${this.presentation.event?.minute || 0}`, deltaMs);
      this.particles = this.effects.update(this.presentation, bounds, deltaMs);
    }
  }

  const FootballIdentityTheme = {
    apply(state, presentation) {
      const root = document.documentElement;
      if (!root) return;
      const homeIdentity = presentation?.homeIdentity || FMG.getClubIdentity?.(state?.userTeamId);
      const awayIdentity = presentation?.awayIdentity;
      if (homeIdentity) {
        root.style.setProperty("--broadcast-home", homeIdentity.primary);
        root.style.setProperty("--broadcast-home-accent", homeIdentity.accent);
      }
      if (awayIdentity) {
        root.style.setProperty("--broadcast-away", awayIdentity.primary);
        root.style.setProperty("--broadcast-away-accent", awayIdentity.accent);
      }
      root.dataset.matchStage = presentation?.stage || "menu";
      root.dataset.weather = presentation?.weather?.code || "clear";
      root.dataset.derby = presentation?.derby ? "true" : "false";
    }
  };

  const PresentationController = {
    stateManager: new PresentationStateManager(),

    getState(state, match) {
      return this.stateManager.build(state, match);
    },

    renderMatchIntro(presentation, escapeHtml) {
      if (!presentation) return "";
      return `
        <div class="broadcast-intro broadcast-intro--${escapeHtml(presentation.stage)}">
          <div>
            <span>${escapeHtml(presentation.tournament)}</span>
            <strong>${escapeHtml(presentation.headline)}</strong>
            <p>${escapeHtml(presentation.strapline)}</p>
          </div>
          <div class="broadcast-tags">
            <span>${escapeHtml(presentation.weather.label)}</span>
            <span>Ambiente ${Math.round(presentation.crowd)}%</span>
            <span>${escapeHtml(presentation.rivalryName)}</span>
          </div>
        </div>
      `;
    }
  };

  FMG.PresentationStateManager = PresentationStateManager;
  FMG.MatchAtmosphereController = MatchAtmosphereController;
  FMG.FootballIdentityTheme = FootballIdentityTheme;
  FMG.PresentationController = PresentationController;
})();
