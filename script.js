
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');

// Buttons
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnDown = document.getElementById('btn-down');
const btnRotate = document.getElementById('btn-rotate');

context.scale(20, 20);
nextContext.scale(20, 20);

// --- State ---
let isPaused = false;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

const arena = createMatrix(12, 20);
const player = {
    pos: {x: 0, y: 0},
    matrix: null,
    score: 0,
};

// --- Shapes (3 to 7 blocks) ---
const SHAPES = {
    3: [[[1, 1, 1]], [[1, 1], [0, 1]], [[1, 0], [1, 1]]],
    4: [[[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]], [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]], [[0, 0, 1], [1, 1, 1]], [[1, 0, 0], [1, 1, 1]]],
    5: [[[1, 1, 1, 1, 1]], [[0, 1, 0], [1, 1, 1], [0, 1, 0]], [[1, 1, 0], [0, 1, 0], [0, 1, 1]], [[1, 1, 1], [1, 0, 1]], [[1, 1, 1, 1], [0, 1, 0, 0]]],
    6: [[[1, 1, 1, 1, 1, 1]], [[1, 1, 1], [1, 1, 1]], [[0, 1, 1], [1, 1, 0], [1, 1, 0]], [[1, 1, 1, 1], [1, 1, 0, 0]]],
    7: [[[1, 1, 1, 1, 1, 1, 1]], [[1, 1, 1], [1, 0, 1], [1, 1, 1]], [[0, 1, 0], [0, 1, 0], [1, 1, 1], [1, 0, 1]], [[1, 1, 1, 1], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]]],
};

const colors = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'];

let nextPiece = createRandomPiece();

// --- Core Functions ---

function createRandomPiece() {
    const size = Math.floor(Math.random() * 5) + 3;
    const shapesOfSize = SHAPES[size];
    const shape = shapesOfSize[Math.floor(Math.random() * shapesOfSize.length)];
    const colorIndex = size - 2;
    return shape.map(row => row.map(value => value === 1 ? colorIndex : 0));
}

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function rotate(matrix, dir) {
    const newMatrix = [];
    const rows = matrix.length;
    const cols = matrix[0].length;

    // Create a new matrix with swapped dimensions
    for (let i = 0; i < cols; i++) {
        newMatrix.push(new Array(rows).fill(0));
    }

    // Populate the new matrix with rotated values
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (dir > 0) { // Clockwise
                newMatrix[x][rows - 1 - y] = matrix[y][x];
            } else { // Counter-clockwise
                newMatrix[cols - 1 - x][y] = matrix[y][x];
            }
        }
    }
    return newMatrix;
}


// --- Player Actions ---

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
        updateScore();
    }
    dropCounter = 0;
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) {
        player.pos.x -= dir;
    }
}

function playerReset() {
    player.matrix = nextPiece;
    nextPiece = createRandomPiece();
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    if (collide(arena, player)) {
        arena.forEach(row => row.fill(0));
        player.score = 0;
        updateScore();
    }
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    const rotatedMatrix = rotate(player.matrix, dir);
    
    // Temporarily apply rotation
    const originalMatrix = player.matrix;
    player.matrix = rotatedMatrix;

    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            // Revert rotation if it doesn't fit
            player.matrix = originalMatrix;
            player.pos.x = pos;
            return;
        }
    }
}

// --- Game Logic ---

function arenaSweep() {
    let rowCount = 1;
    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) continue outer;
        }
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;
        player.score += rowCount * 10;
        rowCount *= 2;
    }
}

function togglePause() {
    isPaused = !isPaused;
    if (!isPaused) update();
}

function update(time = 0) {
    if (isPaused) {
        draw();
        return;
    }
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) playerDrop();
    draw();
    requestAnimationFrame(update);
}

function updateScore() {
    scoreElement.innerText = player.score;
}

// --- Drawing ---

function drawMatrix(matrix, offset) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = colors[value];
                context.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

function drawNextPiece() {
    nextContext.fillStyle = '#000';
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    const piece = nextPiece;
    const x = (nextCanvas.width / 20 - piece[0].length) / 2;
    const y = (nextCanvas.height / 20 - piece.length) / 2;
    piece.forEach((row, rowIdx) => {
        row.forEach((value, colIdx) => {
            if (value !== 0) {
                nextContext.fillStyle = colors[value];
                nextContext.fillRect(x + colIdx, y + rowIdx, 1, 1);
            }
        });
    });
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(arena, {x: 0, y: 0});
    drawMatrix(player.matrix, player.pos);
    drawNextPiece();
    if (isPaused) {
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.font = '2px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.fillText('PAUSED', 6, 10);
    }
}

// --- Event Listeners ---

document.addEventListener('keydown', event => {
    if (event.keyCode === 32) event.preventDefault();
    switch (event.keyCode) {
        case 32: togglePause(); break;
        case 37: if (!isPaused) playerMove(-1); break;
        case 39: if (!isPaused) playerMove(1); break;
        case 40: if (!isPaused) playerDrop(); break;
        case 81: case 87: if (!isPaused) playerRotate(event.keyCode === 87 ? 1 : -1); break;
    }
});

canvas.addEventListener('click', togglePause);
btnLeft.addEventListener('click', () => { if (!isPaused) playerMove(-1); });
btnRight.addEventListener('click', () => { if (!isPaused) playerMove(1); });
btnDown.addEventListener('click', () => { if (!isPaused) playerDrop(); });
btnRotate.addEventListener('click', () => { if (!isPaused) playerRotate(1); });

// --- Game Start ---

playerReset();
updateScore();
update();
