import { useMemo } from 'react';
import { ALARM_TYPES, type Alarm } from '../mock/alarms';
import { sceneImage } from '../mock/scene';

/** 抓拍图 + 检测框叠加（框坐标为算法回传的归一化坐标，按百分比定位，图片缩放时自适应） */
export default function AlarmSnapshot({ alarm, showLabel = true }: { alarm: Alarm; showLabel?: boolean }) {
  const { url } = useMemo(() => sceneImage(alarm.seed, alarm.type), [alarm.seed, alarm.type]);
  const [x, y, w, h] = alarm.box;
  const meta = ALARM_TYPES[alarm.type];
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#000', overflow: 'hidden', borderRadius: 4 }}>
      <img src={url} alt={meta.label} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', display: 'block' }} />
      <div
        style={{
          position: 'absolute',
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: `${w * 100}%`,
          height: `${h * 100}%`,
          border: `2px solid ${meta.color}`,
          boxShadow: `0 0 8px ${meta.color}`,
        }}
      >
        {showLabel && (
          <span style={{ position: 'absolute', left: -2, bottom: '100%', whiteSpace: 'nowrap', background: meta.color, color: '#fff', fontSize: 12, padding: '1px 6px' }}>
            {meta.label} {(alarm.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}
