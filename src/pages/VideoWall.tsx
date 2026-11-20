import { useCallback, useRef, useState } from 'react';
import { App, Button, Segmented, Space, Switch, Tooltip, Typography } from 'antd';
import { ClearOutlined, FullscreenOutlined, PlaySquareOutlined } from '@ant-design/icons';
import DeviceTree, { CAMERA_DRAG_TYPE } from '../components/DeviceTree';
import VideoPlayer, { type PlayerStats } from '../components/VideoPlayer';
import { cameraMap, cameras, type Camera } from '../mock/devices';
import styles from './VideoWall.module.css';

type Split = 1 | 4 | 9 | 16;
const CELL_DRAG_TYPE = 'application/x-cell-index';
const MAX_CELLS = 16;

export default function VideoWall() {
  const { message } = App.useApp();
  const [split, setSplit] = useState<Split>(4);
  const [cells, setCells] = useState<(string | null)[]>(() => {
    const init = Array<string | null>(MAX_CELLS).fill(null);
    cameras.filter((c) => c.online).slice(0, 4).forEach((c, i) => (init[i] = c.id));
    return init;
  });
  const [active, setActive] = useState(0);
  const [maximized, setMaximized] = useState<number | null>(null);
  const [showDetection, setShowDetection] = useState(true);
  const [stats, setStats] = useState<Record<number, PlayerStats | null>>({});
  const gridRef = useRef<HTMLDivElement>(null);

  const playIn = (index: number, camera: Camera) => {
    if (!camera.online) return message.warning(`${camera.name} 离线`);
    setCells((prev) => {
      const next = [...prev];
      const exist = next.indexOf(camera.id);
      if (exist >= 0 && exist !== index) next[exist] = next[index];
      next[index] = camera.id;
      return next;
    });
  };

  const onTreeSelect = (camera: Camera) => {
    playIn(active, camera);
    setActive((a) => (a + 1) % split);
  };

  const onDrop = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    const camId = e.dataTransfer.getData(CAMERA_DRAG_TYPE);
    if (camId) return playIn(index, cameraMap.get(camId)!);
    const from = e.dataTransfer.getData(CELL_DRAG_TYPE);
    if (from !== '') {
      const f = Number(from);
      setCells((prev) => {
        const next = [...prev];
        [next[f], next[index]] = [next[index], next[f]];
        return next;
      });
    }
  };

  const fillAll = () => {
    const online = cameras.filter((c) => c.online).slice(0, split);
    setCells((prev) => prev.map((_, i) => online[i]?.id ?? null));
  };

  const updateStats = useCallback((i: number, s: PlayerStats | null) => {
    setStats((prev) => (prev[i] === s ? prev : { ...prev, [i]: s }));
  }, []);

  const visibleIndexes = maximized !== null ? [maximized] : Array.from({ length: split }, (_, i) => i);
  const cols = Math.sqrt(maximized !== null ? 1 : split);
  const playing = visibleIndexes.map((i) => stats[i]).filter((s): s is PlayerStats => !!s);
  const totalKbps = playing.reduce((sum, s) => sum + s.kbps, 0);
  const avgLatency = playing.length ? playing.reduce((sum, s) => sum + s.latency, 0) / playing.length : 0;

  return (
    <div className="page" style={{ flexDirection: 'row' }}>
      <DeviceTree draggable onSelect={onTreeSelect} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        <div className="panel" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Segmented<Split>
            value={split}
            onChange={(v) => {
              setSplit(v);
              setMaximized(null);
              setActive((a) => Math.min(a, v - 1));
            }}
            options={[
              { label: '1 分屏', value: 1 },
              { label: '4 分屏', value: 4 },
              { label: '9 分屏', value: 9 },
              { label: '16 分屏', value: 16 },
            ]}
          />
          <Space>
            <Switch size="small" checked={showDetection} onChange={setShowDetection} />
            <span>AI 检测框叠加</span>
          </Space>
          <div style={{ flex: 1 }} />
          <Typography.Text type="secondary" className="mono" style={{ fontSize: 12 }}>
            播放 {playing.length} 路 · 总码率 {(totalKbps / 1000).toFixed(2)} Mbps · 平均延迟 {avgLatency.toFixed(2)}s
          </Typography.Text>
          <Space>
            <Tooltip title="按顺序填满当前分屏">
              <Button icon={<PlaySquareOutlined />} onClick={fillAll}>一键播放</Button>
            </Tooltip>
            <Button icon={<ClearOutlined />} onClick={() => setCells(Array(MAX_CELLS).fill(null))}>全部关闭</Button>
            <Button icon={<FullscreenOutlined />} onClick={() => gridRef.current?.requestFullscreen()}>全屏</Button>
          </Space>
        </div>
        <div ref={gridRef} className={styles.grid} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${cols}, 1fr)` }}>
          {visibleIndexes.map((i) => {
            const cam = cells[i] ? cameraMap.get(cells[i]!) : undefined;
            return (
              <div
                key={i}
                className={styles.cell}
                data-active={active === i}
                onClick={() => setActive(i)}
                onDoubleClick={() => setMaximized((m) => (m === null ? i : null))}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(i, e)}
                draggable={!!cam}
                onDragStart={(e) => e.dataTransfer.setData(CELL_DRAG_TYPE, String(i))}
              >
                {cam ? (
                  <VideoPlayer
                    camera={cam}
                    showDetection={showDetection}
                    onClose={() => setCells((prev) => prev.map((c, idx) => (idx === i ? null : c)))}
                    onStats={(s) => updateStats(i, s)}
                  />
                ) : (
                  <div className={styles.empty}>
                    <span className={styles.index}>{i + 1}</span>
                    拖拽点位到此处播放
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
