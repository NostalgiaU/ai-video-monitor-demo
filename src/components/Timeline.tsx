import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { useSize } from '../hooks/useSize';

export interface TimeSegment {
  start: number;
  end: number;
  type: 'record' | 'alarm';
}

interface Props {
  dayStart: number;
  segments: TimeSegment[];
  value: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onSeek: (t: number) => void;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** 可视跨度 / 主刻度 / 次刻度 */
export const ZOOM_LEVELS: { span: number; major: number; minor: number; label: string }[] = [
  { span: DAY, major: 2 * HOUR, minor: 30 * MIN, label: '24h' },
  { span: 12 * HOUR, major: HOUR, minor: 15 * MIN, label: '12h' },
  { span: 6 * HOUR, major: 30 * MIN, minor: 10 * MIN, label: '6h' },
  { span: 2 * HOUR, major: 10 * MIN, minor: 2 * MIN, label: '2h' },
  { span: HOUR, major: 5 * MIN, minor: MIN, label: '1h' },
  { span: 20 * MIN, major: 2 * MIN, minor: 30_000, label: '20min' },
];

const HEIGHT = 84;

/**
 * Canvas 自绘录像时间轴（NVR 风格）：中线固定为当前播放时刻，
 * 拖拽刻度尺平移时间、松手后定位；单击跳转；滚轮缩放。
 */
export default function Timeline({ dayStart, segments, value, zoom, onZoomChange, onSeek }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width } = useSize(wrapRef);
  const [dragCenter, setDragCenter] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const dragRef = useRef<{ x: number; center: number; moved: boolean } | null>(null);

  const { span, major, minor } = ZOOM_LEVELS[zoom];
  const clamp = (t: number) => Math.min(dayStart + DAY, Math.max(dayStart, t));
  const center = clamp(dragCenter ?? value);
  const msPerPx = width ? span / width : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = HEIGHT * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const left = center - span / 2;
    const xOf = (t: number) => (t - left) / msPerPx;

    ctx.fillStyle = '#0d1524';
    ctx.fillRect(0, 0, width, HEIGHT);
    // 当天范围外置灰
    ctx.fillStyle = '#060a12';
    if (xOf(dayStart) > 0) ctx.fillRect(0, 0, xOf(dayStart), HEIGHT);
    if (xOf(dayStart + DAY) < width) ctx.fillRect(xOf(dayStart + DAY), 0, width, HEIGHT);

    // 录像 / 告警片段
    ctx.fillStyle = '#0f2f52';
    ctx.fillRect(0, 34, width, 20);
    for (const type of ['record', 'alarm'] as const) {
      ctx.fillStyle = type === 'record' ? '#1f8fff' : '#ff4d4f';
      for (const s of segments) {
        if (s.type !== type || s.end < left || s.start > left + span) continue;
        const x1 = Math.max(0, xOf(s.start));
        const x2 = Math.min(width, xOf(s.end));
        ctx.fillRect(x1, type === 'record' ? 36 : 34, Math.max(1.5, x2 - x1), type === 'record' ? 16 : 20);
      }
    }

    // 刻度
    ctx.strokeStyle = '#4d6080';
    ctx.fillStyle = '#9fb0c8';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.beginPath();
    for (let t = dayStart + Math.ceil((left - dayStart) / minor) * minor; t <= left + span; t += minor) {
      const x = Math.round(xOf(t)) + 0.5;
      const isMajor = (t - dayStart) % major === 0;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, isMajor ? 14 : 7);
      if (isMajor) ctx.fillText(t - dayStart === DAY ? '24:00' : dayjs(t).format('HH:mm'), x, 27);
    }
    ctx.stroke();

    // 悬停时刻
    if (hoverX !== null && !dragRef.current) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(hoverX + 0.5, 30);
      ctx.lineTo(hoverX + 0.5, 58);
      ctx.stroke();
      const label = dayjs(clamp(left + hoverX * msPerPx)).format('HH:mm:ss');
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(label, Math.min(width - 32, Math.max(32, hoverX)), 70);
    }

    // 中线（当前播放时刻）
    const cx = Math.round(width / 2) + 0.5;
    ctx.strokeStyle = '#faad14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, 60);
    ctx.stroke();
    ctx.lineWidth = 1;
    const label = dayjs(center).format('HH:mm:ss');
    ctx.fillStyle = '#faad14';
    ctx.fillRect(cx - 34, 62, 68, 18);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 12px ui-monospace, Menlo, monospace';
    ctx.fillText(label, cx, 75);
  }, [width, center, span, major, minor, msPerPx, segments, dayStart, hoverX]);

  // wheel 需要 passive: false 才能阻止页面滚动
  useEffect(() => {
    const canvas = canvasRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, zoom + (e.deltaY < 0 ? 1 : -1)));
      if (next !== zoom) onZoomChange(next);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [zoom, onZoomChange]);

  const localX = (e: React.PointerEvent) => e.clientX - e.currentTarget.getBoundingClientRect().left;

  return (
    <div ref={wrapRef} style={{ width: '100%', height: HEIGHT, userSelect: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: HEIGHT, display: 'block', cursor: dragCenter !== null ? 'grabbing' : 'grab', borderRadius: 6 }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = { x: localX(e), center, moved: false };
        }}
        onPointerMove={(e) => {
          const x = localX(e);
          setHoverX(x);
          const d = dragRef.current;
          if (!d) return;
          if (Math.abs(x - d.x) > 3) d.moved = true;
          if (d.moved) setDragCenter(clamp(d.center - (x - d.x) * msPerPx));
        }}
        onPointerUp={(e) => {
          const d = dragRef.current;
          dragRef.current = null;
          if (!d) return;
          if (d.moved && dragCenter !== null) onSeek(dragCenter);
          else onSeek(clamp(center + (localX(e) - width / 2) * msPerPx));
          setDragCenter(null);
        }}
        onPointerLeave={() => setHoverX(null)}
      />
    </div>
  );
}
