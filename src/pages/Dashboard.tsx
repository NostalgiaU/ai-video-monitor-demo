import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'antd';
import { FullscreenOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { EChartsOption } from 'echarts';
import { useAppStore } from '../store';
import { ALARM_TYPES, LEVEL_META, type AlarmType } from '../mock/alarms';
import { cameraMap, cameras, workshops } from '../mock/devices';
import { useSize } from '../hooks/useSize';
import Chart from '../components/Chart';
import FactoryMap from '../components/FactoryMap';
import styles from './Dashboard.module.css';

const DESIGN_W = 1920;
const DESIGN_H = 1080;
const SLA_MIN = 30;
const axisStyle = { axisLine: { lineStyle: { color: '#2a3c5c' } }, axisLabel: { color: '#8ea2bf' }, splitLine: { lineStyle: { color: '#16233a' } } };
const legendStyle = { textStyle: { color: '#9fb0c8' }, itemWidth: 10, itemHeight: 10 };

function Panel({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className={styles.panel} style={style}>
      <div className={styles.panelTitle}>{title}</div>
      <div className={styles.panelBody}>{children}</div>
    </div>
  );
}

function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** 安全值守大屏：按 1920x1080 设计稿开发，等比缩放适配任意容器 */
export default function Dashboard() {
  const alarms = useAppStore((s) => s.alarms);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { width, height } = useSize(wrapRef);
  const scale = width && height ? Math.min(width / DESIGN_W, height / DESIGN_H) : 0;
  const now = useClock();

  const data = useMemo(() => {
    const todayStart = dayjs().startOf('day').valueOf();
    const yStart = todayStart - 86_400_000;
    const today = alarms.filter((a) => a.time >= todayStart);
    const yesterday = alarms.filter((a) => a.time >= yStart && a.time < todayStart);
    const closedToday = today.filter((a) => a.status === 'closed' && a.closedAt);
    const avgHandle = closedToday.length ? closedToday.reduce((s, a) => s + (a.closedAt! - a.time), 0) / closedToday.length / 60_000 : 0;
    const pending = alarms.filter((a) => a.status === 'pending');

    const hourly = (list: typeof alarms, start: number) => {
      const arr = Array(24).fill(0);
      list.forEach((a) => arr[Math.floor((a.time - start) / 3_600_000)]++);
      return arr;
    };
    const curHour = new Date().getHours();
    const byType = (Object.keys(ALARM_TYPES) as AlarmType[]).map((t) => ({ type: t, value: today.filter((a) => a.type === t).length }));

    const days = Array.from({ length: 7 }, (_, i) => todayStart - (6 - i) * 86_400_000);
    const topTypes = [...byType].sort((a, b) => b.value - a.value).slice(0, 5).map((t) => t.type);
    const weekly = topTypes.map((t) => ({
      type: t,
      data: days.map((d) => alarms.filter((a) => a.type === t && a.time >= d && a.time < d + 86_400_000).length),
    }));

    const weekAgo = todayStart - 6 * 86_400_000;
    const sla = workshops.map((w) => {
      const list = alarms.filter((a) => a.time >= weekAgo && a.status === 'closed' && a.closedAt && cameraMap.get(a.cameraId)?.workshopId === w.id);
      const mins = list.map((a) => (a.closedAt! - a.time) / 60_000);
      return {
        name: w.name,
        avg: mins.length ? mins.reduce((s, m) => s + m, 0) / mins.length : 0,
        rate: mins.length ? (mins.filter((m) => m <= SLA_MIN).length / mins.length) * 100 : 0,
      };
    });

    const heat: Record<string, number> = {};
    today.forEach((a) => (heat[a.cameraId] = (heat[a.cameraId] ?? 0) + 1));

    return {
      today, yesterday, avgHandle, pending, byType, weekly, days, sla, heat,
      todayHourly: hourly(today, todayStart).map((v, i) => (i <= curHour ? v : null)),
      yesterdayHourly: hourly(yesterday, yStart),
      alertCameras: new Set(pending.map((a) => a.cameraId)),
      levels: ([1, 2, 3] as const).map((l) => ({ level: l, value: today.filter((a) => a.level === l).length })),
    };
  }, [alarms]);

  const pieOption = useMemo<EChartsOption>(() => ({
    tooltip: { trigger: 'item' },
    legend: { ...legendStyle, orient: 'vertical', right: 0, top: 'middle' },
    series: [{
      type: 'pie', radius: ['45%', '72%'], center: ['35%', '50%'], itemStyle: { borderColor: '#0b1220', borderWidth: 2 },
      label: { show: false },
      data: data.byType.map((t) => ({ name: ALARM_TYPES[t.type].label, value: t.value, itemStyle: { color: ALARM_TYPES[t.type].color } })),
    }],
  }), [data]);

  const trendOption = useMemo<EChartsOption>(() => ({
    tooltip: { trigger: 'axis' },
    legend: { ...legendStyle, top: 0, right: 0 },
    grid: { left: 36, right: 12, top: 30, bottom: 24 },
    xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, i) => `${i}时`), ...axisStyle },
    yAxis: { type: 'value', ...axisStyle },
    series: [
      { name: '今日', type: 'line', smooth: true, data: data.todayHourly, showSymbol: false, lineStyle: { width: 3, color: '#1f8fff' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(31,143,255,.45)' }, { offset: 1, color: 'rgba(31,143,255,0)' }] } } },
      { name: '昨日', type: 'line', smooth: true, data: data.yesterdayHourly, showSymbol: false, lineStyle: { type: 'dashed', color: '#8ea2bf' } },
    ],
  }), [data]);

  const weeklyOption = useMemo<EChartsOption>(() => ({
    tooltip: { trigger: 'axis' },
    legend: { ...legendStyle, top: 0 },
    grid: { left: 40, right: 12, top: 34, bottom: 24 },
    xAxis: { type: 'category', data: data.days.map((d) => dayjs(d).format('MM-DD')), ...axisStyle },
    yAxis: { type: 'value', ...axisStyle },
    series: data.weekly.map((w) => ({ name: ALARM_TYPES[w.type].label, type: 'bar', stack: 'total', barWidth: 22, data: w.data, itemStyle: { color: ALARM_TYPES[w.type].color } })),
  }), [data]);

  const slaOption = useMemo<EChartsOption>(() => ({
    tooltip: { trigger: 'axis' },
    legend: { ...legendStyle, top: 0 },
    grid: { left: 40, right: 40, top: 34, bottom: 24 },
    xAxis: { type: 'category', data: data.sla.map((s) => s.name), ...axisStyle, axisLabel: { color: '#8ea2bf', fontSize: 11 } },
    yAxis: [
      { type: 'value', name: '分钟', nameTextStyle: { color: '#8ea2bf' }, ...axisStyle },
      { type: 'value', name: '%', max: 100, nameTextStyle: { color: '#8ea2bf' }, ...axisStyle, splitLine: { show: false } },
    ],
    series: [
      { name: '平均处置时长', type: 'bar', barWidth: 18, data: data.sla.map((s) => +s.avg.toFixed(1)), itemStyle: { color: '#36cfc9', borderRadius: [4, 4, 0, 0] },
        markLine: { symbol: 'none', data: [{ yAxis: SLA_MIN, name: 'SLA' }], lineStyle: { color: '#ff4d4f', type: 'dashed' }, label: { formatter: `SLA ${SLA_MIN}min`, color: '#ff4d4f' } } },
      { name: `${SLA_MIN} 分钟内闭环率`, type: 'line', yAxisIndex: 1, data: data.sla.map((s) => +s.rate.toFixed(1)), lineStyle: { color: '#faad14' }, itemStyle: { color: '#faad14' } },
    ],
  }), [data]);

  const levelOption = useMemo<EChartsOption>(() => ({
    grid: { left: 48, right: 40, top: 6, bottom: 6 },
    xAxis: { type: 'value', show: false },
    yAxis: { type: 'category', data: data.levels.map((l) => LEVEL_META[l.level].label), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#9fb0c8' } },
    series: [{ type: 'bar', barWidth: 14, data: data.levels.map((l) => ({ value: l.value, itemStyle: { color: LEVEL_META[l.level].color, borderRadius: 7 } })),
      label: { show: true, position: 'right', color: '#fff' }, showBackground: true, backgroundStyle: { color: '#16233a', borderRadius: 7 } }],
  }), [data]);

  const online = cameras.filter((c) => c.online).length;
  const latest = data.today.slice(0, 14);

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <Button className={styles.fullscreen} size="small" icon={<FullscreenOutlined />} onClick={() => wrapRef.current?.requestFullscreen()}>全屏</Button>
      {scale > 0 && (
        <div className={styles.screen} style={{ width: DESIGN_W, height: DESIGN_H, transform: `translate(-50%, -50%) scale(${scale})` }}>
          <header className={styles.header}>
            <div className={styles.headerSide}>华东智造园区 · {online}/{cameras.length} 路在线</div>
            <h1>智造安全 AI 值守中心</h1>
            <div className={`${styles.headerSide} mono`} style={{ textAlign: 'right' }}>{dayjs(now).format('YYYY-MM-DD dddd HH:mm:ss')}</div>
          </header>
          <div className={styles.body}>
            <div className={styles.col}>
              <div className={styles.kpis}>
                <div className={styles.kpi}><span>今日告警</span><b className="mono">{data.today.length}</b></div>
                <div className={styles.kpi}><span>待处置</span><b className="mono" style={{ color: '#ff4d4f' }}>{data.pending.length}</b></div>
                <div className={styles.kpi}><span>平均处置时长</span><b className="mono" style={{ color: '#36cfc9' }}>{data.avgHandle.toFixed(1)}<small>min</small></b></div>
                <div className={styles.kpi}><span>较昨日</span><b className="mono" style={{ color: data.today.length > data.yesterday.length ? '#ff7a45' : '#52c41a' }}>
                  {data.yesterday.length ? (((data.today.length - data.yesterday.length) / data.yesterday.length) * 100).toFixed(0) : 0}<small>%</small></b></div>
              </div>
              <Panel title="今日告警类型分布" style={{ flex: 1.2 }}><Chart option={pieOption} /></Panel>
              <Panel title="告警等级" style={{ flex: 0.6 }}><Chart option={levelOption} /></Panel>
              <Panel title="各区域处置时效（近 7 天）" style={{ flex: 1.2 }}><Chart option={slaOption} /></Panel>
            </div>
            <div className={styles.col} style={{ flex: 1 }}>
              <Panel title="厂区点位分布 · 今日告警热力" style={{ flex: 1.9 }}>
                <FactoryMap heat={data.heat} alertCameras={data.alertCameras} />
              </Panel>
              <Panel title="24 小时告警趋势" style={{ flex: 1 }}><Chart option={trendOption} /></Panel>
            </div>
            <div className={styles.col}>
              <Panel title="近 7 天告警（Top5 类型）" style={{ flex: 1 }}><Chart option={weeklyOption} /></Panel>
              <Panel title="实时告警" style={{ flex: 1.4 }}>
                <div className={styles.feed}>
                  {latest.map((a) => (
                    <div key={a.id} className={styles.feedItem}>
                      <i style={{ background: LEVEL_META[a.level].color }} />
                      <span className="mono">{dayjs(a.time).format('HH:mm:ss')}</span>
                      <span style={{ color: ALARM_TYPES[a.type].color }}>{ALARM_TYPES[a.type].label}</span>
                      <span className={styles.feedCam}>{cameraMap.get(a.cameraId)?.name}</span>
                      <span className={styles.feedStatus} data-status={a.status}>{a.status === 'pending' ? '待处置' : a.status === 'processing' ? '处置中' : '已闭环'}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
