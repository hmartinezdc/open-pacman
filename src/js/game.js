// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS, GHOST_RESPAWN_DELAYS, POWER_TILE.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

const PEN_EXIT = { x: 13, y: 11 }; // celda sobre la puerta de la pen
const PEN_COLUMN = PEN_EXIT.x;     // 13, columna de la puerta
const PEN_TOP_ROW = 12;            // y < 12 significa fuera de la pen
const DIR_ORDER = [ 'up', 'left', 'down', 'right' ]; // desempate del arcade
const TIMID_DISTANCE = 8;     // celdas: umbral del naranja persigue/huye
const TIMID_CORNER = { x: 0, y: 30 }; // esquina inferior izquierda

// Power pellet: puntos, duracion del modo asustado y velocidades nuevas.
// Todas las velocidades son fracciones que caen en enteros (ver aligned()).
const POWER_SCORE = 50;
const FRIGHTENED_FRAMES = 360;        // ~6 s a 60 fps
const FRIGHTENED_FLASH_FRAMES = 120;  // ultimos ~2 s: los fantasmas parpadean
const FRIGHTENED_SPEED = 0.05;        // mitad de GHOST_SPEED
const RETURN_SPEED = 0.2;             // ojos volviendo a la pen
const RETURN_TIMEOUT_FRAMES = 600;    // watchdog por si la vuelta se atasca
const GHOST_EAT_POINTS = [ 200, 400, 800, 1600 ];

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  // Comestibles: dots (2) y power pellets (4). Los cuatro pellets ganan.
  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === POWER_TILE ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    frightenedTimer: 0, // frames restantes del modo asustado
    ghostCombo: 0,      // fantasmas comidos con el pellet actual
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      exited: false,
      home: { x: g.x, y: g.y }, // celda de partida; ahi vuelven los ojos
      frightened: false,        // asustado por un pellet activo
      returning: false,         // ojos volviendo a la pen
      returnFrames: 0,
      releaseIn: g.releaseIn,
      target: null,
    } ) ),
  };
}

// Activa el modo asustado: reinicia temporizador y combo, asusta a los
// fantasmas y hace que los que ya salieron inviertan el rumbo una vez.
function startFrightened( game ) {
  game.frightenedTimer = FRIGHTENED_FRAMES;
  game.ghostCombo = 0;
  for ( const g of game.ghosts ) {
    if ( g.returning ) continue;
    if ( !g.frightened && g.exited ) g.dir = OPPOSITE[ g.dir ];
    g.frightened = true;
  }
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado por pared (1); tras salir de la pen, tambien por la puerta (3)
function isWall( grid, x, y, who ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && ( who === 'pacman' || who.exited ) ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, who ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, who );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o power pellet.
    const cell = grid[ p.y ][ p.x ];
    if ( cell === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    } else if ( cell === POWER_TILE ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += POWER_SCORE;
      game.dotsRemaining--;
      startFrightened( game );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

function decideGhost( game, g ) {
  const grid = game.grid;

  const options = DIR_ORDER.filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, g )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ OPPOSITE[ g.dir ] ];

  if ( g.returning ) {
    // Ojos: apuntan a su celda de partida y pueden cruzar la puerta.
    g.target = g.home;
    g.dir = pickDirByDistance( g, choices, g.home );
    return;
  }

  if ( !g.exited ) {
    // Modo de salida: ignorar el rol y salir por ruta determinista:
    // centrarse horizontalmente en la columna de la puerta y luego subir.
    g.target = PEN_EXIT;
    const gx = Math.round( g.x );
    if ( gx < PEN_COLUMN && canMove( grid, g.x, g.y, 'right', g ) ) {
      g.dir = 'right';
    } else if ( gx > PEN_COLUMN && canMove( grid, g.x, g.y, 'left', g ) ) {
      g.dir = 'left';
    } else if ( canMove( grid, g.x, g.y, 'up', g ) ) {
      g.dir = 'up';
    } else {
      // Respaldo: no deberia darse en el laberinto actual.
      g.dir = pickDirByDistance( g, choices, PEN_EXIT );
    }
    return;
  }

  // Asustado: huir, eligiendo la direccion que mas se aleja de Pac-Man.
  if ( g.frightened ) {
    const p = game.pacman;
    g.target = { x: Math.round( p.x ), y: Math.round( p.y ) };
    g.dir = pickDirByDistance( g, choices, g.target, true );
    return;
  }

  // Objetivo segun rol; null = rol sin objetivo definido: fallback aleatorio.
  const target = roleTarget( game, g );
  g.target = target;
  if ( target === null ) {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    return;
  }
  g.dir = pickDirByDistance( g, choices, target );
}

// Objetivo de cada rol. Puede caer fuera del laberinto: solo sirve para
// comparar distancias. Devuelve null si el rol no esta implementado.
function roleTarget( game, g ) {
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );

  if ( g.kind === 'chaser' ) return { x: px, y: py };

  if ( g.kind === 'ambusher' ) {
    // 4 celdas delante de Pac-Man, en su direccion actual.
    const d = DIRS[ p.dir ];
    return { x: px + d.x * 4, y: py + d.y * 4 };
  }

  if ( g.kind === 'vector' ) {
    // Vector rojo->pivot (pacman + 2*dir) doblado: 2 * pivot - rojo.
    const d = DIRS[ p.dir ];
    const red = game.ghosts.find( ( other ) => other.kind === 'chaser' );
    if ( !red ) return null;
    return {
      x: 2 * ( px + d.x * 2 ) - Math.round( red.x ),
      y: 2 * ( py + d.y * 2 ) - Math.round( red.y ),
    };
  }

  if ( g.kind === 'timid' ) {
    const dx = Math.round( g.x ) - px;
    const dy = Math.round( g.y ) - py;
    // Persigue de lejos; de cerca huye a la esquina inferior izquierda.
    if ( dx * dx + dy * dy > TIMID_DISTANCE * TIMID_DISTANCE ) {
      return { x: px, y: py };
    }
    return TIMID_CORNER;
  }

  return null;
}

// Elige la direccion de choices con la mejor distancia euclidea al cuadrado
// hasta el objetivo: la menor, o la mayor si flee (huida). Empate: el
// primero en DIR_ORDER.
function pickDirByDistance( g, choices, target, flee ) {
  let best = choices[ 0 ];
  let bestDist = flee ? -Infinity : Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist =
      ( nx - target.x ) * ( nx - target.x ) + ( ny - target.y ) * ( ny - target.y );
    if ( flee ? dist > bestDist : dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

// Estado de ojos: vuelve a la pen tras ser comido. Con exited false puede
// cruzar la puerta y no interacciona con Pac-Man.
function startReturn( g ) {
  g.returning = true;
  g.frightened = false;
  g.exited = false;
  g.returnFrames = 0;
  g.target = null;
}

function finishReturn( game, g ) {
  // De vuelta en su celda: espera su retardo habitual y sale por la puerta.
  const i = game.ghosts.indexOf( g );
  g.x = g.home.x;
  g.y = g.home.y;
  g.dir = 'up';
  g.exited = false;
  g.returning = false;
  g.returnFrames = 0;
  g.frightened = false;
  g.releaseIn = GHOST_RESPAWN_DELAYS[ i ];
  g.target = null;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( g.returning ) {
    // Reloj de seguridad: si la vuelta codiciosa se atasca, regreso directo.
    g.returnFrames++;
    if ( g.returnFrames > RETURN_TIMEOUT_FRAMES ) {
      finishReturn( game, g );
      return;
    }
  } else if ( g.releaseIn > 0 ) {
    // Cuenta atras de salida: el fantasma espera en la pen hasta soltarse.
    g.releaseIn--;
    return;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );

    if ( g.returning ) {
      // Los ojos llegan a su celda de partida: fantasma de vuelta.
      if ( g.x === g.home.x && g.y === g.home.y ) {
        finishReturn( game, g );
        return;
      }
    } else if ( !g.exited && g.y < PEN_TOP_ROW ) {
      // Al asomar sobre la pen, la puerta se cierra para este fantasma.
      g.exited = true;
    }

    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, g ) ) return;
  }

  const speed =
    g.returning ? RETURN_SPEED : ( g.frightened ? FRIGHTENED_SPEED : g.speed );
  const d = DIRS[ g.dir ];
  g.x += d.x * speed;
  g.y += d.y * speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  // Una muerte corta el modo asustado.
  game.frightenedTimer = 0;
  game.ghostCombo = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.exited = false;
    g.frightened = false;
    g.returning = false;
    g.returnFrames = 0;
    // Tras una muerte la espera es corta, no el retardo inicial.
    g.releaseIn = GHOST_RESPAWN_DELAYS[ i ];
    g.target = null;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  // El modo asustado se agota frame a frame; al terminar todos se asientan.
  if ( game.frightenedTimer > 0 ) {
    game.frightenedTimer--;
    if ( game.frightenedTimer === 0 ) {
      for ( const g of game.ghosts ) g.frightened = false;
    }
  }

  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( g.returning || !collides( game.pacman, g ) ) continue;

    if ( g.frightened ) {
      // Comer fantasma: puntos por combo y a la pen como ojos.
      const pts =
        GHOST_EAT_POINTS[ Math.min( game.ghostCombo, GHOST_EAT_POINTS.length - 1 ) ];
      game.score += pts;
      game.ghostCombo++;
      startReturn( g );
      continue;
    }

    game.lives--;
    if ( game.lives <= 0 ) {
      game.state = 'lost';
      return;
    }
    resetPositions( game );
    break;
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
window.FRIGHTENED_FLASH_FRAMES = FRIGHTENED_FLASH_FRAMES;
