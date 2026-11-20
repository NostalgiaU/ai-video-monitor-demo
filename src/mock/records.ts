import type { TimeSegment } from '../components/Timeline';
import { hashString, mulberry32 } from './random';

const MIN = 60_000;

/** 生成某点位某天的录像片段（模拟 NVR 录像索引：有断档、按需录像） */
export function recordSegments(cameraId: string, dayStart: number, now = Date.now()): TimeSegment[] {
  const rand = mulberry32(hashString(`${cameraId}-${dayStart}`));
  const end = Math.min(dayStart + 24 * 60 * MIN, now);
  const list: TimeSegment[] = [];
  let t = dayStart + rand() * 20 * MIN;
  while (t < end) {
    const len = (20 + rand() * 160) * MIN;
    list.push({ start: t, end: Math.min(t + len, end), type: 'record' });
    t += len + (rand() < 0.7 ? rand() * 5 : 10 + rand() * 40) * MIN;
  }
  return list;
}
