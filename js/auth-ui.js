import * as auth from './auth.js';

let mode = 'login';

export function showAuthScreen() {
  const splash = document.getElementById('splash');
  if (splash) splash.style.display = 'none';
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const authScreen = document.getElementById('screen-auth');
  authScreen.style.display = 'flex';
  authScreen.classList.add('active');
  const fab = document.getElementById('fab');
  if (fab) fab.style.display = 'none';
  const nav = document.querySelector('.bottom-nav');
  if (nav) nav.style.display = 'none';
  renderAuthForm();
}

export function hideAuthScreen() {
  const authScreen = document.getElementById('screen-auth');
  authScreen.style.display = 'none';
  authScreen.classList.remove('active');
  const nav = document.querySelector('.bottom-nav');
  if (nav) nav.style.display = 'flex';
}

function renderAuthForm() {
  const container = document.getElementById('auth-form-container');
  if (mode === 'verify-sent') {
    container.innerHTML = `
      <div style="text-align:center; padding:24px; background:#f9f9f9; border-radius:14px;">
        <div style="font-size:18px; font-weight:700; color:#1a1a2e; margin-bottom:8px;">確認メールを送りました</div>
        <div style="font-size:13px; color:#888; line-height:1.6;">メールアプリを開いて、リンクをクリックしてください。<br><br>届かない場合は<strong style="color:#e53935;">迷惑メールフォルダ</strong>をご確認ください。</div>
        <button onclick="authUI.setMode('login')" style="margin-top:16px; background:none; border:none; color:#e53935; font-weight:700; cursor:pointer;">ログイン画面に戻る</button>
      </div>
    `;
    return;
  }

  const isLogin = mode === 'login';
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <button onclick="authUI.handleGoogle()" style="padding:14px; background:#fff; border:1.5px solid #ddd; border-radius:12px; font-weight:600; font-size:15px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-family:inherit;">
        <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
        Google で続ける
      </button>
      <div style="display:flex; align-items:center; gap:12px; margin:8px 0; color:#aaa; font-size:12px;">
        <div style="flex:1; height:1px; background:#eee;"></div>
        または
        <div style="flex:1; height:1px; background:#eee;"></div>
      </div>
      <input id="auth-email" type="email" name="email" autocomplete="email" spellcheck="false" autocapitalize="off" placeholder="メールアドレス" style="padding:12px 14px; border:1.5px solid #e0e0e0; border-radius:10px; font-size:16px; outline:none; font-family:inherit;">
      <input id="auth-password" type="password" name="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" placeholder="パスワード（6文字以上）" style="padding:12px 14px; border:1.5px solid #e0e0e0; border-radius:10px; font-size:16px; outline:none; font-family:inherit;">
      <button onclick="authUI.${isLogin ? 'handleLogin' : 'handleSignup'}()" style="padding:14px; background:linear-gradient(135deg,#e53935,#c62828); color:#fff; border:none; border-radius:12px; font-weight:700; font-size:15px; cursor:pointer; font-family:inherit;">
        ${isLogin ? 'ログイン' : '新規登録'}
      </button>
      <button onclick="authUI.setMode('${isLogin ? 'signup' : 'login'}')" style="padding:8px; background:none; border:none; color:#666; font-size:13px; cursor:pointer; text-decoration:underline; font-family:inherit;">
        ${isLogin ? '新規登録はこちら' : 'すでにアカウントをお持ちの方'}
      </button>
      <div style="font-size:11px; color:#999; text-align:center; line-height:1.6;">
        登録・ログインすると<a href="/terms" style="color:#888;">利用規約</a>と<a href="/privacy" style="color:#888;">プライバシーポリシー</a>に<br>同意したものとみなされます
      </div>
    </div>
  `;
}

function showMessage(text, isError = false) {
  const el = document.getElementById('auth-message');
  el.textContent = text;
  el.style.display = 'block';
  el.style.background = isError ? '#fff5f5' : '#e8f5e9';
  el.style.color = isError ? '#c62828' : '#2e7d32';
}

function setMode(newMode) {
  mode = newMode;
  document.getElementById('auth-message').style.display = 'none';
  renderAuthForm();
}

async function handleSignup() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) return showMessage('メールとパスワードを入力してください', true);
  try {
    await auth.signUpWithEmail(email, password);
    setMode('verify-sent');
  } catch (e) {
    showMessage(translateError(e.message), true);
  }
}

async function handleLogin() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) return showMessage('メールとパスワードを入力してください', true);
  try {
    await auth.signInWithEmail(email, password);
  } catch (e) {
    showMessage(translateError(e.message), true);
  }
}

async function handleGoogle() {
  try { await auth.signInWithGoogle(); } catch (e) { showMessage(e.message, true); }
}

function translateError(msg) {
  if (msg.includes('Invalid login credentials')) return 'メールまたはパスワードが間違っています';
  if (msg.includes('Email not confirmed')) return 'メール確認が完了していません。受信メールのリンクをクリックしてください';
  if (msg.includes('User already registered')) return 'このメールは既に登録されています';
  if (msg.includes('Password should be at least 6')) return 'パスワードは6文字以上にしてください';
  return msg;
}

window.authUI = { setMode, handleSignup, handleLogin, handleGoogle };
