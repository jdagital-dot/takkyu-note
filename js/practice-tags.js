// 練習ノートの定数と、ノートを扱う純粋な関数。入力画面・CSV・（将来の）紙シートが共通で使う。
//
// ノートの形:
//   { id, date:'YYYY-MM-DD', minutes:number|null, items:[{kind,label,rating}], memo, source }
//   kind: 'menu'=練習内容 / 'focus'=意識すること、rating: 1〜5（未評価は null）

// アプリが最初から用意する項目（各選手が非表示にできる）
export const PRESET_ITEMS = {
  menu: [
    'フォア打ち', 'バック打ち', 'ツッツキ', 'ドライブ', 'ブロック', 'フットワーク', 'サーブ',
    'レシーブ', '3球目攻撃', '台上（ストップ・フリック）', '多球練習', 'オール', 'ゲーム練習', '体力・筋トレ',
  ],
  focus: [
    '打点', '足を動かす', '体重移動', '回転をかける', 'コースを狙う', '早く戻る',
    '低いボール', '前陣で打つ', '相手をよく見る', 'ミスを減らす', '声を出す', '集中',
  ],
};

export const KINDS = ['menu', 'focus'];
export const KIND_LABEL = { menu: '練習内容', focus: '意識すること' };

// 自分で足せる項目の上限と文字数
export const CUSTOM_LIMIT = 20;
export const LABEL_MAX = 20;

// 練習時間の選択肢。休みは 0、未記入は null
export const TIME_OPTIONS = [
  { label: '休み', minutes: 0 },
  { label: '〜1h', minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h', minutes: 120 },
  { label: '2.5h', minutes: 150 },
  { label: '3h〜', minutes: 180 },
];

// 出来栄え 1〜5
export const RATINGS = [1, 2, 3, 4, 5];
export const RATING_HINT = '1=できなかった … 5=よくできた';

// ---- 選手ごとの項目の設定 ----

// players.practice_items（{custom:{menu,focus}, hidden:{menu,focus}}）を欠けなく整える
export function normalizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const list = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()) : []);
  return {
    custom: { menu: list(s.custom?.menu), focus: list(s.custom?.focus) },
    hidden: { menu: list(s.hidden?.menu), focus: list(s.hidden?.focus) },
  };
}

// 画面に出す項目（自分で足した項目が先、その後に非表示にしていない用意済みの項目）
export function visibleItems(settings, kind) {
  const s = normalizeSettings(settings);
  const presets = PRESET_ITEMS[kind].filter(l => !s.hidden[kind].includes(l));
  return [...s.custom[kind], ...presets.filter(l => !s.custom[kind].includes(l))];
}

// ---- ノートの項目 ----

export function findItem(note, kind, label) {
  return note.items.find(i => i.kind === kind && i.label === label) || null;
}

// 選ぶ／外す（外すと出来栄えも消える）
export function toggleItem(note, kind, label) {
  const exists = findItem(note, kind, label);
  const items = exists
    ? note.items.filter(i => !(i.kind === kind && i.label === label))
    : [...note.items, { kind, label, rating: null }];
  return { ...note, items };
}

// 出来栄えを付ける。同じ値をもう一度押すと未評価に戻す
export function rateItem(note, kind, label, rating) {
  const items = note.items.map(i => (i.kind === kind && i.label === label
    ? { ...i, rating: i.rating === rating ? null : rating }
    : i));
  return { ...note, items };
}

// 表示用の並び（練習内容 → 意識すること、各々は選んだ順）
export function orderedItems(note) {
  return KINDS.flatMap(k => note.items.filter(i => i.kind === k));
}

export function emptyNote(date) {
  return { id: null, date, minutes: null, items: [], memo: '', source: 'app' };
}

export function isEmptyNote(note) {
  return note.minutes == null && note.items.length === 0 && !(note.memo || '').trim();
}

// 練習した日として数えるか（休み・未記入だけの日は数えない）
export function isPracticeDay(note) {
  return (note.minutes || 0) > 0 || note.items.length > 0;
}

// 最初の版（技術タグ＋できた/課題）のデータを items に変換する。
// できた=4、課題=2、練習しただけ=未評価として読む
export function legacyToItems(practiced = [], good = [], issues = []) {
  return practiced.map(label => ({
    kind: 'menu',
    label,
    rating: good.includes(label) ? 4 : issues.includes(label) ? 2 : null,
  }));
}

export function timeLabel(minutes) {
  const opt = TIME_OPTIONS.find(o => o.minutes === minutes);
  return opt ? opt.label : '';
}

// ---- 日付（ローカル時刻の 'YYYY-MM-DD' 文字列で扱う） ----

export function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  return toISO(new Date());
}

export function addDays(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

// その日を含む週の月曜日
export function weekStart(iso) {
  const d = fromISO(iso);
  const dow = (d.getDay() + 6) % 7; // 月=0 … 日=6
  d.setDate(d.getDate() - dow);
  return toISO(d);
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function dateLabel(iso) {
  const d = fromISO(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`;
}

// 週の集計（練習した日数と合計時間）
export function weekSummary(notes, anyDateInWeek) {
  const start = weekStart(anyDateInWeek);
  const end = addDays(start, 6);
  const inWeek = notes.filter(n => n.date >= start && n.date <= end && isPracticeDay(n));
  const minutes = inWeek.reduce((s, n) => s + (n.minutes || 0), 0);
  return { days: inWeek.length, minutes };
}

export function hoursLabel(minutes) {
  const h = minutes / 60;
  return Number.isInteger(h) ? `${h}時間` : `${h.toFixed(1)}時間`;
}
