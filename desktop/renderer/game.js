/* 專注異獸錄 — 遊戲邏輯與介面 */
(function () {
'use strict';
const { TYPES, LINES, FORMS, STYLE_PROMPT } = window.BEAST_DATA;
const API = window.beast || null;           // Electron 提供；在一般瀏覽器裡為 null（可用模擬分心測試）
const LIMIT = 5 * 60 * 1000;                // 一般專注：分心累計上限
const STRICT_GRACE = 5000;                  // 試煉：離開白名單超過 5 秒即失敗
const SOOTHE_NEED = 60;                     // 失衡後需要累積的安撫分鐘
const EVO_LV = 10, EVO2_LV = 25, MAX_LV = 30;
const ROUTE_ZH = { base: '基礎型', normal: '普通進化', special: '特殊進化', hidden: '隱藏進化', normal2: '普通・二階', special2: '特殊・二階', hidden2: '隱藏・二階' };
const BROWSERS = ['chrome', 'msedge', 'firefox', 'brave', 'opera', 'vivaldi', 'arc'];
const SYSTEM_OK = ['lockapp', 'logonui', 'shellexperiencehost', 'startmenuexperiencehost', 'searchhost', 'searchapp', 'shellhost', ''];

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const need = lv => 20 + lv * 5;
const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const mss = ms => { const s = Math.floor(Math.max(0, ms) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const mmss = ms => { const s = Math.ceil(Math.max(0, ms) / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const lineOf = b => LINES.find(L => L.id === b.line);
const formOf = b => FORMS[b.form];
const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------- 存檔 ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('fb.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { v == null ? localStorage.removeItem('fb.' + k) : localStorage.setItem('fb.' + k, JSON.stringify(v)); } catch (e) {} }
};
const DEFAULT_RULES = {
  apps: ['Obsidian', 'Code', 'WINWORD', 'EXCEL', 'POWERPNT', 'ONENOTE', 'notepad', 'Acrobat', 'AcroRd32', 'SumatraPDF', 'explorer'],
  sites: ['考選部', '全國法規資料庫', 'Obsidian', 'GitHub', 'Google 文件', 'Notion']
};
let S = store.get('state', null) || { beasts: [], partner: null, dex: {}, days: {}, totalMin: 0, sessions: 0, rules: DEFAULT_RULES, test: false, artStamp: {} };
S.rules = S.rules || DEFAULT_RULES; S.artStamp = S.artStamp || {}; S.dex = S.dex || {}; S.days = S.days || {};
let SES = store.get('session', null);       // 進行中的專注
const save = () => store.set('state', S);
const saveSes = () => store.set('session', SES);

let info = { platform: 'web', artDir: '' };
let view = 'home', teamSel = null, focusKind = 'train', focusDur = 25;
let fg = null, fgAt = 0, simOff = false;
const recents = [];

/* ---------- 異獸 ---------- */
function newBeast(lineId, lv = 1) {
  const L = LINES.find(x => x.id === lineId);
  const b = { uid: uid(), line: lineId, form: L.base.id, lv, exp: 0, bond: 0, status: 'ok', soothe: 0, sootheTotal: 0, failCount: 0, pureCount: 0, caughtAt: Date.now() };
  S.dex[L.base.id] = true;
  return b;
}
const partner = () => S.beasts.find(b => b.uid === S.partner) || null;
function addExp(b, amt) {
  let up = 0; b.exp += amt;
  while (b.lv < MAX_LV && b.exp >= need(b.lv)) { b.exp -= need(b.lv); b.lv++; up++; }
  if (b.lv >= MAX_LV) b.exp = Math.min(b.exp, need(b.lv));
  return up;
}
const canEvolve = b => { if (!b || b.status !== 'ok') return false; const f = formOf(b); return (f.stage === 0 && b.lv >= EVO_LV) || (f.stage === 1 && b.lv >= EVO2_LV); };
const nextLv = b => formOf(b).stage === 0 ? EVO_LV : EVO2_LV;
function streak() {
  let n = 0; const d = new Date();
  if (!S.days[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (S.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const dexBase = () => LINES.filter(L => S.dex[L.base.id]).length;

/* ---------- 工作模式：判斷目前視窗是否允許 ---------- */
function classify(w) {
  if (!w) return { ok: true, label: '尚未偵測', sys: true };
  const p = (w.p || '').toLowerCase();
  if (w.self) return { ok: true, label: '專注異獸錄', sys: true };
  if (w.locked || SYSTEM_OK.includes(p)) return { ok: true, label: w.locked ? '螢幕已鎖定' : '系統畫面', sys: true };
  const label = (w.t ? w.t + ' — ' : '') + w.p;
  if (BROWSERS.includes(p)) {
    const t = (w.t || '').toLowerCase();
    const hit = S.rules.sites.find(k => k && t.includes(k.toLowerCase()));
    return { ok: !!hit, label, app: hit ? '網站：' + hit : null, browser: true };
  }
  const hit = S.rules.apps.find(a => a && a.toLowerCase() === p);
  return { ok: !!hit, label, app: hit ? w.p : null };
}
function currentClass() {
  if (simOff) return { ok: false, label: '（模擬）YouTube — chrome' };
  if (!API || info.platform !== 'win32') return { ok: true, label: info.platform === 'win32' ? '偵測中' : '非 Windows：不偵測', sys: true };
  if (Date.now() - fgAt > 6000) return { ok: true, label: '偵測中…', sys: true };
  return classify(fg);
}
if (API) API.onForeground(w => {
  fg = w; fgAt = Date.now();
  if (!w.self && !w.locked && w.p) {
    const key = w.p + '|' + (w.t || '');
    const i = recents.findIndex(r => r.key === key);
    if (i >= 0) recents.splice(i, 1);
    recents.unshift({ key, p: w.p, t: w.t || '' });
    if (recents.length > 14) recents.pop();
  }
});

/* ---------- 美術 ---------- */
function artSrcs(id) {
  const list = [];
  if (info.artDir) list.push(encodeURI('file:///' + info.artDir.replace(/\\/g, '/') + '/' + id + '.png') + '?v=' + (S.artStamp[id] || 0));
  list.push('art/' + id + '.png');
  return list;
}
function art(id, { known = true, cls = '' } = {}) {
  const f = FORMS[id], c = TYPES[f.type].color, src = artSrcs(id);
  return `<div class="art ${known ? '' : 'unknown'} ${cls}" style="--tc:${c}"><div class="ph">${f.type}<small>待生圖</small></div><img alt="${esc(f.name)}" src="${src[0]}" data-alt="${src.slice(1).join('|')}" class="artimg"></div>`;
}
document.addEventListener('error', e => { if (e.target && e.target.classList && e.target.classList.contains('artimg')) artFail(e.target); }, true);
function artFail(img) {
  const rest = (img.dataset.alt || '').split('|').filter(Boolean);
  if (rest.length) { img.dataset.alt = rest.slice(1).join('|'); img.src = rest[0]; } else img.remove();
}

/* ---------- 介面共用 ---------- */
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2400); }
function modal(html) { $('#modalBox').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !$('#modal').dataset.lock) closeModal(); });
document.querySelectorAll('#nav > button').forEach(b => b.onclick = () => go(b.dataset.view));
function go(v) {
  if (SES) v = 'session';
  view = v;
  document.querySelectorAll('#nav > button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  $('#nav').classList.toggle('locked', !!SES);
  render();
}
function foot() {
  const today = S.days[dayKey()] || 0;
  $('#sideFoot').innerHTML = `<span>今日專注 <b class="num">${Math.round(today)}</b> 分</span><span>連續 <b class="num">${streak()}</b> 天</span>${S.test ? '<span style="color:var(--warn)">測試模式</span>' : ''}`;
}
function render() {
  foot();
  const m = $('#main');
  ({ home: vHome, focus: vFocus, team: vTeam, dex: vDex, studio: vStudio, settings: vSettings, session: vSession })[view](m);
}

/* ---------- 據點 ---------- */
function vHome(m) {
  const b = partner();
  if (!b) { m.innerHTML = ''; return starter(); }
  const f = formOf(b), L = lineOf(b), c = TYPES[f.type].color;
  const evo = canEvolve(b), unstable = b.status === 'unstable';
  m.innerHTML = `
  <div class="eyebrow">據點・夥伴</div>
  <div class="hero" style="--tc:${c}">
    <div class="pulse">${art(f.id)}</div>
    <div class="grid">
      <div class="row"><span class="chip type" style="--tc:${c}">${f.type}屬性</span><span class="chip">${ROUTE_ZH[f.route]}</span>${unstable ? '<span class="chip bad">失衡中</span>' : ''}</div>
      <div class="name">${esc(f.name)}</div>
      <p class="lead" style="margin:0">${esc(f.desc)}</p>
      <div class="grid" style="gap:6px">
        <div class="row" style="justify-content:space-between"><span>Lv <b class="num" style="font-size:20px">${b.lv}</b></span><span class="num" style="color:var(--muted)">${Math.floor(b.exp)} / ${need(b.lv)} EXP</span></div>
        <div class="bar"><i style="width:${b.lv >= MAX_LV ? 100 : Math.min(100, b.exp / need(b.lv) * 100)}%"></i></div>
      </div>
      <div class="stats">
        <div class="stat"><div class="k">羈絆</div><div class="v">${b.bond}</div></div>
        <div class="stat"><div class="k">零分心專注</div><div class="v">${b.pureCount}</div></div>
        <div class="stat"><div class="k">${unstable ? '安撫進度' : '試煉失敗'}</div><div class="v">${unstable ? Math.floor(b.soothe) + '/' + SOOTHE_NEED : b.failCount}</div></div>
      </div>
      <div class="actions">
        ${unstable ? `<button class="act hot" data-k="soothe"><b>安撫</b><span>累積 ${SOOTHE_NEED} 分鐘、分心不超過 20% 的專注，讓夥伴恢復</span></button>` :
          `<button class="act" data-k="train"><b>修練</b><span>專注讓夥伴獲得大量經驗與羈絆</span></button>`}
        <button class="act" data-k="explore"><b>探索</b><span>到荒野尋找新的異獸，夥伴也會成長</span></button>
        ${evo ? `<button class="act hot" data-k="trial"><b>${f.stage === 0 ? '進化試煉' : '二階進化試煉'}</b><span>全程不得離開白名單，打斷即失敗${f.stage === 1 ? '・90 分鐘起' : ''}</span></button>` :
          f.stage < 2 ? `<button class="act" disabled><b>${f.stage === 0 ? '進化試煉' : '二階進化試煉'}</b><span>${unstable ? '失衡中無法挑戰' : '夥伴 Lv ' + nextLv(b) + ' 解鎖' + (f.stage === 1 ? '，試煉需 90 分鐘以上' : '')}</span></button>` :
          `<button class="act" disabled><b>已達最終形態</b><span>${esc(f.name)} 已經完成兩階進化</span></button>`}
        <button class="act" data-go="team"><b>隊伍</b><span>${S.beasts.length} 隻異獸・更換夥伴</span></button>
      </div>
    </div>
  </div>`;
  m.querySelectorAll('[data-k]').forEach(x => x.onclick = () => { focusKind = x.dataset.k; focusDur = defaultDur(focusKind); go('focus'); });
  m.querySelectorAll('[data-go]').forEach(x => x.onclick = () => go(x.dataset.go));
}
function starter() {
  $('#modal').dataset.lock = '1';
  const opts = LINES.filter(L => L.starter);
  modal(`<div class="eyebrow">第一次來到據點</div><h1>選一隻異獸當夥伴</h1>
    <p class="lead" style="margin:0">牠會陪你專注、跟著你成長。之後也能在探索中遇見其他異獸。</p>
    <div class="grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">${opts.map(L => `
      <button class="bcard" data-l="${L.id}" style="--tc:${TYPES[L.type].color}">${art(L.base.id)}<span class="nm">${L.base.name}</span>
      <span class="chip type" style="--tc:${TYPES[L.type].color};align-self:flex-start">${L.type}屬性</span><span style="font-size:12px;color:var(--muted)">${L.base.desc}</span></button>`).join('')}</div>`);
  $('#modalBox').querySelectorAll('[data-l]').forEach(x => x.onclick = () => {
    const b = newBeast(x.dataset.l, 3); S.beasts.push(b); S.partner = b.uid; save();
    delete $('#modal').dataset.lock; closeModal(); go('home');
  });
}

/* ---------- 專注設定 ---------- */
const DURS = { train: [15, 25, 45, 60], explore: [15, 25, 45, 60], soothe: [15, 25, 45, 60], trial: [45, 60, 90, 120] };
const defaultDur = k => k === 'trial' ? (partner() && formOf(partner()).stage === 1 ? 90 : 45) : 25;
function vFocus(m) {
  const b = partner(); if (!b) return go('home');
  const unstable = b.status === 'unstable';
  if (unstable && (focusKind === 'train' || focusKind === 'trial')) focusKind = 'soothe';
  if (!unstable && focusKind === 'soothe') focusKind = 'train';
  if (focusKind === 'trial' && !canEvolve(b)) focusKind = 'train';
  let durs = DURS[focusKind].slice(); if (focusKind === 'trial' && formOf(b).stage === 1) durs = [90, 120, 150]; if (S.test && focusKind !== 'trial') durs.unshift(1); if (S.test && focusKind === 'trial') durs.unshift(2);
  if (!durs.includes(focusDur)) focusDur = durs.includes(defaultDur(focusKind)) ? defaultDur(focusKind) : durs[0];
  const kinds = [
    ['train', '修練', '夥伴經驗 ×1.5、羈絆提升', unstable],
    ['explore', '探索', '捕捉新異獸，越久越稀有', false],
    ['trial', '進化試煉', '通過就進化，打斷即失敗', !canEvolve(b)],
    ['soothe', '安撫', '失衡時恢復夥伴', !unstable]
  ];
  const strict = focusKind === 'trial';
  m.innerHTML = `<div class="eyebrow">專注</div><h1>這次要做什麼？</h1><p class="lead">夥伴：${esc(formOf(b).name)}・Lv ${b.lv}</p>
  <div class="grid" style="gap:22px;max-width:860px">
    <div class="kinds">${kinds.map(([k, n, d, dis]) => `<button class="kind" data-k="${k}" aria-pressed="${k === focusKind}" ${dis ? 'disabled' : ''}><b>${n}</b><span>${d}</span></button>`).join('')}</div>
    <div class="grid" style="gap:8px"><span class="eyebrow">時間（分鐘）</span><div class="durs">${durs.map(d => `<button class="dur" data-d="${d}" aria-pressed="${d === focusDur}">${d}</button>`).join('')}</div></div>
    ${strict ? trialPreview(b) : ''}
    <div class="rulebox ${strict ? 'strict' : ''}">${strict
      ? `試煉規則：整場只能用白名單程式和網站。離開超過 ${STRICT_GRACE / 1000} 秒就算失敗，夥伴會進入「失衡」，需要累積 ${SOOTHE_NEED} 分鐘安撫才能再挑戰。`
      : `工作模式：白名單以外的程式和網站都會記錄成分心，並降低這次的收穫。分心累計滿 5 分鐘，這次專注就失敗。`}</div>
    <div class="row"><button class="btn primary" id="go">開始專注</button><button class="btn" data-go="settings">檢查白名單</button></div>
  </div>`;
  m.querySelectorAll('[data-k]').forEach(x => x.onclick = () => { focusKind = x.dataset.k; focusDur = defaultDur(focusKind); render(); });
  m.querySelectorAll('[data-d]').forEach(x => x.onclick = () => { focusDur = +x.dataset.d; render(); });
  m.querySelector('[data-go]').onclick = () => go('settings');
  $('#go').onclick = () => startSession(focusKind, focusDur);
}
function trialPreview(b) {
  const L = lineOf(b), f = formOf(b);
  if (f.stage === 1) {
    const g = FORMS[f.next];
    return `<div class="grid" style="gap:8px"><span class="eyebrow">二階進化（沿著目前的路線）</span><div class="routes"><div class="route"><div style="--tc:${TYPES[g.type].color}">${art(g.id, { known: !!S.dex[g.id] })}</div><div><div class="rk">${ROUTE_ZH[g.route]}</div><b>${S.dex[g.id] ? esc(g.name) : '？？？'}</b><p>${esc(f.name)} 的下一個樣子。Lv ${EVO2_LV} 以上，通過 90 分鐘以上的試煉。</p></div></div></div></div>`;
  }
  const hdKnown = S.dex[L.hidden.id];
  const row = (k, f, cond) => `<div class="route"><div style="--tc:${TYPES[f.type].color}">${art(f.id, { known: !!S.dex[f.id] || k === 'normal' })}</div><div><div class="rk">${ROUTE_ZH[k]}</div><b>${k === 'hidden' && !hdKnown ? '？？？' : esc(f.name)}</b><p>${cond}</p></div></div>`;
  return `<div class="grid" style="gap:8px"><span class="eyebrow">可能的進化路線（隱藏 &gt; 特殊 &gt; 普通，符合條件者優先）</span><div class="routes">
    ${row('normal', L.normal, '通過試煉即可')}
    ${row('special', L.special, L.sp.label)}
    ${row('hidden', L.hidden, hdKnown ? L.hd.label : L.hd.hint)}</div></div>`;
}

/* ---------- 專注進行中 ---------- */
function startSession(kind, dur) {
  const b = partner(); const now = new Date();
  SES = { kind, dur, startAt: Date.now(), lastAt: Date.now(), distractMs: 0, offRun: 0, log: [], apps: [], partner: b.uid,
          startHour: now.getHours(), weekend: now.getDay() === 0 || now.getDay() === 6, strict: kind === 'trial' };
  saveSes(); if (API) API.setRunning(true);
  go('session');
}
let tickT = null, saveT = 0;
function vSession(m) {
  if (!SES) return go('home');
  const b = S.beasts.find(x => x.uid === SES.partner) || partner();
  const f = formOf(b), c = TYPES[f.type].color;
  const title = { train: '修練中', explore: '探索中', trial: '進化試煉中', soothe: '安撫中' }[SES.kind];
  m.innerHTML = `<div class="eyebrow">${title}</div>
  <div class="session" style="--tc:${c}">
    <div class="pulse">${art(f.id)}</div>
    <div class="grid" style="gap:18px">
      <div><div class="timer" id="tm">--:--</div><div style="color:var(--muted)">${esc(f.name)}・${SES.dur} 分鐘${SES.strict ? '・<span style="color:var(--bad)">打斷即失敗</span>' : ''}</div></div>
      <div class="now" id="now"><span class="dot"></span><span class="t" id="nowT">偵測中…</span></div>
      ${SES.strict ? '' : `<div class="grid" style="gap:6px"><div class="row" style="justify-content:space-between;font-size:13px;color:var(--muted)"><span>分心時間</span><span class="num" id="dt">0:00 / 5:00</span></div><div class="bar"><i id="db" style="width:0;background:var(--bad)"></i></div></div>`}
      <div class="grid" style="gap:6px"><span class="eyebrow">分心紀錄</span><div class="log" id="log"><div><span>目前沒有分心</span></div></div></div>
      <div class="row">
        <button class="btn danger" id="quit">放棄</button>
        ${!API || S.test ? '<button class="btn" id="sim">模擬切到非白名單程式</button>' : ''}
      </div>
    </div>
  </div>`;
  $('#quit').onclick = e => {
    const x = e.currentTarget;
    if (!x.dataset.arm) { x.dataset.arm = 1; x.textContent = SES.strict ? '再按一次：試煉會失敗' : '再按一次確定放棄'; setTimeout(() => { if (x.isConnected) { delete x.dataset.arm; x.textContent = '放棄'; } }, 3000); return; }
    fail('你放棄了這次專注');
  };
  const sim = $('#sim'); if (sim) sim.onclick = () => { simOff = !simOff; sim.textContent = simOff ? '回到白名單程式' : '模擬切到非白名單程式'; };
  clearInterval(tickT); tickT = setInterval(tick, 250); tick();
}
function tick() {
  if (!SES) { clearInterval(tickT); return; }
  const now = Date.now(), dt = Math.min(5000, now - SES.lastAt); SES.lastAt = now;
  const cl = currentClass();
  if (!cl.ok) {
    SES.distractMs += dt; SES.offRun += dt;
    const last = SES.log[SES.log.length - 1];
    if (last && last.open && last.label === cl.label) last.ms += dt; else { if (last) last.open = false; SES.log.push({ label: cl.label, ms: dt, open: true }); }
  } else {
    SES.offRun = 0; const last = SES.log[SES.log.length - 1]; if (last) last.open = false;
    if (cl.app && !SES.apps.includes(cl.app)) SES.apps.push(cl.app);
  }
  const left = SES.dur * 60000 - (now - SES.startAt);
  const tm = $('#tm');
  if (tm) {
    tm.textContent = mmss(left);
    $('#now').classList.toggle('off', !cl.ok);
    $('#nowT').textContent = (cl.ok ? '' : '分心中：') + cl.label;
    if ($('#dt')) { $('#dt').textContent = mss(SES.distractMs) + ' / 5:00'; $('#db').style.width = Math.min(100, SES.distractMs / LIMIT * 100) + '%'; }
    const logs = SES.log.filter(l => l.ms >= 1000);
    $('#log').innerHTML = logs.length ? logs.slice(-8).reverse().map(l => `<div><span>${esc(l.label)}</span><span class="num">${mss(l.ms)}</span></div>`).join('') : '<div><span>目前沒有分心</span></div>';
  }
  if (now - saveT > 5000) { saveT = now; saveSes(); }
  if (SES.strict && SES.offRun >= STRICT_GRACE) return fail('試煉中離開了白名單：' + cl.label);
  if (!SES.strict && SES.distractMs >= LIMIT) return fail('分心累計滿 5 分鐘');
  if (left <= 0) complete();
}
function endSession() { clearInterval(tickT); simOff = false; const s = SES; SES = null; store.set('session', null); if (API) API.setRunning(false); return s; }
function logSummary(s) {
  const agg = {}; s.log.forEach(l => { agg[l.label] = (agg[l.label] || 0) + l.ms; });
  const rows = Object.entries(agg).filter(([, ms]) => ms >= 1000).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return rows.length ? `<div class="grid" style="gap:6px"><span class="eyebrow">這次的分心紀錄</span><div class="log">${rows.map(([k, ms]) => `<div><span>${esc(k)}</span><span class="num">${mss(ms)}</span></div>`).join('')}</div></div>` : '<p class="lead" style="margin:0">全程沒有分心。</p>';
}
function notify(t, b) { if (API) API.notify(t, b); }

function fail(reason) {
  const s = endSession(); const b = S.beasts.find(x => x.uid === s.partner);
  let title = '這次專注失敗了', body = reason + '。';
  if (s.kind === 'trial' && b) {
    b.status = 'unstable'; b.soothe = 0; b.failCount++;
    title = '進化試煉失敗'; body = `${reason}。${formOf(b).name}的力量失控，進入了失衡狀態。累積 ${SOOTHE_NEED} 分鐘的安撫，才能再挑戰試煉。`;
  } else if (s.kind === 'explore') body = reason + '，異獸察覺到動靜，逃走了。';
  else if (s.kind === 'train' && b) { b.bond = Math.max(0, b.bond - 1); body = reason + '，這次修練沒有收穫，羈絆 -1。'; }
  save(); notify(title, body);
  modal(`<div class="eyebrow">結果</div><h1 style="color:var(--bad)">${title}</h1><p style="margin:0">${esc(body)}</p>${logSummary(s)}<div class="row"><button class="btn primary" id="ok">回到據點</button></div>`);
  $('#ok').onclick = () => { closeModal(); go('home'); };
}

function pickLine(min) {
  const w = LINES.map(L => L.weight * (L.weight < 20 ? 1 + min / 30 : 1));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < LINES.length; i++) { if ((r -= w[i]) <= 0) return LINES[i]; }
  return LINES[0];
}
function complete() {
  const s = endSession(); const b = S.beasts.find(x => x.uid === s.partner);
  const min = s.dur, purity = Math.max(0, 1 - s.distractMs / LIMIT), pure = s.distractMs < 1000, mult = S.test ? 20 : 1;
  S.days[dayKey()] = (S.days[dayKey()] || 0) + min; S.totalMin += min; S.sessions++;
  if (pure && b) b.pureCount++;
  let html = '', title = '專注完成';
  if (s.kind === 'train') {
    const up = addExp(b, min * 1.5 * purity * mult); const gain = pure ? 3 : purity >= .8 ? 2 : 1; b.bond += gain;
    html = `<p style="margin:0">${esc(formOf(b).name)} 獲得 <b class="num">${Math.round(min * 1.5 * purity * mult)}</b> 經驗，羈絆 +${gain}${up ? `，升到 <b>Lv ${b.lv}</b>！` : '。'}</p>${purity < 1 ? `<p class="lead" style="margin:0">分心讓收穫打了 ${Math.round(purity * 100)} 折。</p>` : ''}`;
    if (canEvolve(b)) html += `<p style="margin:0;color:var(--accent)">${esc(formOf(b).name)} 身上出現了進化的徵兆，可以挑戰進化試煉了。</p>`;
  } else if (s.kind === 'explore') {
    const L = pickLine(min), lv = Math.max(1, Math.round(1 + min / 10 * purity)); const isNew = !S.dex[L.base.id];
    const nb = newBeast(L.id, lv); S.beasts.push(nb);
    const up = b ? addExp(b, min * .5 * purity * mult) : 0;
    title = isNew ? '發現新的異獸！' : '捕捉成功';
    html = `<div style="max-width:260px;align-self:center;width:100%">${art(L.base.id, { cls: 'evo' })}</div><h2 style="text-align:center">${esc(L.base.name)}・Lv ${lv}</h2><p class="lead" style="margin:0;text-align:center">${esc(L.base.desc)}</p>${b ? `<p style="margin:0">${esc(formOf(b).name)} 也獲得了 ${Math.round(min * .5 * purity * mult)} 經驗${up ? `，升到 Lv ${b.lv}` : ''}。</p>` : ''}`;
  } else if (s.kind === 'soothe') {
    if (purity >= .8) {
      b.soothe += min * (S.test ? 30 : 1); b.sootheTotal += min * (S.test ? 30 : 1);
      if (b.soothe >= SOOTHE_NEED) { b.status = 'ok'; b.soothe = 0; title = '夥伴恢復了'; html = `<p style="margin:0">${esc(formOf(b).name)} 平靜下來，可以再次挑戰進化試煉。</p>`; }
      else html = `<p style="margin:0">安撫進度 ${Math.floor(b.soothe)} / ${SOOTHE_NEED} 分鐘。</p>`;
    } else { title = '安撫沒有效果'; html = `<p style="margin:0">分心超過 20%，夥伴沒有平靜下來，這次不計入安撫。</p>`; }
  } else if (s.kind === 'trial') {
    const L = lineOf(b);
    const ctx = { startHour: s.startHour, dur: s.dur, weekend: s.weekend, bond: b.bond, lv: b.lv, failCount: b.failCount, sootheTotal: b.sootheTotal,
                  streak: streak(), dexBase: dexBase(), pureCount: b.pureCount, appsUsed: s.apps.length };
    const cur = formOf(b);
    const route = cur.stage === 1 ? cur.route + '2' : L.hd.test(ctx) ? 'hidden' : L.sp.test(ctx) ? 'special' : 'normal';
    const before = cur.name; b.form = L[route].id; S.dex[b.form] = true; b.bond += 5;
    const f = formOf(b); title = cur.stage === 1 ? '二階進化！' : route === 'hidden' ? '隱藏進化！' : route === 'special' ? '特殊進化！' : '進化成功！';
    html = `<div style="max-width:300px;align-self:center;width:100%">${art(f.id, { cls: 'evo' })}</div><h2 style="text-align:center">${esc(before)} 進化成了 ${esc(f.name)}</h2><p class="lead" style="margin:0;text-align:center">${esc(f.desc)}</p>${route === 'hidden' || route === 'special' ? `<p style="margin:0;text-align:center;color:var(--accent)">觸發條件：${esc(route === 'hidden' ? L.hd.label : L.sp.label)}</p>` : ''}`;
  }
  save(); notify(title, '回到專注異獸錄查看結果。');
  modal(`<div class="eyebrow">結果・${min} 分鐘</div><h1>${title}</h1>${html}${logSummary(s)}<div class="row"><button class="btn primary" id="ok">回到據點</button></div>`);
  $('#ok').onclick = () => { closeModal(); go('home'); };
}

/* ---------- 隊伍 ---------- */
function vTeam(m) {
  if (!teamSel || !S.beasts.find(b => b.uid === teamSel)) teamSel = S.partner;
  const sel = S.beasts.find(b => b.uid === teamSel);
  const list = S.beasts.slice().sort((a, b) => (b.uid === S.partner) - (a.uid === S.partner) || b.lv - a.lv);
  m.innerHTML = `<div class="eyebrow">隊伍</div><h1>${S.beasts.length} 隻異獸</h1><p class="lead">夥伴會跟你一起專注、成長與進化。</p>
  ${sel ? detail(sel) : ''}
  <div class="grid cards" style="margin-top:20px">${list.map(b => { const f = formOf(b), c = TYPES[f.type].color; return `
    <button class="bcard ${b.uid === teamSel ? 'sel' : ''}" data-u="${b.uid}" style="--tc:${c}">${art(f.id)}<span class="nm">${esc(f.name)}</span>
    <span class="meta"><span class="num">Lv ${b.lv}</span>${b.uid === S.partner ? '<span class="chip ok">夥伴</span>' : b.status === 'unstable' ? '<span class="chip bad">失衡</span>' : `<span class="chip type" style="--tc:${c}">${f.type}</span>`}</span></button>`; }).join('')}</div>`;
  m.querySelectorAll('[data-u]').forEach(x => x.onclick = () => { teamSel = x.dataset.u; render(); });
  const sp = $('#setP'); if (sp) sp.onclick = () => { S.partner = teamSel; save(); toast('已設為夥伴'); render(); };
}
function detail(b) {
  const f = formOf(b), L = lineOf(b), c = TYPES[f.type].color;
  const route = (k, cond) => { const g = L[k], known = !!S.dex[g.id], here = b.form === g.id;
    return `<div class="route" style="${here ? 'box-shadow:inset 0 0 0 1px var(--accent)' : ''}"><div style="--tc:${c}">${art(g.id, { known: known || k === 'base' })}</div><div><div class="rk">${ROUTE_ZH[k]}${here ? '・目前' : ''}</div><b>${known || (k !== 'hidden' && k !== 'hidden2') ? esc(g.name) : '？？？'}</b><p>${cond}</p></div></div>`; };
  return `<div class="card detail" style="--tc:${c}"><div>${art(f.id)}</div><div class="grid" style="gap:10px;align-content:start">
    <div class="row"><h2 style="font-size:24px">${esc(f.name)}</h2><span class="chip type" style="--tc:${c}">${f.type}屬性</span>${b.status === 'unstable' ? `<span class="chip bad">失衡・安撫 ${Math.floor(b.soothe)}/${SOOTHE_NEED}</span>` : ''}</div>
    <p style="margin:0;color:var(--muted)">${esc(f.desc)}</p>
    <div class="stats"><div class="stat"><div class="k">等級</div><div class="v">${b.lv}</div></div><div class="stat"><div class="k">羈絆</div><div class="v">${b.bond}</div></div><div class="stat"><div class="k">零分心</div><div class="v">${b.pureCount}</div></div></div>
    <div class="routes">${route('base', '起點')}${route('normal', `Lv ${EVO_LV} 後通過進化試煉`)}${route('special', L.sp.label)}${route('hidden', S.dex[L.hidden.id] ? L.hd.label : L.hd.hint)}
      ${['normal2', 'special2', 'hidden2'].map(k => route(k, `由${L[k.slice(0, -1)].name}在 Lv ${EVO2_LV} 後通過 90 分鐘以上的試煉`)).join('')}</div>
    ${b.uid === S.partner ? '<span class="chip ok" style="align-self:flex-start">目前的夥伴</span>' : '<button class="btn primary" id="setP" style="align-self:flex-start">設為夥伴</button>'}
  </div></div>`;
}

/* ---------- 圖鑑 ---------- */
function vDex(m) {
  const n = Object.keys(S.dex).filter(k => FORMS[k]).length;
  m.innerHTML = `<div class="eyebrow">圖鑑</div><h1>${n} / ${Object.keys(FORMS).length}</h1><p class="lead">黑影是還沒見過的形態。隱藏進化的條件，只有親眼見過才會揭曉。</p>
  <div class="grid" style="gap:22px">${LINES.map(L => `<div class="grid" style="gap:8px"><div class="row"><h2>${L.base.name}系</h2><span class="chip type" style="--tc:${TYPES[L.type].color}">${L.type}</span></div>
    <div class="dexline">${['base', 'normal', 'special', 'hidden', null, 'normal2', 'special2', 'hidden2'].map(k => { if (!k) return '<div></div>'; const f = L[k], kn = !!S.dex[f.id]; return `<div class="dexcell" style="--tc:${TYPES[f.type].color}">${art(f.id, { known: kn })}<div>${kn ? esc(f.name) : '？？？'}</div><div class="r">${ROUTE_ZH[k]}</div></div>`; }).join('')}</div></div>`).join('')}</div>`;
}

/* ---------- 美術工作室 ---------- */
function vStudio(m) {
  m.innerHTML = `<div class="eyebrow">美術工作室</div><h1>替異獸換上 AI 生圖</h1>
  <p class="lead">複製提示詞到 ChatGPT、Midjourney 等工具生圖，再把 PNG 拖進對應的格子。建議先畫基礎型，再把基礎型的圖一起附上，請 AI 畫「同一隻生物的進化型」，前後才會像同一隻。</p>
  <div class="grid" style="gap:8px;margin-bottom:22px"><div class="row" style="justify-content:space-between"><span class="eyebrow">共用風格（每張都貼在最前面）</span><div class="row"><button class="btn small" id="cpStyle">複製</button>${API ? '<button class="btn small" id="openDir">打開圖片資料夾</button>' : ''}</div></div><div class="code">${esc(STYLE_PROMPT)}</div></div>
  <div class="grid studio">${Object.values(FORMS).map(f => `<div class="scell" data-id="${f.id}" style="--tc:${TYPES[f.type].color}">${art(f.id)}
    <div class="row" style="justify-content:space-between"><b>${esc(f.name)}</b><span class="chip">${ROUTE_ZH[f.route]}</span></div>
    <div class="acts"><button class="btn small" data-cp="${f.id}">複製提示詞</button><label class="btn small">匯入圖片<input type="file" accept="image/png,image/jpeg,image/webp" data-in="${f.id}" hidden></label>${S.artStamp[f.id] ? `<button class="btn small" data-rm="${f.id}">移除</button>` : ''}</div></div>`).join('')}</div>`;
  const copy = t => navigator.clipboard.writeText(t).then(() => toast('已複製')).catch(() => toast('複製失敗，請手動選取'));
  $('#cpStyle').onclick = () => copy(STYLE_PROMPT);
  if ($('#openDir')) $('#openDir').onclick = () => API.openArtDir();
  m.querySelectorAll('[data-cp]').forEach(x => x.onclick = () => copy(STYLE_PROMPT + ', ' + FORMS[x.dataset.cp].prompt));
  m.querySelectorAll('[data-in]').forEach(x => x.onchange = () => x.files[0] && importArt(x.dataset.in, x.files[0]));
  m.querySelectorAll('[data-rm]').forEach(x => x.onclick = async () => { if (API) await API.removeArt(x.dataset.rm); delete S.artStamp[x.dataset.rm]; save(); render(); });
  m.querySelectorAll('.scell').forEach(c => {
    c.addEventListener('dragover', e => { e.preventDefault(); c.classList.add('drag'); });
    c.addEventListener('dragleave', () => c.classList.remove('drag'));
    c.addEventListener('drop', e => { e.preventDefault(); c.classList.remove('drag'); const file = e.dataTransfer.files[0]; if (file) importArt(c.dataset.id, file); });
  });
}
function importArt(id, file) {
  if (!API) return toast('網頁版無法儲存圖片，請在電腦版使用');
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return toast('請選擇 PNG、JPG 或 WebP 圖片');
  const r = new FileReader();
  r.onload = async () => {
    try { await API.saveArt(id, r.result); S.artStamp[id] = Date.now(); save(); toast(FORMS[id].name + ' 已換上新圖'); render(); }
    catch (e) { toast('儲存失敗：' + (e.message || e)); }
  };
  r.readAsDataURL(file);
}

/* ---------- 工作模式設定 ---------- */
function vSettings(m) {
  const tags = (arr, key) => `<div class="tags">${arr.map((a, i) => `<span class="tag">${esc(a)}<button data-del="${key}:${i}" aria-label="移除 ${esc(a)}">×</button></span>`).join('') || '<span style="color:var(--muted)">（空的）</span>'}</div>`;
  const rec = recents.filter(r => !classify({ p: r.p, t: r.t }).ok).slice(0, 8);
  m.innerHTML = `<div class="eyebrow">工作模式設定</div><h1>白名單</h1><p class="lead">專注時只有這些程式和網站不算分心。專注異獸錄本身和鎖定畫面一律允許。</p>
  <div class="grid" style="gap:18px;max-width:860px">
    <div class="card grid" style="gap:10px"><h2>允許的程式</h2><p class="lead" style="margin:0">填程式的執行檔名稱（不含 .exe），例如 Obsidian、Code、WINWORD。</p>${tags(S.rules.apps, 'apps')}
      <div class="addrow"><input type="text" id="inApp" placeholder="例如 Obsidian"><button class="btn" id="addApp">加入</button></div></div>
    <div class="card grid" style="gap:10px"><h2>允許的網站</h2><p class="lead" style="margin:0">在瀏覽器裡，分頁標題含有這些字就算允許。例如「考選部」「全國法規資料庫」。</p>${tags(S.rules.sites, 'sites')}
      <div class="addrow"><input type="text" id="inSite" placeholder="例如 全國法規資料庫"><button class="btn" id="addSite">加入</button></div></div>
    <div class="card grid" style="gap:10px"><h2>最近用過、還不在白名單的視窗</h2>
      ${info.platform !== 'win32' ? '<p class="lead" style="margin:0">只有 Windows 電腦版會偵測視窗。</p>' : rec.length ? `<div class="recent">${rec.map((r, i) => `<div><span>${esc((r.t ? r.t + ' — ' : '') + r.p)}</span><button class="btn small" data-rec="${i}">${BROWSERS.includes(r.p.toLowerCase()) ? '允許這個網站' : '允許這個程式'}</button></div>`).join('')}</div>` : '<p class="lead" style="margin:0">切到其他程式再回來，這裡就會出現，可以一鍵加入。</p>'}</div>
    <div class="card grid" style="gap:10px"><h2>測試</h2><label class="switch"><input type="checkbox" id="test" ${S.test ? 'checked' : ''}>測試模式：可選 1–2 分鐘、經驗與安撫加速、顯示「模擬分心」按鈕</label></div>
  </div>`;
  const add = (key, v) => { v = (v || '').trim().replace(/\.exe$/i, ''); if (!v) return; if (!S.rules[key].includes(v)) S.rules[key].push(v); save(); render(); };
  $('#addApp').onclick = () => add('apps', $('#inApp').value);
  $('#addSite').onclick = () => add('sites', $('#inSite').value);
  $('#inApp').onkeydown = e => e.key === 'Enter' && add('apps', e.target.value);
  $('#inSite').onkeydown = e => e.key === 'Enter' && add('sites', e.target.value);
  m.querySelectorAll('[data-del]').forEach(x => x.onclick = () => { const [k, i] = x.dataset.del.split(':'); S.rules[k].splice(+i, 1); save(); render(); });
  m.querySelectorAll('[data-rec]').forEach(x => x.onclick = () => {
    const r = rec[+x.dataset.rec];
    if (BROWSERS.includes(r.p.toLowerCase())) { const site = r.t.split(/ - | — | – /)[0].trim().slice(0, 24); $('#inSite').value = site; $('#inSite').focus(); toast('可以把文字修短一點再按加入'); }
    else add('apps', r.p);
  });
  $('#test').onchange = e => { S.test = e.target.checked; save(); foot(); };
}

/* ---------- 啟動 ---------- */
(async function boot() {
  if (API) { try { info = await API.info(); } catch (e) {} }
  if (SES) {  // 上次專注時程式被關掉
    const s = SES; SES = s; fail('專注途中關閉了程式');
    return;
  }
  go('home');
})();
// 測試用：讓主控台可以檢查邏輯
window.__fb = { classify, addExp, need, streak, LINES, state: () => S };
})();
