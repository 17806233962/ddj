/* ============================================================
 * 《一世仙途》界面层 v2.0
 * ------------------------------------------------------------
 * 只负责：开局选择、日志呈现、三选一交互、结局与仙途碑。
 * 所有概率与结算都在 engine.js 里，界面不做二次随机。
 * ============================================================ */
(function () {
  "use strict";

  const S = window.XIUXIAN_SCRIPT;
  const E = window.XIUXIAN_ENGINE;
  const $ = (id) => document.getElementById(id);

  const GRADE_NAME = { 1: "普通", 2: "罕见", 3: "史诗", 4: "传说" };
  const GRADE_W = { 1: 100, 2: 38, 3: 11, 4: 4 };
  const ATTR_KEYS = E.ATTR_KEYS;
  const TIER_NAME = E.TIER_NAME;

  const SURNAMES = "林萧叶顾沈云苏楚洛秦谢陆白慕燕";
  const GIVEN = ["青尘", "无涯", "惊鸿", "若愚", "听雨", "斩秋", "望舒", "承影", "怀瑾", "孤舟", "拂雪", "归远", "知白", "照夜", "长歌", "静笃"];

  const params = new URLSearchParams(location.search);
  const urlSeed = params.get("seed");
  const demo = params.get("demo");
  let lastSeed = urlSeed || null;

  let drawnTalents = [];
  let pickedTalents = [];
  let pickedPath = null;

  let game = null;
  let currentAction = null;
  let timer = null;
  let speed = 650;
  let paused = false;
  let auto = false;
  let stopAtFirstSpecial = false;
  let stopAtKind = null;

  /* ---------------- 小工具 ---------------- */
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
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
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function attr(s) { return esc(s); }

  /* ---------------- 仙途碑（本地收藏） ---------------- */
  const LS_KEY = "xiuxian.v2";
  function loadStore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const d = raw ? JSON.parse(raw) : null;
      return d && Array.isArray(d.unlocked) ? d : { unlocked: [], best: 0, runs: 0 };
    } catch (e) {
      return { unlocked: [], best: 0, runs: 0 };
    }
  }
  function saveStore(store) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch (e) { /* 无痕模式忽略 */ }
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
      if (got.size < S.ENDINGS.length) {
        wrap.innerHTML += `<span class="stchip">还有 ${S.ENDINGS.length - got.size} 种未发现</span>`;
      }
    }
    $("steleHint").textContent = `（已见 ${got.size} / ${S.ENDINGS.length}${store.best ? ` · 最高道评 ${store.best}` : ""}）`;
  }

  /* ---------------- 开局界面 ---------------- */
  $("randName").onclick = () => {
    $("nameInput").value = rnd([...SURNAMES]) + rnd(GIVEN);
    checkReady();
  };
  $("randName").onclick();

  function renderPaths() {
    const g = $("pathGrid");
    g.innerHTML = "";
    S.PATHS.forEach((p) => {
      const d = document.createElement("div");
      d.className = "pcard";
      d.innerHTML = `<div class="pname">${esc(p.name)}</div><div class="pdesc">${esc(p.desc)}</div>`;
      d.onclick = () => selectPath(p);
      g.appendChild(d);
    });
  }
  function selectPath(p) {
    pickedPath = p;
    [...document.querySelectorAll(".pcard")].forEach((x) => x.classList.remove("sel"));
    const idx = S.PATHS.indexOf(p);
    if (idx >= 0 && $("pathGrid").children[idx]) $("pathGrid").children[idx].classList.add("sel");
    checkReady();
  }

  function drawTalents() {
    const pool = [...S.TALENTS], got = [];
    while (got.length < 10 && pool.length) {
      const t = wpick(pool, (x) => GRADE_W[x.grade] || 1);
      got.push(t);
      pool.splice(pool.indexOf(t), 1);
    }
    drawnTalents = got;
    pickedTalents = [];
    const g = $("talentGrid");
    g.innerHTML = "";
    got.forEach((t) => {
      const d = document.createElement("div");
      d.className = `tcard g${t.grade}`;
      d.innerHTML = `<span class="grade">〔${GRADE_NAME[t.grade]}〕</span><div class="tname">${esc(t.name)}</div><div class="tdesc">${esc(t.desc)}</div>`;
      d.onclick = () => toggleTalent(t);
      g.appendChild(d);
    });
    $("talentHint").textContent = "已选 0 / 3";
    checkReady();
  }
  function toggleTalent(t) {
    if (pickedTalents.includes(t)) pickedTalents = pickedTalents.filter((x) => x !== t);
    else if (pickedTalents.length < 3) pickedTalents.push(t);
    [...document.querySelectorAll(".tcard")].forEach((x) => x.classList.remove("sel"));
    pickedTalents.forEach((p) => {
      const i = drawnTalents.indexOf(p);
      if (i >= 0 && $("talentGrid").children[i]) $("talentGrid").children[i].classList.add("sel");
    });
    $("talentHint").textContent = `已选 ${pickedTalents.length} / 3`;
    checkReady();
  }
  function checkReady() {
    const name = $("nameInput").value.trim();
    $("startBtn").disabled = !(name && pickedTalents.length === 3 && pickedPath);
  }
  $("drawBtn").onclick = drawTalents;
  $("nameInput").oninput = checkReady;

  renderPaths();
  renderStele();

  /* ---------------- 日志 ---------------- */
  function logEl() { return $("log"); }
  function scrollLog() { const l = logEl(); l.scrollTop = l.scrollHeight; }
  function addLog(yearInfo, title, text, cls) {
    const d = document.createElement("div");
    d.className = "entry" + (cls ? " " + cls : "");
    if (cls === "brk") {
      d.textContent = text;
    } else {
      let html = "";
      if (yearInfo) html += `<span class="yr">【${esc(yearInfo)}】</span>`;
      if (title) html += `<span class="et">${esc(title)}</span>`;
      html += esc(text).replace(/\n/g, "<br>");
      d.innerHTML = html;
    }
    logEl().appendChild(d);
    scrollLog();
  }
  function addLogAction(a) {
    if (a.cls === "brk" || a.kind === "stage") {
      addLog(null, null, a.text, "brk");
      return;
    }
    const d = document.createElement("div");
    d.className = "entry " + (a.cls || (a.kind === "fill" ? "fill" : ""));
    const year = a.age != null ? `${a.age}岁·${a.stage || ""}` : "";
    let html = "";
    if (year) html += `<span class="yr">【${esc(year)}】</span>`;
    if (a.title) html += `<span class="et">${esc(a.title)}</span>`;
    html += esc(a.text).replace(/\n/g, "<br>");
    if (a.tier && TIER_NAME[a.tier]) html += `<span class="badge ${a.tier}">${TIER_NAME[a.tier]}</span>`;
    if (a.effects) html += `<span class="fx">${esc(a.effects)}</span>`;
    d.innerHTML = html;
    logEl().appendChild(d);
    scrollLog();
  }

  /* ---------------- 状态栏 ---------------- */
  function renderStatus() {
    if (!game) return;
    const st = game.state;
    const stage = S.STAGES[Math.min(Math.max(0, st.stageIdx), S.STAGES.length - 1)];
    const stageName = st.stageIdx < 0 ? "未生" : stage.name;
    const chips = ATTR_KEYS.map((k) => `<span class="chip">${esc(k)} ${st.attrs[k] || 0}</span>`).join("");
    const autoChip = auto ? `<span class="chip auto">托管中</span>` : "";
    $("status").innerHTML =
      `<span><b>${esc(st.name)}</b></span><span>${esc(st.path ? st.path.name : "")}</span>` +
      `<span>境界 <b>${esc(stageName)}</b></span>` +
      `<span>年龄 <b>${st.age}</b> / 寿元 ${st.lifespan}</span>` +
      `<span class="chip">奇遇 ${st.stats.specials}</span>` + autoChip +
      `<span class="chip" title="本局命数">命数 #${st.seed}</span>` +
      `<span style="flex-basis:100%; display:flex; flex-wrap:wrap; gap:6px;">${chips}</span>`;
  }

  /* ---------------- 概率条 ---------------- */
  function oddsText(odds) {
    const map = {};
    (odds || []).forEach((o) => (map[o.tier] = o.pct));
    return `<div class="oprob">` +
      `<span class="g">上签 ${map.good || 0}%</span> · ` +
      `<span class="m">平 ${map.mid || 0}%</span> · ` +
      `<span class="b">下签 ${map.bad || 0}%</span></div>`;
  }
  function riskClass(risk) {
    if (risk === "凶险") return "bad";
    if (risk === "有险") return "mid";
    return "good";
  }
  function chanceText(o) {
    const pct = o.chancePct || Math.round((o.chance || 0) * 100);
    return `<div class="ochance">成功率 ${pct}%${o.cost ? ` · 耗 ${o.cost} 金铢（现有 ${game ? game.state.attrs["金铢"] : 0}）` : ""}</div>`;
  }

  /* ---------------- 三选一卡片 ---------------- */
  const KIND_TAG = {
    special: "特 殊 事 件",
    breakthrough: "破 境 之 法",
    event: "天 命 抉 择",
  };

  function clearChoice() {
    const old = logEl().querySelector(".choice.active");
    if (old) old.remove();
  }

  function renderChoice(a) {
    clearChoice();
    currentAction = a;
    const box = document.createElement("div");
    box.className = `choice active ${a.kind}`;
    const tag = KIND_TAG[a.kind] || "抉 择";
    const hint = a.meta && a.meta.hint ? a.meta.hint : "";
    const base = a.kind === "breakthrough" && a.meta && a.meta.baseChance
      ? `当前基础成功率 ${a.meta.baseChance}% · 不同破境之法各有修正`
      : "";
    box.innerHTML =
      `<div class="ctag">✦ ${tag} ✦</div>` +
      `<div class="ctitle">${esc(a.title)}</div>` +
      `<div class="ctext">${esc(a.text)}</div>` +
      (hint ? `<div class="chint">${esc(hint)}</div>` : "") +
      (base ? `<div class="chint">${esc(base)}</div>` : "");

    a.options.forEach((o, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opt";
      b.disabled = !!o.locked;
      let html = `<span class="olabel">${esc(o.label)}</span>`;
      if (a.kind === "special" || a.kind === "event") {
        html += `<span class="risk ${riskClass(o.risk)}">${esc(o.risk || "")}</span>`;
      }
      if (o.desc) html += `<div class="odesc">${esc(o.desc)}</div>`;
      if (a.kind === "breakthrough") html += chanceText(o);
      else if (o.odds) html += oddsText(o.odds);
      if (o.locked) html += `<div class="olock">${esc(o.lockText || "条件不足")}</div>`;
      html += `<div class="odesc" style="opacity:.6">${o.locked ? "未解锁" : "按 " + (i + 1) + " 抉择"}</div>`;
      b.innerHTML = html;
      b.onclick = () => { if (!o.locked) choose(i); };
      box.appendChild(b);
    });

    logEl().appendChild(box);
    scrollLog();
    if (auto) {
      const tip = document.createElement("div");
      tip.className = "thinking";
      tip.textContent = "托管中，天意正在替你抉择……";
      box.appendChild(tip);
      scheduleAuto(a);
    }
  }

  function scheduleAuto(a) {
    clearTimer();
    if (stopAtFirstSpecial && a.kind === "special") {
      auto = false;
      updateControls();
      renderStatus();
      const tip = logEl().querySelector(".choice.active .thinking");
      if (tip) tip.textContent = "【演示】天命已至，请择其一。";
      return;
    }
    if (stopAtKind && a.kind === stopAtKind) {
      auto = false;
      updateControls();
      renderStatus();
      const tip = logEl().querySelector(".choice.active .thinking");
      if (tip) tip.textContent = "【演示】请择其一。";
      return;
    }
    timer = setTimeout(() => {
      if (!auto || !game || !game.state.pending) return;
      choose(game.autoPick());
    }, 480);
  }

  /* ---------------- 结算呈现 ---------------- */
  function renderResult(res) {
    const d = document.createElement("div");
    d.className = `entry result ${res.tier || "mid"}`;
    let html = `<span class="yr">【${esc(res.age)}岁·${esc(res.stage)}】</span>`;
    if (res.title) html += `<span class="et">${esc(res.title)}</span>`;
    html += `<span class="pick">你选择了「${esc(res.label)}」</span>`;
    if (res.tier && TIER_NAME[res.tier]) html += `<span class="badge ${res.tier}">${TIER_NAME[res.tier]}</span>`;
    html += `<br>${esc(res.text).replace(/\n/g, "<br>")}`;
    if (res.effects) html += `<span class="fx">${esc(res.effects)}</span>`;
    if (res.roll != null) {
      let line = `天机 ${res.roll}`;
      if (res.chancePct) line += ` · 成功率 ${res.chancePct}%`;
      html += `<span class="fx">${esc(line)}</span>`;
    }
    d.innerHTML = html;
    logEl().appendChild(d);
    scrollLog();
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
    if (!game || paused) return;
    if (game.state.pending) {
      if (auto) scheduleAuto(currentAction || { kind: "special" });
      return;
    }
    const a = game.next();
    handleAction(a);
  }
  function handleAction(a) {
    if (!a) return;
    if (a.type === "ending") { showEnding(a.summary); return; }
    if (a.type === "choice") { renderChoice(a); return; }
    if (a.type === "wait") { return; }
    if (a.type === "error") { addLog(null, null, a.message, "fill"); schedule(speed); return; }
    if (a.type === "log") {
      addLogAction(a);
      renderStatus();
      const delay = a.kind === "fill" ? Math.max(120, speed * 0.55) : speed;
      schedule(delay);
      return;
    }
    schedule(speed);
  }

  function choose(idx) {
    if (!game || !game.state.pending) return;
    clearTimer();
    const res = game.resolve(idx);
    currentAction = null;
    clearChoice();
    if (res.type === "error") {
      addLog(null, null, res.message, "fill");
      schedule(0);
      return;
    }
    if (res.log) addLogAction(res.log);
    if (res.type === "ending") { showEnding(res.summary); return; }
    renderResult(res);
    renderStatus();
    schedule(res.kind === "breakthrough" ? speed * 1.15 : speed);
  }

  /* ---------------- 结局 ---------------- */
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

    $("endGrid").innerHTML = [
      ["终年", `${summary.age} 岁`],
      ["寿元", `${summary.lifespan} 载`],
      ["最终境界", summary.stageName],
      ["抉择次数", `${summary.stats.decisions} 次`],
      ["特色事件", `${summary.stats.specials} 次`],
      ["上签", `${summary.stats.good} 次`],
      ["平", `${summary.stats.mid} 次`],
      ["下签", `${summary.stats.bad} 次`],
    ].map(([k, v]) => `<div>${esc(k)}<b>${esc(v)}</b></div>`).join("");

    $("endFlags").innerHTML = summary.flags.length
      ? summary.flags.map((f) => `<span class="flag">${esc(f.name)}</span>`).join("")
      : `<span class="flag" style="opacity:.5">此身无牵</span>`;

    $("endUnlock").innerHTML =
      `${isNew ? "◆ 首次抵达此结局，已收录 · " : ""}仙途碑 ${store.unlocked.length} / ${S.ENDINGS.length}` +
      `　·　最高道评 ${store.best || 0}　·　第 ${store.runs} 世`;

    const hist = (summary.history || []).slice().reverse();
    $("endHist").innerHTML = hist.length
      ? hist.map((h) => {
          const tier = h.tier && TIER_NAME[h.tier] ? `<span class="badge ${h.tier}">${TIER_NAME[h.tier]}</span>` : "";
          return `<div class="hrow"><span>${h.age}岁·${esc(h.stage)}</span><span>${esc(h.title)} → <b>${esc(h.label)}</b>${tier}</span></div>`;
        }).join("")
      : `<div class="hrow"><span>此世</span><span>未曾留下抉择。</span></div>`;

    $("ending").classList.remove("hidden");
    renderStele();
  }

  /* ---------------- 控制 ---------------- */
  function updateControls() {
    $("pauseBtn").textContent = paused ? "继续" : "暂停";
    $("autoBtn").textContent = auto ? "托管中" : "托管";
    $("autoBtn").classList.toggle("on", auto);
    $("slowBtn").classList.toggle("on", speed === 900);
    $("fastBtn").classList.toggle("on", speed === 380);
    $("turboBtn").classList.toggle("on", speed === 110);
  }

  function togglePause() {
    if (!game || game.state.finished) return;
    paused = !paused;
    updateControls();
    if (paused) clearTimer();
    else if (game.state.pending) { if (auto) scheduleAuto(currentAction || { kind: "special" }); }
    else schedule(0);
  }
  function toggleAuto() {
    auto = !auto;
    updateControls();
    renderStatus();
    if (auto && game && game.state.pending) scheduleAuto(currentAction || { kind: "special" });
  }
  function setSpeed(ms) {
    speed = ms;
    updateControls();
  }

  $("pauseBtn").onclick = togglePause;
  $("autoBtn").onclick = toggleAuto;
  $("slowBtn").onclick = () => setSpeed(900);
  $("fastBtn").onclick = () => setSpeed(380);
  $("turboBtn").onclick = () => setSpeed(110);

  function backToSetup() {
    clearTimer();
    game = null;
    currentAction = null;
    paused = false;
    auto = false;
    stopAtFirstSpecial = false;
    stopAtKind = null;
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

  /* ---------------- 开始一局 ---------------- */
  function startGame(opts) {
    opts = opts || {};
    const seed = opts.seed != null ? opts.seed : (urlSeed != null ? urlSeed : (Math.random() * 4294967296) >>> 0);
    clearTimer();
    paused = false;
    auto = !!opts.auto;
    stopAtFirstSpecial = !!opts.stopAtFirstSpecial;
    stopAtKind = opts.stopAtKind || null;
    speed = opts.speed || 650;

    game = E.createGame({
      S,
      name: $("nameInput").value.trim() || "无名客",
      talentIds: pickedTalents.map((t) => t.id),
      pathId: pickedPath.id,
      seed,
    });
    lastSeed = game.seed;

    $("setup").classList.add("hidden");
    $("game").classList.remove("hidden");
    $("ending").classList.add("hidden");
    logEl().innerHTML = "";
    updateControls();

    const talentNames = pickedTalents.map((t) => t.name).join("、");
    addLog(null, null, `${game.state.name} · 命数 #${game.seed}　天赋〔${talentNames}〕 · 立志〔${pickedPath.name}〕`, "brk");
    addLogAction({ type: "log", kind: "fill", text: "故事开始。此后的每一次三选一，都会写下不同的天命。" });
    renderStatus();
    schedule(0);
  }
  $("startBtn").onclick = () => startGame({});

  /* ---------------- 键盘：1/2/3 抉择，空格暂停 ---------------- */
  document.addEventListener("keydown", (e) => {
    if (!$("ending").classList.contains("hidden")) return;
    if (e.key === " ") { e.preventDefault(); togglePause(); return; }
    if (!game || !game.state.pending) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) {
      const o = currentAction && currentAction.options[n - 1];
      if (o && !o.locked) choose(n - 1);
    }
  });

  /* ---------------- 演示 / 自动开局（便于截图与测试） ---------------- */
  function autoSetupForDemo() {
    $("nameInput").value = "云归客";
    drawTalents();
    if (drawnTalents.length >= 3) {
      pickedTalents = drawnTalents.slice(0, 3);
      pickedTalents.forEach((p) => {
        const i = drawnTalents.indexOf(p);
        if ($("talentGrid").children[i]) $("talentGrid").children[i].classList.add("sel");
      });
      $("talentHint").textContent = "已选 3 / 3";
    }
    selectPath(S.PATHS[0]);
    checkReady();
  }

  if (demo) {
    autoSetupForDemo();
    const seed = params.get("seed") || "20261026";
    if (demo === "ending") {
      startGame({ seed, auto: true, speed: 1 });
    } else if (demo === "breakthrough") {
      startGame({ seed, auto: true, speed: 1, stopAtKind: "breakthrough" });
    } else if (demo === "special" || demo === "choice") {
      startGame({ seed, auto: true, speed: 1, stopAtFirstSpecial: true });
    } else {
      startGame({ seed, auto: params.get("auto") === "1", speed: 1 });
    }
  } else if (params.get("auto") === "1") {
    // 直接托管：需要先手动选好开局，这里只把开关打开
    auto = true;
    updateControls();
  }

  /* ---------------- 调试出口 ---------------- */
  window.__XIUXIAN__ = {
    get game() { return game; },
    get state() { return game && game.state; },
    startGame,
    choose,
    pump,
    showEnding,
    setAuto: (v) => { auto = !!v; updateControls(); renderStatus(); },
    setSpeed,
  };
})();
