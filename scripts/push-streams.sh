#!/usr/bin/env bash
# 用 FFmpeg 生成模拟摄像头画面并推流到 ZLMediaKit（RTMP），画面叠加摄像头名称与本地时间，便于肉眼观察端到端延迟。
# 用法: ./scripts/push-streams.sh [RTMP_HOST] [路数]
set -euo pipefail
HOST="${1:-127.0.0.1:1935}"
COUNT="${2:-8}"
FONT="${FONT:-/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf}"
SOURCES=(
  "testsrc2=size=640x360:rate=25"
  "smptehdbars=size=640x360:rate=25"
  "mandelbrot=size=640x360:rate=25"
  "life=size=640x360:rate=25:mold=10:ratio=0.2:death_color=#202830:life_color=#4cc9f0"
  "testsrc=size=640x360:rate=25"
  "cellauto=size=640x360:rate=25:rule=110"
  "rgbtestsrc=size=640x360:rate=25"
  "gradients=size=640x360:rate=25:speed=0.02"
)
pids=()
cleanup() { kill "${pids[@]}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
for i in $(seq 1 "$COUNT"); do
  id=$(printf "cam%02d" "$i")
  src="${SOURCES[$(( (i - 1) % ${#SOURCES[@]} ))]}"
  ffmpeg -hide_banner -loglevel error -re -f lavfi -i "$src" \
    -vf "drawbox=x=0:y=0:w=iw:h=34:color=black@0.55:t=fill,drawtext=fontfile=${FONT}:text='${id^^}  %{localtime\:%Y-%m-%d %H\\\\\:%M\\\\\:%S}':x=10:y=8:fontsize=18:fontcolor=white" \
    -c:v libx264 -preset ultrafast -tune zerolatency -profile:v baseline -pix_fmt yuv420p -g 25 -b:v 600k \
    -f flv "rtmp://${HOST}/live/${id}" &
  pids+=($!)
  echo "pushing rtmp://${HOST}/live/${id}"
done
wait
