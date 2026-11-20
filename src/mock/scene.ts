/**
 * 用 SVG 程序化生成「车间监控抓拍图」，避免引入真实人员图片素材。
 * sceneLayout 只计算布局（便宜，可批量生成告警的检测框），sceneImage 才拼接 SVG。
 */
import type { AlarmType } from './alarms';
import { mulberry32, pick } from './random';

export const SCENE_W = 640;
export const SCENE_H = 360;

interface Person {
  x: number;
  y: number;
  s: number;
  helmet: string | null;
  vest: boolean;
  cloth: string;
  fallen?: boolean;
  smoking?: boolean;
  phone?: boolean;
}

interface Layout {
  persons: Person[];
  machines: { x: number; w: number; h: number; color: string }[];
  flame?: { x: number; y: number; s: number };
  zone?: string;
  /** 归一化检测框 */
  box: [number, number, number, number];
}

const HELMETS = ['#f5c518', '#f5c518', '#f5f5f5', '#e53935', '#1e88e5'];
const CLOTHES = ['#2f5d8a', '#2f5d8a', '#3d4a5c', '#4b5d3a', '#5a4632'];
const scaleAt = (y: number) => 0.55 + ((y - 190) / 150) * 0.6;
const heightOf = (s: number) => 150 * s;

function personBox(p: Person): [number, number, number, number] {
  const H = heightOf(p.s);
  if (p.fallen) return [p.x - 6 * p.s, p.y - 28 * p.s, H + 12 * p.s, 52 * p.s];
  return [p.x - 28 * p.s, p.y - H - 6 * p.s, 56 * p.s, H + 10 * p.s];
}

const norm = ([x, y, w, h]: number[]): [number, number, number, number] => [
  Math.max(0, x / SCENE_W),
  Math.max(0, y / SCENE_H),
  Math.min(w / SCENE_W, 1),
  Math.min(h / SCENE_H, 1),
];

function randomPerson(rand: () => number, x?: number, y?: number): Person {
  const py = y ?? 200 + rand() * 140;
  return {
    x: x ?? 60 + rand() * 520,
    y: py,
    s: scaleAt(py),
    helmet: pick(rand, HELMETS),
    vest: rand() > 0.25,
    cloth: pick(rand, CLOTHES),
  };
}

export function sceneLayout(seed: number, type: AlarmType): Layout {
  const rand = mulberry32(seed);
  const machines = Array.from({ length: 2 + Math.floor(rand() * 2) }, (_, i) => ({
    x: 30 + i * 210 + rand() * 60,
    w: 110 + rand() * 70,
    h: 60 + rand() * 50,
    color: pick(rand, ['#56606b', '#4a5866', '#5f6b5a']),
  }));
  const target = randomPerson(rand, 140 + rand() * 360, 240 + rand() * 90);
  target.helmet = target.helmet ?? HELMETS[0];
  target.vest = true;
  const persons: Person[] = [target];
  const others = Math.floor(rand() * 3);
  for (let i = 0; i < others; i++) persons.push(randomPerson(rand));
  let box = personBox(target);
  let flame: Layout['flame'];
  let zone: string | undefined;

  switch (type) {
    case 'no_helmet':
      target.helmet = null;
      break;
    case 'no_vest':
      target.vest = false;
      break;
    case 'smoking':
      target.smoking = true;
      break;
    case 'phone':
      target.phone = true;
      break;
    case 'fall':
      target.fallen = true;
      box = personBox(target);
      break;
    case 'intrusion': {
      const zx = target.x - 70;
      zone = `${zx},${target.y - 30} ${zx + 150},${target.y - 30} ${zx + 175},${target.y + 22} ${zx - 25},${target.y + 22}`;
      break;
    }
    case 'fire': {
      const m = machines[Math.floor(rand() * machines.length)];
      flame = { x: m.x + m.w * 0.5, y: 200, s: 0.9 + rand() * 0.5 };
      box = [flame.x - 45 * flame.s, flame.y - 110 * flame.s, 90 * flame.s, 115 * flame.s];
      persons.length = 1;
      target.x = Math.min(600, flame.x + 160);
      break;
    }
    case 'crowd': {
      for (let i = 0; i < 4; i++) {
        persons.push(randomPerson(rand, target.x - 70 + rand() * 140, target.y - 30 + rand() * 50));
      }
      const boxes = persons.slice(0, 5).map(personBox);
      const x1 = Math.min(...boxes.map((b) => b[0]));
      const y1 = Math.min(...boxes.map((b) => b[1]));
      const x2 = Math.max(...boxes.map((b) => b[0] + b[2]));
      const y2 = Math.max(...boxes.map((b) => b[1] + b[3]));
      box = [x1, y1, x2 - x1, y2 - y1];
      break;
    }
  }
  persons.sort((a, b) => a.y - b.y);
  return { persons, machines, flame, zone, box: norm(box) };
}

function personSvg(p: Person) {
  const H = heightOf(p.s);
  const s = p.s;
  const top = -H;
  const parts = [
    `<rect x="${-9 * s}" y="${top + 0.55 * H}" width="${7 * s}" height="${0.45 * H}" rx="${2 * s}" fill="#262d36"/>`,
    `<rect x="${2 * s}" y="${top + 0.55 * H}" width="${7 * s}" height="${0.45 * H}" rx="${2 * s}" fill="#262d36"/>`,
    `<rect x="${-20 * s}" y="${top + 0.2 * H}" width="${8 * s}" height="${0.36 * H}" rx="${4 * s}" fill="${p.cloth}"/>`,
    `<rect x="${12 * s}" y="${top + 0.2 * H}" width="${8 * s}" height="${0.36 * H}" rx="${4 * s}" fill="${p.cloth}"/>`,
    `<rect x="${-14 * s}" y="${top + 0.17 * H}" width="${28 * s}" height="${0.42 * H}" rx="${6 * s}" fill="${p.cloth}"/>`,
  ];
  if (p.vest) {
    parts.push(
      `<rect x="${-13 * s}" y="${top + 0.19 * H}" width="${26 * s}" height="${0.34 * H}" rx="${4 * s}" fill="#ff8f1f" opacity="0.92"/>`,
      `<rect x="${-13 * s}" y="${top + 0.3 * H}" width="${26 * s}" height="${3 * s}" fill="#e8f0ff"/>`,
      `<rect x="${-13 * s}" y="${top + 0.42 * H}" width="${26 * s}" height="${3 * s}" fill="#e8f0ff"/>`,
    );
  }
  parts.push(`<circle cx="0" cy="${top + 0.09 * H}" r="${9 * s}" fill="#e0b48a"/>`);
  if (p.helmet) {
    parts.push(
      `<path d="M${-11 * s},${top + 0.085 * H} a${11 * s},${10 * s} 0 0 1 ${22 * s},0 z" fill="${p.helmet}"/>`,
      `<rect x="${-13 * s}" y="${top + 0.08 * H}" width="${26 * s}" height="${2.5 * s}" rx="${1 * s}" fill="${p.helmet}"/>`,
    );
  } else {
    parts.push(`<path d="M${-9 * s},${top + 0.075 * H} a${9 * s},${8 * s} 0 0 1 ${18 * s},0 z" fill="#2a2018"/>`);
  }
  if (p.smoking) {
    parts.push(
      `<line x1="${6 * s}" y1="${top + 0.11 * H}" x2="${15 * s}" y2="${top + 0.115 * H}" stroke="#eee" stroke-width="${2 * s}"/>`,
      `<circle cx="${15.5 * s}" cy="${top + 0.115 * H}" r="${1.8 * s}" fill="#ff6a00"/>`,
      `<circle cx="${19 * s}" cy="${top + 0.06 * H}" r="${4 * s}" fill="#c9d1d9" opacity="0.35"/>`,
    );
  }
  if (p.phone) {
    parts.push(
      `<rect x="${7 * s}" y="${top + 0.08 * H}" width="${6 * s}" height="${10 * s}" rx="${1 * s}" fill="#111"/>`,
      `<rect x="${8 * s}" y="${top + 0.09 * H}" width="${4 * s}" height="${7 * s}" fill="#7fd3ff"/>`,
    );
  }
  if (p.fallen) {
    const shadow = `<ellipse cx="${p.x + H / 2}" cy="${p.y + 18 * s}" rx="${H / 2}" ry="${5 * s}" fill="#000" opacity="0.35"/>`;
    return `${shadow}<g transform="translate(${p.x},${p.y - 4 * s}) rotate(90)">${parts.join('')}</g>`;
  }
  const shadow = `<ellipse cx="${p.x}" cy="${p.y}" rx="${20 * s}" ry="${5 * s}" fill="#000" opacity="0.35"/>`;
  const body = `<g transform="translate(${p.x},${p.y})">${parts.join('')}</g>`;
  return shadow + body;
}

function flameSvg({ x, y, s }: NonNullable<Layout['flame']>) {
  return `<g transform="translate(${x},${y}) scale(${s})">
    <circle cx="-10" cy="-120" r="26" fill="#9aa4ad" opacity="0.25"/><circle cx="14" cy="-140" r="32" fill="#9aa4ad" opacity="0.2"/>
    <path d="M0,0 C-40,-10 -38,-55 -18,-80 C-16,-60 -4,-58 -2,-70 C2,-95 18,-100 22,-110 C26,-80 44,-60 36,-30 C32,-10 18,0 0,0z" fill="#ff5a1f"/>
    <path d="M0,0 C-22,-6 -22,-34 -8,-50 C-6,-38 2,-36 4,-46 C10,-56 18,-60 20,-66 C24,-46 30,-30 22,-14 C18,-4 10,0 0,0z" fill="#ffc53d"/>
  </g>`;
}

export function sceneImage(seed: number, type: AlarmType) {
  const l = sceneLayout(seed, type);
  const rand = mulberry32(seed ^ 0x5bd1e995);
  const lines = Array.from({ length: 9 }, (_, i) => {
    const bx = -200 + i * 130;
    return `<line x1="320" y1="120" x2="${bx}" y2="360" stroke="#4a525b" stroke-width="1"/>`;
  }).join('');
  const machines = l.machines
    .map(
      (m) => `<g><rect x="${m.x}" y="${200 - m.h}" width="${m.w}" height="${m.h}" fill="${m.color}" rx="3"/>
      <rect x="${m.x + 10}" y="${200 - m.h + 10}" width="${m.w * 0.35}" height="${m.h * 0.35}" fill="#1c2630"/>
      <circle cx="${m.x + m.w * 0.7}" cy="${200 - m.h + 18}" r="5" fill="${rand() > 0.5 ? '#52c41a' : '#faad14'}"/>
      <rect x="${m.x}" y="194" width="${m.w}" height="6" fill="url(#hazard)"/></g>`,
    )
    .join('');
  const zone = l.zone
    ? `<polygon points="${l.zone}" fill="url(#danger)" stroke="#ff4d4f" stroke-width="2" stroke-dasharray="8 5"/>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCENE_W} ${SCENE_H}" width="${SCENE_W}" height="${SCENE_H}">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#18202a"/><stop offset="1" stop-color="#2c3743"/></linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4047"/><stop offset="1" stop-color="#4b5259"/></linearGradient>
    <pattern id="hazard" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="12" fill="#f5c518"/><rect x="6" width="6" height="12" fill="#222"/></pattern>
    <pattern id="danger" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="10" fill="#ff4d4f" opacity="0.35"/></pattern>
  </defs>
  <rect width="${SCENE_W}" height="200" fill="url(#wall)"/>
  ${Array.from({ length: 5 }, (_, i) => `<rect x="${40 + i * 125}" y="22" width="70" height="6" rx="3" fill="#dfe8f0" opacity="0.7"/>`).join('')}
  <rect y="170" width="${SCENE_W}" height="190" fill="url(#floor)"/>
  ${lines}
  <line x1="0" y1="${250 + rand() * 30}" x2="${SCENE_W}" y2="${240 + rand() * 30}" stroke="#d4a017" stroke-width="4" opacity="0.8"/>
  ${machines}${zone}${l.flame ? flameSvg(l.flame) : ''}
  ${l.persons.map(personSvg).join('')}
  </svg>`;
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, box: l.box };
}

/** 人员卡片的属性（不生成图片，可用于属性过滤与瀑布流预布局） */
export function personSpec(seed: number) {
  const rand = mulberry32(seed);
  const h = Math.round(220 + rand() * 120);
  const helmet = rand() > 0.15 ? pick(rand, HELMETS) : null;
  const vest = rand() > 0.3;
  const cloth = pick(rand, CLOTHES);
  const bg = pick(rand, ['#26313d', '#2d3540', '#303a32', '#352f2a']);
  return { w: 180, h, ratio: h / 180, helmet, vest, cloth, bg };
}

/** 人员检索结果卡片：单人全身像，高度随种子变化以形成瀑布流 */
export function personImage(seed: number) {
  const { w, h, helmet, vest, cloth, bg } = personSpec(seed);
  const p: Person = { x: w / 2, y: h - 12, s: (h - 30) / 150, helmet, vest, cloth };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${bg}"/><rect y="${h * 0.62}" width="${w}" height="${h * 0.38}" fill="#000" opacity="0.18"/>
    ${personSvg(p)}</svg>`;
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
}
