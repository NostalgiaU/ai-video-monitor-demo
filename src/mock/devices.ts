export interface Workshop {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Camera {
  id: string;
  name: string;
  workshopId: string;
  /** 厂区平面图坐标（viewBox 1000 x 600） */
  x: number;
  y: number;
  online: boolean;
  /** 流媒体服务上的 stream id，app 固定为 live */
  streamId: string;
  ip: string;
}

export const workshops: Workshop[] = [
  { id: 'ws1', name: '冲压车间', x: 30, y: 30, w: 300, h: 250 },
  { id: 'ws2', name: '焊装车间', x: 360, y: 30, w: 300, h: 250 },
  { id: 'ws3', name: '涂装车间', x: 690, y: 30, w: 280, h: 250 },
  { id: 'ws4', name: '总装车间', x: 30, y: 320, w: 460, h: 250 },
  { id: 'ws5', name: '仓储物流区', x: 520, y: 320, w: 450, h: 250 },
];

const raw: [string, string, number, number, boolean?][] = [
  ['ws1', '冲压线 1# 机位', 90, 110],
  ['ws1', '冲压线 2# 机位', 260, 110],
  ['ws1', '模具库通道', 180, 220],
  ['ws2', '焊装机器人工位', 430, 100],
  ['ws2', '焊装线东侧', 590, 120],
  ['ws2', '焊烟作业区', 510, 230, false],
  ['ws3', '喷涂房入口', 760, 100],
  ['ws3', '烘干炉巡检口', 900, 200],
  ['ws4', '总装线 A 段', 100, 400],
  ['ws4', '总装线 B 段', 260, 450],
  ['ws4', '下线检测区', 420, 380],
  ['ws4', '高空作业平台', 180, 530, false],
  ['ws5', '叉车主通道', 600, 400],
  ['ws5', '立体库入口', 760, 380],
  ['ws5', '装卸月台 1#', 900, 460],
  ['ws5', '危化品仓库', 680, 530],
];

/** 本地只推了 8 路模拟流，16 个点位循环复用 */
export const STREAM_COUNT = 8;

export const cameras: Camera[] = raw.map(([workshopId, name, x, y, online = true], i) => ({
  id: `c${String(i + 1).padStart(2, '0')}`,
  name,
  workshopId,
  x,
  y,
  online,
  streamId: `cam${String((i % STREAM_COUNT) + 1).padStart(2, '0')}`,
  ip: `192.168.10.${101 + i}`,
}));

export const cameraMap = new Map(cameras.map((c) => [c.id, c]));
export const workshopMap = new Map(workshops.map((w) => [w.id, w]));
