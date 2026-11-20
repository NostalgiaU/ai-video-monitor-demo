import { useMemo, useState } from 'react';
import { Input, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { SearchOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { cameraMap, cameras, workshops, type Camera } from '../mock/devices';

interface Props {
  selectedId?: string;
  draggable?: boolean;
  onSelect?: (camera: Camera) => void;
}

export const CAMERA_DRAG_TYPE = 'application/x-camera-id';

export default function DeviceTree({ selectedId, draggable, onSelect }: Props) {
  const [keyword, setKeyword] = useState('');
  const online = cameras.filter((c) => c.online).length;

  const treeData = useMemo<DataNode[]>(
    () => [
      {
        key: 'root',
        title: `华东智造园区 (${online}/${cameras.length})`,
        selectable: false,
        children: workshops.map((w) => ({
          key: w.id,
          title: w.name,
          selectable: false,
          children: cameras
            .filter((c) => c.workshopId === w.id && c.name.includes(keyword))
            .map((c) => ({
              key: c.id,
              isLeaf: true,
              icon: <VideoCameraOutlined style={{ color: c.online ? '#52c41a' : '#8c8c8c' }} />,
              title: (
                <span
                  draggable={draggable && c.online}
                  onDragStart={(e) => e.dataTransfer.setData(CAMERA_DRAG_TYPE, c.id)}
                  style={{ color: c.online ? undefined : '#8c8c8c', cursor: draggable ? 'grab' : 'pointer' }}
                  title={`${c.name} ${c.ip}${c.online ? '' : '（离线）'}`}
                >
                  {c.name}
                </span>
              ),
            })),
        })),
      },
    ],
    [keyword, draggable, online],
  );

  return (
    <div className="panel" style={{ width: 230, flex: 'none', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: 10, borderBottom: '1px solid #1d2a40' }}>
        <Typography.Text strong>监控点位</Typography.Text>
        <Input
          size="small"
          allowClear
          prefix={<SearchOutlined />}
          placeholder="搜索点位"
          style={{ marginTop: 8 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 4px' }}>
        <Tree
          showIcon
          blockNode
          defaultExpandAll
          treeData={treeData}
          selectedKeys={selectedId ? [selectedId] : []}
          onSelect={(keys) => {
            const cam = cameraMap.get(String(keys[0]));
            if (cam) onSelect?.(cam);
          }}
        />
      </div>
      {draggable && (
        <Typography.Text type="secondary" style={{ fontSize: 12, padding: 10 }}>
          提示：拖拽点位到分屏窗口播放，或选中窗口后点击点位
        </Typography.Text>
      )}
    </div>
  );
}
