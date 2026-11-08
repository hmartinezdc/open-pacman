# SPEC 03 — Power pellets en las cuatro esquinas

> **Estado:** implementado
> **Depende de:** SPEC 01 y SPEC 02
> **Fecha:** 2026-11-08
> **Objetivo:** Añadir los cuatro power pellets clásicos y el modo asustado: fantasmas azules, lentos y huyendo; poder comérselos por combo; y sus ojos volviendo a la pen.

## Por qué existe esta spec

Las specs 01 y 02 dejaron fuera deliberadamente «puntos de poder, fantasmas asustados y comerse fantasmas». Con los cuatro roles y la salida de la pen estables, el energizante es el siguiente mecanismo del arcade: durante unos segundos invierte la presión, da al jugador una válvula de escape y una fuente de puntos.

## Alcance

**Entra:**

- Tile `o` = valor `4` en `MAZE_STR` y `parseTile`, exportado como `window.POWER_TILE`.
- Cuatro power pellets que reemplazan dots en `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`, las posiciones del original.
- Comer un pellet: `+50`, cuenta para ganar y activa el modo asustado de 360 frames.
- Fantasmas asustados: color azul, velocidad `0.05` y huida maximizando la distancia a Pac-Man.
- Parpadeo blanco durante los últimos `120` frames del modo.
- Comerse fantasmas: combo `200/400/800/1600`, reiniciado con cada pellet; el fantasma comido no quita vida.
- Ojos volviendo a la pen con velocidad `0.2`, cruce de puerta y watchdog de `600` frames.
- Reaparición en su celda `home` con `GHOST_RESPAWN_DELAYS`.
- Reset del modo asustado al perder vida o reiniciar.
- Render de pellets pulsantes y de los tres estados del fantasma.
- Texto del overlay en `index.html` y notas en `AGENTS.md`.

**No entra (para otras specs):**

- Fases alternas de persecución y dispersión.
- Cambios a roles, objetivos, colores base, túnel, puerta, vidas o condiciones de victoria y derrota.
- Sonidos, sprites, niveles, puntuaciones altas o persistencia.
- Delta time, módulos ES o tests automatizados: el repo no tiene runner.

## Modelo de datos

`src/js/maze.js`:

```js
// '#' pared(1) · '.' dot(2) · 'o' power pellet(4) · '-' puerta pen(3)
'#o####.#####.##.#####.####o#', // 3
'#o..##................##..o#', // 23

const POWER_TILE = 4;
window.POWER_TILE = POWER_TILE;
```

`src/js/game.js` — constantes nuevas:

```js
const POWER_SCORE = 50;
const FRIGHTENED_FRAMES = 360;        // ~6 s a 60 fps
const FRIGHTENED_FLASH_FRAMES = 120;  // últimos ~2 s
const FRIGHTENED_SPEED = 0.05;        // mitad de GHOST_SPEED
const RETURN_SPEED = 0.2;             // ojos volviendo a la pen
const RETURN_TIMEOUT_FRAMES = 600;    // watchdog anti-bucle
const GHOST_EAT_POINTS = [ 200, 400, 800, 1600 ];
```

Exportación nueva que consume `render.js`:

```js
window.FRIGHTENED_FLASH_FRAMES = FRIGHTENED_FLASH_FRAMES;
```

`game` añade `frightenedTimer` (frames restantes) y `ghostCombo` (fantasmas comidos con el pellet actual). Cada fantasma añade:

```js
home: { x, y },       // celda de partida; allí vuelven los ojos
frightened: false,    // asustado por un pellet activo
returning: false,     // ojos volviendo a la pen
returnFrames: 0,
```

Convenciones:

- Coordenadas en celdas, como todo el juego.
- El temporizador se mide en frames, igual que el resto del juego.
- `MAZE` sigue prístina; comer pellets ocurre sobre `game.grid`, copia por partida.
- Un fantasma `returning` no interacciona con Pac-Man y mantiene la puerta transitable.

## Comportamientos

Comer y activar:

1. `createGame` cuenta como comestibles los valores `2` y `4` en `dotsRemaining`.
2. En `movePacman`, celda `2`: `+10`. Celda `4`: `+50`, decremento de `dotsRemaining` y `startFrightened`.
3. `startFrightened` pone `frightenedTimer = 360`, `ghostCombo = 0` y marca `frightened = true` en cada fantasma no `returning`. El fantasma asustado que ya está fuera de la pen invierte el rumbo una sola vez; el que ya estaba asustado no vuelve a invertir.

Duración y movimiento:

4. En `update`, si `frightenedTimer > 0` se decrementa; al llegar a `0` se limpia `frightened` en todos los fantasmas.
5. Fantasma asustado ya salido: velocidad `0.05` y, en cada centro de celda, dirección que maximiza la distancia a la celda de Pac-Man (`pickDirByDistance(..., flee = true)`), sin invertir salvo callejón.
6. Un fantasma dentro de la pen marcado como asustado sigue el modo de salida normal y sale más lento si aún está asustado al salir.

Colisión y combo:

7. Colisión con fantasma asustado: no quita vida. Puntos `GHOST_EAT_POINTS[ min(ghostCombo, 3) ]`, `ghostCombo++` y el fantasma entra en `returning`.
8. Colisión con fantasma normal: se pierde vida como antes; `resetPositions` corta el modo asustado (timer y combo a `0`, flags a `false`).

Ojos volviendo a la pen:

9. El fantasma `returning` se mueve a `0.2`, apunta a su `home`, trata la puerta como transitable (`exited = false`) y nunca interacciona con Pac-Man.
10. Al ocupar su celda `home` vuelve a estado normal: `returning = false`, `frightened = false`, `releaseIn = GHOST_RESPAWN_DELAYS[i]` y sale por la ruta de la pen.
11. Watchdog: si `returnFrames` supera `600`, `finishReturn` lo teletransporta a `home`.

Reaparición durante el miedo:

12. Un fantasma comido y devuelto reaparece normal aunque el temporizador siga activo; solo se reasusta si se come otro pellet.

Render:

13. `drawPowerPellets` dibuja los tiles `4` con radio pulsante `~5 px` y un brillo suave; se pinta tras los dots y antes de Pac-Man.
14. `drawGhost` distingue: normal (cuerpo + ojos con pupila), asustado (cuerpo azul o blanco en el flash, cara sin pupilas y boca en zigzag de color invertido), `returning` (solo ojos).
15. El flash se calcula en `draw` con `frightenedTimer < FRIGHTENED_FLASH_FRAMES` y alterna cada `15` frames.

## Plan de implementación

1. **`maze.js` — tile y filas.** `'o'` = `4` en `parseTile`, pellets en las filas 3 y 23, `POWER_TILE` exportado. Prueba manual: abrir el juego y ver cuatro dots grandes en las esquinas.
2. **`game.js` — datos.** Constantes, conteo `2 | 4` y campos `frightenedTimer`, `ghostCombo`, `home`, `frightened`, `returning`, `returnFrames`. Prueba manual: la partida arranca sin errores.
3. **`game.js` — comer y activar.** Rama del pellet en `movePacman` y `startFrightened` con inversión de rumbo. Prueba manual: `+50` en el HUD y fantasmas que dan media vuelta.
4. **`game.js` — mover asustados.** `pickDirByDistance` con `flee` y rama asustada en `decideGhost`. Prueba manual: azules, lentos y alejándose.
5. **`game.js` — comer fantasmas.** Colisión asustada: combo y `startReturn`. Prueba manual: `200/400/800/1600` y sin perder vidas.
6. **`game.js` — ojos.** Rama `returning` en `moveGhost`/`decideGhost`, `finishReturn`, watchdog y reset en `resetPositions`. Prueba manual: los ojos cruzan la puerta y el fantasma sale de nuevo.
7. **`render.js` — pellets.** `drawPowerPellets` pulsante integrado al `draw`.
8. **`render.js` — fantasmas.** `drawGhostBody`, `drawGhostEyes`, `drawScaredFace` y estados en `drawGhost`; flash calculado en `draw`.
9. **`index.html` y `AGENTS.md`.** Texto del overlay y notas de tile, rutas y reglas nuevas.

## Criterios de aceptación

- [ ] Al abrir `src/index.html` no hay errores en la consola.
- [ ] Se ven exactamente cuatro power pellets en `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`, pulsando suave.
- [ ] Comer uno suma `50` y decrece `dotsRemaining`.
- [ ] Los fantasmas se vuelven azules, bajan a `0.05` celda/frame y huyen de Pac-Man.
- [ ] En los últimos `120` frames parpadean blanco/azul alternando cada `15` frames.
- [ ] Comerse un fantasma da `200/400/800/1600`, no quita vida y el combo crece hasta el cuarto.
- [ ] El fantasma comido vuelve como ojos, cruza la puerta, espera su retardo y sale de nuevo.
- [ ] Al agotarse el temporizador, todos recuperan color, velocidad y rol.
- [ ] Comer un segundo pellet durante el miedo reinicia el temporizador y el combo.
- [ ] Perder una vida o reiniciar corta el modo asustado y conserva el grid (pellets comidos siguen comidos).
- [ ] Ganar exige comer también los cuatro power pellets.
- [ ] Túnel, roles, salida de pen y derrota por tres colisiones sin cambios.
- [ ] Las velocidades nuevas (`0.05` y `0.2`) alinean al centro de celda; nada se traba.

### Cómo verificar

1. Abrir `src/index.html` (o `npx serve src`).
2. Comprobar los cuatro pellets en las esquinas y su pulso.
3. Comer uno: `+50`, fantasmas azules y lentos que huyen.
4. Perseguir y comer dos fantasmas: `200` y `400`; los ojos regresan y el fantasma reaparece.
5. Esperar el final del modo: color, velocidad y roles de vuelta.
6. Morir con el modo activo: el reset lo corta y las vidas siguen igual.
7. Ganar comiendo todo; perder con tres choques para confirmar las reglas previas.

## Decisiones tomadas y descartadas

- **Sí:** tile `o` en el mapa. El laberinto sigue siendo la fuente de verdad; el consumo vive en la copia.
- **Sí:** posiciones clásicas del arcade `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)`, no las esquinas extremas: conservan la geometría y el recorrido originales.
- **Sí:** modo asustado completo con combo y ojos de vuelta. Es lo que hace reconocible al energizante.
- **Sí:** huida por máxima distancia en lugar de aleatoria. Determinista, reutiliza `pickDirByDistance` y es fácil de verificar.
- **Sí:** inversión instantánea del rumbo al comer el pellet. Es el golpe de efecto clásico.
- **Sí:** `0.05` y `0.2` para asustados y ojos. Son fracciones que caen en enteros dentro de la tolerancia de `aligned()` (`1e-3`); velocidades arbitrarias romperían la alineación.
- **Sí:** `360` frames sin delta time. El diseño del repo es por frames; en más Hz velocidad y temporizador escalan juntos y la relación se conserva.
- **Sí:** watchdog de vuelta (`600` frames). Respaldo barato por si el selector codicioso se atasca.
- **No:** fases scatter/chase. Duplican estados y van en otra spec.
- **No:** sonidos, sprites o delta time. Fuera del problema.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El selector codicioso de los ojos entra en bucle | `RETURN_TIMEOUT_FRAMES = 600` y teletransporte a `home`. |
| `dotsRemaining` deja de contar los pellets y se gana antes | Contar `2 \| 4` y decrementar en ambas ramas de comida. |
| Un fantasma reaparece asustado dentro del mismo pellet | `startReturn`/`finishReturn` limpian `frightened`; solo otro pellet lo reasusta. |
| Las velocidades nuevas rompen `aligned()` | `0.05` y `0.2` caen en enteros dentro de la tolerancia `1e-3`. |
| El temporizador por frames cambia con los Hz | Es el diseño actual; velocidad y temporizador escalan juntos. |
| Cambios accidentales a roles o a la salida de la pen | Las ramas nuevas van después del modo de salida y antes de los roles. |

## Qué NO entra en esta spec

- Fases de dispersión, cambios a roles, velocidades base o colores normales.
- Reglas de puerta o túnel, vidas, o victoria/derrota más allá del conteo de pellets.
- Sonidos, sprites, niveles o persistencia.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
