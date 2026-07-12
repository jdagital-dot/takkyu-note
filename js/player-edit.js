import * as players from './players.js';
import * as playerState from './player-state.js';
import { esc } from './escape.js';

let editingId = null;
let deleteArmed = false;
let selHand = '';
let selType = '';

const TYPE_OPTIONS = ['シェークハンド裏裏', 'ペンホルダー', 'フォア表', 'バック表', 'バック粒高', 'ペン粒', 'カットマン（粒高）', 'カットマン（表）', 'その他'];
const TYPE_SHORT = {
  'シェークハンド裏裏': 'シェーク裏裏',
  'カットマン（粒高）': 'カット（粒高）',
  'カットマン（表）': 'カット（表）',
};
const GRADE_OPTIONS = [
  ['u10', '小学生以下'],
  ['7', '小1'], ['8', '小2'], ['9', '小3'],
  ['10', '小4'], ['11', '小5'], ['12', '小6'],
  ['13', '中1'], ['14', '中2'], ['15', '中3'],
  ['hs', '高校・一般'],
];

const HAND_SVG_R = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>';
const HAND_SVG_L = HAND_SVG_R.replace('<svg ', '<svg style="transform:scaleX(-1);" ');

function render(player = null) {
  const isEdit = !!player;
  const grade = player?.grade || '';
  selHand = player?.hand || '';
  selType = player?.play_type || '';

  document.getElementById('player-edit-content').innerHTML = `
    <div class="modal-header" style="margin-bottom:14px;">
      <div class="modal-title">${isEdit ? '選手を編集' : '選手を追加'}</div>
      <button class="modal-close" onclick="playerEdit.close()" aria-label="閉じる">×</button>
    </div>
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div class="form-row">
        <label for="player-edit-name">名前</label>
        <input id="player-edit-name" type="text" value="${esc(player?.name || '')}" placeholder="例：中田 太郎">
      </div>
      <div class="form-row">
        <label for="player-edit-grade">学年</label>
        <select id="player-edit-grade">
          <option value="">選択...</option>
          ${GRADE_OPTIONS.map(([v, l]) => `<option value="${v}"${v === grade ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>

      <div>
        <div style="font-size:12px; font-weight:700; color:#aaa; letter-spacing:0.5px; margin-bottom:8px;">利き手（任意）</div>
        <div style="display:flex; gap:8px;">
          <div class="type-btn pe-hand-btn ${selHand === '右利き' ? 'selected' : ''}" data-hand="右利き" onclick="playerEdit.pickHand(this,'右利き')" style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px;">${HAND_SVG_R}右利き</div>
          <div class="type-btn pe-hand-btn ${selHand === '左利き' ? 'selected' : ''}" data-hand="左利き" onclick="playerEdit.pickHand(this,'左利き')" style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px;">${HAND_SVG_L}左利き</div>
        </div>
      </div>

      <div>
        <div style="font-size:12px; font-weight:700; color:#aaa; letter-spacing:0.5px; margin-bottom:8px;">戦型（任意）</div>
        <div class="type-grid" style="grid-template-columns: repeat(2, 1fr);">
          ${TYPE_OPTIONS.map((t, i, arr) => `
            <div class="type-btn pe-type-btn ${selType === t ? 'selected' : ''}" data-type="${esc(t)}" onclick="playerEdit.pickType(this,'${esc(t)}')" ${i === arr.length - 1 ? 'style="grid-column: span 2;"' : ''}>${esc(TYPE_SHORT[t] || t)}</div>
          `).join('')}
        </div>
      </div>

      <div id="player-edit-message" style="padding:10px; border-radius:8px; display:none; font-size:13px;"></div>
      <div style="display:flex; gap:10px; margin-top:4px;">
        ${isEdit ? '<button id="player-edit-delete" onclick="playerEdit.handleDelete()" style="flex:1; padding:15px; background:#fff5f5; color:#e53935; border:1.5px solid #ffcdd2; border-radius:14px; font-size:15px; font-weight:700; cursor:pointer; font-family:inherit;">削除</button>' : ''}
        <button onclick="playerEdit.handleSave()" style="flex:${isEdit ? '2' : '1'}; padding:15px; background:linear-gradient(135deg,#e53935,#c62828); color:#fff; border:none; border-radius:14px; font-size:15px; font-weight:700; cursor:pointer; font-family:inherit; box-shadow:0 4px 16px rgba(229,57,53,0.3);">${isEdit ? '保存する' : '登録する'}</button>
      </div>
    </div>
  `;
}

// タップで選択、同じボタンをもう一度タップで解除（未設定に戻せる）
export function pickHand(el, hand) {
  const wasSelected = el.classList.contains('selected');
  document.querySelectorAll('.pe-hand-btn').forEach(b => b.classList.remove('selected'));
  if (wasSelected) { selHand = ''; return; }
  el.classList.add('selected');
  selHand = hand;
}

export function pickType(el, type) {
  const wasSelected = el.classList.contains('selected');
  document.querySelectorAll('.pe-type-btn').forEach(b => b.classList.remove('selected'));
  if (wasSelected) { selType = ''; return; }
  el.classList.add('selected');
  selType = type;
}

function showMessage(text, isError = false) {
  const el = document.getElementById('player-edit-message');
  el.textContent = text;
  el.style.display = 'block';
  el.style.background = isError ? '#fff5f5' : '#e8f5e9';
  el.style.color = isError ? '#c62828' : '#2e7d32';
}

export function openAdd() {
  editingId = null;
  deleteArmed = false;
  render(null);
  document.getElementById('player-edit-modal').classList.add('show');
}

export function openEdit(player) {
  editingId = player.id;
  deleteArmed = false;
  render(player);
  document.getElementById('player-edit-modal').classList.add('show');
}

export function close() {
  document.getElementById('player-edit-modal').classList.remove('show');
  editingId = null;
  deleteArmed = false;
}

export async function handleSave() {
  const name = document.getElementById('player-edit-name').value.trim();
  const grade = document.getElementById('player-edit-grade').value;
  if (!name) return showMessage('名前を入力してください', true);
  if (!grade) return showMessage('学年を選択してください', true);
  const wasEditing = !!editingId;

  try {
    if (editingId) {
      await players.updatePlayer(editingId, { name, grade, hand: selHand || null, play_type: selType || null });
    } else {
      const created = await players.createPlayer({ name, grade, hand: selHand || null, play_type: selType || null });
      playerState.setCurrentPlayerId(created.id);
    }
    close();
    if (window.playerUI) await window.playerUI.refreshSwitcher();
    if (typeof window.renderMatches === 'function') window.renderMatches();
    if (typeof window.showToast === 'function') window.showToast(wasEditing ? '✓ 選手を更新しました' : '✓ 選手を登録しました');
  } catch (e) {
    showMessage(e.message || '保存に失敗しました', true);
  }
}

export async function handleDelete() {
  if (!editingId) return;
  // confirm() は iOS の PWA で表示されないため、ボタン2度押しで確認する
  if (!deleteArmed) {
    deleteArmed = true;
    const btn = document.getElementById('player-edit-delete');
    if (btn) {
      btn.textContent = 'もう一度押すと削除';
      btn.style.background = '#e53935';
      btn.style.color = '#fff';
      btn.style.border = 'none';
    }
    showMessage('この選手の試合記録もすべて削除されます。よろしければもう一度「削除」を押してください。', true);
    return;
  }
  try {
    await players.deletePlayer(editingId);
    if (playerState.getCurrentPlayerId() === editingId) {
      const remaining = await players.listPlayers();
      playerState.setCurrentPlayerId(remaining[0]?.id || null);
    }
    close();
    if (window.playerUI) await window.playerUI.refreshSwitcher();
    if (typeof window.renderMatches === 'function') window.renderMatches();
    if (typeof window.showToast === 'function') window.showToast('選手を削除しました');
  } catch (e) {
    showMessage(e.message || '削除に失敗しました', true);
  }
}

window.playerEdit = { openAdd, openEdit, close, handleSave, handleDelete, pickHand, pickType };
