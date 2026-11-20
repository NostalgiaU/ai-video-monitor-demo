import type { Camera } from '../mock/devices';
import type { StreamProtocol } from '../store';

/** ZLMediaKit 默认的 FLV 拉流地址规则：{schema}://host/{app}/{stream}.live.flv */
export function liveUrl(camera: Camera, protocol: StreamProtocol, host: string) {
  const secure = location.protocol === 'https:';
  const schema = protocol === 'ws-flv' ? (secure ? 'wss' : 'ws') : secure ? 'https' : 'http';
  return `${schema}://${host}/live/${camera.streamId}.live.flv`;
}

/** 演示模式（无流媒体服务时，例如线上静态部署）直接循环播放与推流相同的点位素材 */
export const demoUrl = (camera: Camera) => `${import.meta.env.BASE_URL}cameras/${camera.streamId}.mp4`;

export const recordHlsUrl = (clip: number) => `${import.meta.env.BASE_URL}records/clip0${clip + 1}/index.m3u8`;
export const RECORD_CLIP_COUNT = 3;
export const RECORD_CLIP_SECONDS = 60;
