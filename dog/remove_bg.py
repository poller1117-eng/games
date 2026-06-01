#!/usr/bin/env python3
"""離線去背：從四邊 flood-fill 清除連通的近白/淺灰背景，保留主體上未連到邊緣的白色。
與遊戲內 removeWhiteBg 同邏輯（mn>=188 且 mx-mn<=28）。"""
import os, sys, shutil
from collections import deque
from PIL import Image

DIRS = ['enemies', 'heroes']
BASE = os.path.dirname(os.path.abspath(__file__))

def is_bg(px):
    r, g, b = px[0], px[1], px[2]
    mn = min(r, g, b); mx = max(r, g, b)
    return mn >= 188 and (mx - mn) <= 28

def process(path):
    img = Image.open(path).convert('RGBA')
    W, H = img.size
    px = img.load()
    seen = bytearray(W * H)
    dq = deque()
    for x in range(W):
        dq.append((x, 0)); dq.append((x, H - 1))
    for y in range(H):
        dq.append((0, y)); dq.append((W - 1, y))
    cleared = 0
    while dq:
        x, y = dq.pop()
        idx = y * W + x
        if seen[idx]:
            continue
        seen[idx] = 1
        p = px[x, y]
        if not is_bg(p):
            continue
        px[x, y] = (p[0], p[1], p[2], 0)
        cleared += 1
        if x > 0: dq.append((x - 1, y))
        if x < W - 1: dq.append((x + 1, y))
        if y > 0: dq.append((x, y - 1))
        if y < H - 1: dq.append((x, y + 1))
    img.save(path)
    return W, H, cleared

def main():
    total = 0
    for d in DIRS:
        folder = os.path.join(BASE, d)
        if not os.path.isdir(folder):
            continue
        backup = os.path.join(BASE, d + '_orig')
        if not os.path.isdir(backup):
            os.makedirs(backup, exist_ok=True)
        for fn in sorted(os.listdir(folder)):
            if not fn.lower().endswith('.png'):
                continue
            src = os.path.join(folder, fn)
            bak = os.path.join(backup, fn)
            if not os.path.exists(bak):
                shutil.copy2(src, bak)  # 備份原圖一次
            W, H, cleared = process(src)
            pct = cleared / (W * H) * 100
            print(f'  {d}/{fn}: {W}x{H} 清除背景 {pct:.1f}%')
            total += 1
    print(f'✅ 完成，共處理 {total} 張，原圖已備份到 *_orig/')

if __name__ == '__main__':
    main()
