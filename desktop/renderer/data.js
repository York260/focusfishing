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

  // 二階進化：每條一階路線各自再進化一次（Lv 25 + 90 分鐘以上的高階試煉）
  const STAGE2 = {
    kit: {
      normal2:  { id: 'kit4', name: '赫炎天狼', desc: '鬃毛燒成一輪小太陽。牠奔過的夜晚，會短暫地變成白天。',
                  from: '熾鬃狼', prompt: 'a majestic adult fire wolf lord, mane blazing like a small sun, heavy charcoal armor plates with molten orange seams, huge flaming tail, proud powerful stance' },
      special2: { id: 'kit5', name: '月蝕冥狼', desc: '蒼炎燒到極致，連月亮都被牠遮住。安靜得聽不見腳步聲。',
                  from: '蒼炎狼', prompt: 'an elegant adult eclipse wolf, midnight navy fur, cold blue-white flames, a dark eclipse moon ring floating behind its head, crescent marking, calm deadly gaze' },
      hidden2:  { id: 'kit6', name: '永燼鳳皇', desc: '不滅的火終於長出翅膀。每一次跌倒留下的灰，都成了牠的羽毛。',
                  from: '不滅燼王', prompt: 'a regal phoenix-wolf emperor, obsidian body with gold seams, large wings made of golden fire feathers, floating ember crown, long flowing fire tail, majestic' }
    },
    fin: {
      normal2:  { id: 'fin4', name: '滄瀾龍王', desc: '頭上的珊瑚長成王冠，一聲長吟就能讓整片海安靜下來。',
                  from: '潮鰭龍', prompt: 'a grand sea dragon king, long serpentine teal and white body, coral crown on its head, huge flowing fin sails, wave crests swirling around it, regal' },
      special2: { id: 'fin5', name: '冥海燈龍', desc: '住在最深的海溝，身上的燈籠是迷路的魚唯一的方向。',
                  from: '淵鰭龍', prompt: 'a colossal abyssal leviathan dragon, deep indigo body, rows of small round cyan lantern spots along its fins and body, long purple gill fronds, mysterious and calm' },
      hidden2:  { id: 'fin6', name: '星潮天鯨', desc: '背著一顆小月亮在星空裡游泳。牠經過的地方，潮汐就會準時到來。',
                  from: '月潮神鯨', prompt: 'a cosmic sky whale, deep blue body filled with white star dots and a pale galaxy swirl, a tiny moon floating on its back, long pink ribbon fins, tide rings around it, serene' }
    },
    zap: {
      normal2:  { id: 'zap4', name: '迅雷天鼯', desc: '展開翼膜的瞬間就已經在千里之外，只留下一聲雷響。',
                  from: '雷翼鼯', prompt: 'a large heroic storm glider lord, slate grey body with yellow belly, enormous jagged lightning-shaped wing membranes, lightning crest on its head, huge thunderbolt tail, dynamic diving pose' },
      special2: { id: 'zap5', name: '嵐神鼯', desc: '與夥伴的心意化成颱風之眼。周圍風雨再大，牠的中心永遠平靜。',
                  from: '嵐冠鼯', prompt: 'a storm deity glider, deep violet body with golden membranes, a mantle of swirling storm clouds, a calm glowing-free halo ring of a typhoon eye behind it, serene powerful pose' },
      hidden2:  { id: 'zap6', name: '萬雷帝', desc: '無數次心無雜念的專注，化成九條雷尾。天空聽牠號令。',
                  from: '天穹雷主', prompt: 'a supreme thunder emperor beast, white and gold body, armor of dark storm clouds, nine lightning-bolt tails fanned out behind, golden thunder crown, floating commanding pose' }
    },
    sprout: {
      normal2:  { id: 'spr4', name: '萬木鹿王', desc: '鹿角長成一整片森林，小鳥在上面築巢，從來不肯搬走。',
                  from: '森冠鹿', prompt: 'a mighty forest king stag, antlers grown into a lush tree canopy with a few tiny birds, bark armor on chest and shoulders, moss spots, noble stance' },
      special2: { id: 'spr5', name: '千櫻鹿神', desc: '走到哪裡，哪裡就是春天。花瓣從不落地，一直在牠身邊打轉。',
                  from: '櫻枝鹿', prompt: 'a graceful cherry blossom deer deity, cream and pale pink body, huge antlers full of pink sakura blossoms, a ring of floating petals around it, a sacred rope with paper charms around its neck, gentle' },
      hidden2:  { id: 'spr6', name: '世界樹靈鹿', desc: '背上的古樹長成了一座小小的世界，有山、有雲、有河流。',
                  from: '古樹守', prompt: 'a colossal world-tree spirit elk, a giant ancient tree on its back with a tiny floating island, little clouds and a small waterfall, roots wrapping its legs, golden sap lines, awe-inspiring but cute' }
    },
    eye: {
      normal2:  { id: 'eye4', name: '夜幕梟王', desc: '一展翅，天就黑了。牠是所有夜晚的主人。',
                  from: '影梟', prompt: 'a regal night sovereign owl, tall dark purple body, enormous cloak-like wings spread wide like the night sky, smoky edges, violet eyes, small crown of feathers, cat ears and tail' },
      special2: { id: 'eye5', name: '萬象天瞳', desc: '見過的一切都化成眼紋。牠能同時看見過去和未來。',
                  from: '千瞳梟', prompt: 'a mystic seer owl, purple and gold, wings covered in many round eye patterns, a large halo ring made of eye symbols behind its head, cat ears and tail, enigmatic pose' },
      hidden2:  { id: 'eye6', name: '永夜月神', desc: '安撫了無數個夜晚，終於成為月亮本身。',
                  from: '虛月', prompt: 'an ethereal moon goddess owl, starry deep blue body, silver mask face, a huge full moon halo behind it, translucent veil wings, flowing stardust ribbons, cat ears, serene floating' }
    },
    gem: {
      normal2:  { id: 'gem4', name: '晶岩巨獸', desc: '背上的晶甲長成一座小山。牠站著不動，就是最堅固的城牆。',
                  from: '晶甲獸', prompt: 'a massive crystal titan beast on four thick legs, cream body, a small mountain of large faceted lilac and pink crystals on its back, huge crystal horn, crystal mace tail, unshakable stance' },
      special2: { id: 'gem5', name: '虹光聖獸', desc: '每一根稜鏡都折射著不同的顏色。看到牠的人，會想起最開心的事。',
                  from: '稜鏡獸', prompt: 'a holy prism qilin beast, elegant cream body, long prism crystal spines with rainbow color stripes, a rainbow mane, prism horn, graceful noble pose' },
      hidden2:  { id: 'gem6', name: '銀河核獸', desc: '胸口的星核擴大成一整條銀河。牠的身體裡，有星星正在誕生。',
                  from: '星核獸', prompt: 'a cosmic galaxy core titan beast, geode body cracked open showing a deep blue galaxy with white stars, a large golden star core in its chest, deep blue and gold crystal armor, golden horn, majestic' }
    }
  };
  LINES.forEach(L => Object.assign(L, STAGE2[L.id]));

  const ROUTES = ['base', 'normal', 'special', 'hidden', 'normal2', 'special2', 'hidden2'];
  const STAGE = { base: 0, normal: 1, special: 1, hidden: 1, normal2: 2, special2: 2, hidden2: 2 };
  const FORMS = {};
  LINES.forEach(L => ROUTES.forEach(k => {
    FORMS[L[k].id] = Object.assign({ line: L.id, type: L.type, route: k, stage: STAGE[k] }, L[k]);
    L[k] = FORMS[L[k].id];
  }));
  // 一階 → 二階的對應
  LINES.forEach(L => ['normal', 'special', 'hidden'].forEach(k => { L[k].next = L[k + '2'].id; }));

  const data = { TYPES, LINES, FORMS, STYLE_PROMPT };
  if (typeof module !== 'undefined') module.exports = data; else root.BEAST_DATA = data;
})(typeof window !== 'undefined' ? window : globalThis);
