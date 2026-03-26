
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');

// New Power-Up DOM Elements
const powerUpCanvas = document.getElementById('power-up-block');
const powerUpContext = powerUpCanvas.getContext('2d');
const powerUpCountElement = document.getElementById('power-up-count');
const btnAddPowerUp = document.getElementById('btn-add-power-up');
const btnUsePowerUp = document.getElementById('btn-use-power-up');

// Buttons
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnDown = document.getElementById('btn-down');
const btnRotate = document.getElementById('btn-rotate');

context.scale(20, 20);
nextContext.scale(20, 20);
powerUpContext.scale(20, 20); // Scale for the new canvas

// --- State ---
let isPaused = false;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let powerUpCount = 0; // New state
let isPowerUpActive = false; // New state

const arena = createMatrix(12, 20);
const player = {
    pos: {x: 0, y: 0},
    matrix: null,
    score: 0,
};

const UNIVERSAL_BLOCK = [[8]]; // New constant for the special block

// --- Shapes (3 to 7 blocks) ---
const SHAPES = {
    3: [[[1, 1, 1]], [[1, 1], [0, 1]], [[1, 0], [1, 1]]],
    4: [[[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]], [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]], [[0, 0, 1], [1, 1, 1]], [[1, 0, 0], [1, 1, 1]]],
    5: [[[1, 1, 1, 1, 1]], [[0, 1, 0], [1, 1, 1], [0, 1, 0]], [[1, 1, 0], [0, 1, 0], [0, 1, 1]], [[1, 1, 1], [1, 0, 1]], [[1, 1, 1, 1], [0, 1, 0, 0]]],
    6: [[[1, 1, 1, 1, 1, 1]], [[1, 1, 1], [1, 1, 1]], [[0, 1, 1], [1, 1, 0], [1, 1, 0]], [[1, 1, 1, 1], [1, 1, 0, 0]]],
    7: [[[1, 1, 1, 1, 1, 1, 1]], [[1, 1, 1], [1, 0, 1], [1, 1, 1]], [[0, 1, 0], [0, 1, 0], [1, 1, 1], [1, 0, 1]], [[1, 1, 1, 1], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]]],
};

const colors = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF', '#FFFFFF']; // Added white (index 8) for universal block

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
    // Prevents the universal block from being permanently merged into the arena grid
    if (isPowerUpActive) return;
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
    for (let i = 0; i < cols; i++) {
        newMatrix.push(new Array(rows).fill(0));
    }
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

        if (isPowerUpActive) {
            const landingRow = player.pos.y;
            if (landingRow >= 0 && landingRow < arena.length) {
                arena.splice(landingRow, 1); // Remove the row at the landing position
                arena.unshift(new Array(arena[0] ? arena[0].length : 12).fill(0)); // Add a new empty row at the top
                player.score += 50; // Award 50 points for a power-up clear
            }
            isPowerUpActive = false;
        } else {
            merge(arena, player);
        }

        playerReset();
        arenaSweep();
        updateScore();
    }
    dropCounter = 0;
}

function playerMove(dir) {
    if (isPaused) return;
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
        powerUpCount = 0; // Reset power-ups on game over
        updatePowerUpDisplay();
    }
}

function playerRotate(dir) {
    if (isPaused || isPowerUpActive) return; // Disable rotation for power-up block
    const pos = player.pos.x;
    let offset = 1;
    const rotatedMatrix = rotate(player.matrix, dir);
    const originalMatrix = player.matrix;
    player.matrix = rotatedMatrix;
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            player.matrix = originalMatrix;
            player.pos.x = pos;
            return;
        }
    }
}

// --- NEW Power-Up Functions ---

function updatePowerUpDisplay() {
    powerUpCountElement.innerText = powerUpCount;
    powerUpContext.fillStyle = '#000';
    powerUpContext.fillRect(0, 0, 1, 1);
    powerUpContext.fillStyle = colors[8]; // Universal block color
    powerUpContext.fillRect(0, 0, 1, 1);
}

function addPowerUp() {
    window.open('https://omg10.com/4/10790566', '_blank');
    if (isPaused) return;
    powerUpCount++;
    updatePowerUpDisplay();
}

function usePowerUp() {
    if (isPaused || powerUpCount <= 0 || isPowerUpActive) return;
    powerUpCount--;
    updatePowerUpDisplay();
    isPowerUpActive = true;
    player.matrix = UNIVERSAL_BLOCK;
    player.pos.y = 0; // Reset position to top-center for the 1x1 block
    player.pos.x = (arena[0].length / 2 | 0) - 1;
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
        context.fillText('已暂停', 6, 10);
    }
}

// --- Event Listeners ---

document.addEventListener('keydown', event => {
    if (event.keyCode === 32) event.preventDefault();
    switch (event.keyCode) {
        case 32: togglePause(); break;
        case 37: playerMove(-1); break;
        case 39: playerMove(1); break;
        case 40: if (!isPaused) playerDrop(); break;
        case 81: case 87: playerRotate(event.keyCode === 87 ? 1 : -1); break;
    }
});

canvas.addEventListener('click', togglePause);
btnLeft.addEventListener('click', () => playerMove(-1));
btnRight.addEventListener('click', () => playerMove(1));
btnDown.addEventListener('click', () => { if (!isPaused) playerDrop(); });
btnRotate.addEventListener('click', () => playerRotate(1));

// NEW Event Listeners
btnAddPowerUp.addEventListener('click', addPowerUp);
btnUsePowerUp.addEventListener('click', usePowerUp);

// --- Game Start ---

playerReset();
updateScore();
updatePowerUpDisplay(); // Initial draw for the power-up UI
update();
