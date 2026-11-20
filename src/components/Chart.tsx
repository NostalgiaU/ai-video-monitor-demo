import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

/** 轻量 ECharts 封装：自动 resize、option 增量更新、卸载时 dispose */
export default function Chart({ option, style }: { option: echarts.EChartsOption; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const chart = echarts.init(ref.current!, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current!);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option);
  }, [option]);

  return <div ref={ref} style={{ width: '100%', height: '100%', ...style }} />;
}
