/* 異獸資料：6 條進化線，每條有 基礎 → 普通 / 特殊 / 隱藏 三種進化 */
(function (root) {
  const TYPES = {
    焰: { color: '#FF7A45', en: 'ember' },
    潮: { color: '#3BB3E6', en: 'tide' },
    雷: { color: '#F2C53D', en: 'volt' },
    森: { color: '#67C26A', en: 'grove' },
    影: { color: '#9283FF', en: 'shade' },
    晶: { color: '#E7A6F0', en: 'crystal' }
  };

  const STYLE_PROMPT =
    'original creature design for a monster-collecting game, official character art in the style of 1990s handheld RPG concept sheets, ' +
    'single creature, full body, three-quarter view, chibi proportions with a big head and small round body, simple bold shapes, ' +
    'flat cel colors with only 3-4 colors and one shadow tone, uniform thick dark outline with slight hand-drawn wobble, minimal details, ' +
    'simple dot eyes with a small white shine highlight, no gradients, no glossy highlights, no glow, no rim light, no soft airbrush shading, ' +
    'no texture, plain white background, no text';

  // ctx 欄位：startHour, dur, weekend, bond, lv, failCount, recovered, sootheTotal, streak, dexBase, pureCount, appsUsed
  const LINES = [
    {
      id: 'kit', type: '焰', weight: 30, starter: true,
      base:    { id: 'kit0', name: '燼仔', desc: '尾巴尖端永遠悶燒著一點火星。你越專心，那點火就燒得越穩。',
                 prompt: 'a small fox cub, charcoal-grey fur with glowing orange ember cracks, fluffy tail tipped with a smoldering ember, big amber eyes, playful crouch' },
      normal:  { id: 'kit1', name: '熾鬃狼', desc: '鬃毛化成活的火焰，奔跑時會在地上留下一道焦痕。',
                 prompt: 'a sleek powerful wolf, mane made of living flame, armored charcoal plates on shoulders, orange and crimson palette, fierce forward stance, sparks trailing' },
      special: { id: 'kit2', name: '蒼炎狼', desc: '只在深夜誕生的變種。火焰是冷的藍白色，安靜得像月光。',
                 prompt: 'an elegant wolf wreathed in cold blue-white flames, midnight navy fur, crescent moon markings on forehead, calm predatory gaze, wisps of pale fire' },
      hidden:  { id: 'kit3', name: '不滅燼王', desc: '跌倒過、熄滅過，卻又重新燒起來的王。身上的裂痕都在發光。',
                 prompt: 'a large regal wolf king, body of cracked obsidian with molten gold seams, crown of floating embers, glowing battle scars, ember wings rising from shoulders, majestic' },
      sp: { label: '在深夜（22:00–04:00）開始試煉並通過', test: c => c.startHour >= 22 || c.startHour < 4 },
      hd: { hint: '熄滅過的火，好像能燒得更旺……', label: '試煉失敗並恢復 2 次以上後，再通過試煉', test: c => c.failCount >= 2 }
    },
    {
      id: 'fin', type: '潮', weight: 30, starter: true,
      base:    { id: 'fin0', name: '泡鰭', desc: '頭上的鰓鬚會隨心情擺動。緊張時會吐出一串小泡泡。',
                 prompt: 'a small axolotl-like water creature, frilly feathery gill fins, translucent aqua body, curious face, floating bubbles around it' },
      normal:  { id: 'fin1', name: '潮鰭龍', desc: '長長的身體像一道浪，鰭帆展開時能掀起潮水。',
                 prompt: 'a serpentine water dragon, long flowing fin sails, teal and white palette, wave crest patterns on scales, coiled striking pose' },
      special: { id: 'fin2', name: '淵鰭龍', desc: '在漫長的專注裡沉進深海的變種，鰭上點著一盞盞微光。',
                 prompt: 'an abyssal deep-sea dragon, dark indigo body, bioluminescent lanterns along its fins, glowing cyan spots, mysterious and calm' },
      hidden:  { id: 'fin3', name: '月潮神鯨', desc: '傳說每天都準時漲潮的人，才見得到牠在天上游。',
                 prompt: 'a majestic sky-swimming whale dragon, moonlit silver-blue body, glowing tide rings orbiting it, constellation-like spots, flowing fins like silk' },
      sp: { label: '通過 90 分鐘以上的試煉', test: c => c.dur >= 90 },
      hd: { hint: '潮汐從不缺席……', label: '連續 7 天每天都完成專注，再通過試煉', test: c => c.streak >= 7 }
    },
    {
      id: 'zap', type: '雷', weight: 30, starter: true,
      base:    { id: 'zap0', name: '電絨', desc: '全身的毛都帶靜電，摸一下會劈啪響。最愛從高處滑翔。',
                 prompt: 'a tiny flying squirrel, fluffy fur crackling with static electricity, yellow and slate-grey palette, gliding membranes, mischievous grin, small sparks' },
      normal:  { id: 'zap1', name: '雷翼鼯', desc: '翼膜上的閃電紋會在滑翔時亮起，快得只剩一道光。',
                 prompt: 'an agile glider beast, wing membranes shaped like lightning bolts, electric yellow with black zigzag stripes, mid-air dive pose, crackling energy' },
      special: { id: 'zap2', name: '嵐冠鼯', desc: '與夥伴心意相通後才會出現，頭頂戴著一圈風暴。',
                 prompt: 'a storm-crowned glider beast, mane of swirling storm clouds, crackling lightning halo above its head, deep violet and gold palette, proud stance' },
      hidden:  { id: 'zap3', name: '天穹雷主', desc: '一次次毫無雜念的專注，凝聚成統御天空的雷。',
                 prompt: 'a thunder sovereign beast, armor of dark storm clouds, six lightning-shaped wing tails, white and gold palette, radiant eyes, commanding the sky' },
      sp: { label: '羈絆達到 40 時通過試煉', test: c => c.bond >= 40 },
      hd: { hint: '一點雜念都沒有的時刻，累積起來……', label: '夥伴累積 20 次零分心的專注，再通過試煉', test: c => c.pureCount >= 20 }
    },
    {
      id: 'sprout', type: '森', weight: 16,
      base:    { id: 'spr0', name: '芽角', desc: '頭上的小樹苗每天長一點點，被稱讚時會開一朵小花。',
                 prompt: 'a gentle fawn with sapling antlers, moss-green spots on its back, leaf-shaped ears, big soft eyes, tiny flower on antler' },
      normal:  { id: 'spr1', name: '森冠鹿', desc: '鹿角長成一頂葉冠，走過的地方會冒出新芽。',
                 prompt: 'a noble stag, antlers forming a lush leafy crown, mossy bark plates on chest, green and earth-brown palette, standing proud' },
      special: { id: 'spr2', name: '櫻枝鹿', desc: '在假日的悠閒裡長成的變種，角上開滿了櫻花。',
                 prompt: 'a graceful stag with cherry-blossom branch antlers, petals drifting around it, pale pink and cream palette, serene pose' },
      hidden:  { id: 'spr3', name: '古樹守', desc: '清晨第一道光裡醒來的守護者，背上長著一整棵古樹。',
                 prompt: 'a colossal guardian elk, an ancient tree growing on its back, roots wrapping its legs, glowing golden sap veins, bathed in dawn light, awe-inspiring' },
      sp: { label: '在週末通過試煉', test: c => c.weekend },
      hd: { hint: '太陽剛升起的時候……', label: '在清晨（05:00–07:00）開始試煉並通過', test: c => c.startHour >= 5 && c.startHour < 7 }
    },
    {
      id: 'eye', type: '影', weight: 12,
      base:    { id: 'eye0', name: '夜瞳', desc: '一半像貓一半像貓頭鷹，眼睛大得能映出整片夜空。',
                 prompt: 'a small owl-cat hybrid, huge reflective golden eyes, dusk-purple feathers, tufted cat ears, sitting curiously' },
      normal:  { id: 'eye1', name: '影梟', desc: '翅膀像斗篷，邊緣化成煙。牠飛過時沒有一點聲音。',
                 prompt: 'a tall shadow owl, cloak-like wings dissolving into smoke at the edges, glowing violet eyes, dark purple and black palette, mysterious stance' },
      special: { id: 'eye2', name: '千瞳梟', desc: '見過越多同伴，翅膀上的眼紋就越多。',
                 prompt: 'a mystic owl with many glowing eye patterns across its wings, purple and gold palette, wings spread wide, hypnotic' },
      hidden:  { id: 'eye3', name: '虛月', desc: '在漫長的安撫裡沉靜下來的影子，身體裡藏著星空。',
                 prompt: 'an ethereal crescent-moon owl spirit, body partly made of starry void, silver mask-like face, floating, calm and otherworldly' },
      sp: { label: '圖鑑中收集 4 種以上不同的基礎異獸後通過試煉', test: c => c.dexBase >= 4 },
      hd: { hint: '安靜下來的時間夠長的話……', label: '累計安撫 180 分鐘以上，再通過試煉', test: c => c.sootheTotal >= 180 }
    },
    {
      id: 'gem', type: '晶', weight: 6,
      base:    { id: 'gem0', name: '晶殼', desc: '背著一片石英殼的小傢伙，害羞時會縮成一顆寶石。',
                 prompt: 'a small pangolin-like creature with a shell of pastel quartz crystals, shy expression, curled tail, gems sparkling' },
      normal:  { id: 'gem1', name: '晶甲獸', desc: '全身長滿晶甲，堅硬到連雷都劈不開。',
                 prompt: 'a sturdy armored beast covered in faceted crystal plates, lilac and pale pink palette, powerful planted stance, light glinting' },
      special: { id: 'gem2', name: '稜鏡獸', desc: '修練得夠久，晶刺會開始折射彩虹。',
                 prompt: 'a sleek beast with prism crystal spines casting rainbow light, iridescent palette, elegant poised stance' },
      hidden:  { id: 'gem3', name: '星核獸', desc: '整場試煉只專心做一件事的人，才能打開牠胸口的星核。',
                 prompt: 'a beast with a glowing star core in its chest, geode body cracked open revealing a galaxy inside, deep blue and gold palette, cosmic aura' },
      sp: { label: '夥伴等級 15 以上時通過試煉', test: c => c.lv >= 15 },
      hd: { hint: '心無旁騖，只做一件事……', label: '整場試煉只使用 1 個白名單程式', test: c => c.appsUsed <= 1 }
    }
  ];

  const FORMS = {};
  LINES.forEach(L => ['base', 'normal', 'special', 'hidden'].forEach(k => {
    FORMS[L[k].id] = Object.assign({ line: L.id, type: L.type, route: k }, L[k]);
    L[k] = FORMS[L[k].id];
  }));

  const data = { TYPES, LINES, FORMS, STYLE_PROMPT };
  if (typeof module !== 'undefined') module.exports = data; else root.BEAST_DATA = data;
})(typeof window !== 'undefined' ? window : globalThis);
