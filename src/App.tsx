import { Suspense, lazy, useEffect, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { App as AntApp, Badge, Button, Input, Layout, Menu, Popover, Segmented, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import {
  AlertOutlined,
  AppstoreOutlined,
  DashboardOutlined,
  GithubOutlined,
  HistoryOutlined,
  SettingOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { useAppStore, type StreamMode, type StreamProtocol } from './store';
import { ALARM_TYPES, LEVEL_META, createAlarm } from './mock/alarms';
import { cameraMap } from './mock/devices';
const VideoWall = lazy(() => import('./pages/VideoWall'));
const Playback = lazy(() => import('./pages/Playback'));
const AlarmCenter = lazy(() => import('./pages/AlarmCenter'));
const PersonSearch = lazy(() => import('./pages/PersonSearch'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

const { Header, Sider, Content } = Layout;

function StreamSettings() {
  const { mode, protocol, mediaHost, setMode, setProtocol, setMediaHost } = useAppStore();
  return (
    <Space orientation="vertical" style={{ width: 300 }}>
      <Typography.Text type="secondary">取流模式</Typography.Text>
      <Segmented<StreamMode>
        block
        value={mode}
        onChange={setMode}
        options={[
          { label: '实时流 (ZLMediaKit)', value: 'live' },
          { label: '演示 (本地 MP4)', value: 'demo' },
        ]}
      />
      <Typography.Text type="secondary">直播协议</Typography.Text>
      <Segmented<StreamProtocol>
        block
        value={protocol}
        onChange={setProtocol}
        disabled={mode === 'demo'}
        options={[
          { label: 'WS-FLV', value: 'ws-flv' },
          { label: 'HTTP-FLV', value: 'http-flv' },
        ]}
      />
      <Typography.Text type="secondary">流媒体服务地址</Typography.Text>
      <Input value={mediaHost} disabled={mode === 'demo'} onChange={(e) => setMediaHost(e.target.value.trim())} />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        HTTP/1.1 下浏览器对同一域名最多 6 个并发连接，HTTP-FLV 超过 6 路会排队，多路视频墙推荐 WS-FLV。
      </Typography.Text>
    </Space>
  );
}

/** 模拟 WebSocket 实时告警推送 */
function useAlarmPush() {
  const pushAlarm = useAppStore((s) => s.pushAlarm);
  const { notification } = AntApp.useApp();
  const navigate = useNavigate();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return;
      const now = Date.now();
      const alarm = { ...createAlarm(Math.random, now, now), status: 'pending' as const };
      alarm.logs = alarm.logs.slice(0, 1);
      alarm.closedAt = undefined;
      pushAlarm(alarm);
      if (alarm.level <= 2) {
        notification.open({
          key: alarm.id,
          placement: 'bottomRight',
          title: (
            <Space>
              <Tag color={LEVEL_META[alarm.level].color}>{LEVEL_META[alarm.level].label}</Tag>
              {ALARM_TYPES[alarm.type].label}
            </Space>
          ),
          description: `${cameraMap.get(alarm.cameraId)?.name} · 置信度 ${(alarm.confidence * 100).toFixed(1)}%`,
          actions: (
            <Button size="small" type="primary" onClick={() => { notification.destroy(alarm.id); navigate(`/alarms?id=${alarm.id}`); }}>
              查看
            </Button>
          ),
          duration: 6,
        });
      }
    }, 20_000);
    return () => clearInterval(timer);
  }, [pushAlarm, notification, navigate]);
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const alarms = useAppStore((s) => s.alarms);
  const mode = useAppStore((s) => s.mode);
  const pending = useMemo(() => alarms.filter((a) => a.status === 'pending').length, [alarms]);
  useAlarmPush();

  const items = [
    { key: '/wall', icon: <AppstoreOutlined />, label: '实时视频墙' },
    { key: '/playback', icon: <HistoryOutlined />, label: '录像回放' },
    {
      key: '/alarms',
      icon: <AlertOutlined />,
      label: (
        <Space>
          告警中心
          <Badge count={pending} overflowCount={999} size="small" />
        </Space>
      ),
    },
    { key: '/search', icon: <UserSwitchOutlined />, label: '人员检索' },
    { key: '/dashboard', icon: <DashboardOutlined />, label: '安全值守大屏' },
  ];

  return (
    <Layout style={{ height: '100%' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px', borderBottom: '1px solid #1d2a40', height: 56 }}>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: 1, whiteSpace: 'nowrap' }}>
          <span style={{ color: '#1f8fff' }}>◆</span> 智造安全 · AI 视频分析平台
        </div>
        <div style={{ flex: 1 }} />
        <Tag color={mode === 'live' ? 'green' : 'gold'}>{mode === 'live' ? '实时流' : '演示模式'}</Tag>
        <Popover content={<StreamSettings />} title="取流设置" trigger="click" placement="bottomRight">
          <Button icon={<SettingOutlined />}>取流设置</Button>
        </Popover>
        <Tooltip title="源码">
          <Button type="text" icon={<GithubOutlined />} href={import.meta.env.VITE_REPO_URL || 'https://github.com/'} target="_blank" />
        </Tooltip>
      </Header>
      <Layout style={{ minHeight: 0, overflow: 'hidden' }}>
        <Sider width={196} style={{ borderRight: '1px solid #1d2a40' }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={items}
            onClick={({ key }) => navigate(key)}
            style={{ borderInlineEnd: 'none', background: 'transparent', paddingTop: 8 }}
          />
        </Sider>
        <Content style={{ padding: 12, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Suspense fallback={<Spin style={{ margin: 'auto' }} />}>
          <Routes>
            <Route path="/wall" element={<VideoWall />} />
            <Route path="/playback" element={<Playback />} />
            <Route path="/alarms" element={<AlarmCenter />} />
            <Route path="/search" element={<PersonSearch />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<Navigate to="/wall" replace />} />
          </Routes>
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
}
