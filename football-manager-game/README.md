# Football Life

Simulador web de gestión futbolística chilena. Stack: **Vite + JavaScript (ES modules)**.

## Requisitos

- Node.js 18+
- Navegador moderno

## Arrancar

```bash
cd football-manager-game
npx vite
```

Abrir `http://localhost:5173`.

## Build producción

```bash
npx vite build
```

El output queda en `dist/`.

## Tests

```bash
node tests/run-all.js
```

## Estructura

```
football-manager-game/
├── index.html              # Entry point (Vite)
├── vite.config.js
├── src/                    # Código fuente (IIFE → window.FMG)
│   ├── boot.js             # Cadena de imports (orden de dependencias)
│   └── main.js             # Router principal
├── simulation/             # Motor 2D oficial
│   ├── engine/             # Framework de sistemas (antes phase16)
│   ├── animation/          # Animación de jugadores (antes phase17)
│   ├── ai/                 # IA de equipos (antes phase18)
│   ├── goalkeeper/         # Porteros (antes phase19)
│   ├── broadcast/          # Cámara broadcast (antes phase20)
│   ├── stadium/            # Estadio (antes phase21)
│   ├── hud/                # HUD final (antes phase22)
│   ├── audio/              # Audio de partido (antes phase23)
│   └── tactics/            # Tácticas en cancha (antes phase24)
├── ui/                     # Vistas renderizadas por ruta
├── persistence/            # Persistencia (IndexedDB, etc.)
├── data/                   # Datos de equipos y jugadores
├── tests/                  # Tests de regresión (Node.js)
├── docs/                   # Documentación vigente
│   └── legacy/             # Reportes históricos archivados
├── assets/                 # Estáticos (favicon, manifest, etc.)
└── dist/                   # Build de producción (generado por Vite)
```

## Modo dev

Agrega `?dev` a la URL para mostrar los sandboxes del motor 2D.
