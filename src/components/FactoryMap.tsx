import { cameras, workshops, cameraMap } from '../mock/devices';
import styles from './FactoryMap.module.css';

export interface TrackPoint {
  cameraId: string;
  time: number;
}

interface Props {
  /** 点位告警数量，决定热力圈大小 */
  heat?: Record<string, number>;
  /** 存在待处置告警的点位（闪烁） */
  alertCameras?: Set<string>;
  track?: TrackPoint[];
  /** 轨迹播放进度：已走过的点数（可为小数） */
  progress?: number;
  onCameraClick?: (cameraId: string) => void;
  dark?: boolean;
}

/** 厂区平面图（SVG），用于点位分布与人员轨迹回放 */
export default function FactoryMap({ heat, alertCameras, track, progress = 0, onCameraClick }: Props) {
  const maxHeat = heat ? Math.max(1, ...Object.values(heat)) : 1;
  const pts = (track ?? []).map((p) => cameraMap.get(p.cameraId)!).filter(Boolean);
  const done = Math.floor(progress);
  const frac = progress - done;
  const walked = pts.slice(0, done + 1);
  let head: { x: number; y: number } | null = null;
  if (pts.length) {
    const a = pts[Math.min(done, pts.length - 1)];
    const b = pts[Math.min(done + 1, pts.length - 1)];
    head = { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
  }

  return (
    <svg viewBox="0 0 1000 600" className={styles.map} preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="fm-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#16233a" strokeWidth="1" />
        </pattern>
        <marker id="fm-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0L10 5L0 10z" fill="#36cfc9" />
        </marker>
      </defs>
      <rect width="1000" height="600" fill="url(#fm-grid)" />
      <rect x="0" y="290" width="1000" height="22" fill="#132036" />
      <rect x="495" y="0" width="22" height="600" fill="#132036" opacity="0.6" />
      {workshops.map((w) => (
        <g key={w.id}>
          <rect x={w.x} y={w.y} width={w.w} height={w.h} rx="6" className={styles.workshop} />
          <text x={w.x + 12} y={w.y + 24} className={styles.wsName}>{w.name}</text>
        </g>
      ))}
      {heat &&
        cameras.map((c) => {
          const v = heat[c.id] ?? 0;
          if (!v) return null;
          return <circle key={`h-${c.id}`} cx={c.x} cy={c.y} r={12 + (v / maxHeat) * 38} className={styles.heat} />;
        })}
      {pts.length > 1 && (
        <>
          <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} className={styles.trackAll} />
          <polyline
            points={[...walked.map((p) => `${p.x},${p.y}`), head ? `${head.x},${head.y}` : ''].join(' ')}
            className={styles.trackDone}
            markerMid="url(#fm-arrow)"
          />
        </>
      )}
      {cameras.map((c) => (
        <g key={c.id} transform={`translate(${c.x},${c.y})`} className={styles.camera} onClick={() => onCameraClick?.(c.id)}>
          {alertCameras?.has(c.id) && <circle r="10" className={styles.pulse} />}
          <circle r="7" fill={!c.online ? '#595959' : alertCameras?.has(c.id) ? '#ff4d4f' : '#1f8fff'} stroke="#0b1220" strokeWidth="2" />
          <text y="22" className={styles.camName}>{c.name}</text>
        </g>
      ))}
      {track?.map((p, i) => {
        const c = cameraMap.get(p.cameraId)!;
        return i <= done ? (
          <text key={`n-${i}`} x={c.x + 10} y={c.y - 10} className={styles.order}>{i + 1}</text>
        ) : null;
      })}
      {head && (
        <g transform={`translate(${head.x},${head.y})`}>
          <circle r="16" className={styles.headPulse} />
          <circle r="8" fill="#36cfc9" stroke="#fff" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}
