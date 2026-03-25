
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');

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

// --- Shapes ---
// Organized by number of blocks
const SHAPES = {
    3: [
        [[1, 1, 1]],      // I
        [[1, 1], [0, 1]], // L-ish
        [[1, 0], [1, 1]],
    ],
    4: [ // Classic Tetris shapes
        [[1, 1, 1, 1]],      // I
        [[1, 1], [1, 1]],    // O
        [[0, 1, 0], [1, 1, 1]], // T
        [[1, 1, 0], [0, 1, 1]], // S
        [[0, 1, 1], [1, 1, 0]], // Z
        [[0, 0, 1], [1, 1, 1]], // L
        [[1, 0, 0], [1, 1, 1]], // J
    ],
    5: [
        [[1, 1, 1, 1, 1]], // I
        [[0, 1, 0], [1, 1, 1], [0, 1, 0]], // Cross
        [[1, 1, 0], [0, 1, 0], [0, 1, 1]], // Weird S
        [[1, 1, 1], [1, 0, 1]], // U
        [[1, 1, 1, 1], [0, 0, 1, 0]], // P
    ],
    6: [
        [[1, 1, 1, 1, 1, 1]], // I
        [[1, 1, 1], [1, 1, 1]], // 2x3 block
        [[0, 1, 1], [1, 1, 0], [1, 1, 0]], // Complex shape
        [[1, 1, 1, 1], [1, 1, 0, 0]],
    ],
    7: [
        [[1, 1, 1, 1, 1, 1, 1]], // I
        [[1, 1, 1], [1, 0, 1], [1, 1, 1]], // O with hole
        [[0, 1, 0], [0, 1, 0], [1, 1, 1], [1, 0, 1]],
        [[1, 1, 1, 1], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]], // T-like
    ],
};

const colors = [
    null,
    '#FF0D72', // 3 blocks
    '#0DC2FF', // 4 blocks
    '#0DFF72', // 5 blocks
    '#F538FF', // 6 blocks
    '#FF8E0D', // 7 blocks
    '#FFE138', // Extra color 1
    '#3877FF', // Extra color 2
];

let nextPiece = createRandomPiece(); // Initialize with a random piece

// --- Core Functions ---

function createRandomPiece() {
    const size = Math.floor(Math.random() * 5) + 3; // Random size from 3 to 7
    const shapesOfSize = SHAPES[size];
    const shape = shapesOfSize[Math.floor(Math.random() * shapesOfSize.length)];

    // Assign color based on size (1-indexed for colors array)
    const colorIndex = size - 2;

    // Create a new matrix with the correct color
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
            if (m[y][x] !== 0 &&
               (arena[y + o.y] &&
                arena[y + o.y][x + o.x]) !== 0) {
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
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] =
            [matrix[y][x], matrix[x][y]];
        }
    }

    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
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
    player.pos.x = (arena[0].length / 2 | 0) -
                   (player.matrix[0].length / 2 | 0);
    if (collide(arena, player)) {
        // Game Over
        arena.forEach(row => row.fill(0));
        player.score = 0;
        updateScore();
    }
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
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
            if (arena[y][x] === 0) {
                continue outer;
            }
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
    if (!isPaused) {
        // Restart the game loop upon unpausing
        update();
    }
}

function update(time = 0) {
    if (isPaused) {
        draw(); // Keep drawing to show the pause screen, but don't update game logic
        return;
    }

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

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
    // Draw background
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw arena and current piece
    drawMatrix(arena, {x: 0, y: 0});
    drawMatrix(player.matrix, player.pos);
    drawNextPiece();

    // Draw pause overlay if paused
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
    // Prevent space bar from scrolling the page
    if (event.keyCode === 32) {
        event.preventDefault();
    }

    switch (event.keyCode) {
        case 32: // Space
            togglePause();
            break;
        case 37: // Left Arrow
            if (!isPaused) playerMove(-1);
            break;
        case 39: // Right Arrow
            if (!isPaused) playerMove(1);
            break;
        case 40: // Down Arrow
            if (!isPaused) playerDrop();
            break;
        case 81: // Q
            if (!isPaused) playerRotate(-1);
            break;
        case 87: // W
            if (!isPaused) playerRotate(1);
            break;
    }
});

canvas.addEventListener('click', togglePause);


// --- Game Start ---

playerReset();
updateScore();
update();
