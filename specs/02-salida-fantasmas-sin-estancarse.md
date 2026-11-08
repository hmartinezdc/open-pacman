# SPEC 02 — Salida fluida de los fantasmas fuera de la pen

> **Estado:** aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-11-07
> **Objetivo:** Garantizar que los cuatro fantasmas salgan de la pen con una ruta predecible y esperas cortas tras cada muerte, sin zigzaguear ni quedar atrapados.

## Por qué existe esta spec

SPEC 01 fijó las salidas en 0/90/180/270 frames y `resetPositions` reinicia esa cuenta completa en cada muerte. En una partida pasiva las muertes caen en los frames ~274, ~549 y ~824: el naranja se libera en el 270 y muere cuatro frames después, así que nunca llega a salir.

Además, el selector por distancia hace que los fantasmas laterales cambien de dirección dentro de la caja. Se probaron las 24 combinaciones de celda y dirección de la pen: ninguna queda bloqueada para siempre, pero el zigzag se percibe como un fantasma estancado.

Esta spec sustituye solo los retardos y la ruta de salida de SPEC 01. Los cuatro roles y sus objetivos siguen vigentes.

## Alcance

**Entra:**

- Retardos iniciales de `GHOST_STARTS` en `src/js/maze.js` a 0/60/120/180 frames.
- Nueva constante `GHOST_RESPAWN_DELAYS = [ 0, 15, 30, 45 ]` en `src/js/maze.js` y su exportación a `window`.
- Ruta de salida determinista mientras `exited === false`: tramo horizontal hacia `x = 13` y luego tramo vertical por la puerta.
- `resetPositions` usa `GHOST_RESPAWN_DELAYS` en lugar de los retardos iniciales.
- Actualización de `AGENTS.md` con los nuevos retardos y la ruta de salida.

**No entra (para otras specs):**

- Cambiar roles, objetivos, colores o velocidades de los fantasmas.
- Cambiar las reglas de la puerta o del túnel.
- Puntos de poder, fantasmas asustados u ojos volviendo a la pen.
- Fases alternas de persecución y dispersión.
- Cambios al laberinto, al número de vidas o a las condiciones de victoria y derrota.
- HUD, sprites, sonidos, niveles o persistencia.
- Tests automatizados: el repo no tiene runner.

## Modelo de datos

`src/js/maze.js`:

```js
const GHOST_STARTS = [
  { kind: 'chaser',   x: 13, y: 14, releaseIn: 0 },   // dentro de la pen
  { kind: 'ambusher', x: 14, y: 14, releaseIn: 60 },  // dentro de la pen
  { kind: 'vector',   x: 12, y: 14, releaseIn: 120 }, // dentro de la pen
  { kind: 'timid',    x: 15, y: 14, releaseIn: 180 }, // dentro de la pen
];

// Espera corta tras perder una vida, en el mismo orden que GHOST_STARTS.
const GHOST_RESPAWN_DELAYS = [ 0, 15, 30, 45 ];
```

Exportaciones nuevas en `maze.js`:

```js
window.GHOST_RESPAWN_DELAYS = GHOST_RESPAWN_DELAYS;
```

`src/js/game.js` — constante nueva:

```js
const PEN_COLUMN = PEN_EXIT.x; // 13, columna de la puerta
```

No se añaden campos al objeto de cada fantasma. Se siguen usando `exited`, `releaseIn` y `target` tal como los definió SPEC 01.

Convenciones:

- Coordenadas en celdas, como todo el juego.
- `releaseIn` se mide en frames, igual que el resto de la animación.
- `GHOST_RESPAWN_DELAYS[i]` corresponde al fantasma `i`, en el mismo orden que `GHOST_STARTS`.

## Comportamientos

Retardos y salidas esperadas:

| `kind`   | `releaseIn` inicial | Sale de la pen (frame aprox.) |
| -------- | ------------------- | ----------------------------- |
| `chaser` | 0                   | 30                            |
| `ambusher` | 60                | 100                           |
| `vector` | 120                 | 160                           |
| `timid`  | 180                 | 230                           |

Reglas:

- Mientras `releaseIn > 0`, el fantasma no se mueve y decrementa el contador en cada `update` (sin cambios).
- Mientras `exited === false`, el fantasma ignora su rol y no usa el selector por distancia. La ruta es:
  1. Si su celda redondeada tiene `x < PEN_COLUMN` y puede moverse a la derecha, va a la derecha.
  2. Si tiene `x > PEN_COLUMN` y puede moverse a la izquierda, va a la izquierda.
  3. Si tiene `x === PEN_COLUMN` y puede moverse hacia arriba, va hacia arriba.
  4. Si ninguna de las anteriores puede avanzar, usa `pickDirByDistance` hacia `PEN_EXIT` como respaldo.
- El objetivo de debug (`g.target`) dentro de la pen sigue siendo `PEN_EXIT`.
- La ruta nunca invierte el sentido horizontal: como máximo un tramo horizontal y luego uno vertical.
- Al ocupar una celda con `y < 12`, `exited` pasa a `true` y la puerta se vuelve muro para ese fantasma (sin cambios).
- `createGame` usa los `releaseIn` iniciales de `GHOST_STARTS` (0/60/120/180).
- `resetPositions` restaura posición, `dir = 'up'`, `exited = false` y `target = null`, y asigna `releaseIn = GHOST_RESPAWN_DELAYS[ i ]`.
- Con los retardos de reaparición, las salidas tras una muerte ocurren en los frames 31/56/71/96 aproximadamente (máximo ~1,6 s).

## Plan de implementación

1. **`src/js/maze.js` — retardos iniciales y de reaparición.** Cambiar los `releaseIn` de `GHOST_STARTS` a 0/60/120/180; añadir `GHOST_RESPAWN_DELAYS` y exportarlo en `window`. Prueba manual: abrir el juego y ver que los cuatro fantasmas siguen saliendo escalonados.
2. **`src/js/game.js` — ruta de salida determinista.** Añadir `PEN_COLUMN = PEN_EXIT.x` y reemplazar la rama `!g.exited` de `decideGhost` por la ruta horizontal→vertical, con respaldo a `pickDirByDistance` hacia `PEN_EXIT`. Prueba manual: cada fantasma hace un tramo horizontal y luego sube recto por la puerta; ninguno va y vuelve dentro de la caja.
3. **`src/js/game.js` — reaparición corta.** En `resetPositions`, asignar `releaseIn = GHOST_RESPAWN_DELAYS[ i ]`. Prueba manual: perder una vida y ver que los cuatro vuelven a la caja y salen en menos de 2 s.
4. **`AGENTS.md` — notas de salida.** Cambiar los retardos 0/90/180/270 por 0/60/120/180, documentar `GHOST_RESPAWN_DELAYS = [0, 15, 30, 45]` y la ruta horizontal→vertical. Prueba manual: leer la nota y comprobar que coincide con `decideGhost` y `resetPositions`.

## Criterios de aceptación

- [ ] Al abrir `src/index.html` no hay errores en la consola.
- [ ] Los fantasmas arrancan quietos y se liberan en los frames ~0/60/120/180.
- [ ] Cada fantasma sale de la pen con un solo tramo horizontal hacia `x = 13` y un tramo vertical, sin invertir el sentido horizontal.
- [ ] En partida pasiva, sin pulsar ninguna tecla, el naranja sale antes de la primera muerte (~230 frente a ~274).
- [ ] Tras perder una vida, los cuatro fantasmas vuelven a la caja y salen en menos de 100 frames (~1,6 s).
- [ ] Tras una muerte, las esperas de salida son 0/15/30/45 frames.
- [ ] En al menos tres muertes seguidas, ningún fantasma permanece en la caja más de 100 frames después de su turno.
- [ ] Al salir, cada rol conserva su comportamiento de SPEC 01.
- [ ] La puerta sigue siendo muro para un fantasma con `exited === true` y para Pac-Man.
- [ ] Con `window.DEBUG_GHOSTS = true`, la línea de un fantasma dentro de la caja apunta a `(13, 11)`.
- [ ] La velocidad sigue siendo `GHOST_SPEED = 0.1` celda/frame y el juego no se acelera ni se traba.
- [ ] Comer todos los dots muestra `GANASTE`; tres colisiones muestran `PERDISTE`.

### Cómo verificar

1. Abrir `src/index.html`.
2. Iniciar la partida y no tocar las flechas: Pac-Man se detiene solo a la izquierda. El naranja debe cruzar la puerta antes de la primera colisión.
3. Observar que ningún fantasma va y vuelve dentro de la caja: todos hacen un tramo horizontal y luego uno vertical.
4. Dejar morir a Pac-Man y comprobar que los cuatro vuelven a la caja y salen en menos de 2 s.
5. Repetir el paso 4 dos veces más para confirmar que ninguna muerte vuelve a dejar al naranja atrapado.
6. En la consola del navegador, ejecutar `window.DEBUG_GHOSTS = true` y confirmar que dentro de la caja la línea apunta a `(13, 11)`.
7. Jugar con las flechas y confirmar que los roles, el túnel, la victoria y la derrota siguen funcionando.

## Decisiones tomadas y descartadas

- **Sí:** retardos iniciales 0/60/120/180. El naranja sale ~230, antes de la primera muerte pasiva ~274, y se conserva un escalonado visible.
- **Sí:** retardos de reaparición 0/15/30/45. Evita que una muerte reinicie esperas de hasta 4,5 s.
- **Sí:** ruta horizontal hacia `x = 13` y luego vertical. Elimina el zigzag del selector por distancia y es determinista.
- **Sí:** declarar `GHOST_RESPAWN_DELAYS` en `maze.js`. Agrupa los datos de aparición junto a `GHOST_STARTS`.
- **Sí:** todos los fantasmas vuelven a la caja al morir. Mantiene SPEC 01 y el comportamiento clásico.
- **Sí:** respaldo a `pickDirByDistance` si la ruta monótona no puede avanzar. Evita un bloqueo si el laberinto cambia en el futuro.
- **No:** mantener 0/90/180/270 al inicio. El naranja salía ~310, después de la primera muerte ~274.
- **No:** no reiniciar `releaseIn` en la muerte. Los fantasmas saldrían de inmediato y se perdería el escalonado.
- **No:** adelantar solo al naranja. Rompe la progresión uniforme del escalonado.
- **No:** cola FIFO o tiempo máximo en la caja. Innecesario con ruta determinista y retardos cortos.
- **No:** cambiar roles, velocidades o reglas de la puerta. Está fuera del problema.
- **Nota:** la «oscilación» observada era el zigzag del selector por distancia, no un bloqueo permanente. Se probaron las 24 combinaciones de celda y dirección de la pen y todas salían en menos de 200 frames.

## Riesgos

| Riesgo                                                                 | Mitigación                                                                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Acortar el escalonado hace el inicio más difícil                       | Se mantienen 3 vidas. Si resulta injusto, ajustar solo `GHOST_STARTS.releaseIn` en una spec futura. |
| La ruta horizontal→vertical no puede avanzar por un cambio del laberinto | Respaldo a `pickDirByDistance` hacia `PEN_EXIT`; el laberinto actual está verificado.              |
| El temporizador por frames no coincide con segundos reales a más de 60 Hz | Es el diseño existente. Esta spec no introduce delta time; la aceptación se mide en frames.        |
| `AGENTS.md` queda desactualizado                                       | El paso 4 lo actualiza en la misma implementación.                                                  |
| Cambiar sin querer el comportamiento de los roles                      | Solo se toca la rama `!g.exited`; los objetivos de rol no cambian.                                  |

## Qué NO entra en esta spec

- Roles, objetivos, colores o velocidades de los fantasmas.
- Reglas de la puerta o del túnel.
- Puntos de poder, fantasmas asustados u ojos volviendo a la pen.
- Fases de persecución y dispersión.
- Cambios al laberinto, a las vidas o a las condiciones de victoria y derrota.
- HUD, sprites, sonidos, niveles o persistencia.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
