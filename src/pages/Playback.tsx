import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Hls from 'hls.js';
import dayjs, { type Dayjs } from 'dayjs';
import { App, Button, DatePicker, Empty, List, Segmented, Space, Tag, Tooltip, Typography } from 'antd';
import {
  CameraOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import DeviceTree from '../components/DeviceTree';
import Timeline, { ZOOM_LEVELS, type TimeSegment } from '../components/Timeline';
import { cameraMap, cameras } from '../mock/devices';
import { ALARM_TYPES, LEVEL_META } from '../mock/alarms';
import { recordSegments } from '../mock/records';
import { useAppStore } from '../store';
import { RECORD_CLIP_COUNT, RECORD_CLIP_SECONDS, detectionUrl, recordHlsUrl } from '../utils/stream';
import DetectionOverlay from '../components/VideoPlayer/DetectionOverlay';
import { downloadDataUrl, fmtTime } from '../utils/format';

const SPEEDS = [0.5, 1, 2, 4, 8];

/**
 * 录像回放：真实环境中由后端（NVR / ZLMediaKit 录像 / GB28181 回放）按时间段生成 HLS 或 FLV 回放地址；
 * 本 Demo 用 3 段本地 HLS 片段循环映射到模拟的 24 小时录像索引上。
 */
export default function Playback() {
  const { message } = App.useApp();
  const [params, setParams] = useSearchParams();
  const cameraId = params.get('cam') ?? cameras[0].id;
  const camera = cameraMap.get(cameraId) ?? cameras[0];
  const initialT = Number(params.get('t')) || 0;
  const [date, setDate] = useState<Dayjs>(() => dayjs(initialT || Date.now()).startOf('day'));
  const dayStart = date.valueOf();
  const allAlarms = useAppStore((s) => s.alarms);

  const records = useMemo(() => recordSegments(camera.id, dayStart), [camera.id, dayStart]);
  const dayAlarms = useMemo(
    () => allAlarms.filter((a) => a.cameraId === camera.id && a.time >= dayStart && a.time < dayStart + 86_400_000),
    [allAlarms, camera.id, dayStart],
  );
  const segments = useMemo<TimeSegment[]>(
    () => [...records, ...dayAlarms.map((a) => ({ start: a.time - 30_000, end: a.time + 90_000, type: 'alarm' as const }))],
    [records, dayAlarms],
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const clipRef = useRef(-1);
  const pendingOffsetRef = useRef<number | null>(null);
  const absRef = useRef(0);
  const lastVTRef = useRef(0);
  const segIdxRef = useRef(-1);
  const [abs, setAbs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(3);
  const [activeClip, setActiveClip] = useState(-1);

  useEffect(() => {
    const video = videoRef.current!;
    if (Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 20 });
      hls.attachMedia(video);
      hlsRef.current = hls;
      return () => {
        hls.destroy();
        hlsRef.current = null;
        clipRef.current = -1;
      };
    }
  }, []);

  const loadClip = useCallback((clip: number, offset: number) => {
    const video = videoRef.current;
    if (!video) return;
    lastVTRef.current = offset;
    if (clipRef.current === clip && video.readyState > 0) {
      video.currentTime = offset;
    } else {
      clipRef.current = clip;
      setActiveClip(clip);
      pendingOffsetRef.current = offset;
      if (hlsRef.current) hlsRef.current.loadSource(recordHlsUrl(clip));
      else video.src = recordHlsUrl(clip);
    }
    video.play().catch(() => {});
  }, []);

  const seek = useCallback(
    (t: number, silent = false) => {
      const idx = records.findIndex((s) => t < s.end);
      if (idx < 0) {
        if (!silent) message.info('该时刻之后暂无录像');
        videoRef.current?.pause();
        return;
      }
      const seg = records[idx];
      if (t < seg.start) {
        if (!silent) message.info(`该时段无录像，已跳转到 ${dayjs(seg.start).format('HH:mm:ss')}`);
        t = seg.start;
      }
      absRef.current = t;
      segIdxRef.current = idx;
      setAbs(t);
      loadClip(idx % RECORD_CLIP_COUNT, ((t - seg.start) / 1000) % RECORD_CLIP_SECONDS);
    },
    [records, loadClip, message],
  );

  // 切换点位 / 日期时定位到 URL 指定时刻，否则定位到最近一段录像
  useEffect(() => {
    if (!records.length) {
      videoRef.current?.pause();
      setAbs(dayStart);
      return;
    }
    const t = initialT && initialT >= dayStart && initialT < dayStart + 86_400_000
      ? initialT
      : Math.max(records[records.length - 1].start, records[records.length - 1].end - 10 * 60_000);
    seek(t, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  useEffect(() => {
    const video = videoRef.current!;
    video.playbackRate = speed;
    video.defaultPlaybackRate = speed;
  }, [speed]);

  const onTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    let delta = video.currentTime - lastVTRef.current;
    lastVTRef.current = video.currentTime;
    if (delta < -1) delta += video.duration || RECORD_CLIP_SECONDS; // 片段循环
    if (delta <= 0 || delta > 1.5 * Math.max(1, speed)) return; // 忽略 seek 跳变
    absRef.current += delta * 1000;
    const seg = records[segIdxRef.current];
    if (seg && absRef.current >= seg.end) {
      const next = records[segIdxRef.current + 1];
      if (next) seek(next.start, true);
      else {
        video.pause();
        message.info('已播放到最新录像');
      }
    }
    setAbs(absRef.current);
  };

  const jumpSegment = (dir: 1 | -1) => {
    const idx = segIdxRef.current + dir;
    if (records[idx]) seek(records[idx].start);
  };

  const snapshot = () => {
    const video = videoRef.current!;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    downloadDataUrl(canvas.toDataURL('image/png'), `${camera.name}-${dayjs(abs).format('YYYYMMDD-HHmmss')}.png`);
  };

  return (
    <div className="page" style={{ flexDirection: 'row' }}>
      <DeviceTree selectedId={camera.id} onSelect={(c) => setParams({ cam: c.id })} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        <div className="panel" style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000', minHeight: 0 }}>
          <video
            ref={videoRef}
            muted
            playsInline
            loop
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              if (pendingOffsetRef.current !== null) {
                video.currentTime = pendingOffsetRef.current;
                pendingOffsetRef.current = null;
              }
              video.playbackRate = speed;
            }}
            onTimeUpdate={onTimeUpdate}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
          {activeClip >= 0 && records.length > 0 && <DetectionOverlay videoRef={videoRef} src={detectionUrl(`clip0${activeClip + 1}`)} />}
          <div className="mono" style={{ position: 'absolute', left: 12, top: 10, padding: '4px 10px', background: 'rgba(0,0,0,.55)', borderRadius: 4, fontSize: 13 }}>
            {camera.name} · {fmtTime(abs)} {speed !== 1 && <Tag color="gold" style={{ marginLeft: 6 }}>{speed}x</Tag>}
          </div>
          {!records.length && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Empty description="当天无录像" />
            </div>
          )}
        </div>
        <div className="panel" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <DatePicker
              value={date}
              allowClear={false}
              disabledDate={(d) => d.isAfter(dayjs(), 'day') || d.isBefore(dayjs().subtract(7, 'day'), 'day')}
              onChange={(d) => {
                if (d) setDate(d.startOf('day'));
                setParams({ cam: camera.id });
              }}
            />
            <Space size={4}>
              <Tooltip title="上一段">
                <Button icon={<StepBackwardOutlined />} onClick={() => jumpSegment(-1)} />
              </Tooltip>
              <Button
                type="primary"
                icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={() => (playing ? videoRef.current!.pause() : videoRef.current!.play())}
              >
                {playing ? '暂停' : '播放'}
              </Button>
              <Tooltip title="下一段">
                <Button icon={<StepForwardOutlined />} onClick={() => jumpSegment(1)} />
              </Tooltip>
            </Space>
            <Segmented value={speed} onChange={setSpeed} options={SPEEDS.map((s) => ({ label: `${s}x`, value: s }))} />
            <Button icon={<CameraOutlined />} onClick={snapshot}>截图</Button>
            <div style={{ flex: 1 }} />
            <Space size={4}>
              <Button size="small" icon={<ZoomOutOutlined />} disabled={zoom === 0} onClick={() => setZoom(zoom - 1)} />
              <Typography.Text className="mono" style={{ width: 44, textAlign: 'center', display: 'inline-block' }}>
                {ZOOM_LEVELS[zoom].label}
              </Typography.Text>
              <Button size="small" icon={<ZoomInOutlined />} disabled={zoom === ZOOM_LEVELS.length - 1} onClick={() => setZoom(zoom + 1)} />
            </Space>
            <Space size={12} style={{ fontSize: 12 }}>
              <span><i style={{ display: 'inline-block', width: 10, height: 10, background: '#1f8fff', marginRight: 4 }} />录像</span>
              <span><i style={{ display: 'inline-block', width: 10, height: 10, background: '#ff4d4f', marginRight: 4 }} />告警</span>
            </Space>
          </div>
          <Timeline dayStart={dayStart} segments={segments} value={abs} zoom={zoom} onZoomChange={setZoom} onSeek={(t) => seek(t)} />
        </div>
      </div>
      <div className="panel" style={{ width: 260, flex: 'none', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: 10, borderBottom: '1px solid #1d2a40' }}>
          <Typography.Text strong>当天告警事件（{dayAlarms.length}）</Typography.Text>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <List
            size="small"
            dataSource={dayAlarms}
            locale={{ emptyText: '无告警' }}
            renderItem={(a) => (
              <List.Item style={{ cursor: 'pointer', padding: '8px 12px' }} onClick={() => seek(a.time - 10_000)}>
                <Space orientation="vertical" size={2}>
                  <Space size={6}>
                    <Tag color={LEVEL_META[a.level].color} style={{ marginInlineEnd: 0 }}>{LEVEL_META[a.level].label}</Tag>
                    {ALARM_TYPES[a.type].label}
                  </Space>
                  <Typography.Text type="secondary" className="mono" style={{ fontSize: 12 }}>{fmtTime(a.time, 'HH:mm:ss')}</Typography.Text>
                </Space>
              </List.Item>
            )}
          />
        </div>
      </div>
    </div>
  );
}
