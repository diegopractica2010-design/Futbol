# Revision de fases 1-23

## Base previa a Fase 14

Estas fases se infieren desde los tests `phase0` a `phase13`, el estado global y los modulos existentes.

- Fase 1: datos base, seleccion de club, calendario inicial y simulacion simple de temporada.
- Fase 2: tabla de posiciones, avance semanal y registro de resultados.
- Fase 3: plantilla, energia, moral y preparacion de jugadores para competir.
- Fase 4: mercado inicial de compras/ventas y presupuesto de club.
- Fase 5: economia semanal, ingresos, gastos y eventos financieros simples.
- Fase 6: guardado/carga local y tolerancia a partidas corruptas.
- Fase 7: historial de temporadas, campeon y reinicio de temporada.
- Fase 8: tacticas, formaciones, once titular, entrenamiento, lesiones y sanciones.
- Fase 9: motor de partido por eventos con posesion, remates, xG, faltas, tarjetas y relato.
- Fase 10: partido en vivo por minutos, momentum, cambios y ajustes tacticos.
- Fase 11: tacticas avanzadas, roles, instrucciones individuales y analisis del rival.
- Fase 12: identidad visual de clubes, vistas de jugador/rival/calendario/tabla y UI responsive.
- Fase 13: guardado robusto con slots, autosave, import/export, migracion y opciones de temporada.

## Estado desde Fase 14

- Fase 14: visualizador Three.js 3D integrado al partido en vivo, con cancha, camara broadcast, jugadores capsula, balon, HUD DOM y eventos sincronizados desde el timeline.
- Fase 15: gameplay base 2D con control, cambio manual, sprint, pase corto, pase largo, tiro, entrada e intercepcion simple.
- Fase 16: fisica simplificada del balon con friccion, rebotes, colision jugador/balon, altura visual, potencia, asistencia de pase y error calculado.
- Fase 17: animaciones procedurales con blend tree para idle, caminar, trotar, sprint, giro, pase, tiro, control, entrada, caida y celebracion.
- Fase 18: IA 11v11 con formacion, marcado, presion, apoyo, desmarque, defensa por zona y LOD de decisiones.
- Fase 19: porteros con posicionamiento, salida, atajadas magnetizadas por zona, despeje, saque corto/largo y error por atributo.
- Fase 20: camara broadcast 2D, zoom contextual, camara de tiro/celebracion, replay de gol en camara lenta y marcador televisivo.
- Fase 21: estadio premium barato con cesped baked, lineas, arcos/redes, gradas, publico impostor, banderas, publicidad e iluminacion baked.
- Fase 22: HUD final con marcador, reloj, radar, jugador activo, stamina, potencia, tarjetas, cambios, estadisticas y lower thirds tipo TV.
- Fase 23: audio procedural de partido con publico dinamico, gol, casi gol, silbidos, faltas, balon, pasos, ambiente, canticos y musica de menu.

## Verificacion

- `npm test` cubre las fases de gestion 0-13 y una prueba de integracion 19-23.
- La prueba 19-23 valida canvas de estadio, 11v11, porteros, pase largo con altura/asistencia, cambio manual, replay, HUD final y sistema de audio.
