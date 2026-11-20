#!/usr/bin/env bash
# 用 FFmpeg 循环推送 public/cameras 下的真实场景素材到 ZLMediaKit（RTMP），模拟摄像头；
# 画面叠加点位编号与本地时间（类似 NVR 的 OSD），便于肉眼观察端到端延迟。
# 用法: ./scripts/push-streams.sh [RTMP_HOST] [路数]
set -euo pipefail
HOST="${1:-127.0.0.1:1935}"
COUNT="${2:-8}"
FONT="${FONT:-/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf}"
VIDEO_DIR="${VIDEO_DIR:-$(cd "$(dirname "$0")/.." && pwd)/public/cameras}"
pids=()
cleanup() { kill "${pids[@]}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
for i in $(seq 1 "$COUNT"); do
  id=$(printf "cam%02d" "$i")
  src="${VIDEO_DIR}/cam$(printf "%02d" $(( (i - 1) % 8 + 1 ))).mp4"
  # 等到 epoch % 素材时长 == 0 再开始循环推流，前端据此用当前时间换算画面位置，叠加离线检测框
  dur=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate,nb_frames -of csv=p=0 "$src" | awk -F'[,/]' '{print $3 / ($1 / $2)}')
  delay=$(awk -v d="$dur" -v n="$(date +%s.%N)" 'BEGIN { printf "%.3f", d - (n - int(n / d) * d) }')
  ( sleep "$delay"; exec ffmpeg -hide_banner -loglevel error -re -stream_loop -1 -i "$src" \
    -vf "drawbox=x=0:y=0:w=iw:h=34:color=black@0.55:t=fill,drawtext=fontfile=${FONT}:text='${id^^}  %{localtime\:%Y-%m-%d %H\\\\\:%M\\\\\:%S}':x=10:y=8:fontsize=18:fontcolor=white" \
    -c:v libx264 -preset ultrafast -tune zerolatency -profile:v baseline -pix_fmt yuv420p -g 25 -b:v 600k \
    -f flv "rtmp://${HOST}/live/${id}" ) &
  pids+=($!)
  echo "pushing rtmp://${HOST}/live/${id}"
done
wait
