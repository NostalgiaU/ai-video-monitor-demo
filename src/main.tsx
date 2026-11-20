import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import './index.css';
import App from './App';

dayjs.locale('zh-cn');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { colorPrimary: '#1f8fff', colorBgBase: '#0b1220', colorBgContainer: '#111a2b', borderRadius: 6 },
        components: { Layout: { siderBg: '#0e1626', headerBg: '#0e1626', bodyBg: '#0b1220' } },
      }}
    >
      <AntApp style={{ height: '100%' }}>
        <HashRouter>
          <App />
        </HashRouter>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);
