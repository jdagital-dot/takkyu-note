import * as players from './players.js';
import * as playerState from './player-state.js';

let editingId = null;

const HAND_OPTIONS = ['', '右利き', '左利き'];
const TYPE_OPTIONS = ['', 'シェークハンド裏裏', 'ペンホルダー', 'フォア表', 'バック表', 'バック粒高', 'ペン粒', 'カットマン（粒高）', 'カットマン（表）', 'その他'];
const GRADE_OPTIONS = [
  ['u10', '小学生以下'],
  ['7', '小1'], ['8', '小2'], ['9', '小3'],
  ['10', '小4'], ['11', '小5'], ['12', '小6'],
  ['13', '中1'], ['14', '中2'], ['15', '中3'],
  ['hs', '高校・一般'],
];

function render(player = null) {
  const isEdit = !!player;
  const grade = player?.grade || '';
  const hand = player?.hand || '';
  const type = player?.play_type || '';
  document.getElementById('player-edit-content').innerHTML = `
    <div class="modal-header" style="margin-bottom:14px;">
      <div class="modal-title">${isEdit ? '選手を編集' : '選手を追加'}</div>
      <div class="modal-close" onclick="playerEdit.close()">×</div>
    </div>
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div class="form-row">
        <label>名前</label>
        <input id="player-edit-name" type="text" value="${player?.name || ''}" placeholder="例：中田 太郎">
      </div>
      <div class="form-row">
        <label>学年</label>
        <select id="player-edit-grade">
          <option value="">選択...</option>
          ${GRADE_OPTIONS.map(([v, l]) => `<option value="${v}"${v === grade ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>利き手（任意）</label>
        <select id="player-edit-hand">
          ${HAND_OPTIONS.map(h => `<option value="${h}"${h === hand ? ' selected' : ''}>${h || '未設定'}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>戦型（任意）</label>
        <select id="player-edit-type">
          ${TYPE_OPTIONS.map(t => `<option value="${t}"${t === type ? ' selected' : ''}>${t || '未設定'}</option>`).join('')}
        </select>
      </div>
      <div id="player-edit-message" style="padding:10px; border-radius:8px; display:none; font-size:13px;"></div>
      <div style="display:flex; gap:10px; margin-top:8px;">
        ${isEdit ? '<button onclick="playerEdit.handleDelete()" style="flex:1; padding:14px; background:#fff5f5; color:#e53935; border:1.5px solid #ffcdd2; border-radius:12px; font-weight:700; cursor:pointer; font-family:inherit;">削除</button>' : ''}
        <button onclick="playerEdit.handleSave()" style="flex:${isEdit ? '2' : '1'}; padding:14px; background:linear-gradient(135deg,#e53935,#c62828); color:#fff; border:none; border-radius:12px; font-weight:700; cursor:pointer; font-family:inherit;">保存</button>
      </div>
    </div>
  `;
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
  render(null);
  document.getElementById('player-edit-modal').classList.add('show');
}

export function openEdit(player) {
  editingId = player.id;
  render(player);
  document.getElementById('player-edit-modal').classList.add('show');
}

export function close() {
  document.getElementById('player-edit-modal').classList.remove('show');
  editingId = null;
}

export async function handleSave() {
  const name = document.getElementById('player-edit-name').value.trim();
  const grade = document.getElementById('player-edit-grade').value;
  const hand = document.getElementById('player-edit-hand').value || null;
  const play_type = document.getElementById('player-edit-type').value || null;
  if (!name) return showMessage('名前を入力してください', true);
  if (!grade) return showMessage('学年を選択してください', true);

  try {
    if (editingId) {
      await players.updatePlayer(editingId, { name, grade, hand, play_type });
    } else {
      const created = await players.createPlayer({ name, grade, hand, play_type });
      playerState.setCurrentPlayerId(created.id);
    }
    close();
    if (window.playerUI) await window.playerUI.refreshSwitcher();
    if (typeof window.renderMatches === 'function') window.renderMatches();
  } catch (e) {
    showMessage(e.message || '保存に失敗しました', true);
  }
}

export async function handleDelete() {
  if (!editingId) return;
  if (!confirm('この選手を削除しますか？関連する試合データも削除されます（現状はローカルのみ・Phase 1Dまで）。')) return;
  try {
    await players.deletePlayer(editingId);
    if (playerState.getCurrentPlayerId() === editingId) {
      const remaining = await players.listPlayers();
      playerState.setCurrentPlayerId(remaining[0]?.id || null);
    }
    close();
    if (window.playerUI) await window.playerUI.refreshSwitcher();
    if (typeof window.renderMatches === 'function') window.renderMatches();
  } catch (e) {
    showMessage(e.message || '削除に失敗しました', true);
  }
}

window.playerEdit = { openAdd, openEdit, close, handleSave, handleDelete };
