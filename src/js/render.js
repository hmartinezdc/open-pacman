// render.js
// Dibujo arcade sobre canvas. Usa game.grid (no MAZE) para reflejar dots comidos.

const TILE = 20;
const WALL_COLOR = '#2121ff';
const DOOR_COLOR = '#ffb8ff';
const DOT_COLOR = '#ffb897';
const FRIGHTENED_COLOR = '#2121ff';   // cuerpo del fantasma asustado
const FRIGHTENED_FACE_COLOR = '#fff'; // ojos y boca del fantasma asustado

function cellCenter( x, y ) {
  return { cx: x * TILE + TILE / 2, cy: y * TILE + TILE / 2 };
}

// Paredes estilo arcade: lineas finas redondeadas que conectan los centros
// de celdas-pared adyacentes. Produce el trazado continuo del original.
function drawWalls( ctx, grid ) {
  const H = grid.length;
  const W = grid[ 0 ].length;
  ctx.strokeStyle = WALL_COLOR;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for ( let y = 0; y < H; y++ ) {
    for ( let x = 0; x < W; x++ ) {
      if ( grid[ y ][ x ] !== 1 ) continue;
      const { cx, cy } = cellCenter( x, y );
      // Conectar solo hacia derecha y abajo evita trazos duplicados.
      if ( x + 1 < W && grid[ y ][ x + 1 ] === 1 ) {
        ctx.moveTo( cx, cy );
        ctx.lineTo( cx + TILE, cy );
      }
      if ( y + 1 < H && grid[ y + 1 ][ x ] === 1 ) {
        ctx.moveTo( cx, cy );
        ctx.lineTo( cx, cy + TILE );
      }
      // Celda-pared aislada (sin vecino): punto corto para que se vea.
      const lone =
        ( x + 1 >= W || grid[ y ][ x + 1 ] !== 1 ) &&
        ( x - 1 < 0 || grid[ y ][ x - 1 ] !== 1 ) &&
        ( y + 1 >= H || grid[ y + 1 ][ x ] !== 1 ) &&
        ( y - 1 < 0 || grid[ y - 1 ][ x ] !== 1 );
      if ( lone ) {
        ctx.moveTo( cx - 3, cy );
        ctx.lineTo( cx + 3, cy );
      }
    }
  }
  ctx.stroke();
}

function drawDoor( ctx, grid ) {
  const H = grid.length;
  const W = grid[ 0 ].length;
  ctx.strokeStyle = DOOR_COLOR;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for ( let y = 0; y < H; y++ ) {
    for ( let x = 0; x < W; x++ ) {
      if ( grid[ y ][ x ] !== 3 ) continue;
      const px = x * TILE;
      const py = y * TILE + TILE / 2;
      ctx.moveTo( px, py );
      ctx.lineTo( px + TILE, py );
    }
  }
  ctx.stroke();
}

function drawDots( ctx, grid ) {
  ctx.fillStyle = DOT_COLOR;
  for ( let y = 0; y < grid.length; y++ ) {
    for ( let x = 0; x < grid[ 0 ].length; x++ ) {
      if ( grid[ y ][ x ] !== 2 ) continue;
      const { cx, cy } = cellCenter( x, y );
      ctx.beginPath();
      ctx.arc( cx, cy, 2.5, 0, Math.PI * 2 );
      ctx.fill();
    }
  }
}

// Power pellets: pulso suave y brillo para distinguirlos de los dots.
function drawPowerPellets( ctx, grid, frame ) {
  const r = 5 + Math.sin( frame * 0.12 ) * 1.2;
  ctx.fillStyle = DOT_COLOR;
  ctx.shadowColor = DOT_COLOR;
  ctx.shadowBlur = 8;
  for ( let y = 0; y < grid.length; y++ ) {
    for ( let x = 0; x < grid[ 0 ].length; x++ ) {
      if ( grid[ y ][ x ] !== POWER_TILE ) continue;
      const { cx, cy } = cellCenter( x, y );
      ctx.beginPath();
      ctx.arc( cx, cy, r, 0, Math.PI * 2 );
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
}

function drawPacman( ctx, p, frame ) {
  const { cx, cy } = cellCenter( p.x, p.y );
  let rot = 0;
  if ( p.dir === 'right' ) rot = 0;
  else if ( p.dir === 'down' ) rot = Math.PI / 2;
  else if ( p.dir === 'left' ) rot = Math.PI;
  else if ( p.dir === 'up' ) rot = -Math.PI / 2;

  // Boca animada: abre/cierra con el frame.
  const open = ( Math.sin( frame * 0.3 ) * 0.5 + 0.5 ) * 0.28 + 0.02;

  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.moveTo( cx, cy );
  ctx.arc( cx, cy, TILE / 2 - 1, rot + open * Math.PI, rot - open * Math.PI );
  ctx.closePath();
  ctx.fill();
}

function drawGhostBody( ctx, cx, cy, color ) {
  const r = TILE / 2 - 1;
  const bottom = cy + r;
  const left = cx - r;
  const right = cx + r;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc( cx, cy - 1, r, Math.PI, 0, false ); // cabeza
  ctx.lineTo( right, bottom );
  // falda ondulada (3 picos)
  ctx.lineTo( right - r * 0.66, bottom - 4 );
  ctx.lineTo( cx, bottom );
  ctx.lineTo( left + r * 0.66, bottom - 4 );
  ctx.lineTo( left, bottom );
  ctx.closePath();
  ctx.fill();
}

// Ojos normales: blancos con pupila mirando segun direccion.
function drawGhostEyes( ctx, cx, cy, dir, pupil ) {
  const d = DIRS[ dir ] || { x: 0, y: 0 };
  for ( const off of [ -3.5, 3.5 ] ) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc( cx + off, cy - 1, 3, 0, Math.PI * 2 );
    ctx.fill();
    if ( !pupil ) continue;
    ctx.fillStyle = pupil;
    ctx.beginPath();
    ctx.arc( cx + off + d.x * 1.6, cy - 1 + d.y * 1.6, 1.5, 0, Math.PI * 2 );
    ctx.fill();
  }
}

// Cara del fantasma asustado: dos ojos sin pupila y boca en zigzag.
// El color se invierte cuando el cuerpo parpadea en blanco.
function drawScaredFace( ctx, cx, cy, color ) {
  ctx.fillStyle = color;
  for ( const off of [ -3.5, 3.5 ] ) {
    ctx.beginPath();
    ctx.arc( cx + off, cy - 2, 2, 0, Math.PI * 2 );
    ctx.fill();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo( cx - 5, cy + 4 );
  ctx.lineTo( cx - 3, cy + 2 );
  ctx.lineTo( cx - 1, cy + 4 );
  ctx.lineTo( cx + 1, cy + 2 );
  ctx.lineTo( cx + 3, cy + 4 );
  ctx.lineTo( cx + 5, cy + 2 );
  ctx.stroke();
}

function drawGhost( ctx, g, color, flash ) {
  const { cx, cy } = cellCenter( g.x, g.y );

  // Solo ojos mientras vuelve a la pen tras ser comido.
  if ( g.returning ) {
    drawGhostEyes( ctx, cx, cy, g.dir, '#0000bb' );
    return;
  }

  if ( g.frightened ) {
    drawGhostBody( ctx, cx, cy, flash ? '#fff' : FRIGHTENED_COLOR );
    drawScaredFace( ctx, cx, cy, flash ? '#ff0000' : FRIGHTENED_FACE_COLOR );
    return;
  }

  drawGhostBody( ctx, cx, cy, color );
  drawGhostEyes( ctx, cx, cy, g.dir, '#0000bb' );
}

// Depuracion opcional activada con window.DEBUG_GHOSTS = true.
// Dibuja la linea de cada fantasma a su objetivo y marca esa celda.
function drawGhostTargets( ctx, ghosts ) {
  if ( !window.DEBUG_GHOSTS ) return;
  for ( let i = 0; i < ghosts.length; i++ ) {
    const g = ghosts[ i ];
    if ( !g.target ) continue;
    const color = GHOST_COLORS[ i ] || '#ff0000';
    const { cx, cy } = cellCenter( g.x, g.y );
    const { cx: tx, cy: ty } = cellCenter( g.target.x, g.target.y );

    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo( cx, cy );
    ctx.lineTo( tx, ty );
    ctx.stroke();

    ctx.globalAlpha = 0.9;
    ctx.strokeRect( g.target.x * TILE + 3, g.target.y * TILE + 3, TILE - 6, TILE - 6 );
    ctx.globalAlpha = 1;
  }
}

function drawHUD( ctx, game, W ) {
  ctx.fillStyle = '#fff';
  ctx.font = '14px "Courier New", monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText( 'SCORE ' + game.score, 8, 4 );
  ctx.textAlign = 'right';
  ctx.fillText( 'VIDAS ' + game.lives, W * TILE - 8, 4 );
}

const GHOST_COLORS = [ '#ff0000', '#ffb8ff', '#00ffff', '#ffb852' ];

function draw( ctx, game, frame ) {
  const grid = game.grid;
  const W = grid[ 0 ].length;
  const H = grid.length;

  ctx.fillStyle = '#000';
  ctx.fillRect( 0, 0, W * TILE, H * TILE );

  drawWalls( ctx, grid );
  drawDoor( ctx, grid );
  drawDots( ctx, grid );
  drawPowerPellets( ctx, grid, frame );
  drawPacman( ctx, game.pacman, frame );

  // Parpadeo blanco durante los ultimos FRIGHTENED_FLASH_FRAMES frames.
  const flash =
    game.frightenedTimer > 0 &&
    game.frightenedTimer < FRIGHTENED_FLASH_FRAMES &&
    Math.floor( game.frightenedTimer / 15 ) % 2 === 0;
  game.ghosts.forEach( ( g, i ) =>
    drawGhost( ctx, g, GHOST_COLORS[ i ] || '#ff0000', flash )
  );
  drawGhostTargets( ctx, game.ghosts );
  drawHUD( ctx, game, W );
}

window.draw = draw;
