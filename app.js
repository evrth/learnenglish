// =============================================
//  app.js — Main application logic (Fixed)
// =============================================

// ─── STATE ───────────────────────────────────
let lessons  = [];
let decks    = [];
let reviews  = [];
let progress = {};
let speechSynth = window.speechSynthesis;
let voiceUS = null;

// ─── LOAD / SAVE ─────────────────────────────
// loadAll() và saveAll() được định nghĩa trong auth.js (async Supabase)
// app.js chỉ giữ state variables, auth.js quản lý I/O

function renderAll() {
  loadVoices();
  speechSynth.onvoiceschanged = loadVoices;
  renderLessonCards();
  renderReviewCards();
  renderDeckCards();
  renderSpeakingDecks();
  renderSavedLessons();
  renderSavedDecks();
  renderSavedReviews();
  initCreateForms();
}

// ─── VOICE ───────────────────────────────────
function loadVoices() {
  const voices = speechSynth.getVoices();
  const preferred = ['Samantha','Ava','Zira','Google US English','Microsoft Zira'];
  voiceUS = voices.find(v => preferred.some(n => v.name.includes(n)) && v.lang.startsWith('en-US'))
         || voices.find(v => v.lang === 'en-US')
         || voices.find(v => v.lang.startsWith('en'));
}

function speak(text, rate = 1.0) {
  speechSynth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang='en-US'; u.rate=rate; u.pitch=1.05; u.volume=1;
  if (voiceUS) u.voice = voiceUS;
  document.querySelectorAll('.btn-play').forEach(b=>b.classList.remove('playing'));
  speechSynth.speak(u);
}

function stopSpeech() { speechSynth.cancel(); }

// ─── TAB SWITCHING ───────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.add('hidden'));
  const tabEl = document.querySelector(`[data-tab="${tab}"]`);
  const contentEl = document.getElementById('tab-'+tab);
  if (tabEl) tabEl.classList.add('active');
  if (contentEl) contentEl.classList.remove('hidden');
  stopSpeech();
  if (tab==='progress')  renderProgressTab();
  if (tab==='flashcard') renderDeckCards();
  if (tab==='speaking')  renderSpeakingDecks();
  if (tab==='review')    renderReviewCards();
  if (tab==='practice')  renderLessonCards();
  if (tab==='create') {
    renderSavedLessons();
    renderSavedDecks();
    renderSavedReviews();
    initCreateForms();
    // default to listening subtab
    switchSubtab('listening');
  }
}

function switchSubtab(sub) {
  document.querySelectorAll('.subtab').forEach(t=>t.classList.remove('active'));
  ['listening','flashcard','review'].forEach(s=>{
    const el = document.getElementById('create-'+s);
    if (el) el.classList.add('hidden');
  });
  const activeTab = document.getElementById('sub-'+sub);
  if (activeTab) activeTab.classList.add('active');
  const activeContent = document.getElementById('create-'+sub);
  if (activeContent) activeContent.classList.remove('hidden');
}

function backToList(section) {
  stopSpeech();
  if (section==='practice') {
    document.getElementById('lesson-player').classList.add('hidden');
    currentLesson=null; renderLessonCards();
  } else if (section==='review') {
    document.getElementById('rv-player').classList.add('hidden');
    currentReview=null; renderReviewCards();
  } else if (section==='flashcard') {
    document.getElementById('fc-study').classList.add('hidden');
    currentDeck=null; renderDeckCards();
  } else if (section==='speaking') {
    document.getElementById('sp-practice').classList.add('hidden');
    spStopRecord(); currentSpDeck=null; renderSpeakingDecks();
  }
  document.getElementById('completion-modal').classList.add('hidden');
}

// ─── CREATE FORMS (dynamic rows) ─────────────
function initCreateForms() {
  const ll = document.getElementById('listen-sentences-list');
  const vl = document.getElementById('vocab-list');
  const rl = document.getElementById('review-pairs-list');
  if (ll && ll.children.length === 0) addListenSentence();
  if (vl && vl.children.length === 0) addVocabRow();
  if (rl && rl.children.length === 0) addReviewPair();
}

// LISTENING rows
function addListenSentence(val = '') {
  const list = document.getElementById('listen-sentences-list');
  if (!list) return;
  const idx = list.children.length;
  const row = document.createElement('div');
  row.className = 'dynamic-row';
  row.innerHTML = `
    <span class="row-num">${idx+1}</span>
    <input type="text" class="input-field row-input" placeholder="Nhập câu tiếng Anh..." value="${esc(val)}"/>
    <button class="btn-row-del" onclick="this.parentElement.remove();reindexRows('listen-sentences-list')">✕</button>`;
  list.appendChild(row);
}

function reindexRows(listId) {
  document.querySelectorAll(`#${listId} .row-num`).forEach((el,i)=>el.textContent=i+1);
}

// FLASHCARD vocab rows — tách 4 ô riêng biệt
function addVocabRow(w='', p='', m='', ex='') {
  const list = document.getElementById('vocab-list');
  if (!list) return;
  const idx = list.children.length;
  const row = document.createElement('div');
  row.className = 'dynamic-row vocab-row';
  row.innerHTML = `
    <span class="row-num">${idx+1}</span>
    <div class="vocab-inputs">
      <input type="text" class="input-field vi-word" placeholder="Từ vựng (VD: accomplish)" value="${esc(w)}"/>
      <input type="text" class="input-field vi-pos"  placeholder="Loại từ (verb / noun...)" value="${esc(p)}"/>
      <input type="text" class="input-field vi-mean" placeholder="Nghĩa tiếng Việt" value="${esc(m)}"/>
      <input type="text" class="input-field vi-ex"   placeholder="Ví dụ (không bắt buộc)" value="${esc(ex)}"/>
    </div>
    <button class="btn-row-del" onclick="this.parentElement.remove();reindexRows('vocab-list')">✕</button>`;
  list.appendChild(row);
}

// REVIEW pair rows
function addReviewPair(vi='', en='') {
  const list = document.getElementById('review-pairs-list');
  if (!list) return;
  const idx = list.children.length;
  const row = document.createElement('div');
  row.className = 'dynamic-row review-row';
  row.innerHTML = `
    <span class="row-num">${idx+1}</span>
    <div class="review-inputs">
      <input type="text" class="input-field rp-vi" placeholder="Câu tiếng Việt" value="${esc(vi)}"/>
      <input type="text" class="input-field rp-en" placeholder="Câu tiếng Anh (đáp án)" value="${esc(en)}"/>
    </div>
    <button class="btn-row-del" onclick="this.parentElement.remove();reindexRows('review-pairs-list')">✕</button>`;
  list.appendChild(row);
}

// ─── SAVE FUNCTIONS ──────────────────────────
function createLesson() {
  const name = document.getElementById('lesson-name').value.trim();
  if (!name) { toast('Nhập tên bài học!'); return; }
  const rows = document.querySelectorAll('#listen-sentences-list .row-input');
  const sentences = [...rows].map(r=>r.value.trim()).filter(Boolean);
  if (!sentences.length) { toast('Nhập ít nhất 1 câu!'); return; }
  lessons.push({ id: uid(), name, sentences, createdAt: dateStr() });
  saveAll().catch(console.error); renderSavedLessons(); renderLessonCards();
  document.getElementById('lesson-name').value = '';
  document.getElementById('listen-sentences-list').innerHTML = '';
  addListenSentence();
  toast(`✅ Đã lưu "${name}" (${sentences.length} câu)`);
}

function createDeck() {
  const name = document.getElementById('deck-name').value.trim();
  if (!name) { toast('Nhập tên bộ thẻ!'); return; }
  const rows = document.querySelectorAll('#vocab-list .vocab-row');
  const words = [...rows].map(r => ({
    word: r.querySelector('.vi-word').value.trim(),
    pos:  r.querySelector('.vi-pos').value.trim(),
    meaning: r.querySelector('.vi-mean').value.trim(),
    example: r.querySelector('.vi-ex').value.trim()
  })).filter(w=>w.word && w.meaning);
  if (!words.length) { toast('Nhập ít nhất 1 từ (cần có Từ vựng và Nghĩa)!'); return; }
  decks.push({ id: uid(), name, words, createdAt: dateStr() });
  saveAll().catch(console.error); renderSavedDecks(); renderDeckCards(); renderSpeakingDecks();
  document.getElementById('deck-name').value = '';
  document.getElementById('vocab-list').innerHTML = '';
  addVocabRow();
  toast(`✅ Đã lưu "${name}" (${words.length} từ)`);
}

function createReview() {
  const name = document.getElementById('review-name').value.trim();
  if (!name) { toast('Nhập tên bài review!'); return; }
  const rows = document.querySelectorAll('#review-pairs-list .review-row');
  const pairs = [...rows].map(r => ({
    vi: r.querySelector('.rp-vi').value.trim(),
    en: r.querySelector('.rp-en').value.trim()
  })).filter(p=>p.vi && p.en);
  if (!pairs.length) { toast('Nhập ít nhất 1 cặp câu!'); return; }
  reviews.push({ id: uid(), name, pairs, createdAt: dateStr() });
  saveAll().catch(console.error); renderSavedReviews(); renderReviewCards();
  document.getElementById('review-name').value = '';
  document.getElementById('review-pairs-list').innerHTML = '';
  addReviewPair();
  toast(`✅ Đã lưu "${name}" (${pairs.length} câu)`);
}

// ─── DELETE ──────────────────────────────────
function deleteLesson(id) {
  if (!confirm('Xoá bài này?')) return;
  lessons = lessons.filter(l=>l.id!==id);
  delete progress.listening[id];
  removeWeak('listening', id);
  saveAll().catch(console.error); renderSavedLessons(); renderLessonCards();
}
function deleteDeck(id) {
  if (!confirm('Xoá bộ thẻ này?')) return;
  decks = decks.filter(d=>d.id!==id);
  delete progress.flashcard[id]; delete progress.speaking[id];
  removeWeak('flashcard', id); removeWeak('speaking', id);
  saveAll().catch(console.error); renderSavedDecks(); renderDeckCards(); renderSpeakingDecks();
}
function deleteReview(id) {
  if (!confirm('Xoá bài review này?')) return;
  reviews = reviews.filter(r=>r.id!==id);
  delete progress.review[id];
  removeWeak('review', id);
  saveAll().catch(console.error); renderSavedReviews(); renderReviewCards();
}
function removeWeak(section, id) {
  if (!progress.weak) return;
  Object.keys(progress.weak).forEach(k => { if (k.startsWith(section+':'+id)) delete progress.weak[k]; });
}

// ─── RENDER SAVED LISTS ───────────────────────
function renderSavedLessons() {
  const el = document.getElementById('saved-lesson-list');
  if (!el) return;
  el.innerHTML = lessons.length ? lessons.map(l=>`
    <div class="saved-lesson-item">
      <div><div class="sl-name">${esc(l.name)}</div><div class="sl-meta">${l.sentences.length} câu · ${l.createdAt}</div></div>
      <button class="btn-delete" onclick="deleteLesson('${l.id}')">🗑</button>
    </div>`).join('') : '<p class="empty-list-text">Chưa có bài học nào.</p>';
}

function renderSavedDecks() {
  const el = document.getElementById('saved-deck-list');
  if (!el) return;
  el.innerHTML = decks.length ? decks.map(d=>`
    <div class="saved-lesson-item">
      <div><div class="sl-name">${esc(d.name)}</div><div class="sl-meta">${d.words.length} từ · ${d.createdAt}</div></div>
      <button class="btn-delete" onclick="deleteDeck('${d.id}')">🗑</button>
    </div>`).join('') : '<p class="empty-list-text">Chưa có bộ thẻ nào.</p>';
}

function renderSavedReviews() {
  const el = document.getElementById('saved-review-list');
  if (!el) return;
  el.innerHTML = reviews.length ? reviews.map(r=>`
    <div class="saved-lesson-item">
      <div><div class="sl-name">${esc(r.name)}</div><div class="sl-meta">${r.pairs.length} câu · ${r.createdAt}</div></div>
      <button class="btn-delete" onclick="deleteReview('${r.id}')">🗑</button>
    </div>`).join('') : '<p class="empty-list-text">Chưa có bài review nào.</p>';
}

// ═══════════════════════════════════════════
//  LISTENING
// ═══════════════════════════════════════════
let currentLesson=null, listenIndex=0;
let listenScore={correct:0,wrong:0,skipped:0};
let listenChecked={}, repeatMode=false;

function renderLessonCards() {
  const noEl=document.getElementById('no-lesson');
  const listEl=document.getElementById('lesson-list-section');
  const cardsEl=document.getElementById('lesson-cards');
  if (!noEl||!listEl||!cardsEl) return;
  if (!lessons.length) { noEl.classList.remove('hidden'); listEl.classList.add('hidden'); return; }
  noEl.classList.add('hidden'); listEl.classList.remove('hidden');
  cardsEl.innerHTML = lessons.map(l => {
    const p=progress.listening[l.id];
    const pct = p ? Math.round((p.correct||0)/(p.total||1)*100) : 0;
    return `<div class="lesson-card" onclick="startLesson('${l.id}')">
      <div class="lesson-card-info"><h3>${esc(l.name)}</h3><p>${l.sentences.length} câu · ${l.createdAt}</p></div>
      <div class="lesson-card-meta">${pctBadge(pct)}<span class="lesson-card-arrow">→</span></div>
    </div>`;
  }).join('');
}

function startLesson(id) {
  currentLesson=lessons.find(l=>l.id===id); if (!currentLesson) return;
  listenIndex=0; listenScore={correct:0,wrong:0,skipped:0}; listenChecked={}; repeatMode=false;
  document.getElementById('lesson-list-section').classList.add('hidden');
  document.getElementById('lesson-player').classList.remove('hidden');
  renderSentence(); updateListenScore();
}

function renderSentence() {
  if (!currentLesson) return;
  const total=currentLesson.sentences.length, i=listenIndex;
  document.getElementById('progress-fill').style.width=(Object.keys(listenChecked).length/total*100)+'%';
  document.getElementById('player-progress').textContent=`${i+1} / ${total}`;
  document.getElementById('player-lesson-title').textContent=currentLesson.name;
  document.getElementById('sentence-number').textContent=`Câu ${i+1}`;
  const inp=document.getElementById('answer-input');
  inp.value=''; inp.className='answer-input'; inp.disabled=false;
  const fb=document.getElementById('feedback'); fb.className='feedback hidden'; fb.innerHTML='';
  document.getElementById('btn-prev').disabled=i===0;
  document.getElementById('btn-next').textContent=i===total-1?'Hoàn thành ✓':'Tiếp →';
  setTimeout(()=>inp.focus(),80);
}

function playCurrent()     { if(currentLesson) speak(currentLesson.sentences[listenIndex],1.0); }
function playCurrentSlow() { if(currentLesson) speak(currentLesson.sentences[listenIndex],0.65); }
function toggleRepeat() {
  repeatMode=!repeatMode;
  document.getElementById('btn-repeat').classList.toggle('active',repeatMode);
  toast(repeatMode?'🔁 Bật lặp lại':'🔁 Tắt lặp lại');
  if(repeatMode) playCurrent();
}

function checkAnswer() {
  if (!currentLesson) return;
  const raw=document.getElementById('answer-input').value.trim();
  if (!raw) { toast('Nhập câu trả lời!'); return; }
  const original=currentLesson.sentences[listenIndex];
  const {isCorrect,score:pct,diffHtml}=compareAnswers(raw,original);
  const inp=document.getElementById('answer-input');
  const fb=document.getElementById('feedback');
  inp.disabled=true;
  if (isCorrect) {
    inp.classList.add('correct'); fb.className='feedback correct-fb';
    fb.innerHTML=`🎉 Chính xác! (${pct}%)`;
    if (!listenChecked[listenIndex]) { listenScore.correct++; listenChecked[listenIndex]='correct'; }
    removeWeakItem('listening', currentLesson.id, listenIndex);
  } else {
    inp.classList.add('wrong'); fb.className='feedback wrong-fb';
    fb.innerHTML=`❌ Chưa đúng (${pct}%)<div class="fb-answer">Đáp án đúng:</div><div class="original-text">${diffHtml}</div>`;
    if (!listenChecked[listenIndex]) { listenScore.wrong++; listenChecked[listenIndex]='wrong'; }
    addWeakItem('listening', currentLesson.id, listenIndex, currentLesson.sentences[listenIndex], null);
  }
  fb.classList.remove('hidden');
  saveListen(); updateListenScore();
}

function saveListen() {
  if (!currentLesson) return;
  progress.listening[currentLesson.id]={
    correct:listenScore.correct, wrong:listenScore.wrong, skipped:listenScore.skipped,
    total:currentLesson.sentences.length, lastAt:Date.now()
  };
  updateStreak(); saveAll().catch(console.error);
}

function showHint() {
  if (!currentLesson) return;
  const w=currentLesson.sentences[listenIndex].split(' ');
  toast('💡 '+w.map(x=>x[0]+'_'.repeat(Math.max(x.length-1,0))).join(' '));
}

function nextSentence() {
  if (!currentLesson) return; stopSpeech();
  if (!listenChecked[listenIndex]) { listenScore.skipped++; listenChecked[listenIndex]='skipped'; saveListen(); updateListenScore(); }
  if (listenIndex>=currentLesson.sentences.length-1) { showCompletion('listening'); return; }
  listenIndex++; renderSentence();
}
function prevSentence() { if(listenIndex===0)return; stopSpeech(); listenIndex--; renderSentence(); }
function handleKey(e) { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();checkAnswer();} }
function updateListenScore() {
  document.getElementById('score-correct').textContent=listenScore.correct;
  document.getElementById('score-wrong').textContent=listenScore.wrong;
  document.getElementById('score-skipped').textContent=listenScore.skipped;
}

// ═══════════════════════════════════════════
//  REVIEW — Word Arrangement
// ═══════════════════════════════════════════
let currentReview=null, rvIndex=0;
let rvScore={correct:0,wrong:0,skipped:0}, rvChecked={};
let rvSlots=[], rvBank=[];

function renderReviewCards() {
  const noEl=document.getElementById('rv-no-lesson');
  const listEl=document.getElementById('rv-list');
  const cardsEl=document.getElementById('rv-lesson-cards');
  if (!noEl||!listEl||!cardsEl) return;
  if (!reviews.length) { noEl.classList.remove('hidden'); listEl.classList.add('hidden'); return; }
  noEl.classList.add('hidden'); listEl.classList.remove('hidden');
  cardsEl.innerHTML = reviews.map(r => {
    const p=progress.review[r.id];
    const pct=p?Math.round((p.correct||0)/(p.total||1)*100):0;
    return `<div class="lesson-card" onclick="startReview('${r.id}')">
      <div class="lesson-card-info"><h3>${esc(r.name)}</h3><p>${r.pairs.length} câu · ${r.createdAt}</p></div>
      <div class="lesson-card-meta">${pctBadge(pct)}<span class="lesson-card-arrow">→</span></div>
    </div>`;
  }).join('');
}

function startReview(id) {
  currentReview=reviews.find(r=>r.id===id); if (!currentReview) return;
  rvIndex=0; rvScore={correct:0,wrong:0,skipped:0}; rvChecked={};
  document.getElementById('rv-list').classList.add('hidden');
  document.getElementById('rv-player').classList.remove('hidden');
  renderRVQuestion(); updateRVScore();
}

function renderRVQuestion() {
  if (!currentReview) return;
  const total=currentReview.pairs.length, i=rvIndex;
  document.getElementById('rv-progress-fill').style.width=(Object.keys(rvChecked).length/total*100)+'%';
  document.getElementById('rv-progress-badge').textContent=`${i+1} / ${total}`;
  document.getElementById('rv-lesson-title').textContent=currentReview.name;
  document.getElementById('rv-q-num').textContent=`Câu ${i+1}`;

  const pair=currentReview.pairs[i];
  document.getElementById('rv-vietnamese').textContent=pair.vi;

  const words=pair.en.split(/\s+/).filter(Boolean);
  const allWords=shuffle(words.map((w,j)=>({w:w.replace(/[.,!?;:]/g,''),punct:w.match(/[.,!?;:]$/)?w.slice(-1):'',id:'real_'+j})));
  
  rvSlots=[];
  rvBank=[...allWords];

  renderRVSlots();
  renderRVBank();

  const fb=document.getElementById('rv-feedback');
  fb.className='feedback hidden'; fb.innerHTML='';
  document.getElementById('rv-btn-prev').disabled=i===0;
  document.getElementById('rv-btn-next').textContent=i===total-1?'Hoàn thành ✓':'Tiếp →';
}

function renderRVSlots() {
  const el=document.getElementById('rv-answer-slots');
  if (!el) return;
  el.innerHTML='';
  const filledSlots=rvSlots.filter(s=>s!==null);
  filledSlots.forEach((item,i)=>{
    const chip=document.createElement('div');
    chip.className='rv-word-chip rv-slot-chip';
    chip.textContent=item.w+(item.punct||'');
    chip.onclick=()=>rvReturnToBank(i, item);
    el.appendChild(chip);
  });
  if (rvBank.length > 0) {
    const empty=document.createElement('div');
    empty.className='rv-empty-slot';
    empty.textContent='...';
    el.appendChild(empty);
  }
}

function renderRVBank() {
  const el=document.getElementById('rv-word-bank');
  if (!el) return;
  el.innerHTML='';
  rvBank.forEach((item,i)=>{
    const chip=document.createElement('div');
    chip.className='rv-word-chip rv-bank-chip';
    chip.textContent=item.w+(item.punct||'');
    chip.onclick=()=>rvPlaceWord(i, item, chip);
    el.appendChild(chip);
  });
}

function rvPlaceWord(bankIdx, item, chipEl) {
  chipEl.classList.add('rv-chip-used');
  chipEl.onclick=null;
  rvSlots.push(item);
  rvBank.splice(bankIdx,1);
  renderRVSlots();
  renderRVBank();
}

function rvReturnToBank(slotIdx, item) {
  rvSlots.splice(slotIdx,1);
  rvBank.push(item);
  renderRVSlots();
  renderRVBank();
}

function rvClear() {
  const pair=currentReview.pairs[rvIndex];
  const words=pair.en.split(/\s+/).filter(Boolean);
  rvBank=shuffle(words.map((w,j)=>({w:w.replace(/[.,!?;:]/g,''),punct:w.match(/[.,!?;:]$/)?w.slice(-1):'',id:'real_'+j})));
  rvSlots=[];
  renderRVSlots(); renderRVBank();
  document.getElementById('rv-feedback').className='feedback hidden';
}

function rvHint() {
  if (!currentReview) return;
  const pair=currentReview.pairs[rvIndex];
  const words=pair.en.split(/\s+/);
  if (rvSlots.filter(Boolean).length===0 && words.length>0) {
    const first=rvBank.find(b=>b.id==='real_0')||rvBank[0];
    if (first) {
      const idx=rvBank.indexOf(first);
      rvSlots.push(first); rvBank.splice(idx,1);
      renderRVSlots(); renderRVBank();
      toast('💡 Đã đặt từ đầu tiên!');
    }
  } else {
    toast('💡 '+words.map(w=>w[0]).join(' _ '));
  }
}

function rvCheck() {
  if (!currentReview) return;
  const pair=currentReview.pairs[rvIndex];
  const answered=rvSlots.filter(Boolean).map(s=>(s.w+(s.punct||''))).join(' ').trim();
  const correct=pair.en.trim();
  const norm=s=>s.toLowerCase().replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim();
  const isOk=norm(answered)===norm(correct);
  const fb=document.getElementById('rv-feedback');
  if (isOk) {
    fb.className='feedback correct-fb'; fb.innerHTML=`🎉 Chính xác!`;
    if (!rvChecked[rvIndex]) { rvScore.correct++; rvChecked[rvIndex]='correct'; }
    removeWeakItem('review', currentReview.id, rvIndex);
  } else {
    fb.className='feedback wrong-fb';
    fb.innerHTML=`❌ Chưa đúng!<div class="fb-answer">Đáp án: <strong>${esc(correct)}</strong></div>`;
    if (!rvChecked[rvIndex]) { rvScore.wrong++; rvChecked[rvIndex]='wrong'; }
    addWeakItem('review', currentReview.id, rvIndex, pair.en, pair.vi);
  }
  fb.classList.remove('hidden');
  saveReviewProgress(); updateRVScore();
}

function saveReviewProgress() {
  if (!currentReview) return;
  progress.review[currentReview.id]={
    correct:rvScore.correct, wrong:rvScore.wrong, skipped:rvScore.skipped,
    total:currentReview.pairs.length, lastAt:Date.now()
  };
  updateStreak(); saveAll().catch(console.error);
}

function rvNext() {
  if (!currentReview) return; stopSpeech();
  if (!rvChecked[rvIndex]) { rvScore.skipped++; rvChecked[rvIndex]='skipped'; saveReviewProgress(); updateRVScore(); }
  if (rvIndex>=currentReview.pairs.length-1) { showCompletion('review'); return; }
  rvIndex++; renderRVQuestion();
}
function rvPrev() { if(rvIndex===0)return; rvIndex--; renderRVQuestion(); }
function updateRVScore() {
  document.getElementById('rv-correct').textContent=rvScore.correct;
  document.getElementById('rv-wrong').textContent=rvScore.wrong;
  document.getElementById('rv-skipped').textContent=rvScore.skipped;
}

// ═══════════════════════════════════════════
//  FLASHCARD
// ═══════════════════════════════════════════
let currentDeck=null, fcIndex=0, fcKnown={}, fcFlipped=false;
let quizData=[], quizIndex=0, quizScore={correct:0,wrong:0};

function renderDeckCards() {
  const noEl=document.getElementById('fc-no-deck');
  const listEl=document.getElementById('fc-deck-list');
  const cardsEl=document.getElementById('fc-deck-cards');
  if (!noEl||!listEl||!cardsEl) return;
  if (!decks.length) { noEl.classList.remove('hidden'); listEl.classList.add('hidden'); return; }
  noEl.classList.add('hidden'); listEl.classList.remove('hidden');
  cardsEl.innerHTML=decks.map(d=>{
    const p=progress.flashcard[d.id];
    const pct=p?Math.round((p.known||0)/(p.total||1)*100):0;
    return `<div class="lesson-card" onclick="startDeck('${d.id}')">
      <div class="lesson-card-info"><h3>${esc(d.name)}</h3><p>${d.words.length} từ · ${d.createdAt}</p></div>
      <div class="lesson-card-meta">${pctBadge(pct)}<span class="lesson-card-arrow">→</span></div>
    </div>`;
  }).join('');
}

function startDeck(id) {
  currentDeck=decks.find(d=>d.id===id); if (!currentDeck) return;
  fcIndex=0; fcKnown={}; fcFlipped=false;
  document.getElementById('fc-deck-list').classList.add('hidden');
  document.getElementById('fc-study').classList.remove('hidden');
  setFCMode('flip');
}

function setFCMode(mode) {
  document.querySelectorAll('.fc-mode-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('mode-'+mode).classList.add('active');
  ['flip','quiz','type'].forEach(m=>document.getElementById('fc-'+m+'-mode').classList.add('hidden'));
  document.getElementById('fc-'+mode+'-mode').classList.remove('hidden');
  fcIndex=0; fcFlipped=false;
  if (mode==='flip') renderFCCard();
  else if (mode==='quiz') initQuiz();
  else renderTypeCard();
}

function renderFCCard() {
  if (!currentDeck) return;
  const total=currentDeck.words.length, w=currentDeck.words[fcIndex];
  document.getElementById('fc-progress-fill').style.width=(Object.keys(fcKnown).length/total*100)+'%';
  document.getElementById('fc-progress-badge').textContent=`${fcIndex+1} / ${total}`;
  document.getElementById('fc-deck-title').textContent=currentDeck.name;
  document.getElementById('fc-word').textContent=w.word;
  document.getElementById('fc-pos').textContent=w.pos;
  document.getElementById('fc-meaning').textContent=w.meaning;
  document.getElementById('fc-example').textContent=w.example?`"${w.example}"`:'';;
  document.getElementById('fc-card').classList.remove('flipped'); fcFlipped=false;
  document.getElementById('fc-flip-actions').classList.add('hidden');
  setTimeout(()=>speak(w.word,1.0),400);
}

function flipCard() {
  if (!fcFlipped) {
    document.getElementById('fc-card').classList.add('flipped'); fcFlipped=true;
    document.getElementById('fc-flip-actions').classList.remove('hidden');
  }
}

function fcRate(known) {
  fcKnown[fcIndex]=known;
  if (!known) addWeakItem('flashcard', currentDeck.id, fcIndex, currentDeck.words[fcIndex].word, currentDeck.words[fcIndex].meaning);
  else removeWeakItem('flashcard', currentDeck.id, fcIndex);
  saveFCProgress();
  if (fcIndex>=currentDeck.words.length-1) { showCompletion('flashcard'); return; }
  fcIndex++; fcFlipped=false; renderFCCard();
}

function saveFCProgress() {
  if (!currentDeck) return;
  const known=Object.values(fcKnown).filter(Boolean).length;
  progress.flashcard[currentDeck.id]={ known, unknown:Object.values(fcKnown).filter(v=>!v).length, total:currentDeck.words.length, lastAt:Date.now() };
  updateStreak(); saveAll().catch(console.error);
}

function initQuiz() {
  if (!currentDeck) return;
  quizData=shuffle([...currentDeck.words]); quizIndex=0; quizScore={correct:0,wrong:0};
  renderQuizQ();
}

function renderQuizQ() {
  const total=quizData.length;
  document.getElementById('fc-progress-fill').style.width=(quizIndex/total*100)+'%';
  document.getElementById('fc-progress-badge').textContent=`${quizIndex+1} / ${total}`;
  const q=quizData[quizIndex];
  document.getElementById('quiz-question').textContent=`"${q.meaning}" là từ gì?`;
  const opts=shuffle([q,...shuffle(currentDeck.words.filter(w=>w.word!==q.word)).slice(0,3)]);
  const fb=document.getElementById('quiz-feedback');
  fb.className='feedback hidden'; fb.innerHTML='';
  document.getElementById('btn-quiz-next').style.display='none';
  document.getElementById('quiz-options').innerHTML=opts.map(o=>
    `<button class="quiz-opt" onclick="selectQuizOpt(this,'${esc(o.word)}','${esc(q.word)}')">${esc(o.word)} <span style="font-size:12px;color:var(--text-2)">(${esc(o.pos)})</span></button>`
  ).join('');
}

function selectQuizOpt(btn, selected, correct) {
  document.querySelectorAll('.quiz-opt').forEach(b=>{b.disabled=true;});
  const fb=document.getElementById('quiz-feedback');
  if (selected===correct) {
    btn.classList.add('correct-opt'); fb.className='feedback correct-fb'; fb.innerHTML='🎉 Chính xác!'; quizScore.correct++;
    removeWeakItem('flashcard', currentDeck.id, quizIndex);
  } else {
    btn.classList.add('wrong-opt');
    document.querySelectorAll('.quiz-opt').forEach(b=>{ if(b.textContent.trim().startsWith(correct))b.classList.add('correct-opt'); });
    fb.className='feedback wrong-fb'; fb.innerHTML=`❌ Sai! Đáp án: <strong>${esc(correct)}</strong>`; quizScore.wrong++;
    const qi=currentDeck.words.findIndex(w=>w.word===correct);
    if(qi>=0) addWeakItem('flashcard',currentDeck.id,qi,correct,currentDeck.words[qi].meaning);
  }
  fb.classList.remove('hidden'); speak(correct,1.0); saveFCProgress();
  const btn2=document.getElementById('btn-quiz-next');
  btn2.style.display='block'; btn2.textContent=quizIndex>=quizData.length-1?'Xem kết quả ✓':'Tiếp →';
}

function nextQuizQ() {
  if (quizIndex>=quizData.length-1) { showCompletion('flashcard'); return; }
  quizIndex++; renderQuizQ();
}

function renderTypeCard() {
  if (!currentDeck) return;
  const total=currentDeck.words.length, w=currentDeck.words[fcIndex];
  document.getElementById('fc-progress-fill').style.width=(fcIndex/total*100)+'%';
  document.getElementById('fc-progress-badge').textContent=`${fcIndex+1} / ${total}`;
  document.getElementById('fc-type-meaning').textContent=w.meaning;
  document.getElementById('fc-type-pos').textContent=w.pos;
  const inp=document.getElementById('fc-type-input');
  inp.value=''; inp.className='answer-input'; inp.disabled=false;
  document.getElementById('fc-type-feedback').className='feedback hidden';
  document.getElementById('btn-type-next').textContent=fcIndex>=total-1?'Xem kết quả ✓':'Tiếp →';
  setTimeout(()=>inp.focus(),80);
}

function fcTypeCheck() {
  if (!currentDeck) return;
  const inp=document.getElementById('fc-type-input');
  const raw=inp.value.trim().toLowerCase(); if(!raw){toast('Nhập từ!');return;}
  const w=currentDeck.words[fcIndex];
  const fb=document.getElementById('fc-type-feedback');
  inp.disabled=true;
  if (raw===w.word.toLowerCase()) {
    inp.classList.add('correct'); fb.className='feedback correct-fb'; fb.innerHTML='🎉 Chính xác!';
    fcKnown[fcIndex]=true; removeWeakItem('flashcard',currentDeck.id,fcIndex);
  } else {
    inp.classList.add('wrong'); fb.className='feedback wrong-fb'; fb.innerHTML=`❌ Sai! Đáp án: <strong>${esc(w.word)}</strong>`;
    fcKnown[fcIndex]=false; addWeakItem('flashcard',currentDeck.id,fcIndex,w.word,w.meaning);
  }
  fb.classList.remove('hidden'); speak(w.word,1.0); saveFCProgress();
}

function fcTypeNext() { if(!currentDeck)return; if(fcIndex>=currentDeck.words.length-1){showCompletion('flashcard');return;} fcIndex++;renderTypeCard(); }
function fcTypePrev() { if(fcIndex===0)return; fcIndex--;renderTypeCard(); }
function fcTypeHint()  { if(!currentDeck)return; const w=currentDeck.words[fcIndex].word; toast('💡 '+w[0]+'_'.repeat(Math.max(w.length-1,0))); }

// ═══════════════════════════════════════════
//  SPEAKING
// ═══════════════════════════════════════════
let currentSpDeck=null, spIndex=0, spScore={great:0,ok:0,bad:0}, spResults={};
let recognition=null, isRecording=false;

function renderSpeakingDecks() {
  const noEl=document.getElementById('sp-no-deck');
  const listEl=document.getElementById('sp-deck-list');
  const cardsEl=document.getElementById('sp-deck-cards');
  if (!noEl||!listEl||!cardsEl) return;
  if (!decks.length) { noEl.classList.remove('hidden'); listEl.classList.add('hidden'); return; }
  noEl.classList.add('hidden'); listEl.classList.remove('hidden');
  cardsEl.innerHTML=decks.map(d=>{
    const p=progress.speaking[d.id];
    const scores=p&&p.scores?p.scores:[];
    const avg=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null;
    const badge=avg!==null?`<span class="card-badge ${avg>=80?'badge-green':avg>=50?'badge-blue':'badge-orange'}">🎤 ${avg}%</span>`:'';
    return `<div class="lesson-card" onclick="startSpeaking('${d.id}')">
      <div class="lesson-card-info"><h3>${esc(d.name)}</h3><p>${d.words.length} từ · ${d.createdAt}</p></div>
      <div class="lesson-card-meta">${badge}<span class="lesson-card-arrow">→</span></div>
    </div>`;
  }).join('');
}

function startSpeaking(id) {
  currentSpDeck=decks.find(d=>d.id===id); if(!currentSpDeck)return;
  spIndex=0; spScore={great:0,ok:0,bad:0}; spResults={};
  document.getElementById('sp-deck-list').classList.add('hidden');
  document.getElementById('sp-practice').classList.remove('hidden');
  renderSpWord(); updateSpScore();
}

function renderSpWord() {
  if (!currentSpDeck) return;
  const total=currentSpDeck.words.length, w=currentSpDeck.words[spIndex];
  document.getElementById('sp-progress-fill').style.width=(Object.keys(spResults).length/total*100)+'%';
  document.getElementById('sp-progress-badge').textContent=`${spIndex+1} / ${total}`;
  document.getElementById('sp-deck-title').textContent=currentSpDeck.name;
  document.getElementById('sp-word-num').textContent=`Từ ${spIndex+1}`;
  document.getElementById('sp-target-word').textContent=w.word;
  document.getElementById('sp-pos-badge').textContent=w.pos;
  document.getElementById('sp-meaning-text').textContent=w.meaning;
  document.getElementById('sp-result').classList.add('hidden');
  document.getElementById('btn-record').className='btn-record';
  document.getElementById('record-label').textContent='Nhấn để nói';
  document.getElementById('sp-wave').classList.remove('active');
  document.getElementById('sp-btn-prev').disabled=spIndex===0;
  document.getElementById('sp-btn-next').textContent=spIndex>=total-1?'Xem kết quả ✓':'Tiếp →';
  isRecording=false;
}

function spPlayReference()     { if(currentSpDeck)speak(currentSpDeck.words[spIndex].word,1.0); }
function spPlayReferenceSlow() { if(currentSpDeck)speak(currentSpDeck.words[spIndex].word,0.6); }

function spToggleRecord() { isRecording?spStopRecord():spStartRecord(); }

function spStartRecord() {
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if (!SR) { toast('Dùng Chrome để luyện speaking!'); return; }
  recognition=new SR(); recognition.lang='en-US'; recognition.continuous=false; recognition.interimResults=false;
  isRecording=true;
  document.getElementById('btn-record').classList.add('recording');
  document.getElementById('record-label').textContent='Đang nghe...';
  document.getElementById('sp-wave').classList.add('active');
  recognition.onresult=e=>{ const t=e.results[0][0].transcript.trim(), conf=e.results[0][0].confidence; spStopRecord(); analyzePronu(t,conf); };
  recognition.onerror=e=>{ spStopRecord(); toast(e.error==='not-allowed'?'⚠️ Cần cấp quyền mic!':'Thử lại!'); };
  recognition.onend=()=>{ if(isRecording)spStopRecord(); };
  recognition.start();
}

function spStopRecord() {
  isRecording=false;
  if(recognition){try{recognition.stop();}catch(e){}recognition=null;}
  document.getElementById('btn-record').classList.remove('recording');
  document.getElementById('record-label').textContent='Nhấn để nói';
  document.getElementById('sp-wave').classList.remove('active');
}

function analyzePronu(transcript, confidence) {
  if (!currentSpDeck) return;
  const target=currentSpDeck.words[spIndex].word.toLowerCase();
  const heard=transcript.toLowerCase().trim();
  const phones=getPhonemes(target), heardPhones=getPhonemes(heard);
  const phoneScores=scorePhonemes(phones,heardPhones);
  let base=phoneScores.reduce((s,p)=>s+p.score,0)/phoneScores.length*100;
  if(heard===target) base=Math.min(100,base+15);
  if(confidence) base=base*0.6+confidence*100*0.4;
  const finalScore=Math.min(100,Math.round(base));
  spResults[spIndex]=finalScore;
  if(!progress.speaking[currentSpDeck.id]) progress.speaking[currentSpDeck.id]={scores:[],total:0};
  const sp=progress.speaking[currentSpDeck.id];
  sp.scores.push(finalScore); sp.total=currentSpDeck.words.length; sp.lastAt=Date.now();
  if(finalScore>=80){ spScore.great++; removeWeakItem('speaking',currentSpDeck.id,spIndex); }
  else if(finalScore>=50){ spScore.ok++; addWeakItem('speaking',currentSpDeck.id,spIndex,currentSpDeck.words[spIndex].word,currentSpDeck.words[spIndex].meaning); }
  else { spScore.bad++; addWeakItem('speaking',currentSpDeck.id,spIndex,currentSpDeck.words[spIndex].word,currentSpDeck.words[spIndex].meaning); }
  updateStreak(); saveAll().catch(console.error); updateSpScore(); showSpResult(finalScore,phoneScores,heard);
}

function getPhonemes(word) {
  const clusters=[]; let buf='';
  for(const ch of word.replace(/[^a-z]/g,'')){ buf+=ch; if('aeiou'.includes(ch)&&buf.length>0){clusters.push(buf);buf='';} }
  if(buf)clusters.push(buf);
  return clusters.length?clusters:[word];
}

function scorePhonemes(tp,hp) {
  return tp.map((ph,i)=>{ const h=hp[i]||''; const s=similarity(ph,h); return {ph,score:s,level:s>=0.85?'great':s>=0.6?'ok':'bad'}; });
}

function similarity(a,b) {
  const m=a.length,n=b.length; if(!m&&!n)return 1;
  const dp=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);
  for(let j=0;j<=n;j++)dp[0][j]=j;
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++) dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return 1-dp[m][n]/Math.max(m,n);
}

function showSpResult(score,phoneScores,heard) {
  const el=document.getElementById('sp-result'); el.classList.remove('hidden');
  const circ=document.getElementById('sp-ring-circle');
  const color=score>=80?'#58cc02':score>=50?'#ff9600':'#ff4b4b';
  circ.style.stroke=color; circ.style.strokeDashoffset=213.6-(score/100)*213.6;
  document.getElementById('sp-score-pct').textContent=score+'%';
  document.getElementById('sp-score-pct').style.color=color;
  const lbl=document.getElementById('sp-score-label');
  lbl.textContent=score>=80?'Đạt ✅':score>=50?'Gần đạt 🟡':'Chưa đạt 🔴'; lbl.style.color=color;
  const target=currentSpDeck.words[spIndex].word;
  const chars=target.split(''); const cSize=Math.ceil(chars.length/Math.max(phoneScores.length,1));
  const segs=phoneScores.map((ps,i)=>({text:chars.slice(i*cSize,(i+1)*cSize).join(''),level:ps.level}));
  if(segs.length>0) segs[segs.length-1].text+=chars.slice(phoneScores.length*cSize).join('');
  document.getElementById('sp-phoneme-result').innerHTML=segs.map(s=>`<span class="ph-chip ph-${s.level}">${esc(s.text)}</span>`).join('');
  const tips={great:['Phát âm xuất sắc! 🎉','Rất chuẩn! Tiếp tục!','Tuyệt vời!'],ok:['Gần đúng rồi! 💪','Khá tốt, luyện thêm!','Nghe được!'],bad:['Nghe mẫu nhiều hơn nhé 📖','Thử lại sau khi nghe kỹ!','Đừng nản! 🔥']};
  const cat=score>=80?'great':score>=50?'ok':'bad';
  document.getElementById('sp-feedback-text').textContent=`Bạn nói: "${heard}" · `+tips[cat][Math.floor(Math.random()*3)];
}

function updateSpScore() {
  document.getElementById('sp-score-great').textContent=spScore.great;
  document.getElementById('sp-score-ok').textContent=spScore.ok;
  document.getElementById('sp-score-bad').textContent=spScore.bad;
}

function spNext() { if(!currentSpDeck)return; if(spIndex>=currentSpDeck.words.length-1){showCompletion('speaking');return;} spIndex++;renderSpWord(); }
function spPrev() { if(spIndex===0)return; spIndex--;renderSpWord(); }

// ═══════════════════════════════════════════
//  PROGRESS TAB
// ═══════════════════════════════════════════
function renderProgressTab() {
  // ── Stats grid ──
  const statsGrid = document.getElementById('stats-grid');
  if (statsGrid) {
    const totalFC=Object.values(progress.flashcard).reduce((s,p)=>s+(p.known||0),0);
    const totalFCAll=decks.reduce((s,d)=>s+d.words.length,0);
    const spScores=Object.values(progress.speaking).flatMap(p=>p.scores||[]);
    const avgSp=spScores.length?Math.round(spScores.reduce((a,b)=>a+b,0)/spScores.length):0;
    statsGrid.innerHTML=`
      <div class="stat-card"><span class="stat-icon">🎧</span><div class="stat-num">${Object.keys(progress.listening).length}</div><div class="stat-label">Bài nghe đã học</div></div>
      <div class="stat-card"><span class="stat-icon">🃏</span><div class="stat-num">${totalFC}/${totalFCAll}</div><div class="stat-label">Từ đã nhớ</div></div>
      <div class="stat-card"><span class="stat-icon">🎤</span><div class="stat-num">${avgSp}%</div><div class="stat-label">Phát âm TB</div></div>
      <div class="stat-card"><span class="stat-icon">🔥</span><div class="stat-num">${progress.streak.count}</div><div class="stat-label">Ngày liên tiếp</div></div>`;
  }

  // ── Streak ──
  const streakCard = document.getElementById('streak-card');
  if (streakCard) {
    const s=progress.streak;
    streakCard.innerHTML=`<div class="streak-flame">🔥</div><div class="streak-info"><h3>${s.count} ngày liên tiếp</h3><p>${s.lastDate?`Lần cuối: ${new Date(s.lastDate).toLocaleDateString('vi-VN')}`:'Bắt đầu học ngay!'}</p></div>`;
  }

  // ── Weak items ──
  renderWeakItems();

  // ── Per-section lists ──
  renderPSList('ps-listening-list', lessons, 'listening', p=>p?Math.round((p.correct||0)/(p.total||1)*100):0, 'ps-fill-green');
  renderPSList('ps-review-list', reviews, 'review', p=>p?Math.round((p.correct||0)/(p.total||1)*100):0, 'ps-fill-blue');
  renderPSList('ps-flashcard-list', decks, 'flashcard', p=>p?Math.round((p.known||0)/(p.total||1)*100):0, 'ps-fill-purple');
  renderPSSpeaking();
}

function renderPSList(elId, items, section, getPct, fillClass) {
  const el=document.getElementById(elId);
  if (!el) return;
  if (!items.length) { el.innerHTML='<div class="ps-empty">Chưa có dữ liệu</div>'; return; }
  el.innerHTML=items.map(item=>{
    const p=progress[section][item.id]; const pct=getPct(p);
    return `<div class="ps-item">
      <div class="ps-item-header"><span class="ps-item-name">${esc(item.name)}</span><span class="ps-item-pct">${pct}%</span></div>
      <div class="ps-bar"><div class="ps-fill ${fillClass}" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

function renderPSSpeaking() {
  const el=document.getElementById('ps-speaking-list');
  if (!el) return;
  if (!decks.length) { el.innerHTML='<div class="ps-empty">Chưa có dữ liệu</div>'; return; }
  el.innerHTML=decks.map(d=>{
    const p=progress.speaking[d.id]; const scores=p&&p.scores?p.scores:[];
    const avg=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0;
    const color=avg>=80?'#58cc02':avg>=50?'#ff9600':'#ff4b4b';
    return `<div class="ps-item">
      <div class="ps-item-header"><span class="ps-item-name">${esc(d.name)}</span><span class="ps-item-pct" style="color:${color}">${avg}%</span></div>
      <div class="ps-bar"><div class="ps-fill" style="width:${avg}%;background:${color}"></div></div>
    </div>`;
  }).join('');
}

// ─── WEAK ITEMS ────────────────────────────
function weakKey(section, id, idx) { return `${section}:${id}:${idx}`; }

function addWeakItem(section, id, idx, text, hint) {
  if (!progress.weak) progress.weak={};
  const k=weakKey(section,id,idx);
  if (!progress.weak[k]) progress.weak[k]={ section, id, idx, text, hint, addedAt:Date.now(), attempts:0 };
  else { progress.weak[k].text=text; progress.weak[k].hint=hint; progress.weak[k].attempts=(progress.weak[k].attempts||0)+1; }
  saveAll().catch(console.error);
}

function removeWeakItem(section, id, idx) {
  if (!progress.weak) return;
  delete progress.weak[weakKey(section,id,idx)];
  saveAll().catch(console.error);
}

function renderWeakItems() {
  const weak=progress.weak||{};
  const keys=Object.keys(weak);
  const weakSection=document.getElementById('weak-section');
  const weakItems=document.getElementById('weak-items');
  const weakCount=document.getElementById('weak-count');
  if (!weakSection) return;
  if (!keys.length) { weakSection.classList.add('hidden'); return; }
  weakSection.classList.remove('hidden');
  if (weakCount) weakCount.textContent=keys.length+' mục';
  if (!weakItems) return;
  weakItems.innerHTML=keys.map(k=>{
    const w=weak[k];
    const sectionLabel={listening:'🎧 Nghe',review:'🔀 Review',flashcard:'🃏 Flashcard',speaking:'🎤 Speaking'}[w.section]||w.section;
    const itemName=getItemName(w.section,w.id);
    return `<div class="weak-item" onclick="openWeakPractice('${k}')">
      <div class="weak-item-info">
        <span class="weak-item-tag">${sectionLabel}</span>
        <span class="weak-item-name">${esc(itemName)}</span>
        <span class="weak-item-text">${esc(w.text)}</span>
      </div>
      <button class="btn-weak-practice">Luyện lại →</button>
    </div>`;
  }).join('');
}

function getItemName(section, id) {
  if (section==='listening') return lessons.find(l=>l.id===id)?.name||'?';
  if (section==='flashcard') return decks.find(d=>d.id===id)?.name||'?';
  if (section==='speaking')  return decks.find(d=>d.id===id)?.name||'?';
  if (section==='review')    return reviews.find(r=>r.id===id)?.name||'?';
  return '?';
}

// ─── WEAK PRACTICE MODAL ──────────────────
function openWeakPractice(k) {
  const w=progress.weak[k]; if (!w) return;
  const modal=document.getElementById('weak-modal');
  const body=document.getElementById('weak-modal-body');
  const title=document.getElementById('weak-modal-title');
  if (!modal||!body||!title) return;
  modal.classList.remove('hidden');

  if (w.section==='listening') {
    const lesson=lessons.find(l=>l.id===w.id); if (!lesson) return;
    const sentence=lesson.sentences[w.idx]||'';
    title.textContent='🎧 Luyện nghe lại';
    body.innerHTML=`
      <div class="wm-section">
        <button class="btn-play" onclick="speak('${esc(sentence)}',1.0)" style="margin-bottom:12px">▶ Nghe câu</button>
        <label class="answer-label">Nhập câu tiếng Anh:</label>
        <textarea id="wm-input" class="answer-input" rows="3" placeholder="Gõ câu bạn vừa nghe..."></textarea>
        <div id="wm-fb" class="feedback hidden" style="margin-top:10px"></div>
        <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">
          <button class="btn-check" onclick="wmCheckListen('${k}','${esc(sentence)}')">Kiểm tra ✓</button>
        </div>
      </div>`;
  } else if (w.section==='flashcard') {
    const deck=decks.find(d=>d.id===w.id); if (!deck) return;
    const word=deck.words[w.idx];
    title.textContent='🃏 Ôn flashcard';
    body.innerHTML=`
      <div class="wm-section">
        <div style="text-align:center;margin-bottom:14px">
          <div style="font-size:13px;color:var(--text-2);margin-bottom:6px">${esc(word.meaning)} (${esc(word.pos)})</div>
        </div>
        <label class="answer-label">Nhập từ tiếng Anh:</label>
        <input type="text" id="wm-input" class="answer-input" style="padding:12px 14px" placeholder="Type the word..."/>
        <div id="wm-fb" class="feedback hidden" style="margin-top:10px"></div>
        <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">
          <button class="btn-check" onclick="wmCheckFC('${k}','${esc(word.word)}')">Kiểm tra ✓</button>
        </div>
      </div>`;
  } else if (w.section==='speaking') {
    const deck=decks.find(d=>d.id===w.id); if(!deck) return;
    const word=deck.words[w.idx];
    title.textContent='🎤 Luyện phát âm';
    body.innerHTML=`
      <div class="wm-section" style="text-align:center">
        <div class="sp-target-word" style="font-size:28px;margin-bottom:8px">${esc(word.word)}</div>
        <div style="font-size:13px;color:var(--text-2);margin-bottom:14px">${esc(word.meaning)}</div>
        <div style="display:flex;gap:8px;justify-content:center;margin-bottom:16px">
          <button class="btn-play" onclick="speak('${esc(word.word)}',1.0)">▶ Nghe mẫu</button>
        </div>
        <button class="btn-record" id="wm-record-btn" onclick="wmToggleRecord('${k}','${esc(word.word)}','${esc(word.meaning)}')">
          <span>🎤</span><span id="wm-record-label">Nhấn để nói</span>
        </button>
        <div id="wm-sp-result" style="margin-top:14px"></div>
      </div>`;
  } else if (w.section==='review') {
    const review=reviews.find(r=>r.id===w.id); if(!review) return;
    const pair=review.pairs[w.idx];
    title.textContent='🔀 Review lại câu';
    const words=shuffle(pair.en.split(/\s+/).filter(Boolean).map((word,j)=>({w:word.replace(/[.,!?;:]/g,''),punct:word.match(/[.,!?;:]$/)?word.slice(-1):'',id:j})));
    body.innerHTML=`
      <div class="wm-section">
        <div class="rv-vietnamese" style="margin-bottom:12px">${esc(pair.vi)}</div>
        <div class="rv-hint-text">Sắp xếp lại câu tiếng Anh:</div>
        <div id="wm-rv-slots" class="rv-answer-slots" style="min-height:48px;margin-top:8px"></div>
        <div id="wm-rv-bank" class="rv-word-bank" style="margin-top:10px"></div>
        <div id="wm-fb" class="feedback hidden" style="margin-top:10px"></div>
        <div style="display:flex;justify-content:space-between;margin-top:10px">
          <button class="btn-hint" onclick="wmRVClear(${JSON.stringify(JSON.stringify(words))})">🗑 Xoá</button>
          <button class="btn-check" onclick="wmRVCheck('${k}','${esc(pair.en)}')">Kiểm tra ✓</button>
        </div>
      </div>`;
    wmRVState={slots:[],bank:[...words]};
    wmRenderRV();
  }
}

let wmRVState={slots:[],bank:[]};
function wmRenderRV() {
  const slotsEl=document.getElementById('wm-rv-slots');
  const bankEl=document.getElementById('wm-rv-bank');
  if (!slotsEl||!bankEl) return;
  slotsEl.innerHTML=wmRVState.slots.map((item,i)=>`<div class="rv-word-chip rv-slot-chip" onclick="wmRVReturn(${i})">${esc(item.w+(item.punct||''))}</div>`).join('')+'<div class="rv-empty-slot">...</div>';
  bankEl.innerHTML=wmRVState.bank.map((item,i)=>`<div class="rv-word-chip rv-bank-chip" onclick="wmRVPlace(${i})">${esc(item.w+(item.punct||''))}</div>`).join('');
}
function wmRVPlace(i) { wmRVState.slots.push(wmRVState.bank.splice(i,1)[0]); wmRenderRV(); }
function wmRVReturn(i) { wmRVState.bank.push(wmRVState.slots.splice(i,1)[0]); wmRenderRV(); }
function wmRVClear(wordsJSON) { try{wmRVState={slots:[],bank:JSON.parse(wordsJSON)};wmRenderRV();}catch(e){} }
function wmRVCheck(k, correct) {
  const answered=wmRVState.slots.map(s=>s.w+(s.punct||'')).join(' ').trim();
  const norm=s=>s.toLowerCase().replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim();
  const fb=document.getElementById('wm-fb');
  if (norm(answered)===norm(correct)) {
    fb.className='feedback correct-fb'; fb.innerHTML='🎉 Chính xác! Đã xoá khỏi danh sách ôn.';
    delete progress.weak[k]; saveAll().catch(console.error);
    setTimeout(()=>{ closeWeakModal(); renderWeakItems(); },1500);
  } else {
    fb.className='feedback wrong-fb'; fb.innerHTML=`❌ Chưa đúng! Đáp án: <strong>${esc(correct)}</strong>`;
  }
  fb.classList.remove('hidden');
}

function wmCheckListen(k, sentence) {
  const inp=document.getElementById('wm-input'); const raw=inp.value.trim(); if(!raw){toast('Nhập câu!');return;}
  const {isCorrect,score:pct,diffHtml}=compareAnswers(raw,sentence);
  const fb=document.getElementById('wm-fb');
  if (isCorrect) {
    fb.className='feedback correct-fb'; fb.innerHTML=`🎉 Chính xác! (${pct}%) — Đã xoá khỏi danh sách ôn.`;
    delete progress.weak[k]; saveAll().catch(console.error);
    setTimeout(()=>{ closeWeakModal(); renderWeakItems(); },1500);
  } else {
    fb.className='feedback wrong-fb'; fb.innerHTML=`❌ Chưa đúng (${pct}%)<div class="fb-answer">Đáp án: </div><div class="original-text">${diffHtml}</div>`;
  }
  fb.classList.remove('hidden');
}

function wmCheckFC(k, word) {
  const inp=document.getElementById('wm-input'); const raw=inp.value.trim().toLowerCase(); if(!raw){toast('Nhập từ!');return;}
  const fb=document.getElementById('wm-fb');
  if (raw===word.toLowerCase()) {
    fb.className='feedback correct-fb'; fb.innerHTML='🎉 Chính xác! Đã xoá khỏi danh sách ôn.';
    delete progress.weak[k]; saveAll().catch(console.error);
    setTimeout(()=>{ closeWeakModal(); renderWeakItems(); },1500);
  } else {
    fb.className='feedback wrong-fb'; fb.innerHTML=`❌ Sai! Đáp án: <strong>${esc(word)}</strong>`;
  }
  fb.classList.remove('hidden');
}

let wmIsRecording=false, wmRecognition=null;
function wmToggleRecord(k, word, meaning) {
  if (wmIsRecording) { wmStopRecord(); return; }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if (!SR) { toast('Dùng Chrome!'); return; }
  wmRecognition=new SR(); wmRecognition.lang='en-US'; wmRecognition.continuous=false; wmRecognition.interimResults=false;
  wmIsRecording=true;
  document.getElementById('wm-record-btn').classList.add('recording');
  document.getElementById('wm-record-label').textContent='Đang nghe...';
  wmRecognition.onresult=e=>{
    const t=e.results[0][0].transcript.trim().toLowerCase();
    const conf=e.results[0][0].confidence;
    wmStopRecord();
    const phones=getPhonemes(word.toLowerCase()), hPhones=getPhonemes(t);
    const ps=scorePhonemes(phones,hPhones);
    let base=ps.reduce((s,p)=>s+p.score,0)/ps.length*100;
    if(t===word.toLowerCase())base=Math.min(100,base+15);
    if(conf)base=base*0.6+conf*100*0.4;
    const score=Math.min(100,Math.round(base));
    const color=score>=80?'#58cc02':score>=50?'#ff9600':'#ff4b4b';
    document.getElementById('wm-sp-result').innerHTML=`
      <div style="font-size:24px;font-weight:900;color:${color}">${score}%</div>
      <div style="font-size:13px;color:var(--text-2);margin-top:4px">${score>=80?'✅ Đạt':score>=50?'🟡 Gần đạt':'🔴 Chưa đạt'}</div>
      <div style="font-size:13px;margin-top:4px">Bạn nói: "${t}"</div>`;
    if (score>=80) {
      delete progress.weak[k]; saveAll().catch(console.error);
      setTimeout(()=>{ closeWeakModal(); renderWeakItems(); },1800);
    }
  };
  wmRecognition.onerror=()=>wmStopRecord();
  wmRecognition.onend=()=>{if(wmIsRecording)wmStopRecord();};
  wmRecognition.start();
}
function wmStopRecord() {
  wmIsRecording=false; if(wmRecognition){try{wmRecognition.stop();}catch(e){}wmRecognition=null;}
  const btn=document.getElementById('wm-record-btn'); if(btn)btn.classList.remove('recording');
  const lbl=document.getElementById('wm-record-label'); if(lbl)lbl.textContent='Nhấn để nói';
}

function closeWeakModal() {
  const modal=document.getElementById('weak-modal');
  if (modal) modal.classList.add('hidden');
  renderWeakItems();
}

function resetAllProgress() {
  if (!confirm('Xoá toàn bộ tiến độ?')) return;
  progress={listening:{},flashcard:{},speaking:{},review:{},streak:{count:0,lastDate:null},weak:{}};
  saveAll().catch(console.error); renderProgressTab(); toast('Đã xoá tiến độ.');
}

// ═══════════════════════════════════════════
//  COMPLETION
// ═══════════════════════════════════════════
let _completionSection='';
function showCompletion(section) {
  _completionSection=section; stopSpeech();
  let pct=0, emoji='🎉', body='';
  if (section==='listening') {
    pct=Math.round(listenScore.correct/currentLesson.sentences.length*100);
    body=`<strong>${pct}%</strong> chính xác<br>✅ ${listenScore.correct} | ❌ ${listenScore.wrong} | ⏭ ${listenScore.skipped}`;
  } else if (section==='review') {
    pct=Math.round(rvScore.correct/currentReview.pairs.length*100);
    body=`<strong>${pct}%</strong> chính xác<br>✅ ${rvScore.correct} | ❌ ${rvScore.wrong} | ⏭ ${rvScore.skipped}`;
  } else if (section==='flashcard') {
    const known=Object.values(fcKnown).filter(Boolean).length;
    pct=Math.round(known/(currentDeck?.words.length||1)*100);
    body=`<strong>${pct}%</strong> đã nhớ<br>😊 ${known} | 😕 ${(currentDeck?.words.length||0)-known}`;
  } else if (section==='speaking') {
    const vals=Object.values(spResults); pct=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0;
    body=`Điểm phát âm TB: <strong>${pct}%</strong><br>🏆 ${spScore.great} | 🟡 ${spScore.ok} | 🔴 ${spScore.bad}`;
  }
  emoji=pct>=90?'🏆':pct>=70?'🎯':pct>=50?'💪':'📖';
  document.getElementById('modal-icon').textContent=emoji;
  document.getElementById('modal-title').textContent='Hoàn thành!';
  document.getElementById('final-score').innerHTML=body;
  document.getElementById('modal-back-btn').onclick=()=>backToList(section);
  document.getElementById('completion-modal').classList.remove('hidden');
}

function modalRestart() {
  document.getElementById('completion-modal').classList.add('hidden');
  if (_completionSection==='listening'&&currentLesson) { listenIndex=0;listenScore={correct:0,wrong:0,skipped:0};listenChecked={};renderSentence();updateListenScore(); }
  else if (_completionSection==='review'&&currentReview) { rvIndex=0;rvScore={correct:0,wrong:0,skipped:0};rvChecked={};renderRVQuestion();updateRVScore(); }
  else if (_completionSection==='flashcard'&&currentDeck) setFCMode('flip');
  else if (_completionSection==='speaking'&&currentSpDeck) { spIndex=0;spScore={great:0,ok:0,bad:0};spResults={};renderSpWord();updateSpScore(); }
}

// ═══════════════════════════════════════════
//  STREAK & DIFF
// ═══════════════════════════════════════════
function updateStreak() {
  const today=new Date().toDateString();
  if (progress.streak.lastDate===today) return;
  const yest=new Date(Date.now()-86400000).toDateString();
  progress.streak.count=progress.streak.lastDate===yest?progress.streak.count+1:1;
  progress.streak.lastDate=today;
}

function compareAnswers(userInput, original) {
  const norm=s=>s.toLowerCase().replace(/['']/g,"'").replace(/[""]/g,'"').replace(/[^\w\s']/g,'').replace(/\s+/g,' ').trim();
  const uW=norm(userInput).split(' '), oW=norm(original).split(' ');
  const lcs=lcsLen(uW,oW), pct=Math.round(lcs/oW.length*100);
  const used={};uW.forEach(w=>{used[w]=(used[w]||0)+1;});
  const diffHtml=oW.map(w=>{
    if(used[w]>0){used[w]--;return `<span class="diff-correct">${esc(w)}</span>`;}
    return `<span class="diff-missing">${esc(w)}</span>`;
  }).join(' ');
  return {isCorrect:pct>=90,score:pct,diffHtml};
}

function lcsLen(a,b) {
  const m=a.length,n=b.length;
  const dp=Array.from({length:m+1},()=>new Array(n+1).fill(0));
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++) dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]);
  return dp[m][n];
}

// ─── UTILS ───────────────────────────────────
function shuffle(arr){return[...arr].sort(()=>Math.random()-.5);}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}
function dateStr(){return new Date().toLocaleDateString('vi-VN');}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function pctBadge(pct){
  if(!pct)return'';
  return pct>=80?`<span class="card-badge badge-green">✅ ${pct}%</span>`:
         `<span class="card-badge badge-blue">🔄 ${pct}%</span>`;
}
function toast(msg){
  const el=document.createElement('div'); el.className='toast'; el.textContent=msg;
  document.body.appendChild(el); setTimeout(()=>el.remove(),2700);
}

// ─── CSS cho vocab-row (inject nếu chưa có) ──
(function injectVocabStyles(){
  if (document.getElementById('vocab-row-style')) return;
  const style = document.createElement('style');
  style.id = 'vocab-row-style';
  style.textContent = `
    .vocab-row { align-items: flex-start !important; }
    .vocab-inputs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      flex: 1;
    }
    @media (max-width: 500px) {
      .vocab-inputs { grid-template-columns: 1fr; }
    }
    .vocab-inputs .input-field {
      margin: 0;
      font-size: 14px;
    }
    .vi-word { grid-column: 1 / 2; font-weight: 600; }
    .vi-pos  { grid-column: 2 / 3; }
    .vi-mean { grid-column: 1 / 2; }
    .vi-ex   { grid-column: 2 / 3; }
  `;
  document.head.appendChild(style);
})();
