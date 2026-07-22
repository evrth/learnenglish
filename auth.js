// =============================================
//  auth.js — ListenUp với Supabase
// =============================================
const SUPABASE_URL = 'https://qhommnmcwzrmwzqkjdzh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFob21tbm1jd3pybXd6cWtqZHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MzI3MTAsImV4cCI6MjA5NzQwODcxMH0.jtKyC7bm9RyqMOhLTOpSvQqGAon7OMU-ciUrJjIOjjs';

// ─── Supabase fetch helper ────────────────────
async function sbFetch(path, method, body) {
  method = method || 'GET';
  var headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
  };
  if (method === 'POST')  headers['Prefer'] = 'resolution=merge-duplicates,return=minimal';
  if (method === 'PATCH') headers['Prefer'] = 'return=minimal';
  var opts = { method: method, headers: headers };
  if (body) opts.body = JSON.stringify(body);
  var res = await fetch(SUPABASE_URL + '/rest/v1/' + path, opts);
  if (!res.ok) {
    var err = await res.text();
    throw new Error('Supabase ' + res.status + ': ' + err);
  }
  var text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ─── DB helpers ───────────────────────────────
async function dbGetAccount(username) {
  var rows = await sbFetch('accounts?username=eq.' + encodeURIComponent(username) + '&select=*');
  return rows && rows[0] ? rows[0] : null;
}
async function dbGetAccountByEmail(email) {
  var rows = await sbFetch('accounts?email=eq.' + encodeURIComponent(email) + '&select=*');
  return rows && rows[0] ? rows[0] : null;
}
async function dbSaveAccount(username, passHash, email) {
  await sbFetch('accounts', 'POST', { username: username, pass_hash: passHash, email: email });
}
async function dbGet(username, key, def) {
  try {
    var rows = await sbFetch('user_data?username=eq.' + encodeURIComponent(username) + '&key=eq.' + encodeURIComponent(key) + '&select=value');
    if (rows && rows[0] && rows[0].value !== undefined) return rows[0].value;
    return def;
  } catch(e) {
    console.error('[DB] GET error', key, e.message);
    return def;
  }
}
async function dbSet(username, key, value) {
  // Gọi Supabase RPC function upsert_user_data - tránh lỗi 409 duplicate key
  var res = await fetch(SUPABASE_URL + '/rest/v1/rpc/upsert_user_data', {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_username: username, p_key: key, p_value: value })
  });
  if (!res.ok) {
    var err = await res.text();
    throw new Error('dbSet RPC error ' + res.status + ': ' + err);
  }
}

// ─── Session ──────────────────────────────────
var SESSION_KEY = 'lu_session';
var RESET_KEY   = 'lu_resets';
var currentUser = null;

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch(e) { return null; }
}

// ─── Hash ─────────────────────────────────────
async function hashPass(pass) {
  var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass + 'lu_salt_2024'));
  return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
}

// ─── INIT ─────────────────────────────────────
window.addEventListener('DOMContentLoaded', function() {
  var session = getSession();
  if (session && session.username) {
    currentUser = session.username;
    bootApp();
  }
});

// ─── AUTH UI ──────────────────────────────────
function showAuthForm(form) {
  ['login','register','forgot'].forEach(function(f) {
    document.getElementById('form-'+f).classList.add('hidden');
    var t = document.getElementById('tab-'+f);
    if (t) t.classList.remove('active');
  });
  document.getElementById('form-'+form).classList.remove('hidden');
  var t = document.getElementById('tab-'+form);
  if (t) t.classList.add('active');
  clearAuthErrors();
}
function clearAuthErrors() {
  ['login-error','reg-error','forgot-error','forgot-msg'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); el.textContent = ''; }
  });
}
function showAuthError(id, msg) {
  var el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

// ─── REGISTER ─────────────────────────────────
async function doRegister() {
  var username = document.getElementById('reg-user').value.trim().toLowerCase();
  var email    = document.getElementById('reg-email').value.trim().toLowerCase();
  var pass     = document.getElementById('reg-pass').value;
  var pass2    = document.getElementById('reg-pass2').value;
  if (!username) return showAuthError('reg-error','Nhập tên đăng nhập!');
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return showAuthError('reg-error','Username: 3-20 ký tự, chỉ dùng a-z, 0-9, _');
  if (!email||!email.includes('@')) return showAuthError('reg-error','Email không hợp lệ!');
  if (pass.length < 6) return showAuthError('reg-error','Mật khẩu ít nhất 6 ký tự!');
  if (pass !== pass2) return showAuthError('reg-error','Mật khẩu không khớp!');
  var btn = document.querySelector('#form-register .btn-auth');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Đang tạo...'; }
  try {
    if (await dbGetAccount(username)) return showAuthError('reg-error','Tên đăng nhập đã tồn tại!');
    if (await dbGetAccountByEmail(email)) return showAuthError('reg-error','Email này đã được dùng!');
    var h = await hashPass(pass);
    await dbSaveAccount(username, h, email);
    await dbSet(username,'lessons',[]);
    await dbSet(username,'decks',[]);
    await dbSet(username,'reviews',[]);
    await dbSet(username,'progress',{listening:{},flashcard:{},speaking:{},review:{},streak:{count:0,lastDate:null},weak:{}});
    toast('✅ Tài khoản đã tạo! Đang đăng nhập...');
    setTimeout(function(){ loginAs(username); }, 800);
  } catch(e) {
    showAuthError('reg-error','Lỗi: ' + e.message);
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='Tạo tài khoản'; }
  }
}

// ─── LOGIN ────────────────────────────────────
async function doLogin() {
  var username = document.getElementById('login-user').value.trim().toLowerCase();
  var pass     = document.getElementById('login-pass').value;
  if (!username||!pass) return showAuthError('login-error','Nhập đầy đủ thông tin!');
  var btn = document.querySelector('#form-login .btn-auth');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Đang đăng nhập...'; }
  try {
    var account = await dbGetAccount(username);
    if (!account) return showAuthError('login-error','Tên đăng nhập không tồn tại!');
    var h = await hashPass(pass);
    if (account.pass_hash !== h) return showAuthError('login-error','Sai mật khẩu!');
    loginAs(username);
  } catch(e) {
    showAuthError('login-error','Lỗi kết nối: ' + e.message);
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='Đăng nhập'; }
  }
}

function loginAs(username) {
  currentUser = username;
  localStorage.setItem(SESSION_KEY, JSON.stringify({username:username, loginAt:Date.now()}));
  bootApp();
}

function doLogout() {
  if (!confirm('Đăng xuất?')) return;
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  location.reload();
}

// ─── FORGOT ───────────────────────────────────
async function doForgot() {
  var email = document.getElementById('forgot-email').value.trim().toLowerCase();
  if (!email||!email.includes('@')) return showAuthError('forgot-error','Email không hợp lệ!');
  try {
    var account = await dbGetAccountByEmail(email);
    if (!account) { showForgotSent(email, null); return; }
    var code = Math.floor(100000+Math.random()*900000).toString();
    var resets = JSON.parse(localStorage.getItem(RESET_KEY)||'{}');
    resets[email] = {code:code, username:account.username, expiry:Date.now()+15*60*1000};
    localStorage.setItem(RESET_KEY, JSON.stringify(resets));
    showForgotSent(email, code);
  } catch(e) { showAuthError('forgot-error','Lỗi kết nối. Thử lại!'); }
}
function showForgotSent(email, code) {
  var el = document.getElementById('forgot-msg');
  el.classList.remove('hidden');
  el.innerHTML = code
    ? 'Mã đặt lại:<br><span style="font-size:22px;font-weight:900;letter-spacing:4px">'+code+'</span>'
    : 'Nếu email tồn tại, mã đã gửi đến '+email+'.';
  document.getElementById('reset-form').classList.remove('hidden');
}
async function doReset() {
  var email   = document.getElementById('forgot-email').value.trim().toLowerCase();
  var code    = document.getElementById('reset-code').value.trim();
  var newPass = document.getElementById('reset-newpass').value;
  var errEl   = document.getElementById('forgot-error');
  if (!code||code.length!==6){ errEl.textContent='Nhập mã 6 chữ số!'; errEl.classList.remove('hidden'); return; }
  if (newPass.length<6){ errEl.textContent='Mật khẩu ít nhất 6 ký tự!'; errEl.classList.remove('hidden'); return; }
  var resets = JSON.parse(localStorage.getItem(RESET_KEY)||'{}');
  var r = resets[email];
  if (!r){ errEl.textContent='Không tìm thấy yêu cầu.'; errEl.classList.remove('hidden'); return; }
  if (Date.now()>r.expiry){ errEl.textContent='Mã đã hết hạn.'; errEl.classList.remove('hidden'); return; }
  if (r.code!==code){ errEl.textContent='Mã không đúng!'; errEl.classList.remove('hidden'); return; }
  try {
    var h = await hashPass(newPass);
    await sbFetch('accounts?username=eq.'+encodeURIComponent(r.username),'PATCH',{pass_hash:h});
    delete resets[email];
    localStorage.setItem(RESET_KEY,JSON.stringify(resets));
    toast('✅ Đặt lại mật khẩu thành công!');
    setTimeout(function(){ showAuthForm('login'); },1000);
  } catch(e){ errEl.textContent='Lỗi kết nối.'; errEl.classList.remove('hidden'); }
}

// ─── BOOT ─────────────────────────────────────
async function bootApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('header-username').textContent = '👤 '+currentUser;

  var ld = document.createElement('div');
  ld.id = 'app-loading';
  ld.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:10px';
  ld.innerHTML = '<div style="font-size:36px">⏳</div><div style="font-size:15px;font-weight:800;color:#58cc02">Đang tải dữ liệu...</div>';
  document.body.appendChild(ld);

  await loadAll();
  var ldEl = document.getElementById('app-loading');
  if (ldEl) ldEl.remove();
  renderAll();
}

// ─── LOAD / SAVE ──────────────────────────────
async function loadAll() {
  console.log('[ListenUp] loadAll →', currentUser);
  var results = await Promise.all([
    dbGet(currentUser,'lessons',[]),
    dbGet(currentUser,'decks',[]),
    dbGet(currentUser,'reviews',[]),
    dbGet(currentUser,'progress',{})
  ]);
  lessons  = Array.isArray(results[0]) ? results[0] : [];
  decks    = Array.isArray(results[1]) ? results[1] : [];
  reviews  = Array.isArray(results[2]) ? results[2] : [];
  progress = (results[3] && typeof results[3]==='object') ? results[3] : {};
  if (!progress.listening) progress.listening = {};
  if (!progress.flashcard) progress.flashcard = {};
  if (!progress.speaking)  progress.speaking  = {};
  if (!progress.review)    progress.review    = {};
  if (!progress.streak)    progress.streak    = {count:0,lastDate:null};
  if (!progress.weak)      progress.weak      = {};
  console.log('[ListenUp] loaded → lessons:'+lessons.length+' decks:'+decks.length+' reviews:'+reviews.length);
}

async function saveAll() {
  console.log('[ListenUp] saveAll → lessons:'+lessons.length+' decks:'+decks.length+' reviews:'+reviews.length);
  try {
    await Promise.all([
      dbSet(currentUser,'lessons',lessons),
      dbSet(currentUser,'decks',decks),
      dbSet(currentUser,'reviews',reviews),
      dbSet(currentUser,'progress',progress)
    ]);
    console.log('[ListenUp] saveAll ✅ thành công');
  } catch(e) {
    console.error('[ListenUp] saveAll ❌', e.message);
    toast('⚠️ Lỗi lưu dữ liệu: ' + e.message);
  }
}

// Stubs — không dùng nữa
function getUserData(key, def) { return def !== undefined ? def : null; }
function saveUserData(key, val) {}
