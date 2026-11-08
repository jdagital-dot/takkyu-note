// 練習ノート画面（#screen-practice の中の #practice-root に描画する）
// データは window.practiceService 経由（体験モードではメモリ実装に差し替わる）。
import { esc } from './escape.js';
import * as playerState from './player-state.js';
import {
  PRACTICE_TAGS, TIME_OPTIONS, TAG_STATE, nextTagState, tagState, withTagState,
  emptyNote, isEmptyNote, timeLabel, todayISO, addDays, dateLabel, weekSummary, hoursLabel,
} from './practice-tags.js';

let currentDate = todayISO();
let draft = emptyNote(currentDate);
let dirty = false;
let saving = false;

const svc = () => window.practiceService;
const notes = () => (svc() ? svc().getCurrent() : []);
const findNote = date => notes().find(n => n.date === date) || null;
const clone = n => ({ ...n, practiced: [...n.practiced], good: [...n.good], issues: [...n.issues] });
const toast = (msg, isError = false) => window.showToast && window.showToast(msg, isError);

function loadDraft() {
  const n = findNote(currentDate);
  draft = n ? clone(n) : emptyNote(currentDate);
  dirty = false;
}

function confirmDiscard() {
  return !dirty || window.confirm('保存していない変更があります。破棄して移動しますか？');
}

// 画面を開いたとき（ナビから）。今日のノートを開く
export function open() {
  if (dirty && draft.date !== todayISO()) {
    // 編集途中の日付があればそのまま残す
  } else {
    currentDate = todayISO();
    loadDraft();
  }
  render();
}

// データ更新（選手切替・同期）後に呼ばれる。編集途中でなければ下書きも読み直す
export function refresh() {
  if (!dirty) loadDraft();
  render();
}

function playerName() {
  const pid = playerState.getCurrentPlayerId();
  const p = (window.playerUI?.getPlayers?.() || []).find(x => x.id === pid);
  return p ? p.name : '';
}

const STATE_CLASS = { 1: 'pn-st-practiced', 2: 'pn-st-good', 3: 'pn-st-issue' };
const STATE_MARK = { 1: '', 2: '◎', 3: '△' };

function renderTagButton(tag) {
  const s = tagState(draft, tag);
  return `<button type="button" class="pn-btn pn-tag ${STATE_CLASS[s] || ''}" data-action="tag" data-tag="${esc(tag)}" aria-label="${esc(tag)}">${STATE_MARK[s] || ''}${esc(tag)}</button>`;
}

function renderNoteCard(n) {
  const chips = [
    ...n.good.map(t => `<span class="pn-chip pn-chip-good">◎${esc(t)}</span>`),
    ...n.issues.map(t => `<span class="pn-chip pn-chip-issue">△${esc(t)}</span>`),
    ...n.practiced.filter(t => !n.good.includes(t) && !n.issues.includes(t))
      .map(t => `<span class="pn-chip">${esc(t)}</span>`),
  ].join('');
  const time = n.minutes == null ? '' : timeLabel(n.minutes);
  return `
    <div class="pn-card${n.date === currentDate ? ' pn-card-current' : ''}" data-action="open-date" data-date="${esc(n.date)}">
      <div class="pn-card-head">
        <span class="pn-card-date">${esc(dateLabel(n.date))}</span>
        ${time ? `<span class="pn-card-time">${esc(time)}</span>` : ''}
        ${n.source === 'paper' ? '<span class="pn-card-src">紙</span>' : ''}
      </div>
      ${chips ? `<div class="pn-chips">${chips}</div>` : ''}
      ${n.memo ? `<div class="pn-card-memo">${esc(n.memo)}</div>` : ''}
    </div>`;
}

export function render() {
  const root = document.getElementById('practice-root');
  if (!root) return;
  const all = notes();
  const week = weekSummary(all, todayISO());
  const existing = findNote(currentDate);
  const isToday = currentDate === todayISO();
  const name = playerName();

  root.innerHTML = `
    <div class="header">
      <h1>練習ノート</h1>
      <p>${name ? `${esc(name)} ・ ` : ''}今週 <span id="pn-week-days">${week.days}</span>日・${esc(hoursLabel(week.minutes))}</p>
    </div>
    <div class="form-container">
      <div class="form-section">
        <div class="pn-date-nav">
          <button type="button" class="pn-date-btn" data-action="prev-day" aria-label="前の日">◀</button>
          <div class="pn-date-label">
            <span id="pn-date">${esc(dateLabel(currentDate))}</span>
            ${existing ? '<span class="pn-saved-badge">記録済み</span>' : ''}
          </div>
          <button type="button" class="pn-date-btn" data-action="next-day" aria-label="次の日" ${isToday ? 'disabled' : ''}>▶</button>
        </div>
        ${isToday ? '' : '<button type="button" class="pn-today-link" data-action="today">今日に戻る</button>'}
      </div>

      <div class="form-section">
        <div class="form-section-title">練習時間</div>
        <div class="pn-grid" id="pn-time">
          ${TIME_OPTIONS.map(o => `<button type="button" class="pn-btn${draft.minutes === o.minutes ? ' selected' : ''}" data-action="time" data-minutes="${o.minutes}">${esc(o.label)}</button>`).join('')}
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">技術</div>
        <p class="pn-help">タップするたびに <b>練習した</b> → <b class="pn-good">◎できた</b> → <b class="pn-issue">△課題</b> → なし</p>
        <div class="pn-grid" id="pn-tags">
          ${PRACTICE_TAGS.map(renderTagButton).join('')}
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">一言（任意）</div>
        <input type="text" id="pn-memo" class="pn-memo" maxlength="100" placeholder="例：サーブの回転がかかるようになってきた" value="${esc(draft.memo)}">
      </div>

      <button type="button" class="pn-save-btn" id="pn-save" data-action="save" ${saving ? 'disabled' : ''}>${saving ? '保存中…' : existing ? '更新する' : '保存する'}</button>
      ${existing ? '<button type="button" class="pn-delete-link" data-action="delete">この日のノートを削除</button>' : ''}

      <div class="section-title pn-list-title">最近のノート</div>
      <div id="pn-list">
        ${all.length ? all.slice(0, 30).map(renderNoteCard).join('') : '<div class="pn-empty">まだノートはありません。今日の練習から記録してみましょう。</div>'}
      </div>
    </div>`;
}

function goToDate(date) {
  if (date > todayISO()) return;
  if (date !== currentDate && !confirmDiscard()) return;
  currentDate = date;
  loadDraft();
  render();
  document.getElementById('screen-practice')?.scrollTo({ top: 0, behavior: 'smooth' });
}

async function save() {
  if (saving || !svc()) return;
  const memoEl = document.getElementById('pn-memo');
  if (memoEl) draft.memo = memoEl.value;
  if (isEmptyNote(draft) && !findNote(currentDate)) {
    toast('練習時間か技術を選んでください', true);
    return;
  }
  saving = true;
  render();
  try {
    const saved = await svc().save({ ...draft, date: currentDate });
    draft = clone(saved);
    dirty = false;
    toast('保存しました');
  } catch (e) {
    console.error('Failed to save practice note:', e);
    toast('保存できませんでした。通信状態を確認してください', true);
  } finally {
    saving = false;
    render();
  }
}

async function remove() {
  const n = findNote(currentDate);
  if (!n || !svc()) return;
  if (!window.confirm(`${dateLabel(currentDate)}のノートを削除しますか？`)) return;
  try {
    await svc().delete(n.id);
    draft = emptyNote(currentDate);
    dirty = false;
    toast('削除しました');
  } catch (e) {
    console.error('Failed to delete practice note:', e);
    toast('削除できませんでした', true);
  }
  render();
}

function onClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el || !el.closest('#practice-root')) return;
  const memoEl = document.getElementById('pn-memo');
  if (memoEl) draft.memo = memoEl.value; // 再描画で入力中の一言が消えないように
  switch (el.dataset.action) {
    case 'prev-day': goToDate(addDays(currentDate, -1)); break;
    case 'next-day': goToDate(addDays(currentDate, 1)); break;
    case 'today': goToDate(todayISO()); break;
    case 'open-date': goToDate(el.dataset.date); break;
    case 'time': {
      const m = Number(el.dataset.minutes);
      draft.minutes = draft.minutes === m ? null : m; // もう一度タップで未選択に戻す
      dirty = true;
      render();
      break;
    }
    case 'tag': {
      const tag = el.dataset.tag;
      draft = withTagState(draft, tag, nextTagState(tagState(draft, tag)));
      dirty = true;
      render();
      break;
    }
    case 'save': save(); break;
    case 'delete': remove(); break;
  }
}

function onInput(e) {
  if (e.target.id === 'pn-memo') {
    draft.memo = e.target.value;
    dirty = true;
  }
}

document.addEventListener('click', onClick);
document.addEventListener('input', onInput);

// 選手を切り替えたら、その選手の今日のノートを開き直す
playerState.onCurrentPlayerChange(() => {
  currentDate = todayISO();
  dirty = false;
  loadDraft();
  render();
});

export { TAG_STATE };
window.practiceUI = { open, refresh, render };
