const boardElement = document.getElementById('board');
const scoreElement = document.getElementById('score');
const autoPlayBtn = document.getElementById('auto-play');

let board = [];
let tiles = [];
let score = 0;
let size = 4;
let autoPlay = false;

function cellPosition(row, col) {
  return `translate(${col * 75}px, ${row * 75}px)`;
}

function createTile(value, row, col) {
  const el = document.createElement('div');
  el.className = 'tile new';
  el.textContent = value;
  el.style.transform = cellPosition(row, col);
  el.style.backgroundColor = getTileColor(value);
  boardElement.appendChild(el);
  return { value, row, col, element: el };
}

function init() {
  boardElement.querySelectorAll('.tile').forEach(t => t.remove());
  board = Array(size).fill().map(() => Array(size).fill(null));
  tiles = [];
  score = 0;
  updateScore(0);
  addTile();
  addTile();
}

function addTile() {
  let empty = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!board[r][c]) empty.push({r, c});
    }
  }
  if (empty.length === 0) return false;
  let {r, c} = empty[Math.floor(Math.random() * empty.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  const tile = createTile(value, r, c);
  board[r][c] = tile;
  tiles.push(tile);
  return true;
}

function updateScore(add) {
  score += add;
  scoreElement.textContent = score;
}

function getTileColor(value) {
  const colors = {
    2: '#F08080',
    4: '#F4A460',
    8: '#FFD700',
    16: '#ADFF2F',
    32: '#7FFF00',
    64: '#00FA9A',
    128: '#00CED1',
    256: '#1E90FF',
    512: '#9370DB',
    1024: '#8A2BE2',
    2048: '#FF69B4'
  };
  return colors[value] || '#333';
}

function rotate90(b) {
  const n = b.length;
  const result = Array(n).fill().map(() => Array(n).fill(null));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      result[j][n - i - 1] = b[i][j];
  return result;
}

function slide(row) {
  let arr = row.filter(v => v);
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i].value === arr[i + 1].value) {
      arr[i].value *= 2;
      arr[i].element.textContent = arr[i].value;
      arr[i].element.style.backgroundColor = getTileColor(arr[i].value);
      updateScore(arr[i].value);
      arr[i + 1].element.remove();
      tiles.splice(tiles.indexOf(arr[i + 1]), 1);
      arr[i + 1] = null;
    }
  }
  arr = arr.filter(v => v);
  while (arr.length < size) arr.push(null);
  return arr;
}

function move(direction) {
  let rotated = false;
  let moved = false;

  for (let i = 0; i < direction; i++) {
    board = rotate90(board);
    rotated = true;
  }

  for (let r = 0; r < size; r++) {
    const original = board[r].slice();
    const newRow = slide(board[r]);
    if (newRow.some((v, idx) => v !== original[idx])) moved = true;
    board[r] = newRow;
  }

  for (let i = direction; i < 4 && rotated; i++) {
    board = rotate90(board);
  }

  if (moved) {
    updatePositions();
    addTile();
  }

  if (autoPlay) setTimeout(autoMove, 150);
}

function updatePositions() {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const tile = board[r][c];
      if (tile) {
        tile.row = r;
        tile.col = c;
        tile.element.style.transform = cellPosition(r, c);
      }
    }
  }
}

function autoMove() {
  if (!hasMoves()) {
    autoPlay = false;
    autoPlayBtn.classList.remove('active');
    return;
  }

  const directions = [0,1,2,3];
  const scores = directions.map(d => evaluateMove(d));
  const best = scores.indexOf(Math.max(...scores));
  move(best);
}

function evaluateMove(dir) {
  const savedBoard = board.map(row => row.map(tile => tile ? {...tile} : null));
  const savedTiles = tiles.slice();
  const savedScore = score;
  move(dir);
  const h = heuristic(board);
  // restore
  boardElement.querySelectorAll('.tile').forEach(t => t.remove());
  board = savedBoard.map(row => row.map(tile => {
    if (tile) {
      const el = createTile(tile.value, tile.row, tile.col);
      return {...tile, element: el};
    }
    return null;
  }));
  tiles = board.flat().filter(v => v);
  score = savedScore;
  updateScore(0);
  return h;
}

function heuristic(b) {
  let empty = 0;
  let max = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const tile = b[r][c];
      if (!tile) empty++;
      if (tile && tile.value > max) max = tile.value;
    }
  }
  return empty * 10 + max;
}

function hasMoves() {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const tile = board[r][c];
      if (!tile) return true;
      if (c < size - 1 && tile && board[r][c+1] && tile.value === board[r][c+1].value) return true;
      if (r < size - 1 && tile && board[r+1][c] && tile.value === board[r+1][c].value) return true;
    }
  }
  return false;
}

window.addEventListener('keydown', e => {
  switch(e.key) {
    case 'ArrowUp': move(0); break;
    case 'ArrowRight': move(1); break;
    case 'ArrowDown': move(2); break;
    case 'ArrowLeft': move(3); break;
  }
});

autoPlayBtn.addEventListener('click', () => {
  autoPlay = !autoPlay;
  autoPlayBtn.classList.toggle('active');
  if (autoPlay) autoMove();
});

init();
