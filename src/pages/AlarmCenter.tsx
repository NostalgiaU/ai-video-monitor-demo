import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  App, Button, Card, Descriptions, Drawer, Input, Select, Space, Statistic, Steps, Tag, Timeline, Typography,
} from 'antd';
import { CheckOutlined, PlayCircleOutlined, SearchOutlined, StopOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAppStore } from '../store';
import { ALARM_TYPES, LEVEL_META, STATUS_META, type Alarm, type AlarmLevel, type AlarmStatus, type AlarmType } from '../mock/alarms';
import { cameraMap, cameras, workshopMap } from '../mock/devices';
import AlarmSnapshot from '../components/AlarmSnapshot';
import { fmtDuration, fmtTime } from '../utils/format';
import styles from './AlarmCenter.module.css';

const ROW_HEIGHT = 68;
const OPERATORS = ['张伟', '李娜', '王强', '刘洋', '陈静', '赵磊'];
const COLUMNS = '84px 110px 1.2fr 70px 1.4fr 170px 80px 90px 90px';

function AlarmRow({ alarm, onOpen }: { alarm: Alarm; onOpen: () => void }) {
  const cam = cameraMap.get(alarm.cameraId)!;
  const meta = ALARM_TYPES[alarm.type];
  return (
    <div className={styles.row} style={{ gridTemplateColumns: COLUMNS }} data-new={Date.now() - alarm.time < 60_000} onClick={onOpen}>
      <div style={{ width: 80 }}>
        <AlarmSnapshot alarm={alarm} showLabel={false} />
      </div>
      <span className="mono">{alarm.id}</span>
      <span><Tag color={meta.color}>{meta.label}</Tag></span>
      <span style={{ color: LEVEL_META[alarm.level].color }}>{LEVEL_META[alarm.level].label}</span>
      <span className={styles.ellipsis}>{workshopMap.get(cam.workshopId)?.name} / {cam.name}</span>
      <span className="mono">{fmtTime(alarm.time)}</span>
      <span className="mono">{(alarm.confidence * 100).toFixed(1)}%</span>
      <span><Tag color={STATUS_META[alarm.status].color}>{STATUS_META[alarm.status].label}</Tag></span>
      <span><Button size="small" type="link" onClick={onOpen}>详情</Button></span>
    </div>
  );
}

function AlarmDetail({ alarm, onClose }: { alarm: Alarm | undefined; onClose: () => void }) {
  const updateAlarm = useAppStore((s) => s.updateAlarm);
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [operator, setOperator] = useState(OPERATORS[0]);
  const [remark, setRemark] = useState('');
  if (!alarm) return <Drawer open={false} />;
  const cam = cameraMap.get(alarm.cameraId)!;
  const step = { pending: 0, processing: 1, closed: 2, false_alarm: 2 }[alarm.status];

  const act = (status: AlarmStatus, action: string) => {
    const now = Date.now();
    updateAlarm(alarm.id, {
      status,
      closedAt: status === 'closed' || status === 'false_alarm' ? now : undefined,
      logs: [...alarm.logs, { time: now, action, operator, remark: remark || undefined }],
    });
    setRemark('');
    message.success(action);
  };

  return (
    <Drawer open width={760} onClose={onClose} title={<Space>告警详情 <Typography.Text type="secondary" className="mono">{alarm.id}</Typography.Text></Space>}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <AlarmSnapshot alarm={alarm} />
        <Steps
          size="small"
          current={step}
          status={alarm.status === 'false_alarm' ? 'error' : alarm.status === 'closed' ? 'finish' : 'process'}
          items={[
            { title: '告警上报' },
            { title: '确认派单' },
            { title: alarm.status === 'false_alarm' ? '误报关闭' : '整改闭环' },
          ]}
        />
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label="告警类型"><Tag color={ALARM_TYPES[alarm.type].color}>{ALARM_TYPES[alarm.type].label}</Tag></Descriptions.Item>
          <Descriptions.Item label="告警等级"><span style={{ color: LEVEL_META[alarm.level].color }}>{LEVEL_META[alarm.level].label}</span></Descriptions.Item>
          <Descriptions.Item label="点位">{cam.name}</Descriptions.Item>
          <Descriptions.Item label="区域">{workshopMap.get(cam.workshopId)?.name}</Descriptions.Item>
          <Descriptions.Item label="告警时间">{fmtTime(alarm.time)}</Descriptions.Item>
          <Descriptions.Item label="置信度">{(alarm.confidence * 100).toFixed(1)}%</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={STATUS_META[alarm.status].color}>{STATUS_META[alarm.status].label}</Tag></Descriptions.Item>
          <Descriptions.Item label="处置耗时">{alarm.closedAt ? fmtDuration(alarm.closedAt - alarm.time) : `已持续 ${fmtDuration(Date.now() - alarm.time)}`}</Descriptions.Item>
        </Descriptions>
        <Button icon={<PlayCircleOutlined />} onClick={() => navigate(`/playback?cam=${alarm.cameraId}&t=${Math.round(alarm.time - 15_000)}`)}>
          查看告警前后录像
        </Button>
        {(alarm.status === 'pending' || alarm.status === 'processing') && (
          <Card size="small" title="处置操作">
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Space>
                处置人
                <Select value={operator} onChange={setOperator} style={{ width: 120 }} options={OPERATORS.map((o) => ({ label: o, value: o }))} />
              </Space>
              <Input.TextArea rows={2} placeholder="处置说明（选填）" value={remark} onChange={(e) => setRemark(e.target.value)} />
              <Space>
                {alarm.status === 'pending' ? (
                  <>
                    <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => act('processing', '确认告警并派单')}>确认并派单</Button>
                    <Button icon={<StopOutlined />} onClick={() => act('false_alarm', '标记误报')}>标记误报</Button>
                  </>
                ) : (
                  <Button type="primary" icon={<CheckOutlined />} onClick={() => act('closed', '现场整改完成，闭环')}>整改完成，闭环</Button>
                )}
              </Space>
            </Space>
          </Card>
        )}
        <Card size="small" title="处置记录">
          <Timeline
            items={alarm.logs.map((l) => ({
              content: (
                <>
                  <div>{l.action} <Typography.Text type="secondary">· {l.operator}</Typography.Text></div>
                  <Typography.Text type="secondary" className="mono" style={{ fontSize: 12 }}>{fmtTime(l.time)}</Typography.Text>
                  {l.remark && <div style={{ fontSize: 12, color: '#9fb0c8' }}>{l.remark}</div>}
                </>
              ),
            }))}
          />
        </Card>
      </Space>
    </Drawer>
  );
}

export default function AlarmCenter() {
  const alarms = useAppStore((s) => s.alarms);
  const [params, setParams] = useSearchParams();
  const openId = params.get('id');
  const [types, setTypes] = useState<AlarmType[]>([]);
  const [level, setLevel] = useState<AlarmLevel>();
  const [status, setStatus] = useState<AlarmStatus>();
  const [cameraId, setCameraId] = useState<string>();
  const [keyword, setKeyword] = useState('');

  const filtered = useMemo(
    () =>
      alarms.filter(
        (a) =>
          (!types.length || types.includes(a.type)) &&
          (!level || a.level === level) &&
          (!status || a.status === status) &&
          (!cameraId || a.cameraId === cameraId) &&
          (!keyword || a.id.includes(keyword.toUpperCase())),
      ),
    [alarms, types, level, status, cameraId, keyword],
  );

  const today = useMemo(() => {
    const start = dayjs().startOf('day').valueOf();
    const list = alarms.filter((a) => a.time >= start);
    const done = list.filter((a) => a.status === 'closed' || a.status === 'false_alarm');
    return {
      total: list.length,
      pending: alarms.filter((a) => a.status === 'pending').length,
      processing: alarms.filter((a) => a.status === 'processing').length,
      rate: list.length ? (done.length / list.length) * 100 : 0,
    };
  }, [alarms]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
  });
  const items = virtualizer.getVirtualItems();

  return (
    <div className="page">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Card size="small"><Statistic title="今日告警" value={today.total} /></Card>
        <Card size="small"><Statistic title="待处置" value={today.pending} styles={{ content: { color: '#ff4d4f' } }} /></Card>
        <Card size="small"><Statistic title="处置中" value={today.processing} styles={{ content: { color: '#1f8fff' } }} /></Card>
        <Card size="small"><Statistic title="今日闭环率" value={today.rate} precision={1} suffix="%" styles={{ content: { color: '#52c41a' } }} /></Card>
      </div>
      <div className="panel" style={{ padding: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select
          mode="multiple"
          allowClear
          placeholder="告警类型"
          style={{ minWidth: 220 }}
          maxTagCount="responsive"
          value={types}
          onChange={setTypes}
          options={(Object.keys(ALARM_TYPES) as AlarmType[]).map((t) => ({ label: ALARM_TYPES[t].label, value: t }))}
        />
        <Select allowClear placeholder="等级" style={{ width: 100 }} value={level} onChange={setLevel}
          options={([1, 2, 3] as AlarmLevel[]).map((l) => ({ label: LEVEL_META[l].label, value: l }))} />
        <Select allowClear placeholder="状态" style={{ width: 110 }} value={status} onChange={setStatus}
          options={(Object.keys(STATUS_META) as AlarmStatus[]).map((s) => ({ label: STATUS_META[s].label, value: s }))} />
        <Select allowClear showSearch={{ optionFilterProp: 'label' }} placeholder="点位" style={{ width: 180 }} value={cameraId} onChange={setCameraId}
          options={cameras.map((c) => ({ label: c.name, value: c.id }))} />
        <Input allowClear prefix={<SearchOutlined />} placeholder="告警编号" style={{ width: 160 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <div style={{ flex: 1 }} />
        <Typography.Text type="secondary" className="mono" style={{ fontSize: 12 }}>
          共 {filtered.length.toLocaleString()} 条 · 虚拟列表实际渲染 {items.length} 行 DOM
        </Typography.Text>
      </div>
      <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className={styles.header} style={{ gridTemplateColumns: COLUMNS }}>
          <span>抓拍</span><span>编号</span><span>类型</span><span>等级</span><span>区域 / 点位</span><span>告警时间</span><span>置信度</span><span>状态</span><span>操作</span>
        </div>
        <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {items.map((v) => (
              <div key={filtered[v.index].id} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: v.size, transform: `translateY(${v.start}px)` }}>
                <AlarmRow alarm={filtered[v.index]} onOpen={() => setParams({ id: filtered[v.index].id })} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <AlarmDetail alarm={openId ? alarms.find((a) => a.id === openId) : undefined} onClose={() => setParams({})} />
    </div>
  );
}
