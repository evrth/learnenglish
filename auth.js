// =============================================
//  auth.js — Supabase backend
//  ⚠️ THAY 2 DÒNG NÀY BẰNG THÔNG TIN CỦA BẠN
// =============================================
const SUPABASE_URL = 'https://qhommnmcwzrmwzqkjdzh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFob21tbm1jd3pybXd6cWtqZHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MzI3MTAsImV4cCI6MjA5NzQwODcxMH0.jtKyC7bm9RyqMOhLTOpSvQqGAon7OMU-ciUrJjIOjjs';

// ─── Supabase HTTP helper ─────────────────────
// Tương thích cả key format mới (sb_publishable_) và cũ (eyJ...)
async function sbFetch(path, method='GET', body=null) {
  const headers = {
    'Content-Type': 'application/json'
  };

  // Format key mới: sb_publishable_... dùng header khác
  if (SUPABASE_KEY.startsWith('sb_publishable_') || SUPABASE_KEY.startsWith('sb_secret_')) {
    headers['Authorization'] = 'Bearer ' + SUPABASE_KEY;
    headers['apikey'] = SUPABASE_KEY;
  } else {
    // Format key cũ: eyJ...
    headers['apikey'] = SUPABASE_KEY;
    headers['Authorization'] = 'Bearer ' + SUPABASE_KEY;
  }

  if (method === 'POST') headers['Prefer'] = 'resolution=merge-duplicates,return=minimal';
  if (method === 'PATCH') headers['Prefer'] = 'return=minimal';

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error ${res.status}: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ─── Account helpers ─────────────────────────
async function getAccount(username) {
  const rows = await sbFetch(
    `accounts?username=eq.${encodeURIComponent(username)}&select=*`
  );
  return rows && rows[0] ? rows[0] : null;
}
async function getAccountByEmail(email) {
  const rows = await sbFetch(
    `accounts?email=eq.${encodeURIComponent(email)}&select=*`
  );
  return rows && rows[0] ? rows[0] : null;
}
async function saveAccount(username, passHash, email) {
  await sbFetch('accounts', 'POST', {
    username,
    pass_hash: passHash,
    email
  });
}

// ─── User data helpers ────────────────────────
async function getUserDataRemote(username, key, def=null) {
  try {
    const rows = await sbFetch(
      `user_data?username=eq.${encodeURIComponent(username)}&key=eq.${encodeURIComponent(key)}&select=value`
    );
    const result = (rows && rows[0] && rows[0].value !== undefined) ? rows[0].value : def;
    console.log(`[ListenUp] GET ${key}:`, Array.isArray(result) ? result.length + ' items' : typeof result);
    return result;
  } catch(e) {
    console.error('[ListenUp] getUserDataRemote error:', key, e);
    return def;
  }
}
async function saveUserDataRemote(username, key, value) {
  console.log(`[ListenUp] SAVE ${key}:`, Array.isArray(value) ? value.length + ' items' : typeof value);
  // UPSERT: INSERT hoặc UPDATE nếu (username, key) đã tồn tại
  const res = await fetch(SUPABASE_URL + '/rest/v1/user_data', {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({ username, key, value, updated_at: new Date().toISOString() })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('UPSERT error ' + res.status + ': ' + err);
  }
}

// ─── Session ──────────────────────────────────
const SESSION_KEY = 'lu_session';
const RESET_KEY   = 'lu_resets';
let currentUser   = null;

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}

// ─── Hash ─────────────────────────────────────
async function hashPass(pass) {
  const buf = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(pass + 'lu_salt_2024'));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2,'0')).join('');
}

// ─── INIT ─────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Kiểm tra config
  if (SUPABASE_URL === 'PASTE_YOUR_PROJECT_URL_HERE') {
    alert('⚠️ Chưa cấu hình Supabase URL trong auth.js!');
    return;
  }
  const session = getSession();
  if (session) {
    currentUser = session.username;
    bootApp();
  }
});

// ─── AUTH FORM UI ─────────────────────────────
function showAuthForm(form) {
  ['login','register','forgot'].forEach(f => {
    document.getElementById('form-'+f).classList.add('hidden');
    const t = document.getElementById('tab-'+f);
    if (t) t.classList.remove('active');
  });
  document.getElementById('form-'+form).classList.remove('hidden');
  const t = document.getElementById('tab-'+form);
  if (t) t.classList.add('active');
  clearAuthErrors();
}
function clearAuthErrors() {
  ['login-error','reg-error','forgot-error','forgot-msg'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); el.textContent = ''; }
  });
}
function showAuthError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

// ─── REGISTER ─────────────────────────────────
async function doRegister() {
  const username = document.getElementById('reg-user').value.trim().toLowerCase();
  const email    = document.getElementById('reg-email').value.trim().toLowerCase();
  const pass     = document.getElementById('reg-pass').value;
  const pass2    = document.getElementById('reg-pass2').value;

  if (!username) return showAuthError('reg-error','Nhập tên đăng nhập!');
  if (!/^[a-z0-9_]{3,20}$/.test(username))
    return showAuthError('reg-error','Username: 3-20 ký tự, chỉ dùng a-z, 0-9, _');
  if (!email||!email.includes('@'))
    return showAuthError('reg-error','Email không hợp lệ!');
  if (pass.length < 6)
    return showAuthError('reg-error','Mật khẩu ít nhất 6 ký tự!');
  if (pass !== pass2)
    return showAuthError('reg-error','Mật khẩu không khớp!');

  const regBtn = document.querySelector('#form-register .btn-auth');
  if (regBtn) { regBtn.disabled=true; regBtn.textContent='⏳ Đang tạo...'; }

  try {
    const existing = await getAccount(username);
    if (existing) {
      showAuthError('reg-error','Tên đăng nhập đã tồn tại!');
      return;
    }
    const existingEmail = await getAccountByEmail(email);
    if (existingEmail) {
      showAuthError('reg-error','Email này đã được dùng!');
      return;
    }

    const passHash = await hashPass(pass);
    await saveAccount(username, passHash, email);

    // Khởi tạo dữ liệu mặc định
    await Promise.all([
      saveUserDataRemote(username,'lessons',[]),
      saveUserDataRemote(username,'decks',[]),
      saveUserDataRemote(username,'reviews',[]),
      saveUserDataRemote(username,'progress',{
        listening:{}, flashcard:{}, speaking:{}, review:{},
        streak:{count:0,lastDate:null}, weak:{}
      })
    ]);

    toast('✅ Tài khoản đã tạo! Đang đăng nhập...');
    setTimeout(()=>loginAs(username), 800);
  } catch(e) {
    console.error('Register error:', e);
    showAuthError('reg-error','Lỗi: ' + (e.message||'Thử lại!'));
  } finally {
    if (regBtn) { regBtn.disabled=false; regBtn.textContent='Tạo tài khoản'; }
  }
}

// ─── LOGIN ────────────────────────────────────
async function doLogin() {
  const username = document.getElementById('login-user').value.trim().toLowerCase();
  const pass     = document.getElementById('login-pass').value;
  if (!username||!pass)
    return showAuthError('login-error','Nhập đầy đủ thông tin!');

  const loginBtn = document.querySelector('#form-login .btn-auth');
  if (loginBtn) { loginBtn.disabled=true; loginBtn.textContent='⏳ Đang đăng nhập...'; }

  try {
    const account = await getAccount(username);
    if (!account) {
      showAuthError('login-error','Tên đăng nhập không tồn tại!');
      return;
    }
    const passHash = await hashPass(pass);
    if (account.pass_hash !== passHash) {
      showAuthError('login-error','Sai mật khẩu!');
      return;
    }
    loginAs(username);
  } catch(e) {
    console.error('Login error:', e);
    showAuthError('login-error','Lỗi kết nối: ' + (e.message||'Thử lại!'));
  } finally {
    if (loginBtn) { loginBtn.disabled=false; loginBtn.textContent='Đăng nhập'; }
  }
}

function loginAs(username) {
  currentUser = username;
  localStorage.setItem(SESSION_KEY,
    JSON.stringify({username, loginAt:Date.now()}));
  bootApp();
}

// ─── LOGOUT ───────────────────────────────────
function doLogout() {
  if (!confirm('Đăng xuất?')) return;
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  location.reload();
}

// ─── FORGOT / RESET PASSWORD ──────────────────
async function doForgot() {
  const email = document.getElementById('forgot-email').value.trim().toLowerCase();
  if (!email||!email.includes('@'))
    return showAuthError('forgot-error','Email không hợp lệ!');
  try {
    const account = await getAccountByEmail(email);
    if (!account) { showForgotSent(email, null); return; }
    const code = Math.floor(100000+Math.random()*900000).toString();
    const resets = JSON.parse(localStorage.getItem(RESET_KEY)||'{}');
    resets[email] = {code, username:account.username, expiry:Date.now()+15*60*1000};
    localStorage.setItem(RESET_KEY, JSON.stringify(resets));
    showForgotSent(email, code);
  } catch(e) {
    showAuthError('forgot-error','Lỗi kết nối. Thử lại!');
  }
}
function showForgotSent(email, code) {
  const msgEl = document.getElementById('forgot-msg');
  msgEl.classList.remove('hidden');
  msgEl.innerHTML = code
    ? `Mã đặt lại:<br><span style="font-size:22px;font-weight:900;letter-spacing:4px">${code}</span><br><small style="color:#777">(Demo mode)</small>`
    : `Nếu email tồn tại, mã đã gửi đến ${email}.`;
  document.getElementById('reset-form').classList.remove('hidden');
}
async function doReset() {
  const email   = document.getElementById('forgot-email').value.trim().toLowerCase();
  const code    = document.getElementById('reset-code').value.trim();
  const newPass = document.getElementById('reset-newpass').value;
  const errEl   = document.getElementById('forgot-error');

  if (!code||code.length!==6) {
    errEl.textContent='Nhập mã 6 chữ số!'; errEl.classList.remove('hidden'); return;
  }
  if (newPass.length<6) {
    errEl.textContent='Mật khẩu ít nhất 6 ký tự!'; errEl.classList.remove('hidden'); return;
  }
  const resets = JSON.parse(localStorage.getItem(RESET_KEY)||'{}');
  const r = resets[email];
  if (!r) { errEl.textContent='Không tìm thấy yêu cầu.'; errEl.classList.remove('hidden'); return; }
  if (Date.now()>r.expiry) { errEl.textContent='Mã đã hết hạn.'; errEl.classList.remove('hidden'); return; }
  if (r.code!==code) { errEl.textContent='Mã không đúng!'; errEl.classList.remove('hidden'); return; }

  try {
    const passHash = await hashPass(newPass);
    await sbFetch(
      `accounts?username=eq.${encodeURIComponent(r.username)}`,
      'PATCH',
      {pass_hash: passHash}
    );
    delete resets[email];
    localStorage.setItem(RESET_KEY, JSON.stringify(resets));
    toast('✅ Đặt lại mật khẩu thành công!');
    setTimeout(()=>showAuthForm('login'), 1000);
  } catch(e) {
    errEl.textContent='Lỗi kết nối. Thử lại!';
    errEl.classList.remove('hidden');
  }
}

// ─── BOOT APP ─────────────────────────────────
async function bootApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('header-username').textContent = '👤 ' + currentUser;

  // Loading overlay
  const loadDiv = document.createElement('div');
  loadDiv.id = 'app-loading';
  loadDiv.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:12px';
  loadDiv.innerHTML = '<div style="font-size:32px">⏳</div><div style="font-size:15px;font-weight:800;color:#58cc02">Đang tải dữ liệu...</div>';
  document.body.appendChild(loadDiv);

  try {
    await loadAll();
  } catch(e) {
    console.error('loadAll error:', e);
  }

  document.getElementById('app-loading')?.remove();
  renderAll();
  initCreateForms();
}

// ─── LOAD / SAVE — async Supabase ─────────────
async function loadAll() {
  console.log('[ListenUp] loadAll() bắt đầu cho user:', currentUser);
  const [ls, dk, rv, pr] = await Promise.all([
    getUserDataRemote(currentUser,'lessons',[]),
    getUserDataRemote(currentUser,'decks',[]),
    getUserDataRemote(currentUser,'reviews',[]),
    getUserDataRemote(currentUser,'progress',{})
  ]);
  lessons  = Array.isArray(ls) ? ls : [];
  decks    = Array.isArray(dk) ? dk : [];
  reviews  = Array.isArray(rv) ? rv : [];
  progress = (pr && typeof pr==='object') ? pr : {};
  if (!progress.listening) progress.listening = {};
  if (!progress.flashcard) progress.flashcard = {};
  if (!progress.speaking)  progress.speaking  = {};
  if (!progress.review)    progress.review    = {};
  if (!progress.streak)    progress.streak    = {count:0,lastDate:null};
  if (!progress.weak)      progress.weak      = {};
  console.log('[ListenUp] loadAll() xong →',
    'lessons:', lessons.length,
    '| decks:', decks.length,
    '| reviews:', reviews.length
  );
}

async function saveAll() {
  console.log('[ListenUp] saveAll() →',
    'lessons:', lessons.length,
    '| decks:', decks.length,
    '| reviews:', reviews.length
  );
  try {
    await Promise.all([
      saveUserDataRemote(currentUser,'lessons',lessons),
      saveUserDataRemote(currentUser,'decks',decks),
      saveUserDataRemote(currentUser,'reviews',reviews),
      saveUserDataRemote(currentUser,'progress',progress)
    ]);
    console.log('[ListenUp] saveAll() thành công ✅');
  } catch(e) {
    console.error('[ListenUp] saveAll() lỗi ❌', e);
  }
}

// Stub — không dùng nữa, dữ liệu load qua loadAll()
function getUserData(key, def=null) { return def; }
function saveUserData(key, val) {}
