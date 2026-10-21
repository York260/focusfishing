"""燼仔 v3：側面剪影、極簡表情。先決定整體輪廓，再上兩階明暗。"""
from PIL import Image
import sys

N = 32
COL = {
    'out':   (24, 22, 30),
    'body':  (78, 84, 104), 'body_l': (106, 114, 138), 'body_d': (52, 56, 72),
    'far':   (52, 56, 72),  'far_d':  (38, 41, 54),    'far_l': (66, 71, 90),
    'cream': (226, 222, 214), 'cream_l': (244, 241, 236), 'cream_d': (178, 174, 172),
    'ember': (255, 122, 47), 'ember_l': (255, 160, 80), 'ember_d': (214, 82, 30),
    'core':  (255, 214, 94), 'core_l': (255, 238, 160), 'core_d': (255, 190, 70),
    'eye':   (20, 18, 26),
}
GLOW = {'ember', 'core'}  # 發光的部分：輪廓用深橘，不用黑


def spans(g, k, rows):
    for y, segs in rows.items():
        if isinstance(segs[0], int): segs = [segs]
        for a, b in segs:
            for x in range(a, b + 1): g[y][x] = k


def build():
    g = [[None] * N for _ in range(N)]
    # 遠側的腳（較暗）
    spans(g, 'far', {r: (10, 11) for r in range(19, 27)})
    spans(g, 'far', {27: (9, 11)})
    spans(g, 'far', {20: (15, 16), 21: (15, 16), 22: (14, 15), 23: (14, 15), 24: (14, 15), 25: (14, 15), 26: (14, 15), 27: (13, 15)})
    # 尾巴：從屁股往右上掃，最寬處在中段
    spans(g, 'body', {16: (22, 24), 15: (22, 26), 14: (22, 27), 13: (22, 28), 12: (22, 29), 11: (22, 29),
                      10: (22, 29), 9: (23, 29), 8: (23, 28)})
    # 身體
    spans(g, 'body', {
        2: (7, 7), 3: (6, 7), 4: (6, 8), 5: (5, 8), 6: (4, 9),           # 耳朵
        7: (3, 10), 8: (2, 11), 9: (0, 11), 10: (1, 11), 11: (3, 11),     # 頭與尖嘴
        12: (5, 12), 13: (6, 22), 14: (6, 23), 15: (6, 23), 16: (6, 23),  # 胸與背
        17: (7, 23), 18: (7, 22), 19: [(7, 8), (16, 22)],                 # 腹與後腿根部
        20: [(7, 8), (17, 22)], 21: [(7, 8), (18, 21)], 22: [(7, 8), (19, 21)],
        23: [(7, 8), (19, 20)], 24: [(7, 8), (19, 20)], 25: [(7, 8), (19, 20)], 26: [(7, 8), (19, 20)],
        27: [(6, 8), (18, 21)],
    })
    # 喉嚨到胸口的淺色
    spans(g, 'cream', {10: (1, 4), 11: (3, 7), 12: (5, 8), 13: (6, 8), 14: (6, 8), 15: (6, 7)})
    # 尾巴尖端的火
    spans(g, 'ember', {7: (24, 28), 6: (24, 28), 5: (24, 27), 4: (24, 27), 3: [(25, 27), (29, 29)], 2: [(26, 27), (29, 29)], 1: (26, 26)})
    spans(g, 'core', {6: (25, 27), 5: (25, 26), 4: (25, 26)})
    # 一道裂紋就好
    for x, y in [(18, 15), (19, 16), (19, 17), (20, 18)]: g[y][x] = 'ember'
    # 耳朵內側一點火光
    for x, y in [(7, 4), (7, 5), (6, 5)]: g[y][x] = 'ember'
    return g, [(6, 8)], [(0, 9)]


def render(scale=12):
    g, eye, nose = build()
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    at = lambda x, y: g[y][x] if 0 <= x < N and 0 <= y < N else None
    for y in range(N):
        for x in range(N):
            k = at(x, y)
            if k is None:
                nb = [n for n in (at(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) if n]
                if nb:
                    c = COL['ember_d'] if all(n in GLOW for n in nb) else COL['out']
                    im.putpixel((x, y), c + (255,))
                continue
            up, dn, dn2 = at(x, y - 1), at(x, y + 1), at(x, y + 2)
            if up is None or (up != k and not (k == 'body' and up == 'cream')):
                c = COL.get(k + '_l', COL[k])
            elif dn != k or dn2 is None:
                c = COL.get(k + '_d', COL[k])
            else:
                c = COL[k]
            im.putpixel((x, y), c + (255,))
    for x, y in eye + nose: im.putpixel((x, y), COL['eye'] + (255,))
    return im.resize((N * scale, N * scale), Image.NEAREST)


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'kit0_preview.png'
    im = render()
    W, H = im.size; pad = 24
    pv = Image.new('RGBA', (W * 2 + pad * 3, H + pad * 2), (30, 33, 46, 255))
    for i, bgc in enumerate([(226, 230, 236), (25, 28, 39)]):
        b = Image.new('RGBA', (W, H), bgc + (255,)); b.alpha_composite(im); pv.alpha_composite(b, (pad + i * (W + pad), pad))
    pv.save(out)
    print('ok')
