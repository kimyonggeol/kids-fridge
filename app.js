/* 아이 냉장고 파먹기 — PWA v2
 * 데이터: data/ingredients.json, data/recipes.json (schema 2, 자동 업데이트)
 * 저장: localStorage (+ Supabase 가족 공유)
 */
const CFG = window.KF_CONFIG || {};
const APP_VERSION = '2.0.0';

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
const ING_CATS = ['냉동식품', '곡류·면', '채소', '버섯', '과일', '육류', '생선·해산물', '해조류', '달걀·유제품', '두부·콩·견과', '양념·소스', '가공·기타'];
const ING_IC = { '냉동식품': '❄️', '곡류·면': '🌾', '채소': '🥕', '버섯': '🍄', '과일': '🍎', '육류': '🥩', '생선·해산물': '🐟', '해조류': '🌿', '달걀·유제품': '🥚', '두부·콩·견과': '🫘', '양념·소스': '🧂', '가공·기타': '📦' };
const NUTRI = { '곡류·면': '탄수화물', '육류': '단백질', '생선·해산물': '단백질', '두부·콩·견과': '단백질', '채소': '채소', '버섯': '채소', '해조류': '채소', '과일': '과일' };
const CARB_VEG = new Set(['감자', '고구마', '단호박', '옥수수', '밤', '밥', '냉동 밥']);
const PROTEIN_CATS = new Set(['육류', '생선·해산물']);
const ADULT_P = 2.2;                 // 어른 1명 = 유아(2~3세) 1인분의 2.2배
const LEVEL_MULT = [0, 0.5, 1, 1.5, 2];
const SALTY = new Set(['소금', '아기간장', '국간장', '진간장', '된장', '고추장', '쌈장', '설탕', '올리고당', '케첩', '굴소스', '짜장가루', '매실청', '멸치액젓', '새우젓', '마요네즈', '꿀', '메이플시럽', '돈가스소스', '피시소스', '초고추장']);
const UNIT_BATCHIM = { 'g': 'ㅁ', 'ml': '', '개': '', '큰술': 'ㄹ', '작은술': 'ㄹ', '컵': 'ㅂ', '장': 'ㅇ', '쪽': 'ㄱ', '꼬집': 'ㅂ', '방울': 'ㄹ', '줌': 'ㅁ', '대': '', '송이': '' };
const EACH_G = { '달걀': 50, '달걀노른자': 17, '메추리알': 10, '밤': 15, '대추': 4, '만두': 25, '유부': 10, '전복': 60, '옥수수': 200, '떡뻥': 1, '냉동 돈가스': 120, '냉동 치킨너겟': 20, '냉동 동그랑땡': 25, '냉동 생선까스': 100, '소고기 큐브': 20, '채소 큐브': 20, '마늘': 5, '청양고추': 10, '페페론치노': 0.3 };
const SHEET_G = { '김': 2, '식빵': 35, '또띠아': 40, '아기치즈': 18, '다시마': 0 };
const NO_YIELD = new Set(['국물용 멸치', '다시마']);
const RAW_X = { '쌀': 1, '쌀가루': 1, '귀리': 1, '누룽지': 1.5, '소면': 2.5, '스파게티면': 2.3, '마카로니': 2.3, '칼국수면': 2, '당면': 3, '쌀국수': 2.5, '검은콩': 2 };

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
  ['❄️', '냉동 국·이유식', '냉장실에서 해동한 뒤 냄비에서 팔팔 끓여 식혀 주세요. 한 번 해동한 건 다시 얼리지 않아요.'],
];
const STEP_ICONS = [
  [/불려|불리/g, '💧'], [/핏물/g, '💧'], [/씻어|헹궈|해감|씻고/g, '🚿'], [/갈아|갈고/g, '🌀'], [/체에|걸러/g, '🥄'],
  [/구워|굽고|굽거나|구운/g, '🔥'], [/쪄|찌거나|찜기|중탕/g, '♨️'], [/데쳐|삶아|삶고/g, '♨️'],
  [/볶아|볶다|볶고|볶은/g, '🍳'], [/부쳐|부치/g, '🍳'], [/끓여|끓이|끓으|졸여|졸이/g, '🍲'], [/재워/g, '⏳'],
  [/썰어|썰고|다져|다지고|깍둑|잘라|자르고|떼고|떼어|벗기|벗겨|찢어|찢고|손질|파내/g, '🔪'], [/으깨/g, '🥄'],
  [/간해|간을 맞|간하고/g, '🧂'], [/섞어|섞고|버무려|무쳐|비벼|풀어|저어/g, '🥣'], [/빚어|뭉쳐|말아|채워|꽂아/g, '🤲'], [/식혀|얼린|얼려/g, '❄️'],
  [/담아|올려|곁들|뿌려|둘러/g, '🍽️'],
];
function stepIcon(t) {
  let best = null, bi = -1;
  for (const [re, ic] of STEP_ICONS) { re.lastIndex = 0; let m; while ((m = re.exec(t))) { if (m.index >= bi) { bi = m.index; best = ic; } } }
  return best || '👩‍🍳';
}

/* ───────────── 상태 ───────────── */
const SYNC_KEYS = ['children', 'fridge', 'staples', 'tools', 'favorites', 'ratings', 'history', 'shopping', 'prefs'];
let DATA = null, ING = {}, RECIPES = [], RECIPE_BY_ID = {}, GROUP_OF = {};
const defaultPrefs = () => ({ adult: false, adults: 2, spicy: false });
const defaultState = () => ({ children: [], fridge: [], staples: null, tools: TOOLS.slice(), favorites: [], ratings: {}, history: [], shopping: [], prefs: defaultPrefs() });
let state = Object.assign(defaultState(), LS.get('kf_state', {}));
state.prefs = Object.assign(defaultPrefs(), state.prefs || {});
let meta = Object.assign({ stamps: {}, pending: [], familyId: null, recForm: null, lastUpdateCheck: 0, skip: { date: '', ids: [] } }, LS.get('kf_meta', {}));
const ui = { tab: 'rec', more: null, detail: null, picker: null, kidEdit: null, sheet: null, fridgeQ: '', fridgeCat: '전체', recipeQ: '', recipeCat: '전체', recipeFav: false, recipeFit: true, guideKid: null, guideMonth: 12, guideQ: '', rec: null, R: null };

function saveLocal() { LS.set('kf_state', state); LS.set('kf_meta', meta); }
function touch(key) { meta.stamps[key] = new Date().toISOString(); if (!meta.pending.includes(key)) meta.pending.push(key); }
function setKey(key, value, opts = {}) {
  state[key] = value; touch(key); saveLocal(); Sync.schedule();
  if (opts.render !== false) render();
}
const kids = () => state.children || [];
const kidById = id => kids().find(k => k.id === id);
const prefs = () => state.prefs || defaultPrefs();
function setPrefs(p) { setKey('prefs', Object.assign({}, prefs(), p)); }
function skipIds() { if (meta.skip?.date !== todayStr()) meta.skip = { date: todayStr(), ids: [] }; return meta.skip.ids; }

/* ───────────── 데이터 로딩 ───────────── */
async function fetchJSON(path, noStore) {
  const r = await fetch((CFG.dataBase || 'data/') + path + (noStore ? `?t=${Date.now()}` : ''), { cache: noStore ? 'no-store' : 'default' });
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}
function applyData(d) {
  DATA = d; ING = {}; GROUP_OF = {};
  for (const i of d.ingredients.items) ING[i.n] = i;
  for (const [g, mem] of Object.entries(d.ingredients.groups)) for (const n of mem) GROUP_OF[n] = g;
  RECIPES = d.recipes.items;
  RECIPE_BY_ID = Object.fromEntries(RECIPES.map(r => [r.id, r]));
  if (!state.staples) { state.staples = d.ingredients.items.filter(i => i.st && i.k !== 'hidden').map(i => i.n); saveLocal(); }
}
async function fetchAllData() {
  const [ingredients, recipes] = await Promise.all([fetchJSON('ingredients.json', true), fetchJSON('recipes.json', true)]);
  const d = { ingredients, recipes, version: recipes.v };
  LS.set('kf_data', d); applyData(d); return d;
}
async function loadData() {
  const cached = LS.get('kf_data', null);
  if (cached && cached.recipes?.schema === 2) { applyData(cached); return; }
  try { await fetchAllData(); }
  catch (e) { if (cached && cached.recipes?.schema === 2) applyData(cached); else throw e; }
}
async function checkDataUpdate(manual) {
  try {
    const v = await fetchJSON('version.json', true);
    meta.lastUpdateCheck = Date.now(); saveLocal();
    if (DATA && v.v === DATA.version) { if (manual) toast(`최신 레시피예요 (${RECIPES.length}개)`); return; }
    const before = RECIPES.length;
    await fetchAllData();
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
function searchIng(q, cat, opts = {}) {
  let list = DATA.ingredients.items.filter(i => i.k !== 'hidden' && !(opts.noAdult && i.k === 'adult') && !(opts.noSoup && i.k === 'soup'));
  if (cat && cat !== '전체') list = list.filter(i => i.c === cat);
  if (!q) return list;
  const nq = norm(q), c = isCho(nq), key = n => c ? cho(norm(n)) : norm(n);
  return list.filter(i => matchIng(i, q)).sort((a, b) => {
    const sa = key(a.n).startsWith(nq) ? 0 : key(a.n).includes(nq) ? 1 : 2;
    const sb = key(b.n).startsWith(nq) ? 0 : key(b.n).includes(nq) ? 1 : 2;
    return sa - sb;
  });
}

/* ───────────── 보유 재료 (냉동 대체 포함) ───────────── */
function expandHave(names) {
  const have = new Set(names), from = {};
  for (const n of names) for (const b of (ING[n]?.sub || [])) if (!have.has(b)) { have.add(b); from[b] = n; }
  for (const i of DATA.ingredients.items) if (i.k === 'hidden') have.add(i.n);
  return { have, from };
}

/* ───────────── 추천 엔진 ───────────── */
function makeCtx(kidList, opts = {}) {
  const months = kidList.map(k => monthsOld(k.birth));
  const H = expandHave([...(state.fridge || []), ...(state.staples || [])]);
  const F = expandHave(state.fridge || []);
  return Object.assign({
    kids: kidList, months,
    youngest: months.length ? Math.min(...months) : 999,
    oldest: months.length ? Math.max(...months) : 0,
    allergy: new Set(kidList.flatMap(k => k.allergies || [])),
    avoid: new Set(kidList.flatMap(k => k.avoid || [])),
    dislikes: new Set(kidList.flatMap(k => k.dislikes || [])),
    have: H.have, subFrom: H.from, fridge: F.have,
    meal: null, maxTime: 0, allowMissing: 99, tools: null, strict: true, adult: false, soup: null,
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
function resolveItem(item, ctx, noBlock) {
  const cands = item.g ? DATA.ingredients.groups[item.g] : [item.i];
  const allowed = [], blocked = [];
  for (const n of cands) {
    const ing = ING[n]; const why = noBlock ? null : ingBlock(ing, ctx);
    (why ? blocked : allowed).push({ ing, why });
  }
  const have = allowed.find(x => ctx.have.has(x.ing.n));
  return {
    item, label: item.g || item.i, group: !!item.g,
    ok: allowed.length > 0, why: blocked[0]?.why,
    have: have ? have.ing : null, use: (have || allowed[0])?.ing || null,
    sub: have ? ctx.subFrom[have.ing.n] : null,
    alts: allowed.map(x => x.ing.n),
  };
}
const adultOK = r => r.m[1] >= 12 && r.ad && r.ad.sc > 0;
function evalRecipe(r, ctx) {
  const adapt = r.m[0] > ctx.youngest;
  if (ctx.strict) {
    if (adapt && !(ctx.kids.length > 1 && ctx.youngest >= 9 && r.m[0] <= 15 && ctx.oldest >= r.m[0])) return null;
    if (ctx.youngest > r.m[1] + (r.m[1] < 12 ? 2 : 12)) return null;
    if (ctx.maxTime && r.t > ctx.maxTime) return null;
    if (ctx.tools && r.tl.length && !r.tl.some(t => ctx.tools.includes(t))) return null;
    if (ctx.adult && !adultOK(r)) return null;
  }
  const req = r.r.map(it => resolveItem(it, ctx));
  if (ctx.strict && req.some(x => !x.ok)) return null;
  const missing = req.filter(x => x.ok && !x.have);
  if (missing.length > ctx.allowMissing) return null;
  const opt = r.o.map(it => resolveItem(it, ctx));
  const sea = r.s.map(it => resolveItem(it, { ...ctx, youngest: Math.max(ctx.oldest, 12) }));
  const adI = ctx.adult && r.ad ? (r.ad.i || []).map(it => resolveItem(it, ctx, true)) : [];
  const used = [...req, ...opt.filter(x => x.ok && x.have)].map(x => x.use).filter(Boolean);
  const fridgeUsed = [...new Set(used.filter(i => ctx.fridge.has(i.n)).map(i => ctx.subFrom[i.n] || i.n))];
  let score = 100 * (req.length ? (req.length - missing.length) / req.length : 1) - 30 * missing.length;
  score += 6 * opt.filter(x => x.ok && x.have).length + 4 * fridgeUsed.length;
  if ((state.favorites || []).includes(r.id)) score += 15;
  score += 4 * ((state.ratings || {})[r.id] || 0);
  if (ctx.meal) score += r.ml.includes(ctx.meal) ? 10 : -15;
  if (ctx.oldest > r.m[1]) score -= ctx.oldest > r.m[1] + 12 ? 45 : 15;
  if (adapt) score -= 10;
  if (ctx.adult) score += 4 * (r.ad?.sc || 0) + 2 * adI.filter(x => x.have).length;
  const dislikeHits = used.filter(i => ctx.dislikes.has(i.n)).map(i => i.n);
  score -= 12 * dislikeHits.length;
  const last = lastEaten(r.id);
  if (last != null) score -= last <= 2 ? 40 : last <= 5 ? 20 : last <= 10 ? 8 : 0;
  const newIngs = [];
  ctx.kids.forEach((k, i) => {
    if (ctx.months[i] >= 24 || !(k.tried || []).length) return;
    for (const ing of used) if (!(k.tried || []).includes(ing.n) && ing.c !== '양념·소스' && ing.k !== 'hidden' && !newIngs.includes(ing.n)) newIngs.push(ing.n);
  });
  if (newIngs.length > 1) score -= 15 * (newIngs.length - 1);
  score += Math.random() * 6;
  return { r, score, req, opt, sea, adI, missing, used, fridgeUsed, dislikeHits, newIngs, lastDays: last, adapt };
}
function lastEaten(rid) {
  const t = todayStr(); let best = null;
  for (const h of state.history || []) if (h.rids.includes(rid)) { const d = daysBetween(h.date, t); if (best == null || d < best) best = d; }
  return best;
}
const soupContents = name => (ING[name]?.soup || []);
const ingOrGroup = n => ING[n] || (DATA.ingredients.groups[n] ? ING[DATA.ingredients.groups[n][0]] : null);
function nutriOf(ings) {
  const s = new Set();
  for (const i of ings) {
    if (!i) continue;
    if (CARB_VEG.has(i.n)) s.add('탄수화물');
    if (NUTRI[i.c]) s.add(NUTRI[i.c]);
    if (i.c === '달걀·유제품') s.add(/달걀|메추리/.test(i.n) ? '단백질' : '칼슘');
  }
  return s;
}

/* 추천: 카테고리별 후보 풀 → 한 끼 조합 */
function recForm() {
  if (!ui.rec) {
    const h = new Date().getHours();
    const meal = h < 10 ? '아침' : h < 15 ? '점심' : h < 17 ? '간식' : '저녁';
    const saved = meta.recForm || {};
    ui.rec = { kidIds: kids().map(k => k.id), meal, cats: MEAL_DEFAULT_CATS[meal].slice(), maxTime: saved.maxTime || 0, allowMissing: saved.allowMissing ?? 0, soup: null };
  }
  ui.rec.kidIds = ui.rec.kidIds.filter(id => kidById(id));
  if (!ui.rec.kidIds.length && kids().length) ui.rec.kidIds = kids().map(k => k.id);
  if (ui.rec.soup && !(state.fridge || []).includes(ui.rec.soup)) ui.rec.soup = null;
  return ui.rec;
}
const selKids = f => f.kidIds.map(kidById).filter(Boolean);
const canAdult = f => selKids(f).some(k => monthsOld(k.birth) >= 12);
const adultOn = f => !!prefs().adult && canAdult(f);
const effCats = f => f.soup ? f.cats.filter(c => c !== '국') : f.cats;
function recCtx(f) {
  return makeCtx(selKids(f), { meal: f.meal, maxTime: f.maxTime || 0, allowMissing: f.allowMissing, tools: state.tools?.length ? state.tools : null, adult: adultOn(f), soup: f.soup });
}
function startRec() {
  const f = recForm(), ctx = recCtx(f);
  const pools = {}, emptyCats = [];
  for (const c of effCats(f)) {
    const list = RECIPES.filter(r => r.c === c).map(r => evalRecipe(r, ctx)).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 60);
    if (list.length) pools[c] = list; else emptyCats.push(c);
  }
  ui.R = { f: JSON.parse(JSON.stringify(f)), adult: ctx.adult, pools, emptyCats, seen: new Set(), slotTried: {}, combos: [], notice: '', youngest: ctx.youngest, round: 0 };
  nextCombos();
}
function nextCombos() {
  const R = ui.R, skip = new Set(skipIds()), exhausted = [];
  const pools = {};
  for (const [c, list] of Object.entries(R.pools)) {
    let l = list.filter(e => !skip.has(e.r.id) && !R.seen.has(e.r.id));
    if (!l.length) { l = list.filter(e => !skip.has(e.r.id)); if (R.round) exhausted.push(c); for (const e of l) R.seen.delete(e.r.id); }
    if (l.length) pools[c] = l;
  }
  R.notice = exhausted.length ? `${exhausted.map(c => CAT_INFO[c].label).join(', ')}: 조건에 맞는 후보를 모두 보셨어요. 처음 후보부터 다시 보여드려요.` : '';
  R.combos = buildCombos(pools, R.f, 3);
  for (const c of R.combos) for (const d of c.dishes) R.seen.add(d.r.id);
  R.slotTried = {}; R.round++;
}
function buildCombos(pools, f, max) {
  const cats = Object.keys(pools);
  const k = cats.length > 3 ? 4 : cats.length > 2 ? 5 : 7;
  const top = cats.map(c => pools[c].slice(0, k));
  const combos = [];
  const walk = (i, pick) => {
    if (i === top.length) { if (pick.length) combos.push(scoreCombo(pick, f)); return; }
    for (const e of top[i]) walk(i + 1, [...pick, e]);
  };
  if (cats.length) walk(0, []);
  else if (f.soup) combos.push(scoreCombo([], f));
  combos.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const c of combos) {
    const ids = c.dishes.map(d => d.r.id);
    if (picked.every(p => !ids.some(id => p.dishes.some(d => d.r.id === id)))) picked.push(c);
    if (picked.length >= max) break;
  }
  if (picked.length < max) for (const c of combos) { if (!picked.includes(c)) picked.push(c); if (picked.length >= max) break; }
  return picked;
}
function scoreCombo(dishes, f) {
  let score = dishes.length ? dishes.reduce((s, d) => s + d.score, 0) / dishes.length : 50;
  const count = {};
  for (const d of dishes) for (const i of new Set(d.used.map(x => x.n))) count[i] = (count[i] || 0) + 1;
  for (const [n, c] of Object.entries(count)) {
    if (c < 2 || (state.staples || []).includes(n) || ING[n]?.k === 'hidden') continue;
    score -= (PROTEIN_CATS.has(ING[n]?.c) ? 12 : 3) * (c - 1);
  }
  const soupIngs = f.soup ? soupContents(f.soup).map(ingOrGroup).filter(Boolean) : [];
  if (f.soup) {
    const sc = new Set(soupContents(f.soup));
    for (const d of dishes) for (const i of d.used) if (sc.has(i.n) || sc.has(GROUP_OF[i.n])) score -= 8;
  }
  const fridgeCover = new Set(dishes.flatMap(d => d.fridgeUsed)).size;
  score += 3 * fridgeCover;
  const nut = nutriOf([...dishes.flatMap(d => d.used), ...soupIngs]);
  for (const k of ['탄수화물', '단백질', '채소']) if (nut.has(k)) score += 6;
  const time = dishes.length ? Math.max(...dishes.map(d => d.r.t)) : 10;
  if (f.meal === '아침' && time > 30) score -= 8;
  const missing = [...new Set(dishes.flatMap(d => d.missing.map(m => m.label)))];
  return { dishes, score, nut: [...nut], time, missing, fridgeCover, soup: f.soup };
}
function swapDish(ci, di, skipThis) {
  const R = ui.R, combo = R.combos[ci], old = combo.dishes[di], c = old.r.c;
  const key = ci + ':' + c;
  const tried = R.slotTried[key] = R.slotTried[key] || new Set([old.r.id]);
  tried.add(old.r.id);
  const skip = new Set(skipIds());
  const inCombo = new Set(combo.dishes.map(d => d.r.id));
  let cands = (R.pools[c] || []).filter(e => !skip.has(e.r.id) && !inCombo.has(e.r.id) && !tried.has(e.r.id));
  if (!cands.length) {
    toast(R.f.allowMissing < 2 ? `다른 ${CAT_INFO[c].label} 후보가 없어요. 조건에서 부족 재료 허용을 늘려 보세요` : `다른 ${CAT_INFO[c].label} 후보가 없어요`);
    if (skipThis) { combo.dishes.splice(di, 1); R.combos[ci] = scoreCombo(combo.dishes, R.f); render(); }
    return;
  }
  let best = null;
  for (const e of cands.slice(0, 12)) {
    const ds = combo.dishes.slice(); ds[di] = e;
    const sc = scoreCombo(ds, R.f);
    if (!best || sc.score > best.score) best = sc;
  }
  R.combos[ci] = best;
  const nd = best.dishes[di];
  tried.add(nd.r.id); R.seen.add(nd.r.id);
  render();
}

/* ───────────── 분량 계산 ───────────── */
const parseNum = s => s.includes('/') ? s.split('/').reduce((a, b) => a / b) : parseFloat(s);
function parseAmt(a) { const m = String(a).match(/^([\d./]+)(.*)$/); return m ? { v: parseNum(m[1]), u: m[2] } : null; }
function fmtFrac(v) {
  const w = Math.floor(v + 1e-9), f = v - w;
  const opts = [[0, ''], [0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'], [1, '']];
  let best = opts[0]; for (const o of opts) if (Math.abs(o[0] - f) < Math.abs(best[0] - f)) best = o;
  const W = best[0] === 1 ? w + 1 : w;
  if (!W && !best[1]) return '⅛';
  return (W ? String(W) : '') + best[1];
}
function fmtAmt(v, u) {
  if (u === 'g' || u === 'ml') { v = v >= 20 ? Math.round(v / 5) * 5 : Math.max(1, Math.round(v)); return v + u; }
  if (u === '큰술' || u === '작은술' || u === '꼬집') {
    const tsp = u === '큰술' ? v * 3 : u === '작은술' ? v : v / 16;
    if (tsp < 0.2) return Math.max(1, Math.round(tsp * 16)) + '꼬집';
    if (tsp >= 2.8) return fmtFrac(tsp / 3) + '큰술';
    return fmtFrac(tsp) + '작은술';
  }
  if (u === '방울') return Math.max(1, Math.round(v)) + '방울';
  if (v >= 2.75 && u !== '컵') return Math.round(v) + u;
  return fmtFrac(v) + u;
}
const scaleAmt = (a, f) => { const p = parseAmt(a); return p ? fmtAmt(p.v * f, p.u) : a; };
function amtGrams(name, a) {
  const p = parseAmt(a); if (!p || NO_YIELD.has(name)) return 0;
  const x = RAW_X[name] || 1;
  switch (p.u) {
    case 'g': case 'ml': return p.v * x;
    case '개': return p.v * (EACH_G[name] ?? 30);
    case '장': return p.v * (SHEET_G[name] ?? 10);
    case '큰술': return p.v * 15; case '작은술': return p.v * 5; case '컵': return p.v * 200;
    case '쪽': return p.v * 5; default: return 0;
  }
}
function refMonth(r) { return Math.min(Math.max(30, r.m[0]), r.m[1]); }
const refPortion = r => stageOf(refMonth(r)).portion;
const kidPortion = k => stageOf(monthsOld(k.birth)).portion;

/* 조리 계획: 누가 얼마나 먹고, 어디서 덜어내는지 */
function makePlan(r, kidList, adults) {
  const kl = kidList.slice().sort((a, b) => monthsOld(a.birth) - monthsOld(b.birth));
  const ref = refPortion(r);
  const eat = kl.map(k => ({ k, m: monthsOld(k.birth), lv: seasonLevel(monthsOld(k.birth)), p: kidPortion(k) }));
  const kidsP = eat.length ? eat.reduce((s, e) => s + e.p, 0) : ref;
  const adultP = adults * ADULT_P;
  const totalP = kidsP + adultP;
  const F = totalP / ref;
  const topLv = eat.length ? Math.max(...eat.map(e => e.lv)) : 2;
  const tiers = [];
  for (const e of eat) { let t = tiers.find(t => t.lv === e.lv); if (!t) tiers.push(t = { lv: e.lv, kids: [], p: 0 }); t.kids.push(e); t.p += e.p; }
  const lower = r.s.length ? tiers.filter(t => t.lv < topLv) : [];
  const top = tiers.find(t => t.lv === topLv) || { lv: 2, kids: [], p: kidsP };
  const remainP = totalP - lower.reduce((s, t) => s + t.p, 0);
  return { kl, eat, ref, F, totalP, kidsP, adultP, adults, topLv, tiers, lower, top, remainP };
}
function seasonAmt(it, portion, lv, ref) {
  const name = it.i || it.g;
  const mult = SALTY.has(name) ? LEVEL_MULT[lv] / LEVEL_MULT[2] : 1;
  if (!mult) return null;
  return scaleAmt(it.a, portion / ref * mult);
}
function seasonBlockedFor(it, tierKids) {
  const ing = ING[it.i]; if (!ing || !tierKids.length) return null;
  const minM = Math.min(...tierKids.map(e => e.m));
  if (ing.m > minM) return `${ing.m}개월부터`;
  const al = ing.a.find(a => tierKids.some(e => (e.k.allergies || []).includes(a)));
  return al ? `${al} 알레르기` : null;
}
function estYield(r, F, ctx) {
  let g = 0;
  const water = ['밥죽', '국', '간식'].includes(r.c) ? 0.8 : 0.15;
  for (const it of [...r.r, ...r.o.filter(it => resolveItem(it, ctx).have)]) {
    const n = it.i || DATA.ingredients.groups[it.g][0];
    g += amtGrams(n, it.a) * (n === '물' ? water : 1);
  }
  return g * F;
}
function portionHint(g, cat) {
  if (g <= 0) return '';
  if (cat === '국' && g > 120) return `국자로 약 ${fmtFrac(g / 80)}국자`;
  if (g <= 300) return `밥숟가락 약 ${Math.max(1, Math.round(g / 15))}술`;
  return `약 ${Math.round(g / 10) * 10}g`;
}

/* 조리 단계 문장 렌더링: {재료} → 재료 + 분량, 조사 자동 보정 */
function josa(after, unit) {
  const b = UNIT_BATCHIM[unit] ?? '';
  const has = !!b, rieul = b === 'ㄹ';
  return after.replace(/^(으로|로|을|를|은|는|과|와|이(?=[\s,.)]|$)|가(?=[\s,.)]|$))/, m => {
    if (m === '으로' || m === '로') return has && !rieul ? '으로' : '로';
    if (m === '을' || m === '를') return has ? '을' : '를';
    if (m === '은' || m === '는') return has ? '은' : '는';
    if (m === '과' || m === '와') return has ? '과' : '와';
    if (m === '이' || m === '가') return has ? '이' : '가';
    return m;
  });
}
function renderText(text, lookup) {
  const parts = text.split(/(\{[^}]+\})/);
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const m = p.match(/^\{([^}]+)\}$/);
    if (!m) { out += esc(p); continue; }
    const info = lookup(m[1]);
    if (!info) { out += esc(m[1]); continue; }
    const unit = (String(info.amt).match(/[^\d⅛¼⅓½⅔¾.\/]+$/) || [''])[0];
    out += info.skip
      ? `<span class="ph off">${esc(info.name)}</span><span class="tiny muted">(${esc(info.skip)})</span>`
      : `<b class="ph">${esc(info.name)} ${esc(info.amt)}</b>${info.opt ? '<span class="tiny muted">(있으면)</span>' : ''}`;
    if (i + 1 < parts.length) parts[i + 1] = josa(parts[i + 1], info.skip ? '' : unit);
  }
  return out;
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
  return `<span class="badge sync ${s === 'ok' ? 'ok' : s === 'offline' ? 'warn' : ''}">${t}</span>`;
}
const chip = (label, on, act, data = '', cls = '') => `<button class="chip ${on ? 'on' : ''} ${cls}" data-act="${act}" ${data}>${label}</button>`;
const sw = (on, act, data = '', dis = false) => `<button class="switch ${on ? 'on' : ''}" data-act="${act}" ${data} ${dis ? 'disabled' : ''} role="switch" aria-checked="${on}"><span></span></button>`;

/* ── 추천 탭 ── */
function viewRec() {
  if (!kids().length) {
    return top('오늘 뭐 먹지?') + `<div class="page"><div class="card empty"><div class="big">👶</div><b>먼저 아이를 등록해 주세요</b><p class="small">생년월일로 개월수를 계산해 먹을 수 있는 레시피만 골라 드려요.</p><button class="btn primary" data-act="kid-new">아이 등록하기</button></div></div>`;
  }
  const f = recForm(), sk = selKids(f), P = prefs();
  const fridgeN = (state.fridge || []).length;
  const soups = (state.fridge || []).filter(n => ING[n]?.k === 'soup');
  const youngest = sk.length ? Math.min(...sk.map(k => monthsOld(k.birth))) : 999;
  let h = top('오늘 뭐 먹지?', `냉장고 재료 ${fridgeN}개 · 레시피 ${RECIPES.length}개`) + '<div class="page">';
  h += `<div class="card"><span class="label">누가 먹나요?</span><div class="chips">${kids().map(k => chip(`${kidIcon(k)} ${esc(k.name)} <span class="tiny">${ageLabel(monthsOld(k.birth))}</span>`, f.kidIds.includes(k.id), 'rec-kid', `data-id="${k.id}"`)).join('')}</div>`;
  const ca = canAdult(f);
  h += `<div class="optrow ${ca ? '' : 'dis'}"><div class="grow"><b>🍳 어른 식사 함께</b><div class="tiny muted">${ca ? '아이 몫을 덜어낸 뒤 어른 입맛으로 마무리하는 단계를 보여드려요' : '돌 전 이유식 시기에는 쓸 수 없어요'}</div></div>${sw(ca && P.adult, 'adult-toggle', '', !ca)}</div>`;
  if (ca && P.adult) h += `<div class="seg sm" style="margin-top:8px">${[1, 2, 3, 4].map(n => `<button class="${P.adults === n ? 'on' : ''}" data-act="adult-n" data-v="${n}">어른 ${n}명</button>`).join('')}</div>`;
  h += `<span class="label">언제 먹나요?</span><div class="seg">${MEALS.map(m => `<button class="${f.meal === m ? 'on' : ''}" data-act="rec-meal" data-v="${m}">${m}</button>`).join('')}</div>`;
  if (soups.length && f.meal !== '간식') {
    h += `<div class="optrow"><div class="grow"><b>🥣 냉동 국 사용</b><div class="tiny muted">${f.soup ? '국 메뉴는 추천하지 않고 냉동 국을 곁들여요' : '얼려둔 국이 있으면 국 대신 써요'}</div></div>${sw(!!f.soup, 'soup-toggle')}</div>`;
    if (f.soup) h += `<div class="chips" style="margin-top:8px">${soups.map(n => { const blk = ING[n].m > youngest; return chip(`${esc(n.replace(/^냉동 /, ''))}${blk ? ` <span class="tiny">(${ING[n].m}개월~)</span>` : ''}`, f.soup === n, 'soup-pick', `data-n="${esc(n)}"`, blk ? 'warnchip' : ''); }).join('')}</div>`;
  }
  h += `<span class="label">만들고 싶은 메뉴 <span class="tiny">(골라주신 메뉴로 한 끼 조합을 짜 드려요)</span></span><div class="chips">${CATS.map(c => { const off = f.soup && c === '국'; return chip(`${CAT_INFO[c].ic} ${CAT_INFO[c].label}${off ? ' <span class="tiny">(냉동 국)</span>' : ''}`, f.cats.includes(c) && !off, 'rec-cat', `data-v="${c}" ${off ? 'disabled' : ''}`, off ? 'disabled' : ''); }).join('')}</div>`;
  h += `<details ${ui.recOpts ? 'open' : ''} data-act="rec-opts"><summary class="label" style="margin-top:14px">⚙️ 조건 더보기 · ${f.maxTime ? f.maxTime + '분 이내' : '시간 무관'} · 부족 재료 ${f.allowMissing}개까지</summary>`;
  h += `<span class="label">조리 시간</span><div class="seg">${[[0, '무관'], [15, '15분'], [30, '30분'], [60, '1시간']].map(([v, l]) => `<button class="${f.maxTime === v ? 'on' : ''}" data-act="rec-time" data-v="${v}">${l}</button>`).join('')}</div>`;
  h += `<span class="label">부족한 재료 허용</span><div class="seg">${[0, 1, 2].map(v => `<button class="${f.allowMissing === v ? 'on' : ''}" data-act="rec-miss" data-v="${v}">${v === 0 ? '있는 재료만' : v + '개까지'}</button>`).join('')}</div>`;
  h += `<p class="tiny muted" style="margin:8px 0 0">조리도구(${(state.tools || []).length}종)와 상비 재료는 더보기 › 조리도구·상비재료에서 바꿀 수 있어요.</p></details>`;
  const noCats = !effCats(f).length && !f.soup;
  h += `<div class="sp"></div><button class="btn primary block" data-act="rec-go" ${noCats || !sk.length ? 'disabled' : ''}>🍳 한 끼 추천받기</button>`;
  if (!fridgeN) h += `<p class="tiny muted" style="text-align:center;margin:8px 0 0">냉장고가 비어 있어요. <a href="#" data-act="tab" data-tab="fridge">냉장고 재료를 먼저 넣어 주세요 ›</a></p>`;
  h += `</div>`;
  if (sk.length > 1 && new Set(sk.map(k => seasonLevel(monthsOld(k.birth)))).size > 1) h += `<div class="notice">👨‍👧‍👦 나이가 다른 아이가 함께 먹어요. 레시피에 <b>간하기 전 어린 아이 몫 덜어내기</b> 단계를 넣어 드릴게요.</div>`;
  h += `<div id="rec-results">${viewRecResults()}</div></div>`;
  return h;
}
function dishRow(d, ci, di) {
  const r = d.r, miss = d.missing.map(m => m.label);
  let h = `<div class="dish"><button class="dish-main" data-act="open" data-id="${r.id}"><span class="cat">${CAT_INFO[r.c].ic}</span><span class="grow"><span class="name">${esc(r.n)}</span>${(state.favorites || []).includes(r.id) ? ' ❤️' : ''}<div class="sum">💡 ${esc(r.sum)}</div><div class="meta">`;
  h += `<span class="badge">${CAT_INFO[r.c].label} · ${r.t}분</span>`;
  h += miss.length ? `<span class="badge bad">부족: ${esc(miss.join(', '))}</span>` : `<span class="badge ok">재료 다 있어요</span>`;
  if (d.fridgeUsed.length) h += `<span class="badge brand">🧊 ${d.fridgeUsed.length}개 사용</span>`;
  if (d.adapt) h += `<span class="badge warn">어린 아이 몫 덜어내기</span>`;
  if (d.newIngs.length) h += `<span class="badge warn">🆕 ${esc(d.newIngs.slice(0, 2).join(', '))}</span>`;
  if (d.lastDays != null && d.lastDays <= 7) h += `<span class="badge">${d.lastDays === 0 ? '오늘' : d.lastDays + '일 전'} 먹음</span>`;
  h += `</div></span></button><div class="dish-acts"><button class="iconbtn" data-act="swap" data-ci="${ci}" data-di="${di}" aria-label="이 메뉴만 바꾸기">🔄<span>바꾸기</span></button><button class="iconbtn" data-act="skip" data-ci="${ci}" data-di="${di}" aria-label="오늘은 빼기">👎<span>오늘 빼기</span></button></div></div>`;
  return h;
}
function viewRecResults() {
  const R = ui.R;
  if (!R) return '';
  const f = R.f;
  let h = '';
  if (R.emptyCats.length) {
    const baby = R.youngest < 12;
    h += `<div class="notice">${R.emptyCats.map(c => CAT_INFO[c].label).join(', ')}: 조건에 맞는 레시피가 없어요.${baby && R.emptyCats.some(c => c !== '밥죽') ? ' 이유식 시기에는 죽·진밥 한 그릇이 한 끼예요.' : f.allowMissing < 2 ? ' 부족 재료 허용을 늘려 보세요.' : ''}</div>`;
  }
  if (R.notice) h += `<div class="notice">🔁 ${esc(R.notice)}${f.allowMissing < 2 ? ` <button class="btn sm" data-act="rec-miss-more">부족 재료 ${f.allowMissing + 1}개까지 허용</button>` : ''}</div>`;
  if (!R.combos.length) {
    return h + `<div class="card empty"><div class="big">🤔</div><b>지금 재료로 만들 수 있는 조합이 없어요</b><p class="small">부족한 재료를 허용하거나, 메뉴 종류를 줄여 보세요.</p>${f.allowMissing < 2 ? `<button class="btn primary" data-act="rec-miss-more">부족 재료 ${f.allowMissing + 1}개까지 허용하고 다시 보기</button>` : ''}</div>`;
  }
  R.combos.forEach((c, ci) => {
    const label = ci === 0 && R.round === 1 ? '🏆 베스트 조합' : `추천 조합 ${ci + 1}`;
    h += `<div class="combo"><div class="combo-h">${label}<span class="grow"></span>${R.adult ? `<span class="tiny">🍳 어른 ${prefs().adults}명 포함 · </span>` : ''}<span class="tiny">⏱ 약 ${c.time + (R.adult ? 3 : 0)}분</span></div>`;
    c.dishes.forEach((d, di) => { h += dishRow(d, ci, di); });
    if (c.soup) h += `<div class="dish soup"><span class="cat">🥣</span><span class="grow"><span class="name">${esc(c.soup)}</span><div class="sum">❄️ 냉장실에서 해동한 뒤 냄비에 팔팔 끓여 한 김 식혀 주세요${R.adult ? ' · 어른 몫은 국간장 ½작은술을 더해요' : ''}</div></span></div>`;
    const noRice = !f.cats.includes('밥죽') && f.meal !== '간식' && !c.dishes.some(d => d.r.c === '밥죽');
    h += `<div class="combo-f">${c.nut.filter(n => ['탄수화물', '단백질', '채소', '칼슘', '과일'].includes(n)).map(n => `<span class="badge ok">✓ ${n}</span>`).join(' ')}${noRice ? '<span class="badge">🍚 밥은 따로 곁들여요</span>' : ''}<span class="grow"></span>`;
    if (c.missing.length) h += `<button class="btn sm" data-act="combo-shop" data-i="${ci}">🛒 부족 재료 담기</button>`;
    h += `<button class="btn sm primary" data-act="combo-eat" data-i="${ci}">이걸로 할게요</button></div></div>`;
  });
  h += `<button class="btn block" data-act="rec-reroll">🎲 다른 조합 보기</button>`;
  return h;
}

/* ── 냉장고 탭 ── */
function viewFridge() {
  const fridge = state.fridge || [];
  const staples = (state.staples || []).filter(n => ING[n]?.k !== 'hidden');
  let h = top('냉장고', `재료 ${fridge.length}개 · 상비 재료 ${staples.length}개`) + '<div class="page">';
  h += `<div class="search"><input id="fridge-q" type="search" placeholder="재료 검색 (예: 호박, ㅇㅎㅂ, 미역국)" value="${esc(ui.fridgeQ)}" autocomplete="off"></div>`;
  h += `<div class="hscroll" style="margin-top:10px">${['전체', ...ING_CATS].map(c => chip(c === '전체' ? '전체' : `${ING_IC[c]} ${c}`, ui.fridgeCat === c, 'fridge-cat', `data-v="${c}"`)).join('')}</div>`;
  h += `<div id="fridge-list">${viewFridgeList()}</div>`;
  h += `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🧊 지금 냉장고에 있는 재료</h2>${fridge.length ? '<button class="btn sm danger" data-act="fridge-clear">비우기</button>' : ''}</div><div class="sp"></div>`;
  if (!fridge.length) h += `<p class="small muted">위에서 재료를 검색하거나 카테고리에서 골라 담아 주세요.</p>`;
  else {
    const byCat = {};
    for (const n of fridge) { const c = ING[n]?.c || '가공·기타'; (byCat[c] = byCat[c] || []).push(n); }
    for (const c of ING_CATS) if (byCat[c]) h += `<div class="cat-h">${ING_IC[c]} ${c}</div><div class="chips">${byCat[c].map(n => `<button class="chip soft" data-act="fridge-toggle" data-n="${esc(n)}">${esc(n)} <span class="x">✕</span></button>`).join('')}</div>`;
  }
  h += `</div><div class="card"><h2>⭐ 상비 재료 <span class="tiny muted">(항상 있는 걸로 계산해요)</span></h2><div class="chips">${staples.map(n => `<span class="chip">${esc(n)}</span>`).join('')}</div><button class="btn sm" data-act="pick-staples">상비 재료 편집</button></div>`;
  return h + '</div>';
}
function viewFridgeList() {
  const showAll = ui.fridgeQ || ui.fridgeCat !== '전체';
  if (!showAll) return `<p class="tiny muted" style="margin:6px 2px">검색하거나 카테고리를 누르면 재료 목록이 나와요. 재료를 누르면 냉장고에 담겨요. 얼려둔 국과 냉동 재료는 ❄️ 냉동식품에 있어요.</p>`;
  const list = searchIng(ui.fridgeQ, ui.fridgeCat);
  const fridge = new Set(state.fridge || []), staples = new Set(state.staples || []);
  if (!list.length) return `<div class="notice">"${esc(ui.fridgeQ)}"에 맞는 재료가 없어요.</div>`;
  return `<div class="list">${list.slice(0, 80).map(i => {
    const st = staples.has(i.n), on = fridge.has(i.n) || st;
    const sub = i.sub ? `<div class="d">↪ ${esc(i.sub.join(', '))} 대신 쓸 수 있어요</div>` : i.k === 'soup' ? `<div class="d">🥣 냉동 국 · 추천에서 국 대신 사용</div>` : i.s.length ? `<div class="d">${esc(i.s.slice(0, 4).join(', '))}</div>` : '';
    return `<div class="li"><button class="row grow" data-act="fridge-toggle" data-n="${esc(i.n)}" style="text-align:left"><span class="check ${on ? 'on' : ''}">✓</span><span class="grow"><span class="t">${esc(i.n)}</span> <span class="tiny muted">${i.k === 'adult' ? '어른용' : i.m <= 6 ? '' : i.m + '개월~'}</span>${i.a.length ? ` <span class="badge warn">${esc(i.a.join('·'))}</span>` : ''}${sub}</span></button><button class="star-btn ${st ? 'on' : ''}" data-act="staple-toggle" data-n="${esc(i.n)}" aria-label="상비 재료">⭐</button></div>`;
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
    return `<button class="li" data-act="open" data-id="${r.id}"><span style="font-size:24px">${CAT_INFO[r.c].ic}</span><span class="grow"><span class="t">${esc(r.n)}</span>${(state.favorites || []).includes(r.id) ? ' ❤️' : ''}<div class="d">${r.m[0]}개월~ · ${r.t}분 · 재료 ${hv}/${e.req.length}${adultOK(r) ? ' · 🍳 어른 함께' : ''}</div></span>${e.missing.length ? '' : '<span class="badge ok">가능</span>'}<span class="chev">›</span></button>`;
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
  const list = searchIng(ui.guideQ, '전체', { noAdult: true, noSoup: true }).filter(i => i.c !== '냉동식품');
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
    ${li('settings', '🍳', '조리도구 · 상비재료', `도구 ${(state.tools || []).length}종 · 상비 ${(state.staples || []).filter(n => ING[n]?.k !== 'hidden').length}개`)}
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
    h += `<div class="card" style="margin:6px 0;padding:12px 14px"><div class="row"><span class="badge brand">${esc(e.meal)}</span>${e.adults ? `<span class="badge">🍳 어른 ${e.adults}명</span>` : ''}<span class="tiny muted grow">${(e.kids || []).map(id => esc(kidById(id)?.name || '')).filter(Boolean).join(', ')}</span><button class="close" data-act="hist-rm" data-id="${e.id}">✕</button></div><div class="chips" style="margin-top:8px">${e.rids.map(id => RECIPE_BY_ID[id] ? `<button class="chip" data-act="open" data-id="${id}">${CAT_INFO[RECIPE_BY_ID[id].c].ic} ${esc(RECIPE_BY_ID[id].n)}</button>` : '').join('')}${e.soup ? `<span class="chip">🥣 ${esc(e.soup)}</span>` : ''}</div></div>`;
  }
  return h + '</div>';
}
function viewSettings() {
  let h = top('조리도구 · 상비재료', '', 'more-back') + '<div class="page">';
  h += `<div class="card"><h2>🍳 우리 집 조리도구</h2><p class="tiny muted" style="margin-top:-6px">없는 도구만 쓰는 레시피는 추천에서 빠져요.</p><div class="chips">${TOOLS.map(t => chip(t, (state.tools || []).includes(t), 'tool-toggle', `data-v="${t}"`)).join('')}</div></div>`;
  h += `<div class="card"><h2>⭐ 상비 재료</h2><p class="tiny muted" style="margin-top:-6px">항상 집에 있는 재료예요. 냉장고에 따로 넣지 않아도 있는 걸로 계산해요.</p><div class="chips">${(state.staples || []).filter(n => ING[n]?.k !== 'hidden').map(n => `<button class="chip soft" data-act="staple-toggle" data-n="${esc(n)}">${esc(n)} <span class="x">✕</span></button>`).join('')}</div><button class="btn sm" data-act="pick-staples">+ 상비 재료 추가</button></div>`;
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
  h += `<div class="card"><h2>☁️ 동기화</h2><p class="small">${syncBadge()} ${Sync.lastSync ? '마지막 동기화 ' + new Date(Sync.lastSync).toLocaleTimeString('ko-KR') : ''}</p><p class="tiny muted">아이 정보, 냉장고, 상비재료, 조리도구, 즐겨찾기, 식단 기록, 장보기 목록, 어른 식사 설정이 실시간으로 공유돼요. 인터넷이 끊겨도 쓸 수 있고, 다시 연결되면 자동으로 맞춰져요.</p><button class="btn sm" data-act="sync-now">지금 동기화</button></div>`;
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
  const kl = detailKids(), P = prefs();
  const canA = adultOK(r) && kl.some(k => monthsOld(k.birth) >= 12);
  const adults = canA && P.adult ? P.adults : 0;
  const spicy = !!(adults && P.spicy && (r.ad.si || []).length);
  const ctx = makeCtx(kl, { strict: false, allowMissing: 99, adult: !!adults });
  const e = evalRecipe(r, ctx);
  const plan = makePlan(r, kl, adults);
  const fav = (state.favorites || []).includes(r.id), rating = (state.ratings || {})[r.id] || 0;
  let h = `<div class="summary"><span>💡</span><span>${esc(r.sum)}</span></div>`;
  h += `<div class="row wrap small muted"><span class="badge">${CAT_INFO[r.c].label}</span><span class="badge">⏱ ${r.t}분${adults ? ' +3분' : ''}</span><span class="badge">${r.m[0]}개월 ~ ${r.m[1] >= 144 ? '12세' : r.m[1] >= 24 ? ageLabel(r.m[1]) : r.m[1] + '개월'}</span>${r.tl.length ? `<span class="badge">🍳 ${esc(r.tl.join('·'))}</span>` : ''}<span class="badge">${r.ml.join('·')}</span></div>`;
  if (canA) {
    h += `<div class="card toggles"><div class="optrow"><div class="grow"><b>🍳 어른 식사 함께</b><div class="tiny muted">아이 몫을 덜고 어른 입맛으로 마무리해요</div></div>${sw(!!adults, 'adult-toggle')}</div>`;
    if (adults) {
      h += `<div class="seg sm" style="margin-top:8px">${[1, 2, 3, 4].map(n => `<button class="${P.adults === n ? 'on' : ''}" data-act="adult-n" data-v="${n}">어른 ${n}명</button>`).join('')}</div>`;
      if ((r.ad.si || []).length) h += `<div class="optrow" style="margin-top:10px"><div class="grow"><b>🌶️ 매운맛 추가</b><div class="tiny muted">어른 몫에만 매운 재료를 더해요</div></div>${sw(spicy, 'spicy-toggle')}</div>`;
    }
    h += `</div>`;
  }
  const warns = [];
  if (kl.length && r.m[0] > ctx.youngest) warns.push(kl.length > 1 && ctx.youngest >= 9 ? `<b>${esc(kl[0].name)}</b>에게는 조금 이른 메뉴예요 (${r.m[0]}개월~). 간하기 전에 덜어서 더 잘게 다지고 부드럽게 익혀 주세요.` : `<b>${esc(kl[0].name)}</b>에게는 아직 이른 메뉴예요 (${r.m[0]}개월부터).`);
  for (const x of [...e.req, ...e.opt]) if (!x.ok && x.why) warns.push(`<b>${esc(x.label)}</b>: ${esc(x.why)} → ${e.req.includes(x) ? '이 재료가 필수라 만들기 어려워요' : '빼고 만드세요'}`);
  const usedW = new Set();
  for (const x of [...e.req, ...e.opt]) { const ing = x.use; if (ing && ing.w && !usedW.has(ing.n) && (/질식|금지|알레르기/.test(ing.w) || (ing.m + 12 > ctx.youngest && /주의|위험|확인|소량|나트륨|껍질|가시|제거|잘게|작게|질겨|질김|으깨|갈아|익혀|진밥|데쳐/.test(ing.w)))) { usedW.add(ing.n); warns.push(`<b>${esc(ing.n)}</b>: ${esc(ing.w)}`); } }
  if (e.newIngs.length) warns.push(`🆕 처음 먹는 재료: <b>${esc(e.newIngs.join(', '))}</b> — 오전에 소량으로 주고 반응을 지켜보세요.`);
  if (warns.length) h += `<div class="warnbox">⚠️ 주의<br>${warns.map(w => '· ' + w).join('<br>')}</div>`;
  const who = [...plan.eat.map(x => `${esc(x.k.name)}(${ageLabel(x.m)})`), adults ? `어른 ${adults}명` : ''].filter(Boolean).join(', ');
  if (who) h += `<p class="small" style="margin:12px 0 4px"><b>👨‍👧 ${who}</b> 기준 · 기본 분량의 <b>${plan.F.toFixed(1)}배</b></p>`;
  const ingRow = (x, kind, amt) => {
    const name = x.group ? `${esc(x.label)} <span class="tiny muted">(${esc((x.have ? [x.have.n] : x.alts.slice(0, 3)).join('/'))})</span>` : esc(x.label);
    const st = !x.ok ? `<span class="badge bad">${esc(x.why || '불가')}</span>` : x.have ? '<span class="ok-dot">✓</span>' : kind === 'r' ? '<span class="miss-dot">✕</span>' : '<span class="tiny muted">없음</span>';
    const subNote = x.sub ? ` <span class="badge brand">❄️ ${esc(x.sub)}로 대체</span>` : '';
    return `<div class="ing-row">${st}<span class="grow" style="${!x.ok ? 'text-decoration:line-through;opacity:.6' : ''}">${name}${subNote}</span><span class="amt">${amt}</span></div>`;
  };
  h += `<div class="card"><h2>재료</h2>${e.req.map(x => ingRow(x, 'r', scaleAmt(x.item.a, plan.F))).join('')}`;
  if (e.missing.length) h += `<div class="sp"></div><button class="btn sm" data-act="detail-shop">🛒 부족한 ${e.missing.length}개 장보기에 담기</button>`;
  if (e.opt.length) h += `<h3>있으면 좋아요 (선택)</h3>${e.opt.map(x => ingRow(x, 'o', scaleAmt(x.item.a, plan.F))).join('')}`;
  if (r.s.length) {
    const allLv0 = plan.eat.length && plan.topLv === 0 && !adults;
    h += `<h3>양념 ${allLv0 ? '<span class="badge warn">돌 전이라 넣지 않아요</span>' : plan.lower.length ? '<span class="badge warn">어린 아이 몫은 덜어낸 뒤 따로</span>' : ''}</h3>`;
    h += e.sea.map((x, i) => {
      const it = r.s[i];
      const blk = seasonBlockedFor(it, plan.top.kids);
      const a = blk ? '' : seasonAmt(it, plan.remainP, plan.topLv, plan.ref);
      return ingRow({ ...x, ok: !blk, why: blk || x.why }, 's', a || (blk ? '' : '안 넣어요'));
    }).join('');
  }
  if (adults) {
    const adI = (r.ad.i || []).map(it => resolveItem(it, ctx, true));
    const sI = spicy ? r.ad.si.map(it => resolveItem(it, ctx, true)) : [];
    if (adI.length) h += `<h3>🍳 어른 마무리 재료 <span class="tiny muted">(어른 ${adults}명)</span></h3>${adI.map(x => ingRow(x, 'a', scaleAmt(x.item.a, adults))).join('')}`;
    if (sI.length) h += `<h3>🌶️ 매운맛 재료</h3>${sI.map(x => ingRow(x, 'a', scaleAmt(x.item.a, adults))).join('')}`;
    const adMiss = [...adI, ...sI].filter(x => !x.have);
    if (adMiss.length) h += `<div class="sp"></div><button class="btn sm" data-act="detail-shop-adult">🛒 어른용 부족 ${adMiss.length}개 담기</button>`;
  }
  h += `</div>`;
  if (kl.length) {
    h += `<details class="card" ${kl.length > 1 || plan.eat.some(x => x.m < 15) ? 'open' : ''}><summary>🧒 아이별 질감 · 양</summary><div class="sp"></div>`;
    plan.eat.forEach(x => {
      const st = stageOf(x.m), share = x.p / plan.ref;
      let extra = '';
      if (x.m < 12 && ['메인', '반찬'].includes(r.c)) extra = ' 잘게 다져서 죽이나 진밥에 섞어 주세요.';
      if (x.m < 9 && !['밥죽', '간식'].includes(r.c)) extra = ' 아직은 죽 형태가 좋아요. 재료만 곱게 갈아 죽에 넣어 주세요.';
      if (x.m >= 36 && r.m[1] < 24) extra = ' 큰 아이에게는 양을 늘리고 일반 밥으로 주세요.';
      h += `<div class="kidadj"><b>${kidIcon(x.k)} ${esc(x.k.name)}</b> <span class="tiny muted">${ageLabel(x.m)} · ${st.label}</span><br>질감: ${st.texture} · 크기: ${st.size}<br>간: ${st.season} · 양: 기본의 약 ${fmtFrac(share)}배${extra}</div>`;
    });
    h += `</details>`;
  }
  h += viewSteps(r, e, plan, ctx, adults, spicy);
  h += `<div class="card"><div class="row"><button class="btn ${fav ? 'primary' : ''} grow" data-act="fav" data-id="${r.id}">${fav ? '❤️ 즐겨찾기됨' : '🤍 즐겨찾기'}</button><button class="btn primary grow" data-act="detail-eat">🍽 오늘 먹었어요</button></div><div class="row" style="justify-content:center;margin-top:10px"><span class="small muted">아이 반응</span>${[1, 2, 3, 4, 5].map(n => `<button class="star-btn ${n <= rating ? 'on' : ''}" data-act="rate" data-n="${n}">⭐</button>`).join('')}</div></div>`;
  return h;
}
function viewSteps(r, e, plan, ctx, adults, spicy) {
  const byLabel = {};
  r.r.forEach(it => byLabel[it.i || it.g] = { it, kind: 'r' });
  r.o.forEach((it, i) => byLabel[it.i || it.g] = { it, kind: 'o', ev: e.opt[i] });
  r.s.forEach(it => byLabel[it.i || it.g] = { it, kind: 's' });
  const adLabel = {};
  if (adults) [...(r.ad.i || []), ...(spicy ? r.ad.si : [])].forEach(it => adLabel[it.i || it.g] = it);
  const topBlk = it => seasonBlockedFor(it, plan.top.kids);
  const mainLookup = label => {
    const b = byLabel[label]; if (!b) return null;
    if (b.kind === 's') {
      const blk = topBlk(b.it);
      if (blk) return { name: label, amt: '', skip: `아이 몫엔 빼요 · ${blk}` };
      const a = seasonAmt(b.it, plan.remainP, plan.topLv, plan.ref);
      return a ? { name: label, amt: a } : { name: label, amt: '', skip: '돌 전이라 안 넣어요' };
    }
    const o = b.kind === 'o' ? b.ev : null;
    if (o && !o.ok) return { name: label, amt: scaleAmt(b.it.a, plan.F), skip: `빼요 · ${o.why}` };
    return { name: label, amt: scaleAmt(b.it.a, plan.F), opt: b.kind === 'o' && !(o && o.have) };
  };
  const adultLookup = label => adLabel[label] ? { name: label, amt: scaleAmt(adLabel[label].a, adults) } : mainLookup(label);
  const yieldG = estYield(r, plan.F, ctx);
  const stepLi = (s, lookup, cls = '') => `<li class="${cls}"><span class="t"><span class="sic">${stepIcon(s.x)}</span>${renderText(s.x, lookup)}</span>${s.k ? `<div class="cue">👀 ${renderText(s.k, lookup)}</div>` : ''}</li>`;
  const tierSplit = t => {
    const pct = Math.round(100 * t.p / plan.totalP);
    const hint = portionHint(yieldG * t.p / plan.totalP, r.c);
    const names = t.kids.map(x => esc(x.k.name)).join(', ');
    let body = `<b>${names} 몫 먼저 덜기</b> — 간하기 전에 전체의 약 ${pct}%${hint ? ` (${hint})` : ''}를 그릇에 덜어 두세요.`;
    if (t.lv === 0) body += ' 덜어낸 몫은 <b>간 없이</b> 그대로 줘요.';
    else {
      const items = r.s.map(it => {
        if (seasonBlockedFor(it, t.kids)) return null;
        const a = seasonAmt(it, t.p, t.lv, plan.ref); return a ? `${esc(it.i || it.g)} <b>${a}</b>` : null;
      }).filter(Boolean);
      body += items.length ? ` 덜어낸 몫에는 ${items.join(', ')}만 넣어 섞어요 (국물 요리는 작은 냄비에 덜어 한소끔 끓여요).` : ' 덜어낸 몫은 간 없이 줘요.';
    }
    const mm = Math.min(...t.kids.map(x => x.m));
    if (stageIdx(mm) < stageIdx(Math.max(...plan.eat.map(x => x.m)))) { const st = stageOf(mm); body += ` <span class="tiny">질감은 ${st.size} 크기, ${st.texture}로 맞춰요.</span>`; }
    return `<li class="split">${body}</li>`;
  };
  let lis = '', splitDone = false;
  const firstAt = r.st.findIndex(s => s.a);
  const allLv0 = plan.eat.length && plan.topLv === 0 && !adults;
  const remainNames = [...plan.top.kids.map(x => esc(x.k.name)), adults ? '어른' : ''].filter(Boolean).join('·');
  r.st.forEach((s, i) => {
    if (i === firstAt && plan.lower.length && !splitDone) { lis += plan.lower.map(tierSplit).join(''); splitDone = true; }
    if (s.a && allLv0) lis += `<li class="skip"><span class="t"><span class="sic">🧂</span>${renderText(s.x, mainLookup)}</span><div class="tiny">돌 전에는 이 단계(간하기)를 건너뛰어요.</div></li>`;
    else {
      let li = stepLi(s, mainLookup, s.a ? 'season' : '');
      if (s.a && plan.lower.length) li = li.replace('</span><div class="cue">', ` <span class="tiny muted">(남은 ${remainNames} 몫에)</span></span><div class="cue">`);
      lis += li;
    }
  });
  let h = `<div class="card"><h2>만드는 법</h2><ol class="steps">${lis}</ol>`;
  if (adults) {
    const kidsTopP = plan.top.kids.reduce((s, x) => s + x.p, 0);
    const pct = Math.round(100 * kidsTopP / plan.totalP);
    const hint = portionHint(yieldG * kidsTopP / plan.totalP, r.c);
    const names = plan.top.kids.map(x => esc(x.k.name)).join(', ') || '아이';
    let al = `<li class="split"><b>${names} 몫 덜기</b> — 전체의 약 ${pct}%${hint ? ` (${hint})` : ''}를 아이 그릇에 덜어요. 남은 것이 어른 ${adults}명 몫이에요.</li>`;
    const blocked = r.s.filter(it => topBlk(it));
    if (blocked.length) al += `<li><span class="t"><span class="sic">🧂</span>아이 몫에서 뺐던 ${blocked.map(it => `<b class="ph">${esc(it.i)} ${seasonAmt(it, plan.adultP, 2, plan.ref)}</b>`).join(', ')}를 어른 몫에 넣어요</span></li>`;
    al += (r.ad.st || []).map(s => stepLi(s, adultLookup)).join('');
    if (!(r.ad.st || []).length && !blocked.length) al += `<li><span class="t"><span class="sic">🍽️</span>어른도 같은 음식을 그대로 함께 먹어요</span></li>`;
    if (spicy) al += (r.ad.ss || []).map(s => stepLi(s, adultLookup, 'spicy')).join('');
    h += `<div class="adult-h">🍳 어른 마무리 <span class="tiny">어른 ${adults}명${spicy ? ' · 🌶️ 매운맛' : ''}</span></div><ol class="steps adult">${al}</ol>`;
  }
  return h + `</div>`;
}
function viewPicker() {
  const p = ui.picker;
  let h = `<div style="position:sticky;top:0;background:var(--bg);padding:12px 0 6px;z-index:2"><div class="search"><input id="picker-q" type="search" placeholder="재료 검색 (예: 호박, ㄷㄱ)" value="${esc(p.q || '')}" autocomplete="off"></div>`;
  h += `<div class="chips" style="margin-top:8px">${[...p.sel].map(n => `<button class="chip on" data-act="picker-toggle" data-n="${esc(n)}">${esc(n)} ✕</button>`).join('') || '<span class="tiny muted">선택된 재료가 없어요</span>'}</div></div>`;
  return h + `<div id="picker-list">${viewPickerList()}</div>`;
}
function viewPickerList() {
  const p = ui.picker;
  const list = searchIng(p.q || '', '전체', { noSoup: true }).slice(0, 100);
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
  const add = [...new Set(names)].filter(n => !exist.has(n)).map(n => ({ id: uid(), name: n, done: false, from }));
  if (add.length) setKey('shopping', [...cur, ...add]);
  toast(add.length ? `장보기 목록에 ${add.length}개 담았어요` : '이미 장보기 목록에 있어요');
}
function logMeal(rids, meal, kidIds, extra = {}) {
  const entry = { id: uid(), date: todayStr(), meal, rids, kids: kidIds, ts: Date.now(), ...extra };
  const hist = [...(state.history || []), entry].slice(-400);
  const kl = kidIds.map(kidById).filter(Boolean);
  const ctx = makeCtx(kl, { strict: false, adult: !!extra.adults });
  const usedNames = new Set(), fromFridge = new Set();
  for (const id of rids) {
    const r = RECIPE_BY_ID[id]; if (!r) continue;
    const e = evalRecipe(r, ctx);
    for (const i of e.used) { usedNames.add(i.n); if (ctx.fridge.has(i.n)) fromFridge.add(ctx.subFrom[i.n] || i.n); }
    for (const x of e.adI) if (x.have && (state.fridge || []).includes(x.have.n)) fromFridge.add(x.have.n);
  }
  if (extra.soup) fromFridge.add(extra.soup);
  state.children = kids().map(k => kidIds.includes(k.id) && monthsOld(k.birth) < 24 && (k.tried || []).length ? { ...k, tried: [...new Set([...(k.tried || []), ...[...usedNames].filter(n => ING[n]?.k !== 'hidden')])] } : k);
  touch('children');
  setKey('history', hist, { render: false });
  const fridgeUsed = [...fromFridge].filter(n => (state.fridge || []).includes(n));
  if (fridgeUsed.length) {
    ui.sheet = { title: '사용한 재료를 뺄까요?', sel: new Set(fridgeUsed), items: fridgeUsed, body: () => `<p class="small muted" style="margin-top:12px">다 쓴 재료를 선택하면 냉장고에서 빼 드려요. 남은 재료는 선택을 풀어 주세요.</p><div class="list">${ui.sheet.items.map(n => `<button class="li" data-act="used-toggle" data-n="${esc(n)}"><span class="check ${ui.sheet.sel.has(n) ? 'on' : ''}">✓</span><span class="grow t">${esc(n)}</span></button>`).join('')}</div><button class="btn primary block" data-act="used-apply">선택한 재료 냉장고에서 빼기</button><div class="sp"></div><button class="btn ghost block" data-act="sheet-close">그대로 두기</button>` };
  }
  toast('식단에 기록했어요 🍽');
  render();
}
function curDetailCtx() {
  const r = RECIPE_BY_ID[ui.detail.id], kl = detailKids(), P = prefs();
  const canA = adultOK(r) && kl.some(k => monthsOld(k.birth) >= 12);
  const adults = canA && P.adult ? P.adults : 0;
  return { r, kl, adults, ctx: makeCtx(kl, { strict: false, adult: !!adults }) };
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
  'rec-kid': el => { const f = recForm(); f.kidIds = toggleIn(f.kidIds, el.dataset.id); ui.R = null; render(); },
  'rec-meal': el => { const f = recForm(); f.meal = el.dataset.v; f.cats = MEAL_DEFAULT_CATS[f.meal].slice(); if (f.meal === '간식') f.soup = null; ui.R = null; render(); },
  'rec-cat': el => { const f = recForm(); if (el.disabled) return; f.cats = toggleIn(f.cats, el.dataset.v).sort((a, b) => CATS.indexOf(a) - CATS.indexOf(b)); ui.R = null; render(); },
  'rec-time': el => { const f = recForm(); f.maxTime = +el.dataset.v; meta.recForm = { maxTime: f.maxTime, allowMissing: f.allowMissing }; saveLocal(); ui.R = null; render(); },
  'rec-miss': el => { const f = recForm(); f.allowMissing = +el.dataset.v; meta.recForm = { maxTime: f.maxTime, allowMissing: f.allowMissing }; saveLocal(); ui.R = null; render(); },
  'rec-miss-more': () => { const f = recForm(); f.allowMissing = Math.min(2, f.allowMissing + 1); meta.recForm = { maxTime: f.maxTime, allowMissing: f.allowMissing }; saveLocal(); ACTIONS['rec-go'](); },
  'adult-toggle': () => { if (!ui.detail) ui.R = null; setPrefs({ adult: !prefs().adult }); },
  'adult-n': el => { setPrefs({ adults: +el.dataset.v }); },
  'spicy-toggle': () => { setPrefs({ spicy: !prefs().spicy }); },
  'soup-toggle': () => { const f = recForm(); const soups = (state.fridge || []).filter(n => ING[n]?.k === 'soup'); f.soup = f.soup ? null : soups[0]; ui.R = null; render(); },
  'soup-pick': el => { const f = recForm(); f.soup = el.dataset.n; ui.R = null; render(); },
  'rec-go': () => {
    startRec(); render();
    setTimeout(() => $('#rec-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  },
  'rec-reroll': () => { if (!ui.R) return; nextCombos(); render(); setTimeout(() => $('#rec-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); },
  swap: el => swapDish(+el.dataset.ci, +el.dataset.di),
  skip: el => {
    const d = ui.R.combos[+el.dataset.ci].dishes[+el.dataset.di];
    const ids = skipIds(); if (!ids.includes(d.r.id)) ids.push(d.r.id); saveLocal();
    toast(`'${d.r.n}'은(는) 오늘 추천에서 뺐어요`);
    swapDish(+el.dataset.ci, +el.dataset.di, true);
  },
  'combo-shop': el => { const c = ui.R.combos[+el.dataset.i]; addShopping(c.missing, c.dishes.map(d => d.r.n).join(', ')); },
  'combo-eat': el => { const c = ui.R.combos[+el.dataset.i]; logMeal(c.dishes.map(d => d.r.id), ui.R.f.meal, ui.R.f.kidIds, { adults: ui.R.adult ? prefs().adults : 0, soup: c.soup || null }); },
  open: el => { ui.detail = { id: el.dataset.id, kidIds: ui.tab === 'rec' ? ui.rec?.kidIds : null }; ui._keepSheet = false; renderOverlays(); },
  'detail-close': () => { ui.detail = null; renderOverlays(); },
  'detail-shop': () => { const { r, ctx } = curDetailCtx(); const e = evalRecipe(r, ctx); addShopping(e.missing.map(m => m.label), r.n); },
  'detail-shop-adult': () => {
    const { r, ctx } = curDetailCtx(); const P = prefs();
    const items = [...(r.ad.i || []), ...(P.spicy ? r.ad.si || [] : [])].map(it => resolveItem(it, ctx, true)).filter(x => !x.have).map(x => x.label);
    addShopping(items, r.n + ' (어른용)');
  },
  'detail-eat': () => { const { r, kl, adults } = curDetailCtx(); const h = new Date().getHours(); const meal = ui.rec?.meal || (h < 10 ? '아침' : h < 15 ? '점심' : h < 17 ? '간식' : '저녁'); ui.detail = null; logMeal([r.id], meal, kl.map(k => k.id), { adults }); },
  fav: el => { setKey('favorites', toggleIn(state.favorites, el.dataset.id)); },
  rate: el => { const r = { ...(state.ratings || {}) }; const n = +el.dataset.n; r[ui.detail.id] = r[ui.detail.id] === n ? 0 : n; setKey('ratings', r); },
  'fridge-cat': el => { ui.fridgeCat = el.dataset.v; render(); },
  'fridge-toggle': el => { const n = el.dataset.n; if ((state.staples || []).includes(n) && !(state.fridge || []).includes(n)) return toast(`${n}은(는) 상비 재료예요 (⭐로 해제)`); setKey('fridge', toggleIn(state.fridge, n)); },
  'staple-toggle': el => { setKey('staples', toggleIn(state.staples, el.dataset.n)); },
  'fridge-clear': () => { if (confirm('냉장고 재료를 모두 비울까요? (상비 재료는 그대로예요)')) setKey('fridge', []); },
  'pick-staples': () => { ui.picker = { title: '상비 재료', sel: new Set((state.staples || []).filter(n => ING[n]?.k !== 'hidden')), target: 'staples', q: '' }; ui._keepSheet = false; render(); },
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
    const known = done.map(s => s.name).filter(n => ING[n] || DATA.ingredients.groups[n]).map(n => ING[n] ? n : DATA.ingredients.groups[n][0]);
    state.fridge = [...new Set([...(state.fridge || []), ...known])]; touch('fridge');
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
    const blob = new Blob([JSON.stringify({ app: 'kids-fridge', v: 2, at: new Date().toISOString(), state }, null, 1)], { type: 'application/json' });
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
  if (act === 'rec-opts') { ui.recOpts = !el.open; return; }
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
      for (const k of SYNC_KEYS) if (j.state[k] !== undefined) { state[k] = j.state[k]; touch(k); }
      state.prefs = Object.assign(defaultPrefs(), state.prefs || {});
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
    const { error } = await this.client.rpc('create_family', { p_name: name, p_display: me });
    if (error) return this.err(error, '가족 만들기 실패');
    meta.pending = [...SYNC_KEYS]; saveLocal();
    await this.loadFamily(); toast('가족을 만들었어요! 초대코드를 배우자에게 보내세요');
  },
  async joinFamily(code, me) {
    const { error } = await this.client.rpc('join_family', { p_code: code, p_display: me });
    if (error) return this.err(error, /not found|없/.test(error.message) ? '초대코드를 찾을 수 없어요' : '참여 실패');
    meta.pending = []; meta.stamps = {}; saveLocal();
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
    for (const k of SYNC_KEYS) {
      const rr = remote[k], local = meta.stamps[k] ? Date.parse(meta.stamps[k]) : 0;
      if (meta.pending.includes(k) && (!rr || local >= Date.parse(rr.updated_at))) continue;
      if (rr) {
        if (!local || Date.parse(rr.updated_at) > local || !meta.pending.includes(k)) {
          state[k] = rr.value;
          meta.stamps[k] = rr.updated_at; meta.pending = meta.pending.filter(x => x !== k);
        }
      } else if (!meta.pending.includes(k)) meta.pending.push(k);
    }
    if (state.staples == null && DATA) state.staples = DATA.ingredients.items.filter(i => i.st && i.k !== 'hidden').map(i => i.n);
    state.prefs = Object.assign(defaultPrefs(), state.prefs || {});
    saveLocal();
    await this.flush();
    this.status = 'ok'; this.lastSync = Date.now();
    render();
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
    const b = document.querySelector('.top .badge.sync'); if (b) b.outerHTML = syncBadge();
  },
  subscribe() {
    this.unsubscribe();
    this.channel = this.client.channel('fam-' + this.family.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_state', filter: `family_id=eq.${this.family.id}` }, payload => {
        const row = payload.new; if (!row || !row.key || !SYNC_KEYS.includes(row.key)) return;
        const local = meta.stamps[row.key] ? Date.parse(meta.stamps[row.key]) : 0;
        if (Date.parse(row.updated_at) <= local) return;
        state[row.key] = row.value; meta.stamps[row.key] = row.updated_at; meta.pending = meta.pending.filter(x => x !== row.key);
        if (row.key === 'prefs') state.prefs = Object.assign(defaultPrefs(), state.prefs || {});
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
  if (ui.tab !== 'more' || !ui.kidEdit) render();
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
