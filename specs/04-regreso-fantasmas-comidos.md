# SPEC 04 — Regreso fiable de los fantasmas comidos a la pen

> **Estado:** Aprobado
> **Depende de:** SPEC 03
> **Fecha:** 2026-11-08
> **Objetivo:** Corregir el regreso de los ojos para que cualquier fantasma comido, desde cualquier posición fraccionaria, navegue por el laberinto hasta su celda `home` y se reconstruya allí con `GHOST_RESPAWN_DELAYS`.

## Por qué existe esta spec

SPEC 03 implementó los ojos, pero solo funcionan si el fantasma es comido exactamente en un centro de celda. Los fantasmas asustados avanzan a `0.05` y los ojos a `0.2`; `aligned()` exige que la coordenada esté a menos de `1e-3` de un entero. Al empezar en un offset múltiplo de `0.05` que no sea también múltiplo de `0.2`, la suma de pasos de `0.2` nunca cae en un entero.

Sin alineación, `decideGhost` no vuelve a ejecutarse y `canMove` tampoco: los ojos siguen en línea recta a través de paredes y fuera del tablero. A los 600 frames el watchdog los teletransporta a `home`, lo que se percibe como «desaparecen y reaparecen».

La simulación de los 5.120 centros de celda (celda, dirección y fantasma) no detectaba el fallo porque siempre partía de posiciones enteras. Con offsets de `0.05` fallan 16 de los 20 casos: `0.05`, `0.10`, `0.15`, `0.25`, `0.30`, `0.35`, `0.45`…

## Alcance

**Entra:**

- Ajustar la posición del fantasma al centro de celda más cercano al entrar en `returning`, con `Math.round`.
- Aplicar `wrapTunnel` tras el ajuste para la fila 14.
- Pasar `game` a `startReturn` para disponer del ancho del grid.
- Mantener `home`, `GHOST_RESPAWN_DELAYS`, `RETURN_SPEED = 0.2`, el watchdog de 600 frames y la reconstrucción visible del cuerpo al llegar.
- Nota en `AGENTS.md` sobre la invariante de alineación de los ojos.

**No entra (para otras specs):**

- Cambiar el destino: sigue siendo la celda `home` de cada fantasma.
- Cambiar el tiempo de espera: sigue siendo `GHOST_RESPAWN_DELAYS = [0, 15, 30, 45]`.
- Añadir animación de reconstrucción, sonidos o sprites.
- Cambiar el modo asustado, el combo, los roles, la salida de la pen, el túnel, las vidas, la victoria o la derrota.
- Delta time, módulos ES o tests automatizados.

## Modelo de datos

No se añaden estructuras nuevas. Cambia una firma y se añade una invariante:

```js
function startReturn( game, g ) {
  // ...
}
```

Convenciones:

- `g.x` y `g.y` siguen en unidades de celda.
- Tras `startReturn`, `Math.round( g.x ) === g.x` y `Math.round( g.y ) === g.y`.
- En la fila del túnel, el ajuste se envuelve al rango `[ 0, width )`.
- No se cambia `g.dir`; `decideGhost` resuelve la dirección válida en el siguiente frame.

Ajuste concreto:

```js
g.x = Math.round( g.x );
g.y = Math.round( g.y );
wrapTunnel( g, game.grid[ 0 ].length );
```

## Comportamientos

1. `update` llama a `startReturn( game, g )` al comer un fantasma asustado.
2. `startReturn` ajusta `x` e `y` al centro de celda más cercano, envuelve el túnel y después marca `returning = true`, `frightened = false`, `exited = false`, `returnFrames = 0` y `target = null`.
3. Desde el frame siguiente el fantasma está alineado, por lo que `decideGhost` vuelve a elegir direcciones hacia `home` con `canMove`, y `moveGhost` avanza a `0.2` con la puerta transitable.
4. Al llegar, `finishReturn` no cambia: posición en `home`, `dir = 'up'`, `releaseIn = GHOST_RESPAWN_DELAYS[ i ]`; espera y vuelve a salir.
5. El watchdog sigue activo, pero no debería dispararse en una partida normal.
6. El salto visual máximo es media celda (10 px) y ocurre una sola vez, en el frame en que el cuerpo se convierte en ojos.

## Plan de implementación

1. **`src/js/game.js` — `startReturn`.** Añadir el parámetro `game`; ajustar `x`/`y` al centro más cercano y envolver el túnel antes de cambiar los flags. Prueba manual: comer un fantasma a mitad de pasillo y ver que los ojos giran en los centros y no atraviesan paredes.
2. **`src/js/game.js` — llamada.** Cambiar `startReturn( g )` por `startReturn( game, g )` en `update`. Prueba manual: la partida arranca sin errores y el regreso funciona desde varios puntos.
3. **`AGENTS.md` — nota de alineación.** Documentar que los ojos se ajustan al centro al empezar el regreso y por qué. Prueba manual: contrastar la nota con `startReturn`.

## Criterios de aceptación

- [ ] Al abrir `src/index.html` no hay errores en la consola.
- [ ] El fantasma comido se convierte en ojos y llega a `home` sin atravesar paredes ni salir del canvas.
- [ ] Funciona desde offsets que hoy fallan (`0.05`, `0.10`, `0.15`, `0.25`…), probando comidas en distintos pasillos.
- [ ] El watchdog de 600 frames no se dispara en una partida normal.
- [ ] Al llegar, el cuerpo se dibuja en `home` y permanece visible durante `GHOST_RESPAWN_DELAYS[ i ]` frames antes de salir.
- [ ] Cada fantasma se reconstruye en su celda de inicio: `(13,14)`, `(14,14)`, `(12,14)` y `(15,14)`.
- [ ] Comer un fantasma en la fila 14 envuelve el túnel correctamente y los ojos llegan a `home`.
- [ ] El combo `200/400/800/1600` no cambia y comer un asustado no quita vida.
- [ ] Si el temporizador de miedo termina durante el regreso, los ojos llegan igual y el fantasma reaparece normal.
- [ ] La puerta sigue siendo transitable para los ojos y muro tras `exited === true` y para Pac-Man.
- [ ] Perder una vida durante un regreso reinicia a todos los fantasmas como antes.
- [ ] Roles, salida escalonada, túnel, victoria y derrota siguen igual.

### Cómo verificar

1. Abrir `src/index.html`.
2. Comer un power pellet y un fantasma a mitad de pasillo, no justo en un centro.
3. Seguir los ojos: deben girar en centros de celda, nunca cruzar paredes y entrar en la pen.
4. Repetir al menos cinco veces desde zonas distintas: cerca del túnel de la fila 14, esquinas y debajo de la pen.
5. Confirmar que cada regreso dura bastante menos de 10 s y que ningún ojo desaparece.
6. Al llegar, comprobar que el cuerpo aparece en su `home`, espera su turno y sale.
7. Activar `window.DEBUG_GHOSTS = true` y confirmar que el objetivo de un fantasma `returning` es su `home`.
8. Comprobar combo, vidas y que los comportamientos de SPEC 01–03 siguen vigentes.

## Decisiones tomadas y descartadas

- **Sí:** ajustar al centro más cercano en `startReturn`. Es el cambio mínimo, garantiza `aligned()` y conserva velocidad y lógica.
- **Sí:** redondear ambas coordenadas y envolver el túnel. El fantasma está en un pasillo, así que el centro más cercano es transitable; el wrap cubre la fila 14.
- **Sí:** conservar el watchdog de 600 frames. Red de seguridad barata; con el arreglo no debería activarse.
- **Sí:** mantener `RETURN_SPEED = 0.2`. Los ojos siguen siendo rápidos y el ajuste no alarga el regreso.
- **No:** avanzar celda a celda con paso limitado. Evita el salto, pero cambia `moveGhost` y añade complejidad para un caso que el ajuste resuelve.
- **No:** bajar `RETURN_SPEED` a `0.05`. Alinearía, pero cuadruplica el regreso y obliga a revisar el watchdog.
- **No:** cambiar `home` al centro común de la pen. Se mantiene la celda de inicio actual de SPEC 03.
- **No:** añadir animación de reconstrucción. El cuerpo ya reaparece al llegar y la espera es visible.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Salto visible de hasta media celda al convertirse en ojos | Ocurre una sola vez, en la transición; los ojos ya están en movimiento. Si molesta, una spec futura puede pasar a avance por centros. |
| Redondear en el túnel deja `x` fuera de rango | `wrapTunnel` se aplica inmediatamente después del redondeo; verificar comiendo en la fila 14. |
| El centro más cercano cae en pared si el laberinto cambia | En el mapa actual el fantasma siempre está en un pasillo; el watchdog sigue como respaldo. |
| Cambiar la firma de `startReturn` rompe llamadas | Solo se llama desde `update`; el paso 2 actualiza la llamada. |
| El ajuste deja `g.dir` apuntando a una pared | `decideGhost` corre en el siguiente frame y elige una dirección válida; las 5.120 combinaciones de celda y dirección no se bloquean. |

## Qué NO entra en esta spec

- Cambiar el destino, el tiempo de espera o la animación de reconstrucción.
- Cambiar roles, velocidades, salida de la pen, puerta, túnel, vidas o condiciones de victoria y derrota.
- Sonidos, sprites, niveles, puntuaciones altas o persistencia.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
