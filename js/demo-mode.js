// デモモード: 会員登録なしでアプリを体験できる。
// window.matchesService / opponentsService をメモリ実装に差し替えることで、
// UI側のコードは一切変更せずに全機能（記録・編集・削除・分析・選手切替）が動く。
// データはメモリ内のみで、リロードすると消える。
import * as playerState from './player-state.js';
import * as authUI from './auth-ui.js';

const DEMO_PLAYERS = [
  { id: 'demo-p1', name: '体験 太郎', grade: '14', hand: '右利き', play_type: 'シェークハンド裏裏', team: '体験ジュニア', pref: '新潟', gender: '男子' },
  { id: 'demo-p2', name: '体験 花子', grade: '12', hand: '左利き', play_type: 'フォア表', team: '体験ジュニア', pref: '新潟', gender: '女子' },
];

function daysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function toJa(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

let seq = 0;
function dm(days, opponent, team, age, pref, hand, type, matchType, score, win, tags, memo) {
  const date = daysAgo(days);
  return {
    id: `demo-m-${++seq}`,
    date: toJa(date),
    team, opponent, age, pref, hand, type, matchType, score, win, tags, memo,
    _remoteRow: { date },
  };
}

// 分析画面が映えるよう、戦型・タグ・年齢・勝敗を意図的に散らしたサンプル
function buildDemoMatches() {
  seq = 0;
  return {
    'demo-p1': [
      dm(3,  '佐藤 健',  '青葉中学校',   14, '東京', '右利き', 'シェークハンド裏裏', '公式戦（個人）', '11-8, 11-6, 9-11, 11-7', true,  ['サーブ', '3球目'],       'サーブからの3球目がよく決まった。この形を増やしたい。'),
      dm(3,  '田中 蓮',  '川島卓球クラブ', 15, '東京', '右利き', 'カットマン（粒高）', '公式戦（個人）', '9-11, 11-13, 8-11',      false, ['レシーブ', 'ラリー'],    'カットの変化に対応できず。焦って強打のミスが多かった。'),
      dm(10, '鈴木 大和', '緑川中学校',   14, '千葉', '左利き', 'シェークハンド裏裏', '練習試合',      '11-9, 8-11, 11-6, 11-8', true,  ['コース', 'フォア攻め'],   '左利きのフォア側を突く作戦が効いた。'),
      dm(10, '高橋 悠',  '緑川中学校',   13, '千葉', '右利き', 'フォア表',          '練習試合',      '11-4, 11-6, 11-3',       true,  ['サーブ', 'コース'],       ''),
      dm(17, '伊藤 颯',  '北央中学校',   15, '埼玉', '右利き', 'カットマン（粒高）', 'オープン大会',   '11-7, 9-11, 7-11, 11-9, 9-11', false, ['ラリー', 'メンタル'], 'フルセットで競り負け。終盤の1本の入り方が課題。'),
      dm(24, '渡辺 陸',  '青葉中学校',   14, '東京', '右利き', 'ペン粒',            'オープン大会',   '11-6, 12-10, 11-8',      true,  ['3球目', '回転読み'],     '粒の変化を読めるようになってきた。'),
      dm(31, '山本 樹',  '東港ジュニア', 14, '東京', '左利き', 'フォア表',          '公式戦（団体）', '11-9, 13-11, 11-7',      true,  ['サーブ', '3球目'],       'チームも3-1で勝利！'),
      dm(38, '佐藤 健',  '青葉中学校',   14, '東京', '右利き', 'シェークハンド裏裏', '練習試合',      '8-11, 11-9, 9-11, 11-13', false, ['レシーブ'],            'レシーブから崩された。ツッツキの質を上げたい。'),
    ],
    'demo-p2': [
      dm(5,  '中村 芽依', '桜台ジュニア', 12, '東京', '右利き', 'シェークハンド裏裏', '公式戦（個人）', '11-7, 11-9, 11-5', true,  ['サーブ'],            '初めての公式戦勝利！'),
      dm(12, '小林 結愛', '桜台ジュニア', 13, '東京', '右利き', 'フォア表',          '練習試合',      '9-11, 11-8, 8-11, 11-6, 7-11', false, ['ラリー', 'メンタル'], 'あと1本が取れなかった。'),
      dm(19, '加藤 心春', '西丘小クラブ', 11, '千葉', '右利き', 'その他',            '練習試合',      '11-3, 11-5, 11-2', true,  [],                   ''),
    ],
  };
}

function buildDemoOpponents() {
  return [
    { id: 'demo-o-1', name: '佐藤 健',  team: '青葉中学校',    age: 14, pref: '東京', hand: '右利き', type: 'シェークハンド裏裏' },
    { id: 'demo-o-2', name: '田中 蓮',  team: '川島卓球クラブ', age: 15, pref: '東京', hand: '右利き', type: 'カットマン（粒高）' },
    { id: 'demo-o-3', name: '伊藤 颯',  team: '北央中学校',    age: 15, pref: '埼玉', hand: '右利き', type: 'カットマン（粒高）' },
    { id: 'demo-o-4', name: '中村 芽依', team: '桜台ジュニア',  age: 12, pref: '東京', hand: '右利き', type: 'シェークハンド裏裏' },
  ];
}

let matchesByPlayer = {};
let opponentsList = [];

const demoMatchesService = {
  getCurrent() {
    const pid = playerState.getCurrentPlayerId();
    return (matchesByPlayer[pid] || []).slice();
  },
  async refreshCurrent(onUpdate) {
    onUpdate?.(this.getCurrent());
  },
  async create(md) {
    const pid = playerState.getCurrentPlayerId();
    const date = md.date || daysAgo(0);
    const m = { ...md, id: `demo-m-new-${Date.now()}`, date: toJa(date), _remoteRow: { date } };
    (matchesByPlayer[pid] = matchesByPlayer[pid] || []).unshift(m);
    return m;
  },
  async update(id, md) {
    const pid = playerState.getCurrentPlayerId();
    const list = matchesByPlayer[pid] || [];
    const idx = list.findIndex(x => x.id === id);
    if (idx < 0) throw new Error('not found');
    const prev = list[idx];
    const date = md.date || prev._remoteRow?.date || daysAgo(0);
    list[idx] = { ...prev, ...md, id, date: toJa(date), _remoteRow: { date } };
    return list[idx];
  },
  async delete(id) {
    const pid = playerState.getCurrentPlayerId();
    matchesByPlayer[pid] = (matchesByPlayer[pid] || []).filter(x => x.id !== id);
  },
};

const demoOpponentsService = {
  getAll() { return opponentsList.slice(); },
  async refresh(onUpdate) { onUpdate?.(this.getAll()); },
  async create(opp) {
    const o = { ...opp, id: `demo-o-new-${Date.now()}` };
    opponentsList.unshift(o);
    return o;
  },
  async update(id, opp) {
    const idx = opponentsList.findIndex(x => x.id === id);
    if (idx < 0) throw new Error('not found');
    opponentsList[idx] = { ...opponentsList[idx], ...opp, id };
    return opponentsList[idx];
  },
  async delete(id) {
    opponentsList = opponentsList.filter(x => x.id !== id);
  },
};

export function isDemo() {
  return !!window._demoMode;
}

export function enter() {
  window._demoMode = true;
  matchesByPlayer = buildDemoMatches();
  opponentsList = buildDemoOpponents();

  // サービス層を差し替え（UIコードはそのまま動く）
  window.matchesService = demoMatchesService;
  window.opponentsService = demoOpponentsService;

  playerState.setCurrentPlayerId('demo-p1');
  if (window.playerUI) window.playerUI.setPlayers(DEMO_PLAYERS.map(p => ({ ...p })));

  // 選手の追加・編集はクラウド前提のためデモでは案内のみ
  if (window.playerEdit) {
    const guard = () => window.showToast && window.showToast('選手の追加・編集は登録すると使えます', true);
    window.playerEdit = { ...window.playerEdit, openAdd: guard, openEdit: guard };
  }

  // バナー表示とヘッダーのボタン差し替え
  const banner = document.getElementById('demo-banner');
  if (banner) banner.style.display = 'flex';
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.textContent = 'デモを終了';
    logoutBtn.onclick = exit;
  }

  authUI.hideAuthScreen();
  if (typeof window.renderMatches === 'function') window.renderMatches();
  if (typeof window.showScreen === 'function') window.showScreen('home');
}

export function exit() {
  // デモの痕跡を消してから初期状態に戻す
  try {
    localStorage.removeItem('pingpong_current_player_id');
    localStorage.removeItem('pingpong_players_cache');
  } catch {}
  location.reload();
}

window.demoMode = { enter, exit, isDemo };
