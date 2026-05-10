# Football Manager Chile

Simulador web de gestion futbolistica chilena en vanilla JavaScript con Three.js. Funciona como SPA desplegable en GitHub Pages o Netlify, carga datos locales desde `data/`, guarda progreso en `localStorage` y permite exportar/importar partidas.

Estado actual: fase publica 24 en navegador. La suite historica de tests conserva compatibilidad con fase 13 en Node.

## Caracteristicas

- Seleccion de club chileno con dificultad visible.
- Liga ampliada en navegador, Copa Chile, supercopa e internacional simplificada.
- Partido en vivo con visualizador 3D, momentum, relato, tacticas, cambios y eventos traducidos.
- Simulacion de partidos con constantes unificadas entre modo texto y modo vivo.
- Planteles con profundidad, agentes libres, lesiones, sanciones, moral y energia.
- Mercado, cesiones, renovaciones, ofertas recibidas e IA rival.
- Finanzas con presupuestos, prestamos, sponsors, TV, infraestructura, staff y fair play.
- Carrera de manager con reputacion, objetivos, logros, noticias y decisiones narrativas.
- Guardado por slots, autosave, historial de notificaciones y export/import validado.
- Onboarding, creditos/version, meta tags sociales y error de servidor local comprensible.

## Estructura

- `index.html`: punto de entrada.
- `css/styles.css`: interfaz, accesibilidad visual y visualizador.
- `src/`: motores, estado, guardado, simulacion y fases 3D.
- `ui/`: vistas renderizadas por ruta.
- `data/`: seed base de equipos y jugadores.
- `tests/`: regresion automatizada.

## Ejecucion Local

El juego debe abrirse desde un servidor web, no con doble clic sobre `index.html`.

```bash
cd football-manager-game
python -m http.server 8080
```

Luego abre `http://localhost:8080`.

Alternativas:

- VS Code: extension Live Server, clic derecho en `index.html`, "Open with Live Server".
- Node.js: `npx serve .`.

## Pruebas

```bash
npm test
```

Tambien se puede verificar sintaxis de todos los scripts con:

```bash
Get-ChildItem -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```
