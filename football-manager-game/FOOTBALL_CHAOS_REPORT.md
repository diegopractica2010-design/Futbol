# FOOTBALL CHAOS REPORT

## Sistema: _getChaosNudge(playerId, minute, momentum)

### Principio
El caos es **determinista y contextual**. No es ruido aleatorio sino comportamiento
situacional basado en el estado del partido. Se recalcula cada 2 minutos de partido (slot).

### Seed
```
mulberry32(hashSeed(playerId + ":chaos:" + Math.floor(minute / 2)))
```
El mismo partido reproduce los mismos offsets de caos en el mismo minuto.

### Escenarios implementados

#### Pánico defensivo
- **Condición**: DEF, momentum < 35 (o >65 visitante)
- **Efecto**: offset X ±4.5 m, Z ±3.5 m escalado por presión
- **Look**: defensores perdiendo la marca, línea rota

#### Sobrecarga atacante
- **Condición**: DEL o EXT, desequilibrio de momentum > 40%
- **Efecto**: offset X ±3 m, Z hacia área rival hasta +2 m
- **Look**: llegada de jugadores en zona de remate

#### Segunda pelota
- **Condición**: MED, probabilidad 30% por slot
- **Efecto**: offset X ±2.8 m, Z ±2.2 m — carrera corta de recuperación
- **Look**: centrocampistas disputando posición

#### Desespero final
- **Condición**: min > 80, probabilidad 25%
- **Efecto**: Z ±4 m hacia el arco rival (o propio), X ±2 m
- **Look**: corridas desesperadas hacia adelante o atrás

### Intensidad
- Pressuref = `|momentum - 50| / 50` — 0 cuando está equilibrado, 1 cuando es total
- Todos los offsets escalan por `pressuref` — sin dominio no hay caos exagerado

### Lo que NO es caos
- No hay comportamiento absurdo (jugadores fuera del campo)
- No hay eventos contradictorios con la simulación
- Las zonas de arco (portero) no están afectadas por el chaos engine
