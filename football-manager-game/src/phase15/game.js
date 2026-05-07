(function () {
  "use strict";

  // ============================================================
  // FASE 15 — VERTICAL SLICE: motor de juego 2D independiente
  // ============================================================

  const FIELD = { w: 780, h: 520, goalW: 12, goalH: 90 };
  const BALL_R = 8;
  const PLAYER_R = 12;
  const PLAYER_SPEED = 2.8;
  const AI_SPEED = 2.2;
  const BALL_FRICTION = 0.985;
  const SHOOT_POWER = 9;
  const PASS_POWER = 6;
  const TICK_MS = 1000 / 60;

  function vec(x, y) { return { x, y }; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function norm(v) {
    const d = Math.hypot(v.x, v.y) || 1;
    return vec(v.x / d, v.y / d);
  }
  function add(a, b) { return vec(a.x + b.x, a.y + b.y); }
  function scale(v, s) { return vec(v.x * s, v.y * s); }
  function sub(a, b) { return vec(a.x - b.x, a.y - b.y); }

  function makePlayer(id, x, y, isUser) {
    return { id, x, y, vx: 0, vy: 0, isUser, hasBall: false, team: isUser ? 0 : 1 };
  }

  function makeBall(x, y) {
    return { x, y, vx: 0, vy: 0, owner: null };
  }

  function makeState() {
    return {
      running: false,
      paused: false,
      score: [0, 0],
      minute: 0,
      maxMinutes: 1,
      ball: makeBall(FIELD.w / 2, FIELD.h / 2),
      // Equipo usuario: 5 jugadores lado izquierdo
      userTeam: [
        makePlayer("u0", 60,  FIELD.h / 2, true),
        makePlayer("u1", 180, FIELD.h / 2 - 100, true),
        makePlayer("u2", 180, FIELD.h / 2 + 100, true),
        makePlayer("u3", 300, FIELD.h / 2 - 60, true),
        makePlayer("u4", 300, FIELD.h / 2 + 60, true)
      ],
      // Equipo rival: 5 jugadores lado derecho
      aiTeam: [
        makePlayer("a0", FIELD.w - 60,  FIELD.h / 2, false),
        makePlayer("a1", FIELD.w - 180, FIELD.h / 2 - 100, false),
        makePlayer("a2", FIELD.w - 180, FIELD.h / 2 + 100, false),
        makePlayer("a3", FIELD.w - 300, FIELD.h / 2 - 60, false),
        makePlayer("a4", FIELD.w - 300, FIELD.h / 2 + 60, false)
      ],
      // Jugador controlado por el usuario (el más cercano al balón)
      controlled: null,
      keys: {},
      tickCount: 0,
      goalFlash: 0  // frames de flash al marcar gol
    };
  }

  // ---- Física ----

  function moveBall(ball) {
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= BALL_FRICTION;
    ball.vy *= BALL_FRICTION;

    // Rebote en bordes laterales
    if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.vy *= -0.7; }
    if (ball.y + BALL_R > FIELD.h) { ball.y = FIELD.h - BALL_R; ball.vy *= -0.7; }

    // Rebote en líneas de fondo (fuera del área de gol)
    const goalTop = (FIELD.h - FIELD.goalH) / 2;
    const goalBot = goalTop + FIELD.goalH;

    if (ball.x - BALL_R < 0) {
      if (ball.y >= goalTop && ball.y <= goalBot) return "goal-right";
      ball.x = BALL_R; ball.vx *= -0.7;
    }
    if (ball.x + BALL_R > FIELD.w) {
      if (ball.y >= goalTop && ball.y <= goalBot) return "goal-left";
      ball.x = FIELD.w - BALL_R; ball.vx *= -0.7;
    }
    return null;
  }

  function movePlayer(p, dx, dy, speed) {
    p.x = Math.max(PLAYER_R, Math.min(FIELD.w - PLAYER_R, p.x + dx * speed));
    p.y = Math.max(PLAYER_R, Math.min(FIELD.h - PLAYER_R, p.y + dy * speed));
  }

  function playerBallCollision(p, ball) {
    if (dist(p, ball) < PLAYER_R + BALL_R) {
      const d = norm(sub(ball, p));
      ball.x = p.x + d.x * (PLAYER_R + BALL_R + 1);
      ball.y = p.y + d.y * (PLAYER_R + BALL_R + 1);
      if (ball.owner === null) {
        ball.vx = d.x * 2;
        ball.vy = d.y * 2;
      }
    }
  }

  // ---- Control usuario ----

  function updateControlled(state) {
    // El jugador controlado es el más cercano al balón del equipo usuario
    let best = null, bestD = Infinity;
    state.userTeam.forEach((p) => {
      const d = dist(p, state.ball);
      if (d < bestD) { bestD = d; best = p; }
    });
    state.controlled = best;
  }

  function applyUserInput(state) {
    const p = state.controlled;
    if (!p) return;
    const k = state.keys;
    let dx = 0, dy = 0;
    if (k["ArrowLeft"] || k["a"]) dx -= 1;
    if (k["ArrowRight"] || k["d"]) dx += 1;
    if (k["ArrowUp"] || k["w"]) dy -= 1;
    if (k["ArrowDown"] || k["s"]) dy += 1;
    if (dx !== 0 || dy !== 0) {
      const d = norm(vec(dx, dy));
      movePlayer(p, d.x, d.y, PLAYER_SPEED);
    }

    // Pase: Z / J
    if ((k["z"] || k["j"]) && !k["_passUsed"]) {
      k["_passUsed"] = true;
      const target = nearestTeammate(p, state.userTeam);
      if (target) {
        const dir = norm(sub(target, state.ball));
        state.ball.vx = dir.x * PASS_POWER;
        state.ball.vy = dir.y * PASS_POWER;
        state.ball.owner = null;
      }
    }
    if (!k["z"] && !k["j"]) k["_passUsed"] = false;

    // Tiro: X / K
    if ((k["x"] || k["k"]) && !k["_shootUsed"]) {
      k["_shootUsed"] = true;
      const goalX = FIELD.w;
      const goalY = FIELD.h / 2;
      const dir = norm(sub(vec(goalX, goalY), state.ball));
      state.ball.vx = dir.x * SHOOT_POWER;
      state.ball.vy = dir.y * SHOOT_POWER;
      state.ball.owner = null;
    }
    if (!k["x"] && !k["k"]) k["_shootUsed"] = false;
  }

  function nearestTeammate(player, team) {
    let best = null, bestD = Infinity;
    team.forEach((p) => {
      if (p === player) return;
      const d = dist(p, player);
      if (d < bestD) { bestD = d; best = p; }
    });
    return best;
  }

  // ---- IA básica ----

  function updateAI(state) {
    const ball = state.ball;
    const goalX = 0;  // La IA ataca hacia la izquierda
    const goalY = FIELD.h / 2;

    state.aiTeam.forEach((p, i) => {
      let target;
      const ballDist = dist(p, ball);

      if (i === 0) {
        // Portero: se queda cerca del arco
        target = vec(FIELD.w - 40, FIELD.h / 2 + (ball.y - FIELD.h / 2) * 0.4);
      } else if (ballDist < 120) {
        // El más cercano persigue el balón
        target = ball;
      } else {
        // Los demás mantienen posición ofensiva escalonada
        const baseX = FIELD.w - 180 - (i % 3) * 80;
        const baseY = FIELD.h / 2 + (i % 2 === 0 ? -80 : 80);
        target = vec(baseX, baseY);
      }

      const dir = norm(sub(target, p));
      movePlayer(p, dir.x, dir.y, AI_SPEED * 0.6);

      // Si está muy cerca del balón, chuta hacia el arco usuario
      if (ballDist < PLAYER_R + BALL_R + 4 && Math.random() < 0.04) {
        const shootDir = norm(sub(vec(goalX, goalY), ball));
        ball.vx = shootDir.x * SHOOT_POWER * 0.85;
        ball.vy = shootDir.y * SHOOT_POWER * 0.85;
      }
    });
  }

  // ---- Reset tras gol ----

  function resetKickoff(state) {
    state.ball = makeBall(FIELD.w / 2, FIELD.h / 2);
    state.userTeam.forEach((p, i) => {
      p.x = [60, 180, 180, 300, 300][i];
      p.y = [FIELD.h / 2, FIELD.h / 2 - 100, FIELD.h / 2 + 100, FIELD.h / 2 - 60, FIELD.h / 2 + 60][i];
    });
    state.aiTeam.forEach((p, i) => {
      p.x = FIELD.w - [60, 180, 180, 300, 300][i];
      p.y = [FIELD.h / 2, FIELD.h / 2 - 100, FIELD.h / 2 + 100, FIELD.h / 2 - 60, FIELD.h / 2 + 60][i];
    });
  }

  // ---- Tick principal ----

  function tick(state) {
    if (!state.running || state.paused) return;

    updateControlled(state);
    applyUserInput(state);
    updateAI(state);

    // Mover todos los jugadores con colisión de balón
    [...state.userTeam, ...state.aiTeam].forEach((p) => playerBallCollision(p, state.ball));

    const goalEvent = moveBall(state.ball);

    if (goalEvent === "goal-left") {
      state.score[0] += 1;
      state.goalFlash = 60;
      resetKickoff(state);
    } else if (goalEvent === "goal-right") {
      state.score[1] += 1;
      state.goalFlash = 60;
      resetKickoff(state);
    }

    if (state.goalFlash > 0) state.goalFlash--;

    state.tickCount++;
    // 1 minuto de juego = 60 ticks (1 segundo real)
    state.minute = Math.floor(state.tickCount / 60);
    if (state.minute >= state.maxMinutes) {
      state.running = false;
      state.finished = true;
    }
  }

  // ---- API pública ----

  window.FMG = window.FMG || {};
  window.FMG.Phase15 = {
    FIELD,
    BALL_R,
    PLAYER_R,
    makeState,
    tick,
    resetKickoff
  };
})();
