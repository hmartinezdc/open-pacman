# AGENTS.md

Juego Pac-Man mínimo en JS vanilla puro. README en español; comentarios de código en español.

## Ejecución y verificación

- No hay `package.json`, build, tests ni lint. Nada que instalar.
- Ejecutar: abrir `src/index.html` en el navegador (o un server estático sobre `src/`, ej. `npx serve src`). Dura instantáneo; no hay watch.
- Verificación es manual: jugar con flechas, probar túnel lateral (fila 14), ganar (comer todos los dots) y perder (3 colisiones con fantasmas).

## Arquitectura: globals, no módulos

- Sin ES modules ni bundler: los 4 scripts se comunican vía `window.<global>` (`MAZE`, `createGame`, `update`, `draw`, `DIRS`).
- El orden de `<script>` en `src/index.html` (maze → game → render → main) es obligatorio. Un archivo nuevo debe cargarse ahí antes del que lo use y exportar su global en `window`.
- Responsabilidades: `maze.js` datos, `game.js` estado/reglas, `render.js` canvas, `main.js` bucle rAF + teclado + overlay HTML.

## Coordenadas y dibujo

- La lógica trabaja en **unidades de celda** (x: 0–27, y: 0–30), no en píxeles. Solo `render.js` multiplica por `TILE = 20`; canvas = 28×31 tiles = 560×620 px.
- Se redibuja todo cada frame con `requestAnimationFrame` (sprites dibujados con primitivas, no imágenes).
- El overlay (start/win/lose) es HTML superpuesto, no canvas; `showOverlay()` en `main.js` regenera el botón y su listener.

## Laberinto

- El mapa se edita en `MAZE_STR` (maze.js): exactamente **31 strings de 28 caracteres**, simétrico verticalmente. Códigos: `#`=1 pared, `.`=2 dot, `-`=3 puerta, espacio=0 vacío.
- `MAZE` es prístina y **nunca se muta**; `createGame()` la copia a `game.grid`. Borrar dots (o bloquear la puerta para pacman) se hace sobre `game.grid`.
- `GHOST_STARTS` posiciona 4 fantasmas dentro de la pen con `kind` (`chaser`, `ambusher`, `vector`, `timid`) y `releaseIn` (frames de espera). Los fantasmas atraviesan la puerta `-` solo mientras están dentro de la pen (`exited === false`); tras salir por `PEN_EXIT`, también la tratan como muro (ver `isWall`).
- Los 4 roles viven en `decideGhost`/`roleTarget`: chaser persigue directo, ambusher apunta 4 celdas delante de Pac-Man, vector usa la posición del rojo, timid huye a `TIMID_CORNER` a menos de `TIMID_DISTANCE`. Distancia euclídea al cuadrado, desempate `DIR_ORDER`.

## Movimiento (choque con la lógica si se cambia)

- Los actores solo giran cuando están **alineados al centro de una celda** (`aligned()`, tolerancia 1e-3). Velocidades = fracciones de celda/frame: pacman 0.125, fantasmas 0.1; ambas caen en enteros dentro de la tolerancia. No cambiar a valores arbitrarios sin revisar `aligned()`.
- No hay delta time: todo está ligado a frames (`update`, animación de boca con `frame`). Meter setInterval o delta time es un cambio de diseño, no un fix puntual.
- El input registra solo en `pacman.nextDir` (buffer); se aplica al estar alineado.
- Túnel: fila 14, wrap horizontal cuando la celda destino sale de los bordes (`canMove` + `wrapTunnel`).
- Fantasmas deciden dirección solo en centros de celda y no invierten rumbo salvo callejón (`decideGhost`). Salen de la pen escalonados vía `releaseIn` (0/90/180/270 frames) y apuntan a `PEN_EXIT` mientras no hayan salido.
- Depuración de objetivos: `window.DEBUG_GHOSTS = true` dibuja la línea fantasma→objetivo y un cuadrado en la celda objetivo (`drawGhostTargets` en render.js).

## Estilo del repo

- Espacios dentro de paréntesis y argumentos: `foo( a )`, `if ( x )`. Mantener el estilo existente.
