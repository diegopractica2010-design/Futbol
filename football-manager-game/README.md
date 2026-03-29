# Football Manager Game Chile

Simulador web de gestion futbolistica inspirado en el rol de manager de un club chileno. El proyecto funciona como SPA sin frameworks, con estado centralizado, simulacion semanal de temporada, mercado de fichajes, finanzas, eventos aleatorios y persistencia en `localStorage`.

## Caracteristicas

- Seleccion de club entre siete equipos chilenos.
- Temporada todos contra todos con tabla de posiciones.
- Simulacion de partidos basada en nivel, moral y energia.
- Mercado de compra y venta con presupuesto y plantillas.
- Finanzas semanales con ingresos, gastos y eventos.
- Guardado y carga de progreso en el navegador.

## Estructura

- `index.html`: punto de entrada, layout, estilos y contenedor principal.
- `src/`: estado global, motores del juego y utilidades.
- `ui/`: vistas modulares que renderizan cada pantalla.
- `data/`: equipos y jugadores en JSON.
- `assets/icons.svg`: sprite SVG local para iconografia.

## Ejecucion

Como el proyecto carga JSON locales, conviene abrirlo desde un servidor estatico.

1. Con VS Code y Live Server, abrir `football-manager-game/index.html`.
2. Con Python:

```bash
cd football-manager-game
python -m http.server 8080
```

Luego visitar `http://localhost:8080`.
