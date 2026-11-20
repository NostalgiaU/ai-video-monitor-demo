import type { Camera } from '../mock/devices';
import type { StreamProtocol } from '../store';

/** ZLMediaKit 默认的 FLV 拉流地址规则：{schema}://host/{app}/{stream}.live.flv */
export function liveUrl(camera: Camera, protocol: StreamProtocol, host: string) {
  const secure = location.protocol === 'https:';
  const schema = protocol === 'ws-flv' ? (secure ? 'wss' : 'ws') : secure ? 'https' : 'http';
  return `${schema}://${host}/live/${camera.streamId}.live.flv`;
}

const clipIndex = (camera: Camera) => (Number(camera.streamId.slice(3)) - 1) % 3;

/** 演示模式（无流媒体服务时，例如线上静态部署）使用本地 MP4 循环模拟直播 */
export const demoUrl = (camera: Camera) =>
  `${import.meta.env.BASE_URL}records/clip0${clipIndex(camera) + 1}.mp4`;

export const recordHlsUrl = (clip: number) => `${import.meta.env.BASE_URL}records/clip0${clip + 1}/index.m3u8`;
export const RECORD_CLIP_COUNT = 3;
export const RECORD_CLIP_SECONDS = 60;
