# MATCH STORYTELLING REPORT

## Sistema: _story state + _drawStorytellingOverlay()

### Estado narrativo
```js
this._story = {
  dominantSide: "neutral" | "home" | "away",
  intensity: 0–1,      // minutos finales
  tintAlpha: 0–0.055,
  tintColor: string
}
```

### Detección de dominio
| Condición | Estado |
|-----------|--------|
| momentum > 62 AND posesión > 57% | dominantSide = "home" |
| momentum < 38 AND posesión < 43% | dominantSide = "away" |
| Resto | "neutral" |

### Señales visuales por estado

#### Equipo local dominando
- Tinte naranja-cálido `rgba(255,180,60)` sobre el campo (alpha ~0.04)
- Línea horizontal azul translúcida en el 82% del alto del campo
  → indica línea defensiva baja del visitante

#### Equipo visitante dominando
- Tinte azul-frío `rgba(60,130,220)` sobre el campo (alpha ~0.04)
- Línea horizontal dorada translúcida en el 18% del alto del campo
  → indica línea defensiva baja del local

#### Minutos finales (min 80–90)
- `intensity = (minute - 80) / 10`
- Tinte rojo-fuego `rgba(180,60,20)` escalado por intensity (hasta alpha 0.055)
- Pulso de borde rojo: gradiente radial sinusoidal que parpadea con `sin(t * 0.006)`
- El campo literalmente "arde" visualmente en los últimos minutos

### Estado neutral
- Sin tinte
- Sin líneas narrativas
- El campo se muestra en su paleta natural de césped

### Integración con el partido
- Se actualiza en `setMatchContext()` en cada sync del partido en vivo
- No tiene estado persistente entre partidos (se reinicia con el visualizador)
- No afecta la simulación — es capa 100% visual

### Impacto psicológico esperado
- El jugador percibe inconscientemente que algo está cambiando en el partido
- La calidez/frialdad del campo señala quién lleva el control
- El pulso rojo final genera urgencia emocional sin texto explícito
