"""燼仔 32x32 手繪像素。每一列用字元畫，一個字元＝一格。"""
from PIL import Image
import os, sys

PAL = {
    '.': None,
    'O': '#1D1A24',   # 輪廓
    'D': '#363A49',   # 暗毛
    'F': '#4F5568',   # 毛
    'L': '#6E7690',   # 亮毛
    'C': '#E7E2DA',   # 奶油白
    'c': '#B3AEB0',   # 奶油白陰影
    'E': '#FF7A2F',   # 餘燼橘
    'e': '#C8461F',   # 深橘
    'Y': '#FFD65E',   # 火心
    'K': '#16131C',   # 瞳孔
    'A': '#F4A63B',   # 琥珀
    'H': '#FFFFFF',   # 反光
    'P': '#E58B8B',   # 嘴裡
}

ART = [
#   0123456789012345678901234567890 1
   "................................",  # 0
   "..........................O.....",  # 1
   "...O.......O.............OEO....",  # 2
   "..OEO.....OEO...........OEYEO...",  # 3
   "..OEEO...OEEO...........OEYYEO..",  # 4
   "..OEEEOOOOEEFO.........OEYYYEO..",  # 5
   ".OFEEFLLLLFEFFO........OeEYYEO..",  # 6
   ".OFLFLLLLLLLFFO.........OeEEeO..",  # 7
   "OFLLLLLLLLLLLFFO........ODeeDO..",  # 8
   "OFLLKKKLLLKKKFFO.......OFLDDFFO.",  # 9
   "OLLKKHKLLKKHKFFO.......OFLLFFDO.",  # 10
   "OLLKAKKLLKAKKFFDO......OFLFFFDO.",  # 11
   "OCLKAAKLLKAAKFDDO.....OFLFFFDDO.",  # 12
   "OKCCKKCCLLKKFDDDO....OFLFFFDDO..",  # 13
   ".OCCCCCCCLLFFDDO....OFLFFFDDO...",  # 14
   "..OCCPCCCcFFDDOOOOOOFLFFFDDO....",  # 15
   "...OcCCccFFDOFLLLLLLFFFFDDO.....",  # 16
   "....OOOOOCCOFLLELLLFFFFDDO......",  # 17
   "........OCCCLLLLEFFFFFFDDO......",  # 18
   ".......OCCCCLFFFFEFFFFFDDO......",  # 19
   ".......OCCCcFFFEFFFFFDDDDO......",  # 20
   ".......OcCccFFFFFFFFFDDDO.......",  # 21
   "........OcFFOFFFFFLLFFDDO.......",  # 22
   "........OFFFOFFFFLLFFFDDO.......",  # 23
   "........OFFDOFFDOLFFFFDDO.......",  # 24
   "........OFFDOFFDOFFFFDDDO.......",  # 25
   "........OFFDOFFDOOFFDDDO........",  # 26
   ".......OCCcOCCcOOCCcDDO.........",  # 27
   ".......OOOOOOOOO.OOOOOO.........",  # 28
   "................................",  # 29
   "................................",  # 30
   "................................",  # 31
]


def build():
    g = [list((('..' + r)[:32]).ljust(32, '.')) for r in ART]
    # 清掉舊尾巴（右上角）
    for y in range(0, 17):
        for x in range(21, 32): g[y][x] = '.'
    put = lambda x, y, c: (0 <= x < 32 and 0 <= y < 32) and g[y].__setitem__(x, c)
    # 尖嘴巴（往左伸、微微朝下）
    for x, y, c in [(0,10,'.'),(1,10,'.'),(2,10,'O'),(0,11,'.'),(1,11,'O'),(2,11,'C'),(3,11,'C'),(4,11,'C'),
                    (0,12,'K'),(1,12,'C'),(2,12,'C'),(3,12,'C'),(4,12,'C'),
                    (0,13,'O'),(1,13,'O'),(2,13,'c'),(3,13,'C'),(4,13,'C'),
                    (0,14,'.'),(1,14,'.'),(2,14,'O'),(3,14,'O'),(4,14,'c')]:
        put(x, y, c)
    put(7, 15, 'C')  # 拿掉粉紅點
    # 蓬鬆大尾巴：從屁股往右上鼓起，尖端是火
    spans = {18:(22,25),17:(22,26),16:(23,27),15:(23,28),14:(24,29),13:(24,30),12:(24,30),11:(24,30),10:(24,30),9:(24,29),8:(23,29)}
    for y,(a2,b2) in spans.items():
        for x in range(a2,b2+1):
            t = 'L' if x <= a2+1 else 'D' if x >= b2-1 else 'F'
            if g[y][x] in '.O' or y >= 17: g[y][x] = t
    for x,y in [(30,11),(30,13)]: put(x,y,'.')         # 毛的鋸齒
    for x,y in [(29,11),(29,13)]: put(x,y,'D')
    flame = {7:(23,28),6:(23,27),5:(22,27),4:(22,26),3:(22,25),2:(23,24),1:(23,23)}
    for y,(a2,b2) in flame.items():
        for x in range(a2,b2+1):
            core = a2 < x < b2 and y >= 3
            g[y][x] = 'Y' if core and y >= 4 and x <= b2-2 else 'e' if y == 7 and x in (a2,b2) else 'E'
    for x,y,c in [(27,3,'E'),(28,4,'E'),(27,4,'E')]: put(x,y,c)
    for x,y,c in [(26,11,'E'),(27,12,'Y'),(28,13,'E'),(25,14,'L')]: put(x,y,c)
    # 身上的發光裂紋
    for y in range(17, 22):
        for x in range(14, 22):
            if g[y][x] == 'E': g[y][x] = 'F'
    for x,y,c in [(16,17,'E'),(17,18,'E'),(17,19,'Y'),(18,20,'E'),(20,18,'E'),(21,19,'E'),(14,6,'E'),(15,7,'E')]: put(x,y,c)
    # 尾巴：手繪的逗號形，蓬鬆的毛往右上鼓起，尖端燒成一團火
    TAIL = [
        ".......OEO...",
        "........O....",
        "......OEEO.O.",
        ".....OEYEOOEO",
        "....OEYYEEEEO",
        "....OEYYYYEO.",
        "....OeEYYYEO.",
        "....OLeEEEeFO",
        "...OLLFFFFFDO",
        "...OLFFFFFFDO",
        "...OLFFEFFFDO",
        "...OLFFFYFFDO",
        "....OLFFFEFDO",
        "....OLFFFFDO.",
        "...OLLFFFDDO.",
        "OOOLLFFFDDO..",
        "FLLLFFFDDO...",
    ]
    for y, row in enumerate(TAIL):
        assert len(row) == 13, (y, row)
        for i, ch in enumerate(row): g[y][19 + i] = ch
    # 臉頰蓬毛
    for x, y, c in [(15,13,'C'),(16,13,'C'),(17,13,'c'),(18,13,'O'),(16,14,'C'),(17,14,'O'),(14,14,'c')]:
        put(x, y, c)
    return [''.join(r) for r in g]


def render(art, scale):
    h, w = len(art), max(len(r) for r in art)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for y, row in enumerate(art):
        for x, ch in enumerate(row):
            c = PAL.get(ch)
            if c: im.putpixel((x, y), tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    return im.resize((w * scale, h * scale), Image.NEAREST)


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'kit0_preview.png'
    big = render(build(), 12)
    bg = Image.new('RGBA', big.size, (226, 230, 236, 255))
    bg.alpha_composite(big)
    bg.save(out)
    print('ok')
