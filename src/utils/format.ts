import dayjs from 'dayjs';

export const fmtTime = (t: number, f = 'YYYY-MM-DD HH:mm:ss') => dayjs(t).format(f);

export function fmtDuration(ms: number) {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m} 分钟`;
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分`;
}

export function downloadDataUrl(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}
