const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 16;
const VIEW_WIDTH = canvas.width;
const VIEW_HEIGHT = canvas.height;
const GRAVITY = 0.35;
const JUMP_VELOCITY = -6.6;
const MOVE_SPEED = 1.6;
const MAX_FALL = 8;

const palette = {
  sky: "#5c94fc",
  ground: "#c84c0c",
  groundTop: "#f8a800",
  brick: "#b5521c",
  brickHighlight: "#f8d878",
  question: "#f8b000",
  pipe: "#2ca04c",
  pipeShade: "#0f6b2f",
  marioRed: "#e02020",
  marioSkin: "#f8d8b8",
  marioBrown: "#5c3c14",
  marioBlue: "#2448d8",
  black: "#1c1c1c",
  white: "#ffffff",
  flag: "#2ca04c",
  pole: "#d8d8d8",
  used: "#d8b48c",
};

const keys = new Set();
let audioContext;

const level = createLevel();
const levelWidth = level[0].length * TILE_SIZE;

const mario = {
  x: 32,
  y: 180,
  width: 14,
  height: 16,
  vx: 0,
  vy: 0,
  grounded: false,
  direction: 1,
  animTimer: 0,
  animFrame: 0,
};

const camera = {
  x: 0,
  y: 0,
};

let gameState = "start";
let coinCount = 0;
let timeLeft = 400;
let timeTimer = 0;

const startScreenText = [
  "SUPER PLUMBER BROS",
  "1-1 TRIBUTE",
  "PRESS ENTER",
  "ARROWS TO MOVE",
  "Z / SPACE TO JUMP",
];

const solidTiles = new Set([1, 2, 3, 4, 5, 6, 7, 10, 8]);

function createLevel() {
  const rows = 15;
  const cols = 200;
  const data = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let x = 0; x < cols; x += 1) {
    data[14][x] = 1;
    if (x % 2 === 0) {
      data[13][x] = 1;
    }
  }

  addBrickStrip(data, 16, 8, 5);
  addQuestionBlock(data, 20, 7);
  addBrickStrip(data, 23, 8, 3);
  addQuestionBlock(data, 24, 7);
  addBrickStrip(data, 30, 9, 4);

  addPipe(data, 28, 12, 2);
  addPipe(data, 38, 11, 3);
  addPipe(data, 46, 10, 4);

  addBrickStrip(data, 54, 8, 4);
  addQuestionBlock(data, 55, 7);

  addStaircase(data, 70, 13, 4);
  addStaircase(data, 78, 13, 5);
  addBrickStrip(data, 86, 7, 6);

  addBrickStrip(data, 102, 8, 8);
  addPipe(data, 114, 12, 2);

  addStaircase(data, 126, 13, 6);
  addStaircase(data, 134, 13, 7);

  addBrickStrip(data, 148, 9, 5);
  addPipe(data, 156, 11, 3);

  addFlagpole(data, 186, 4);

  return data;
}

function addBrickStrip(map, startX, y, length) {
  for (let i = 0; i < length; i += 1) {
    map[y][startX + i] = 2;
  }
}

function addQuestionBlock(map, x, y) {
  map[y][x] = 3;
}

function addPipe(map, x, baseY, height) {
  map[baseY - height + 1][x] = 4;
  map[baseY - height + 1][x + 1] = 5;
  for (let y = baseY - height + 2; y <= baseY; y += 1) {
    map[y][x] = 6;
    map[y][x + 1] = 7;
  }
}

function addStaircase(map, startX, baseY, steps) {
  for (let step = 0; step < steps; step += 1) {
    for (let h = 0; h <= step; h += 1) {
      map[baseY - h][startX + step] = 2;
    }
  }
}

function addFlagpole(map, x, baseY) {
  for (let y = 0; y < 9; y += 1) {
    map[baseY + y][x] = 8;
  }
  map[baseY][x + 1] = 9;
}

function startAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playTone(freq, duration, type = "square", gainValue = 0.08) {
  if (!audioContext) {
    return;
  }
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = freq;
  gain.gain.value = gainValue;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function playJump() {
  playTone(440, 0.1, "square", 0.06);
  playTone(660, 0.12, "square", 0.05);
}

function playCoin() {
  playTone(880, 0.08, "triangle", 0.05);
  playTone(1320, 0.08, "triangle", 0.04);
}

function playStomp() {
  playTone(120, 0.12, "sawtooth", 0.05);
}

function playPower() {
  playTone(520, 0.1, "square", 0.05);
  playTone(780, 0.12, "square", 0.04);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function tileAtPixel(x, y) {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  if (row < 0 || row >= level.length || col < 0 || col >= level[0].length) {
    return 0;
  }
  return level[row][col];
}

function isSolid(tile) {
  return solidTiles.has(tile);
}

function update(delta) {
  if (gameState !== "play") {
    return;
  }

  timeTimer += delta;
  if (timeTimer > 1) {
    timeLeft = Math.max(0, timeLeft - 1);
    timeTimer = 0;
    if (timeLeft === 0) {
      gameState = "gameover";
    }
  }

  mario.vx = 0;
  if (keys.has("ArrowLeft")) {
    mario.vx = -MOVE_SPEED;
    mario.direction = -1;
  } else if (keys.has("ArrowRight")) {
    mario.vx = MOVE_SPEED;
    mario.direction = 1;
  }

  mario.vy = clamp(mario.vy + GRAVITY, -20, MAX_FALL);

  moveMario(mario.vx, 0);
  moveMario(0, mario.vy);

  if (mario.grounded) {
    if (Math.abs(mario.vx) > 0) {
      mario.animTimer += delta;
      if (mario.animTimer > 0.15) {
        mario.animTimer = 0;
        mario.animFrame = (mario.animFrame + 1) % 2;
      }
    } else {
      mario.animFrame = 0;
    }
  }

  camera.x = clamp(mario.x - 100, 0, levelWidth - VIEW_WIDTH);

  if (mario.x > levelWidth - 64) {
    gameState = "win";
    playPower();
  }

  if (mario.y > VIEW_HEIGHT) {
    gameState = "gameover";
  }
}

function moveMario(dx, dy) {
  mario.x += dx;
  mario.y += dy;
  mario.grounded = false;

  const left = mario.x;
  const right = mario.x + mario.width;
  const top = mario.y;
  const bottom = mario.y + mario.height;

  const tilesToCheck = getTilesInBounds(left, top, right, bottom);

  for (const tile of tilesToCheck) {
    if (!isSolid(tile.value)) {
      continue;
    }

    if (dx > 0) {
      mario.x = tile.x * TILE_SIZE - mario.width;
    } else if (dx < 0) {
      mario.x = tile.x * TILE_SIZE + TILE_SIZE;
    }

    if (dy > 0) {
      mario.y = tile.y * TILE_SIZE - mario.height;
      mario.vy = 0;
      mario.grounded = true;
    } else if (dy < 0) {
      mario.y = tile.y * TILE_SIZE + TILE_SIZE;
      mario.vy = 0;
      if (tile.value === 3) {
        level[tile.y][tile.x] = 10;
        coinCount += 1;
        playCoin();
      }
    }
  }
}

function getTilesInBounds(left, top, right, bottom) {
  const tiles = [];
  const startCol = Math.floor(left / TILE_SIZE);
  const endCol = Math.floor(right / TILE_SIZE);
  const startRow = Math.floor(top / TILE_SIZE);
  const endRow = Math.floor(bottom / TILE_SIZE);

  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      if (row < 0 || row >= level.length || col < 0 || col >= level[0].length) {
        continue;
      }
      tiles.push({ x: col, y: row, value: level[row][col] });
    }
  }

  return tiles;
}

function drawBackground() {
  ctx.fillStyle = palette.sky;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(40 - camera.x * 0.3, 40, 32, 16);
  ctx.fillRect(120 - camera.x * 0.2, 30, 40, 18);
  ctx.fillRect(190 - camera.x * 0.25, 50, 28, 14);

  drawHills(24 - camera.x * 0.6, 168, 48);
  drawHills(140 - camera.x * 0.4, 176, 64);
  drawHills(210 - camera.x * 0.5, 170, 40);
}

function drawHills(x, y, width) {
  ctx.fillStyle = "#52a83b";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + width / 2, y - width / 2, x + width, y);
  ctx.closePath();
  ctx.fill();
}

function drawTile(tile, x, y) {
  switch (tile) {
    case 1:
      ctx.fillStyle = palette.ground;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = palette.groundTop;
      ctx.fillRect(x, y, TILE_SIZE, 3);
      break;
    case 2:
      drawBrick(x, y);
      break;
    case 3:
      drawQuestionBlock(x, y);
      break;
    case 4:
    case 5:
    case 6:
    case 7:
      drawPipe(x, y, tile);
      break;
    case 8:
      ctx.fillStyle = palette.pole;
      ctx.fillRect(x + 6, y, 4, TILE_SIZE);
      break;
    case 9:
      ctx.fillStyle = palette.flag;
      ctx.fillRect(x + 2, y + 2, 12, 8);
      ctx.fillStyle = palette.white;
      ctx.fillRect(x + 4, y + 4, 4, 2);
      break;
    case 10:
      ctx.fillStyle = palette.used;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = palette.brick;
      ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      break;
    default:
      break;
  }
}

function drawBrick(x, y) {
  ctx.fillStyle = palette.brick;
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = palette.brickHighlight;
  ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 3);
  ctx.fillRect(x + 2, y + 8, TILE_SIZE - 4, 2);
}

function drawQuestionBlock(x, y) {
  ctx.fillStyle = palette.question;
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = palette.brickHighlight;
  ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 2);
  ctx.fillRect(x + 2, y + 12, TILE_SIZE - 4, 2);
  ctx.fillStyle = palette.brick;
  ctx.fillRect(x + 6, y + 5, 4, 4);
  ctx.fillRect(x + 6, y + 10, 4, 3);
}

function drawPipe(x, y, tile) {
  ctx.fillStyle = palette.pipe;
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = palette.pipeShade;
  ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
  if (tile === 4 || tile === 5) {
    ctx.fillStyle = palette.pipeShade;
    ctx.fillRect(x, y, TILE_SIZE, 4);
  }
}

const marioSprites = [
  [
    "....rrrr....",
    "...rrrrrr...",
    "..rrsssr....",
    ".rrspssr...",
    ".rrspsss...",
    "..rsppss...",
    "..rssss....",
    ".rrbrrb....",
    "rrbbbbb...",
    "rbbbbbbb..",
    "..b..b....",
    ".bb..bb...",
    ".bb..bb...",
    "rr....rr..",
    "rr....rr..",
    "...........",
  ],
  [
    "....rrrr....",
    "...rrrrrr...",
    "..rrsssr....",
    ".rrspssr...",
    ".rrspsss...",
    "..rsppss...",
    "..rssss....",
    ".rrbrrb....",
    "rrbbbbb...",
    "rbbbbbbb..",
    "..b..b....",
    ".bb..bb...",
    "..bb..bb..",
    "..rr..rr..",
    ".rr..rr...",
    "...........",
  ],
];

function drawMario() {
  const frame = mario.animFrame;
  const sprite = marioSprites[frame];
  const baseX = Math.floor(mario.x - camera.x);
  const baseY = Math.floor(mario.y - camera.y);

  for (let y = 0; y < sprite.length; y += 1) {
    const row = sprite[y];
    for (let x = 0; x < row.length; x += 1) {
      const pixel = row[x];
      if (pixel === ".") {
        continue;
      }
      ctx.fillStyle = marioColor(pixel);
      const drawX = mario.direction === 1 ? baseX + x : baseX + (row.length - 1 - x);
      ctx.fillRect(drawX, baseY + y, 1, 1);
    }
  }
}

function marioColor(pixel) {
  switch (pixel) {
    case "r":
      return palette.marioRed;
    case "s":
      return palette.marioSkin;
    case "p":
      return palette.marioBrown;
    case "b":
      return palette.marioBlue;
    default:
      return palette.black;
  }
}

function drawHud() {
  ctx.fillStyle = palette.white;
  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.fillText(`COIN ${coinCount}`, 8, 12);
  ctx.fillText(`TIME ${timeLeft}`, 180, 12);
}

function drawStartScreen() {
  ctx.fillStyle = palette.sky;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  ctx.fillStyle = palette.white;
  ctx.font = "10px 'Press Start 2P', monospace";
  startScreenText.forEach((line, index) => {
    ctx.fillText(line, 32, 80 + index * 18);
  });
}

function drawEndScreen(message) {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.fillStyle = palette.white;
  ctx.font = "10px 'Press Start 2P', monospace";
  ctx.fillText(message, 60, 120);
  ctx.fillText("PRESS ENTER", 60, 140);
}

function render() {
  drawBackground();

  const startCol = Math.floor(camera.x / TILE_SIZE);
  const endCol = Math.ceil((camera.x + VIEW_WIDTH) / TILE_SIZE);
  for (let row = 0; row < level.length; row += 1) {
    for (let col = startCol; col < endCol; col += 1) {
      const tile = level[row][col];
      if (tile === 0) {
        continue;
      }
      drawTile(tile, col * TILE_SIZE - camera.x, row * TILE_SIZE - camera.y);
    }
  }

  drawMario();
  drawHud();

  if (gameState === "start") {
    drawStartScreen();
  }
  if (gameState === "win") {
    drawEndScreen("COURSE CLEAR!");
  }
  if (gameState === "gameover") {
    drawEndScreen("GAME OVER");
  }
}

let lastTime = 0;
function loop(timestamp) {
  const delta = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  update(delta);
  render();
  requestAnimationFrame(loop);
}

function resetGame() {
  mario.x = 32;
  mario.y = 180;
  mario.vx = 0;
  mario.vy = 0;
  mario.grounded = false;
  mario.animFrame = 0;
  mario.animTimer = 0;
  camera.x = 0;
  coinCount = 0;
  timeLeft = 400;
  timeTimer = 0;
}

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
    event.preventDefault();
  }
  keys.add(event.key);

  if (event.key === "Enter") {
    if (gameState === "start" || gameState === "win" || gameState === "gameover") {
      resetGame();
      gameState = "play";
    }
  }

  if ((event.key === " " || event.key.toLowerCase() === "z") && mario.grounded && gameState === "play") {
    mario.vy = JUMP_VELOCITY;
    mario.grounded = false;
    playJump();
  }

  startAudio();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

requestAnimationFrame(loop);
