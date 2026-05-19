# DRESSING ROOM REPORT
**Fase 3+4 — Eventos del Vestidor**
**Fecha:** 2026-05-19

## Estado: state.dressingRoomEvents[]

Máximo 20 eventos, gestionado por `boundedPush`.
Persistido en save mediante `state.dressingRoomEvents`.

## Estructura de Evento

```javascript
{
  id: String,           // ID determinista único
  week: Number,
  seasonNumber: Number,
  resolved: Boolean,
  type: String,         // Tipo de evento
  title: String,        // Título corto
  description: String,  // 2 líneas de contexto
  icon: String,         // Emoji de categoría
  playerId: String | null,
  choices: [            // Opciones opcionales del manager
    { label: String, effect: Object }
  ]
}
```

## Tipos de Eventos

| Tipo | Ícono | Trigger |
|------|-------|---------|
| `ego-clash` | ⚡💥🚪 | Ego > 75 benched 3+ semanas; choque inter-egos; transferRequest |
| `faction-conflict` | 🔥 | Facción strength > 65 con mood ≤ 60 |
| `mentor-bond` | 🤝 | Veterano detecta joven en misma posición |
| `toxic-spread` | ☠️ | Toxicidad > 60 (cada 2 semanas) |
| `captain-speech` | 👑 | Capitán ego > 75 (cada 4 semanas) |
| `leadership-void` | 👥 | No hay capitán ni jerarquía |

## Anti-Duplicados

ID determinista: `deterministicId("dre", [type, season, week, playerId || title])`
Un evento con mismo ID no se registra dos veces en la misma semana.

## Uso en UI

Los eventos están disponibles en `state.dressingRoomEvents` para renderizar en la pantalla de resumen semanal. Cada evento tiene:
- `icon` para identificación visual
- `title` de 1 línea
- `description` de 2 líneas
- `choices[]` con efectos del manager (para implementación UI futura)
