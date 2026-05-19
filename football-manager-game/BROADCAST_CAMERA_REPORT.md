# BROADCAST CAMERA REPORT

## Clase: BroadcastCamera

### Arquitectura
- Estado: `panX`, `panY`, `zoom` (actuales) + `tX`, `tY`, `tZoom` (objetivos)
- Velocidades: `vX`, `vY`, `vZ` con carry 0.74 (inercia de cámara TV)
- Shake: `shakeAmt` con RNG seeded (`mulberry32(hashSeed("camshake"))`)

### Comportamiento por evento
| Evento | Zoom objetivo | Shake | Duración retorno |
|--------|--------------|-------|-----------------|
| Gol | 1.14 | 5.5 px | 1400 ms |
| Remate | 1.07 | — | 700 ms |
| Contrataque/chance | 0.91 | — | 900 ms |

### Seguimiento del balón
- Dead-zone: el target solo se mueve si el balón está >7% del campo desde el centro de cámara
- Lerp suave: `tX += dx * 0.28` por llamada
- Límite de pan: ±14% del ancho/alto del campo (nunca corta los postes)

### Transformación
- `transformBounds(bounds)` retorna los bounds del campo ampliados/reducidos por zoom
  centrados en el punto de interés de la cámara
- Shake: `getShakeOffset()` con generador seeded, no afecta determinismo

### Calidad cinematográfica
- La cámara **sigue lentamente** al balón (no snapea)
- El zoom de gol es suave (inercia 0.74) — no es instantáneo
- El shake decae en 150 ms aprox (0.038 × dt)
- En contador el zoom se aleja para dar sensación de campo abierto

### Lo que NO hace (por diseño)
- No existe perspectiva 3D real — la ilusión es completamente 2D
- No hay tilt isométrico (canvas 2D plano con gradiente de profundidad en el pitch)
