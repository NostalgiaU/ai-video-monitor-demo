import { cameras } from './devices';
import { mulberry32, pick, weightedPick } from './random';
import { sceneLayout } from './scene';

export type AlarmType = 'no_helmet' | 'no_vest' | 'intrusion' | 'smoking' | 'phone' | 'fall' | 'fire' | 'crowd';
export type AlarmLevel = 1 | 2 | 3;
export type AlarmStatus = 'pending' | 'processing' | 'closed' | 'false_alarm';

export const ALARM_TYPES: Record<AlarmType, { label: string; level: AlarmLevel; color: string }> = {
  fire: { label: '烟火识别', level: 1, color: '#ff4d4f' },
  fall: { label: '人员倒地', level: 1, color: '#ff7a45' },
  intrusion: { label: '危险区域闯入', level: 1, color: '#f759ab' },
  no_helmet: { label: '未戴安全帽', level: 2, color: '#faad14' },
  smoking: { label: '吸烟检测', level: 2, color: '#9254de' },
  no_vest: { label: '未穿反光衣', level: 3, color: '#36cfc9' },
  phone: { label: '作业玩手机', level: 3, color: '#4096ff' },
  crowd: { label: '人员聚集', level: 3, color: '#73d13d' },
};

export const LEVEL_META: Record<AlarmLevel, { label: string; color: string }> = {
  1: { label: '紧急', color: '#ff4d4f' },
  2: { label: '重要', color: '#faad14' },
  3: { label: '一般', color: '#4096ff' },
};

export const STATUS_META: Record<AlarmStatus, { label: string; color: string }> = {
  pending: { label: '待处置', color: 'error' },
  processing: { label: '处置中', color: 'processing' },
  closed: { label: '已闭环', color: 'success' },
  false_alarm: { label: '误报', color: 'default' },
};

export interface AlarmLog {
  time: number;
  action: string;
  operator: string;
  remark?: string;
}

export interface Alarm {
  id: string;
  type: AlarmType;
  level: AlarmLevel;
  status: AlarmStatus;
  cameraId: string;
  time: number;
  confidence: number;
  /** 场景图种子，用于生成抓拍图 */
  seed: number;
  /** 归一化检测框 [x, y, w, h] */
  box: [number, number, number, number];
  logs: AlarmLog[];
  closedAt?: number;
}

const OPERATORS = ['张伟', '李娜', '王强', '刘洋', '陈静', '赵磊'];
const typeWeights = (Object.keys(ALARM_TYPES) as AlarmType[]).map((value) => ({
  value,
  weight: { no_helmet: 30, no_vest: 22, phone: 14, smoking: 10, intrusion: 10, crowd: 8, fall: 3, fire: 3 }[value],
}));
const onlineCameras = cameras.filter((c) => c.online);

let serial = 0;

export function createAlarm(rand: () => number, time: number, now: number): Alarm {
  const type = weightedPick(rand, typeWeights);
  const seed = Math.floor(rand() * 1e9);
  const age = now - time;
  const logs: AlarmLog[] = [{ time, action: '算法上报告警', operator: '系统' }];
  let status: AlarmStatus = 'pending';
  let closedAt: number | undefined;
  const r = rand();
  if (age > 30 * 60_000 || r < 0.35) {
    const confirmAt = time + (1 + rand() * 8) * 60_000;
    const operator = pick(rand, OPERATORS);
    if (rand() < 0.08) {
      status = 'false_alarm';
      closedAt = confirmAt;
      logs.push({ time: confirmAt, action: '标记误报', operator, remark: '画面中为反光物体' });
    } else {
      logs.push({ time: confirmAt, action: '确认告警并派单', operator });
      const doneAt = confirmAt + (5 + rand() * 50) * 60_000;
      if (doneAt < now && (age > 2 * 3600_000 || rand() < 0.6)) {
        status = 'closed';
        closedAt = doneAt;
        logs.push({ time: doneAt, action: '现场整改完成，闭环', operator, remark: '已现场提醒并完成整改' });
      } else {
        status = 'processing';
      }
    }
  }
  return {
    id: `AL${String(++serial).padStart(6, '0')}`,
    type,
    level: ALARM_TYPES[type].level,
    status,
    cameraId: pick(rand, onlineCameras).id,
    time,
    confidence: 0.72 + rand() * 0.27,
    seed,
    box: sceneLayout(seed, type).box,
    logs,
    closedAt,
  };
}

/** 生成近 7 天告警，越近越密集，且白班时段更多 */
export function generateAlarms(count: number, now = Date.now()): Alarm[] {
  const rand = mulberry32(20261120);
  const list: Alarm[] = [];
  const span = 7 * 24 * 3600_000;
  while (list.length < count) {
    const t = now - Math.pow(rand(), 1.6) * span;
    const hour = new Date(t).getHours();
    const dayShift = hour >= 8 && hour < 20 ? 1 : 0.35;
    if (rand() > dayShift) continue;
    list.push(createAlarm(rand, t, now));
  }
  list.sort((a, b) => b.time - a.time);
  list.forEach((a, i) => (a.id = `AL${String(list.length - i).padStart(6, '0')}`));
  serial = list.length;
  return list;
}
