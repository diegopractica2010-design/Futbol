# Emotional Decision Report

Fecha: 2026-05-18

## Confidence Layer

- Cada jugador recibe `player.confidence` 0-100 con variacion deterministica por `player.id`.
- Confianza alta `>70`:
  - multiplica conversion de tiro por `1.08`.
  - sube levemente presion/ofensividad.
  - mejora precision al arco.
- Confianza baja `<35`:
  - reduce conversion de tiro.
  - reduce probabilidad ofensiva.
  - favorece decisiones mas seguras.
- La confianza se actualiza al cierre del partido con goles, tiros al arco, tarjetas, lesiones y resultado del equipo.

## Emotional Momentum

- `liveMatch.momentum` se conserva y se extiende con `liveMatch.emotional_momentum`.
- Gol: surge emocional de `+20` para el equipo que marca durante 6 minutos.
- Atajada/remate al arco sin gol: boost defensivo de `+12`.
- Error claro de definicion con xG alto: bajon de `-15`.
- En derbis, los swings emocionales se multiplican por `1.3`.

## Fatigue Psychology

- `player.mental_fatigue` queda separado de energia fisica y de `profile.fatigue`.
- Fatiga mental alta `>70` reduce calidad de decision, posicionamiento y fuerza efectiva.
- Fatiga mental baja `<30` activa estado de flujo con bonus leve.
- Semana de descanso reduce `mental_fatigue` en 20 si el jugador esta sano.

## Decision Hooks

- La capa emocional afecta fuerza de equipo, presion, precision de tiro, precision al arco y errores posicionales.
- Los efectos se aplican por minuto para evitar carga por frame.
