import { useEffect, useRef, useState } from 'react';
import mpegts from 'mpegts.js';
import { Button, Space, Tooltip } from 'antd';
import { CameraOutlined, CloseOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons';
import type { Camera } from '../../mock/devices';
import { useAppStore } from '../../store';
import { useInViewport } from '../../hooks/useInViewport';
import { demoUrl, liveUrl } from '../../utils/stream';
import { downloadDataUrl } from '../../utils/format';
import { hashString } from '../../mock/random';
import DetectionOverlay from './DetectionOverlay';
import styles from './VideoPlayer.module.css';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'reconnecting' | 'offline';

export interface PlayerStats {
  latency: number;
  fps: number;
  kbps: number;
  dropped: number;
}

interface Props {
  camera: Camera;
  showDetection?: boolean;
  onClose?: () => void;
  onStats?: (stats: PlayerStats | null) => void;
}

/** 超过该延迟（秒）时跳帧追到最新 */
const JUMP_LATENCY = 2.5;
/** 超过该延迟（秒）时加速播放平滑追帧 */
const CHASE_LATENCY = 1.2;
const TARGET_LATENCY = 0.4;

export default function VideoPlayer({ camera, showDetection, onClose, onStats }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { mode, protocol, mediaHost } = useAppStore();
  // 不在可视区或页面切到后台时直接销毁播放器，释放解码器与网络连接
  const visible = useInViewport(wrapRef);
  const onStatsRef = useRef(onStats);
  onStatsRef.current = onStats;

  useEffect(() => {
    onStatsRef.current?.(status === 'playing' ? stats : null);
  }, [stats, status]);

  useEffect(() => {
    const video = videoRef.current!;
    if (!camera.online) {
      setStatus('offline');
      return;
    }
    if (!visible) {
      setStatus('idle');
      setStats(null);
      return;
    }

    let disposed = false;
    let player: mpegts.Player | null = null;
    let retry = 0;
    let retryTimer = 0;
    let lastFrames = 0;
    let kbps = 0;

    const onPlaying = () => {
      retry = 0;
      setStatus('playing');
    };
    video.addEventListener('playing', onPlaying);

    const destroyPlayer = () => {
      if (!player) return;
      player.pause();
      player.unload();
      player.detachMediaElement();
      player.destroy();
      player = null;
    };

    const scheduleReconnect = () => {
      destroyPlayer();
      if (disposed) return;
      setStatus('reconnecting');
      // 指数退避重连：1s, 2s, 4s ... 最长 15s
      retryTimer = window.setTimeout(create, Math.min(1000 * 2 ** retry++, 15_000));
    };

    function create() {
      setStatus((s) => (s === 'reconnecting' ? s : 'loading'));
      if (mode === 'demo') {
        video.src = demoUrl(camera);
        video.loop = true;
        video.play().catch(() => {});
        return;
      }
      player = mpegts.createPlayer(
        { type: 'flv', isLive: true, hasAudio: false, url: liveUrl(camera, protocol, mediaHost) },
        {
          enableWorker: true,
          enableStashBuffer: false,
          stashInitialSize: 128,
          lazyLoad: false,
          autoCleanupSourceBuffer: true,
          autoCleanupMaxBackwardDuration: 10,
          autoCleanupMinBackwardDuration: 5,
        },
      );
      player.on(mpegts.Events.ERROR, scheduleReconnect);
      player.on(mpegts.Events.LOADING_COMPLETE, scheduleReconnect);
      player.on(mpegts.Events.STATISTICS_INFO, (info: mpegts.MSEPlayerStatisticsInfo) => {
        kbps = (info.speed ?? 0) * 8;
      });
      player.attachMediaElement(video);
      player.load();
      Promise.resolve(player.play()).catch(() => {});
    }

    // 每秒采样：计算缓冲延迟并追帧，统计帧率
    const ticker = window.setInterval(() => {
      const q = video.getVideoPlaybackQuality?.();
      const frames = q?.totalVideoFrames ?? 0;
      const fps = Math.max(0, frames - lastFrames);
      lastFrames = frames;
      let latency = 0;
      if (mode === 'live' && video.buffered.length) {
        const end = video.buffered.end(video.buffered.length - 1);
        latency = end - video.currentTime;
        if (latency > JUMP_LATENCY) {
          video.currentTime = end - TARGET_LATENCY;
        } else if (latency > CHASE_LATENCY) {
          video.playbackRate = 1.25;
        } else if (latency < TARGET_LATENCY + 0.2) {
          video.playbackRate = 1;
        }
      }
      setStats({ latency, fps, kbps: Math.round(kbps), dropped: q?.droppedVideoFrames ?? 0 });
    }, 1000);

    create();

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      clearInterval(ticker);
      video.removeEventListener('playing', onPlaying);
      destroyPlayer();
      video.pause();
      video.removeAttribute('src');
      video.load();
      setStats(null);
    };
  }, [camera, visible, mode, protocol, mediaHost, reloadKey]);

  const snapshot = () => {
    const video = videoRef.current!;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    downloadDataUrl(canvas.toDataURL('image/png'), `${camera.name}-${Date.now()}.png`);
  };

  return (
    <div ref={wrapRef} className={styles.player}>
      <video ref={videoRef} className={styles.video} muted playsInline />
      {status === 'playing' && showDetection && <DetectionOverlay seed={hashString(camera.id)} />}
      <div className={styles.topBar}>
        <span className={styles.title}>
          <i className={styles.dot} data-status={status} />
          {camera.name}
        </span>
        <Space size={2} className={styles.actions}>
          <Tooltip title="截图">
            <Button size="small" type="text" icon={<CameraOutlined />} onClick={snapshot} disabled={status !== 'playing'} />
          </Tooltip>
          <Tooltip title="重新拉流">
            <Button size="small" type="text" icon={<ReloadOutlined />} onClick={() => setReloadKey((k) => k + 1)} />
          </Tooltip>
          {onClose && (
            <Tooltip title="关闭">
              <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} />
            </Tooltip>
          )}
        </Space>
      </div>
      {status === 'playing' && stats && (
        <div className={`${styles.stats} mono`}>
          {mode === 'live' && (
            <span style={{ color: stats.latency > CHASE_LATENCY ? '#faad14' : '#52c41a' }}>
              延迟 {stats.latency.toFixed(2)}s
            </span>
          )}
          <span>{stats.fps}fps</span>
          {mode === 'live' && <span>{stats.kbps}kbps</span>}
        </div>
      )}
      {status !== 'playing' && (
        <div className={styles.mask}>
          {status === 'offline' && '设备离线'}
          {status === 'loading' && (
            <>
              <LoadingOutlined /> 拉流中...
            </>
          )}
          {status === 'reconnecting' && (
            <>
              <LoadingOutlined /> 连接断开，重连中...
            </>
          )}
          {status === 'idle' && '不在可视区，已暂停'}
        </div>
      )}
    </div>
  );
}
