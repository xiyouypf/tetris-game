
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const powerUpCanvas = document.getElementById('power-up-block');
const powerUpContext = powerUpCanvas.getContext('2d');
const powerUpCountElement = document.getElementById('power-up-count');
const btnAddPowerUp = document.getElementById('btn-add-power-up');
const btnUsePowerUp = document.getElementById('btn-use-power-up');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnDown = document.getElementById('btn-down');
const btnRotate = document.getElementById('btn-rotate');

// Screen and Button elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const gameContainer = document.querySelector('.game-container');
const btnStartGame = document.getElementById('btn-start-game');
const btnPlayAgain = document.getElementById('btn-play-again');
const finalScoreElement = document.getElementById('final-score');

context.scale(20, 20);
nextContext.scale(20, 20);
powerUpContext.scale(20, 20);

// --- State ---
let gameState = 'startScreen'; // 'startScreen', 'playing', 'paused', 'gameOver'
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let powerUpCount = 0;
let isPowerUpActive = false;

const arena = createMatrix(12, 20);
const player = {
    pos: {x: 0, y: 0},
    matrix: null,
    score: 0,
};

const UNIVERSAL_BLOCK = [[8]];

// --- Shapes (3 to 6 blocks) ---
const SHAPES = {
    3: [[[1, 1, 1]], [[1, 1], [0, 1]], [[1, 0], [1, 1]]],
    4: [[[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]], [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]], [[0, 0, 1], [1, 1, 1]], [[1, 0, 0], [1, 1, 1]]],
    5: [[[1, 1, 1, 1, 1]], [[0, 1, 0], [1, 1, 1], [0, 1, 0]], [[1, 1, 0], [0, 1, 0], [0, 1, 1]], [[1, 1, 1], [1, 0, 1]], [[1, 1, 1, 1], [0, 1, 0, 0]]],
    6: [[[1, 1, 1, 1, 1, 1]], [[1, 1, 1], [1, 1, 1]], [[0, 1, 1], [1, 1, 0], [1, 1, 0]], [[1, 1, 1, 1], [1, 1, 0, 0]]],
};

const colors = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF', '#FFFFFF'];
let nextPiece = null;

// --- Core Functions ---

function createRandomPiece() {
    const size = Math.floor(Math.random() * 4) + 3; // Random size from 3 to 6
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
            if (dir > 0) {
                newMatrix[x][rows - 1 - y] = matrix[y][x];
            } else {
                newMatrix[cols - 1 - x][y] = matrix[y][x];
            }
        }
    }
    return newMatrix;
}

// --- Player Actions ---

function playerDrop() {
    if (gameState !== 'playing') return;
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        if (isPowerUpActive) {
            const landingRow = player.pos.y;
            if (landingRow >= 0 && landingRow < arena.length) {
                const clearedBlocks = arena[landingRow].filter(value => value !== 0).length;
                player.score += clearedBlocks;
                arena.splice(landingRow, 1);
                arena.unshift(new Array(arena[0] ? arena[0].length : 12).fill(0));
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
    if (gameState !== 'playing') return;
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
        gameState = 'gameOver';
        finalScoreElement.innerText = player.score;
        gameOverScreen.style.display = 'flex';
    }
}

function playerRotate(dir) {
    if (gameState !== 'playing' || isPowerUpActive) return;
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

// --- Power-Up Functions ---

function updatePowerUpDisplay() {
    powerUpCountElement.innerText = powerUpCount;
    powerUpContext.fillStyle = '#000';
    powerUpContext.fillRect(0, 0, 1, 1);
    powerUpContext.fillStyle = colors[8];
    powerUpContext.fillRect(0, 0, 1, 1);
}

function addPowerUp() {
    window.open('https://omg10.com/4/10790566', '_blank');
    if (gameState !== 'playing') return;
    powerUpCount++;
    updatePowerUpDisplay();
}

function usePowerUp() {
    if (gameState !== 'playing' || powerUpCount <= 0 || isPowerUpActive) return;
    powerUpCount--;
    updatePowerUpDisplay();
    isPowerUpActive = true;
    player.matrix = UNIVERSAL_BLOCK;
    player.pos.y = 0;
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
    if (gameState === 'playing') {
        gameState = 'paused';
    } else if (gameState === 'paused') {
        gameState = 'playing';
        update(); // Resume game loop
    }
}

function startGame() {
    gameState = 'playing';
    arena.forEach(row => row.fill(0));
    player.score = 0;
    powerUpCount = 0;
    updateScore();
    updatePowerUpDisplay();
    nextPiece = createRandomPiece();
    playerReset();
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    lastTime = 0;
    dropCounter = 0;
    update();
}

function update(time = 0) {
    if (gameState === 'playing') {
        const deltaTime = time - lastTime;
        lastTime = time;
        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            playerDrop();
        }
    }
    draw();
    if (gameState !== 'gameOver') {
        requestAnimationFrame(update);
    }
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
    if (nextPiece) {
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
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(arena, {x: 0, y: 0});
    if (gameState === 'playing' || gameState === 'paused') {
        drawMatrix(player.matrix, player.pos);
    }
    drawNextPiece();

    if (gameState === 'paused') {
        context.fillStyle = 'rgba(255, 255, 255, 0.5)';
        context.font = '2px Arial';
        context.textAlign = 'center';
        context.fillText('已暂停', 6, 10);
    }
}

// --- Event Listeners ---

document.addEventListener('keydown', event => {
    if (event.keyCode === 32) {
        event.preventDefault();
        togglePause();
        return;
    }
    if (gameState !== 'playing') return;
    switch (event.keyCode) {
        case 37: playerMove(-1); break;
        case 39: playerMove(1); break;
        case 40: playerDrop(); break;
        case 81: case 87: playerRotate(event.keyCode === 87 ? 1 : -1); break;
    }
});

canvas.addEventListener('click', togglePause);
btnLeft.addEventListener('click', () => playerMove(-1));
btnRight.addEventListener('click', () => playerMove(1));
btnDown.addEventListener('click', () => { if(gameState === 'playing') playerDrop(); });
btnRotate.addEventListener('click', () => playerRotate(1));
btnAddPowerUp.addEventListener('click', addPowerUp);
btnUsePowerUp.addEventListener('click', usePowerUp);

// New Game State Event Listeners
btnStartGame.addEventListener('click', startGame);
btnPlayAgain.addEventListener('click', startGame);

// --- Initial Load ---
update(); // Start the game loop to draw the initial state

