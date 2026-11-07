# SPEC 01 — Cuatro fantasmas con roles distintos

> **Estado:** Implementado
> **Depende de:** ninguna spec previa
> **Fecha:** 2026-11-06
> **Objetivo:** Dar al juego cuatro fantasmas con comportamientos distintos —persecución directa, emboscada, vector y tímido— para que cada uno se juegue de forma diferente y solo uno presione agresivamente a Pac-Man.

## Por qué existe esta spec

Hoy hay dos fantasmas: uno persigue en línea recta y otro se mueve al azar. Esa diferencia se agota rápido. Esta spec reemplaza ese par por cuatro roles reconocibles sin añadir power-ups ni fases de dispersión.

## Alcance

**Entra:**

- Cuatro fantasmas definidos en `GHOST_STARTS`: rojo `chaser`, rosa `ambusher`, cian `vector` y naranja `timid`.
- Salida escalonada de la pen: 0, 90, 180 y 270 frames.
- Modo de salida que lleva a cada fantasma a la celda `(13, 11)`, encima de la puerta.
- Puerta `-` tratada como muro para un fantasma que ya salió (`exited === true`).
- Elección de dirección por distancia euclídea al cuadrado, sin invertir el rumbo salvo en callejón.
- Depuración opcional con `window.DEBUG_GHOSTS = true`.
- Colores en el orden rojo, rosa, cian y naranja.
- Actualización de la nota sobre la puerta en `AGENTS.md`.

**No entra (para otras specs):**

- Puntos de poder, fantasmas asustados o comerse fantasmas.
- Ojos de fantasma volviendo a la pen.
- Fases alternas de persecución y dispersión.
- Velocidades distintas por fantasma.
- Nombres o roles visibles en el HUD.
- Sprites, sonidos, niveles, puntuaciones altas o persistencia.
- Cambios al laberinto, al túnel o al número de vidas.
- Tests automatizados: el repo no tiene runner.

## Modelo de datos

`src/js/maze.js`:

```js
const GHOST_STARTS = [
  { kind: 'chaser',   x: 13, y: 14, releaseIn: 0 },
  { kind: 'ambusher', x: 14, y: 14, releaseIn: 90 },
  { kind: 'vector',   x: 12, y: 14, releaseIn: 180 },
  { kind: 'timid',    x: 15, y: 14, releaseIn: 270 },
];
```

`src/js/game.js` — cada elemento de `game.ghosts`:

```js
{
  x, y,
  dir: 'up',
  speed: GHOST_SPEED,
  kind: 'chaser' | 'ambusher' | 'vector' | 'timid',
  exited: false,   // true cuando ya salió de la pen
  releaseIn: 90,   // frames restantes dentro de la pen
  target: null,    // { x, y } de la última decisión; solo para debug
}
```

Constantes nuevas en `game.js`:

```js
const PEN_EXIT = { x: 13, y: 11 };
const PEN_TOP_ROW = 12;          // y < 12 significa fuera de la pen
const TIMID_DISTANCE = 8;        // celdas
const TIMID_CORNER = { x: 0, y: 30 };
const DIR_ORDER = [ 'up', 'left', 'down', 'right' ];
```

Convenciones:

- Coordenadas en celdas, como todo el juego.
- Los objetivos pueden caer fuera del laberinto o sobre un muro. No se recortan: solo se usan para comparar distancias.
- La pen es el interior de las filas 13–15 y las columnas 11–16.

## Comportamientos

| `kind`     | Color   | Objetivo                                     |
| ---------- | ------- | -------------------------------------------- |
| `chaser`   | rojo    | Celda actual de Pac-Man.                     |
| `ambusher` | rosa    | 4 celdas delante de Pac-Man, en su dirección actual. |
| `vector`   | cian    | `2 * (pacman + 2 * dir) - posicionDelRojo`.  |
| `timid`    | naranja | Pac-Man si está a más de 8 celdas; si está a 8 o menos, `(0, 30)`. |

Aclaraciones:

- «Dirección actual» es `pacman.dir`, no `pacman.nextDir`.
- `posicionDelRojo` es la celda redondeada del fantasma `chaser`.
- Las posiciones de Pac-Man y del rojo se redondean a celda antes de calcular.

Reglas comunes:

- Mientras `releaseIn > 0`, el fantasma no se mueve y decrementa el contador en cada `update`.
- Mientras `exited === false`, el fantasma ignora su rol y apunta a `PEN_EXIT`.
- Al ocupar una celda con `y < 12`, `exited` pasa a `true`.
- Un fantasma con `exited === true` trata la puerta como muro.
- En cada celda entera, los candidatos son las direcciones permitidas menos la opuesta a `g.dir`. Si no queda ninguna, se permite la opuesta (callejón).
- Se elige el candidato que minimiza `(nx - target.x)^2 + (ny - target.y)^2`.
- En caso de empate gana el primero en `DIR_ORDER`.
- `resetPositions` restaura `x`, `y`, `dir = 'up'`, `exited = false`, `releaseIn` inicial y `target = null`.

## Plan de implementación

1. **`src/js/maze.js` — cuatro puntos de partida.** Reemplazar `GHOST_STARTS` por los cuatro objetos de arriba. Prueba manual: abrir el juego y ver cuatro fantasmas dentro de la pen.
2. **`src/js/game.js` — estado nuevo.** Añadir `exited`, `releaseIn` y `target` al objeto que crea `createGame`; resetearlos en `resetPositions`. Prueba manual: la partida sigue jugable sin errores en consola.
3. **`src/js/game.js` — cuenta atrás de salida.** En `moveGhost`, si `releaseIn > 0`, decrementar y salir sin mover. Prueba manual: los fantasmas arrancan quietos y se sueltan en cuatro momentos distintos.
4. **`src/js/game.js` — puerta, salida y selector común.** Pasar el objeto del fantasma a `isWall`/`canMove`; tratar la puerta como muro si `who.exited`; añadir `PEN_EXIT`, el modo de salida y la marca `exited` al cruzar `y < 12`; introducir `DIR_ORDER` y la elección por distancia euclídea al cuadrado. Prueba manual: los cuatro salen por la puerta y ninguno vuelve a entrar.
5. **`src/js/game.js` — `chaser` y `ambusher`.** Implementar sus objetivos y dejar `vector`/`timid` en el fallback aleatorio actual. Prueba manual: el rojo va directo a Pac-Man y el rosa se adelanta a su dirección.
6. **`src/js/game.js` — `vector` y `timid`.** Implementar los dos objetivos restantes con la posición del rojo y el umbral de 8 celdas. Prueba manual: el cian cambia de objetivo cuando el rojo se mueve; el naranja se aleja al acercarse.
7. **`src/js/render.js` — colores y debug.** Reordenar `GHOST_COLORS` a `[ '#ff0000', '#ffb8ff', '#00ffff', '#ffb852' ]`. Si `window.DEBUG_GHOSTS` es verdadero, dibujar una línea desde cada fantasma a su `target` y un cuadrado en esa celda. Prueba manual: con el flag activo se ven las cuatro líneas; sin él, nada cambia.
8. **`AGENTS.md` — nota de la puerta.** Actualizar la frase que dice que los fantasmas siempre atraviesan la puerta, para reflejar que solo pueden hacerlo antes de salir de la pen. Prueba manual: leer la nota y comprobar que coincide con `isWall`.

## Criterios de aceptación

- [ ] Al abrir `src/index.html` no hay errores en la consola.
- [ ] Se ven exactamente cuatro fantasmas: rojo, rosa, cian y naranja, en ese orden de índices.
- [ ] El rojo empieza a moverse de inmediato; el rosa a los ~90 frames; el cian a los ~180; el naranja a los ~270.
- [ ] Cada fantasma sale de la pen por la puerta y no vuelve a entrar.
- [ ] Con `window.DEBUG_GHOSTS = true`, la línea del rojo termina en la celda de Pac-Man.
- [ ] La línea del rosa termina 4 celdas delante de Pac-Man, según su dirección actual.
- [ ] La línea del cian termina en el punto calculado a partir de la posición del rojo; si el rojo se mueve, el objetivo cambia.
- [ ] Con Pac-Man a más de 8 celdas, el naranja apunta a Pac-Man; a 8 celdas o menos, apunta a `(0, 30)`.
- [ ] Ningún fantasma invierte el sentido salvo en un callejón sin salida.
- [ ] Pac-Man sigue sin poder cruzar la puerta; los fantasmas que aún no han salido sí pueden.
- [ ] Al perder una vida, los cuatro vuelven a la pen y se repiten los retardos.
- [ ] Comer todos los dots muestra `GANASTE`; tres colisiones muestran `PERDISTE`.
- [ ] Con `window.DEBUG_GHOSTS` sin definir, no se dibuja ninguna línea ni marca.
- [ ] La velocidad de los cuatro fantasmas sigue siendo `0.1` celda/frame y el juego no se acelera ni se traba.

### Cómo verificar

1. Abrir `src/index.html`.
2. En la consola del navegador, ejecutar `window.DEBUG_GHOSTS = true`.
3. Jugar con las flechas y observar las líneas y el comportamiento de cada color.
4. Repetir con el flag apagado para confirmar que no hay cambios visuales.

## Decisiones tomadas y descartadas

- **Sí:** un solo fantasma agresivo, el rojo. Da contraste y deja que el jugador aprenda al resto.
- **Sí:** arquetipos clásicos (directo, emboscada, vector y tímido). Son probados y distinguibles sin tutorial.
- **No:** fases scatter/chase. Duplican los estados y hacen más difícil verificar los roles.
- **Sí:** salida escalonada 0/90/180/270 frames. Aprovecha la pen y evita cuatro fantasmas encima al inicio.
- **Sí:** todos a `GHOST_SPEED = 0.1`. La lógica de `aligned()` depende de fracciones que caen en enteros; cambiar velocidades rompería la alineación.
- **Sí:** distancia euclídea al cuadrado y desempate `up, left, down, right`. Es el criterio del arcade.
- **Sí:** la puerta se cierra tras salir. Evita que un fantasma vuelva a la pen y se quede vagando.
- **Sí:** modo de salida hacia `(13, 11)`. Sin él, un objetivo situado debajo de la pen puede hacer oscilar al fantasma dentro.
- **Sí:** objetivos sin recortar. Recortarlos alteraría la emboscada y el vector clásicos.
- **Sí:** `window.DEBUG_GHOSTS` opcional. Permite verificar objetivos sin ensuciar la pantalla normal.
- **No:** nombres de rol en el HUD. El color basta y mantiene el HUD actual.
- **No:** velocidades o vidas distintas. No forman parte del problema.
- **Sí:** usar `pacman.dir`, no `nextDir`. `nextDir` es un buffer que puede ser `null` y todavía no se ha aplicado.

## Riesgos

| Riesgo                                                             | Mitigación                                                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Cuatro fantasmas sin puntos de poder hacen el juego demasiado difícil | Mantener 3 vidas y ajustar solo los retardos de salida si la prueba manual resulta injusta.     |
| El selector codicioso puede entrar en bucles en zonas abiertas     | Es el comportamiento clásico y se acepta. El modo de salida evita el bucle dentro de la pen.    |
| Un fantasma no marca `exited` y se queda atrapado                  | `PEN_EXIT` está fuera de la pen y la puerta es transitable mientras `exited` sea falso.         |
| El flag de debug queda activo por accidente                        | Está apagado por defecto y solo se activa desde consola.                                        |
| `AGENTS.md` queda desactualizado                                   | El paso 8 lo actualiza en la misma implementación.                                              |

## Qué NO entra en esta spec

- Puntos de poder, fantasmas asustados y comerse fantasmas.
- Ojos volviendo a la pen.
- Fases de dispersión.
- Velocidades distintas.
- HUD con roles.
- Sprites, sonidos, niveles o persistencia.
- Cambios al laberinto, al túnel o a las vidas.

Cada uno, si llega, va en su propia spec.
