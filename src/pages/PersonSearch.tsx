import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Checkbox, Empty, Modal, Select, Slider, Space, Spin, Tag, Typography } from 'antd';
import { CaretRightOutlined, NodeIndexOutlined, PauseOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { cameraMap, cameras, workshops } from '../mock/devices';
import { hashString, mulberry32, pick } from '../mock/random';
import { personImage, personSpec } from '../mock/scene';
import { useSize } from '../hooks/useSize';
import FactoryMap from '../components/FactoryMap';
import { fmtTime } from '../utils/format';

interface Result {
  id: string;
  seed: number;
  cameraId: string;
  time: number;
  score: number;
  ratio: number;
  helmet: boolean;
  vest: boolean;
}

const TOTAL = 3000;
const PAGE = 200;
const GAP = 12;
const MIN_COL = 190;
const INFO_H = 52;
const OVERSCAN = 600;

function searchResults(key: string): Result[] {
  const rand = mulberry32(hashString(key));
  const now = Date.now();
  const online = cameras.filter((c) => c.online);
  return Array.from({ length: TOTAL }, (_, i) => {
    const seed = Math.floor(rand() * 1e9);
    const spec = personSpec(seed);
    return {
      id: `P${String(i + 1).padStart(5, '0')}`,
      seed,
      cameraId: pick(rand, online).id,
      time: now - rand() * 24 * 3600_000,
      score: 0.98 - (i / TOTAL) * 0.35 - rand() * 0.02,
      ratio: spec.ratio,
      helmet: !!spec.helmet,
      vest: spec.vest,
    };
  });
}

const ResultCard = memo(function ResultCard({ item, checked, onToggle }: { item: Result; checked: boolean; onToggle: (id: string) => void }) {
  const { url } = useMemo(() => personImage(item.seed), [item.seed]);
  return (
    <div
      onClick={() => onToggle(item.id)}
      style={{
        height: '100%', borderRadius: 6, overflow: 'hidden', cursor: 'pointer', background: '#111a2b',
        border: `1px solid ${checked ? '#1f8fff' : '#1d2a40'}`, boxShadow: checked ? '0 0 0 1px #1f8fff' : undefined,
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <img src={url} loading="lazy" decoding="async" alt={item.id} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <Checkbox checked={checked} style={{ position: 'absolute', left: 8, top: 6 }} />
        <Tag color={item.score > 0.85 ? 'green' : item.score > 0.75 ? 'gold' : 'default'} style={{ position: 'absolute', right: 2, top: 6 }}>
          {(item.score * 100).toFixed(1)}%
        </Tag>
      </div>
      <div style={{ height: INFO_H, padding: '6px 8px', fontSize: 12, lineHeight: '20px' }}>
        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cameraMap.get(item.cameraId)?.name}</div>
        <div className="mono" style={{ color: '#8ea2bf' }}>{fmtTime(item.time, 'MM-DD HH:mm:ss')}</div>
      </div>
    </div>
  );
});

function TrackModal({ items, onClose }: { items: Result[]; onClose: () => void }) {
  const track = useMemo(() => [...items].sort((a, b) => a.time - b.time), [items]);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const max = Math.max(0, track.length - 1);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setProgress((p) => {
        const next = Math.min(max, p + dt * 0.6);
        if (next >= max) setPlaying(false);
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, max]);

  const current = Math.round(progress);
  return (
    <Modal open width={1200} footer={null} onCancel={onClose} title={`人员轨迹回放（${track.length} 个抓拍点）`}>
      <div style={{ display: 'flex', gap: 16, height: 560 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="panel" style={{ flex: 1, padding: 8 }}>
            <FactoryMap track={track.map((t) => ({ cameraId: t.cameraId, time: t.time }))} progress={progress} />
          </div>
          <Space style={{ width: '100%' }}>
            <Button
              type="primary"
              icon={playing ? <PauseOutlined /> : <CaretRightOutlined />}
              onClick={() => {
                if (!playing && progress >= max) setProgress(0);
                setPlaying(!playing);
              }}
            >
              {playing ? '暂停' : '播放'}
            </Button>
            <Slider style={{ width: 600 }} min={0} max={max} step={0.01} value={progress}
              tooltip={{ formatter: (v) => fmtTime(track[Math.round(v ?? 0)]?.time ?? 0, 'HH:mm:ss') }}
              onChange={(v) => { setPlaying(false); setProgress(v); }} />
          </Space>
        </div>
        <div style={{ width: 280, overflow: 'auto' }}>
          {track.map((t, i) => (
            <div key={t.id} onClick={() => { setPlaying(false); setProgress(i); }}
              style={{ display: 'flex', gap: 10, padding: 8, borderRadius: 6, cursor: 'pointer', background: i === current ? '#15325a' : undefined, opacity: i <= current ? 1 : 0.5 }}>
              <img src={personImage(t.seed).url} style={{ width: 48, height: 64, objectFit: 'cover', borderRadius: 4 }} />
              <div style={{ fontSize: 12, lineHeight: '20px' }}>
                <div><Tag color="cyan">{i + 1}</Tag>{cameraMap.get(t.cameraId)?.name}</div>
                <div className="mono" style={{ color: '#8ea2bf' }}>{fmtTime(t.time, 'HH:mm:ss')}</div>
                <div style={{ color: '#8ea2bf' }}>相似度 {(t.score * 100).toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/**
 * 人员检索：3000 条结果的「虚拟瀑布流」。
 * 先用宽高比做纯数学布局（最短列优先），滚动时只渲染视口 ± OVERSCAN 内的卡片，图片懒加载 + 异步解码。
 */
export default function PersonSearch() {
  const [helmet, setHelmet] = useState('any');
  const [vest, setVest] = useState('any');
  const [area, setArea] = useState<string>();
  const [threshold, setThreshold] = useState(70);
  const [query, setQuery] = useState('any-any-init');
  const [loaded, setLoaded] = useState(PAGE);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showTrack, setShowTrack] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { width, height } = useSize(scrollRef);
  const [scrollTop, setScrollTop] = useState(0);

  const all = useMemo(() => {
    const [h, v] = query.split('-');
    return searchResults(query).filter(
      (r) =>
        r.score * 100 >= threshold &&
        (!area || cameraMap.get(r.cameraId)?.workshopId === area) &&
        (h === 'any' || r.helmet === (h === 'yes')) &&
        (v === 'any' || r.vest === (v === 'yes')),
    );
  }, [query, threshold, area]);
  const items = useMemo(() => all.slice(0, loaded), [all, loaded]);

  const layout = useMemo(() => {
    const cols = Math.max(1, Math.floor((width + GAP) / (MIN_COL + GAP)));
    const colW = (width - GAP * (cols - 1)) / cols;
    const heights = Array<number>(cols).fill(0);
    const pos = items.map((it) => {
      const col = heights.indexOf(Math.min(...heights));
      const h = colW * it.ratio + INFO_H;
      const p = { x: col * (colW + GAP), y: heights[col], w: colW, h };
      heights[col] += h + GAP;
      return p;
    });
    return { pos, total: Math.max(0, ...heights) };
  }, [items, width]);

  const visible = useMemo(
    () => layout.pos.map((p, i) => ({ p, i })).filter(({ p }) => p.y < scrollTop + height + OVERSCAN && p.y + p.h > scrollTop - OVERSCAN),
    [layout, scrollTop, height],
  );

  // 触底加载下一页（模拟分页接口）
  useEffect(() => {
    if (loading || loaded >= all.length || !height) return;
    if (scrollTop + height > layout.total - 800) {
      setLoading(true);
      const t = setTimeout(() => {
        setLoaded((n) => n + PAGE);
        setLoading(false);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [scrollTop, height, layout.total, loaded, all.length, loading]);

  const rafRef = useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setScrollTop(scrollRef.current!.scrollTop));
  };

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const doSearch = () => {
    setQuery(`${helmet}-${vest}-${Date.now()}`);
    setLoaded(PAGE);
    setSelected(new Set());
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const trackItems = selected.size >= 2 ? all.filter((r) => selected.has(r.id)) : all.slice(0, 10);

  return (
    <div className="page">
      <div className="panel" style={{ padding: 12, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <Space>安全帽<Select value={helmet} onChange={setHelmet} style={{ width: 100 }} options={[{ label: '不限', value: 'any' }, { label: '佩戴', value: 'yes' }, { label: '未佩戴', value: 'no' }]} /></Space>
        <Space>反光衣<Select value={vest} onChange={setVest} style={{ width: 100 }} options={[{ label: '不限', value: 'any' }, { label: '穿着', value: 'yes' }, { label: '未穿', value: 'no' }]} /></Space>
        <Select allowClear placeholder="区域" value={area} onChange={(v) => { setArea(v); setLoaded(PAGE); }} style={{ width: 130 }} options={workshops.map((w) => ({ label: w.name, value: w.id }))} />
        <Space>相似度 ≥<Slider style={{ width: 140 }} min={60} max={95} value={threshold} onChange={(v) => { setThreshold(v); setLoaded(PAGE); }} /><span className="mono">{threshold}%</span></Space>
        <Button type="primary" icon={<SearchOutlined />} onClick={doSearch}>检索</Button>
        <div style={{ flex: 1 }} />
        <Typography.Text type="secondary" className="mono" style={{ fontSize: 12 }}>
          命中 {all.length} · 已加载 {items.length} · 渲染 DOM {visible.length}
        </Typography.Text>
        <Button icon={<NodeIndexOutlined />} disabled={!all.length} onClick={() => setShowTrack(true)}>
          轨迹回放{selected.size >= 2 ? `（已选 ${selected.size}）` : '（Top10）'}
        </Button>
      </div>
      <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflow: 'auto', minHeight: 0, paddingRight: 4 }}>
        {!all.length ? (
          <Empty style={{ marginTop: 120 }} description="无匹配结果" />
        ) : (
          <div style={{ position: 'relative', height: layout.total + 60 }}>
            {visible.map(({ p, i }) => (
              <div key={items[i].id} style={{ position: 'absolute', transform: `translate(${p.x}px, ${p.y}px)`, width: p.w, height: p.h }}>
                <ResultCard item={items[i]} checked={selected.has(items[i].id)} onToggle={toggle} />
              </div>
            ))}
            <div style={{ position: 'absolute', top: layout.total + 12, left: 0, right: 0, textAlign: 'center', color: '#8ea2bf' }}>
              {loading ? <Spin size="small" /> : loaded >= all.length ? `已全部加载（${dayjs().format('HH:mm')}）` : ''}
            </div>
          </div>
        )}
      </div>
      {showTrack && <TrackModal items={trackItems} onClose={() => setShowTrack(false)} />}
    </div>
  );
}
