// 練習ノートの定数と、ノートを扱う純粋な関数。
// 入力画面・紙シート・写真の読み取りが共通で使う（一覧の順番を変えると紙シートの列もずれるので注意）。

// 試合の「この試合のポイント」と同じ12個（将来、試合の課題と練習をつないで分析するため）
export const PRACTICE_TAGS = [
  'サーブ', '3球目', '5球目', 'レシーブ', 'ラリー', 'フットワーク',
  'バック攻め', 'フォア攻め', '回転読み', 'メンタル', 'コース', 'ミドル攻め',
];

// 練習時間の選択肢。休みは 0、未記入は null
export const TIME_OPTIONS = [
  { label: '休み', minutes: 0 },
  { label: '〜1h', minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h', minutes: 120 },
  { label: '2.5h', minutes: 150 },
  { label: '3h〜', minutes: 180 },
];

// 技術の状態: 0=なし 1=練習した 2=◎できた 3=△課題（タップで 0→1→2→3→0 と回る）
export const TAG_STATE = { NONE: 0, PRACTICED: 1, GOOD: 2, ISSUE: 3 };

export function nextTagState(s) {
  return (s + 1) % 4;
}

export function tagState(note, tag) {
  if (note.issues.includes(tag)) return TAG_STATE.ISSUE;
  if (note.good.includes(tag)) return TAG_STATE.GOOD;
  if (note.practiced.includes(tag)) return TAG_STATE.PRACTICED;
  return TAG_STATE.NONE;
}

// できた・課題の技術は必ず「練習した」にも入れる。一覧の順番は PRACTICE_TAGS に揃える
export function withTagState(note, tag, state) {
  const drop = arr => arr.filter(t => t !== tag);
  let practiced = drop(note.practiced);
  let good = drop(note.good);
  let issues = drop(note.issues);
  if (state >= TAG_STATE.PRACTICED) practiced.push(tag);
  if (state === TAG_STATE.GOOD) good.push(tag);
  if (state === TAG_STATE.ISSUE) issues.push(tag);
  const order = arr => PRACTICE_TAGS.filter(t => arr.includes(t));
  return { ...note, practiced: order(practiced), good: order(good), issues: order(issues) };
}

export function emptyNote(date) {
  return { id: null, date, minutes: null, practiced: [], good: [], issues: [], memo: '', source: 'app' };
}

export function isEmptyNote(note) {
  return note.minutes == null && note.practiced.length === 0 && !(note.memo || '').trim();
}

// 練習した日として数えるか（休み・未記入だけの日は数えない）
export function isPracticeDay(note) {
  return (note.minutes || 0) > 0 || note.practiced.length > 0;
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
