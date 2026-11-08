# AGENTS.md

Juego Pac-Man mínimo en JS vanilla puro. README en español; comentarios de código en español.

## Ejecución y verificación

- No hay `package.json`, build, tests ni lint. Nada que instalar.
- Ejecutar: abrir `src/index.html` en el navegador (o un server estático sobre `src/`, ej. `npx serve src`). Dura instantáneo; no hay watch.
- Verificación es manual: jugar con flechas, probar túnel lateral (fila 14), ganar (comer todos los dots) y perder (3 colisiones con fantasmas).

## Arquitectura: globals, no módulos

- Sin ES modules ni bundler: los 4 scripts se comunican vía `window.<global>` (`MAZE`, `createGame`, `update`, `draw`, `DIRS`, `POWER_TILE`, `FRIGHTENED_FLASH_FRAMES`).
- El orden de `<script>` en `src/index.html` (maze → game → render → main) es obligatorio. Un archivo nuevo debe cargarse ahí antes del que lo use y exportar su global en `window`.
- Responsabilidades: `maze.js` datos, `game.js` estado/reglas, `render.js` canvas, `main.js` bucle rAF + teclado + overlay HTML.

## Coordenadas y dibujo

- La lógica trabaja en **unidades de celda** (x: 0–27, y: 0–30), no en píxeles. Solo `render.js` multiplica por `TILE = 20`; canvas = 28×31 tiles = 560×620 px.
- Se redibuja todo cada frame con `requestAnimationFrame` (sprites dibujados con primitivas, no imágenes).
- El overlay (start/win/lose) es HTML superpuesto, no canvas; `showOverlay()` en `main.js` regenera el botón y su listener.

## Laberinto

- El mapa se edita en `MAZE_STR` (maze.js): exactamente **31 strings de 28 caracteres**, simétrico verticalmente. Códigos: `#`=1 pared, `.`=2 dot, `o`=4 power pellet, `-`=3 puerta, espacio=0 vacío.
- Los cuatro `o` reemplazan dots en `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`, las posiciones del arcade. Cuentan para ganar y no se restauran al perder una vida (el grid persiste igual que los dots).
- `MAZE` es prístina y **nunca se muta**; `createGame()` la copia a `game.grid`. Borrar dots (o bloquear la puerta para pacman) se hace sobre `game.grid`.
- `GHOST_STARTS` posiciona 4 fantasmas dentro de la pen con `kind` (`chaser`, `ambusher`, `vector`, `timid`) y `releaseIn` (frames de espera). Los fantasmas atraviesan la puerta `-` solo mientras están dentro de la pen (`exited === false`); tras salir por `PEN_EXIT`, también la tratan como muro (ver `isWall`).
- Los 4 roles viven en `decideGhost`/`roleTarget`: chaser persigue directo, ambusher apunta 4 celdas delante de Pac-Man, vector usa la posición del rojo, timid huye a `TIMID_CORNER` a menos de `TIMID_DISTANCE`. Distancia euclídea al cuadrado, desempate `DIR_ORDER`.

## Movimiento (choque con la lógica si se cambia)

- Los actores solo giran cuando están **alineados al centro de una celda** (`aligned()`, tolerancia 1e-3). Velocidades = fracciones de celda/frame: pacman 0.125, fantasmas 0.1, asustados 0.05 (`FRIGHTENED_SPEED`) y ojos `returning` 0.2 (`RETURN_SPEED`); todas caen en enteros dentro de la tolerancia. No cambiar a valores arbitrarios sin revisar `aligned()`.
- No hay delta time: todo está ligado a frames (`update`, animación de boca con `frame`). Meter setInterval o delta time es un cambio de diseño, no un fix puntual.
- El input registra solo en `pacman.nextDir` (buffer); se aplica al estar alineado.
- Túnel: fila 14, wrap horizontal cuando la celda destino sale de los bordes (`canMove` + `wrapTunnel`).
- Fantasmas deciden dirección solo en centros de celda y no invierten rumbo salvo callejón (`decideGhost`). Salen de la pen escalonados vía `releaseIn` (0/60/120/180 frames en `GHOST_STARTS`) y apuntan a `PEN_EXIT` mientras no hayan salido. Tras perder una vida, la espera es corta: `GHOST_RESPAWN_DELAYS = [0, 15, 30, 45]` (maze.js), asignada por `resetPositions`.
- Mientras `exited === false`, la salida es una ruta determinista: primero un tramo horizontal hacia `PEN_COLUMN` (la columna de la puerta, x=13) y luego un tramo vertical por la puerta; nunca invierte el sentido horizontal. Solo si la ruta no puede avanzar se usa el respaldo por distancia (`pickDirByDistance`).
- Depuración de objetivos: `window.DEBUG_GHOSTS = true` dibuja la línea fantasma→objetivo y un cuadrado en la celda objetivo (`drawGhostTargets` en render.js).

## Power pellets

- Comer un pellet (tile `4`) suma 50, decrementa `dotsRemaining` y activa `game.frightenedTimer = FRIGHTENED_FRAMES` (360 frames) con `ghostCombo = 0` (`startFrightened`). El diseño sigue por frames, sin delta time.
- Fantasmas asustados: aúna `frightened = true` en cada uno; los que ya salieron (`exited === true`) invierten el rumbo una sola vez al comerse el pellet. Se mueven a 0.05 y huyen maximizando la distancia a Pac-Man con `pickDirByDistance(..., true)`; solo invertirían de nuevo en un callejón.
- El temporizador decrece en `update`; al llegar a 0 se limpia `frightened` en todos. Un fantasma devuelto a la pen reaparece normal aunque el temporizador siga vivo; solo otro pellet lo reasusta.
- Comérselos: colisión con un asustado no quita vida; suma `GHOST_EAT_POINTS = [200, 400, 800, 1600]` según `ghostCombo` y el fantasma entra en `returning` (`startReturn`): ojos a 0.2, puerta transitable (`exited = false`), apunta a su `home`, sin interacción con Pac-Man. Al llegar a `home`, `finishReturn` lo deja esperando `GHOST_RESPAWN_DELAYS[i]`.
- Watchdog: `RETURN_TIMEOUT_FRAMES = 600`; si los ojos no llegan, `finishReturn` los teletransporta a `home`.
- `resetPositions` corta el modo asustado: timer y combo a 0, `frightened`/`returning`/`returnFrames` limpios.
- Render: pellets pulsantes con `drawPowerPellets` (radio `~5 px` con seno sobre `frame` + `shadowBlur`); fantasma asustado = cuerpo azul (`FRIGHTENED_COLOR`) + `drawScaredFace`; ojos volviendo = solo `drawGhostEyes`. El flash blanco de los últimos `FRIGHTENED_FLASH_FRAMES` (120) se calcula en `draw` y alterna cada 15 frames.

## Estilo del repo

- Espacios dentro de paréntesis y argumentos: `foo( a )`, `if ( x )`. Mantener el estilo existente.
