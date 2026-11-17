// Every screen that is not the world itself: the HUD, the title, the upgrade draft,
// the wave banner, and the win / loss panels. All drawing is in playfield coordinates;
// the renderer has already set the transform. Layout constants live here so the
// click test in main.js and the drawing here always agree.

import { COMBO, FIELD, FINAL_WAVE, FONT, PALETTE } from './config.js';

const CARD = { width: 300, height: 250, gap: 24, top: 250 };

export function cardRects() {
  const total = CARD.width * 3 + CARD.gap * 2;
  const left = (FIELD.width - total) / 2;
  return [0, 1, 2].map((i) => ({
    x: left + i * (CARD.width + CARD.gap),
    y: CARD.top,
    width: CARD.width,
    height: CARD.height,
  }));
}

/** Which upgrade card (0-2) holds the point, or -1. */
export function upgradeCardAt(x, y) {
  const rects = cardRects();
  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i];
    if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) return i;
  }
  return -1;
}

function text(ctx, value, x, y, size, color, align, weight) {
  ctx.font = `${weight || 400} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function bar(ctx, x, y, width, height, fraction, fill, empty) {
  ctx.fillStyle = empty;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, fraction)) * width, height);
  ctx.strokeStyle = 'rgba(238, 241, 245, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width, height);
}

function dim(ctx) {
  ctx.fillStyle = 'rgba(4, 7, 18, 0.62)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

/** The in-play feedback: keeper and lighthouse health, wave, score, combo, kills. */
export function drawHud(ctx, game) {
  ctx.textBaseline = 'alphabetic';
  // Keeper health, top left.
  text(ctx, '守夜人', 24, 30, 16, PALETTE.muted, 'left', 600);
  bar(ctx, 24, 38, 220, 14, game.player.hp / game.player.maxHp, '#2ec4b6', 'rgba(46, 196, 182, 0.2)');
  text(ctx, `${Math.max(0, Math.ceil(game.player.hp))} / ${game.player.maxHp}`, 250, 51, 14, PALETTE.text, 'left');
  // Dash readiness, under the health bar.
  const dashReady = game.player.dashCooldown <= 0;
  const dashFraction = dashReady ? 1 : 1 - game.player.dashCooldown / game.dashCooldownMax;
  text(ctx, '冲刺', 24, 76, 14, PALETTE.muted, 'left', 600);
  bar(ctx, 24, 82, 220, 6, dashFraction, dashReady ? '#7ef0ff' : '#3d4a75', 'rgba(126, 240, 255, 0.15)');
  // Lighthouse health, under the dash bar.
  text(ctx, '灯塔', 24, 112, 16, PALETTE.muted, 'left', 600);
  bar(ctx, 24, 120, 220, 14, game.lighthouse.hp / game.lighthouse.maxHp, '#ffd166', 'rgba(255, 209, 102, 0.2)');
  text(ctx, `${Math.max(0, Math.ceil(game.lighthouse.hp))} / ${game.lighthouse.maxHp}`, 250, 133, 14, PALETTE.text, 'left');

  // Wave, centre top.
  text(ctx, `第 ${game.wave} / ${FINAL_WAVE} 波`, FIELD.width / 2, 34, 24, PALETTE.text, 'center', 700);
  const remaining = game.enemies.length + (game.spawnQueue.length - game.spawnIndex);
  text(ctx, `剩余敌人 ${remaining}`, FIELD.width / 2, 58, 15, PALETTE.muted, 'center');

  // Score, combo and kills, top right.
  text(ctx, `分数 ${game.score}`, FIELD.width - 24, 34, 24, PALETTE.text, 'right', 700);
  const multiplier = 1 + Math.min(game.combo * COMBO.perKill, COMBO.cap - 1);
  const comboColor = game.combo >= 10 ? '#ff9f1c' : game.combo >= 5 ? '#ffd166' : PALETTE.muted;
  text(ctx, game.combo > 1 ? `连击 x${multiplier.toFixed(2)}（${game.combo}）` : '连击 —', FIELD.width - 24, 58, 15, comboColor, 'right', 600);
  text(ctx, `击杀 ${game.kills}`, FIELD.width - 24, 80, 15, PALETTE.muted, 'right');
}

/** The wave banner: a big line that fades in, holds, and fades out. */
export function drawBanner(ctx, game) {
  const banner = game.banner;
  if (!banner) return;
  const alpha = Math.min(1, banner.time > 1.8 ? (2.2 - banner.time) / 0.4 : banner.time / 0.6);
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  text(ctx, banner.text, FIELD.width / 2, 210, 54, PALETTE.gold, 'center', 800);
  text(ctx, banner.sub, FIELD.width / 2, 246, 20, PALETTE.text, 'center');
  ctx.restore();
}

/** The title screen: name, goal, controls, best score, and the start prompt. */
export function drawTitle(ctx, game, best) {
  dim(ctx);
  text(ctx, '灯塔防线', FIELD.width / 2, 168, 76, PALETTE.gold, 'center', 800);
  text(ctx, 'B E A C O N   L I N E', FIELD.width / 2, 206, 20, PALETTE.muted, 'center', 600);
  text(ctx, '夜幕降临，暗影从海面涌来。守住中央的灯塔，撑过 10 波进攻。', FIELD.width / 2, 262, 20, PALETTE.text, 'center');
  text(ctx, '灯塔熄灭，或你倒下，夜晚就赢了。', FIELD.width / 2, 292, 20, PALETTE.text, 'center');
  const lines = [
    'WASD / 方向键 — 移动      鼠标 — 瞄准      按住左键 — 开火',
    'Shift / 空格 — 冲刺（短暂无敌）      P — 暂停      R — 重开',
    '每波之间三选一强化：更强的子弹、更快的射速、修缮灯塔……',
  ];
  lines.forEach((line, i) => text(ctx, line, FIELD.width / 2, 350 + i * 30, 17, PALETTE.muted, 'center'));
  const pulse = 0.65 + 0.35 * Math.sin(game.time * 3);
  ctx.save();
  ctx.globalAlpha = pulse;
  text(ctx, '点击 或 按 Enter 开始', FIELD.width / 2, 480, 26, PALETTE.gold, 'center', 700);
  ctx.restore();
  if (best > 0) text(ctx, `最高分 ${best}`, FIELD.width / 2, 522, 18, PALETTE.muted, 'center');
}

/** The between-waves draft: three cards, click one or press 1 / 2 / 3. */
export function drawUpgrade(ctx, game, hoverIndex) {
  dim(ctx);
  text(ctx, `第 ${game.wave} 波已守住`, FIELD.width / 2, 150, 40, PALETTE.gold, 'center', 800);
  text(ctx, '选择一项强化，迎接下一波', FIELD.width / 2, 190, 19, PALETTE.text, 'center');
  const rects = cardRects();
  game.choices.forEach((upgrade, i) => {
    const rect = rects[i];
    const hovered = i === hoverIndex;
    ctx.save();
    if (hovered) {
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 18;
    }
    ctx.fillStyle = hovered ? '#1a2447' : PALETTE.panel;
    roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 12);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = hovered ? PALETTE.gold : PALETTE.panelEdge;
    ctx.lineWidth = hovered ? 2.5 : 1.5;
    roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 12);
    ctx.stroke();
    drawUpgradeGlyph(ctx, upgrade.id, rect.x + rect.width / 2, rect.y + 62, hovered);
    text(ctx, upgrade.name, rect.x + rect.width / 2, rect.y + 118, 24, PALETTE.text, 'center', 700);
    text(ctx, upgrade.desc, rect.x + rect.width / 2, rect.y + 152, 16, PALETTE.muted, 'center');
    const taken = game.upgradeStacks[upgrade.id] || 0;
    text(ctx, taken > 0 ? `已拥有 x${taken}` : ' ', rect.x + rect.width / 2, rect.y + 182, 14, PALETTE.muted, 'center');
    text(ctx, `按 ${i + 1} 或点击`, rect.x + rect.width / 2, rect.y + 216, 15, PALETTE.gold, 'center', 600);
  });
}

/** A small drawn glyph per upgrade, so the cards read at a glance. */
function drawUpgradeGlyph(ctx, id, x, y, lit) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = lit ? '#ffd166' : '#9aa3b8';
  ctx.fillStyle = lit ? '#ffd166' : '#9aa3b8';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (id === 'lens') {
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  } else if (id === 'rapid') {
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath(); ctx.moveTo(i * 14 - 6, 12); ctx.lineTo(i * 14 + 6, -12); ctx.stroke();
    }
  } else if (id === 'prism') {
    ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(16, 12); ctx.lineTo(-16, 12); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 12); ctx.stroke();
  } else if (id === 'boots') {
    ctx.beginPath(); ctx.moveTo(-14, 14); ctx.lineTo(14, 14); ctx.lineTo(10, -12); ctx.lineTo(-6, -12); ctx.closePath(); ctx.stroke();
  } else if (id === 'vigor') {
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
  } else if (id === 'repair') {
    ctx.beginPath(); ctx.moveTo(-10, 16); ctx.lineTo(-10, -6); ctx.lineTo(10, -6); ctx.lineTo(10, 16); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-4, -14); ctx.lineTo(4, -14); ctx.lineTo(4, -6); ctx.stroke();
  } else if (id === 'pierce') {
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, -8); ctx.lineTo(18, 0); ctx.lineTo(10, 8); ctx.stroke();
    ctx.beginPath(); ctx.arc(-10, 0, 6, 0, Math.PI * 2); ctx.stroke();
  } else if (id === 'magnet') {
    ctx.beginPath(); ctx.arc(0, 0, 14, Math.PI * 0.15, Math.PI * 1.35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, 10); ctx.lineTo(-12, -2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, 10); ctx.lineTo(12, -2); ctx.stroke();
  } else if (id === 'swift') {
    ctx.beginPath(); ctx.moveTo(-16, 10); ctx.quadraticCurveTo(0, -18, 16, -8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -14); ctx.lineTo(17, -8); ctx.lineTo(9, -2); ctx.stroke();
  } else if (id === 'crit') {
    ctx.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const angle = -Math.PI / 2 + i * Math.PI / 2;
      const x2 = Math.cos(angle) * 16;
      const y2 = Math.sin(angle) * 16;
      const xm = Math.cos(angle + Math.PI / 4) * 6;
      const ym = Math.sin(angle + Math.PI / 4) * 6;
      ctx.lineTo(x2, y2); ctx.lineTo(xm, ym);
    }
    ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}

/** The end of a run: victory at dawn, or the light going out. */
export function drawEnd(ctx, game, best, won) {
  dim(ctx);
  if (won) {
    text(ctx, '黎明守住了！', FIELD.width / 2, 190, 56, PALETTE.gold, 'center', 800);
    text(ctx, '十波暗影退去，灯塔的光再次照亮海面。', FIELD.width / 2, 236, 20, PALETTE.text, 'center');
  } else {
    text(ctx, '灯塔熄灭了……', FIELD.width / 2, 190, 56, PALETTE.danger, 'center', 800);
    text(ctx, game.overReason === 'lighthouse' ? '灯塔被暗影攻破，光芒沉入海底。' : '守夜人倒下了，无人再看守灯光。', FIELD.width / 2, 236, 20, PALETTE.text, 'center');
  }
  const minutes = Math.floor(game.runTime / 60);
  const seconds = Math.floor(game.runTime % 60).toString().padStart(2, '0');
  const stats = [
    `分数 ${game.score}`,
    `最高分 ${Math.max(best, game.score)}`,
    `守到第 ${game.wave} 波`,
    `击杀 ${game.kills}`,
    `坚持 ${minutes}:${seconds}`,
  ];
  stats.forEach((line, i) => text(ctx, line, FIELD.width / 2, 300 + i * 32, 20, PALETTE.text, 'center'));
  const pulse = 0.65 + 0.35 * Math.sin(game.time * 3);
  ctx.save();
  ctx.globalAlpha = pulse;
  text(ctx, '按 R 或点击 再守一夜', FIELD.width / 2, 500, 24, PALETTE.gold, 'center', 700);
  ctx.restore();
}

/** A small "paused" panel over the frozen world. */
export function drawPaused(ctx) {
  dim(ctx);
  text(ctx, '已暂停', FIELD.width / 2, 320, 52, PALETTE.text, 'center', 800);
  text(ctx, '按 P 继续，或按 R 重新开始', FIELD.width / 2, 366, 20, PALETTE.muted, 'center');
}
