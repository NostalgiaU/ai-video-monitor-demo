"""离线目标检测：对素材逐帧跑 YOLO（人员/车辆 + 安全帽），输出与视频时间对齐的检测框 JSON。

用法: python scripts/detect.py <输出.json> <视频.mp4>
依赖: pip install ultralytics；安全帽模型 keremberke/yolov8m-hard-hat-detection (best.pt)
输出: {fps, duration, frames: [[[label, trackId, x, y, w, h, score], ...], ...]}，坐标按画面宽高归一化。
label: 0=人员·戴安全帽 1=人员·未戴安全帽 2=人员 3=车辆
"""
import json
import os
import sys

import cv2
from ultralytics import YOLO

STRIDE = 2
VEHICLES = {2, 3, 5, 7}
W = os.environ.get('YOLO_WEIGHTS', os.path.expanduser('~/yolo/w'))

out, src = sys.argv[1], sys.argv[2]
coco = YOLO(os.path.join(W, 'yolo11m.pt'))
hat = YOLO(os.path.join(W, 'hardhat_m.pt'))
cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS)
frames, i = [], 0
while True:
    ok, img = cap.read()
    if not ok:
        break
    i += 1
    if (i - 1) % STRIDE:
        continue
    h, w = img.shape[:2]
    r = coco.track(img, persist=True, conf=0.4, classes=[0, *VEHICLES], tracker='bytetrack.yaml', verbose=False)[0]
    hats = [(float(b.xywh[0][0]), float(b.xywh[0][1]), int(b.cls)) for b in hat(img, conf=0.45, verbose=False)[0].boxes]
    boxes = []
    for b in r.boxes:
        x1, y1, x2, y2 = map(float, b.xyxy[0])
        cls = int(b.cls)
        tid = int(b.id) if b.id is not None else -1
        if cls == 0:
            label = 2
            for cx, cy, hc in hats:
                if x1 <= cx <= x2 and y1 - 0.1 * (y2 - y1) <= cy <= y1 + 0.4 * (y2 - y1):
                    label = hc
                    break
        else:
            label = 3
        boxes.append([label, tid, round(x1 / w, 4), round(y1 / h, 4), round((x2 - x1) / w, 4), round((y2 - y1) / h, 4), round(float(b.conf), 2)])
    frames.append(boxes)
with open(out, 'w') as f:
    json.dump({'fps': fps / STRIDE, 'duration': round(i / fps, 3), 'frames': frames}, f, separators=(',', ':'))
print(out, len(frames), 'frames', sum(len(b) for b in frames), 'boxes')
