/* ============================================================
 * 《一世仙途》界面层 v4.0
 * ------------------------------------------------------------
 * 开局只选天赋。门派/职业/正邪/道侣会在人生中对应的门槛出现；
 * 活不到那个境界，就没有那次选择。其余时间全自动。
 * ============================================================ */
(function () {
  "use strict";

  const S = window.XIUXIAN_SCRIPT;
  const E = window.XIUXIAN_ENGINE;
  const $ = (id) => document.getElementById(id);
  const ATTR_KEYS = E.ATTR_KEYS;
  const TIER_NAME = E.TIER_NAME;
  const GRADE_NAME = { 1: "普通", 2: "罕见", 3: "史诗", 4: "传说" };
  const GRADE_W = { 1: 100, 2: 38, 3: 11, 4: 4 };
  const SURNAMES = "林萧叶顾沈云苏楚洛秦谢陆白慕燕";
  const GIVEN = ["青尘", "无涯", "惊鸿", "若愚", "听雨", "斩秋", "望舒", "承影", "怀瑾", "孤舟", "拂雪", "归远", "知白", "照夜", "长歌", "静笃"];

  const params = new URLSearchParams(location.search);
  const urlSeed = params.get("seed");
  const demo = params.get("demo");

  let drawn = [];
  let selTalent = null;
  let game = null;
  let current = null;
  let timer = null;
  let speed = 550;
  let paused = false;

  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function wpick(items, wfn) {
    let sum = 0;
    for (const it of items) sum += Math.max(0, wfn(it));
    let r = Math.random() * sum;
    for (const it of items) {
      r -= Math.max(0, wfn(it));
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }

  /* ---------------- 仙途碑 ---------------- */
  const LS_KEY = "xiuxian.v4";
  function loadStore() {
    try {
      const d = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      return d && Array.isArray(d.unlocked) ? d : { unlocked: [], best: 0, runs: 0 };
    } catch (e) {
      return { unlocked: [], best: 0, runs: 0 };
    }
  }
  function saveStore(d) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
  }
  function renderStele() {
    const store = loadStore();
    const got = new Set(store.unlocked);
    const wrap = $("stele");
    wrap.innerHTML = "";
    if (!got.size) {
      wrap.innerHTML = `<span class="hint">碑上无名。走完一世，结局会记在这里。</span>`;
    } else {
      S.ENDINGS.filter((e) => got.has(e.id))
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .forEach((e) => {
          const d = document.createElement("span");
          d.className = "stchip got";
          d.textContent = e.name;
          d.title = e.desc;
          wrap.appendChild(d);
        });
      if (got.size < S.ENDINGS.length) wrap.innerHTML += `<span class="stchip">还有 ${S.ENDINGS.length - got.size} 种</span>`;
    }
    $("steleHint").textContent = `（已见 ${got.size} / ${S.ENDINGS.length}${store.best ? ` · 最高道评 ${store.best}` : ""}）`;
  }

  /* ---------------- 开局：只选天赋 ---------------- */
  function renderTalents() {
    const wrap = $("talentGrid");
    wrap.innerHTML = "";
    drawn.forEach((t) => {
      const d = document.createElement("div");
      d.className = "card g" + t.grade + (selTalent === t ? " sel" : "");
      d.innerHTML = `<span class="grade">〔${GRADE_NAME[t.grade]}〕</span>` +
        `<div class="name">${esc(t.name)}</div><div class="desc">${esc(t.desc)}</div>`;
      d.onclick = () => {
        selTalent = t;
        renderTalents();
        $("talentHint").textContent = "已选 1 / 1";
        checkReady();
      };
      wrap.appendChild(d);
    });
  }
  function drawTalents() {
    const pool = [...S.TALENTS], got = [];
    while (got.length < 3 && pool.length) {
      const t = wpick(pool, (x) => GRADE_W[x.grade] || 1);
      got.push(t);
      pool.splice(pool.indexOf(t), 1);
    }
    drawn = got;
    selTalent = null;
    $("talentHint").textContent = "已选 0 / 1";
    renderTalents();
    checkReady();
  }
  function checkReady() {
    $("startBtn").disabled = !($("nameInput").value.trim() && selTalent);
  }
  $("randName").onclick = () => {
    $("nameInput").value = rnd([...SURNAMES]) + rnd(GIVEN);
    checkReady();
  };
  $("randName").onclick();
  $("drawBtn").onclick = drawTalents;
  $("nameInput").oninput = checkReady;
  renderStele();

  /* ---------------- 日志 ---------------- */
  function addEntry(a) {
    const log = $("log");
    const d = document.createElement("div");
    if (a.cls === "brk" || a.kind === "stage") {
      d.className = "entry brk";
      d.textContent = a.text;
    } else {
      d.className = "entry " + (a.cls || a.kind || "");
      let html = "";
      if (a.age != null) html += `<span class="yr">【${a.age}岁·${esc(a.stage)}】</span>`;
      if (a.title) html += `<span class="et">${esc(a.title)}</span>`;
      html += esc(a.text).replace(/\n/g, "<br>");
      if (a.tier && TIER_NAME[a.tier]) html += `<span class="badge ${a.tier}">${TIER_NAME[a.tier]}</span>`;
      if (a.effects) html += `<span class="fx">${esc(a.effects)}</span>`;
      d.innerHTML = html;
    }
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  function renderStatus() {
    if (!game) return;
    const st = game.state;
    const stage = st.stageIdx < 0 ? "未生" : S.STAGES[Math.min(st.stageIdx, S.STAGES.length - 1)].name;
    const chips = ATTR_KEYS.map((k) => `<span class="chip">${esc(k)} ${st.attrs[k] || 0}</span>`).join("");
    const chosen = Object.values(st.scripts).join(" · ");
    $("status").innerHTML =
      `<span><b>${esc(st.name)}</b></span>` +
      `<span>境界 <b>${esc(stage)}</b></span>` +
      `<span>年龄 <b>${st.age}</b> / 寿元 ${st.lifespan}</span>` +
      `<span class="chip">奇遇 ${st.stats.specials}</span>` +
      (chosen ? `<span class="chip">${esc(chosen)}</span>` : "") +
      `<span class="chip">命数 #${st.seed}</span>` +
      `<span style="flex-basis:100%; display:flex; flex-wrap:wrap; gap:6px;">${chips}</span>`;
  }

  /* ---------------- 人生抉择（仅四道门槛） ---------------- */
  function clearChoice() {
    const old = $("log").querySelector(".choice.active");
    if (old) old.remove();
  }
  function renderChoice(a) {
    clearChoice();
    current = a;
    const box = document.createElement("div");
    box.className = "choice active";
    box.innerHTML = `<div class="ctag">✦ 人 生 抉 择 ✦</div>` +
      `<div class="ctitle">${esc(a.title)}</div>` +
      `<div class="ctext">${esc(a.text)}</div>`;
    a.options.forEach((o, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opt";
      b.innerHTML = `<span class="olabel">${esc(o.label)}</span>` +
        `<div class="odesc">${esc(o.desc)}</div>` +
        (o.effectsText ? `<div class="ofx">${esc(o.effectsText)}</div>` : "") +
        `<div class="odesc" style="opacity:.6">按 ${i + 1} 抉择</div>`;
      b.onclick = () => choose(i);
      box.appendChild(b);
    });
    $("log").appendChild(box);
    $("log").scrollTop = $("log").scrollHeight;
    clearTimer();
  }

  function choose(index) {
    if (!game || !game.state.pending) return;
    const res = game.resolve(index);
    current = null;
    clearChoice();
    if (res.type === "error") { addEntry({ kind: "fill", text: res.message }); return; }
    addEntry(res);
    renderStatus();
    schedule(speed);
  }

  /* ---------------- 主循环 ---------------- */
  function clearTimer() {
    if (timer) { clearTimeout(timer); timer = null; }
  }
  function schedule(ms) {
    clearTimer();
    if (paused) return;
    timer = setTimeout(pump, Math.max(0, ms));
  }
  function pump() {
    if (!game || paused || game.state.finished) return;
    if (game.state.pending) return;
    const a = game.next();
    if (a.type === "ending") {
      if (a.log) addEntry(a.log);
      showEnding(a.summary);
      return;
    }
    if (a.type === "choice") { renderChoice(a); return; }
    if (a.type === "log") {
      addEntry(a);
      renderStatus();
      schedule(a.kind === "fill" ? Math.max(100, speed * 0.55) : speed);
    }
  }

  function showEnding(summary) {
    if (!summary) return;
    clearTimer();
    const store = loadStore();
    let isNew = false;
    if (!store.unlocked.includes(summary.ending.id)) {
      store.unlocked.push(summary.ending.id);
      isNew = true;
    }
    const prevBest = store.best || 0;
    if (summary.score > prevBest) store.best = summary.score;
    store.runs = (store.runs || 0) + 1;
    saveStore(store);

    $("endName").textContent = summary.ending.name;
    $("endGrade").innerHTML = `道评 <b>${esc(summary.grade)}</b>　·　${summary.score} 点` +
      (summary.score > prevBest ? "　·　新纪录" : "") +
      (summary.failReason ? `　·　${esc(summary.failReason)}` : "");
    $("endDesc").textContent = summary.ending.desc;

    const st = summary.stats;
    $("endGrid").innerHTML = [
      ["终年", `${summary.age} 岁`],
      ["寿元", `${summary.lifespan} 载`],
      ["最终境界", summary.stageName],
      ["奇遇", `${st.specials} 次`],
      ["上签", `${st.good} 次`],
      ["平", `${st.mid} 次`],
      ["下签", `${st.bad} 次`],
      ["破境", `${st.breakthroughs} 次`],
    ].map(([k, v]) => `<div>${esc(k)}<b>${esc(v)}</b></div>`).join("");

    $("endFlags").innerHTML = summary.flags.length
      ? summary.flags.map((f) => `<span class="flag">${esc(f.name)}</span>`).join("")
      : `<span class="flag" style="opacity:.5">此身无牵</span>`;

    $("endUnlock").innerHTML =
      `${isNew ? "◆ 首次抵达此结局，已收录 · " : ""}仙途碑 ${store.unlocked.length} / ${S.ENDINGS.length}` +
      `　·　最高道评 ${store.best || 0}　·　第 ${store.runs} 世`;

    $("endChoices").innerHTML = (summary.choices || [])
      .map((c) => `<div>${esc(c.label)}　<b>${esc(c.name)}</b></div>`).join("");

    $("ending").classList.remove("hidden");
    renderStele();
  }

  /* ---------------- 控制 ---------------- */
  function updateControls() {
    $("pauseBtn").textContent = paused ? "继续" : "暂停";
    $("slowBtn").classList.toggle("on", speed === 900);
    $("fastBtn").classList.toggle("on", speed === 380);
    $("turboBtn").classList.toggle("on", speed === 100);
  }
  $("pauseBtn").onclick = () => {
    if (!game || game.state.finished) return;
    paused = !paused;
    updateControls();
    if (paused) clearTimer();
    else if (!game.state.pending) schedule(0);
  };
  $("slowBtn").onclick = () => { speed = 900; updateControls(); };
  $("fastBtn").onclick = () => { speed = 380; updateControls(); };
  $("turboBtn").onclick = () => { speed = 100; updateControls(); };

  function backToSetup() {
    clearTimer();
    game = null;
    current = null;
    paused = false;
    $("ending").classList.add("hidden");
    $("game").classList.add("hidden");
    $("setup").classList.remove("hidden");
    renderStele();
    updateControls();
    checkReady();
  }
  $("restartBtn").onclick = backToSetup;
  $("againBtn").onclick = backToSetup;
  $("sameSeedBtn").onclick = () => {
    if (!game) return;
    const seed = game.seed;
    $("ending").classList.add("hidden");
    startGame({ seed });
  };

  /* ---------------- 开始 ---------------- */
  function startGame(opts) {
    opts = opts || {};
    if (!selTalent) return;
    const seed = opts.seed != null ? opts.seed : (urlSeed != null ? urlSeed : (Math.random() * 4294967296) >>> 0);
    clearTimer();
    paused = false;
    speed = opts.speed || 550;

    game = E.createGame({
      S,
      name: $("nameInput").value.trim() || "无名客",
      talentId: selTalent.id,
      seed,
    });

    $("setup").classList.add("hidden");
    $("game").classList.remove("hidden");
    $("ending").classList.add("hidden");
    $("log").innerHTML = "";
    updateControls();

    addEntry({ cls: "brk", text: `${game.state.name} · 命数 #${game.seed}　天赋〔${selTalent.name}〕 · 门派、职业、正邪、道侣，会在你活到那一刻时出现` });
    renderStatus();
    schedule(0);
  }
  $("startBtn").onclick = () => startGame({});

  document.addEventListener("keydown", (e) => {
    if (!$("ending").classList.contains("hidden")) return;
    if (e.key === " ") { e.preventDefault(); $("pauseBtn").click(); return; }
    if (!game || !game.state.pending) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && current && n <= current.options.length) choose(n - 1);
  });

  /* ---------------- 演示 ---------------- */
  if (demo) {
    $("nameInput").value = "云归客";
    drawTalents();
    selTalent = drawn[0];
    renderTalents();
    checkReady();
    startGame({ seed: params.get("seed") || "20261027", speed: 1 });
  }

  window.__XIUXIAN__ = {
    get game() { return game; },
    get state() { return game && game.state; },
    startGame,
    choose,
    pump,
    setSpeed: (v) => { speed = v; updateControls(); },
  };
})();
