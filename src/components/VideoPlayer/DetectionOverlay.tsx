import { useEffect, useRef, type RefObject } from 'react';

/** [label, trackId, x, y, w, h, score]，坐标按画面宽高归一化 */
type Box = [number, number, number, number, number, number, number];

export interface DetectionTrack {
  fps: number;
  duration: number;
  frames: Box[][];
}

const LABELS = [
  { text: 'person 安全帽✓', color: '#52c41a' },
  { text: 'person 未戴安全帽', color: '#ff4d4f' },
  { text: 'person', color: '#13c2c2' },
  { text: 'vehicle', color: '#1f8fff' },
];

const cache = new Map<string, Promise<DetectionTrack | null>>();

function loadDetections(url: string) {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url)
        .then((r) => (r.ok ? (r.json() as Promise<DetectionTrack>) : null))
        .catch(() => null),
    );
  }
  return cache.get(url)!;
}

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** 离线 YOLO 检测结果（scripts/detect.py 生成） */
  src: string;
  /** 返回当前画面在素材中的时间（秒），默认取 video.currentTime */
  getTime?: (video: HTMLVideoElement, track: DetectionTrack) => number;
}

/**
 * 检测框叠加：按视频时间取对应帧的检测结果，并按 trackId 在相邻采样帧之间插值，
 * 换算到 object-fit: contain 后的实际画面区域绘制。真实系统中框坐标一般由算法服务
 * 通过 WebSocket 推送或 SEI 携带，再按 PTS 与画面对齐，原理相同。
 */
export default function DetectionOverlay({ videoRef, src, getTime }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const getTimeRef = useRef(getTime);
  useEffect(() => {
    getTimeRef.current = getTime;
  }, [getTime]);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let track: DetectionTrack | null = null;
    let raf = 0;
    let disposed = false;
    loadDetections(src).then((t) => {
      if (!disposed) track = t;
    });

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const video = videoRef.current;
      const { clientWidth: cw, clientHeight: ch } = canvas;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
        canvas.width = cw * dpr;
        canvas.height = ch * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      if (!track || !video || !video.videoWidth || !track.frames.length) return;

      const n = track.frames.length;
      const t = getTimeRef.current ? getTimeRef.current(video, track) : video.currentTime;
      const pos = Math.max(0, t * track.fps);
      const i0 = Math.min(Math.floor(pos), n - 1);
      const i1 = Math.min(i0 + 1, n - 1);
      const k = pos - Math.floor(pos);
      const next = new Map(track.frames[i1].filter((b) => b[1] >= 0).map((b) => [b[1], b]));

      const scale = Math.min(cw / video.videoWidth, ch / video.videoHeight);
      const vw = video.videoWidth * scale;
      const vh = video.videoHeight * scale;
      const ox = (cw - vw) / 2;
      const oy = (ch - vh) / 2;

      ctx.font = '12px sans-serif';
      ctx.lineWidth = 2;
      for (const b of track.frames[i0]) {
        const nb = b[1] >= 0 ? next.get(b[1]) : undefined;
        const lerp = (j: number) => (nb ? b[j] + (nb[j] - b[j]) * k : b[j]);
        const x = ox + lerp(2) * vw;
        const y = oy + lerp(3) * vh;
        const w = lerp(4) * vw;
        const h = lerp(5) * vh;
        const label = LABELS[b[0]] ?? LABELS[2];
        ctx.strokeStyle = label.color;
        ctx.strokeRect(x, y, w, h);
        const text = `${b[1] >= 0 ? `#${b[1]} ` : ''}${label.text} ${b[6].toFixed(2)}`;
        const tw = ctx.measureText(text).width + 8;
        const ty = y < oy + 18 ? y : y - 18;
        ctx.fillStyle = label.color;
        ctx.fillRect(x - 1, ty, tw, 18);
        ctx.fillStyle = '#fff';
        ctx.fillText(text, x + 3, ty + 13);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, [src, videoRef]);

  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}
