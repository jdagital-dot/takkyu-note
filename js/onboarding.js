import * as players from './players.js';
import * as playerState from './player-state.js';

export function showOnboardingScreen() {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    if (s.id !== 'screen-onboarding') s.style.display = 'none';
  });
  const screen = document.getElementById('screen-onboarding');
  screen.style.display = 'flex';
  screen.classList.add('active');
  const fab = document.getElementById('fab');
  if (fab) fab.style.display = 'none';
  const nav = document.querySelector('.bottom-nav');
  if (nav) nav.style.display = 'none';
  document.getElementById('onboarding-name').value = '';
  document.getElementById('onboarding-grade').value = '';
  document.getElementById('onboarding-message').style.display = 'none';
}

export function hideOnboardingScreen() {
  const screen = document.getElementById('screen-onboarding');
  screen.style.display = 'none';
  screen.classList.remove('active');
  const nav = document.querySelector('.bottom-nav');
  if (nav) nav.style.display = 'flex';
}

function showMessage(text, isError = false) {
  const el = document.getElementById('onboarding-message');
  el.textContent = text;
  el.style.display = 'block';
  el.style.background = isError ? '#fff5f5' : '#e8f5e9';
  el.style.color = isError ? '#c62828' : '#2e7d32';
}

export async function submit() {
  const name = document.getElementById('onboarding-name').value.trim();
  const grade = document.getElementById('onboarding-grade').value;
  if (!name) return showMessage('名前を入力してください', true);
  if (!grade) return showMessage('学年を選択してください', true);

  try {
    const player = await players.createPlayer({ name, grade });
    playerState.setCurrentPlayerId(player.id);
    hideOnboardingScreen();
    if (window.playerUI) await window.playerUI.refreshSwitcher();
    if (typeof window.renderMatches === 'function') window.renderMatches();
    if (typeof window.showScreen === 'function') window.showScreen('home');
  } catch (e) {
    showMessage(e.message || '登録に失敗しました', true);
  }
}

window.onboarding = { submit };
