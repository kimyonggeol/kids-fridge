/* 아이 냉장고 파먹기 — PWA
 * 데이터: data/ingredients.json, data/recipes.json (자동 업데이트)
 * 저장: localStorage (+ Supabase 가족 공유)
 */
const CFG = window.KF_CONFIG || {};
const APP_VERSION = '1.0.0';

/* ───────────── 유틸 ───────────── */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
};
const todayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const cho = s => [...s].map(c => { const k = c.charCodeAt(0) - 0xAC00; return k >= 0 && k < 11172 ? CHO[Math.floor(k / 588)] : c; }).join('');
const norm = s => String(s).replace(/\s+/g, '').toLowerCase();
const isCho = q => /^[ㄱ-ㅎ]+$/.test(q);

/* ───────────── 상수 ───────────── */
const CAT_INFO = {
  '밥죽': { label: '밥·죽', ic: '🍚' }, '메인': { label: '메인', ic: '🍖' }, '반찬': { label: '반찬', ic: '🥗' },
  '국': { label: '국', ic: '🥣' }, '간식': { label: '간식', ic: '🍪' }, '핑거': { label: '핑거푸드', ic: '🧆' },
};
const CATS = Object.keys(CAT_INFO);
const MEALS = ['아침', '점심', '저녁', '간식'];
const MEAL_DEFAULT_CATS = { '아침': ['밥죽', '반찬'], '점심': ['밥죽', '메인', '국'], '저녁': ['밥죽', '메인', '반찬', '국'], '간식': ['간식', '핑거'] };
const TOOLS = ['냄비', '프라이팬', '전자레인지', '에어프라이어', '오븐', '밥솥', '찜기', '믹서'];
const ALLERGENS = ['달걀', '우유', '밀', '대두', '땅콩', '견과', '갑각류', '생선', '조개', '오징어', '소고기', '돼지고기', '닭고기', '토마토', '복숭아', '참깨'];
const ING_CATS = ['곡류·면', '채소', '버섯', '과일', '육류', '생선·해산물', '해조류', '달걀·유제품', '두부·콩·견과', '양념·소스', '가공·기타'];
const ING_IC = { '곡류·면': '🌾', '채소': '🥕', '버섯': '🍄', '과일': '🍎', '육류': '🥩', '생선·해산물': '🐟', '해조류': '🌿', '달걀·유제품': '🥚', '두부·콩·견과': '🫘', '양념·소스': '🧂', '가공·기타': '📦' };
const NUTRI = { '곡류·면': '탄수화물', '육류': '단백질', '생선·해산물': '단백질', '두부·콩·견과': '단백질', '채소': '채소', '버섯': '채소', '해조류': '채소', '과일': '과일' };
const CARB_VEG = new Set(['감자', '고구마', '단호박', '옥수수', '밤']);
const PROTEIN_CATS = new Set(['육류', '생선·해산물']);

const STAGES = [
  { max: 6, key: '초기', label: '이유식 초기', texture: '곱게 갈아 체에 거른 미음 (10배죽)', size: '완전히 곱게', season: '간을 하지 않아요', portion: 0.35, freq: '하루 1회 · 한 번에 30~80ml', tip: '한 가지 새 재료는 2~3일 간격으로, 오전에 시작해 반응을 확인해요.' },
  { max: 8, key: '중기', label: '이유식 중기', texture: '알갱이가 살짝 있는 죽 (7배죽)', size: '2~3mm', season: '간을 하지 않아요', portion: 0.5, freq: '하루 2회 · 한 번에 70~120ml', tip: '소고기 등 철분 식품을 매일 넣어 주세요. 혀로 으깰 수 있는 정도의 질감이 좋아요.' },
  { max: 11, key: '후기', label: '이유식 후기', texture: '무른 진밥 (5배죽~진밥)', size: '5mm', season: '간을 하지 않아요', portion: 0.65, freq: '하루 3회 · 한 번에 120~150ml', tip: '잇몸으로 으깰 수 있는 크기. 손으로 집어 먹는 핑거푸드를 시작하기 좋아요.' },
  { max: 14, key: '완료기', label: '이유식 완료기', texture: '진밥~무른 밥, 부드럽게 익힌 반찬', size: '1cm 이하', season: '아주 약하게 (어른 간의 1/4 이하)', portion: 0.75, freq: '하루 3끼 + 간식 1~2회', tip: '어른 식사에서 간하기 전에 덜어 주는 연습을 시작해요. 생우유는 이 시기부터 가능해요.' },
  { max: 23, key: '유아1', label: '유아식 초기', texture: '일반 밥, 부드럽게 익힌 반찬', size: '1~1.5cm 한입 크기', season: '어른 간의 1/3 정도', portion: 0.85, freq: '하루 3끼 + 간식 2회', tip: '숟가락·포크 연습을 시작하고, 질식 위험 식품(포도, 방울토마토, 떡 등)은 작게 잘라 주세요.' },
  { max: 35, key: '유아2', label: '유아식', texture: '일반 밥, 일반 반찬 (질기지 않게)', size: '한입 크기', season: '어른 간의 1/3~1/2', portion: 1.0, freq: '하루 3끼 + 간식 2회', tip: '편식이 시작되는 시기예요. 싫어하는 재료는 잘게 다져 섞거나 모양을 바꿔 보세요.' },
  { max: 71, key: '미취학', label: '미취학 아동', texture: '어른 식사와 비슷하게', size: '한입 크기', season: '어른 간의 1/2, 매운맛은 조금씩', portion: 1.25, freq: '하루 3끼 + 간식 1~2회', tip: '통견과·통콩 같은 질식 위험 식품은 만 4세 이후부터 주세요.' },
  { max: 999, key: '학령', label: '학령기 아동', texture: '일반식', size: '일반 크기', season: '어른보다 약하게', portion: 1.6, freq: '하루 3끼 + 간식 1회', tip: '성장기라 단백질·칼슘을 충분히, 단 음료와 가공식품은 줄여 주세요.' },
];
const stageOf = m => STAGES.find(s => m <= s.max);
const stageIdx = m => STAGES.findIndex(s => m <= s.max);
const seasonLevel = m => m < 12 ? 0 : m < 15 ? 1 : m < 36 ? 2 : m < 72 ? 3 : 4;

const GENERAL_RULES = [
  ['🍯', '꿀', '돌(12개월) 전에는 절대 먹이지 마세요. 영아 보툴리누스증 위험이 있어요. 꿀이 들어간 빵·과자도 마찬가지예요.'],
  ['🥛', '생우유', '음료로는 돌 이후부터. 이유식 요리에 소량 넣는 건 9개월 이후 괜찮아요.'],
  ['🧂', '소금·설탕·간장', '돌 전에는 간을 하지 않아요. 돌 이후에도 아주 약하게 시작해요.'],
  ['🍇', '질식 위험', '포도·방울토마토·블루베리는 4등분, 떡·소시지는 작게. 통견과·통콩·팝콘은 만 4세 이후.'],
  ['🥚', '알레르기 식품', '달걀·우유·밀·땅콩·견과·갑각류 등은 처음 줄 때 소량을 오전에 주고 2~3일 반응을 지켜봐요.'],
  ['🌶️', '매운맛', '고추장·고춧가루는 만 3세 이후 아주 조금씩. 김치는 물에 헹궈서 주세요.'],
  ['🐟', '생선', '가시를 손으로 꼼꼼히 확인해요. 수은이 걱정되는 큰 생선(참치, 황새치 등)은 자주 주지 마세요.'],
];

/* ───────────── 상태 ───────────── */
const SYNC_KEYS = ['children', 'fridge', 'staples', 'tools', 'favorites', 'ratings', 'history', 'shopping'];
let DATA = null;           // {ingredients:{groups,items}, recipes:{items}, version}
let ING = {};              // name -> ingredient
let RECIPES = [], RECIPE_BY_ID = {};
const defaultState = () => ({ children: [], fridge: [], staples: null, tools: TOOLS.slice(), favorites: [], ratings: {}, history: [], shopping: [] });
let state = Object.assign(defaultState(), LS.get('kf_state', {}));
let meta = Object.assign({ stamps: {}, pending: [], familyId: null, recForm: null, lastUpdateCheck: 0 }, LS.get('kf_meta', {}));
const ui = { tab: 'rec', more: null, detail: null, picker: null, kidEdit: null, sheet: null, fridgeQ: '', fridgeCat: '전체', recipeQ: '', recipeCat: '전체', recipeFav: false, recipeFit: true, guideKid: null, guideMonth: 12, guideQ: '', rec: null, recResults: null, recShown: 3 };

function saveLocal() { LS.set('kf_state', state); LS.set('kf_meta', meta); }
function setKey(key, value, opts = {}) {
  state[key] = value;
  meta.stamps[key] = new Date().toISOString();
  if (!meta.pending.includes(key)) meta.pending.push(key);
  saveLocal();
  Sync.schedule();
  if (opts.render !== false) render();
}
const kids = () => state.children || [];
const kidById = id => kids().find(k => k.id === id);
const haveSet = () => new Set([...(state.fridge || []), ...(state.staples || [])]);

/* ───────────── 데이터 로딩 ───────────── */
async function fetchJSON(path, noStore) {
  const r = await fetch((CFG.dataBase || 'data/') + path + (noStore ? `?t=${Date.now()}` : ''), { cache: noStore ? 'no-store' : 'default' });
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}
function applyData(d) {
  DATA = d;
  ING = {};
  for (const i of d.ingredients.items) ING[i.n] = i;
  RECIPES = d.recipes.items;
  RECIPE_BY_ID = Object.fromEntries(RECIPES.map(r => [r.id, r]));
  if (!state.staples) { state.staples = d.ingredients.items.filter(i => i.st).map(i => i.n); saveLocal(); }
}
async function loadData() {
  const cached = LS.get('kf_data', null);
  if (cached) applyData(cached);
  try {
    if (!cached) {
      const [ingredients, recipes] = await Promise.all([fetchJSON('ingredients.json', true), fetchJSON('recipes.json', true)]);
      const d = { ingredients, recipes, version: recipes.v };
      LS.set('kf_data', d); applyData(d);
    }
  } catch (e) {
    if (!cached) throw e;
  }
}
async function checkDataUpdate(manual) {
  try {
    const v = await fetchJSON('version.json', true);
    meta.lastUpdateCheck = Date.now(); saveLocal();
    if (DATA && v.v === DATA.version) { if (manual) toast(`최신 레시피예요 (${RECIPES.length}개)`); return; }
    const before = RECIPES.length;
    const [ingredients, recipes] = await Promise.all([fetchJSON('ingredients.json', true), fetchJSON('recipes.json', true)]);
    const d = { ingredients, recipes, version: recipes.v };
    LS.set('kf_data', d); applyData(d);
    const diff = RECIPES.length - before;
    toast(diff > 0 ? `새 레시피 ${diff}개가 추가됐어요 🎉 (총 ${RECIPES.length}개)` : '레시피 DB가 업데이트됐어요');
    render();
  } catch (e) { if (manual) toast('업데이트 확인 실패 · 인터넷 연결을 확인해 주세요'); }
}

/* ───────────── 나이 ───────────── */
function monthsOld(birth, now = new Date()) {
  if (!birth) return 24;
  const b = new Date(birth + 'T00:00:00');
  let m = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) m--;
  return Math.max(0, m);
}
function ageLabel(m) {
  if (m < 24) return `${m}개월`;
  const y = Math.floor(m / 12), r = m % 12;
  return `만 ${y}세${r ? ' ' + r + '개월' : ''}`;
}
const kidIcon = k => k.sex === 'F' ? '👧' : k.sex === 'M' ? '👦' : '🧒';

/* ───────────── 재료 검색 ───────────── */
function matchIng(ing, q) {
  q = norm(q); if (!q) return true;
  if (isCho(q)) return cho(norm(ing.n)).includes(q) || ing.s.some(x => cho(norm(x)).includes(q));
  return norm(ing.n).includes(q) || ing.s.some(x => norm(x).includes(q));
}
function searchIng(q, cat) {
  let list = DATA.ingredients.items;
  if (cat && cat !== '전체') list = list.filter(i => i.c === cat);
  if (!q) return list;
  const nq = norm(q), c = isCho(nq), key = n => c ? cho(norm(n)) : norm(n);
  return list.filter(i => matchIng(i, q)).sort((a, b) => {
    const sa = key(a.n).startsWith(nq) ? 0 : key(a.n).includes(nq) ? 1 : 2;
    const sb = key(b.n).startsWith(nq) ? 0 : key(b.n).includes(nq) ? 1 : 2;
    return sa - sb;
  });
}

/* ───────────── 추천 엔진 ───────────── */
function makeCtx(kidList, opts = {}) {
  const months = kidList.map(k => monthsOld(k.birth));
  return Object.assign({
    kids: kidList, months,
    youngest: months.length ? Math.min(...months) : 999,
    oldest: months.length ? Math.max(...months) : 0,
    allergy: new Set(kidList.flatMap(k => k.allergies || [])),
    avoid: new Set(kidList.flatMap(k => k.avoid || [])),
    dislikes: new Set(kidList.flatMap(k => k.dislikes || [])),
    have: haveSet(), fridge: new Set(state.fridge || []),
    meal: null, maxTime: 0, allowMissing: 99, tools: null, strict: true,
  }, opts);
}
function ingBlock(ing, ctx) {
  if (!ing) return '알 수 없음';
  if (ing.m > ctx.youngest) return `${ing.m}개월부터`;
  const al = ing.a.find(a => ctx.allergy.has(a));
  if (al) return `${al} 알레르기`;
  if (ctx.avoid.has(ing.n)) return '피하는 재료';
  return null;
}
function resolveItem(item, ctx) {
  const cands = item.g ? DATA.ingredients.groups[item.g] : [item.i];
  const allowed = [], blocked = [];
  for (const n of cands) {
    const ing = ING[n]; const why = ingBlock(ing, ctx);
    (why ? blocked : allowed).push({ ing, why });
  }
  const have = allowed.find(x => ctx.have.has(x.ing.n));
  return {
    item, label: item.g || item.i, group: !!item.g,
    ok: allowed.length > 0, why: blocked[0]?.why,
    have: have ? have.ing : null, use: (have || allowed[0])?.ing || null,
    alts: allowed.map(x => x.ing.n),
  };
}
function evalRecipe(r, ctx) {
  if (ctx.strict) {
    // 나이가 다른 아이들: 큰 아이 메뉴를 만들고 어린 아이 몫을 덜어 질감을 맞추는 방식 허용 (9개월 이상)
    if (r.m[0] > ctx.youngest && !(ctx.kids.length > 1 && ctx.youngest >= 9 && r.m[0] <= 15 && ctx.oldest >= r.m[0])) return null;
    if (ctx.youngest > r.m[1] + (r.m[1] < 12 ? 2 : 12)) return null;
    if (ctx.maxTime && r.t > ctx.maxTime) return null;
    if (ctx.tools && r.tl.length && !r.tl.some(t => ctx.tools.includes(t))) return null;
  }
  const req = r.r.map(it => resolveItem(it, ctx));
  if (ctx.strict && req.some(x => !x.ok)) return null;
  const missing = req.filter(x => x.ok && !x.have);
  if (missing.length > ctx.allowMissing) return null;
  const opt = r.o.map(it => resolveItem(it, ctx));
  const sea = r.s.map(it => resolveItem(it, { ...ctx, youngest: Math.max(ctx.oldest, 12) })); // 간은 큰 아이 기준, 어린 아이 몫은 덜어내기로 처리
  const used = [...req, ...opt.filter(x => x.ok && x.have)].map(x => x.use).filter(Boolean);
  const fridgeUsed = used.filter(i => ctx.fridge.has(i.n)).map(i => i.n);
  let score = 100 * (req.length ? (req.length - missing.length) / req.length : 1) - 30 * missing.length;
  score += 6 * opt.filter(x => x.ok && x.have).length + 4 * new Set(fridgeUsed).size;
  if ((state.favorites || []).includes(r.id)) score += 15;
  score += 4 * ((state.ratings || {})[r.id] || 0);
  if (ctx.meal) score += r.ml.includes(ctx.meal) ? 10 : -15;
  if (ctx.oldest > r.m[1]) score -= ctx.oldest > r.m[1] + 12 ? 45 : 15;
  const adapt = r.m[0] > ctx.youngest;
  if (adapt) score -= 10;
  const dislikeHits = used.filter(i => ctx.dislikes.has(i.n)).map(i => i.n);
  score -= 12 * dislikeHits.length;
  const last = lastEaten(r.id);
  if (last != null) score -= last <= 2 ? 40 : last <= 5 ? 20 : last <= 10 ? 8 : 0;
  // 새 재료 (먹어본 재료를 기록 중인 아기만)
  const newIngs = [];
  ctx.kids.forEach((k, i) => {
    if (ctx.months[i] >= 24 || !(k.tried || []).length) return;
    for (const ing of used) if (!(k.tried || []).includes(ing.n) && ing.c !== '양념·소스' && !newIngs.includes(ing.n)) newIngs.push(ing.n);
  });
  if (newIngs.length > 1) score -= 15 * (newIngs.length - 1);
  score += Math.random() * 6;
  return { r, score, req, opt, sea, missing, used, fridgeUsed, dislikeHits, newIngs, lastDays: last, adapt };
}
function lastEaten(rid) {
  const t = todayStr(); let best = null;
  for (const h of state.history || []) if (h.rids.includes(rid)) { const d = daysBetween(h.date, t); if (best == null || d < best) best = d; }
  return best;
}
function nutriOf(ings) {
  const s = new Set();
  for (const i of ings) {
    if (CARB_VEG.has(i.n)) s.add('탄수화물');
    if (NUTRI[i.c]) s.add(NUTRI[i.c]);
    if (i.c === '달걀·유제품') s.add(/달걀|메추리/.test(i.n) ? '단백질' : '칼슘');
  }
  return s;
}
function recommend(form) {
  const kidList = form.kidIds.map(kidById).filter(Boolean);
  const ctx = makeCtx(kidList, { meal: form.meal, maxTime: form.maxTime || 0, allowMissing: form.allowMissing, tools: state.tools?.length ? state.tools : null });
  const pools = [], emptyCats = [];
  for (const c of form.cats) {
    const list = RECIPES.filter(r => r.c === c).map(r => evalRecipe(r, ctx)).filter(Boolean).sort((a, b) => b.score - a.score);
    if (list.length) pools.push({ c, list: list.slice(0, form.cats.length > 3 ? 5 : 7) }); else emptyCats.push(c);
  }
  const combos = [];
  const walk = (i, pick) => {
    if (i === pools.length) { if (pick.length) combos.push(scoreCombo(pick, form)); return; }
    for (const e of pools[i].list) walk(i + 1, [...pick, e]);
  };
  walk(0, []);
  combos.sort((a, b) => b.score - a.score);
  // 다양성: 앞에서 고른 조합과 절반 이상 겹치지 않게
  const picked = [];
  for (const c of combos) {
    const ids = c.dishes.map(d => d.r.id);
    if (picked.every(p => ids.filter(id => p.ids.includes(id)).length <= Math.floor(ids.length / 2))) picked.push({ ...c, ids });
    if (picked.length >= 12) break;
  }
  return { combos: picked, emptyCats, ctx: { kidIds: form.kidIds }, total: combos.length };
}
function scoreCombo(dishes, form) {
  let score = dishes.reduce((s, d) => s + d.score, 0) / dishes.length * 1.0;
  const count = {};
  for (const d of dishes) for (const i of new Set(d.used.map(x => x.n))) count[i] = (count[i] || 0) + 1;
  for (const [n, c] of Object.entries(count)) {
    if (c < 2 || (state.staples || []).includes(n)) continue;
    score -= (PROTEIN_CATS.has(ING[n]?.c) ? 12 : 3) * (c - 1);
  }
  const fridgeCover = new Set(dishes.flatMap(d => d.fridgeUsed)).size;
  score += 3 * fridgeCover;
  const nut = nutriOf(dishes.flatMap(d => d.used));
  for (const k of ['탄수화물', '단백질', '채소']) if (nut.has(k)) score += 6;
  const time = Math.max(...dishes.map(d => d.r.t));
  if (form.meal === '아침' && time > 30) score -= 8;
  const missing = [...new Set(dishes.flatMap(d => d.missing.map(m => m.label)))];
  return { dishes, score, nut: [...nut], time, missing, fridgeCover };
}

/* ───────────── 분량 ───────────── */
function refMonth(r) { return Math.min(Math.max(30, r.m[0]), r.m[1]); }
function portionFactor(r, kidList) {
  if (!kidList.length) return 1;
  const ref = stageOf(refMonth(r)).portion;
  return kidList.reduce((s, k) => s + stageOf(monthsOld(k.birth)).portion, 0) / ref;
}
const parseNum = s => s.includes('/') ? s.split('/').reduce((a, b) => a / b) : parseFloat(s);
function fmtNum(v) {
  const w = Math.floor(v), f = v - w;
  if (f < 0.25) return String(w || '½');
  if (f < 0.75) return (w ? w : '') + '½';
  return String(w + 1);
}
function scaleAmt(a, f) {
  if (a === '약간' || a === '적당량') return a;
  const m = a.match(/^([\d./]+)(.*)$/); if (!m) return a;
  let v = parseNum(m[1]) * f; const u = m[2];
  if (u === 'g' || u === 'ml') { v = v >= 20 ? Math.round(v / 5) * 5 : Math.max(1, Math.round(v)); return v + u; }
  return fmtNum(Math.max(0.5, v)) + u;
}

/* ───────────── 렌더링 ───────────── */
function render() {
  const app = $('#app');
  if (!DATA) { app.innerHTML = `<div class="loader">레시피를 불러오는 중…</div>`; return; }
  const scrollY = window.scrollY;
  const views = { rec: viewRec, fridge: viewFridge, recipes: viewRecipes, guide: viewGuide, more: viewMore };
  app.innerHTML = views[ui.tab]() + viewNav();
  renderOverlays();
  if (ui._keepScroll) window.scrollTo(0, scrollY);
  ui._keepScroll = true;
}
function go(tab) { ui.tab = tab; ui._keepScroll = false; if (tab !== 'more') ui.more = null; render(); window.scrollTo(0, 0); }
function viewNav() {
  const shopN = (state.shopping || []).filter(s => !s.done).length;
  const b = (t, ic, l, extra = '') => `<button class="${ui.tab === t ? 'on' : ''}" data-act="tab" data-tab="${t}"><span class="ic">${ic}</span>${l}${extra}</button>`;
  return `<nav class="nav">${b('rec', '🍳', '오늘 뭐 먹지')}${b('fridge', '🧊', '냉장고', state.fridge?.length ? `<span class="dot">${state.fridge.length}</span>` : '')}${b('recipes', '📖', '레시피')}${b('guide', '🍼', '섭취 가이드')}${b('more', '☰', '더보기', shopN ? `<span class="dot">${shopN}</span>` : '')}</nav>`;
}
function top(title, sub = '', back = '') {
  return `<header class="top">${back ? `<button class="back" data-act="${back}">‹ 뒤로</button>` : ''}<div class="grow"><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${syncBadge()}</header>`;
}
function syncBadge() {
  if (!Sync.family) return '';
  const s = Sync.status;
  const t = s === 'ok' ? '☁️ 동기화됨' : s === 'busy' ? '☁️ 저장 중' : s === 'offline' ? '☁️ 오프라인' : '☁️ 대기';
  return `<span class="badge ${s === 'ok' ? 'ok' : s === 'offline' ? 'warn' : ''}">${t}</span>`;
}
const chip = (label, on, act, data = '', cls = '') => `<button class="chip ${on ? 'on' : ''} ${cls}" data-act="${act}" ${data}>${label}</button>`;

/* ── 추천 탭 ── */
function recForm() {
  if (!ui.rec) {
    const h = new Date().getHours();
    const meal = h < 10 ? '아침' : h < 15 ? '점심' : h < 17 ? '간식' : '저녁';
    const saved = meta.recForm || {};
    ui.rec = { kidIds: kids().map(k => k.id), meal, cats: MEAL_DEFAULT_CATS[meal].slice(), maxTime: saved.maxTime || 0, allowMissing: saved.allowMissing ?? 0 };
  }
  ui.rec.kidIds = ui.rec.kidIds.filter(id => kidById(id));
  if (!ui.rec.kidIds.length && kids().length) ui.rec.kidIds = kids().map(k => k.id);
  return ui.rec;
}
function viewRec() {
  if (!kids().length) {
    return top('오늘 뭐 먹지?') + `<div class="page"><div class="card empty"><div class="big">👶</div><b>먼저 아이를 등록해 주세요</b><p class="small">생년월일로 개월수를 계산해 먹을 수 있는 레시피만 골라 드려요.</p><button class="btn primary" data-act="kid-new">아이 등록하기</button></div></div>`;
  }
  const f = recForm();
  const selKids = f.kidIds.map(kidById).filter(Boolean);
  const fridgeN = (state.fridge || []).length;
  let h = top('오늘 뭐 먹지?', `냉장고 재료 ${fridgeN}개 · 레시피 ${RECIPES.length}개`) + '<div class="page">';
  h += `<div class="card"><span class="label">누가 먹나요?</span><div class="chips">${kids().map(k => chip(`${kidIcon(k)} ${esc(k.name)} <span class="tiny">${ageLabel(monthsOld(k.birth))}</span>`, f.kidIds.includes(k.id), 'rec-kid', `data-id="${k.id}"`)).join('')}</div>`;
  h += `<span class="label">언제 먹나요?</span><div class="seg">${MEALS.map(m => `<button class="${f.meal === m ? 'on' : ''}" data-act="rec-meal" data-v="${m}">${m}</button>`).join('')}</div>`;
  h += `<span class="label">만들고 싶은 메뉴 <span class="tiny">(골라주신 메뉴로 한 끼 조합을 짜 드려요)</span></span><div class="chips">${CATS.map(c => chip(`${CAT_INFO[c].ic} ${CAT_INFO[c].label}`, f.cats.includes(c), 'rec-cat', `data-v="${c}"`)).join('')}</div>`;
  h += `<details ${ui.recOpts ? 'open' : ''} data-act="rec-opts"><summary class="label" style="margin-top:14px">⚙️ 조건 더보기 · ${f.maxTime ? f.maxTime + '분 이내' : '시간 무관'} · 부족 재료 ${f.allowMissing}개까지</summary>`;
  h += `<span class="label">조리 시간</span><div class="seg">${[[0, '무관'], [15, '15분'], [30, '30분'], [60, '1시간']].map(([v, l]) => `<button class="${f.maxTime === v ? 'on' : ''}" data-act="rec-time" data-v="${v}">${l}</button>`).join('')}</div>`;
  h += `<span class="label">부족한 재료 허용</span><div class="seg">${[0, 1, 2].map(v => `<button class="${f.allowMissing === v ? 'on' : ''}" data-act="rec-miss" data-v="${v}">${v === 0 ? '있는 재료만' : v + '개까지'}</button>`).join('')}</div>`;
  h += `<p class="tiny muted" style="margin:8px 0 0">조리도구(${(state.tools || []).length}종)와 상비 재료는 더보기 › 조리도구·상비재료에서 바꿀 수 있어요.</p></details>`;
  h += `<div class="sp"></div><button class="btn primary block" data-act="rec-go" ${!f.cats.length || !selKids.length ? 'disabled' : ''}>🍳 한 끼 추천받기</button>`;
  if (!fridgeN) h += `<p class="tiny muted" style="text-align:center;margin:8px 0 0">냉장고가 비어 있어요. <a href="#" data-act="tab" data-tab="fridge">냉장고 재료를 먼저 넣어 주세요 ›</a></p>`;
  h += `</div>`;
  if (selKids.length > 1) {
    const ms = selKids.map(k => monthsOld(k.birth));
    if (new Set(ms.map(seasonLevel)).size > 1) h += `<div class="notice">👨‍👧‍👦 나이가 다른 아이가 함께 먹어요. 레시피에 <b>간하기 전 어린 아이 몫 덜어내기</b> 단계를 넣어 드릴게요.</div>`;
  }
  h += `<div id="rec-results">${viewRecResults()}</div></div>`;
  return h;
}
function viewRecResults() {
  const R = ui.recResults;
  if (!R) return '';
  const f = ui.rec;
  let h = '';
  if (R.emptyCats.length) {
    const baby = R.youngest < 12;
    h += `<div class="notice">${R.emptyCats.map(c => CAT_INFO[c].label).join(', ')}: 조건에 맞는 레시피가 없어요.${baby && R.emptyCats.some(c => c !== '밥죽') ? ' 이유식 시기에는 죽·진밥 한 그릇이 한 끼예요.' : f.allowMissing < 2 ? ' 부족 재료 허용을 늘려 보세요.' : ''}</div>`;
  }
  if (!R.combos.length) {
    return h + `<div class="card empty"><div class="big">🤔</div><b>지금 재료로 만들 수 있는 조합이 없어요</b><p class="small">부족한 재료를 허용하거나, 메뉴 종류를 줄여 보세요.</p>${f.allowMissing < 2 ? `<button class="btn primary" data-act="rec-miss-more">부족 재료 ${f.allowMissing + 1}개까지 허용하고 다시 보기</button>` : ''}</div>`;
  }
  R.combos.slice(0, ui.recShown).forEach((c, idx) => {
    const label = idx === 0 ? '🏆 베스트 조합' : `추천 조합 ${idx + 1}`;
    h += `<div class="combo"><div class="combo-h">${label}<span class="grow"></span><span class="tiny">⏱ 약 ${c.time}분</span></div>`;
    for (const d of c.dishes) {
      const r = d.r;
      const miss = d.missing.map(m => m.label);
      h += `<button class="dish" data-act="open" data-id="${r.id}"><span class="cat">${CAT_INFO[r.c].ic}</span><span class="grow"><span class="name">${esc(r.n)}</span>${(state.favorites || []).includes(r.id) ? ' ❤️' : ''}<div class="sum">💡 ${esc(r.sum)}</div><div class="meta">`;
      h += `<span class="badge">${CAT_INFO[r.c].label}</span>`;
      h += miss.length ? `<span class="badge bad">부족: ${esc(miss.join(', '))}</span>` : `<span class="badge ok">재료 다 있어요</span>`;
      if (d.fridgeUsed.length) h += `<span class="badge brand">🧊 ${d.fridgeUsed.length}개 사용</span>`;
      if (d.adapt) h += `<span class="badge warn">어린 아이 몫 덜어내기</span>`;
      if (d.newIngs.length) h += `<span class="badge warn">🆕 ${esc(d.newIngs.slice(0, 2).join(', '))}</span>`;
      if (d.lastDays != null && d.lastDays <= 7) h += `<span class="badge">${d.lastDays === 0 ? '오늘' : d.lastDays + '일 전'} 먹음</span>`;
      h += `</div></span><span class="chev">›</span></button>`;
    }
    const noRice = !f.cats.includes('밥죽') && f.meal !== '간식' && !c.dishes.some(d => d.r.c === '밥죽');
    h += `<div class="combo-f">${c.nut.filter(n => ['탄수화물', '단백질', '채소', '칼슘', '과일'].includes(n)).map(n => `<span class="badge ok">✓ ${n}</span>`).join(' ')}${noRice ? '<span class="badge">🍚 밥은 따로 곁들여요</span>' : ''}<span class="grow"></span>`;
    if (c.missing.length) h += `<button class="btn sm" data-act="combo-shop" data-i="${idx}">🛒 부족 재료 담기</button>`;
    h += `<button class="btn sm primary" data-act="combo-eat" data-i="${idx}">이걸로 할게요</button></div></div>`;
  });
  if (R.combos.length > ui.recShown) h += `<button class="btn block" data-act="rec-more">다른 조합 더 보기 (${R.combos.length - ui.recShown})</button>`;
  else h += `<button class="btn block ghost" data-act="rec-go">🔄 새로 섞어서 추천</button>`;
  return h;
}

/* ── 냉장고 탭 ── */
function viewFridge() {
  const fridge = state.fridge || [];
  let h = top('냉장고', `재료 ${fridge.length}개 · 상비 재료 ${(state.staples || []).length}개`) + '<div class="page">';
  h += `<div class="search"><input id="fridge-q" type="search" placeholder="재료 검색 (예: 호박, ㅇㅎㅂ, 주키니)" value="${esc(ui.fridgeQ)}" autocomplete="off"></div>`;
  h += `<div class="hscroll" style="margin-top:10px">${['전체', ...ING_CATS].map(c => chip(c === '전체' ? '전체' : `${ING_IC[c]} ${c}`, ui.fridgeCat === c, 'fridge-cat', `data-v="${c}"`)).join('')}</div>`;
  h += `<div id="fridge-list">${viewFridgeList()}</div>`;
  h += `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🧊 지금 냉장고에 있는 재료</h2>${fridge.length ? '<button class="btn sm danger" data-act="fridge-clear">비우기</button>' : ''}</div><div class="sp"></div>`;
  if (!fridge.length) h += `<p class="small muted">위에서 재료를 검색하거나 카테고리에서 골라 담아 주세요.</p>`;
  else {
    const byCat = {};
    for (const n of fridge) { const c = ING[n]?.c || '가공·기타'; (byCat[c] = byCat[c] || []).push(n); }
    for (const c of ING_CATS) if (byCat[c]) h += `<div class="cat-h">${ING_IC[c]} ${c}</div><div class="chips">${byCat[c].map(n => `<button class="chip soft" data-act="fridge-toggle" data-n="${esc(n)}">${esc(n)} <span class="x">✕</span></button>`).join('')}</div>`;
  }
  h += `</div><div class="card"><h2>⭐ 상비 재료 <span class="tiny muted">(항상 있는 걸로 계산해요)</span></h2><div class="chips">${(state.staples || []).map(n => `<span class="chip">${esc(n)}</span>`).join('')}</div><button class="btn sm" data-act="pick-staples">상비 재료 편집</button></div>`;
  return h + '</div>';
}
function viewFridgeList() {
  const showAll = ui.fridgeQ || ui.fridgeCat !== '전체';
  if (!showAll) return `<p class="tiny muted" style="margin:6px 2px">검색하거나 카테고리를 누르면 재료 목록이 나와요. 재료를 누르면 냉장고에 담겨요.</p>`;
  const list = searchIng(ui.fridgeQ, ui.fridgeCat);
  const fridge = new Set(state.fridge || []), staples = new Set(state.staples || []);
  if (!list.length) return `<div class="notice">"${esc(ui.fridgeQ)}"에 맞는 재료가 없어요.</div>`;
  return `<div class="list">${list.slice(0, 80).map(i => {
    const st = staples.has(i.n), on = fridge.has(i.n) || st;
    return `<div class="li"><button class="row grow" data-act="fridge-toggle" data-n="${esc(i.n)}" style="text-align:left"><span class="check ${on ? 'on' : ''}">✓</span><span class="grow"><span class="t">${esc(i.n)}</span> <span class="tiny muted">${i.m <= 6 ? '' : i.m + '개월~'}</span>${i.a.length ? ` <span class="badge warn">${esc(i.a.join('·'))}</span>` : ''}${i.s.length ? `<div class="d">${esc(i.s.slice(0, 4).join(', '))}</div>` : ''}</span></button><button class="star-btn ${st ? 'on' : ''}" data-act="staple-toggle" data-n="${esc(i.n)}" aria-label="상비 재료">⭐</button></div>`;
  }).join('')}</div>${list.length > 80 ? `<p class="tiny muted">${list.length - 80}개 더 있어요. 검색어를 더 입력해 주세요.</p>` : ''}`;
}

/* ── 레시피 탭 ── */
function viewRecipes() {
  let h = top('레시피', `전체 ${RECIPES.length}개`) + '<div class="page">';
  h += `<div class="search"><input id="recipe-q" type="search" placeholder="메뉴나 재료로 검색" value="${esc(ui.recipeQ)}" autocomplete="off"></div>`;
  h += `<div class="hscroll" style="margin-top:10px">${chip('❤️ 즐겨찾기', ui.recipeFav, 'recipe-fav')}${kids().length ? chip('우리 아이 가능만', ui.recipeFit, 'recipe-fit') : ''}${['전체', ...CATS].map(c => chip(c === '전체' ? '전체' : `${CAT_INFO[c].ic} ${CAT_INFO[c].label}`, ui.recipeCat === c, 'recipe-cat', `data-v="${c}"`)).join('')}</div>`;
  return h + `<div id="recipe-list">${viewRecipeList()}</div></div>`;
}
function viewRecipeList() {
  const q = norm(ui.recipeQ);
  const ctx = makeCtx(kids(), { strict: ui.recipeFit && kids().length > 0 });
  let list = RECIPES;
  if (ui.recipeCat !== '전체') list = list.filter(r => r.c === ui.recipeCat);
  if (ui.recipeFav) list = list.filter(r => (state.favorites || []).includes(r.id));
  if (q) {
    const qc = isCho(q);
    list = list.filter(r => {
      const names = [r.n, ...r.r.map(x => x.i || x.g), ...r.o.map(x => x.i || x.g)];
      return names.some(n => qc ? cho(norm(n)).includes(q) : norm(n).includes(q) || (ING[n]?.s || []).some(s => norm(s).includes(q)));
    });
  }
  const ev = list.map(r => evalRecipe(r, ctx)).filter(Boolean);
  ev.sort((a, b) => (a.missing.length - b.missing.length) || (b.score - a.score));
  if (!ev.length) return `<div class="card empty"><div class="big">🔍</div>조건에 맞는 레시피가 없어요.</div>`;
  return `<div class="list">${ev.slice(0, 150).map(e => {
    const r = e.r, hv = e.req.length - e.missing.length;
    return `<button class="li" data-act="open" data-id="${r.id}"><span style="font-size:24px">${CAT_INFO[r.c].ic}</span><span class="grow"><span class="t">${esc(r.n)}</span>${(state.favorites || []).includes(r.id) ? ' ❤️' : ''}<div class="d">${r.m[0]}개월~ · ${r.t}분 · 재료 ${hv}/${e.req.length}</div></span>${e.missing.length ? '' : '<span class="badge ok">가능</span>'}<span class="chev">›</span></button>`;
  }).join('')}</div>${ev.length > 150 ? `<p class="tiny muted">${ev.length - 150}개 더 있어요. 검색어로 좁혀 주세요.</p>` : ''}`;
}

/* ── 섭취 가이드 탭 ── */
function viewGuide() {
  if (ui.guideKid === null && kids().length) ui.guideKid = kids()[0].id;
  const kid = kidById(ui.guideKid);
  const m = kid ? monthsOld(kid.birth) : ui.guideMonth;
  const st = stageOf(m), si = stageIdx(m);
  let h = top('섭취 가이드', '개월수별 먹어도 되는 재료') + '<div class="page">';
  h += `<div class="hscroll">${kids().map(k => chip(`${kidIcon(k)} ${esc(k.name)}`, ui.guideKid === k.id, 'guide-kid', `data-id="${k.id}"`)).join('')}${chip('개월수 직접 선택', !kid, 'guide-kid', 'data-id=""')}</div>`;
  if (!kid) h += `<div class="card"><span class="label">개월수: <b style="color:var(--ink)">${ageLabel(m)}</b></span><input type="range" min="4" max="144" value="${m}" id="guide-month" style="padding:0;border:0"></div>`;
  h += `<div class="card"><div class="row"><span class="avatar">🍼</span><div class="grow"><b style="font-size:17px">${st.label}</b><div class="small muted">${kid ? esc(kid.name) + ' · ' : ''}${ageLabel(m)}</div></div></div><div class="stagebar">${STAGES.map((s, i) => `<span class="${i <= si ? 'on' : ''}"></span>`).join('')}</div>
    <div class="sp"></div><div class="small"><b>질감</b> ${st.texture}<br><b>크기</b> ${st.size}<br><b>간</b> ${st.season}<br><b>횟수</b> ${st.freq}</div><p class="small" style="margin:8px 0 0">💡 ${st.tip}</p></div>`;
  h += `<details class="card"><summary>⚠️ 꼭 알아둘 규칙 ${GENERAL_RULES.length}가지</summary><div class="sp"></div>${GENERAL_RULES.map(([ic, t, d]) => `<p class="small" style="margin:6px 0"><b>${ic} ${t}</b> — ${d}</p>`).join('')}</details>`;
  h += `<div class="search"><input id="guide-q" type="search" placeholder="재료 검색" value="${esc(ui.guideQ)}" autocomplete="off"></div>`;
  h += `<div id="guide-list">${viewGuideList(kid, m)}</div>`;
  return h + `<p class="tiny muted">이 가이드는 일반적인 국내 이유식 지침을 바탕으로 한 참고 정보예요. 알레르기나 질환이 있으면 소아과와 상담하세요.</p></div>`;
}
function viewGuideList(kid, m) {
  const ctx = makeCtx(kid ? [kid] : [], { youngest: m });
  const list = searchIng(ui.guideQ, '전체');
  const ok = [], caution = [], no = [], allergy = [];
  for (const i of list) {
    if (i.m > m) no.push(i);
    else if (kid && (i.a.some(a => ctx.allergy.has(a)) || ctx.avoid.has(i.n))) allergy.push(i);
    else if (i.w && (i.m + 12 > m || /질식|금지|절대/.test(i.w))) caution.push(i);
    else ok.push(i);
  }
  const tried = new Set(kid?.tried || []);
  const track = kid && m < 24;
  const grp = (arr, fn) => { const by = {}; for (const i of arr) (by[i.c] = by[i.c] || []).push(i); return ING_CATS.filter(c => by[c]).map(c => `<div class="cat-h">${ING_IC[c]} ${c} <span class="tiny">${by[c].length}</span></div><div class="chips">${by[c].map(fn).join('')}</div>`).join(''); };
  let h = '';
  if (allergy.length) h += `<div class="card"><h2>🚫 우리 아이는 피해요 <span class="badge bad">${allergy.length}</span></h2>${grp(allergy, i => `<span class="chip bad">${esc(i.n)}</span>`)}</div>`;
  h += `<div class="card"><h2>🟢 먹을 수 있어요 <span class="badge ok">${ok.length}</span></h2>${track ? `<p class="tiny muted" style="margin-top:-4px">재료를 누르면 '먹어봤어요' ✓ 표시가 돼요. 추천 시 안 먹어본 재료에 🆕 표시를 해 드려요.</p>` : ''}${grp(ok, i => track ? `<button class="chip ${tried.has(i.n) ? 'ok' : ''}" data-act="tried-toggle" data-n="${esc(i.n)}">${tried.has(i.n) ? '✓ ' : ''}${esc(i.n)}</button>` : `<span class="chip">${esc(i.n)}</span>`) || '<p class="small muted">없음</p>'}</div>`;
  if (caution.length) h += `<div class="card"><h2>🟡 주의하며 먹어요 <span class="badge warn">${caution.length}</span></h2>${caution.map(i => `<div class="ing-row">${track ? `<button class="check ${tried.has(i.n) ? 'on' : ''}" data-act="tried-toggle" data-n="${esc(i.n)}">✓</button>` : ''}<b>${esc(i.n)}</b><span class="grow small muted">${esc(i.w)}</span></div>`).join('')}</div>`;
  if (no.length) h += `<div class="card"><h2>🔴 아직 안 돼요 <span class="badge bad">${no.length}</span></h2>${no.sort((a, b) => a.m - b.m).map(i => `<div class="ing-row"><b>${esc(i.n)}</b><span class="badge">${i.m >= 24 ? ageLabel(i.m) : i.m + '개월'}부터</span><span class="grow small muted">${esc(i.w || '')}</span></div>`).join('')}</div>`;
  return h;
}

/* ── 더보기 탭 ── */
function viewMore() {
  const sub = { kids: viewKids, kidEdit: viewKidEdit, family: viewFamily, shopping: viewShopping, history: viewHistory, settings: viewSettings, backup: viewBackup };
  if (ui.more && sub[ui.more]) return sub[ui.more]();
  const shopN = (state.shopping || []).filter(s => !s.done).length;
  const li = (k, ic, t, d) => `<button class="li" data-act="more" data-v="${k}"><span style="font-size:22px">${ic}</span><span class="grow"><span class="t">${t}</span><div class="d">${d}</div></span><span class="chev">›</span></button>`;
  return top('더보기') + `<div class="page"><div class="list">
    ${li('kids', '👶', '아이 관리', kids().length ? kids().map(k => `${esc(k.name)} ${ageLabel(monthsOld(k.birth))}`).join(' · ') : '아이를 등록해 주세요')}
    ${li('family', '👨‍👩‍👧', '가족 공유', Sync.family ? `${esc(Sync.family.name)} · 연결됨` : Sync.user ? '가족을 만들거나 참여하세요' : '배우자와 같은 냉장고를 함께 써요')}
    ${li('shopping', '🛒', '장보기 목록', shopN ? `살 것 ${shopN}개` : '비어 있어요')}
    ${li('history', '📅', '식단 기록', `${(state.history || []).length}끼 기록됨`)}
    ${li('settings', '🍳', '조리도구 · 상비재료', `도구 ${(state.tools || []).length}종 · 상비 ${(state.staples || []).length}개`)}
    ${li('backup', '💾', '백업 · 레시피 DB', `레시피 ${RECIPES.length}개 · v${DATA.version}`)}
  </div><p class="tiny muted" style="text-align:center">아이 냉장고 파먹기 v${APP_VERSION}<br>레시피와 가이드는 참고용이며 의학적 조언이 아니에요.</p></div>`;
}
function viewKids() {
  let h = top('아이 관리', '', 'more-back') + '<div class="page">';
  for (const k of kids()) {
    const m = monthsOld(k.birth);
    h += `<button class="card kidcard" data-act="kid-edit" data-id="${k.id}" style="width:100%;text-align:left"><span class="avatar">${kidIcon(k)}</span><span class="grow"><b style="font-size:17px">${esc(k.name)}</b><div class="small muted">${ageLabel(m)} · ${stageOf(m).label}</div><div class="tiny muted">${(k.allergies || []).length ? '알레르기: ' + esc(k.allergies.join(', ')) : '알레르기 없음'}${(k.dislikes || []).length ? ' · 싫어함 ' + k.dislikes.length : ''}</div></span><span class="chev">›</span></button>`;
  }
  return h + `<button class="btn primary block" data-act="kid-new">+ 아이 추가</button></div>`;
}
function viewKidEdit() {
  const d = ui.kidEdit; if (!d) { ui.more = 'kids'; return viewKids(); }
  const isNew = !kidById(d.id);
  let h = top(isNew ? '아이 추가' : esc(d.name || '아이 정보'), '', 'kid-cancel') + '<div class="page"><div class="card">';
  h += `<span class="label">이름 (애칭)</span><input id="kid-name" value="${esc(d.name)}" placeholder="예: 첫째, 하준">`;
  h += `<span class="label">성별</span><div class="seg">${[['M', '남아'], ['F', '여아']].map(([v, l]) => `<button class="${d.sex === v ? 'on' : ''}" data-act="kid-sex" data-v="${v}">${l}</button>`).join('')}</div>`;
  h += `<span class="label">생년월일</span><input id="kid-birth" type="date" value="${esc(d.birth)}" max="${todayStr()}">`;
  if (d.birth) h += `<p class="small muted" style="margin:6px 0 0">현재 ${ageLabel(monthsOld(d.birth))} · ${stageOf(monthsOld(d.birth)).label}</p>`;
  h += `</div><div class="card"><h2>🚫 알레르기</h2><p class="tiny muted" style="margin-top:-6px">선택한 알레르기 성분이 들어간 레시피는 추천하지 않아요.</p><div class="chips">${ALLERGENS.map(a => chip(a, (d.allergies || []).includes(a), 'kid-allergy', `data-v="${a}"`)).join('')}</div></div>`;
  const listBlock = (key, title, desc) => `<div class="card"><h2>${title}</h2><p class="tiny muted" style="margin-top:-6px">${desc}</p><div class="chips">${(d[key] || []).map(n => `<button class="chip soft" data-act="kid-rm" data-k="${key}" data-n="${esc(n)}">${esc(n)} <span class="x">✕</span></button>`).join('')}</div><button class="btn sm" data-act="pick-kid" data-k="${key}">+ 재료 추가</button></div>`;
  h += listBlock('avoid', '⛔ 먹으면 안 되는 재료', '알레르기 외에 따로 피해야 하는 재료. 이 재료가 필수인 레시피는 제외돼요.');
  h += listBlock('dislikes', '😖 싫어하는 재료', '추천 순위를 낮춰요 (완전히 빼지는 않아요).');
  h += `<div class="row"><button class="btn primary grow" data-act="kid-save">저장</button>${isNew ? '' : '<button class="btn danger" data-act="kid-del">삭제</button>'}</div></div>`;
  return h;
}
function viewShopping() {
  const list = state.shopping || [];
  let h = top('장보기 목록', '', 'more-back') + '<div class="page">';
  h += `<div class="row"><input id="shop-in" placeholder="직접 추가 (예: 애호박)" class="grow"><button class="btn primary" data-act="shop-add">추가</button></div>`;
  if (!list.length) return h + `<div class="card empty"><div class="big">🛒</div>추천 화면이나 레시피에서 부족한 재료를 담을 수 있어요.</div></div>`;
  h += `<div class="list">${list.map(s => `<div class="li"><button class="row grow" data-act="shop-toggle" data-id="${s.id}" style="text-align:left"><span class="check ${s.done ? 'on' : ''}">✓</span><span class="grow ${s.done ? 'muted' : ''}" style="${s.done ? 'text-decoration:line-through' : ''}">${esc(s.name)}${s.from ? `<div class="d">${esc(s.from)}</div>` : ''}</span></button><button class="close" data-act="shop-rm" data-id="${s.id}">✕</button></div>`).join('')}</div>`;
  const done = list.filter(s => s.done).length;
  if (done) h += `<button class="btn primary block" data-act="shop-to-fridge">✓ 산 재료 ${done}개 냉장고에 넣기</button>`;
  return h + `<div class="sp"></div><button class="btn block ghost" data-act="shop-clear">목록 비우기</button></div>`;
}
function viewHistory() {
  const hist = (state.history || []).slice().sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0));
  let h = top('식단 기록', '', 'more-back') + '<div class="page">';
  if (!hist.length) return h + `<div class="card empty"><div class="big">📅</div>추천 조합에서 "이걸로 할게요"를 누르면 기록돼요.<br>최근에 먹은 메뉴는 추천 순위가 내려가요.</div></div>`;
  let cur = '';
  for (const e of hist.slice(0, 120)) {
    if (e.date !== cur) { cur = e.date; const dd = daysBetween(e.date, todayStr()); h += `<div class="cat-h">${e.date} ${dd === 0 ? '(오늘)' : dd === 1 ? '(어제)' : ''}</div>`; }
    h += `<div class="card" style="margin:6px 0;padding:12px 14px"><div class="row"><span class="badge brand">${esc(e.meal)}</span><span class="tiny muted grow">${(e.kids || []).map(id => esc(kidById(id)?.name || '')).filter(Boolean).join(', ')}</span><button class="close" data-act="hist-rm" data-id="${e.id}">✕</button></div><div class="chips" style="margin-top:8px">${e.rids.map(id => RECIPE_BY_ID[id] ? `<button class="chip" data-act="open" data-id="${id}">${CAT_INFO[RECIPE_BY_ID[id].c].ic} ${esc(RECIPE_BY_ID[id].n)}</button>` : '').join('')}</div></div>`;
  }
  return h + '</div>';
}
function viewSettings() {
  let h = top('조리도구 · 상비재료', '', 'more-back') + '<div class="page">';
  h += `<div class="card"><h2>🍳 우리 집 조리도구</h2><p class="tiny muted" style="margin-top:-6px">없는 도구만 쓰는 레시피는 추천에서 빠져요.</p><div class="chips">${TOOLS.map(t => chip(t, (state.tools || []).includes(t), 'tool-toggle', `data-v="${t}"`)).join('')}</div></div>`;
  h += `<div class="card"><h2>⭐ 상비 재료</h2><p class="tiny muted" style="margin-top:-6px">항상 집에 있는 재료예요. 냉장고에 따로 넣지 않아도 있는 걸로 계산해요.</p><div class="chips">${(state.staples || []).map(n => `<button class="chip soft" data-act="staple-toggle" data-n="${esc(n)}">${esc(n)} <span class="x">✕</span></button>`).join('')}</div><button class="btn sm" data-act="pick-staples">+ 상비 재료 추가</button></div>`;
  return h + '</div>';
}
function viewBackup() {
  let h = top('백업 · 레시피 DB', '', 'more-back') + '<div class="page">';
  h += `<div class="card"><h2>📚 레시피 DB</h2><p class="small">레시피 <b>${RECIPES.length}개</b> · 재료 <b>${DATA.ingredients.items.length}개</b><br><span class="muted">버전 ${DATA.version}${meta.lastUpdateCheck ? ' · 마지막 확인 ' + new Date(meta.lastUpdateCheck).toLocaleString('ko-KR') : ''}</span></p><p class="tiny muted">인터넷에 연결되면 앱을 열 때마다 새 레시피가 있는지 자동으로 확인해요.</p><button class="btn sm" data-act="data-update">지금 업데이트 확인</button></div>`;
  h += `<div class="card"><h2>💾 데이터 백업</h2><p class="small muted">아이 정보, 냉장고, 기록, 즐겨찾기를 파일로 저장하거나 불러와요.${Sync.family ? ' 가족 공유 중에는 서버에도 자동 저장돼요.' : ''}</p><div class="row wrap"><button class="btn sm" data-act="export">내보내기</button><label class="btn sm">불러오기<input type="file" accept="application/json,.json" id="import-file" hidden></label></div></div>`;
  h += `<div class="card"><h2>🎨 화면</h2><div class="seg">${[['', '자동'], ['light', '밝게'], ['dark', '어둡게']].map(([v, l]) => `<button class="${(LS.get('kf_theme', '') === v) ? 'on' : ''}" data-act="theme" data-v="${v}">${l}</button>`).join('')}</div></div>`;
  return h + '</div>';
}
function viewFamily() {
  let h = top('가족 공유', '', 'more-back') + '<div class="page">';
  if (!CFG.supabaseUrl) return h + `<div class="card">서버 설정이 없어요. config.js를 확인해 주세요.</div></div>`;
  if (!Sync.client) return h + `<div class="card empty"><div class="big">☁️</div>${Sync.status === 'offline' ? '인터넷에 연결되면 가족 공유를 쓸 수 있어요.' : '서버에 연결하는 중…'}</div></div>`;
  if (!Sync.user) {
    const mode = ui.authMode || 'login';
    h += `<div class="card"><h2>${mode === 'login' ? '로그인' : '회원가입'}</h2><p class="small muted" style="margin-top:-4px">부부가 각자 이메일로 가입한 뒤, 한 명이 가족을 만들고 초대코드를 공유하면 같은 냉장고를 함께 써요.</p>
      <span class="label">이메일</span><input id="auth-email" type="email" autocomplete="email" placeholder="you@example.com">
      <span class="label">비밀번호 (6자 이상)</span><input id="auth-pw" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">
      <div class="sp"></div><button class="btn primary block" data-act="auth-${mode}">${mode === 'login' ? '로그인' : '가입하기'}</button>
      <button class="btn ghost block" data-act="auth-mode">${mode === 'login' ? '처음이신가요? 회원가입' : '이미 계정이 있어요 · 로그인'}</button></div>`;
    return h + `<p class="tiny muted">로그인하지 않아도 이 기기에서는 모든 기능을 쓸 수 있어요.</p></div>`;
  }
  if (!Sync.family) {
    h += `<div class="card"><p class="small">${esc(Sync.user.email)}로 로그인했어요.</p><span class="label">가족 안에서 부를 이름</span><input id="fam-me" placeholder="예: 엄마, 아빠" value="${esc(LS.get('kf_me', ''))}"></div>`;
    h += `<div class="card"><h2>🏠 새 가족 만들기</h2><p class="small muted" style="margin-top:-4px">지금 이 폰의 아이 정보와 냉장고가 가족 데이터로 올라가요.</p><input id="fam-name" placeholder="가족 이름 (예: 우리집)"><div class="sp"></div><button class="btn primary block" data-act="fam-create">가족 만들기</button></div>`;
    h += `<div class="card"><h2>🔑 초대코드로 참여하기</h2><p class="small muted" style="margin-top:-4px">배우자에게 받은 6자리 코드를 입력하세요. 가족 데이터로 바뀌어요.</p><input id="fam-code" placeholder="예: A1B2C3" style="text-transform:uppercase;letter-spacing:.15em"><div class="sp"></div><button class="btn block" data-act="fam-join">참여하기</button></div>`;
    return h + `<button class="btn ghost block" data-act="auth-logout">로그아웃</button></div>`;
  }
  h += `<div class="card"><h2>🏠 ${esc(Sync.family.name)}</h2><p class="small muted" style="margin-top:-4px">배우자에게 아래 초대코드를 보내 주세요.</p><div class="code">${esc(Sync.family.invite_code)}</div><button class="btn block" data-act="fam-share">초대코드 보내기</button></div>`;
  h += `<div class="card"><h2>👥 구성원</h2>${(Sync.members || []).map(m => `<div class="ing-row">${m.user_id === Sync.user.id ? '🙋' : '👤'} <b>${esc(m.display_name || '가족')}</b>${m.user_id === Sync.user.id ? ' <span class="tiny muted">(나)</span>' : ''}</div>`).join('')}</div>`;
  h += `<div class="card"><h2>☁️ 동기화</h2><p class="small">${syncBadge()} ${Sync.lastSync ? '마지막 동기화 ' + new Date(Sync.lastSync).toLocaleTimeString('ko-KR') : ''}</p><p class="tiny muted">아이 정보, 냉장고, 상비재료, 조리도구, 즐겨찾기, 식단 기록, 장보기 목록이 실시간으로 공유돼요. 인터넷이 끊겨도 쓸 수 있고, 다시 연결되면 자동으로 맞춰져요.</p><button class="btn sm" data-act="sync-now">지금 동기화</button></div>`;
  return h + `<div class="row"><button class="btn ghost grow" data-act="auth-logout">로그아웃</button><button class="btn ghost grow" data-act="fam-leave" style="color:var(--bad)">가족 나가기</button></div><p class="tiny muted">${esc(Sync.user.email)}</p></div>`;
}

/* ───────────── 오버레이 (레시피 상세, 선택창, 시트) ───────────── */
function renderOverlays() {
  let root = $('#overlay');
  if (!root) { root = document.createElement('div'); root.id = 'overlay'; document.body.appendChild(root); }
  let h = '';
  if (ui.detail) h += sheet(viewDetailTitle(), viewDetail(), 'detail-close');
  if (ui.picker) h += sheet(ui.picker.title, viewPicker(), 'picker-done', '완료');
  if (ui.sheet) h += sheet(ui.sheet.title, ui.sheet.body(), 'sheet-close');
  const scrollers = [...root.querySelectorAll('.sheet-b')].map(e => e.scrollTop);
  root.innerHTML = h;
  root.querySelectorAll('.sheet-b').forEach((e, i) => { if (scrollers[i] != null && ui._keepSheet) e.scrollTop = scrollers[i]; });
  ui._keepSheet = true;
  document.body.style.overflow = h ? 'hidden' : '';
}
function sheet(title, body, closeAct, closeLabel) {
  return `<div class="sheet-bg" data-act="${closeAct}"></div><div class="sheet" role="dialog"><div class="sheet-h"><h2>${title}</h2>${closeLabel ? `<button class="btn sm primary" data-act="${closeAct}">${closeLabel}</button>` : `<button class="close" data-act="${closeAct}" aria-label="닫기">✕</button>`}</div><div class="sheet-b">${body}</div></div>`;
}
function detailKids() {
  const ids = ui.detail?.kidIds?.length ? ui.detail.kidIds : (ui.rec?.kidIds?.length ? ui.rec.kidIds : kids().map(k => k.id));
  return ids.map(kidById).filter(Boolean).sort((a, b) => monthsOld(a.birth) - monthsOld(b.birth));
}
function viewDetailTitle() { const r = RECIPE_BY_ID[ui.detail.id]; return r ? `${CAT_INFO[r.c].ic} ${esc(r.n)}` : ''; }
function viewDetail() {
  const r = RECIPE_BY_ID[ui.detail.id]; if (!r) return '';
  const kl = detailKids();
  const ctx = makeCtx(kl, { strict: false, allowMissing: 99 });
  const e = evalRecipe(r, ctx);
  const months = kl.map(k => monthsOld(k.birth));
  const f = portionFactor(r, kl);
  const fav = (state.favorites || []).includes(r.id), rating = (state.ratings || {})[r.id] || 0;
  let h = `<div class="summary"><span>💡</span><span>${esc(r.sum)}</span></div>`;
  h += `<div class="row wrap small muted"><span class="badge">${CAT_INFO[r.c].label}</span><span class="badge">⏱ ${r.t}분</span><span class="badge">${r.m[0]}개월 ~ ${r.m[1] >= 144 ? '12세' : r.m[1] >= 24 ? ageLabel(r.m[1]) : r.m[1] + '개월'}</span>${r.tl.length ? `<span class="badge">🍳 ${esc(r.tl.join('·'))}</span>` : ''}<span class="badge">${r.ml.join('·')}</span></div>`;
  // 경고
  const warns = [];
  if (kl.length && r.m[0] > ctx.youngest) warns.push(kl.length > 1 && ctx.youngest >= 9 ? `<b>${esc(kl[0].name)}</b>에게는 조금 이른 메뉴예요 (${r.m[0]}개월~). 간하기 전에 덜어서 더 잘게 다지고 부드럽게 익혀 주세요.` : `<b>${esc(kl[0].name)}</b>에게는 아직 이른 메뉴예요 (${r.m[0]}개월부터).`);
  for (const x of [...e.req, ...e.opt]) if (!x.ok && x.why) warns.push(`<b>${esc(x.label)}</b>: ${esc(x.why)} → ${e.req.includes(x) ? '이 재료가 필수라 만들기 어려워요' : '빼고 만드세요'}`);
  const usedW = new Set();
  for (const x of [...e.req, ...e.opt]) { const ing = x.use; if (ing && ing.w && !usedW.has(ing.n) && (/질식|금지|알레르기/.test(ing.w) || ing.m + 12 > ctx.youngest)) { usedW.add(ing.n); warns.push(`<b>${esc(ing.n)}</b>: ${esc(ing.w)}`); } }
  if (e.newIngs.length) warns.push(`🆕 처음 먹는 재료: <b>${esc(e.newIngs.join(', '))}</b> — 오전에 소량으로 주고 반응을 지켜보세요.`);
  if (warns.length) h += `<div class="warnbox">⚠️ 주의<br>${warns.map(w => '· ' + w).join('<br>')}</div>`;
  // 분량
  if (kl.length) h += `<p class="small" style="margin:12px 0 4px"><b>👨‍👧 ${kl.map(k => `${esc(k.name)}(${ageLabel(monthsOld(k.birth))})`).join(', ')}</b> 기준 · 기본 분량의 <b>${f.toFixed(1)}배</b></p>`;
  // 재료
  const ingRow = (x, kind) => {
    const name = x.group ? `${esc(x.label)} <span class="tiny muted">(${esc((x.have ? [x.have.n] : x.alts.slice(0, 3)).join('/'))})</span>` : esc(x.label);
    const st = !x.ok ? `<span class="badge bad">${esc(x.why || '불가')}</span>` : x.have ? '<span class="ok-dot">✓</span>' : kind === 'r' ? '<span class="miss-dot">✕</span>' : '<span class="tiny muted">없음</span>';
    return `<div class="ing-row">${st}<span class="grow" style="${!x.ok ? 'text-decoration:line-through;opacity:.6' : ''}">${name}</span><span class="amt">${scaleAmt(x.item.a, f)}</span></div>`;
  };
  h += `<div class="card"><h2>재료</h2>${e.req.map(x => ingRow(x, 'r')).join('')}`;
  if (e.missing.length) h += `<div class="sp"></div><button class="btn sm" data-act="detail-shop">🛒 부족한 ${e.missing.length}개 장보기에 담기</button>`;
  if (e.opt.length) h += `<h3>있으면 좋아요 (선택)</h3>${e.opt.map(x => ingRow(x, 'o')).join('')}`;
  if (e.sea.length) h += `<h3>양념 ${ctx.youngest < 12 ? '<span class="badge warn">돌 전 아이 몫은 넣지 않아요</span>' : ''}</h3>${e.sea.map(x => ingRow(x, 's')).join('')}`;
  h += `</div>`;
  // 아이별 맞춤
  if (kl.length) {
    h += `<div class="card"><h2>🧒 아이별 맞춤 조리</h2>`;
    kl.forEach((k, i) => {
      const m = months[i], st = stageOf(m), share = st.portion / stageOf(refMonth(r)).portion;
      let extra = '';
      if (m < 12 && ['메인', '반찬'].includes(r.c)) extra = ' 잘게 다져서 죽이나 진밥에 섞어 주세요.';
      if (m < 9 && !['밥죽', '간식'].includes(r.c)) extra = ' 아직은 죽 형태가 좋아요. 재료만 곱게 갈아 죽에 넣어 주세요.';
      if (m >= 36 && r.m[1] < 24) extra = ' 큰 아이에게는 양을 늘리고 일반 밥으로 주세요.';
      h += `<div class="kidadj"><b>${kidIcon(k)} ${esc(k.name)}</b> <span class="tiny muted">${ageLabel(m)} · ${st.label}</span><br>질감: ${st.texture} · 크기: ${st.size}<br>간: ${st.season} · 양: 약 ${fmtNum(share)}인분${extra}</div>`;
    });
    h += `</div>`;
  }
  // 조리 순서
  const levels = months.map(seasonLevel);
  const minL = levels.length ? Math.min(...levels) : 2, maxL = levels.length ? Math.max(...levels) : 2;
  const totalP = kl.reduce((s, k) => s + stageOf(monthsOld(k.birth)).portion, 0) || 1;
  const younger = kl.filter((k, i) => levels[i] < maxL);
  const youngShare = Math.round(100 * younger.reduce((s, k) => s + stageOf(monthsOld(k.birth)).portion, 0) / totalP);
  const splitTxt = () => `<b>덜어내기</b> — 간을 하기 전에 <b>${younger.map(k => esc(k.name)).join(', ')}</b> 몫(전체의 약 ${youngShare}%)을 먼저 덜어 두세요.${younger.some(k => monthsOld(k.birth) < 12) ? ' 덜어낸 몫은 간 없이 그대로 줘요.' : ' 덜어낸 몫은 아주 약하게만 간해요.'}`;
  let split = false;
  const steps = r.st.map((s, i) => {
    const isS = s.startsWith('@'); const t = esc(s.replace(/^@/, ''));
    let out = '';
    const needSplit = kl.length > 1 && minL < maxL && !split;
    if (isS && needSplit) { out += `<li class="split">${splitTxt()}</li>`; split = true; }
    if (!isS && needSplit && i === r.st.length - 1 && r.s.length && !r.st.some(x => x.startsWith('@'))) { out += `<li class="split">${splitTxt()}</li>`; split = true; }
    if (isS && kl.length && maxL === 0) out += `<li class="skip"><span class="t">${t}</span><div class="tiny">돌 전에는 이 단계(간하기)를 건너뛰어요.</div></li>`;
    else out += `<li>${t}${isS && split ? ` <span class="tiny muted">(남은 ${kl.filter((k, j) => levels[j] === maxL).map(k => esc(k.name)).join(', ')} 몫에만)</span>` : ''}</li>`;
    return out;
  }).join('');
  h += `<div class="card"><h2>만드는 법</h2><ol class="steps">${steps}</ol>`;
  if (kl.length > 1) {
    const oldestStage = stageIdx(Math.max(...months));
    const softer = kl.filter(k => stageIdx(monthsOld(k.birth)) < oldestStage);
    for (const k of softer) { const st = stageOf(monthsOld(k.birth)); h += `<div class="kidadj">🥄 <b>${esc(k.name)}</b> 몫은 ${st.size} 크기로 한 번 더 다지거나, 물을 조금 넣고 더 끓여 <b>${st.texture}</b>로 맞춰 주세요.</div>`; }
  }
  h += `</div>`;
  h += `<div class="card"><div class="row"><button class="btn ${fav ? 'primary' : ''} grow" data-act="fav" data-id="${r.id}">${fav ? '❤️ 즐겨찾기됨' : '🤍 즐겨찾기'}</button><button class="btn primary grow" data-act="detail-eat">🍽 오늘 먹었어요</button></div><div class="row" style="justify-content:center;margin-top:10px"><span class="small muted">아이 반응</span>${[1, 2, 3, 4, 5].map(n => `<button class="star-btn ${n <= rating ? 'on' : ''}" data-act="rate" data-n="${n}">⭐</button>`).join('')}</div></div>`;
  return h;
}
function viewPicker() {
  const p = ui.picker;
  let h = `<div style="position:sticky;top:0;background:var(--bg);padding:12px 0 6px;z-index:2"><div class="search"><input id="picker-q" type="search" placeholder="재료 검색 (예: 호박, ㄷㄱ)" value="${esc(p.q || '')}" autocomplete="off"></div>`;
  h += `<div class="chips" style="margin-top:8px">${[...p.sel].map(n => `<button class="chip on" data-act="picker-toggle" data-n="${esc(n)}">${esc(n)} ✕</button>`).join('') || '<span class="tiny muted">선택된 재료가 없어요</span>'}</div></div>`;
  return h + `<div id="picker-list">${viewPickerList()}</div>`;
}
function viewPickerList() {
  const p = ui.picker;
  const list = searchIng(p.q || '', '전체').slice(0, 100);
  return `<div class="list">${list.map(i => `<button class="li" data-act="picker-toggle" data-n="${esc(i.n)}"><span class="check ${p.sel.has(i.n) ? 'on' : ''}">✓</span><span class="grow"><span class="t">${esc(i.n)}</span> <span class="tiny muted">${ING_IC[i.c]} ${i.c}</span></span></button>`).join('')}</div>`;
}

/* ───────────── 토스트 ───────────── */
let toastTimer;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.className = 'toast'; t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ───────────── 액션 ───────────── */
function toggleIn(arr, v) { const s = new Set(arr || []); s.has(v) ? s.delete(v) : s.add(v); return [...s]; }
function addShopping(names, from) {
  const cur = state.shopping || [];
  const exist = new Set(cur.filter(s => !s.done).map(s => s.name));
  const add = names.filter(n => !exist.has(n)).map(n => ({ id: uid(), name: n, done: false, from }));
  if (add.length) setKey('shopping', [...cur, ...add]);
  toast(add.length ? `장보기 목록에 ${add.length}개 담았어요` : '이미 장보기 목록에 있어요');
}
function logMeal(rids, meal, kidIds) {
  const entry = { id: uid(), date: todayStr(), meal, rids, kids: kidIds, ts: Date.now() };
  const hist = [...(state.history || []), entry].slice(-400);
  // 먹어본 재료 자동 기록 (24개월 미만)
  const usedNames = new Set();
  for (const id of rids) { const r = RECIPE_BY_ID[id]; if (!r) continue; const ctx = makeCtx(kidIds.map(kidById).filter(Boolean), { strict: false }); const e = evalRecipe(r, ctx); e.used.forEach(i => usedNames.add(i.n)); }
  const ch = kids().map(k => kidIds.includes(k.id) && monthsOld(k.birth) < 24 && (k.tried || []).length ? { ...k, tried: [...new Set([...(k.tried || []), ...usedNames])] } : k);
  state.children = ch; meta.stamps.children = new Date().toISOString(); if (!meta.pending.includes('children')) meta.pending.push('children');
  setKey('history', hist, { render: false });
  // 사용한 냉장고 재료 빼기
  const fridgeUsed = [...usedNames].filter(n => (state.fridge || []).includes(n));
  if (fridgeUsed.length) {
    ui.sheet = { title: '사용한 재료를 뺄까요?', sel: new Set(fridgeUsed), items: fridgeUsed, body: () => `<p class="small muted" style="margin-top:12px">다 쓴 재료를 선택하면 냉장고에서 빼 드려요. 남은 재료는 선택을 풀어 주세요.</p><div class="list">${ui.sheet.items.map(n => `<button class="li" data-act="used-toggle" data-n="${esc(n)}"><span class="check ${ui.sheet.sel.has(n) ? 'on' : ''}">✓</span><span class="grow t">${esc(n)}</span></button>`).join('')}</div><button class="btn primary block" data-act="used-apply">선택한 재료 냉장고에서 빼기</button><div class="sp"></div><button class="btn ghost block" data-act="sheet-close">그대로 두기</button>` };
  }
  toast('식단에 기록했어요 🍽');
  render();
}

const ACTIONS = {
  tab: el => go(el.dataset.tab),
  'kid-new': () => { ui.tab = 'more'; ui.more = 'kidEdit'; ui.kidEdit = { id: uid(), name: '', sex: '', birth: '', allergies: [], avoid: [], dislikes: [], tried: [] }; render(); window.scrollTo(0, 0); },
  'kid-edit': el => { ui.kidEdit = JSON.parse(JSON.stringify(kidById(el.dataset.id))); ui.more = 'kidEdit'; render(); window.scrollTo(0, 0); },
  'kid-cancel': () => { ui.kidEdit = null; ui.more = 'kids'; render(); },
  'kid-sex': el => { readKidForm(); ui.kidEdit.sex = el.dataset.v; render(); },
  'kid-allergy': el => { readKidForm(); ui.kidEdit.allergies = toggleIn(ui.kidEdit.allergies, el.dataset.v); render(); },
  'kid-rm': el => { readKidForm(); ui.kidEdit[el.dataset.k] = (ui.kidEdit[el.dataset.k] || []).filter(n => n !== el.dataset.n); render(); },
  'pick-kid': el => { readKidForm(); const k = el.dataset.k; ui.picker = { title: k === 'avoid' ? '먹으면 안 되는 재료' : '싫어하는 재료', sel: new Set(ui.kidEdit[k] || []), target: 'kid.' + k, q: '' }; ui._keepSheet = false; render(); },
  'kid-save': () => {
    readKidForm(); const d = ui.kidEdit;
    if (!d.name.trim()) return toast('이름을 입력해 주세요');
    if (!d.birth) return toast('생년월일을 입력해 주세요');
    const list = kids().some(k => k.id === d.id) ? kids().map(k => k.id === d.id ? d : k) : [...kids(), d];
    if (ui.rec && !ui.rec.kidIds.includes(d.id)) ui.rec.kidIds.push(d.id);
    ui.kidEdit = null; ui.more = 'kids'; setKey('children', list); toast('저장했어요');
  },
  'kid-del': () => { if (!confirm(`${ui.kidEdit.name}의 정보를 삭제할까요?`)) return; const id = ui.kidEdit.id; ui.kidEdit = null; ui.more = 'kids'; setKey('children', kids().filter(k => k.id !== id)); },
  'rec-kid': el => { const f = recForm(); f.kidIds = toggleIn(f.kidIds, el.dataset.id); ui.recResults = null; render(); },
  'rec-meal': el => { const f = recForm(); f.meal = el.dataset.v; f.cats = MEAL_DEFAULT_CATS[f.meal].slice(); ui.recResults = null; render(); },
  'rec-cat': el => { const f = recForm(); f.cats = toggleIn(f.cats, el.dataset.v).sort((a, b) => CATS.indexOf(a) - CATS.indexOf(b)); ui.recResults = null; render(); },
  'rec-time': el => { const f = recForm(); f.maxTime = +el.dataset.v; meta.recForm = { maxTime: f.maxTime, allowMissing: f.allowMissing }; saveLocal(); ui.recResults = null; render(); },
  'rec-miss': el => { const f = recForm(); f.allowMissing = +el.dataset.v; meta.recForm = { maxTime: f.maxTime, allowMissing: f.allowMissing }; saveLocal(); ui.recResults = null; render(); },
  'rec-miss-more': () => { const f = recForm(); f.allowMissing = Math.min(2, f.allowMissing + 1); ACTIONS['rec-go'](); },
  'rec-go': () => {
    const f = recForm(); const res = recommend(f);
    res.youngest = Math.min(...f.kidIds.map(id => monthsOld(kidById(id).birth)));
    ui.recResults = res; ui.recShown = 3; render();
    setTimeout(() => $('#rec-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  },
  'rec-more': () => { ui.recShown += 3; render(); },
  'combo-shop': el => { const c = ui.recResults.combos[+el.dataset.i]; addShopping(c.missing.map(m => m), c.dishes.map(d => d.r.n).join(', ')); },
  'combo-eat': el => { const c = ui.recResults.combos[+el.dataset.i]; logMeal(c.dishes.map(d => d.r.id), ui.rec.meal, ui.rec.kidIds); },
  open: el => { ui.detail = { id: el.dataset.id, kidIds: ui.tab === 'rec' ? ui.rec?.kidIds : null }; ui._keepSheet = false; renderOverlays(); },
  'detail-close': () => { ui.detail = null; renderOverlays(); },
  'detail-shop': () => { const r = RECIPE_BY_ID[ui.detail.id]; const e = evalRecipe(r, makeCtx(detailKids(), { strict: false })); addShopping(e.missing.map(m => m.label), r.n); },
  'detail-eat': () => { const r = RECIPE_BY_ID[ui.detail.id]; const h = new Date().getHours(); const meal = ui.rec?.meal || (h < 10 ? '아침' : h < 15 ? '점심' : h < 17 ? '간식' : '저녁'); ui.detail = null; logMeal([r.id], meal, detailKids().map(k => k.id)); },
  fav: el => { setKey('favorites', toggleIn(state.favorites, el.dataset.id)); },
  rate: el => { const r = { ...(state.ratings || {}) }; const n = +el.dataset.n; r[ui.detail.id] = r[ui.detail.id] === n ? 0 : n; setKey('ratings', r); },
  'fridge-cat': el => { ui.fridgeCat = el.dataset.v; render(); },
  'fridge-toggle': el => { const n = el.dataset.n; if ((state.staples || []).includes(n) && !(state.fridge || []).includes(n)) return toast(`${n}은(는) 상비 재료예요 (⭐로 해제)`); setKey('fridge', toggleIn(state.fridge, n)); },
  'staple-toggle': el => { setKey('staples', toggleIn(state.staples, el.dataset.n)); },
  'fridge-clear': () => { if (confirm('냉장고 재료를 모두 비울까요? (상비 재료는 그대로예요)')) setKey('fridge', []); },
  'pick-staples': () => { ui.picker = { title: '상비 재료', sel: new Set(state.staples || []), target: 'staples', q: '' }; ui._keepSheet = false; render(); },
  'picker-toggle': el => { const p = ui.picker, n = el.dataset.n; p.sel.has(n) ? p.sel.delete(n) : p.sel.add(n); renderOverlays(); },
  'picker-done': () => {
    const p = ui.picker; ui.picker = null;
    if (p.target === 'staples') setKey('staples', [...p.sel]);
    else if (p.target.startsWith('kid.')) { ui.kidEdit[p.target.slice(4)] = [...p.sel]; render(); }
  },
  'recipe-cat': el => { ui.recipeCat = el.dataset.v; render(); },
  'recipe-fav': () => { ui.recipeFav = !ui.recipeFav; render(); },
  'recipe-fit': () => { ui.recipeFit = !ui.recipeFit; render(); },
  'guide-kid': el => { ui.guideKid = el.dataset.id || ''; render(); },
  'tried-toggle': el => { const k = kidById(ui.guideKid); if (!k) return; setKey('children', kids().map(x => x.id === k.id ? { ...x, tried: toggleIn(x.tried, el.dataset.n) } : x)); },
  more: el => { ui.more = el.dataset.v; render(); window.scrollTo(0, 0); },
  'more-back': () => { ui.more = null; render(); },
  'shop-add': () => { const v = $('#shop-in').value.trim(); if (!v) return; setKey('shopping', [...(state.shopping || []), { id: uid(), name: v, done: false }]); },
  'shop-toggle': el => setKey('shopping', state.shopping.map(s => s.id === el.dataset.id ? { ...s, done: !s.done } : s)),
  'shop-rm': el => setKey('shopping', state.shopping.filter(s => s.id !== el.dataset.id)),
  'shop-clear': () => { if (confirm('장보기 목록을 비울까요?')) setKey('shopping', []); },
  'shop-to-fridge': () => {
    const done = state.shopping.filter(s => s.done);
    const known = done.map(s => s.name).filter(n => ING[n]);
    state.fridge = [...new Set([...(state.fridge || []), ...known])]; meta.stamps.fridge = new Date().toISOString(); if (!meta.pending.includes('fridge')) meta.pending.push('fridge');
    setKey('shopping', state.shopping.filter(s => !s.done));
    toast(`냉장고에 ${known.length}개 넣었어요${done.length > known.length ? ` (재료 목록에 없는 ${done.length - known.length}개 제외)` : ''}`);
  },
  'hist-rm': el => setKey('history', state.history.filter(h => h.id !== el.dataset.id)),
  'tool-toggle': el => setKey('tools', toggleIn(state.tools, el.dataset.v)),
  'sheet-close': () => { ui.sheet = null; renderOverlays(); },
  'used-toggle': el => { const s = ui.sheet.sel, n = el.dataset.n; s.has(n) ? s.delete(n) : s.add(n); renderOverlays(); },
  'used-apply': () => { const sel = ui.sheet.sel; ui.sheet = null; setKey('fridge', (state.fridge || []).filter(n => !sel.has(n))); toast(`냉장고에서 ${sel.size}개 뺐어요`); },
  'data-update': () => checkDataUpdate(true),
  export: () => {
    const blob = new Blob([JSON.stringify({ app: 'kids-fridge', v: 1, at: new Date().toISOString(), state }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `냉장고파먹기-백업-${todayStr()}.json`; document.body.appendChild(a); a.click(); a.remove();
  },
  theme: el => { LS.set('kf_theme', el.dataset.v); applyTheme(); render(); },
  'auth-mode': () => { ui.authMode = ui.authMode === 'signup' ? 'login' : 'signup'; render(); },
  'auth-login': () => Sync.login($('#auth-email').value.trim(), $('#auth-pw').value),
  'auth-signup': () => Sync.signup($('#auth-email').value.trim(), $('#auth-pw').value),
  'auth-logout': () => { if (confirm('로그아웃할까요? 이 기기의 데이터는 그대로 남아요.')) Sync.logout(); },
  'fam-create': () => { const me = $('#fam-me').value.trim(); LS.set('kf_me', me); Sync.createFamily($('#fam-name').value.trim() || '우리 가족', me || '가족'); },
  'fam-join': () => { const me = $('#fam-me').value.trim(); LS.set('kf_me', me); const code = $('#fam-code').value.trim().toUpperCase(); if (code.length < 4) return toast('초대코드를 입력해 주세요'); if (confirm('참여하면 이 폰의 데이터가 가족 데이터로 바뀌어요. 계속할까요?')) Sync.joinFamily(code, me || '가족'); },
  'fam-share': async () => {
    const txt = `[아이 냉장고 파먹기] 가족 초대코드: ${Sync.family.invite_code}\n앱 › 더보기 › 가족 공유에서 로그인 후 코드를 입력해 주세요.\n${location.href.split('#')[0]}`;
    try { if (navigator.share) await navigator.share({ text: txt }); else { await navigator.clipboard.writeText(txt); toast('초대 메시지를 복사했어요'); } } catch (e) { }
  },
  'fam-leave': () => { if (confirm('가족에서 나갈까요? 이 기기에는 현재 데이터가 남아요.')) Sync.leaveFamily(); },
  'sync-now': () => Sync.pullAll(true),
};
function readKidForm() {
  const d = ui.kidEdit; if (!d) return;
  const n = $('#kid-name'), b = $('#kid-birth');
  if (n) d.name = n.value; if (b) d.birth = b.value;
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'rec-opts') { ui.recOpts = !el.open; return; }  // <details> 토글 상태 기억
  if (el.tagName === 'A') e.preventDefault();
  const fn = ACTIONS[act];
  if (fn) { e.preventDefault(); fn(el); }
});
document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'fridge-q') { ui.fridgeQ = e.target.value; $('#fridge-list').innerHTML = viewFridgeList(); }
  else if (id === 'recipe-q') { ui.recipeQ = e.target.value; $('#recipe-list').innerHTML = viewRecipeList(); }
  else if (id === 'guide-q') { ui.guideQ = e.target.value; const k = kidById(ui.guideKid); $('#guide-list').innerHTML = viewGuideList(k, k ? monthsOld(k.birth) : ui.guideMonth); }
  else if (id === 'picker-q') { ui.picker.q = e.target.value; $('#picker-list').innerHTML = viewPickerList(); }
  else if (id === 'guide-month') { ui.guideMonth = +e.target.value; render(); }
  else if (id === 'kid-birth') { readKidForm(); }
});
document.addEventListener('change', async e => {
  if (e.target.id === 'kid-birth') { readKidForm(); render(); }
  if (e.target.id === 'import-file') {
    const file = e.target.files[0]; if (!file) return;
    try {
      const j = JSON.parse(await file.text());
      if (j.app !== 'kids-fridge' || !j.state) throw new Error('형식');
      if (!confirm('백업 파일로 현재 데이터를 덮어쓸까요?')) return;
      for (const k of SYNC_KEYS) if (j.state[k] !== undefined) { state[k] = j.state[k]; meta.stamps[k] = new Date().toISOString(); if (!meta.pending.includes(k)) meta.pending.push(k); }
      saveLocal(); Sync.schedule(); toast('불러왔어요'); render();
    } catch (err) { toast('백업 파일을 읽을 수 없어요'); }
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'shop-in') ACTIONS['shop-add'](); });

function applyTheme() { const t = LS.get('kf_theme', ''); if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }

/* ───────────── 가족 공유 (Supabase) ───────────── */
const Sync = {
  client: null, user: null, family: null, members: [], status: 'idle', lastSync: 0, channel: null, timer: null,
  async init() {
    if (!CFG.supabaseUrl || !CFG.supabaseKey) return;
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      this.client = mod.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'kf_auth' } });
    } catch (e) { this.status = 'offline'; render(); return; }
    const { data } = await this.client.auth.getSession();
    this.user = data.session?.user || null;
    this.client.auth.onAuthStateChange((ev, session) => {
      const was = this.user?.id; this.user = session?.user || null;
      if (this.user && this.user.id !== was) this.loadFamily();
      if (!this.user) { this.family = null; this.unsubscribe(); render(); }
    });
    if (this.user) await this.loadFamily(); else render();
  },
  err(e, fallback) {
    const m = (e?.message || '').toLowerCase();
    if (m.includes('invalid login')) return toast('이메일 또는 비밀번호가 맞지 않아요');
    if (m.includes('already registered')) return toast('이미 가입된 이메일이에요. 로그인해 주세요');
    if (m.includes('email not confirmed')) return toast('메일함에서 가입 확인 링크를 먼저 눌러 주세요');
    if (m.includes('password')) return toast('비밀번호는 6자 이상이어야 해요');
    if (m.includes('fetch') || m.includes('network')) return toast('인터넷 연결을 확인해 주세요');
    toast(fallback + (e?.message ? ` (${e.message})` : ''));
  },
  async login(email, pw) {
    if (!email || !pw) return toast('이메일과 비밀번호를 입력해 주세요');
    const { error } = await this.client.auth.signInWithPassword({ email, password: pw });
    if (error) return this.err(error, '로그인 실패'); toast('로그인했어요');
  },
  async signup(email, pw) {
    if (!email || !pw) return toast('이메일과 비밀번호를 입력해 주세요');
    const { data, error } = await this.client.auth.signUp({ email, password: pw });
    if (error) return this.err(error, '가입 실패');
    if (!data.session) { ui.authMode = 'login'; render(); toast('확인 메일을 보냈어요. 링크를 누른 뒤 로그인해 주세요'); }
    else toast('가입 완료!');
  },
  async logout() { this.unsubscribe(); await this.client.auth.signOut(); this.family = null; meta.familyId = null; saveLocal(); render(); },
  async loadFamily() {
    const { data, error } = await this.client.from('family_members').select('family_id, display_name, families(id,name,invite_code)').eq('user_id', this.user.id).limit(1);
    if (error) { this.status = 'offline'; render(); if (!/fetch|network/i.test(error.message)) toast('가족 정보 오류: ' + error.message); return; }
    if (data && data.length && data[0].families) {
      this.family = data[0].families; meta.familyId = this.family.id; saveLocal();
      await this.pullAll(); this.subscribe(); this.loadMembers();
    } else { this.family = null; meta.familyId = null; saveLocal(); }
    render();
  },
  async loadMembers() {
    const { data } = await this.client.from('family_members').select('user_id, display_name').eq('family_id', this.family.id);
    this.members = data || []; render();
  },
  async createFamily(name, me) {
    const { data, error } = await this.client.rpc('create_family', { p_name: name, p_display: me });
    if (error) return this.err(error, '가족 만들기 실패');
    meta.pending = [...SYNC_KEYS]; saveLocal();       // 내 데이터를 올림
    await this.loadFamily(); toast('가족을 만들었어요! 초대코드를 배우자에게 보내세요');
  },
  async joinFamily(code, me) {
    const { error } = await this.client.rpc('join_family', { p_code: code, p_display: me });
    if (error) return this.err(error, /not found|없/.test(error.message) ? '초대코드를 찾을 수 없어요' : '참여 실패');
    meta.pending = []; meta.stamps = {}; saveLocal();  // 가족 데이터를 우선
    await this.loadFamily(); toast('가족에 참여했어요!');
  },
  async leaveFamily() {
    await this.client.from('family_members').delete().eq('family_id', this.family.id).eq('user_id', this.user.id);
    this.unsubscribe(); this.family = null; meta.familyId = null; saveLocal(); render();
  },
  async pullAll(manual) {
    if (!this.family) return;
    this.status = 'busy'; render();
    const { data, error } = await this.client.from('family_state').select('key,value,updated_at').eq('family_id', this.family.id);
    if (error) { this.status = 'offline'; render(); if (manual) toast('동기화 실패 · 인터넷 연결을 확인해 주세요'); return; }
    const remote = Object.fromEntries((data || []).map(r => [r.key, r]));
    let changed = false;
    for (const k of SYNC_KEYS) {
      const rr = remote[k], local = meta.stamps[k] ? Date.parse(meta.stamps[k]) : 0;
      if (meta.pending.includes(k) && (!rr || local >= Date.parse(rr.updated_at))) continue; // 내 변경이 최신 → 올리기
      if (rr) {
        if (!local || Date.parse(rr.updated_at) > local || !meta.pending.includes(k)) {
          if (JSON.stringify(state[k]) !== JSON.stringify(rr.value)) { state[k] = rr.value; changed = true; }
          meta.stamps[k] = rr.updated_at; meta.pending = meta.pending.filter(x => x !== k);
        }
      } else if (!meta.pending.includes(k)) meta.pending.push(k);
    }
    if (state.staples == null && DATA) state.staples = DATA.ingredients.items.filter(i => i.st).map(i => i.n);
    saveLocal();
    await this.flush();
    this.status = 'ok'; this.lastSync = Date.now();
    if (changed) render(); else render();
    if (manual) toast('동기화했어요');
  },
  schedule() { if (!this.family) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 700); },
  async flush() {
    if (!this.family || !meta.pending.length) { if (this.family && this.status !== 'offline') this.status = 'ok'; return; }
    if (!navigator.onLine) { this.status = 'offline'; render(); return; }
    this.status = 'busy';
    const keys = [...meta.pending];
    const rows = keys.map(k => ({ family_id: this.family.id, key: k, value: state[k] ?? null, updated_at: meta.stamps[k] || new Date().toISOString(), updated_by: this.user.id }));
    const { error } = await this.client.from('family_state').upsert(rows);
    if (error) { this.status = 'offline'; render(); return; }
    meta.pending = meta.pending.filter(k => !keys.includes(k)); saveLocal();
    this.status = 'ok'; this.lastSync = Date.now();
    const b = document.querySelector('.top .badge'); if (b) b.outerHTML = syncBadge();
  },
  subscribe() {
    this.unsubscribe();
    this.channel = this.client.channel('fam-' + this.family.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_state', filter: `family_id=eq.${this.family.id}` }, payload => {
        const row = payload.new; if (!row || !row.key || !SYNC_KEYS.includes(row.key)) return;
        const local = meta.stamps[row.key] ? Date.parse(meta.stamps[row.key]) : 0;
        if (Date.parse(row.updated_at) <= local) return;
        state[row.key] = row.value; meta.stamps[row.key] = row.updated_at; meta.pending = meta.pending.filter(x => x !== row.key);
        saveLocal(); this.lastSync = Date.now();
        if (row.updated_by !== this.user.id) toast(row.key === 'fridge' ? '가족이 냉장고를 업데이트했어요 🧊' : '가족이 정보를 업데이트했어요');
        render();
      })
      .subscribe(st => { if (st === 'SUBSCRIBED') { this.status = 'ok'; } });
  },
  unsubscribe() { if (this.channel) { this.client.removeChannel(this.channel); this.channel = null; } },
};
window.addEventListener('online', () => { Sync.pullAll(); checkDataUpdate(); });
window.addEventListener('offline', () => { Sync.status = 'offline'; render(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (Sync.family) Sync.pullAll();
  if (Date.now() - (meta.lastUpdateCheck || 0) > 6 * 3600e3) checkDataUpdate();
  if (ui.tab !== 'more' || !ui.kidEdit) render();   // 날짜가 바뀌면 개월수 갱신
});

/* ───────────── 시작 ───────────── */
(async function start() {
  applyTheme();
  render();
  try { await loadData(); }
  catch (e) { $('#app').innerHTML = `<div class="loader">레시피를 불러오지 못했어요.<br>인터넷 연결 후 다시 열어 주세요.<br><span class="tiny">${esc(e.message)}</span></div>`; return; }
  render();
  checkDataUpdate();
  Sync.init();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    try { navigator.serviceWorker.register('sw.js'); } catch (e) { }
  }
})();
