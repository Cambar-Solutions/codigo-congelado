// =============================================================
// CODIGO CONGELADO  -  Donkey Kong style platformer + Gemini Q&A
// =============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;

const GRAVITY = 0.55;
const JUMP_V = -10.5;
const MOVE_SPEED = 2.4;
const CLIMB_SPEED = 1.8;
const BARREL_SPEED = 1.6;
const BARREL_INTERVAL = 200;

let phase = 'menu';
let score = 0;
let lives = 3;
let level = 1;
let frame = 0;

const ui = {
  lives: document.getElementById('lives'),
  score: document.getElementById('score'),
  level: document.getElementById('level'),
  overlay: document.getElementById('overlay'),
  startOverlay: document.getElementById('startOverlay'),
  endOverlay: document.getElementById('endOverlay'),
  qTitle: document.getElementById('qTitle'),
  qText: document.getElementById('qText'),
  qCode: document.getElementById('qCode'),
  qOptions: document.getElementById('qOptions'),
  qFeedback: document.getElementById('qFeedback'),
  endTitle: document.getElementById('endTitle'),
  endMsg: document.getElementById('endMsg'),
  startBtn: document.getElementById('startBtn'),
  restartBtn: document.getElementById('restartBtn'),
};

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

const platforms = [
  { x1: 0,   x2: 640, y: 570 },
  { x1: 0,   x2: 560, y: 460 },
  { x1: 80,  x2: 640, y: 350 },
  { x1: 0,   x2: 560, y: 240 },
  { x1: 80,  x2: 640, y: 130 },
];

const ladders = [
  { x: 510, top: 460, bottom: 570 },
  { x: 110, top: 350, bottom: 460 },
  { x: 510, top: 240, bottom: 350 },
  { x: 110, top: 130, bottom: 240 },
];

let hammer = null;
function spawnHammer() {
  const p = platforms[2];
  hammer = { x: 300, y: p.y - 20, w: 16, h: 18, taken: false };
}

const player = {
  x: 20, y: 540,
  w: 18, h: 26,
  vx: 0, vy: 0,
  onGround: true,
  climbing: false,
  facing: 1,
  hasHammer: false,
  hammerTimer: 0,
  stunTimer: 0,
  jumpAir: false,
  jumpClearedBarrel: false,
  jumpOriginX: 0,
  invuln: 0,
};

const barrels = [];
let barrelTimer = 0;

const dk = { x: 25, y: 78, w: 56, h: 52, anim: 0 };
const goal = { x: 580, y: 92, w: 24, h: 38 };

// =============== Input ===============
const keys = {};
const justPressed = new Set();

window.addEventListener('keydown', (e) => {
  if (!keys[e.code]) justPressed.add(e.code);
  keys[e.code] = true;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

const left  = () => keys['ArrowLeft']  || keys['KeyA'];
const right = () => keys['ArrowRight'] || keys['KeyD'];
const up    = () => keys['ArrowUp']    || keys['KeyW'];
const down  = () => keys['ArrowDown']  || keys['KeyS'];
const jumpPressed = () => justPressed.has('Space') || justPressed.has('KeyZ');

// =============== Helpers ===============
function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function onLadder(px, py, ph) {
  for (const l of ladders) {
    if (px + 9 >= l.x - 2 && px + 9 <= l.x + 14 + 2 &&
        py + ph >= l.top && py <= l.bottom + 4) return l;
  }
  return null;
}

// =============== Reset ===============
function resetRound(fullReset) {
  player.x = 20;
  player.y = 540;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.climbing = false;
  player.facing = 1;
  player.stunTimer = 0;
  player.jumpAir = false;
  player.jumpClearedBarrel = false;
  player.invuln = 90;
  barrels.length = 0;
  barrelTimer = 60;

  if (fullReset) {
    score = 0;
    lives = 3;
    level = 1;
    player.hasHammer = false;
    player.hammerTimer = 0;
    spawnHammer();
  } else {
    if (!hammer || hammer.taken) spawnHammer();
  }
  updateHUD();
}

function updateHUD() {
  ui.lives.textContent = '<3 '.repeat(Math.max(0, lives)).trim();
  ui.score.textContent = String(score);
  ui.level.textContent = String(level);
}

// =============== Update ===============
function update() {
  if (phase !== 'playing') return;
  frame++;

  if (player.stunTimer > 0) {
    player.stunTimer--;
    player.vx = 0;
  } else {
    if (left()) { player.vx = -MOVE_SPEED; player.facing = -1; }
    else if (right()) { player.vx = MOVE_SPEED; player.facing = 1; }
    else player.vx = 0;
  }

  const lad = onLadder(player.x, player.y, player.h);
  if (player.climbing) {
    player.vy = 0;
    if (up()) player.vy = -CLIMB_SPEED;
    else if (down()) player.vy = CLIMB_SPEED;
    if (!lad) player.climbing = false;
    if (jumpPressed()) {
      player.climbing = false;
      player.vy = JUMP_V * 0.6;
    }
  } else if (lad && (up() || (down() && player.onGround))) {
    if ((up() && player.y + player.h > lad.top + 4) ||
        (down() && player.onGround && player.y + player.h < lad.bottom - 2)) {
      player.climbing = true;
      player.x = lad.x - 4;
      player.vy = 0;
    }
  }

  if (!player.climbing && player.onGround && jumpPressed() && player.stunTimer === 0) {
    player.vy = JUMP_V;
    player.onGround = false;
    player.jumpAir = true;
    player.jumpClearedBarrel = false;
    player.jumpOriginX = player.x;
  }

  if (!player.climbing) player.vy += GRAVITY;
  if (player.vy > 12) player.vy = 12;

  player.x += player.vx;
  player.y += player.vy;

  if (player.x < 0) player.x = 0;
  if (player.x > W - player.w) player.x = W - player.w;

  if (!player.climbing) {
    player.onGround = false;
    if (player.vy >= 0) {
      for (const p of platforms) {
        if (player.x + player.w - 2 > p.x1 && player.x + 2 < p.x2) {
          const feet = player.y + player.h;
          if (feet >= p.y && feet <= p.y + 12 && (feet - player.vy) <= p.y + 1) {
            player.y = p.y - player.h;
            player.vy = 0;
            player.onGround = true;
            if (player.jumpAir) {
              player.jumpAir = false;
              if (player.jumpClearedBarrel) {
                player.jumpClearedBarrel = false;
                triggerQuestion('jump');
              }
            }
            break;
          }
        }
      }
    }
  }

  if (player.y + player.h > H - 10) {
    player.y = H - 10 - player.h;
    player.vy = 0;
    player.onGround = true;
  }

  if (hammer && !hammer.taken && rectOverlap(player, hammer)) {
    hammer.taken = true;
    triggerQuestion('hammer');
  }

  if (player.hasHammer) {
    player.hammerTimer--;
    if (player.hammerTimer <= 0) player.hasHammer = false;
  }

  if (player.invuln > 0) player.invuln--;

  barrelTimer--;
  if (barrelTimer <= 0) {
    spawnBarrel();
    barrelTimer = BARREL_INTERVAL - Math.min(80, level * 8);
  }

  for (let i = barrels.length - 1; i >= 0; i--) {
    const b = barrels[i];
    b.vy += GRAVITY;
    if (b.vy > 8) b.vy = 8;
    b.x += b.vx;
    b.y += b.vy;
    b.rot += b.vx * 0.08;

    for (const p of platforms) {
      if (b.x + b.w / 2 > p.x1 && b.x + b.w / 2 < p.x2) {
        const feet = b.y + b.h;
        if (b.vy >= 0 && feet >= p.y && feet <= p.y + 14) {
          b.y = p.y - b.h;
          b.vy = 0;
          break;
        }
      }
    }

    if (b.x < -40 || b.x > W + 40 || b.y > H + 40) {
      barrels.splice(i, 1);
      continue;
    }

    if (player.jumpAir && !player.jumpClearedBarrel) {
      const horizontalOverlap = player.x + player.w > b.x && player.x < b.x + b.w;
      const playerAbove = player.y + player.h < b.y + 4;
      if (horizontalOverlap && playerAbove) {
        player.jumpClearedBarrel = true;
      }
    }

    if (player.invuln <= 0 && rectOverlap(player, b)) {
      if (player.hasHammer) {
        barrels.splice(i, 1);
        score += 75;
        updateHUD();
        continue;
      }
      hitByBarrel();
      return;
    }
  }

  if (rectOverlap(player, goal)) {
    triggerQuestion('goal');
  }

  justPressed.clear();
}

function spawnBarrel() {
  const dir = Math.random() > 0.5 ? 1 : -1;
  barrels.push({
    x: dk.x + dk.w + 4,
    y: dk.y + 14,
    w: 18, h: 18,
    vx: BARREL_SPEED * dir,
    vy: 0,
    rot: 0,
  });
  dk.anim = 12;
}

function hitByBarrel() {
  lives--;
  updateHUD();
  if (lives <= 0) endGame(false);
  else resetRound(false);
}

// =============== Question system ===============
let questionCtx = null;

function triggerQuestion(ctx) {
  phase = 'question';
  questionCtx = ctx;
  ui.qFeedback.textContent = '';
  clearChildren(ui.qOptions);
  ui.qText.textContent = 'Cargando reto...';
  ui.qCode.textContent = '';
  const titles = {
    jump: 'SALTO PERFECTO! RETO RAPIDO',
    hammer: 'MARTILLO BLOQUEADO! RESUELVE',
    goal: 'RETO FINAL DEL NIVEL',
  };
  ui.qTitle.textContent = titles[ctx] || 'PREGUNTA';
  ui.overlay.classList.remove('hidden');

  fetch('/api/question')
    .then(r => r.json())
    .then(showQuestion)
    .catch(() => {
      showQuestion({
        question: 'Que imprime?',
        code: "let n = 7;\nconsole.log(n - 2);",
        options: ['5', '7', '9', 'Error'],
        correctIndex: 0,
        explanation: '7 - 2 = 5.',
      });
    });
}

function showQuestion(q) {
  ui.qText.textContent = q.question;
  ui.qCode.textContent = q.code;
  clearChildren(ui.qOptions);
  const letters = ['A', 'B', 'C', 'D'];
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = letters[i] + ') ' + opt;
    btn.addEventListener('click', () => answerQuestion(i, q));
    ui.qOptions.appendChild(btn);
  });
}

function answerQuestion(i, q) {
  const correct = i === q.correctIndex;
  Array.from(ui.qOptions.children).forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === q.correctIndex) btn.classList.add('correct');
    else if (idx === i) btn.classList.add('wrong');
  });
  ui.qFeedback.textContent = (correct ? 'CORRECTO! ' : 'FALLASTE! ') + (q.explanation || '');

  setTimeout(() => {
    ui.overlay.classList.add('hidden');
    applyConsequence(correct);
  }, correct ? 900 : 1700);
}

function applyConsequence(correct) {
  if (questionCtx === 'jump') {
    if (correct) score += 150;
    else { player.stunTimer = 90; score += 25; spawnBarrel(); }
  } else if (questionCtx === 'hammer') {
    if (correct) {
      player.hasHammer = true;
      player.hammerTimer = 60 * 8;
      score += 100;
    } else {
      hammer = null;
    }
  } else if (questionCtx === 'goal') {
    if (correct) {
      score += 500;
      level++;
      updateHUD();
      if (level > 3) { endGame(true); return; }
      resetRound(false);
    } else {
      lives--;
      updateHUD();
      if (lives <= 0) { endGame(false); return; }
      player.y = platforms[2].y - player.h;
      player.x = 200;
      player.vy = 0;
    }
  }
  updateHUD();
  phase = 'playing';
}

function endGame(won) {
  phase = won ? 'win' : 'gameover';
  ui.endTitle.textContent = won ? 'NIVEL COMPLETO!' : 'GAME OVER';
  clearChildren(ui.endMsg);
  const line1 = document.createElement('div');
  line1.textContent = 'Puntuacion final: ' + score;
  const line2 = document.createElement('div');
  line2.textContent = 'Nivel alcanzado: ' + level;
  ui.endMsg.appendChild(line1);
  ui.endMsg.appendChild(line2);
  ui.endOverlay.classList.remove('hidden');
}

// =============== Drawing ===============
function clear() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#222';
  for (let i = 0; i < 40; i++) {
    const x = (i * 73 + 13) % W;
    const y = (i * 41 + 7) % H;
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawPlatform(p) {
  const w = p.x2 - p.x1;
  ctx.fillStyle = '#e63946';
  ctx.fillRect(p.x1, p.y, w, 10);
  ctx.fillStyle = '#7a1c20';
  ctx.fillRect(p.x1, p.y + 8, w, 4);
  ctx.fillStyle = '#ffd23f';
  for (let x = p.x1 + 8; x < p.x2 - 4; x += 22) {
    ctx.fillRect(x, p.y + 3, 3, 3);
  }
}

function drawLadder(l) {
  const w = 14;
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(l.x, l.top, 3, l.bottom - l.top);
  ctx.fillRect(l.x + w - 3, l.top, 3, l.bottom - l.top);
  ctx.fillStyle = '#f4a300';
  for (let y = l.top + 6; y < l.bottom - 4; y += 10) {
    ctx.fillRect(l.x, y, w, 2);
  }
}

function drawPlayer() {
  const flick = (player.invuln > 0 && Math.floor(frame / 4) % 2 === 0);
  if (flick) return;
  const px = Math.round(player.x);
  const py = Math.round(player.y);
  const f = player.facing;

  function px_(rx, ry, rw, rh, color) {
    ctx.fillStyle = color;
    let dx = f === 1 ? rx : (player.w - rx - rw);
    ctx.fillRect(px + dx, py + ry, rw, rh);
  }

  px_(2, 0, 14, 4, '#d62828');
  px_(0, 2, 6, 3, '#d62828');
  px_(4, 4, 10, 6, '#fcbf85');
  px_(10, 6, 2, 2, '#000');
  px_(7, 8, 6, 2, '#3a1e09');
  px_(2, 10, 14, 8, '#1d4ed8');
  px_(0, 11, 3, 6, '#d62828');
  px_(15, 11, 3, 6, '#d62828');
  px_(5, 10, 2, 8, '#fcbf85');
  px_(11, 10, 2, 8, '#fcbf85');
  px_(3, 18, 5, 6, '#1d4ed8');
  px_(10, 18, 5, 6, '#1d4ed8');
  px_(2, 22, 6, 4, '#3a1e09');
  px_(10, 22, 6, 4, '#3a1e09');

  if (player.hasHammer) {
    const flash = Math.floor(frame / 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ffd23f' : '#fff';
    ctx.fillRect(px + 4, py - 14, 10, 8);
    ctx.fillStyle = '#7a4b1a';
    ctx.fillRect(px + 8, py - 6, 2, 8);
  }

  if (player.stunTimer > 0) {
    ctx.fillStyle = '#ffd23f';
    const t = frame * 0.2;
    for (let i = 0; i < 3; i++) {
      const a = t + i * 2.1;
      const sx = px + 9 + Math.cos(a) * 10;
      const sy = py - 4 + Math.sin(a) * 3;
      ctx.fillRect(sx, sy, 2, 2);
    }
  }
}

function drawDK() {
  const x = dk.x, y = dk.y;
  ctx.fillStyle = '#5b2e0c';
  ctx.fillRect(x, y + 8, 56, 38);
  ctx.fillStyle = '#c98e5b';
  ctx.fillRect(x + 14, y + 18, 28, 22);
  ctx.fillStyle = '#5b2e0c';
  ctx.fillRect(x + 8, y, 40, 18);
  ctx.fillStyle = '#c98e5b';
  ctx.fillRect(x + 14, y + 6, 28, 12);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 18, y + 9, 3, 4);
  ctx.fillRect(x + 32, y + 9, 3, 4);
  ctx.fillStyle = '#3a1e09';
  ctx.fillRect(x + 16, y + 6, 8, 2);
  ctx.fillRect(x + 30, y + 6, 8, 2);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 22, y + 14, 12, 2);
  ctx.fillStyle = '#5b2e0c';
  if (dk.anim > 0) {
    ctx.fillRect(x + 50, y - 4, 10, 16);
    dk.anim--;
  } else {
    ctx.fillRect(x + 50, y + 14, 10, 16);
  }
  ctx.fillRect(x - 6, y + 14, 10, 16);
}

function drawBarrel(b) {
  const x = Math.round(b.x), y = Math.round(b.y);
  ctx.fillStyle = '#8a4a18';
  ctx.fillRect(x, y, 18, 18);
  ctx.fillStyle = '#5b2e0c';
  ctx.fillRect(x, y + 2, 18, 2);
  ctx.fillRect(x, y + 14, 18, 2);
  ctx.fillStyle = '#a86a30';
  const r = Math.abs(Math.floor(b.rot * 3) % 4);
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + 2 + ((i * 6 + r) % 14), y + 5, 2, 8);
  }
}

function drawHammer() {
  if (!hammer || hammer.taken) return;
  const x = hammer.x, y = hammer.y;
  const by = Math.sin(frame * 0.1) * 2;
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(x, y + by, 16, 8);
  ctx.fillStyle = '#b85c00';
  ctx.fillRect(x + 6, y + 8 + by, 4, 10);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 2 + (frame % 12 < 6 ? 0 : 8), y + 2 + by, 2, 2);
}

function drawGoal() {
  const x = goal.x, y = goal.y;
  ctx.fillStyle = '#ff77c7';
  ctx.fillRect(x + 4, y + 14, 16, 22);
  ctx.fillStyle = '#fcbf85';
  ctx.fillRect(x + 6, y + 4, 12, 12);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(x + 4, y, 16, 6);
  ctx.fillRect(x + 2, y + 4, 4, 8);
  ctx.fillRect(x + 18, y + 4, 4, 8);
  ctx.fillStyle = '#ff5252';
  ctx.fillRect(x + 8, y - 3, 8, 3);
  if (Math.floor(frame / 30) % 2 === 0) {
    ctx.fillStyle = '#fff';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillText('HELP!', x - 6, y - 8);
  }
}

function draw() {
  clear();
  for (const p of platforms) drawPlatform(p);
  for (const l of ladders) drawLadder(l);
  drawHammer();
  drawDK();
  drawGoal();
  for (const b of barrels) drawBarrel(b);
  drawPlayer();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

ui.startBtn.addEventListener('click', () => {
  ui.startOverlay.classList.add('hidden');
  resetRound(true);
  phase = 'playing';
});
ui.restartBtn.addEventListener('click', () => {
  ui.endOverlay.classList.add('hidden');
  resetRound(true);
  phase = 'playing';
});

spawnHammer();
loop();
