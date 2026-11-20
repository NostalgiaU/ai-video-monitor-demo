import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateAlarms, type Alarm } from './mock/alarms';

export type StreamMode = 'live' | 'demo';
export type StreamProtocol = 'ws-flv' | 'http-flv';

interface AppState {
  mode: StreamMode;
  protocol: StreamProtocol;
  mediaHost: string;
  alarms: Alarm[];
  setMode: (mode: StreamMode) => void;
  setProtocol: (protocol: StreamProtocol) => void;
  setMediaHost: (host: string) => void;
  pushAlarm: (alarm: Alarm) => void;
  updateAlarm: (id: string, patch: Partial<Alarm>) => void;
}

const defaultMode: StreamMode = import.meta.env.VITE_DEMO_MODE === 'true' ? 'demo' : 'live';
const defaultHost = import.meta.env.VITE_MEDIA_HOST || `${location.hostname}:8080`;

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      mode: defaultMode,
      protocol: 'ws-flv',
      mediaHost: defaultHost,
      alarms: generateAlarms(12000),
      setMode: (mode) => set({ mode }),
      setProtocol: (protocol) => set({ protocol }),
      setMediaHost: (mediaHost) => set({ mediaHost }),
      pushAlarm: (alarm) => set((s) => ({ alarms: [alarm, ...s.alarms] })),
      updateAlarm: (id, patch) =>
        set((s) => ({ alarms: s.alarms.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
    }),
    {
      name: 'avm-settings',
      partialize: ({ mode, protocol, mediaHost }) => ({ mode, protocol, mediaHost }),
    },
  ),
);
