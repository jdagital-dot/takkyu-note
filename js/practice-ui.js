// 練習ノート画面（#screen-practice の中の #practice-root に描画する）
// データは window.practiceService（ノート）と window.practiceItemsService（選手ごとの項目設定）経由。
// 体験モードではどちらもメモリ実装に差し替わる。
import { esc } from './escape.js';
import * as playerState from './player-state.js';
import {
  KINDS, KIND_LABEL, PRESET_ITEMS, CUSTOM_LIMIT, LABEL_MAX, TIME_OPTIONS, RATINGS, RATING_HINT,
  normalizeSettings, visibleItems, findItem, toggleItem, rateItem, orderedItems,
  emptyNote, isEmptyNote, timeLabel, todayISO, addDays, dateLabel, weekSummary, hoursLabel,
} from './practice-tags.js';

let currentDate = todayISO();
let draft = emptyNote(currentDate);
let dirty = false;
let saving = false;
let draftPlayerId = playerState.getCurrentPlayerId(); // 下書きがどの選手のものか

// 項目の編集ダイアログの状態
let editor = null; // { kind, settings }

const svc = () => window.practiceService;
const itemsSvc = () => window.practiceItemsService;
const notes = () => (svc() ? svc().getCurrent() : []);
const findNote = date => notes().find(n => n.date === date) || null;
const clone = n => ({ ...n, items: n.items.map(i => ({ ...i })) });
const toast = (msg, isError = false) => window.showToast && window.showToast(msg, isError);
const settings = () => normalizeSettings(itemsSvc()?.get());

function loadDraft() {
  draftPlayerId = playerState.getCurrentPlayerId();
  const n = findNote(currentDate);
  draft = n ? clone(n) : emptyNote(currentDate);
  dirty = false;
}

function confirmDiscard() {
  return !dirty || window.confirm('保存していない変更があります。破棄して移動しますか？');
}

// 画面を開いたとき（ナビから）。編集途中でなければ今日のノートを開く
export function open() {
  if (!dirty) {
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

function ratingClass(r) {
  if (r == null) return '';
  if (r >= 4) return 'pn-r-high';
  if (r <= 2) return 'pn-r-low';
  return 'pn-r-mid';
}

// ---- 描画 ----

function renderPicker(kind) {
  // 今のノートに入っているが一覧に無い項目（後から非表示・削除したもの）も出して外せるようにする
  const labels = visibleItems(settings(), kind);
  draft.items.filter(i => i.kind === kind && !labels.includes(i.label)).forEach(i => labels.push(i.label));
  return labels.map(label => {
    const on = !!findItem(draft, kind, label);
    return `<button type="button" class="pn-btn${on ? ' selected' : ''}" data-action="pick" data-kind="${kind}" data-label="${esc(label)}">${esc(label)}</button>`;
  }).join('');
}

function renderRatingRows() {
  const items = orderedItems(draft);
  if (!items.length) {
    return '<div class="pn-rate-empty">上で練習内容・意識することを選ぶと、ここで出来栄えを付けられます</div>';
  }
  return items.map(i => `
    <div class="pn-rate-row">
      <div class="pn-rate-label"><span class="pn-kind pn-kind-${i.kind}">${i.kind === 'menu' ? '練習' : '意識'}</span>${esc(i.label)}</div>
      <div class="pn-rate-btns">
        ${RATINGS.map(r => `<button type="button" class="pn-rate-btn${i.rating === r ? ` on ${ratingClass(r)}` : ''}" data-action="rate" data-kind="${i.kind}" data-label="${esc(i.label)}" data-rating="${r}" aria-label="${esc(i.label)} ${r}">${r}</button>`).join('')}
      </div>
    </div>`).join('');
}

function renderNoteCard(n) {
  const chips = orderedItems(n).map(i =>
    `<span class="pn-chip ${ratingClass(i.rating)}">${esc(i.label)}${i.rating ? `<b>${i.rating}</b>` : ''}</span>`).join('');
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

      ${KINDS.map(kind => `
      <div class="form-section">
        <div class="form-section-title pn-title-row">
          <span>${KIND_LABEL[kind]}</span>
          <button type="button" class="pn-edit-link" data-action="edit-items" data-kind="${kind}">項目を編集</button>
        </div>
        <div class="pn-grid" id="pn-${kind}">${renderPicker(kind)}</div>
      </div>`).join('')}

      <div class="form-section">
        <div class="form-section-title">出来栄え</div>
        <p class="pn-help">${esc(RATING_HINT)}</p>
        <div id="pn-rates">${renderRatingRows()}</div>
      </div>

      <div class="form-section">
        <div class="form-section-title">一言（任意）</div>
        <input type="text" id="pn-memo" class="pn-memo" maxlength="100" placeholder="例：打点を前にしたらミスが減った" value="${esc(draft.memo)}">
      </div>

      <button type="button" class="pn-save-btn" id="pn-save" data-action="save" ${saving ? 'disabled' : ''}>${saving ? '保存中…' : existing ? '更新する' : '保存する'}</button>
      ${existing ? '<button type="button" class="pn-delete-link" data-action="delete">この日のノートを削除</button>' : ''}

      <div class="section-title pn-list-title">最近のノート</div>
      <div id="pn-list">
        ${all.length ? all.slice(0, 30).map(renderNoteCard).join('') : '<div class="pn-empty">まだノートはありません。今日の練習から記録してみましょう。</div>'}
      </div>
    </div>
    ${renderEditor()}`;
}

// ---- 項目の編集ダイアログ ----

function renderEditor() {
  if (!editor) return '';
  const { kind, settings: s } = editor;
  const custom = s.custom[kind];
  return `
    <div class="pn-modal-backdrop" data-action="editor-cancel"></div>
    <div class="pn-modal" role="dialog" aria-label="項目を編集">
      <div class="pn-modal-tabs">
        ${KINDS.map(k => `<button type="button" class="pn-tab${k === kind ? ' on' : ''}" data-action="editor-tab" data-kind="${k}">${KIND_LABEL[k]}</button>`).join('')}
      </div>
      <div class="pn-modal-body">
        <div class="pn-modal-sub">自分の項目</div>
        ${custom.length ? custom.map(l => `
          <div class="pn-edit-row">
            <span>${esc(l)}</span>
            <button type="button" class="pn-x" data-action="editor-remove" data-label="${esc(l)}" aria-label="${esc(l)}を削除">✕</button>
          </div>`).join('') : '<div class="pn-modal-note">まだありません</div>'}
        <div class="pn-add-row">
          <input type="text" id="pn-new-item" maxlength="${LABEL_MAX}" placeholder="${kind === 'menu' ? '例：チキータ' : '例：肘を上げない'}">
          <button type="button" class="pn-add-btn" data-action="editor-add">追加</button>
        </div>

        <div class="pn-modal-sub">用意されている項目（タップで表示／非表示）</div>
        <div class="pn-grid">
          ${PRESET_ITEMS[kind].map(l => {
            const hidden = s.hidden[kind].includes(l);
            return `<button type="button" class="pn-btn pn-preset${hidden ? ' off' : ' selected'}" data-action="editor-toggle" data-label="${esc(l)}">${hidden ? '' : '✓ '}${esc(l)}</button>`;
          }).join('')}
        </div>
      </div>
      <div class="pn-modal-foot">
        <button type="button" class="pn-cancel-btn" data-action="editor-cancel">やめる</button>
        <button type="button" class="pn-save-btn pn-modal-save" data-action="editor-save">保存</button>
      </div>
    </div>`;
}

function openEditor(kind) {
  editor = { kind, settings: settings() };
  render();
}

function editorAdd() {
  const input = document.getElementById('pn-new-item');
  const label = (input?.value || '').trim().slice(0, LABEL_MAX);
  if (!label) return;
  const { kind, settings: s } = editor;
  if (s.custom[kind].includes(label) || PRESET_ITEMS[kind].includes(label)) {
    toast('同じ名前の項目があります', true);
    return;
  }
  if (s.custom[kind].length >= CUSTOM_LIMIT) {
    toast(`自分の項目は${CUSTOM_LIMIT}個までです`, true);
    return;
  }
  s.custom[kind] = [...s.custom[kind], label];
  render();
  document.getElementById('pn-new-item')?.focus();
}

async function editorSave() {
  if (!itemsSvc()) return;
  try {
    await itemsSvc().save(editor.settings);
    editor = null;
    toast('項目を保存しました');
  } catch (e) {
    console.error('Failed to save practice items:', e);
    toast('保存できませんでした。通信状態を確認してください', true);
  }
  render();
}

// ---- 操作 ----

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
    toast('練習時間か練習内容を選んでください', true);
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
  const { kind, label } = el.dataset;
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
    case 'pick':
      draft = toggleItem(draft, kind, label);
      dirty = true;
      render();
      break;
    case 'rate':
      draft = rateItem(draft, kind, label, Number(el.dataset.rating));
      dirty = true;
      render();
      break;
    case 'save': save(); break;
    case 'delete': remove(); break;
    case 'edit-items': openEditor(kind); break;
    case 'editor-tab': editor.kind = kind; render(); break;
    case 'editor-add': editorAdd(); break;
    case 'editor-remove':
      editor.settings.custom[editor.kind] = editor.settings.custom[editor.kind].filter(l => l !== label);
      render();
      break;
    case 'editor-toggle': {
      const h = editor.settings.hidden[editor.kind];
      editor.settings.hidden[editor.kind] = h.includes(label) ? h.filter(l => l !== label) : [...h, label];
      render();
      break;
    }
    case 'editor-cancel': editor = null; render(); break;
    case 'editor-save': editorSave(); break;
  }
}

function onInput(e) {
  if (e.target.id === 'pn-memo') {
    draft.memo = e.target.value;
    dirty = true;
  }
}

function onKeydown(e) {
  if (e.target.id === 'pn-new-item' && e.key === 'Enter' && !e.isComposing) {
    e.preventDefault();
    editorAdd();
  }
}

document.addEventListener('click', onClick);
document.addEventListener('input', onInput);
document.addEventListener('keydown', onKeydown);

// 選手を切り替えたら、その選手の今日のノートを開き直す。
// ログイン直後の読み込みでは同じ選手が設定し直されることがあるので、
// 本当に別の選手になったときだけ日付と下書きをリセットする（入力中の内容を消さない）
playerState.onCurrentPlayerChange(id => {
  if (id && draftPlayerId && id !== draftPlayerId) {
    currentDate = todayISO();
    dirty = false;
    editor = null;
    loadDraft();
  } else {
    draftPlayerId = id;
    if (!dirty) loadDraft();
  }
  render();
});

window.practiceUI = { open, refresh, render };
