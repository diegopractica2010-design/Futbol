(function () {
  "use strict";

  // ============================================================
  // FASE 15 — RENDERER canvas 2D (sin Three.js, sin deps)
  // ============================================================

  const { FIELD, BALL_R, PLAYER_R } = window.FMG.Phase15;

  const COLORS = {
    grass:       "#2d7a3a",
    grassAlt:    "#2a7236",
    line:        "rgba(255,255,255,0.85)",
    goalPost:    "#ffffff",
    userTeam:    "#1a6fc4",
    aiTeam:      "#c42b1a",
    controlled:  "#f0c040",
    ball:        "#f5f5f0",
    ballShadow:  "rgba(0,0,0,0.25)",
    hud:         "rgba(10,20,12,0.82)",
    hudText:     "#ffffff",
    goalFlash:   "rgba(255,220,50,0.22)"
  };

  function drawField(ctx) {
    // Fondo pasto con franjas
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? COLORS.grass : COLORS.grassAlt;
      ctx.fillRect(i * (FIELD.w / 10), 0, FIELD.w / 10, FIELD.h);
    }

    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;

    // Borde exterior
    ctx.strokeRect(1, 1, FIELD.w - 2, FIELD.h - 2);

    // Línea media
    ctx.beginPath();
    ctx.moveTo(FIELD.w / 2, 0);
    ctx.lineTo(FIELD.w / 2, FIELD.h);
    ctx.stroke();

    // Círculo central
    ctx.beginPath();
    ctx.arc(FIELD.w / 2, FIELD.h / 2, 50, 0, Math.PI * 2);
    ctx.stroke();

    // Punto central
    ctx.fillStyle = COLORS.line;
    ctx.beginPath();
    ctx.arc(FIELD.w / 2, FIELD.h / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Áreas de gol
    const goalTop = (FIELD.h - FIELD.goalH) / 2;
    const areaH = 120;
    const areaW = 60;

    // Área izquierda
    ctx.strokeRect(0, (FIELD.h - areaH) / 2, areaW, areaH);
    // Área derecha
    ctx.strokeRect(FIELD.w - areaW, (FIELD.h - areaH) / 2, areaW, areaH);

    // Postes de gol (izquierda)
    ctx.strokeStyle = COLORS.goalPost;
    ctx.lineWidth = 4;
    ctx.strokeRect(-FIELD.goalW, goalTop, FIELD.goalW, FIELD.goalH);
    // Postes de gol (derecha)
    ctx.strokeRect(FIELD.w, goalTop, FIELD.goalW, FIELD.goalH);
  }

  function drawPlayer(ctx, p, isControlled) {
    // Sombra
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + PLAYER_R - 2, PLAYER_R * 0.9, PLAYER_R * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cuerpo
    ctx.fillStyle = p.team === 0 ? COLORS.userTeam : COLORS.aiTeam;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
    ctx.fill();

    // Borde del jugador controlado
    if (isControlled) {
      ctx.strokeStyle = COLORS.controlled;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER_R + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawBall(ctx, ball) {
    // Sombra
    ctx.fillStyle = COLORS.ballShadow;
    ctx.beginPath();
    ctx.ellipse(ball.x + 2, ball.y + BALL_R - 1, BALL_R * 0.9, BALL_R * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Balón
    ctx.fillStyle = COLORS.ball;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawHUD(ctx, state) {
    // Barra superior
    ctx.fillStyle = COLORS.hud;
    ctx.fillRect(0, 0, FIELD.w, 36);

    ctx.fillStyle = COLORS.hudText;
    ctx.font = "bold 16px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";

    const timeLeft = Math.max(0, state.maxMinutes * 60 - state.tickCount);
    const secs = timeLeft % 60;
    const mins = Math.floor(timeLeft / 60);
    const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    ctx.fillText(`Azul ${state.score[0]}  —  ${timeStr}  —  ${state.score[1]} Rojo`, FIELD.w / 2, 23);

    // Controles (esquina inferior)
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, FIELD.h - 22, FIELD.w, 22);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "11px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("Mover: WASD / Flechas  |  Pase: Z/J  |  Tiro: X/K  |  Pausa: P", FIELD.w / 2, FIELD.h - 7);

    // Flash de gol
    if (state.goalFlash > 0) {
      ctx.fillStyle = COLORS.goalFlash;
      ctx.fillRect(0, 0, FIELD.w, FIELD.h);
      ctx.fillStyle = "rgba(255,220,50,0.9)";
      ctx.font = "bold 48px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("¡GOL!", FIELD.w / 2, FIELD.h / 2);
    }

    // Pantalla de fin
    if (state.finished) {
      ctx.fillStyle = "rgba(10,20,12,0.78)";
      ctx.fillRect(0, 0, FIELD.w, FIELD.h);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 36px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("Partido terminado", FIELD.w / 2, FIELD.h / 2 - 30);
      ctx.font = "bold 28px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(`Azul ${state.score[0]}  —  ${state.score[1]} Rojo`, FIELD.w / 2, FIELD.h / 2 + 20);
      ctx.font = "16px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText("Presiona R para reiniciar", FIELD.w / 2, FIELD.h / 2 + 60);
    }

    if (state.paused && !state.finished) {
      ctx.fillStyle = "rgba(10,20,12,0.6)";
      ctx.fillRect(0, 0, FIELD.w, FIELD.h);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("PAUSA", FIELD.w / 2, FIELD.h / 2);
    }
  }

  function render(ctx, state) {
    ctx.clearRect(0, 0, FIELD.w, FIELD.h);
    drawField(ctx);
    [...state.aiTeam, ...state.userTeam].forEach((p) => {
      drawPlayer(ctx, p, p === state.controlled);
    });
    drawBall(ctx, state.ball);
    drawHUD(ctx, state);
  }

  window.FMG.Phase15.render = render;
})();
