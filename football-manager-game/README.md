# Football Manager Game Chile

Simulador web de gestion futbolistica inspirado en el rol de manager de un club chileno. El proyecto funciona como SPA sin frameworks, con estado centralizado, simulacion semanal de temporada, mercado de fichajes, finanzas, eventos aleatorios y persistencia en `localStorage`.

Estado actual: Fase 4 implementada. Esta base ya permite jugar el partido del usuario minuto a minuto y configurar tacticas profundas, aunque todavia quedan fases de plantilla avanzada, contratos, carrera, IA rival avanzada y contenido final.

## Caracteristicas

- Seleccion de club entre siete equipos chilenos.
- Temporada todos contra todos con tabla de posiciones.
- Simulacion de partidos basada en nivel, moral y energia.
- Mercado de compra y venta con presupuesto y plantillas.
- Finanzas semanales con ingresos, gastos y eventos.
- Guardado y carga de progreso en el navegador con manejo de partidas corruptas.
- Datos cargados desde `data/teams.json` y `data/players.json`.
- Pruebas automatizadas basicas para temporada, economia, mercado y guardado.
- Historial de temporadas, campeon y reinicio de temporada.
- Formaciones, once titular automatico, entrenamiento semanal, contratos, lesiones y sanciones.
- Ventanas de mercado al inicio y cierre de temporada.
- Simulador de partido por eventos con posesion, remates, xG, faltas, tarjetas, lesiones y relato minuto a minuto.
- Partido en vivo con avance por minutos, velocidades, cambios, ajustes tacticos basicos, momentum y cierre de fecha.
- Tacticas avanzadas con mentalidad, presion, ritmo, pase, anchura, linea defensiva, roles por posicion e instrucciones individuales.
- Previa tactica del siguiente rival con comparacion de perfiles.

## Estructura

- `index.html`: punto de entrada y contenedor principal.
- `css/`: estilos de la interfaz.
- `src/`: estado global, motores del juego y utilidades.
- `ui/`: vistas modulares que renderizan cada pantalla.
- `data/`: equipos y jugadores en JSON.
- `assets/icons.svg`: sprite SVG local para iconografia.
- `tests/`: pruebas de estabilidad de la fase actual.

## Ejecucion

Como el proyecto carga JSON locales, conviene abrirlo desde un servidor estatico.

1. Con VS Code y Live Server, abrir `football-manager-game/index.html`.
2. Con Python:

```bash
cd football-manager-game
python -m http.server 8080
```

Luego visitar `http://localhost:8080`.

## Pruebas

```bash
npm test
```
