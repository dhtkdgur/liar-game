"use strict";
const KEY = "liar.v1";
const $app = document.getElementById("app");

const defaults = () => ({
  players: 5, liars: 1, mode: "normal", decoy: "similar", timer: 3, names: [],
  selected: DEFAULT_CATEGORIES.map(c => c.id)
});

const state = { screen: "home", s: defaults(), custom: [], game: null, edit: null, used: new Set() };

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw) {
      state.s = Object.assign(defaults(), raw.s);
      state.custom = Array.isArray(raw.custom) ? raw.custom : [];
    }
  } catch (e) { /* 저장소 사용 불가 시 기본값 */ }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ s: state.s, custom: state.custom })); } catch (e) { /* ignore */ }
}

const esc = t => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const allCats = () => [...DEFAULT_CATEGORIES, ...state.custom];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = n => Math.floor(Math.random() * n);
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const nameOf = i => (state.s.names[i] || "").trim() || `플레이어 ${i + 1}`;
const maxLiars = () => Math.max(1, state.s.players - 2);

function go(screen) { state.screen = screen; render(); window.scrollTo(0, 0); }

function parseWords(text) {
  const seen = new Set();
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const [w, d] = line.split(":");
    const word = (w || "").trim();
    if (!word || seen.has(word)) continue;
    seen.add(word);
    out.push({ word, decoy: (d || "").trim() });
  }
  return out;
}
const wordsToText = words => words.map(w => (w.decoy ? `${w.word}:${w.decoy}` : w.word)).join("\n");

function activeCats() {
  return allCats().filter(c => state.s.selected.includes(c.id) && c.words.length > 0);
}

function startGame() {
  const s = state.s;
  const cats = activeCats();
  if (!cats.length) return;
  let cat, item, tries = 0;
  do {
    cat = cats[rand(cats.length)];
    item = cat.words[rand(cat.words.length)];
    tries++;
  } while (state.used.has(cat.id + "|" + item.word) && tries < 60);
  if (tries >= 60) state.used.clear();
  state.used.add(cat.id + "|" + item.word);

  let decoy = s.decoy === "random" ? "" : item.decoy;
  if (!decoy || decoy === item.word) {
    const others = cat.words.filter(w => w.word !== item.word);
    decoy = others.length ? others[rand(others.length)].word : cat.name;
  }
  const liars = shuffle([...Array(s.players).keys()]).slice(0, s.liars).sort((a, b) => a - b);
  state.game = {
    cat: cat.name, word: item.word, decoy, fool: s.mode === "fool", liars,
    step: 0, shown: false, phase: "pass",
    first: rand(s.players), picks: [], guessShown: false, result: null, timerEnd: 0
  };
  go("reveal");
}

// ---------- 화면 ----------
function viewHome() {
  const s = state.s;
  const cats = activeCats();
  const names = Array.from({ length: s.players }, (_, i) =>
    `<input type="text" maxlength="8" data-name="${i}" placeholder="플레이어 ${i + 1}" value="${esc(s.names[i] || "")}">`).join("");
  return `
    <h1>라이어 게임</h1>
    <p class="sub">한 대의 폰을 돌려가며 즐기는 라이어 게임</p>
    <div class="card">
      <div class="row"><div class="label">참여 인원</div>
        <div class="stepper"><button class="sq" data-act="step" data-k="players" data-d="-1">−</button><b>${s.players}</b><button class="sq" data-act="step" data-k="players" data-d="1">+</button></div></div>
      <div class="row"><div class="label">라이어 인원<small>최대 ${maxLiars()}명</small></div>
        <div class="stepper"><button class="sq" data-act="step" data-k="liars" data-d="-1">−</button><b>${s.liars}</b><button class="sq" data-act="step" data-k="liars" data-d="1">+</button></div></div>
      <div class="row"><div class="label">토론 타이머<small>0이면 사용 안 함 (분)</small></div>
        <div class="stepper"><button class="sq" data-act="step" data-k="timer" data-d="-1">−</button><b>${s.timer}</b><button class="sq" data-act="step" data-k="timer" data-d="1">+</button></div></div>
    </div>
    <div class="card">
      <div class="row"><div class="label">게임 모드<small>${s.mode === "fool" ? "바보: 라이어가 다른 단어를 받고 자기가 라이어인지 모름" : "일반: 라이어는 제시어를 모름"}</small></div>
        <div class="seg"><button data-act="mode" data-v="normal" class="${s.mode === "normal" ? "on" : ""}">일반</button><button data-act="mode" data-v="fool" class="${s.mode === "fool" ? "on" : ""}">바보</button></div></div>
      ${s.mode === "fool" ? `<div class="row"><div class="label">라이어의 단어<small>${s.decoy === "random" ? "같은 카테고리에서 완전 랜덤" : "제시어와 비슷한 단어 (없으면 랜덤)"}</small></div>
        <div class="seg"><button data-act="decoy" data-v="similar" class="${s.decoy === "similar" ? "on" : ""}">비슷한</button><button data-act="decoy" data-v="random" class="${s.decoy === "random" ? "on" : ""}">랜덤</button></div></div>` : ""}
    </div>
    <div class="card">
      <details><summary>플레이어 이름 (선택)</summary><div class="names">${names}</div></details>
    </div>
    <button class="card row" data-act="goto" data-v="cats" style="width:100%;text-align:left">
      <div class="label">카테고리<small>${cats.length ? cats.map(c => esc(c.name)).slice(0, 4).join(", ") + (cats.length > 4 ? ` 외 ${cats.length - 4}개` : "") : "선택된 카테고리 없음"}</small></div>
      <span>${cats.length}개 선택 ›</span>
    </button>
    <div style="flex:1"></div>
    <button class="btn" data-act="start" ${cats.length ? "" : "disabled"}>게임 시작</button>`;
}

function viewCats() {
  const list = allCats().map(c => `
    <div class="card cat">
      <input type="checkbox" data-cat="${esc(c.id)}" ${state.s.selected.includes(c.id) ? "checked" : ""} aria-label="${esc(c.name)} 선택">
      <div class="grow"><b>${esc(c.name)}</b>${c.builtin ? "" : '<span class="tag">내 카테고리</span>'}<br><small>단어 ${c.words.length}개</small></div>
      ${c.builtin
        ? `<button class="btn sec small" data-act="clone" data-id="${esc(c.id)}">복제</button>`
        : `<button class="btn sec small" data-act="edit" data-id="${esc(c.id)}">편집</button>`}
    </div>`).join("");
  return `
    <div class="top"><button class="back" data-act="goto" data-v="home">‹</button><h2>카테고리</h2></div>
    <div class="row" style="gap:8px">
      <button class="btn sec small" style="flex:1" data-act="selall">전체 선택</button>
      <button class="btn sec small" style="flex:1" data-act="selnone">전체 해제</button>
    </div>
    ${list}
    <button class="btn blue" data-act="new">+ 새 카테고리 만들기</button>`;
}

function viewEdit() {
  const e = state.edit;
  return `
    <div class="top"><button class="back" data-act="goto" data-v="cats">‹</button><h2>${e.id ? "카테고리 편집" : "새 카테고리"}</h2></div>
    <div class="card"><div class="label" style="margin-bottom:8px">이름</div>
      <input type="text" id="e-name" maxlength="16" placeholder="예: 우리 학교, 회사 사람들" value="${esc(e.name)}"></div>
    <div class="card"><div class="label" style="margin-bottom:8px">키워드 (한 줄에 하나)</div>
      <textarea id="e-words" placeholder="사과&#10;바나나:망고&#10;김치찌개:된장찌개">${esc(e.text)}</textarea>
      <p class="hint">바보 모드용 연관 단어는 <b>제시어:연관단어</b> 처럼 콜론(:)으로 적어요. 생략하면 같은 카테고리의 다른 단어가 자동으로 쓰여요.</p></div>
    <button class="btn ok" data-act="saveedit">저장</button>
    ${e.id ? '<button class="danger" data-act="delcat">이 카테고리 삭제</button>' : ""}`;
}

function viewReveal() {
  const g = state.game;
  const i = g.step;
  const last = i === state.s.players - 1;
  if (g.phase === "pass") {
    return `<div class="center">
      <p class="sub">폰을 전달해 주세요</p>
      <div class="big">${esc(nameOf(i))}</div>
      <p class="sub">${i + 1} / ${state.s.players}</p>
      <p class="hint">다른 사람이 화면을 보지 못하게 해주세요</p>
    </div>
    <button class="btn" data-act="showcard">내 차례예요</button>`;
  }
  const isLiar = g.liars.includes(i);
  let body;
  if (!g.shown) {
    body = `<div class="flip" data-act="flip">카드를 눌러 확인</div>`;
  } else if (isLiar && !g.fool) {
    body = `<div class="flip shown liar"><span>카테고리: ${esc(g.cat)}</span><span class="liar-t">당신은 라이어!</span><span>제시어를 모른 채 들키지 마세요</span></div>`;
  } else {
    const w = isLiar ? g.decoy : g.word;
    body = `<div class="flip shown"><span>카테고리: ${esc(g.cat)}</span><span class="word">${esc(w)}</span></div>`;
  }
  return `<div class="center" style="justify-content:flex-start;padding-top:8px"><h2>${esc(nameOf(i))}</h2>${body}</div>
    <button class="btn" data-act="nextcard" ${g.shown ? "" : "disabled"}>${last ? "게임 시작" : "확인했어요, 다음 사람"}</button>`;
}

function viewPlay() {
  const g = state.game;
  const order = Array.from({ length: state.s.players }, (_, k) => (g.first + k) % state.s.players);
  return `
    <h2 style="text-align:center">토론 시작</h2>
    <div class="card" style="text-align:center"><small class="sub">카테고리</small><div class="big" style="font-size:28px">${esc(g.cat)}</div></div>
    ${state.s.timer > 0 ? `<div class="center" style="flex:0"><div class="timer" id="timer">--:--</div>
      <button class="btn sec small" data-act="timerreset">타이머 다시 시작</button></div>` : ""}
    <div class="card"><div class="label" style="margin-bottom:10px">힌트 말하는 순서</div>
      <ol class="order">${order.map(k => `<li>${esc(nameOf(k))}</li>`).join("")}</ol></div>
    <p class="hint" style="text-align:center">돌아가며 제시어를 직접 말하지 않고 한마디씩 힌트를 말해요.</p>
    <div style="flex:1"></div>
    <button class="btn" data-act="tovote">투표하기</button>`;
}

function viewVote() {
  const g = state.game;
  const need = state.s.liars;
  const grid = Array.from({ length: state.s.players }, (_, i) =>
    `<button class="pick ${g.picks.includes(i) ? "on" : ""}" data-act="pick" data-i="${i}">${esc(nameOf(i))}</button>`).join("");
  return `
    <h2 style="text-align:center">라이어는 누구?</h2>
    <p class="sub">토론 결과 가장 많은 표를 받은 ${need}명을 선택하세요 (${g.picks.length}/${need})</p>
    <div class="grid">${grid}</div>
    <div style="flex:1"></div>
    <button class="btn" data-act="confirmvote" ${g.picks.length === need ? "" : "disabled"}>지목 확정</button>`;
}

function viewGuess() {
  const g = state.game;
  return `<div class="center">
    <h2>라이어를 잡았어요!</h2>
    <p class="sub">${g.liars.map(i => esc(nameOf(i))).join(", ")} 님은<br>제시어를 소리 내어 맞혀보세요</p>
    ${g.guessShown ? `<div class="card" style="width:100%"><small class="sub">진짜 제시어</small><div class="big">${esc(g.word)}</div></div>` : ""}
  </div>
  ${g.guessShown
    ? `<button class="btn ok" data-act="guess" data-v="right">라이어가 맞혔다 (라이어 승)</button>
       <button class="btn sec" data-act="guess" data-v="wrong">못 맞혔다 (시민 승)</button>`
    : `<button class="btn" data-act="showanswer">정답 공개</button>`}`;
}

function viewResult() {
  const g = state.game;
  const r = g.result;
  const rows = Array.from({ length: state.s.players }, (_, i) =>
    `<div class="kv"><span>${esc(nameOf(i))}</span><span>${g.liars.includes(i) ? "라이어" : "시민"}${g.picks.includes(i) ? " · 지목됨" : ""}</span></div>`).join("");
  return `
    <div class="banner ${r.citizenWin ? "win" : "lose"}">${r.citizenWin ? "시민 승리!" : "라이어 승리!"}<small>${esc(r.reason)}</small></div>
    <div class="card">
      <div class="kv"><span>카테고리</span><span>${esc(g.cat)}</span></div>
      <div class="kv"><span>제시어</span><b>${esc(g.word)}</b></div>
      ${g.fool ? `<div class="kv"><span>라이어의 단어</span><span>${esc(g.decoy)}</span></div>` : ""}
    </div>
    <div class="card">${rows}</div>
    <div style="flex:1"></div>
    <button class="btn" data-act="again">같은 설정으로 다시 하기</button>
    <button class="btn sec" data-act="goto" data-v="home">처음으로</button>`;
}

let tickId = null;
function render() {
  clearInterval(tickId);
  const views = { home: viewHome, cats: viewCats, edit: viewEdit, reveal: viewReveal, play: viewPlay, vote: viewVote, guess: viewGuess, result: viewResult };
  $app.innerHTML = views[state.screen]();
  if (state.screen === "play" && state.s.timer > 0) startTimer();
}

function startTimer(reset) {
  const g = state.game;
  if (reset || !g.timerEnd) g.timerEnd = Date.now() + state.s.timer * 60000;
  const el = document.getElementById("timer");
  let buzzed = false;
  const tick = () => {
    const left = Math.max(0, Math.round((g.timerEnd - Date.now()) / 1000));
    el.textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
    el.classList.toggle("end", left === 0);
    if (left === 0 && !buzzed) {
      buzzed = true;
      if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
      clearInterval(tickId);
    }
  };
  tick();
  tickId = setInterval(tick, 250);
}

// ---------- 이벤트 ----------
$app.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.name !== undefined) {
    state.s.names[+t.dataset.name] = t.value;
    save();
  }
});

$app.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.cat) {
    const sel = state.s.selected;
    const i = sel.indexOf(t.dataset.cat);
    if (t.checked && i < 0) sel.push(t.dataset.cat);
    if (!t.checked && i >= 0) sel.splice(i, 1);
    save();
  }
});

function resolveVote() {
  const g = state.game;
  const caught = g.liars.length === g.picks.length && g.liars.every(i => g.picks.includes(i));
  if (!caught) {
    g.result = { citizenWin: false, reason: "라이어를 모두 찾아내지 못했어요" };
    go("result");
  } else {
    go("guess");
  }
}

$app.addEventListener("click", e => {
  const t = e.target.closest("[data-act]");
  if (!t || t.disabled) return;
  const s = state.s, g = state.game;
  switch (t.dataset.act) {
    case "goto": go(t.dataset.v); break;
    case "step": {
      const k = t.dataset.k, d = +t.dataset.d;
      if (k === "players") s.players = clamp(s.players + d, 3, 12);
      if (k === "liars") s.liars = clamp(s.liars + d, 1, maxLiars());
      if (k === "timer") s.timer = clamp(s.timer + d, 0, 10);
      s.liars = clamp(s.liars, 1, maxLiars());
      save(); render(); break;
    }
    case "mode": s.mode = t.dataset.v; save(); render(); break;
    case "decoy": s.decoy = t.dataset.v; save(); render(); break;
    case "selall": s.selected = allCats().map(c => c.id); save(); render(); break;
    case "selnone": s.selected = []; save(); render(); break;
    case "new": state.edit = { id: null, name: "", text: "" }; go("edit"); break;
    case "edit": {
      const c = state.custom.find(x => x.id === t.dataset.id);
      state.edit = { id: c.id, name: c.name, text: wordsToText(c.words) }; go("edit"); break;
    }
    case "clone": {
      const c = DEFAULT_CATEGORIES.find(x => x.id === t.dataset.id);
      state.edit = { id: null, name: c.name + " (내 것)", text: wordsToText(c.words) }; go("edit"); break;
    }
    case "saveedit": {
      const name = document.getElementById("e-name").value.trim();
      const words = parseWords(document.getElementById("e-words").value);
      if (!name) { alert("카테고리 이름을 입력해 주세요."); break; }
      if (words.length < 2) { alert("키워드를 2개 이상 입력해 주세요."); break; }
      const e = state.edit;
      if (e.id) {
        const c = state.custom.find(x => x.id === e.id);
        c.name = name; c.words = words;
      } else {
        const id = "c_" + Date.now().toString(36);
        state.custom.push({ id, name, words });
        s.selected.push(id);
      }
      save(); go("cats"); break;
    }
    case "delcat": {
      const id = state.edit.id;
      if (!confirm("이 카테고리를 삭제할까요?")) break;
      state.custom = state.custom.filter(x => x.id !== id);
      s.selected = s.selected.filter(x => x !== id);
      save(); go("cats"); break;
    }
    case "start": startGame(); break;
    case "showcard": g.phase = "card"; g.shown = false; render(); break;
    case "flip": g.shown = true; render(); break;
    case "nextcard":
      if (g.step >= s.players - 1) { go("play"); break; }
      g.step++; g.phase = "pass"; g.shown = false; render(); break;
    case "timerreset": startTimer(true); break;
    case "tovote": go("vote"); break;
    case "pick": {
      const i = +t.dataset.i;
      const p = g.picks.indexOf(i);
      if (p >= 0) g.picks.splice(p, 1); else if (g.picks.length < s.liars) g.picks.push(i);
      render(); break;
    }
    case "confirmvote": resolveVote(); break;
    case "showanswer": g.guessShown = true; render(); break;
    case "guess":
      g.result = t.dataset.v === "right"
        ? { citizenWin: false, reason: "라이어가 제시어를 맞혔어요" }
        : { citizenWin: true, reason: "라이어를 찾고 제시어도 못 맞혔어요" };
      go("result"); break;
    case "again": startGame(); break;
  }
});

load();
render();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
