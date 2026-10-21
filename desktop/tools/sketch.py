"""用曲線和姿態線在高解析度畫剪影，再縮成像素並上輪廓、明暗。
每隻異獸是一個函式，用 0–100 座標描述形狀。"""
from PIL import Image, ImageDraw
import math, sys, os

S = 10          # 每個像素在草圖裡是 10x10
N = 40          # 成品 40x40 格


def bez(p0, p1, p2, p3, n=40):
    out = []
    for i in range(n + 1):
        t = i / n; u = 1 - t
        out.append((u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
                    u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1]))
    return out


class Sketch:
    def __init__(self):
        self.W = N * S
        self.layers = []   # (name, image)
        self.cur = {}

    def _img(self, k):
        if k not in self.cur:
            im = Image.new('L', (self.W, self.W), 0); self.cur[k] = im; self.layers.append((k, im))
        return self.cur[k]

    def sc(self, pts): return [(x * self.W / 100, y * self.W / 100) for x, y in pts]

    def poly(self, k, pts): ImageDraw.Draw(self._img(k)).polygon(self.sc(pts), fill=255)

    def ellipse(self, k, cx, cy, rx, ry, rot=0):
        a = math.radians(rot); pts = []
        for i in range(48):
            t = 2 * math.pi * i / 48; x, y = rx * math.cos(t), ry * math.sin(t)
            pts.append((cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)))
        self.poly(k, pts)

    def stroke(self, k, path, w0, w1, wmid=None):
        """沿曲線畫一筆，粗細從 w0 漸變到 w1（可在中段鼓起）"""
        d = ImageDraw.Draw(self._img(k)); n = len(path)
        for i, (x, y) in enumerate(path):
            t = i / (n - 1)
            w = (w0 + (w1 - w0) * t) if wmid is None else (w0 + (wmid - w0) * t * 2 if t < .5 else wmid + (w1 - wmid) * (t - .5) * 2)
            r = w / 2 * self.W / 100; X, Y = x * self.W / 100, y * self.W / 100
            d.ellipse([X - r, Y - r, X + r, Y + r], fill=255)

    def grid(self):
        """縮成 N×N：每格取覆蓋最多的圖層（後畫的優先）"""
        g = [[None] * N for _ in range(N)]
        small = [(k, im.resize((N, N), Image.BOX)) for k, im in self.layers]
        for y in range(N):
            for x in range(N):
                best = None
                for k, im in small:           # 後面的圖層蓋在前面的上面
                    if im.getpixel((x, y)) >= 120: best = k
                g[y][x] = best
        return g


def render(g, pal, glow=(), dots=(), outline=(22, 20, 30), scale=10):
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    at = lambda x, y: g[y][x] if 0 <= x < N and 0 <= y < N else None
    for y in range(N):
        for x in range(N):
            k = at(x, y)
            if k is None:
                nb = [n for n in (at(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) if n]
                if nb:
                    c = pal[nb[0]][2] if all(n in glow for n in nb) else outline
                    im.putpixel((x, y), c + (255,))
                continue
            base, light, dark = pal[k]
            up, dn = at(x, y - 1), at(x, y + 1)
            if k in glow:
                c = light if (up is not None and up in glow and dn in glow) else base
            elif up is None or (up != k and pal[up][0] != base and k not in ('far',)) and up not in glow:
                c = light
            elif dn is None or at(x + 1, y + 1) is None or at(x, y + 2) is None:
                c = dark
            else:
                c = base
            im.putpixel((x, y), c + (255,))
    for (x, y), c in dots: im.putpixel((x, y), c + (255,))
    return im.resize((N * scale, N * scale), Image.NEAREST)


# ---------------- 燼仔 ----------------
def kit0():
    s = Sketch()
    # 比例：頭佔四成、身體小而圓、腳短、尾巴特大
    # 遠側的腳
    s.stroke('far', bez((46, 72), (46, 76), (45, 80), (45, 86)), 8, 7)
    s.stroke('far', bez((64, 72), (65, 76), (65, 80), (65, 86)), 8, 7)
    # 大尾巴：從屁股往右上鼓成一大團
    s.stroke('body', bez((62, 68), (84, 66), (92, 44), (84, 24)), 10, 12, wmid=27)
    # 身體：小小一顆豆子
    s.ellipse('body', 53, 68, 17, 12, rot=-6)
    # 近側的腳
    s.stroke('body', bez((40, 74), (40, 78), (39, 82), (39, 87)), 9, 8)
    s.stroke('body', bez((58, 74), (59, 78), (59, 82), (59, 87)), 9, 8)
    # 大頭
    s.ellipse('body', 32, 46, 20, 17, rot=-5)
    s.poly('body', [(16, 44), (5, 52), (9, 56), (20, 56)])     # 小尖嘴
    s.poly('body', [(18, 36), (17, 9), (34, 30)])              # 前耳
    s.poly('body', [(32, 30), (45, 10), (49, 37)])             # 後耳
    # 臉頰與胸口淺色
    s.ellipse('cream', 36, 64, 9, 7.5, rot=-20)   # 胸口一撮白毛
    s.poly('cream', [(28, 58), (24, 66), (33, 62)])
    for x in (39, 59): s.ellipse('cream', x, 87, 4.6, 2.4)
    # 尾巴尖端：一整團火
    s.stroke('ember', bez((84, 30), (80, 22), (82, 13), (88, 6)), 17, 5)
    s.poly('ember', [(88, 16), (98, 9), (95, 22)])
    s.poly('ember', [(78, 18), (74, 8), (82, 14)])
    s.stroke('core', bez((84, 29), (83, 23), (84, 17), (86, 12)), 9, 3)
    # 耳內與裂紋
    s.poly('ember', [(20, 33), (20, 18), (29, 31)])
    s.stroke('ember', bez((60, 60), (64, 64), (61, 67), (65, 71)), 2.4, 2.4)
    g = s.grid()
    pal = {
        'body': ((80, 86, 106), (108, 116, 140), (56, 60, 78)),
        'far': ((52, 56, 72), (60, 65, 82), (40, 43, 56)),
        'cream': ((228, 224, 216), (246, 243, 238), (184, 180, 178)),
        'ember': ((255, 122, 47), (255, 150, 70), (206, 78, 28)),
        'core': ((255, 214, 94), (255, 236, 150), (255, 190, 70)),
    }
    eye = (11, 18)
    return render(g, pal, glow=('ember', 'core'), dots=[(eye, (18, 16, 24)), ((2, 21), (18, 16, 24))])


SPR = {'kit0': kit0}

if __name__ == '__main__':
    k = sys.argv[1] if len(sys.argv) > 1 else 'kit0'
    im = SPR[k]()
    W, H = im.size; pad = 20
    pv = Image.new('RGBA', (W * 2 + pad * 3, H + pad * 2), (30, 33, 46, 255))
    for i, bgc in enumerate([(226, 230, 236), (25, 28, 39)]):
        b = Image.new('RGBA', (W, H), bgc + (255,)); b.alpha_composite(im); pv.alpha_composite(b, (pad + i * (W + pad), pad))
    pv.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), k + '_preview.png'))
    print('ok')
