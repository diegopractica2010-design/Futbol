(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  const FIELD_WIDTH = 105;
  const FIELD_HEIGHT = 68;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function hashId(value) {
    const text = String(value || "");
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 33 + text.charCodeAt(index)) >>> 0;
    }
    return hash;
  }

  function phaseFrom(match, playerId, scale) {
    const minute = Number(match?.minute) || 0;
    return minute * scale + ((hashId(playerId) % 360) * Math.PI / 180);
  }

  function roleProfile(player) {
    const code = player?.positionCode || player?.position || "";
    if (code === "POR") return { line: "keeper", depth: 0, width: 0.1, press: 0.2, support: 0.15 };
    if (code === "DEF") return { line: "defense", depth: 0.22, width: 0.7, press: 0.42, support: 0.34 };
    if (code === "MED") return { line: "midfield", depth: 0.52, width: 0.82, press: 0.72, support: 0.82 };
    if (code === "EXT") return { line: "wing", depth: 0.64, width: 1.05, press: 0.7, support: 0.74 };
    return { line: "attack", depth: 0.8, width: 0.74, press: 0.62, support: 0.58 };
  }

  function getOrders(match, isHome) {
    const side = isHome ? "home" : "away";
    return match?.liveOrders?.[side] || { mentality: "balanced", press: "normal", tempo: "normal", risk: "normal" };
  }

  function getMatchPhase(match) {
    const timeline = Array.isArray(match?.result?.timeline) ? match.result.timeline : [];
    const minute = Number(match?.minute) || 0;
    const last = timeline.filter((event) => Number(event.minute) <= minute).slice(-1)[0] || null;
    if (!last) return { type: "settled", event: null, intensity: 0.35 };
    const age = clamp(minute - Number(last.minute || minute), 0, 8);
    const intensity = clamp(1 - age / 8, 0.18, 1);
    if (last.type === "goal") return { type: "restart", event: last, intensity };
    if (last.type === "shot" || last.type === "shot-on-target" || last.type === "chance") return { type: "attack", event: last, intensity };
    if (last.type === "foul" || last.type === "yellow-card" || last.type === "red-card") return { type: "broken", event: last, intensity };
    if (last.type === "tactical") return { type: "transition", event: last, intensity };
    return { type: "settled", event: last, intensity };
  }

  class TacticalPositioningEngine {
    constructor(options = {}) {
      this.fieldWidth = options.fieldWidth || FIELD_WIDTH;
      this.fieldHeight = options.fieldHeight || FIELD_HEIGHT;
    }

    compute(match, players, ballPosition) {
      const playerList = Object.keys(players || {}).map((id) => players[id]);
      const phase = getMatchPhase(match);
      const homePossession = Number(match?.result?.stats?.home?.possession) || 50;
      const momentum = Number(match?.momentum) || 50;
      const ball = this._estimateBall(match, playerList, ballPosition, phase);
      const targets = {};
      const supportLines = [];
      const pressZones = [];
      const shapeLines = { home: [], away: [] };

      playerList.forEach((player) => {
        const target = this._targetForPlayer(match, player, ball, phase, homePossession, momentum);
        targets[player.id] = target;
        const side = player.isHome ? "home" : "away";
        shapeLines[side].push(target);
        if (this._isSupport(player, ball, phase)) supportLines.push({ from: target, to: ball, side });
      });

      ["home", "away"].forEach((side) => {
        const isHome = side === "home";
        const orders = getOrders(match, isHome);
        const teamHasBall = this._teamHasBall(match, isHome, homePossession, phase);
        if (!teamHasBall && orders.press !== "low") {
          pressZones.push({
            side,
            center: { x: ball.x, y: 0, z: ball.z },
            radius: orders.press === "high" ? 15 : 10,
            intensity: orders.press === "high" ? 0.72 : 0.42
          });
        }
      });

      return {
        ball,
        targets,
        overlays: {
          supportLines: supportLines.slice(0, 8),
          pressZones,
          shapeLines: {
            home: this._lineSegments(shapeLines.home),
            away: this._lineSegments(shapeLines.away)
          },
          phase
        }
      };
    }

    _targetForPlayer(match, player, ball, phase, homePossession, momentum) {
      const role = roleProfile(player);
      const orders = getOrders(match, player.isHome);
      const base = player.basePosition || player.mesh?.position || { x: 0, z: 0 };
      const sideSign = player.isHome ? 1 : -1;
      const teamHasBall = this._teamHasBall(match, player.isHome, homePossession, phase);
      const possessionBias = player.isHome ? homePossession - 50 : 50 - homePossession;
      const momentumBias = player.isHome ? momentum - 50 : 50 - momentum;
      const attackIntent = orders.mentality === "attack" ? 1 : orders.mentality === "defend" ? -1 : 0;
      const tempo = orders.tempo === "fast" ? 1.15 : orders.tempo === "slow" ? 0.72 : 0.92;
      const press = orders.press === "high" ? 1 : orders.press === "low" ? -0.55 : 0;
      const risk = orders.risk === "direct" ? 1 : orders.risk === "safe" ? -0.7 : 0;
      const phaseWave = phaseFrom(match, player.id, 0.32 * tempo);
      const laneWave = Math.cos(phaseWave) * (2.4 + role.width * 1.8);
      const offBallRun = teamHasBall ? Math.sin(phaseWave * 0.7) * role.support * 5 : 0;
      const compactness = teamHasBall ? 0.25 : 0.74 + Math.max(0, press) * 0.18;
      const ballPullX = (ball.x - base.x) * compactness * (role.line === "keeper" ? 0.02 : 0.16);
      const ballPullZ = (ball.z - base.z) * compactness * (role.line === "keeper" ? 0.02 : 0.11);
      const transitionLift = phase.type === "transition" ? phase.intensity * 4 : phase.type === "attack" && teamHasBall ? phase.intensity * 6 : 0;
      const defensiveDrop = teamHasBall ? 0 : role.press * 5 + (press < 0 ? 4 : 0);
      const supportPocket = teamHasBall && role.line === "midfield" ? -sideSign * 2.6 : 0;

      const x = base.x + ballPullX + laneWave * role.width + (teamHasBall ? risk * laneWave * 0.25 : 0);
      const z = base.z
        + ballPullZ
        + sideSign * (possessionBias * 0.11 + momentumBias * 0.1 + attackIntent * 5 + transitionLift + offBallRun - defensiveDrop)
        + supportPocket;

      return {
        x: clamp(x, -this.fieldWidth / 2 + 4, this.fieldWidth / 2 - 4),
        y: 0,
        z: clamp(z, -this.fieldHeight / 2 + 2, this.fieldHeight / 2 - 2),
        role: role.line,
        teamHasBall
      };
    }

    _teamHasBall(match, isHome, homePossession, phase) {
      if (phase.event?.teamId) {
        return isHome ? phase.event.teamId === match.homeTeamId : phase.event.teamId === match.awayTeamId;
      }
      return isHome ? homePossession >= 50 : homePossession < 50;
    }

    _estimateBall(match, players, currentBall, phase) {
      const event = phase.event;
      const actor = event?.playerId ? players.find((player) => player.id === event.playerId) : null;
      if (actor) return { x: actor.mesh.position.x, y: 0.22, z: actor.mesh.position.z };
      if (currentBall) return { x: currentBall.x || 0, y: currentBall.y || 0.22, z: currentBall.z || 0 };
      const minute = Number(match?.minute) || 0;
      const homePossession = Number(match?.result?.stats?.home?.possession) || 50;
      const direction = homePossession >= 50 ? 1 : -1;
      return {
        x: Math.sin(minute * 0.31) * 22,
        y: 0.22,
        z: direction * (Math.cos(minute * 0.21) * 12),
      };
    }

    _isSupport(player, ball, phase) {
      const role = roleProfile(player);
      if (role.line === "keeper") return false;
      const dx = Math.abs((player.mesh?.position?.x || 0) - ball.x);
      const dz = Math.abs((player.mesh?.position?.z || 0) - ball.z);
      return phase.type !== "broken" && dx + dz < 34 && role.support > 0.5;
    }

    _lineSegments(points) {
      return [...points]
        .filter(Boolean)
        .sort((left, right) => left.z - right.z || left.x - right.x)
        .slice(0, 11);
    }
  }

  FMG.TacticalPositioningEngine = TacticalPositioningEngine;
})();
