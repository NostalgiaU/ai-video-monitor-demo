import { useEffect, useRef } from 'react';
import { mulberry32 } from '../../mock/random';

const LABELS = [
  { text: 'person 安全帽✓', color: '#52c41a' },
  { text: 'person 未戴安全帽', color: '#ff4d4f' },
  { text: 'forklift', color: '#1f8fff' },
  { text: 'person 反光衣✓', color: '#52c41a' },
];

/**
 * 模拟算法回传的检测框叠加（真实场景通常通过 WebSocket 推送 / SEI 携带框坐标，
 * 再按 PTS 与画面对齐）。这里用 canvas 绘制随时间平滑移动的框。
 */
export default function DetectionOverlay({ seed }: { seed: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const rand = mulberry32(seed);
    const targets = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => ({
      x: 0.1 + rand() * 0.6,
      y: 0.25 + rand() * 0.4,
      w: 0.08 + rand() * 0.06,
      h: 0.22 + rand() * 0.15,
      vx: (rand() - 0.5) * 0.05,
      phase: rand() * Math.PI * 2,
      label: LABELS[Math.floor(rand() * LABELS.length)],
      score: 0.8 + rand() * 0.19,
    }));
    let raf = 0;
    const draw = (t: number) => {
      const { clientWidth: w, clientHeight: h } = canvas;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.font = '12px sans-serif';
      for (const o of targets) {
        const dx = Math.sin(t / 2000 + o.phase) * 0.08 + o.vx * Math.sin(t / 5000);
        const x = (o.x + dx) * w;
        const y = (o.y + Math.cos(t / 3000 + o.phase) * 0.02) * h;
        const bw = o.w * w;
        const bh = o.h * h;
        ctx.strokeStyle = o.label.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, bw, bh);
        const text = `${o.label.text} ${o.score.toFixed(2)}`;
        const tw = ctx.measureText(text).width + 8;
        ctx.fillStyle = o.label.color;
        ctx.fillRect(x - 1, y - 18, tw, 18);
        ctx.fillStyle = '#fff';
        ctx.fillText(text, x + 3, y - 5);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [seed]);

  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}
