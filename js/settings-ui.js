// 設定画面。選手・アカウント・データ・アプリ情報をここに集約する。
// 退会とCSVエクスポートもこのモジュールが持つ。
import { supabase } from './supabase-client.js';
import { esc } from './escape.js';
import { GRADE_OPTIONS } from './player-edit.js';

// バージョンの唯一の出どころ。sw.js の CACHE はキャッシュ破棄用の連番で用途が違うため兼用しない。
// リリース時に手で更新する。
export const APP_VERSION = 'v1.1.0';

const SUPPORT_EMAIL = 'takkyuu.note@gmail.com';
const FEEDBACK_MAILTO =
  `mailto:${SUPPORT_EMAIL}?subject=` +
  encodeURIComponent('【卓球記録ノート】ご意見・不具合報告');
const DELETE_REQUEST_MAILTO =
  `mailto:${SUPPORT_EMAIL}?subject=` +
  encodeURIComponent('【卓球記録ノート】アカウント削除のお願い') +
  '&body=' +
  encodeURIComponent(
    'アプリ内でデータの削除は完了しました。\n' +
    'メールアドレス（認証情報）の削除をお願いします。\n\n' +
    '※このメールの送信元アドレスが削除対象です。\n'
  );

const GRADE_LABELS = Object.fromEntries(GRADE_OPTIONS);

let deleteArmed = false;

function isDemo() {
  return !!(window.demoMode && window.demoMode.isDemo && window.demoMode.isDemo());
}

function toast(msg, isError = false) {
  if (typeof window.showToast === 'function') window.showToast(msg, isError);
}

const CHEVRON =
  '<span class="chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>';

export function open() {
  deleteArmed = false;
  render();
  if (typeof window.showScreen === 'function') window.showScreen('settings');
  if (!isDemo()) loadEmail();
}

// メールアドレスは非同期で取得し、届いたら差分で埋める。
// getUser() はロック競合でハングする既知の問題があるため getSession() を使う。
async function loadEmail() {
  try {
    const { data } = await supabase.auth.getSession();
    const email = data?.session?.user?.email || '';
    const el = document.getElementById('settings-email');
    if (el && email) el.textContent = email;
  } catch (e) {
    console.error('Failed to load email:', e);
  }
}

function render() {
  const mount = document.getElementById('settings-content');
  if (!mount) return;

  const players = (window.playerUI && window.playerUI.getPlayers()) || [];
  const demo = isDemo();

  const playerRows = players.map(p => {
    const grade = p.grade ? GRADE_LABELS[p.grade] || p.grade : '';
    const team = p.team ? esc(p.team) : '';
    const sub = [grade, team].filter(Boolean).join(' ・ ');
    return `
      <button type="button" class="settings-row" onclick="settingsUI.editPlayer('${esc(p.id)}')">
        <span class="settings-avatar">${esc((p.name || '?')[0])}</span>
        <span>
          ${esc(p.name)}
          ${sub ? `<span class="sub" style="display:block;">${sub}</span>` : ''}
        </span>
        ${CHEVRON}
      </button>`;
  }).join('');

  mount.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-title">選手</div>
      <div class="settings-group">
        ${playerRows}
        <button type="button" class="settings-row" onclick="settingsUI.addPlayer()" style="color:#e53935; font-weight:600;">
          ＋ 選手を追加
        </button>
      </div>
      <div class="settings-note">チーム名と県を入れると、試合カードの自分側にも表示されます。</div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">アカウント</div>
      <div class="settings-group">
        ${demo ? '' : `
        <div class="settings-row static">
          <span>メールアドレス</span>
          <span class="tail" id="settings-email">読み込み中…</span>
        </div>`}
        <button type="button" class="settings-row" onclick="settingsUI.logout()">
          <span>${demo ? 'デモを終了' : 'ログアウト'}</span>
          ${CHEVRON}
        </button>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">データ</div>
      <div class="settings-group">
        <button type="button" class="settings-row" onclick="settingsUI.exportCsv()">
          <span>試合記録をCSVで書き出し</span>
          ${CHEVRON}
        </button>
      </div>
      <div class="settings-note">全選手の記録を1つのファイルにまとめます。Excelでそのまま開けます。</div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">アプリについて</div>
      <div class="settings-group">
        <a class="settings-row" href="${FEEDBACK_MAILTO}" style="text-decoration:none;">
          <span>ご意見・不具合報告</span>
          ${CHEVRON}
        </a>
        <a class="settings-row" href="/terms" style="text-decoration:none;">
          <span>利用規約</span>
          ${CHEVRON}
        </a>
        <a class="settings-row" href="/privacy" style="text-decoration:none;">
          <span>プライバシーポリシー</span>
          ${CHEVRON}
        </a>
        <div class="settings-row static">
          <span>バージョン</span>
          <span class="tail">${APP_VERSION}</span>
        </div>
      </div>
    </div>

    ${demo ? '' : `
    <div class="settings-section">
      <div class="settings-group">
        <button type="button" class="settings-row danger" onclick="settingsUI.deleteAccount()">
          退会（アカウント削除）
        </button>
      </div>
    </div>`}

    <div style="height:24px;"></div>
  `;
}

export function addPlayer() {
  if (window.playerEdit) window.playerEdit.openAdd();
}

export function editPlayer(id) {
  const players = (window.playerUI && window.playerUI.getPlayers()) || [];
  const p = players.find(x => x.id === id);
  if (!p) return;
  if (window.playerEdit) window.playerEdit.openEdit(p);
}

export function logout() {
  if (isDemo()) {
    window.demoMode.exit();
    return;
  }
  if (window.performLogout) window.performLogout();
}

// 設定画面を開いたまま選手を編集したときに一覧を更新する
export function refresh() {
  const screen = document.getElementById('screen-settings');
  if (screen && screen.classList.contains('active')) render();
}

/* ---------------- CSVエクスポート ---------------- */

const CSV_HEADERS = [
  '選手名', '試合日', '相手名', '相手チーム', '相手学年', '相手県', '相手性別',
  '利き手', '戦型', '試合種別', 'スコア', 'ゲームカウント', '勝敗', 'タグ', 'メモ',
];

// ゲームカウントは詳細記録でも点数から逆算し、両方式で必ず埋まるようにする
function gameCountText(m) {
  if (m.gamesWon != null && m.gamesLost != null) return `${m.gamesWon}-${m.gamesLost}`;
  if (!m.score || m.score === '—') return '';
  let mine = 0, theirs = 0;
  m.score.split(',').forEach(part => {
    const [a, b] = part.trim().split('-').map(n => parseInt(n, 10));
    if (isNaN(a) || isNaN(b)) return;
    if (a > b) mine++; else if (b > a) theirs++;
  });
  return (mine || theirs) ? `${mine}-${theirs}` : '';
}

// RFC 4180: カンマ・改行・ダブルクォートを含む値は囲んで内部のクォートを2重化する
function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function ageToGradeLabel(age) {
  if (age == null || age === '') return '';
  const found = GRADE_OPTIONS.find(([v]) => String(v) === String(age));
  return found ? found[1] : String(age);
}

export async function exportCsv() {
  const svc = window.matchesService;
  if (!svc || typeof svc.getAllForExport !== 'function') {
    toast('書き出しに対応していません', true);
    return;
  }

  toast('書き出しています…');
  let groups;
  try {
    groups = await svc.getAllForExport();
  } catch (e) {
    console.error('Export failed:', e);
    toast('書き出しに失敗しました。通信状態を確認してください', true);
    return;
  }

  const rows = [CSV_HEADERS];
  let count = 0;
  for (const g of groups) {
    for (const m of g.matches) {
      count++;
      rows.push([
        g.player?.name || '',
        m.date || '',
        m.opponent || '',
        m.team || '',
        ageToGradeLabel(m.age),
        m.pref && m.pref !== '不明' ? m.pref : '',
        m.gender || '',
        m.hand || '',
        m.type && m.type !== '不明' ? m.type : '',
        m.matchType || '',
        m.score && m.score !== '—' ? m.score : '',
        gameCountText(m),
        m.win ? '勝ち' : '負け',
        Array.isArray(m.tags) ? m.tags.join(' / ') : '',
        m.memo || '',
      ]);
    }
  }

  if (count === 0) {
    toast('書き出す試合記録がありません', true);
    return;
  }

  // 先頭のBOMが無いとExcelで開いたときに日本語が文字化けする
  const csv = '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  a.href = url;
  a.download = `takkyu-note-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  toast(`✓ ${count}試合を書き出しました`);
}

/* ---------------- 退会 ---------------- */

function showModal(html) {
  document.getElementById('settings-modal-content').innerHTML = html;
  document.getElementById('settings-modal').classList.add('show');
}

export function closeModal() {
  document.getElementById('settings-modal').classList.remove('show');
  deleteArmed = false;
}

export function deleteAccount() {
  deleteArmed = false;
  showModal(`
    <div class="modal-header" style="margin-bottom:12px;">
      <div class="modal-title">退会しますか？</div>
      <button class="modal-close" onclick="settingsUI.closeModal()" aria-label="閉じる">×</button>
    </div>
    <div style="font-size:14px; line-height:1.8; color:#444; margin-bottom:8px;">
      すべての選手・試合記録・アドレス帳が削除されます。<strong style="color:#e53935;">元に戻すことはできません。</strong>
    </div>
    <div style="font-size:12.5px; line-height:1.7; color:#888; background:#fafafa; border-radius:10px; padding:12px; margin-bottom:16px;">
      メールアドレス（ログイン情報）の削除は運営が対応します。削除後に依頼メールの作成画面をお出しします。
    </div>
    <div style="display:flex; gap:8px;">
      <button type="button" onclick="settingsUI.closeModal()" style="flex:1; padding:13px; background:#f2f3f5; color:#666; border:none; border-radius:12px; font-size:14px; font-weight:700; font-family:inherit; cursor:pointer;">やめる</button>
      <button type="button" id="settings-delete-btn" onclick="settingsUI.confirmDelete()" style="flex:1; padding:13px; background:#fff5f5; color:#e53935; border:1.5px solid #ffcdd2; border-radius:12px; font-size:14px; font-weight:700; font-family:inherit; cursor:pointer;">退会する</button>
    </div>
    <div id="settings-delete-msg" style="font-size:12.5px; color:#c62828; margin-top:10px; display:none;"></div>
  `);
}

export async function confirmDelete() {
  const btn = document.getElementById('settings-delete-btn');
  const msg = document.getElementById('settings-delete-msg');

  // confirm() は iOS の PWA で表示されないため、ボタン2度押しで確認する
  if (!deleteArmed) {
    deleteArmed = true;
    if (btn) {
      btn.textContent = 'もう一度押すと削除';
      btn.style.background = '#e53935';
      btn.style.color = '#fff';
      btn.style.border = 'none';
    }
    if (msg) {
      msg.textContent = '本当に削除する場合はもう一度押してください。';
      msg.style.display = 'block';
    }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = '削除中…'; }

  try {
    const { data } = await supabase.auth.getSession();
    const uid = data?.session?.user?.id;
    if (!uid) throw new Error('ログイン情報が取得できませんでした');

    // accounts の1行を削除すると ON DELETE CASCADE で
    // players → matches、opponents が連鎖削除される
    const { error } = await supabase.from('accounts').delete().eq('id', uid);
    if (error) throw error;
  } catch (e) {
    console.error('Account deletion failed:', e);
    if (btn) { btn.disabled = false; btn.textContent = '退会する'; }
    if (msg) {
      msg.textContent = (e.message || '削除に失敗しました') + '（通信状態を確認してください）';
      msg.style.display = 'block';
    }
    deleteArmed = false;
    return;
  }

  // セッションを残すと次回起動時に空のアカウントが再生成されるため、即座にログアウトする
  if (window.performLogout) window.performLogout();

  showModal(`
    <div class="modal-header" style="margin-bottom:12px;">
      <div class="modal-title">データを削除しました</div>
    </div>
    <div style="font-size:14px; line-height:1.8; color:#444; margin-bottom:14px;">
      選手・試合記録・アドレス帳をすべて削除しました。ご利用ありがとうございました。
    </div>
    <div style="font-size:13px; line-height:1.8; color:#444; background:#fafafa; border-radius:10px; padding:14px; margin-bottom:16px;">
      メールアドレスの削除には運営での作業が必要です。下のボタンから依頼メールを送ってください。<br>
      ボタンが動かない場合は、こちらへ直接ご連絡ください。<br>
      <span style="font-weight:700; color:#1a1a2e; user-select:all;">${SUPPORT_EMAIL}</span>
    </div>
    <a href="${DELETE_REQUEST_MAILTO}" style="display:block; text-align:center; padding:14px; background:linear-gradient(135deg,#e53935,#c62828); color:#fff; border-radius:12px; font-size:14.5px; font-weight:700; text-decoration:none; margin-bottom:8px;">削除を依頼するメールを作成</a>
    <button type="button" onclick="settingsUI.closeModal()" style="width:100%; padding:13px; background:none; color:#888; border:none; font-size:14px; font-family:inherit; cursor:pointer;">閉じる</button>
  `);
}

window.settingsUI = {
  open, addPlayer, editPlayer, logout, refresh,
  exportCsv, deleteAccount, confirmDelete, closeModal,
};
