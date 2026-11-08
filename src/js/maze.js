// maze.js
// Laberinto 28x31 fiel a la geometria del nivel 1 de Pac-Man.
// Se escribe como 31 strings de 28 chars (legible) y se parsea a numeros.
//   '#' pared(1) · '.' dot(2) · 'o' power pellet(4) · '-' puerta pen(3)
//   ' ' vacio transitable(0)
// Coordenadas: celda (x,y), origen arriba-izquierda. x in [0,27], y in [0,30].
// Simetrico respecto al eje vertical central (entre cols 13 y 14).

const MAZE_STR = [
  '############################', // 0  borde
  '#............##............#', // 1
  '#.####.#####.##.#####.####.#', // 2
  '#o####.#####.##.#####.####o#', // 3  power pellets superiores
  '#.####.#####.##.#####.####.#', // 4
  '#..........................#', // 5
  '#.####.##.########.##.####.#', // 6
  '#.####.##.########.##.####.#', // 7
  '#......##....##....##......#', // 8
  '######.#####.##.#####.######', // 9
  '######.#####.##.#####.######', // 10
  '######.##..........##.######', // 11
  '######.##.###--###.##.######', // 12  puerta pen cols 13-14
  '######.##.#      #.##.######', // 13  interior pen
  '          #      #          ', // 14  tunel (extremos abiertos) + pen
  '######.##.#      #.##.######', // 15  interior pen
  '######.##.########.##.######', // 16  fondo pen
  '######.##..........##.######', // 17
  '######.#####.##.#####.######', // 18
  '######.#####.##.#####.######', // 19
  '#............##............#', // 20
  '#.####.#####.##.#####.####.#', // 21
  '#.####.#####.##.#####.####.#', // 22
  '#o..##................##..o#', // 23  power pellets inferiores + fila inicio Pacman (13,23)
  '###.##.##.########.##.##.###', // 24
  '###.##.##.########.##.##.###', // 25
  '#......##....##....##......#', // 26
  '#.##########.##.##########.#', // 27
  '#.##########.##.##########.#', // 28
  '#..........................#', // 29
  '############################', // 30  borde
];

function parseTile( ch ) {
  if ( ch === '#' ) return 1;
  if ( ch === '.' ) return 2;
  if ( ch === 'o' ) return 4;
  if ( ch === '-' ) return 3;
  return 0; // espacio = vacio transitable
}

// Matriz numerica pristina (no se muta; cada partida copia esto).
const MAZE = MAZE_STR.map( ( row ) => row.split( '' ).map( parseTile ) );

const TUNNEL_ROW = 14;
const POWER_TILE = 4; // valor del tile 'o' (power pellet)
const PACMAN_START = { x: 13, y: 23 };
const GHOST_STARTS = [
  { kind: 'chaser',   x: 13, y: 14, releaseIn: 0 },   // dentro de la pen
  { kind: 'ambusher', x: 14, y: 14, releaseIn: 60 },  // dentro de la pen
  { kind: 'vector',   x: 12, y: 14, releaseIn: 120 }, // dentro de la pen
  { kind: 'timid',    x: 15, y: 14, releaseIn: 180 }, // dentro de la pen
];

// Espera tras la reconstruccion (ojos ya llegados a home), escalonada en el
// mismo orden que GHOST_STARTS: 1.5-3 s reparte la salida y se percibe mejor.
const GHOST_RESPAWN_DELAYS = [ 90, 120, 150, 180 ];

window.MAZE = MAZE;
window.TUNNEL_ROW = TUNNEL_ROW;
window.POWER_TILE = POWER_TILE;
window.PACMAN_START = PACMAN_START;
window.GHOST_STARTS = GHOST_STARTS;
window.GHOST_RESPAWN_DELAYS = GHOST_RESPAWN_DELAYS;
