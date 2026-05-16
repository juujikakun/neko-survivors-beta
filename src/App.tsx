import { useEffect, useRef, useCallback, useState } from 'react';
import './App.css';

// ============================================================
// TYPES
// ============================================================
interface Vec2 {
  x: number;
  y: number;
}

interface Player {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  xp: number;
  xpToNext: number;
  level: number;
  damage: number;
  attackSpeed: number;
  attackTimer: number;
  projectileCount: number;
  projectileSpeed: number;
  pickupRange: number;
  invincibleTimer: number;
  dashCooldown: number;
  dashTimer: number;
  facing: number; // angle
}

interface Enemy {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  type: EnemyType;
  hitTimer: number;
  size: number;
  xpValue: number;
}

type EnemyType = 'mouse' | 'rat' | 'dog' | 'snake' | 'boss_dog';

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  piercing: number;
  hitEnemies: Set<number>;
  lifetime: number;
}

interface XpOrb {
  x: number;
  y: number;
  value: number;
  magnetized: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  maxLifetime: number;
  color: string;
  size: number;
}

interface DamageNumber {
  x: number;
  y: number;
  value: number;
  lifetime: number;
  vy: number;
}

interface Ability {
  id: string;
  name: string;
  description: string;
  icon: string;
  apply: (player: Player) => void;
}

type GameState = 'menu' | 'playing' | 'levelup' | 'gameover' | 'paused' | 'store' | 'quests' | 'options';

interface Quest {
  id: string;
  name: string;
  description: string;
  target: number;
  progress: number;
  reward: number;
  type: 'kills' | 'survive' | 'level' | 'kill_type' | 'dash';
  enemyType?: EnemyType;
  completed: boolean;
  claimed: boolean;
}

interface StoreItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
  maxLevel: number;
  currentLevel: number;
  effect: string;
}

interface GameOptions {
  showDamageNumbers: boolean;
  showMinimap: boolean;
  screenShake: boolean;
  musicVolume: number;
  sfxVolume: number;
}

interface SaveData {
  coins: number;
  totalKills: number;
  bestTime: number;
  bestLevel: number;
  storeUpgrades: Record<string, number>;
  questsCompleted: number;
}

// ============================================================
// CONSTANTS
// ============================================================
const WORLD_W = 3000;
const WORLD_H = 3000;
const TILE_SIZE = 64;
const ENEMY_SPAWN_DIST = 600;

// ============================================================
// SAVE DATA HELPERS
// ============================================================
function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem('neko_survivors_save');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { coins: 0, totalKills: 0, bestTime: 0, bestLevel: 0, storeUpgrades: {}, questsCompleted: 0 };
}

function saveSave(data: SaveData) {
  localStorage.setItem('neko_survivors_save', JSON.stringify(data));
}

function loadOptions(): GameOptions {
  try {
    const raw = localStorage.getItem('neko_survivors_options');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { showDamageNumbers: true, showMinimap: true, screenShake: true, musicVolume: 70, sfxVolume: 80 };
}

function saveOptions(opts: GameOptions) {
  localStorage.setItem('neko_survivors_options', JSON.stringify(opts));
}

function getStoreItems(upgrades: Record<string, number>): StoreItem[] {
  return [
    { id: 'hp_boost', name: 'Tough Cat', description: '+10 starting max HP per level', icon: '❤️', cost: 50, maxLevel: 5, currentLevel: upgrades['hp_boost'] || 0, effect: '+10 HP' },
    { id: 'dmg_boost', name: 'Power Paws', description: '+3 starting damage per level', icon: '🔥', cost: 60, maxLevel: 5, currentLevel: upgrades['dmg_boost'] || 0, effect: '+3 DMG' },
    { id: 'speed_boost', name: 'Swift Feet', description: '+10 starting speed per level', icon: '💨', cost: 40, maxLevel: 5, currentLevel: upgrades['speed_boost'] || 0, effect: '+10 SPD' },
    { id: 'extra_proj', name: 'Fish School', description: '+1 starting projectile', icon: '🐟', cost: 200, maxLevel: 2, currentLevel: upgrades['extra_proj'] || 0, effect: '+1 fish' },
    { id: 'regen_boost', name: 'Cat Nap', description: '+50% HP regen rate per level', icon: '💤', cost: 80, maxLevel: 3, currentLevel: upgrades['regen_boost'] || 0, effect: '+50% regen' },
    { id: 'pickup_boost', name: 'Treasure Hunter', description: '+20 pickup range per level', icon: '🧲', cost: 30, maxLevel: 5, currentLevel: upgrades['pickup_boost'] || 0, effect: '+20 range' },
    { id: 'crit_chance', name: 'Lucky Cat', description: '+5% coin bonus per level', icon: '🍀', cost: 100, maxLevel: 3, currentLevel: upgrades['crit_chance'] || 0, effect: '+5% coins' },
    { id: 'dash_boost', name: 'Shadow Step', description: '-0.2s dash cooldown per level', icon: '⚡', cost: 70, maxLevel: 3, currentLevel: upgrades['dash_boost'] || 0, effect: '-0.2s CD' },
  ];
}

function generateQuests(save: SaveData): Quest[] {
  const quests: Quest[] = [
    { id: 'q_kill_10', name: 'Mouse Hunter', description: 'Kill 10 enemies', target: 10, progress: 0, reward: 15, type: 'kills', completed: false, claimed: false },
    { id: 'q_kill_50', name: 'Exterminator', description: 'Kill 50 enemies', target: 50, progress: 0, reward: 40, type: 'kills', completed: false, claimed: false },
    { id: 'q_kill_100', name: 'Cat Warrior', description: 'Kill 100 enemies', target: 100, progress: 0, reward: 80, type: 'kills', completed: false, claimed: false },
    { id: 'q_survive_60', name: 'Survivor', description: 'Survive 60 seconds', target: 60, progress: 0, reward: 20, type: 'survive', completed: false, claimed: false },
    { id: 'q_survive_180', name: 'Endurance', description: 'Survive 3 minutes', target: 180, progress: 0, reward: 60, type: 'survive', completed: false, claimed: false },
    { id: 'q_level_3', name: 'Growing Up', description: 'Reach level 3', target: 3, progress: 0, reward: 25, type: 'level', completed: false, claimed: false },
    { id: 'q_level_5', name: 'Veteran', description: 'Reach level 5', target: 5, progress: 0, reward: 50, type: 'level', completed: false, claimed: false },
    { id: 'q_level_10', name: 'Elite Cat', description: 'Reach level 10', target: 10, progress: 0, reward: 120, type: 'level', completed: false, claimed: false },
    { id: 'q_kill_dogs', name: 'Dog Catcher', description: 'Kill 10 dogs', target: 10, progress: 0, reward: 45, type: 'kill_type', enemyType: 'dog', completed: false, claimed: false },
    { id: 'q_dash_20', name: 'Dash Master', description: 'Dash 20 times', target: 20, progress: 0, reward: 30, type: 'dash', completed: false, claimed: false },
  ];
  void save;
  return quests;
}

// ============================================================
// PIXEL ART DRAWING HELPERS
// ============================================================
function drawPixelCat(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, frame: number, facingLeft: boolean) {
  ctx.save();
  ctx.translate(x, y);
  if (facingLeft) {
    ctx.scale(-1, 1);
  }
  const s = size / 16;
  const bobY = Math.sin(frame * 0.15) * 2;

  // Body
  ctx.fillStyle = '#FF9944';
  ctx.fillRect(-5 * s, (-4 + bobY) * s, 10 * s, 8 * s);

  // Head
  ctx.fillStyle = '#FFAA55';
  ctx.fillRect(-6 * s, (-8 + bobY) * s, 12 * s, 7 * s);

  // Ears
  ctx.fillStyle = '#FF8833';
  ctx.fillRect(-6 * s, (-11 + bobY) * s, 3 * s, 4 * s);
  ctx.fillRect(3 * s, (-11 + bobY) * s, 3 * s, 4 * s);

  // Inner ears
  ctx.fillStyle = '#FFB5B5';
  ctx.fillRect(-5 * s, (-10 + bobY) * s, 1.5 * s, 2 * s);
  ctx.fillRect(3.5 * s, (-10 + bobY) * s, 1.5 * s, 2 * s);

  // Eyes
  ctx.fillStyle = '#222';
  ctx.fillRect(-4 * s, (-5 + bobY) * s, 2 * s, 2 * s);
  ctx.fillRect(2 * s, (-5 + bobY) * s, 2 * s, 2 * s);

  // Eye shine
  ctx.fillStyle = '#FFF';
  ctx.fillRect(-3.5 * s, (-5.5 + bobY) * s, 1 * s, 1 * s);
  ctx.fillRect(2.5 * s, (-5.5 + bobY) * s, 1 * s, 1 * s);

  // Nose
  ctx.fillStyle = '#FF6B8A';
  ctx.fillRect(-0.5 * s, (-3 + bobY) * s, 1 * s, 1 * s);

  // Whiskers
  ctx.strokeStyle = '#DDD';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-6 * s, (-3 + bobY) * s);
  ctx.lineTo(-9 * s, (-4 + bobY) * s);
  ctx.moveTo(-6 * s, (-2 + bobY) * s);
  ctx.lineTo(-9 * s, (-2 + bobY) * s);
  ctx.moveTo(6 * s, (-3 + bobY) * s);
  ctx.lineTo(9 * s, (-4 + bobY) * s);
  ctx.moveTo(6 * s, (-2 + bobY) * s);
  ctx.lineTo(9 * s, (-2 + bobY) * s);
  ctx.stroke();

  // Tail
  const tailWag = Math.sin(frame * 0.2) * 3;
  ctx.fillStyle = '#FF8833';
  ctx.fillRect((5 + tailWag) * s, (-2 + bobY) * s, 4 * s, 2 * s);
  ctx.fillRect((7 + tailWag) * s, (-4 + bobY) * s, 2 * s, 3 * s);

  // Legs
  const legAnim = Math.sin(frame * 0.3) * 2;
  ctx.fillStyle = '#FF9944';
  ctx.fillRect(-4 * s, (4 + bobY) * s, 2.5 * s, (3 + legAnim) * s);
  ctx.fillRect(1.5 * s, (4 + bobY) * s, 2.5 * s, (3 - legAnim) * s);

  // Bandana (like Pommi in Potatoz Survivors)
  ctx.fillStyle = '#E53E3E';
  ctx.fillRect(-6 * s, (-8 + bobY) * s, 12 * s, 2 * s);
  ctx.fillStyle = '#FFF';
  ctx.fillRect(-2 * s, (-8 + bobY) * s, 1 * s, 1 * s);
  ctx.fillRect(1 * s, (-8 + bobY) * s, 1 * s, 1 * s);

  ctx.restore();
}

function drawMouse(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, frame: number, hitTimer: number) {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 16;
  const shake = hitTimer > 0 ? (Math.random() - 0.5) * 4 : 0;
  ctx.translate(shake, shake);

  // Body
  ctx.fillStyle = hitTimer > 0 ? '#FF8888' : '#888899';
  ctx.fillRect(-4 * s, -3 * s, 8 * s, 6 * s);

  // Head
  ctx.fillStyle = hitTimer > 0 ? '#FFAAAA' : '#999AAA';
  ctx.fillRect(-5 * s, -6 * s, 10 * s, 5 * s);

  // Ears (round)
  ctx.fillStyle = '#AAAABB';
  ctx.fillRect(-6 * s, -8 * s, 3 * s, 3 * s);
  ctx.fillRect(3 * s, -8 * s, 3 * s, 3 * s);

  // Inner ears
  ctx.fillStyle = '#FFB5B5';
  ctx.fillRect(-5 * s, -7 * s, 1.5 * s, 1.5 * s);
  ctx.fillRect(3.5 * s, -7 * s, 1.5 * s, 1.5 * s);

  // Eyes (red, evil)
  ctx.fillStyle = '#FF0000';
  ctx.fillRect(-3 * s, -4 * s, 2 * s, 1.5 * s);
  ctx.fillRect(1 * s, -4 * s, 2 * s, 1.5 * s);

  // Tail
  const tailWag = Math.sin(frame * 0.25) * 2;
  ctx.fillStyle = '#777788';
  ctx.fillRect(4 * s, (-1 + tailWag) * s, 5 * s, 1 * s);

  ctx.restore();
}

function drawRat(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, frame: number, hitTimer: number) {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 16;
  const shake = hitTimer > 0 ? (Math.random() - 0.5) * 4 : 0;
  ctx.translate(shake, shake);

  // Body - larger, darker
  ctx.fillStyle = hitTimer > 0 ? '#CC6666' : '#554433';
  ctx.fillRect(-5 * s, -4 * s, 10 * s, 8 * s);

  // Head
  ctx.fillStyle = hitTimer > 0 ? '#DD8888' : '#665544';
  ctx.fillRect(-6 * s, -7 * s, 12 * s, 5 * s);

  // Ears
  ctx.fillStyle = '#443322';
  ctx.fillRect(-6 * s, -9 * s, 3 * s, 3 * s);
  ctx.fillRect(3 * s, -9 * s, 3 * s, 3 * s);

  // Eyes (yellow, evil)
  ctx.fillStyle = '#FFFF00';
  ctx.fillRect(-3.5 * s, -5 * s, 2 * s, 2 * s);
  ctx.fillRect(1.5 * s, -5 * s, 2 * s, 2 * s);

  // Teeth
  ctx.fillStyle = '#FFF';
  ctx.fillRect(-1 * s, -2 * s, 1 * s, 2 * s);
  ctx.fillRect(0 * s, -2 * s, 1 * s, 2 * s);

  // Tail
  const tailWag = Math.sin(frame * 0.2) * 3;
  ctx.fillStyle = '#443322';
  ctx.fillRect(5 * s, (-2 + tailWag) * s, 6 * s, 1.5 * s);

  ctx.restore();
}

function drawDog(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, _frame: number, hitTimer: number) {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 16;
  const shake = hitTimer > 0 ? (Math.random() - 0.5) * 4 : 0;
  ctx.translate(shake, shake);

  // Body
  ctx.fillStyle = hitTimer > 0 ? '#DD9999' : '#8B6914';
  ctx.fillRect(-6 * s, -4 * s, 12 * s, 8 * s);

  // Head
  ctx.fillStyle = hitTimer > 0 ? '#EEAAAA' : '#A0791A';
  ctx.fillRect(-7 * s, -8 * s, 14 * s, 6 * s);

  // Ears (floppy)
  ctx.fillStyle = '#6B4A0A';
  ctx.fillRect(-8 * s, -7 * s, 3 * s, 5 * s);
  ctx.fillRect(5 * s, -7 * s, 3 * s, 5 * s);

  // Eyes (angry)
  ctx.fillStyle = '#FF3300';
  ctx.fillRect(-4 * s, -6 * s, 2.5 * s, 2 * s);
  ctx.fillRect(1.5 * s, -6 * s, 2.5 * s, 2 * s);

  // Nose
  ctx.fillStyle = '#222';
  ctx.fillRect(-1 * s, -3 * s, 2 * s, 1.5 * s);

  // Mouth
  ctx.fillStyle = '#FF5555';
  ctx.fillRect(-2 * s, -1.5 * s, 4 * s, 1 * s);

  ctx.restore();
}

function drawSnake(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, frame: number, hitTimer: number) {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 16;
  const shake = hitTimer > 0 ? (Math.random() - 0.5) * 4 : 0;
  ctx.translate(shake, shake);

  // Snake body segments
  ctx.fillStyle = hitTimer > 0 ? '#88DD88' : '#228B22';
  for (let i = 0; i < 5; i++) {
    const segX = Math.sin(frame * 0.15 + i * 0.8) * 3;
    ctx.fillRect((segX - 2 + i * 3) * s, -2 * s, 3 * s, 4 * s);
  }

  // Head
  ctx.fillStyle = hitTimer > 0 ? '#AAFFAA' : '#2EA82E';
  ctx.fillRect(-6 * s, -4 * s, 5 * s, 6 * s);

  // Eyes
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(-5 * s, -3 * s, 1.5 * s, 2 * s);

  // Tongue
  const tongueOut = Math.sin(frame * 0.3) > 0;
  if (tongueOut) {
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(-8 * s, -0.5 * s, 3 * s, 1 * s);
  }

  ctx.restore();
}

function drawBossDog(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, frame: number, hitTimer: number) {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 16;
  const shake = hitTimer > 0 ? (Math.random() - 0.5) * 6 : 0;
  ctx.translate(shake, shake);

  // Aura
  ctx.globalAlpha = 0.3 + Math.sin(frame * 0.1) * 0.1;
  ctx.fillStyle = '#FF0000';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Body (large)
  ctx.fillStyle = hitTimer > 0 ? '#CC5555' : '#333';
  ctx.fillRect(-8 * s, -6 * s, 16 * s, 12 * s);

  // Head
  ctx.fillStyle = hitTimer > 0 ? '#DD6666' : '#444';
  ctx.fillRect(-9 * s, -10 * s, 18 * s, 7 * s);

  // Horns
  ctx.fillStyle = '#880000';
  ctx.fillRect(-9 * s, -14 * s, 3 * s, 5 * s);
  ctx.fillRect(6 * s, -14 * s, 3 * s, 5 * s);

  // Eyes (glowing)
  ctx.fillStyle = '#FF0000';
  ctx.fillRect(-5 * s, -8 * s, 3 * s, 2.5 * s);
  ctx.fillRect(2 * s, -8 * s, 3 * s, 2.5 * s);

  // Eye glow
  ctx.fillStyle = '#FFFF00';
  ctx.fillRect(-4.5 * s, -7.5 * s, 1 * s, 1 * s);
  ctx.fillRect(2.5 * s, -7.5 * s, 1 * s, 1 * s);

  // Teeth
  ctx.fillStyle = '#FFF';
  ctx.fillRect(-3 * s, -3 * s, 2 * s, 3 * s);
  ctx.fillRect(1 * s, -3 * s, 2 * s, 3 * s);

  ctx.restore();
}

function drawFishProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Fish body
  ctx.fillStyle = '#4FC3F7';
  ctx.fillRect(-6, -3, 12, 6);

  // Tail
  ctx.fillStyle = '#29B6F6';
  ctx.fillRect(-10, -4, 5, 8);

  // Eye
  ctx.fillStyle = '#222';
  ctx.fillRect(3, -2, 2, 2);

  // Glow
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#81D4FA';
  ctx.fillRect(-8, -5, 16, 10);
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawXpOrb(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  const pulse = 1 + Math.sin(frame * 0.15) * 0.2;
  const size = 5 * pulse;

  ctx.fillStyle = '#69F0AE';
  ctx.globalAlpha = 0.8;
  ctx.fillRect(x - size, y - size, size * 2, size * 2);

  ctx.fillStyle = '#B9F6CA';
  ctx.globalAlpha = 0.5;
  ctx.fillRect(x - size * 1.3, y - size * 1.3, size * 2.6, size * 2.6);
  ctx.globalAlpha = 1;
}

// ============================================================
// ABILITIES DEFINITION
// ============================================================
function getAbilities(): Ability[] {
  return [
    {
      id: 'more_fish',
      name: 'Extra Fish',
      description: '+1 projectile per attack',
      icon: '🐟',
      apply: (p) => { p.projectileCount += 1; }
    },
    {
      id: 'attack_speed',
      name: 'Quick Paws',
      description: 'Attack 20% faster',
      icon: '⚡',
      apply: (p) => { p.attackSpeed *= 0.8; }
    },
    {
      id: 'damage_up',
      name: 'Sharp Claws',
      description: '+5 damage',
      icon: '🔥',
      apply: (p) => { p.damage += 5; }
    },
    {
      id: 'speed_up',
      name: 'Agility',
      description: '+15% movement speed',
      icon: '💨',
      apply: (p) => { p.speed *= 1.15; }
    },
    {
      id: 'max_hp',
      name: 'Nine Lives',
      description: '+20 max HP & heal',
      icon: '❤️',
      apply: (p) => { p.maxHp += 20; p.hp = p.maxHp; }
    },
    {
      id: 'piercing',
      name: 'Piercing Fish',
      description: 'Fish pierce +1 enemy',
      icon: '🎯',
      apply: (p) => { p.projectileCount = p.projectileCount; /* handled via piercing global */ }
    },
    {
      id: 'pickup_range',
      name: 'Cat Magnet',
      description: '+50% pickup range',
      icon: '🧲',
      apply: (p) => { p.pickupRange *= 1.5; }
    },
    {
      id: 'proj_speed',
      name: 'Fast Fish',
      description: '+25% projectile speed',
      icon: '🚀',
      apply: (p) => { p.projectileSpeed *= 1.25; }
    },
  ];
}

// ============================================================
// GAME COMPONENT
// ============================================================
function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>('menu');
  const [uiState, setUiState] = useState<GameState>('menu');
  const [levelUpChoices, setLevelUpChoices] = useState<Ability[]>([]);
  const [gameTime, setGameTime] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [killCount, setKillCount] = useState(0);
  const [saveData, setSaveData] = useState<SaveData>(loadSave);
  const [quests, setQuests] = useState<Quest[]>(() => generateQuests(loadSave()));
  const [options, setOptions] = useState<GameOptions>(loadOptions);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [menuTab, setMenuTab] = useState<'main' | 'store' | 'quests' | 'options'>('main');

  const coinsEarnedRef = useRef(0);
  const dashCountRef = useRef(0);
  const questsRef = useRef<Quest[]>([]);
  const optionsRef = useRef<GameOptions>(loadOptions());
  const killsByTypeRef = useRef<Record<string, number>>({});

  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef<Vec2>({ x: 0, y: 0 });
  const frameRef = useRef(0);
  const animRef = useRef(0);
  const piercingBonusRef = useRef(0);

  const playerRef = useRef<Player>({
    x: WORLD_W / 2,
    y: WORLD_H / 2,
    hp: 50,
    maxHp: 50,
    speed: 220,
    xp: 0,
    xpToNext: 30,
    level: 1,
    damage: 12,
    attackSpeed: 0.4,
    attackTimer: 0,
    projectileCount: 1,
    projectileSpeed: 450,
    pickupRange: 100,
    invincibleTimer: 0,
    dashCooldown: 0,
    dashTimer: 0,
    facing: 0,
  });

  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const xpOrbsRef = useRef<XpOrb[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const damageNumbersRef = useRef<DamageNumber[]>([]);
  const gameTimerRef = useRef(0);
  const killCountRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const cameraRef = useRef<Vec2>({ x: 0, y: 0 });
  const lastTimeRef = useRef(0);

  const resetGame = useCallback(() => {
    const save = loadSave();
    const ups = save.storeUpgrades;
    const hpBonus = (ups['hp_boost'] || 0) * 10;
    const dmgBonus = (ups['dmg_boost'] || 0) * 3;
    const spdBonus = (ups['speed_boost'] || 0) * 10;
    const projBonus = (ups['extra_proj'] || 0);
    const pickupBonus = (ups['pickup_boost'] || 0) * 20;

    playerRef.current = {
      x: WORLD_W / 2,
      y: WORLD_H / 2,
      hp: 50 + hpBonus,
      maxHp: 50 + hpBonus,
      speed: 220 + spdBonus,
      xp: 0,
      xpToNext: 30,
      level: 1,
      damage: 12 + dmgBonus,
      attackSpeed: 0.4,
      attackTimer: 0,
      projectileCount: 1 + projBonus,
      projectileSpeed: 450,
      pickupRange: 100 + pickupBonus,
      invincibleTimer: 0,
      dashCooldown: 0,
      dashTimer: 0,
      facing: 0,
    };
    enemiesRef.current = [];
    projectilesRef.current = [];
    xpOrbsRef.current = [];
    particlesRef.current = [];
    damageNumbersRef.current = [];
    gameTimerRef.current = 0;
    killCountRef.current = 0;
    spawnTimerRef.current = 0;
    piercingBonusRef.current = 0;
    frameRef.current = 0;
    coinsEarnedRef.current = 0;
    dashCountRef.current = 0;
    killsByTypeRef.current = {};
    const newQuests = generateQuests(save);
    questsRef.current = newQuests;
    setQuests(newQuests);
    setGameTime(0);
    setPlayerLevel(1);
    setKillCount(0);
    setCoinsEarned(0);
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    gameStateRef.current = 'playing';
    setUiState('playing');
    setMenuTab('main');
    lastTimeRef.current = performance.now();
  }, [resetGame]);

  const chooseAbility = useCallback((ability: Ability) => {
    const player = playerRef.current;
    if (ability.id === 'piercing') {
      piercingBonusRef.current += 1;
    }
    ability.apply(player);
    gameStateRef.current = 'playing';
    setUiState('playing');
    lastTimeRef.current = performance.now();
  }, []);

  // Keyboard & mouse handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key === 'Escape' && gameStateRef.current === 'playing') {
        gameStateRef.current = 'paused';
        setUiState('paused');
      } else if (e.key === 'Escape' && gameStateRef.current === 'paused') {
        gameStateRef.current = 'playing';
        setUiState('playing');
        lastTimeRef.current = performance.now();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    function resizeCanvas() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function spawnEnemy() {
      const player = playerRef.current;
      const angle = Math.random() * Math.PI * 2;
      const dist = ENEMY_SPAWN_DIST + Math.random() * 200;
      const x = player.x + Math.cos(angle) * dist;
      const y = player.y + Math.sin(angle) * dist;

      const elapsed = gameTimerRef.current;
      const difficulty = 1 + elapsed / 90;

      let type: EnemyType;
      let hp: number;
      let speed: number;
      let damage: number;
      let size: number;
      let xpValue: number;

      const roll = Math.random();

      if (elapsed > 240 && roll < 0.04) {
        type = 'boss_dog';
        hp = 250 * difficulty;
        speed = 35;
        damage = 12;
        size = 48;
        xpValue = 60;
      } else if (elapsed > 150 && roll < 0.12) {
        type = 'snake';
        hp = 25 * difficulty;
        speed = 80 + Math.random() * 30;
        damage = 6;
        size = 28;
        xpValue = 10;
      } else if (elapsed > 90 && roll < 0.25) {
        type = 'dog';
        hp = 35 * difficulty;
        speed = 50 + Math.random() * 25;
        damage = 7;
        size = 32;
        xpValue = 12;
      } else if (elapsed > 20 && roll < 0.45) {
        type = 'rat';
        hp = 15 * difficulty;
        speed = 65 + Math.random() * 30;
        damage = 3;
        size = 24;
        xpValue = 5;
      } else {
        type = 'mouse';
        hp = 8 * difficulty;
        speed = 50 + Math.random() * 20;
        damage = 2;
        size = 20;
        xpValue = 3;
      }

      enemiesRef.current.push({
        x, y, hp, maxHp: hp, speed, damage, type, hitTimer: 0, size, xpValue,
      });
    }

    function spawnProjectiles() {
      const player = playerRef.current;
      const cam = cameraRef.current;
      const mouseWorld = {
        x: mouseRef.current.x + cam.x,
        y: mouseRef.current.y + cam.y,
      };
      const baseAngle = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x);
      player.facing = baseAngle;

      const count = player.projectileCount;
      const spreadAngle = count > 1 ? 0.3 : 0;

      for (let i = 0; i < count; i++) {
        const offset = count > 1 ? (i / (count - 1) - 0.5) * spreadAngle : 0;
        const angle = baseAngle + offset;
        projectilesRef.current.push({
          x: player.x,
          y: player.y,
          vx: Math.cos(angle) * player.projectileSpeed,
          vy: Math.sin(angle) * player.projectileSpeed,
          damage: player.damage,
          piercing: 1 + piercingBonusRef.current,
          hitEnemies: new Set(),
          lifetime: 2,
        });
      }
    }

    function checkLevelUp() {
      const player = playerRef.current;
      if (player.xp >= player.xpToNext) {
        player.xp -= player.xpToNext;
        player.level += 1;
        player.xpToNext = Math.floor(player.xpToNext * 1.4);
        setPlayerLevel(player.level);

        // Pick 3 random abilities
        const allAbilities = getAbilities();
        const choices: Ability[] = [];
        const shuffled = [...allAbilities].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 3 && i < shuffled.length; i++) {
          choices.push(shuffled[i]);
        }
        setLevelUpChoices(choices);
        gameStateRef.current = 'levelup';
        setUiState('levelup');
      }
    }

    function addParticles(x: number, y: number, color: string, count: number) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 100;
        particlesRef.current.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          lifetime: 0.3 + Math.random() * 0.3,
          maxLifetime: 0.6,
          color,
          size: 2 + Math.random() * 3,
        });
      }
    }

    function update(dt: number) {
      if (gameStateRef.current !== 'playing') return;

      const player = playerRef.current;
      frameRef.current += 1;
      gameTimerRef.current += dt;
      setGameTime(Math.floor(gameTimerRef.current));

      // Player movement
      let dx = 0;
      let dy = 0;
      const keys = keysRef.current;
      if (keys.has('w') || keys.has('arrowup')) dy -= 1;
      if (keys.has('s') || keys.has('arrowdown')) dy += 1;
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy);
        dx /= len;
        dy /= len;
      }

      // Dash
      player.dashCooldown = Math.max(0, player.dashCooldown - dt);
      const save = loadSave();
      const dashCdReduction = (save.storeUpgrades['dash_boost'] || 0) * 0.2;
      if ((keys.has('shift') || keys.has(' ')) && player.dashCooldown <= 0 && (dx !== 0 || dy !== 0)) {
        player.dashTimer = 0.15;
        player.dashCooldown = Math.max(0.3, 1 - dashCdReduction);
        player.invincibleTimer = Math.max(player.invincibleTimer, 0.15);
        dashCountRef.current += 1;
      }

      let speed = player.speed;
      if (player.dashTimer > 0) {
        speed *= 3;
        player.dashTimer -= dt;
      }

      player.x += dx * speed * dt;
      player.y += dy * speed * dt;
      player.x = Math.max(20, Math.min(WORLD_W - 20, player.x));
      player.y = Math.max(20, Math.min(WORLD_H - 20, player.y));

      player.invincibleTimer = Math.max(0, player.invincibleTimer - dt);

      // Attack
      player.attackTimer -= dt;
      if (player.attackTimer <= 0) {
        player.attackTimer = player.attackSpeed;
        spawnProjectiles();
      }

      // Spawn enemies
      const elapsed = gameTimerRef.current;
      const spawnRate = Math.max(0.4, 2.0 - elapsed / 150);
      spawnTimerRef.current -= dt;
      if (spawnTimerRef.current <= 0) {
        spawnTimerRef.current = spawnRate;
        const count = 1 + Math.floor(elapsed / 30);
        for (let i = 0; i < count; i++) {
          spawnEnemy();
        }
      }

      // Update projectiles
      projectilesRef.current = projectilesRef.current.filter(proj => {
        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;
        proj.lifetime -= dt;

        // Check hits
        for (let i = 0; i < enemiesRef.current.length; i++) {
          const enemy = enemiesRef.current[i];
          if (proj.hitEnemies.has(i)) continue;
          const edx = proj.x - enemy.x;
          const edy = proj.y - enemy.y;
          const dist = Math.sqrt(edx * edx + edy * edy);
          if (dist < enemy.size) {
            enemy.hp -= proj.damage;
            enemy.hitTimer = 0.1;
            proj.hitEnemies.add(i);
            proj.piercing -= 1;

            addParticles(enemy.x, enemy.y, '#FFAA00', 5);
            damageNumbersRef.current.push({
              x: enemy.x, y: enemy.y - enemy.size,
              value: proj.damage,
              lifetime: 0.8,
              vy: -60,
            });

            if (proj.piercing <= 0) return false;
          }
        }

        return proj.lifetime > 0;
      });

      // Update enemies
      enemiesRef.current = enemiesRef.current.filter(enemy => {
        enemy.hitTimer = Math.max(0, enemy.hitTimer - dt);

        // Move toward player
        const edx = player.x - enemy.x;
        const edy = player.y - enemy.y;
        const dist = Math.sqrt(edx * edx + edy * edy);

        if (dist > 0) {
          enemy.x += (edx / dist) * enemy.speed * dt;
          enemy.y += (edy / dist) * enemy.speed * dt;
        }

        // Hit player
        if (dist < enemy.size + 15 && player.invincibleTimer <= 0) {
          player.hp -= enemy.damage;
          player.invincibleTimer = 0.8;
          addParticles(player.x, player.y, '#FF4444', 8);

          if (player.hp <= 0) {
            gameStateRef.current = 'gameover';
            setUiState('gameover');
            // Save progress
            const sd = loadSave();
            sd.coins += coinsEarnedRef.current;
            sd.totalKills += killCountRef.current;
            sd.bestTime = Math.max(sd.bestTime, Math.floor(gameTimerRef.current));
            sd.bestLevel = Math.max(sd.bestLevel, playerRef.current.level);
            // Update quests
            const qs = questsRef.current.map(q => {
              if (q.claimed) return q;
              let prog = q.progress;
              if (q.type === 'kills') prog = killCountRef.current;
              else if (q.type === 'survive') prog = Math.floor(gameTimerRef.current);
              else if (q.type === 'level') prog = playerRef.current.level;
              else if (q.type === 'kill_type' && q.enemyType) prog = killsByTypeRef.current[q.enemyType] || 0;
              else if (q.type === 'dash') prog = dashCountRef.current;
              return { ...q, progress: Math.min(prog, q.target), completed: prog >= q.target };
            });
            questsRef.current = qs;
            setQuests(qs);
            saveSave(sd);
            setSaveData(sd);
          }
        }

        // Dead?
        if (enemy.hp <= 0) {
          killCountRef.current += 1;
          setKillCount(killCountRef.current);
          addParticles(enemy.x, enemy.y, '#FFD700', 10);

          // Track kill type for quests
          killsByTypeRef.current[enemy.type] = (killsByTypeRef.current[enemy.type] || 0) + 1;

          // Earn coins on kill
          const coinBonus = 1 + (loadSave().storeUpgrades['crit_chance'] || 0) * 0.05;
          const baseCoin = enemy.type === 'boss_dog' ? 5 : enemy.type === 'dog' ? 2 : 1;
          coinsEarnedRef.current += Math.floor(baseCoin * coinBonus);
          setCoinsEarned(coinsEarnedRef.current);

          // Drop XP
          xpOrbsRef.current.push({
            x: enemy.x + (Math.random() - 0.5) * 10,
            y: enemy.y + (Math.random() - 0.5) * 10,
            value: enemy.xpValue,
            magnetized: false,
          });
          return false;
        }
        return true;
      });

      // Update XP orbs
      xpOrbsRef.current = xpOrbsRef.current.filter(orb => {
        const odx = player.x - orb.x;
        const ody = player.y - orb.y;
        const dist = Math.sqrt(odx * odx + ody * ody);

        if (dist < player.pickupRange) {
          orb.magnetized = true;
        }

        if (orb.magnetized) {
          const magSpeed = 500;
          if (dist > 0) {
            orb.x += (odx / dist) * magSpeed * dt;
            orb.y += (ody / dist) * magSpeed * dt;
          }
        }

        if (dist < 20) {
          player.xp += orb.value;
          checkLevelUp();
          return false;
        }
        return true;
      });

      // Slow HP regen (with store bonus)
      const regenMult = 1 + (loadSave().storeUpgrades['regen_boost'] || 0) * 0.5;
      if (player.hp < player.maxHp && player.hp > 0) {
        player.hp = Math.min(player.maxHp, player.hp + dt * 0.33 * regenMult);
      }

      // Update particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.lifetime -= dt;
        return p.lifetime > 0;
      });

      // Update damage numbers
      damageNumbersRef.current = damageNumbersRef.current.filter(d => {
        d.y += d.vy * dt;
        d.lifetime -= dt;
        return d.lifetime > 0;
      });

      // Camera
      cameraRef.current = {
        x: player.x - canvas!.width / 2,
        y: player.y - canvas!.height / 2,
      };
    }

    function drawTiles() {
      const cam = cameraRef.current;
      const startCol = Math.floor(cam.x / TILE_SIZE);
      const startRow = Math.floor(cam.y / TILE_SIZE);
      const endCol = startCol + Math.ceil(canvas!.width / TILE_SIZE) + 1;
      const endRow = startRow + Math.ceil(canvas!.height / TILE_SIZE) + 1;

      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          const x = col * TILE_SIZE - cam.x;
          const y = row * TILE_SIZE - cam.y;
          const isDark = (col + row) % 2 === 0;
          ctx.fillStyle = isDark ? '#2D5016' : '#3A6B1E';
          ctx.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);
        }
      }

      // Draw some grass tufts
      ctx.fillStyle = '#4A8B2E';
      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          if ((col * 7 + row * 13) % 5 === 0) {
            const x = col * TILE_SIZE + 20 - cam.x;
            const y = row * TILE_SIZE + 40 - cam.y;
            ctx.fillRect(x, y, 4, 8);
            ctx.fillRect(x + 6, y + 2, 3, 6);
          }
        }
      }
    }

    function drawHUD() {
      const player = playerRef.current;
      const w = canvas!.width;

      // HP bar
      const hpBarW = 200;
      const hpBarH = 20;
      const hpX = 20;
      const hpY = 20;

      ctx.fillStyle = '#333';
      ctx.fillRect(hpX, hpY, hpBarW, hpBarH);
      const hpFrac = Math.max(0, player.hp / player.maxHp);
      ctx.fillStyle = hpFrac > 0.5 ? '#4CAF50' : hpFrac > 0.25 ? '#FFC107' : '#F44336';
      ctx.fillRect(hpX, hpY, hpBarW * hpFrac, hpBarH);
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(hpX, hpY, hpBarW, hpBarH);

      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, hpX + hpBarW / 2, hpY + 15);

      // XP bar
      const xpY = hpY + hpBarH + 5;
      ctx.fillStyle = '#333';
      ctx.fillRect(hpX, xpY, hpBarW, 10);
      const xpFrac = player.xp / player.xpToNext;
      ctx.fillStyle = '#7C4DFF';
      ctx.fillRect(hpX, xpY, hpBarW * xpFrac, 10);
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(hpX, xpY, hpBarW, 10);

      // Level
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`LV ${player.level}`, hpX, xpY + 25);

      // Timer (top right)
      const mins = Math.floor(gameTimerRef.current / 60);
      const secs = Math.floor(gameTimerRef.current % 60);
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`, w - 20, 35);

      // Kill count & coins
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`Kills: ${killCountRef.current}`, w - 20, 55);
      ctx.fillStyle = '#FFD700';
      ctx.fillText(`🪙 ${coinsEarnedRef.current}`, w - 20, 75);

      // Minimap
      if (!optionsRef.current.showMinimap) return;
      const mmSize = 120;
      const mmX = 10;
      const mmY = canvas!.height - mmSize - 10;

      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#111';
      ctx.fillRect(mmX, mmY, mmSize, mmSize);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#555';
      ctx.strokeRect(mmX, mmY, mmSize, mmSize);

      // Player on minimap
      const pmmX = mmX + (player.x / WORLD_W) * mmSize;
      const pmmY = mmY + (player.y / WORLD_H) * mmSize;
      ctx.fillStyle = '#4FC3F7';
      ctx.fillRect(pmmX - 2, pmmY - 2, 4, 4);

      // Enemies on minimap
      ctx.fillStyle = '#FF4444';
      for (const enemy of enemiesRef.current) {
        const emmX = mmX + (enemy.x / WORLD_W) * mmSize;
        const emmY = mmY + (enemy.y / WORLD_H) * mmSize;
        ctx.fillRect(emmX - 1, emmY - 1, 2, 2);
      }
    }

    function render() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);

      if (gameStateRef.current === 'menu') {
        // Don't render game world on menu
        return;
      }

      const cam = cameraRef.current;
      const frame = frameRef.current;
      const player = playerRef.current;

      // Draw tiles
      drawTiles();

      // Draw world boundary
      ctx.strokeStyle = '#FF4444';
      ctx.lineWidth = 4;
      ctx.strokeRect(-cam.x, -cam.y, WORLD_W, WORLD_H);

      // Draw XP orbs
      for (const orb of xpOrbsRef.current) {
        drawXpOrb(ctx, orb.x - cam.x, orb.y - cam.y, frame);
      }

      // Draw projectiles
      for (const proj of projectilesRef.current) {
        const angle = Math.atan2(proj.vy, proj.vx);
        drawFishProjectile(ctx, proj.x - cam.x, proj.y - cam.y, angle);
      }

      // Draw enemies
      for (const enemy of enemiesRef.current) {
        const ex = enemy.x - cam.x;
        const ey = enemy.y - cam.y;

        // Skip if off-screen
        if (ex < -100 || ex > canvas!.width + 100 || ey < -100 || ey > canvas!.height + 100) continue;

        switch (enemy.type) {
          case 'mouse':
            drawMouse(ctx, ex, ey, enemy.size, frame, enemy.hitTimer);
            break;
          case 'rat':
            drawRat(ctx, ex, ey, enemy.size, frame, enemy.hitTimer);
            break;
          case 'dog':
            drawDog(ctx, ex, ey, enemy.size, frame, enemy.hitTimer);
            break;
          case 'snake':
            drawSnake(ctx, ex, ey, enemy.size, frame, enemy.hitTimer);
            break;
          case 'boss_dog':
            drawBossDog(ctx, ex, ey, enemy.size, frame, enemy.hitTimer);
            break;
        }

        // Enemy HP bar
        if (enemy.hp < enemy.maxHp) {
          const barW = enemy.size * 1.5;
          const barH = 4;
          const barX = ex - barW / 2;
          const barY = ey - enemy.size - 8;
          ctx.fillStyle = '#333';
          ctx.fillRect(barX, barY, barW, barH);
          ctx.fillStyle = '#F44336';
          ctx.fillRect(barX, barY, barW * (enemy.hp / enemy.maxHp), barH);
        }
      }

      // Draw player
      const px = player.x - cam.x;
      const py = player.y - cam.y;

      if (player.invincibleTimer > 0) {
        ctx.globalAlpha = 0.5 + Math.sin(frame * 0.5) * 0.3;
      }
      const facingLeft = Math.cos(player.facing) < 0;
      drawPixelCat(ctx, px, py, 32, frame, facingLeft);
      ctx.globalAlpha = 1;

      // Draw particles
      for (const p of particlesRef.current) {
        ctx.globalAlpha = p.lifetime / p.maxLifetime;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - cam.x - p.size / 2, p.y - cam.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      // Draw damage numbers
      for (const d of damageNumbersRef.current) {
        ctx.globalAlpha = d.lifetime / 0.8;
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(Math.ceil(d.value)), d.x - cam.x, d.y - cam.y);
      }
      ctx.globalAlpha = 1;

      // HUD
      drawHUD();
    }

    function gameLoop(timestamp: number) {
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      if (gameStateRef.current === 'playing') {
        update(dt);
      }
      render();
      animRef.current = requestAnimationFrame(gameLoop);
    }

    animRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // ============================================================
  // STORE / QUEST / OPTIONS HANDLERS
  // ============================================================
  const buyStoreItem = useCallback((itemId: string) => {
    const sd = loadSave();
    const items = getStoreItems(sd.storeUpgrades);
    const item = items.find(i => i.id === itemId);
    if (!item || item.currentLevel >= item.maxLevel) return;
    const cost = item.cost * (item.currentLevel + 1);
    if (sd.coins < cost) return;
    sd.coins -= cost;
    sd.storeUpgrades[itemId] = (sd.storeUpgrades[itemId] || 0) + 1;
    saveSave(sd);
    setSaveData({ ...sd });
  }, []);

  const claimQuest = useCallback((questId: string) => {
    const q = quests.find(qu => qu.id === questId);
    if (!q || !q.completed || q.claimed) return;
    const sd = loadSave();
    sd.coins += q.reward;
    sd.questsCompleted += 1;
    saveSave(sd);
    setSaveData({ ...sd });
    const updated = quests.map(qu => qu.id === questId ? { ...qu, claimed: true } : qu);
    setQuests(updated);
    questsRef.current = updated;
  }, [quests]);

  const updateOption = useCallback((key: keyof GameOptions, value: boolean | number) => {
    const newOpts = { ...options, [key]: value };
    setOptions(newOpts);
    optionsRef.current = newOpts;
    saveOptions(newOpts);
  }, [options]);

  // ============================================================
  // UI OVERLAY RENDERS
  // ============================================================

  const btnStyle = (bg1: string, bg2: string, border: string, shadow: string) => ({
    fontFamily: 'monospace' as const,
    background: `linear-gradient(180deg, ${bg1} 0%, ${bg2} 100%)`,
    color: '#FFF',
    border: `3px solid ${border}`,
    borderRadius: '4px',
    textShadow: '2px 2px 0px rgba(0,0,0,0.3)',
    boxShadow: `0 4px 0px ${shadow}, 0 6px 12px rgba(0,0,0,0.4)`,
  });

  const panelStyle = {
    background: 'linear-gradient(180deg, #1a237e 0%, #0d1442 100%)',
    border: '3px solid #5C6BC0',
    boxShadow: '0 0 30px rgba(92, 107, 192, 0.3)',
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-900">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* MENU */}
      {uiState === 'menu' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10"
          style={{ background: 'linear-gradient(180deg, #1a1a4e 0%, #2d1b69 50%, #1a1a4e 100%)' }}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="absolute bg-white rounded-full animate-pulse"
                style={{
                  width: `${2 + Math.random() * 3}px`, height: `${2 + Math.random() * 3}px`,
                  left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`, animationDuration: `${1 + Math.random() * 2}s`,
                }} />
            ))}
          </div>

          {menuTab === 'main' && (
            <div className="relative text-center">
              <h1 className="text-6xl font-bold tracking-wider mb-2" style={{ fontFamily: 'monospace', color: '#FFD700', textShadow: '4px 4px 0px #8B6914, -1px -1px 0px #FFF8DC, 2px 2px 8px rgba(255,215,0,0.5)', letterSpacing: '0.1em' }}>NEKO</h1>
              <h1 className="text-6xl font-bold tracking-wider" style={{ fontFamily: 'monospace', color: '#FFD700', textShadow: '4px 4px 0px #8B6914, -1px -1px 0px #FFF8DC, 2px 2px 8px rgba(255,215,0,0.5)', letterSpacing: '0.1em' }}>SURVIVORS</h1>
              <p className="text-yellow-300 text-sm mt-2 font-mono tracking-widest">BETA v0.2</p>
              <p className="text-gray-400 text-xs mt-1 font-mono">WASD to move | SHIFT to dash | Mouse to aim</p>

              <div className="mt-4 text-2xl animate-bounce">🐱</div>

              <div className="mt-4 font-mono text-yellow-300 text-sm">🪙 {saveData.coins} coins</div>

              <div className="mt-6 flex flex-col gap-3 items-center">
                <button onClick={startGame} className="px-12 py-4 text-xl font-bold tracking-wider transition-all duration-200 hover:scale-105 active:scale-95" style={btnStyle('#4CAF50', '#2E7D32', '#1B5E20', '#1B5E20')}>PLAY</button>
                <div className="flex gap-3">
                  <button onClick={() => setMenuTab('store')} className="px-6 py-3 text-sm font-bold tracking-wider transition-all duration-200 hover:scale-105 active:scale-95" style={btnStyle('#FF9800', '#E65100', '#BF360C', '#BF360C')}>🏪 STORE</button>
                  <button onClick={() => setMenuTab('quests')} className="px-6 py-3 text-sm font-bold tracking-wider transition-all duration-200 hover:scale-105 active:scale-95" style={btnStyle('#9C27B0', '#6A1B9A', '#4A148C', '#4A148C')}>📜 QUESTS</button>
                  <button onClick={() => setMenuTab('options')} className="px-6 py-3 text-sm font-bold tracking-wider transition-all duration-200 hover:scale-105 active:scale-95" style={btnStyle('#546E7A', '#37474F', '#263238', '#263238')}>⚙️ OPTIONS</button>
                </div>
              </div>

              <div className="mt-6 text-center">
                {saveData.bestTime > 0 && <p className="text-gray-500 text-xs font-mono">Best: {Math.floor(saveData.bestTime / 60)}:{String(saveData.bestTime % 60).padStart(2, '0')} | LV {saveData.bestLevel} | {saveData.totalKills} total kills</p>}
                <p className="text-gray-600 text-xs font-mono mt-1">Built with AI for Xiaomi MiMo 100T Program</p>
              </div>
            </div>
          )}

          {/* STORE TAB */}
          {menuTab === 'store' && (
            <div className="relative w-full max-w-2xl mx-auto p-6 rounded-lg" style={panelStyle}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-yellow-400 font-mono tracking-wider" style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.5)' }}>🏪 STORE</h2>
                <div className="flex items-center gap-4">
                  <span className="text-yellow-300 font-mono text-lg">🪙 {saveData.coins}</span>
                  <button onClick={() => setMenuTab('main')} className="text-gray-400 hover:text-white font-mono text-xl">✕</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
                {getStoreItems(saveData.storeUpgrades).map(item => {
                  const cost = item.cost * (item.currentLevel + 1);
                  const maxed = item.currentLevel >= item.maxLevel;
                  const canAfford = saveData.coins >= cost;
                  return (
                    <button key={item.id} onClick={() => !maxed && canAfford && buyStoreItem(item.id)}
                      className={`p-3 rounded-lg text-left transition-all duration-200 ${maxed ? 'opacity-60' : canAfford ? 'hover:scale-105 hover:brightness-110' : 'opacity-70'}`}
                      style={{ background: 'linear-gradient(180deg, #37474F 0%, #263238 100%)', border: `2px solid ${maxed ? '#4CAF50' : canAfford ? '#546E7A' : '#333'}` }}>
                      <div className="flex items-start gap-2">
                        <span className="text-2xl">{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-yellow-300 font-bold font-mono text-xs">{item.name}</div>
                          <div className="text-gray-400 text-xs font-mono">{item.description}</div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs font-mono text-blue-300">LV {item.currentLevel}/{item.maxLevel}</span>
                            {maxed ? <span className="text-xs font-mono text-green-400">MAX</span> : <span className={`text-xs font-mono ${canAfford ? 'text-yellow-300' : 'text-red-400'}`}>🪙 {cost}</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* QUESTS TAB */}
          {menuTab === 'quests' && (
            <div className="relative w-full max-w-2xl mx-auto p-6 rounded-lg" style={panelStyle}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-yellow-400 font-mono tracking-wider" style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.5)' }}>📜 QUESTS</h2>
                <div className="flex items-center gap-4">
                  <span className="text-gray-400 font-mono text-sm">{saveData.questsCompleted} completed</span>
                  <button onClick={() => setMenuTab('main')} className="text-gray-400 hover:text-white font-mono text-xl">✕</button>
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {quests.map(q => (
                  <div key={q.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: q.claimed ? 'rgba(76,175,80,0.15)' : q.completed ? 'rgba(255,215,0,0.15)' : 'rgba(55,71,79,0.5)', border: `1px solid ${q.claimed ? '#4CAF50' : q.completed ? '#FFD700' : '#37474F'}` }}>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold font-mono text-sm ${q.claimed ? 'text-green-400 line-through' : q.completed ? 'text-yellow-300' : 'text-white'}`}>{q.name}</div>
                      <div className="text-gray-400 text-xs font-mono">{q.description}</div>
                      <div className="mt-1 h-2 rounded-full overflow-hidden" style={{ background: '#333', width: '100%' }}>
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%`, background: q.completed ? '#4CAF50' : '#7C4DFF' }} />
                      </div>
                      <div className="text-xs font-mono text-gray-500 mt-1">{q.progress}/{q.target}</div>
                    </div>
                    <div className="text-right shrink-0">
                      {q.claimed ? (
                        <span className="text-green-400 font-mono text-xs">CLAIMED</span>
                      ) : q.completed ? (
                        <button onClick={() => claimQuest(q.id)} className="px-3 py-1 text-xs font-bold font-mono rounded transition-all hover:scale-105" style={btnStyle('#4CAF50', '#2E7D32', '#1B5E20', '#1B5E20')}>CLAIM 🪙{q.reward}</button>
                      ) : (
                        <span className="text-yellow-300 font-mono text-xs">🪙 {q.reward}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OPTIONS TAB */}
          {menuTab === 'options' && (
            <div className="relative w-full max-w-md mx-auto p-6 rounded-lg" style={panelStyle}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-yellow-400 font-mono tracking-wider" style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.5)' }}>⚙️ OPTIONS</h2>
                <button onClick={() => setMenuTab('main')} className="text-gray-400 hover:text-white font-mono text-xl">✕</button>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-white font-mono text-sm">Show Damage Numbers</span>
                  <button onClick={() => updateOption('showDamageNumbers', !options.showDamageNumbers)} className={`w-14 h-7 rounded-full transition-all duration-200 ${options.showDamageNumbers ? 'bg-green-500' : 'bg-gray-600'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full mx-1 transition-all duration-200 ${options.showDamageNumbers ? 'translate-x-7' : ''}`} />
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white font-mono text-sm">Show Minimap</span>
                  <button onClick={() => updateOption('showMinimap', !options.showMinimap)} className={`w-14 h-7 rounded-full transition-all duration-200 ${options.showMinimap ? 'bg-green-500' : 'bg-gray-600'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full mx-1 transition-all duration-200 ${options.showMinimap ? 'translate-x-7' : ''}`} />
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white font-mono text-sm">Screen Shake</span>
                  <button onClick={() => updateOption('screenShake', !options.screenShake)} className={`w-14 h-7 rounded-full transition-all duration-200 ${options.screenShake ? 'bg-green-500' : 'bg-gray-600'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full mx-1 transition-all duration-200 ${options.screenShake ? 'translate-x-7' : ''}`} />
                  </button>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-white font-mono text-sm">Music Volume</span>
                    <span className="text-gray-400 font-mono text-xs">{options.musicVolume}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={options.musicVolume} onChange={e => updateOption('musicVolume', Number(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, #7C4DFF ${options.musicVolume}%, #333 ${options.musicVolume}%)` }} />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-white font-mono text-sm">SFX Volume</span>
                    <span className="text-gray-400 font-mono text-xs">{options.sfxVolume}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={options.sfxVolume} onChange={e => updateOption('sfxVolume', Number(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, #FF9800 ${options.sfxVolume}%, #333 ${options.sfxVolume}%)` }} />
                </div>
                <div className="pt-4 border-t border-gray-700">
                  <button onClick={() => { localStorage.removeItem('neko_survivors_save'); setSaveData(loadSave()); setQuests(generateQuests(loadSave())); }} className="w-full px-4 py-2 text-sm font-bold font-mono tracking-wider transition-all duration-200 hover:scale-105 active:scale-95" style={btnStyle('#F44336', '#C62828', '#B71C1C', '#B71C1C')}>RESET ALL DATA</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LEVEL UP */}
      {uiState === 'levelup' && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/60">
          <div className="text-center p-8 rounded-lg max-w-2xl" style={panelStyle}>
            <h2 className="text-3xl font-bold text-yellow-400 mb-2 font-mono tracking-wider" style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.5)' }}>LEVEL UP!</h2>
            <p className="text-blue-200 mb-6 font-mono text-sm">Choose an ability:</p>
            <div className="flex gap-4 justify-center flex-wrap">
              {levelUpChoices.map((ability) => (
                <button key={ability.id} onClick={() => chooseAbility(ability)} className="p-4 rounded-lg w-48 transition-all duration-200 hover:scale-105 hover:brightness-110 active:scale-95 text-left" style={{ background: 'linear-gradient(180deg, #37474F 0%, #263238 100%)', border: '2px solid #546E7A', boxShadow: '0 4px 0px #1a2327, 0 6px 12px rgba(0,0,0,0.3)' }}>
                  <div className="text-3xl mb-2">{ability.icon}</div>
                  <div className="text-yellow-300 font-bold font-mono text-sm mb-1">{ability.name}</div>
                  <div className="text-gray-300 text-xs font-mono">{ability.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER */}
      {uiState === 'gameover' && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/70">
          <div className="text-center p-8 rounded-lg" style={{ background: 'linear-gradient(180deg, #4a0000 0%, #2a0000 100%)', border: '3px solid #ff4444', boxShadow: '0 0 30px rgba(255, 68, 68, 0.4)' }}>
            <h2 className="text-5xl font-bold text-red-400 mb-4 font-mono tracking-wider" style={{ textShadow: '3px 3px 0px rgba(0,0,0,0.5)' }}>GAME OVER</h2>
            <div className="space-y-2 mb-6">
              <p className="text-gray-300 font-mono text-lg">Time: <span className="text-yellow-300">{Math.floor(gameTime / 60)}:{String(gameTime % 60).padStart(2, '0')}</span></p>
              <p className="text-gray-300 font-mono text-lg">Level: <span className="text-yellow-300">{playerLevel}</span></p>
              <p className="text-gray-300 font-mono text-lg">Kills: <span className="text-yellow-300">{killCount}</span></p>
              <p className="text-yellow-300 font-mono text-lg font-bold">🪙 +{coinsEarned} coins earned!</p>
            </div>
            <button onClick={startGame} className="px-10 py-3 text-lg font-bold tracking-wider transition-all duration-200 hover:scale-105 active:scale-95" style={btnStyle('#4CAF50', '#2E7D32', '#1B5E20', '#1B5E20')}>TRY AGAIN</button>
            <button onClick={() => { gameStateRef.current = 'menu'; setUiState('menu'); setSaveData(loadSave()); }} className="block mx-auto mt-4 px-8 py-2 text-sm font-bold tracking-wider transition-all duration-200 hover:scale-105 active:scale-95" style={btnStyle('#546E7A', '#37474F', '#263238', '#263238')}>MENU</button>
          </div>
        </div>
      )}

      {/* PAUSED */}
      {uiState === 'paused' && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/50">
          <div className="text-center p-8 rounded-lg" style={panelStyle}>
            <h2 className="text-4xl font-bold text-white mb-6 font-mono tracking-wider" style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.5)' }}>PAUSED</h2>
            <button onClick={() => { gameStateRef.current = 'playing'; setUiState('playing'); lastTimeRef.current = performance.now(); }} className="px-10 py-3 text-lg font-bold tracking-wider transition-all duration-200 hover:scale-105 active:scale-95" style={btnStyle('#4CAF50', '#2E7D32', '#1B5E20', '#1B5E20')}>RESUME</button>
            <p className="text-gray-400 text-sm mt-4 font-mono">Press ESC to resume</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
