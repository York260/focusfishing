"""立體打光版像素繪製
1. 每個部位（頭、身體、尾巴、腳…）各自是一塊形狀
2. 用距離場把每塊「吹鼓」成圓弧面，算出法線
3. 光從左上前方打過來 → 5 階色階（暗部偏藍紫、亮部偏暖）
4. 前面的部位在後面的部位上投下陰影；部位交界畫內線
5. 縮成像素格後量化成色階，外圈描深色輪廓
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt, binary_dilation, shift as nd_shift

N = 40          # 成品格數
S = 12          # 每格在草圖裡的解析度
W = N * S
LIGHT = np.array([-0.55, -0.65, 0.52]); LIGHT = LIGHT / np.linalg.norm(LIGHT)

RAMPS = {   # 由暗到亮 5 階，暗部偏冷、亮部偏暖
    'fur':   ['#1E1E33', '#34364F', '#4E536C', '#717892', '#A3A9BE'],
    'far':   ['#17172A', '#25263C', '#363950', '#4A4E67', '#5F6480'],
    'cream': ['#6F6A7C', '#A19DA6', '#CFCAC6', '#E9E5DE', '#FFFDF8'],
    'ember': ['#8A2416', '#C8401C', '#F2662A', '#FF9447', '#FFC46B'],
    'core':  ['#FF9E3D', '#FFBE52', '#FFD873', '#FFEDA8', '#FFFFFF'],
}
GLOW = {'ember', 'core'}
OUTLINE = '#15131D'
hexc = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def bez(p0, p1, p2, p3, n=60):
    return [(((1-t)**3)*p0[0] + 3*((1-t)**2)*t*p1[0] + 3*(1-t)*t*t*p2[0] + t**3*p3[0],
             ((1-t)**3)*p0[1] + 3*((1-t)**2)*t*p1[1] + 3*(1-t)*t*t*p2[1] + t**3*p3[1]) for t in (i / n for i in range(n + 1))]


class Figure:
    def __init__(self): self.parts = []      # (material, mask, puff)

    def _new(self): return Image.new('L', (W, W), 0)
    def _sc(self, pts): return [(x * W / 100, y * W / 100) for x, y in pts]

    def add(self, mat, im, puff=1.0): self.parts.append((mat, np.array(im) > 127, puff))

    def ellipse(self, mat, cx, cy, rx, ry, rot=0, puff=1.0):
        a = math.radians(rot); pts = []
        for i in range(64):
            t = 2 * math.pi * i / 64; x, y = rx * math.cos(t), ry * math.sin(t)
            pts.append((cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)))
        self.poly(mat, pts, puff)

    def poly(self, mat, pts, puff=1.0):
        im = self._new(); ImageDraw.Draw(im).polygon(self._sc(pts), fill=255); self.add(mat, im, puff)

    def stroke(self, mat, path, w0, w1, wmid=None, puff=1.0):
        im = self._new(); d = ImageDraw.Draw(im); n = len(path)
        for i, (x, y) in enumerate(path):
            t = i / (n - 1)
            w = (w0 + (w1 - w0) * t) if wmid is None else (w0 + (wmid - w0) * t * 2 if t < .5 else wmid + (w1 - wmid) * (t - .5) * 2)
            r = w / 2 * W / 100; X, Y = x * W / 100, y * W / 100
            d.ellipse([X - r, Y - r, X + r, Y + r], fill=255)
        self.add(mat, im, puff)

    # ---------- 打光 ----------
    def render(self, dots=(), scale=10):
        P = len(self.parts)
        label = np.full((W, W), -1, int)
        for i, (_, m, _) in enumerate(self.parts): label[m] = i
        shade = np.zeros((W, W))
        for i, (mat, m, puff) in enumerate(self.parts):
            own = label == i
            if not own.any(): continue
            d = distance_transform_edt(m)
            R = max(d.max(), 1)
            h = np.sqrt(np.clip(1 - (1 - d / R) ** 2, 0, 1)) * R * puff     # 圓弧面
            gy, gx = np.gradient(h)
            nx, ny, nz = -gx, -gy, np.ones_like(h)
            ln = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
            lam = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / ln
            if mat in GLOW:
                v = 0.35 + 0.65 * (d / R)                                     # 火：中心最亮
            else:
                v = np.clip(lam, 0, 1) * 0.85 + 0.12
                # 前方部位投下的陰影（往右下偏移）
                front = np.zeros((W, W), bool)
                for j in range(i + 1, P):
                    if self.parts[j][0] not in GLOW: front |= self.parts[j][1]
                if front.any():
                    cast = nd_shift(front.astype(float), (S * 1.2, S * 0.9), order=0) > .5
                    v = np.where(cast & own, v * 0.55, v)
            shade[own] = v[own]
        # 縮成像素格
        cells = np.full((N, N), -1, int); val = np.zeros((N, N))
        for y in range(N):
            for x in range(N):
                blk = label[y * S:(y + 1) * S, x * S:(x + 1) * S]
                ids, cnt = np.unique(blk, return_counts=True)
                k = ids[np.argmax(cnt)]
                if k == -1 and cnt[np.argmax(cnt)] < S * S * 0.62:   # 邊緣格：有一點就算進去
                    nz_ = ids != -1
                    if nz_.any(): k = ids[nz_][np.argmax(cnt[nz_])]
                if k >= 0 and (blk == k).sum() >= S * S * 0.38:
                    cells[y, x] = k
                    val[y, x] = shade[y * S:(y + 1) * S, x * S:(x + 1) * S][blk == k].mean()
        im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
        mat_of = lambda k: self.parts[k][0] if k >= 0 else None
        for y in range(N):
            for x in range(N):
                k = cells[y, x]
                if k < 0:
                    nb = [cells[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < N and 0 <= y + dy < N]
                    nb = [n for n in nb if n >= 0]
                    if nb:
                        c = RAMPS['ember'][0] if all(mat_of(n) in GLOW for n in nb) else OUTLINE
                        im.putpixel((x, y), hexc(c) + (255,))
                    continue
                mat = mat_of(k); ramp = RAMPS[mat]
                idx = int(np.clip(val[y, x] * 5, 0, 4.999))
                # 部位交界的內線：自己在後面、旁邊是前面的同色系部位
                if mat not in GLOW:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        X, Y = x + dx, y + dy
                        if 0 <= X < N and 0 <= Y < N and cells[Y, X] > k and mat_of(cells[Y, X]) not in GLOW and mat_of(cells[Y, X]) != 'cream':
                            if mat_of(cells[Y, X]) == mat or mat == 'far':
                                idx = min(idx, 1); break
                im.putpixel((x, y), hexc(ramp[idx]) + (255,))
        for (x, y), c in dots: im.putpixel((x, y), hexc(c) + (255,))
        return im.resize((N * scale, N * scale), Image.NEAREST)


# ---------------- 燼仔 ----------------
def kit0():
    f = Figure()
    # 由後往前畫：遠側腳 → 尾巴 → 身體 → 近側腳 → 頭 → 細節
    f.stroke('far', bez((46, 70), (46, 76), (45, 80), (45, 86)), 8, 7)
    f.stroke('far', bez((65, 70), (66, 76), (66, 80), (66, 86)), 8, 7)
    f.stroke('fur', bez((62, 68), (86, 66), (93, 44), (84, 24)), 10, 12, wmid=27, puff=1.1)
    f.ellipse('fur', 53, 67, 17, 12.5, rot=-6)
    f.ellipse('cream', 38, 64, 9, 7.5, rot=-20, puff=.8)
    f.stroke('fur', bez((40, 73), (40, 78), (39, 82), (39, 87)), 9, 8)
    f.stroke('fur', bez((59, 73), (60, 78), (60, 82), (60, 87)), 9, 8)
    for x in (39, 60): f.ellipse('cream', x, 87, 4.6, 2.4, puff=.6)
    f.poly('fur', [(32, 30), (45, 9), (50, 37)], puff=.6)          # 後耳
    f.ellipse('fur', 32, 46, 20, 17, rot=-5)
    f.poly('fur', [(16, 43), (4, 52), (8, 57), (21, 57)], puff=.7)  # 尖嘴
    f.poly('fur', [(17, 37), (16, 8), (34, 30)], puff=.6)            # 前耳
    f.poly('ember', [(19.5, 33), (19.5, 17), (28.5, 30)])
    f.stroke('ember', bez((84, 30), (80, 22), (82, 13), (88, 6)), 17, 5)
    f.poly('ember', [(87, 17), (98, 9), (95, 23)])
    f.poly('ember', [(78, 19), (73, 8), (83, 14)])
    f.stroke('core', bez((84, 29), (83, 23), (84, 17), (86, 12)), 9, 3)
    f.stroke('ember', bez((61, 59), (65, 63), (62, 66), (66, 70)), 2.6, 2.6)
    return f.render(dots=[((11, 17), '#15131D'), ((11, 18), '#15131D'), ((2, 21), '#15131D')])


SPR = {'kit0': kit0}

if __name__ == '__main__':
    k = sys.argv[1] if len(sys.argv) > 1 else 'kit0'
    im = SPR[k]()
    Wd, Ht = im.size; pad = 20
    pv = Image.new('RGBA', (Wd * 2 + pad * 3, Ht + pad * 2), (30, 33, 46, 255))
    for i, bgc in enumerate([(226, 230, 236), (25, 28, 39)]):
        b = Image.new('RGBA', (Wd, Ht), bgc + (255,)); b.alpha_composite(im); pv.alpha_composite(b, (pad + i * (Wd + pad), pad))
    pv.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), k + '_preview.png'))
    print('ok')
