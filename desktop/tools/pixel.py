"""手繪像素異獸：用基本形狀在 48x48 格子上作畫，再自動加輪廓與明暗。
用法：python3 pixel.py  →  輸出到 ../renderer/art/<id>.png 與 preview.png
"""
from PIL import Image, ImageDraw
import math, os, sys

N = 48
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'renderer', 'art')


def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)


class Sprite:
    def __init__(self):
        # 每格存「色票名稱」；None = 透明
        self.g = [[None] * N for _ in range(N)]
        self.emit = set()  # 會發光的格子：不加陰影

    def put(self, x, y, k, emit=False):
        if 0 <= x < N and 0 <= y < N:
            self.g[y][x] = k
            if emit: self.emit.add((x, y))
            else: self.emit.discard((x, y))

    def ellipse(self, cx, cy, rx, ry, k, rot=0, emit=False):
        a = math.radians(rot)
        for y in range(N):
            for x in range(N):
                dx, dy = x + .5 - cx, y + .5 - cy
                u = dx * math.cos(a) + dy * math.sin(a)
                v = -dx * math.sin(a) + dy * math.cos(a)
                if (u / rx) ** 2 + (v / ry) ** 2 <= 1: self.put(x, y, k, emit)

    def poly(self, pts, k, emit=False):
        im = Image.new('1', (N, N), 0)
        ImageDraw.Draw(im).polygon(pts, fill=1)
        for y in range(N):
            for x in range(N):
                if im.getpixel((x, y)): self.put(x, y, k, emit)

    def line(self, pts, k, emit=False, w=1):
        im = Image.new('1', (N, N), 0)
        ImageDraw.Draw(im).line(pts, fill=1, width=w)
        for y in range(N):
            for x in range(N):
                if im.getpixel((x, y)): self.put(x, y, k, emit)

    def rect(self, x0, y0, x1, y1, k, emit=False):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.put(x, y, k, emit)

    def px(self, pts, k, emit=True):
        for x, y in pts: self.put(x, y, k, emit)

    def render(self, pal, outline='#1B1C24', light=1.18, dark=0.74):
        P = {k: hexrgb(v) for k, v in pal.items()}
        O = hexrgb(outline)
        im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
        g = self.g
        at = lambda x, y: g[y][x] if 0 <= x < N and 0 <= y < N else None
        for y in range(N):
            for x in range(N):
                k = g[y][x]
                if k is None:
                    # 外輪廓：貼著角色的透明格
                    if any(at(x + dx, y + dy) is not None for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                        im.putpixel((x, y), O + (255,))
                    continue
                c = P[k]
                if (x, y) not in self.emit:
                    # 光從左上來：左上邊緣亮、右下兩格內暗
                    if at(x - 1, y - 1) != k and at(x - 1, y) != k or at(x, y - 1) is None:
                        c = shade(c, light)
                    elif at(x + 1, y + 1) != k or at(x + 2, y + 2) != k:
                        c = shade(c, dark)
                im.putpixel((x, y), c + (255,))
        # 內輪廓：不同色塊的交界，較暗那一側描深一點
        out = im.copy()
        for y in range(N):
            for x in range(N):
                k = g[y][x]
                if k is None or (x, y) in self.emit: continue
                for dx, dy in ((1, 0), (0, 1)):
                    k2 = at(x + dx, y + dy)
                    if k2 is not None and k2 != k and (x + dx, y + dy) not in self.emit and sum(P[k]) < sum(P[k2]) - 120:
                        out.putpixel((x, y), shade(P[k], .62) + (255,))
        return out


# ---------------- 燼仔（焰） ----------------
def kit0():
    s = Sprite()
    # 尾巴（身後往上翹）
    s.ellipse(37, 25, 5.5, 11, 'fur', rot=-30)
    s.ellipse(41, 16, 4.5, 5, 'fur', rot=-30)
    s.poly([(38, 14), (42, 6), (45, 11), (46, 16), (42, 19)], 'ember', emit=True)
    s.poly([(41, 13), (43, 9), (44, 14)], 'spark', emit=True)
    s.line([(35, 22), (38, 18)], 'pale')
    # 後腿與身體
    s.ellipse(31, 38, 5, 5.5, 'fur')
    s.ellipse(25, 33, 11, 7.5, 'fur')
    s.rect(30, 41, 35, 43, 'fur')
    # 前腳
    s.rect(14, 37, 17, 43, 'fur'); s.rect(20, 38, 23, 43, 'fur')
    s.rect(13, 42, 17, 43, 'pale'); s.rect(19, 42, 23, 43, 'pale')
    # 胸毛
    s.ellipse(17, 32, 4.5, 5.5, 'pale')
    # 頭
    s.ellipse(16, 22, 9, 7.5, 'fur')
    s.poly([(4, 24), (11, 20), (14, 27), (6, 27)], 'pale')
    s.ellipse(14, 26, 4, 2.5, 'pale')
    # 耳朵
    s.poly([(8, 17), (10, 7), (15, 15)], 'fur'); s.poly([(10, 15), (11, 10), (13, 15)], 'ember', emit=True)
    s.poly([(17, 15), (23, 6), (24, 17)], 'fur'); s.poly([(19, 15), (22, 10), (22, 16)], 'ember', emit=True)
    # 臉
    s.px([(4, 24), (5, 24)], 'ink'); s.px([(5, 23)], 'ink')
    s.rect(11, 20, 13, 22, 'eye', emit=True); s.px([(12, 21), (13, 21), (12, 22), (13, 22)], 'ink'); s.px([(11, 20)], 'white')
    s.px([(8, 27), (9, 28), (10, 28)], 'ink')
    # 發光裂紋
    s.line([(21, 28), (24, 31), (22, 34)], 'ember', emit=True)
    s.line([(28, 28), (30, 31), (33, 32)], 'ember', emit=True)
    s.line([(18, 17), (20, 20)], 'ember', emit=True)
    s.px([(24, 31), (30, 31)], 'spark')
    s.line([(32, 37), (34, 40)], 'ember', emit=True)
    return s.render({'fur': '#4C5161', 'pale': '#8A90A3', 'ember': '#FF7A2F', 'spark': '#FFD45C',
                     'eye': '#F2A33A', 'ink': '#15161C', 'white': '#FFFFFF'})


# ---------------- 泡鰭（潮） ----------------
def fin0():
    s = Sprite()
    # 尾鰭
    s.poly([(32, 27), (46, 20), (45, 35), (32, 35)], 'fin')
    s.ellipse(37, 31, 7, 3.5, 'body')
    # 身體與腳
    s.ellipse(27, 31, 10, 6.5, 'body')
    s.ellipse(20, 38, 2.5, 3.5, 'body'); s.ellipse(31, 38, 2.5, 3.5, 'body')
    s.ellipse(26, 34, 7, 3, 'belly')
    # 頭
    s.ellipse(17, 22, 11, 8.5, 'body')
    s.ellipse(17, 26, 8, 3.5, 'belly')
    # 鰓鬚（兩側三根）
    for (x, y, r) in [(6, 18, -60), (5, 23, -90), (7, 28, -120)]:
        s.ellipse(x, y, 1.8, 4, 'gill', rot=r)
    for (x, y, r) in [(26, 13, 30), (29, 17, 60), (30, 22, 90)]:
        s.ellipse(x, y, 1.8, 4, 'gill', rot=r)
    # 臉
    s.rect(11, 20, 12, 21, 'ink', emit=True); s.px([(11, 20)], 'white')
    s.rect(20, 20, 21, 21, 'ink', emit=True); s.px([(20, 20)], 'white')
    s.px([(13, 25), (14, 26), (15, 26), (16, 26), (17, 26), (18, 25)], 'ink')
    s.px([(10, 24), (21, 24)], 'cheek')
    # 背上的斑點
    s.px([(24, 26), (27, 25), (30, 27), (34, 28)], 'spot', emit=False)
    img = s.render({'body': '#62C7DE', 'belly': '#BDEFF7', 'fin': '#8ADCEC', 'gill': '#FF86A8',
                    'ink': '#14202A', 'white': '#FFFFFF', 'cheek': '#FFB3C6', 'spot': '#3FA5C2'}, outline='#16323F')
    # 泡泡（只有圈）
    d = ImageDraw.Draw(img)
    for (x, y, r) in [(40, 10, 2.5), (44, 4, 1.5), (35, 5, 1.2), (4, 36, 1.5)]:
        d.ellipse([x - r, y - r, x + r, y + r], outline=(190, 240, 250, 255))
    return img


# ---------------- 電絨（雷） ----------------
def zap0():
    s = Sprite()
    # 大尾巴：從身後捲到右上
    s.ellipse(38, 24, 6.5, 12, 'slate', rot=20)
    s.ellipse(41, 15, 5, 5, 'slate')
    s.line([(35, 33), (38, 24), (41, 15)], 'fur', w=2)
    # 滑翔翼膜：手腕連到腳踝
    s.poly([(7, 19), (17, 22), (17, 34), (10, 31)], 'fur')
    s.poly([(31, 22), (39, 30), (35, 38), (29, 34)], 'fur')
    s.line([(7, 19), (10, 31), (17, 34)], 'mem')
    s.line([(39, 30), (35, 38)], 'mem')
    # 身體
    s.ellipse(23, 28, 7.5, 9, 'slate')
    s.ellipse(22, 30, 4.5, 6, 'fur')
    # 手腳
    s.rect(5, 18, 7, 20, 'slate'); s.rect(38, 29, 40, 31, 'slate')
    s.rect(16, 36, 18, 39, 'slate'); s.rect(26, 36, 28, 39, 'slate')
    # 頭
    s.ellipse(21, 15, 8.5, 7, 'slate')
    s.ellipse(19, 18, 4.5, 3, 'fur')
    s.poly([(13, 11), (13, 2), (18, 9)], 'slate'); s.poly([(23, 9), (28, 1), (29, 10)], 'slate')
    s.poly([(14, 9), (14, 5), (16, 9)], 'fur'); s.poly([(25, 8), (27, 5), (27, 9)], 'fur')
    # 臉：壞笑
    s.rect(16, 13, 17, 14, 'ink', emit=True); s.px([(16, 13)], 'white')
    s.rect(22, 13, 23, 14, 'ink', emit=True); s.px([(22, 13)], 'white')
    s.px([(19, 16)], 'ink')
    s.px([(16, 18), (17, 19), (18, 19), (19, 19), (20, 19), (21, 18)], 'ink')
    s.px([(18, 20)], 'white')
    img = s.render({'slate': '#4A5268', 'fur': '#F5C93A', 'mem': '#D9A62A', 'cheek': '#FFE97A', 'ink': '#14161E', 'white': '#FFFFFF'})
    spark = (180, 242, 255, 255)
    for pts in [[(2, 10), (4, 12), (3, 13), (5, 15)], [(45, 4), (43, 6), (45, 7), (43, 9)], [(31, 16), (33, 15), (32, 13)], [(9, 41), (11, 43), (10, 44)]]:
        for x, y in pts: img.putpixel((x, y), spark)
    return img


SPRITES = {'kit0': kit0, 'fin0': fin0, 'zap0': zap0}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    ids = sys.argv[1:] or list(SPRITES)
    imgs = []
    for i in ids:
        im = SPRITES[i]()
        # 遊戲用：放大 10 倍、保持銳利（480x480）
        im.resize((N * 10, N * 10), Image.NEAREST).save(os.path.join(OUT, i + '.png'))
        imgs.append(im)
    # 預覽圖
    sc = 8; pad = 24
    W = len(imgs) * (N * sc + pad) + pad
    pv = Image.new('RGBA', (W, N * sc + pad * 2), (58, 64, 88, 255))
    for k, im in enumerate(imgs):
        pv.alpha_composite(im.resize((N * sc, N * sc), Image.NEAREST), (pad + k * (N * sc + pad), pad))
    pv.save(os.path.join(HERE, 'preview.png'))
    print('ok', ids)
