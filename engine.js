/* ============================================================
 * 《一世仙途》推演引擎 v2.0
 * ------------------------------------------------------------
 * 纯逻辑、无 DOM 依赖，浏览器与 Node 均可运行。
 * 引擎不直接操作界面：调用方反复 next() 取事件，
 * 遇到 choice 时把三选一交给玩家，再用 resolve(index) 结算。
 *
 * 设计要点：
 *   1. 带种子的 PRNG，整局可复现，便于测试与分享“命数”。
 *   2. 每个选项自带独立概率分布，引擎只按权重掷骰。
 *   3. 玩家抉择：修行方针 / 破境之法 / 特色事件 / 旧事件抉择。
 *   4. 所有时间推进、寿元、结局判定集中在引擎内，UI 只负责呈现。
 * ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.XIUXIAN_ENGINE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ATTR_KEYS = ["悟性", "根骨", "心境", "机缘", "声望", "善恶", "金铢"];
  const TIER_NAME = { good: "上签", mid: "平", bad: "下签" };
  const TIER_ORDER = ["good", "mid", "bad"];

  /* ---------------- 随机数：可复现 ---------------- */
  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeSeed(input) {
    if (input === undefined || input === null || input === "") return (Math.random() * 4294967296) >>> 0;
    if (typeof input === "number" && isFinite(input)) return input >>> 0;
    return hashString(String(input));
  }

  /* ---------------- 条件与门槛 ---------------- */
  function parseCond(cond) {
    if (!cond) return null;
    const m = String(cond).match(/^(flag\s*:?)?\s*([^><=!\s]+)\s*(>=|<=|>|<|==)\s*(-?\d+)$/);
    if (!m) return null;
    return { isFlag: !!m[1], key: m[2], op: m[3], num: parseInt(m[4], 10) };
  }
  function compare(a, op, b) {
    return op === ">=" ? a >= b : op === "<=" ? a <= b : op === ">" ? a > b : op === "<" ? a < b : a === b;
  }
  function evalCond(st, cond) {
    const c = parseCond(cond);
    if (!c) return true;
    const v = c.isFlag ? st.flags[c.key] || 0 : st.attrs[c.key] || 0;
    return compare(v, c.op, c.num);
  }
  function reqInfo(st, req) {
    if (!req) return { ok: true, text: "" };
    const c = parseCond(req);
    if (!c) return { ok: true, text: "" };
    const v = c.isFlag ? st.flags[c.key] || 0 : st.attrs[c.key] || 0;
    const label = c.isFlag ? c.key : c.key;
    return {
      ok: compare(v, c.op, c.num),
      text: `需 ${label} ${c.op} ${c.num}`,
      current: v,
    };
  }

  /* ---------------- 效果结算 ---------------- */
  function clampAttr(key, v) {
    if (key === "金铢") return Math.max(0, v);
    return Math.max(-999, v);
  }
  function applyEffect(st, eff) {
    if (!eff) return {};
    const gained = {};
    // 兼容旧格式：{ 根骨: 1, flag孤星: 1 }
    const hasTyped = eff.attr || eff.flag || eff.lifespan !== undefined || eff.ending || eff.death;
    if (hasTyped) {
      if (eff.attr) {
        for (const [k, v] of Object.entries(eff.attr)) {
          st.attrs[k] = clampAttr(k, (st.attrs[k] || 0) + v);
          gained[k] = (gained[k] || 0) + v;
        }
      }
      if (eff.flag) {
        for (const [k, v] of Object.entries(eff.flag)) {
          st.flags[k] = (st.flags[k] || 0) + v;
          if (v > 0) gained[k] = (gained[k] || 0) + v;
        }
      }
      if (typeof eff.lifespan === "number") {
        st.lifespan = Math.max(1, st.lifespan + eff.lifespan);
      }
    } else {
      for (const [k, v] of Object.entries(eff)) {
        if (k.startsWith("flag")) {
          const key = k.slice(4);
          st.flags[key] = (st.flags[key] || 0) + v;
        } else if (ATTR_KEYS.includes(k)) {
          st.attrs[k] = clampAttr(k, (st.attrs[k] || 0) + v);
          gained[k] = (gained[k] || 0) + v;
        }
      }
    }
    return gained;
  }
  function describeEffects(st, eff) {
    if (!eff) return "";
    const parts = [];
    const isTyped = eff.attr || eff.flag || eff.lifespan !== undefined;
    if (isTyped) {
      if (eff.attr) for (const [k, v] of Object.entries(eff.attr)) parts.push(`${k}${v >= 0 ? "+" : ""}${v}`);
      if (eff.flag) for (const [k, v] of Object.entries(eff.flag)) parts.push(`${k}${v >= 0 ? "+" : ""}${v}`);
      if (eff.lifespan) parts.push(`寿元${eff.lifespan >= 0 ? "+" : ""}${eff.lifespan}`);
    } else {
      for (const [k, v] of Object.entries(eff)) {
        if (k.startsWith("flag")) parts.push(`${k.slice(4)}${v >= 0 ? "+" : ""}${v}`);
        else if (ATTR_KEYS.includes(k)) parts.push(`${k}${v >= 0 ? "+" : ""}${v}`);
      }
    }
    return parts.join(" · ");
  }

  /* ---------------- 加权抽取 ---------------- */
  function weightedPick(st, items, weight) {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) return items[Math.floor(st.rng() * items.length)] || null;
    let r = st.rng() * total;
    for (const it of items) {
      r -= Math.max(0, weight(it));
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }

  /* ---------------- 风险分档 ---------------- */
  function inferTier(outcome) {
    if (!outcome) return "mid";
    if (outcome.tier) return outcome.tier;
    if (outcome.death) return "bad";
    let score = 0;
    if (outcome.attr) {
      for (const [k, v] of Object.entries(outcome.attr)) {
        score += k === "善恶" ? v * 0.4 : k === "金铢" ? v / 100 : v;
      }
    }
    if (outcome.flag) {
      for (const v of Object.values(outcome.flag)) score += v > 0 ? 1 : v < 0 ? -1 : 0;
    }
    if (outcome.lifespan) score += outcome.lifespan / 10;
    if (outcome.jump) score -= 5;
    return score >= 2 ? "good" : score <= -1 ? "bad" : "mid";
  }

  function oddsForOutcomes(outcomes) {
    const total = outcomes.reduce((s, o) => s + Math.max(0, o.p || 0), 0) || 1;
    const byTier = { good: 0, mid: 0, bad: 0 };
    for (const o of outcomes) byTier[inferTier(o)] += (Math.max(0, o.p || 0) / total) * 100;
    return finishOdds(byTier);
  }
  function finishOdds(byTier) {
    const rounded = TIER_ORDER.map((t) => ({ tier: t, pct: Math.floor(byTier[t] || 0) }));
    let rest = 100 - rounded.reduce((s, x) => s + x.pct, 0);
    // 把余数按小数部分从大到小补齐，保证总计 100
    const fractions = TIER_ORDER.map((t) => ({ t, f: (byTier[t] || 0) - Math.floor(byTier[t] || 0) }))
      .sort((a, b) => b.f - a.f);
    for (let i = 0; rest > 0; i++, rest--) {
      const hit = rounded.find((x) => x.tier === fractions[i % fractions.length].t);
      hit.pct += 1;
    }
    return rounded.filter((x) => x.pct > 0);
  }
  function riskLabel(odds) {
    const bad = (odds.find((o) => o.tier === "bad") || {}).pct || 0;
    const good = (odds.find((o) => o.tier === "good") || {}).pct || 0;
    if (bad >= 35) return "凶险";
    if (bad >= 15) return "有险";
    if (good >= 50) return "上佳";
    return "稳妥";
  }

  /* ---------------- 破境成功率 ---------------- */
  function breakChance(st) {
    const a = st.attrs;
    let p = 0.66 + (a["悟性"] + a["心境"]) * 0.025 + a["根骨"] * 0.015;
    if (st.flags["完美道基"]) p += 0.08;
    if (st.flags["神婴"]) p += 0.05;
    if (st.flags["裂基"]) p -= 0.15;
    if (st.flags["劫伤"]) p -= 0.05;
    return Math.max(0.35, Math.min(0.88, p));
  }
  function pillCost(st, br) {
    if (!br.costBase) return 0;
    return Math.round((br.costBase + br.costPerStage * st.stageIdx) / 100) * 100;
  }

  /* ---------------- 开局 ---------------- */
  function createGame(opts) {
    opts = opts || {};
    const S = opts.S || (typeof window !== "undefined" ? window.XIUXIAN_SCRIPT : null);
    if (!S) throw new Error("缺少 XIUXIAN_SCRIPT 数据");
    const seed = makeSeed(opts.seed);
    const attrs = {};
    ATTR_KEYS.forEach((k) => (attrs[k] = 0));
    const st = {
      S, seed, rng: mulberry32(seed),
      name: (opts.name || "无名").toString().slice(0, 12),
      path: null,
      attrs,
      flags: {},
      age: S.CONFIG.startAge,
      lifespan: S.CONFIG.baseLifespan,
      stageIdx: -1,
      yearsLeft: 0,
      stageYear: 0,
      used: {},
      usedSpecials: {},
      specialMarks: [],
      specialPtr: 0,
      pending: null,
      queue: [],
      started: false,
      finished: false,
      ending: null,
      failReason: "",
      history: [],
      stats: { decisions: 0, specials: 0, breakthroughs: 0, good: 0, mid: 0, bad: 0 },
    };

    const talentIds = opts.talentIds || opts.talents || [];
    for (const id of talentIds) {
      const t = S.TALENTS.find((x) => x.id === id || x.name === id);
      if (t) applyEffect(st, t.effects);
    }
    const path = S.PATHS.find((p) => p.id === (opts.pathId || opts.path) || p.name === (opts.pathId || opts.path));
    st.path = path || S.PATHS[0];
    applyEffect(st, st.path.effects);

    return makeGameApi(st);
  }

  /* ---------------- 阶段 ---------------- */
  function scheduleSpecials(st) {
    const S = st.S;
    const stage = S.STAGES[st.stageIdx];
    const n = (S.CONFIG.specialsPerStage && S.CONFIG.specialsPerStage[stage.id]) || 0;
    const years = S.CONFIG.yearsPerStage[stage.id];
    const marks = [];
    if (n > 0 && years > 1) {
      for (let i = 0; i < n; i++) {
        const slot = years * ((i + 1) / (n + 1));
        const jitter = (st.rng() * 2 - 1) * Math.max(1, (years / (n + 1)) * 0.28);
        const y = Math.max(1, Math.min(years - 1, Math.round(slot + jitter)));
        if (!marks.includes(y)) marks.push(y);
      }
    }
    st.specialMarks = marks.sort((a, b) => a - b);
    st.specialPtr = 0;
  }

  function enterStage(st) {
    const S = st.S;
    st.stageIdx++;
    const stage = S.STAGES[st.stageIdx];
    st.lifespan += (S.CONFIG.lifespanBonus[stage.id] || 0);
    st.yearsLeft = S.CONFIG.yearsPerStage[stage.id];
    st.stageYear = 0;
    scheduleSpecials(st);
    const first = st.stageIdx === 0;
    return {
      type: "log",
      kind: "stage",
      cls: "brk",
      age: st.age,
      stage: stage.name,
      text: first
        ? `— ${st.name} 降世，故事从 ${st.age} 岁那年开始 —`
        : `— 突破！踏入【${stage.name}期】 寿元增至 ${st.lifespan} 载 —`,
    };
  }

  function stageName(st) {
    const S = st.S;
    if (st.stageIdx < 0) return "凡尘";
    return S.STAGES[Math.min(st.stageIdx, S.STAGES.length - 1)].name;
  }

  function advanceYear(st) {
    st.age++;
    st.yearsLeft--;
    st.stageYear++;
  }

  /* ---------------- 行动：日志 / 选项 / 结局 ---------------- */
  function makeLog(st, kind, title, text, extra) {
    return Object.assign({
      type: "log", kind, age: st.age, stage: stageName(st), title, text,
    }, extra || {});
  }
  function makeChoice(st, kind, title, text, options, meta) {
    st.pending = {
      kind, title, text, options,
      meta: meta || {},
      age: st.age,
      stage: stageName(st),
    };
    return {
      type: "choice", kind, title, text,
      age: st.age, stage: stageName(st),
      options, meta: meta || {},
    };
  }

  function breakthroughChoice(st) {
    const S = st.S;
    const target = S.STAGES[st.stageIdx + 1];
    const base = breakChance(st);
    const opts = S.BREAKTHROUGHS.map((br, i) => {
      const chance = Math.max(0.2, Math.min(0.97, base + br.odds));
      const cost = pillCost(st, br);
      const locked = cost > (st.attrs["金铢"] || 0);
      return {
        index: i, label: br.name, desc: br.desc,
        chance, chancePct: Math.round(chance * 100),
        cost, locked,
        lockText: locked ? `金铢不足（需 ${cost}）` : "",
        detail: br.id === "br_force"
          ? "成则悟性 +2、根骨 +1；败则道途止步"
          : br.id === "br_steady" ? "成则心境 +1" : "成则心境 +1，消耗金铢",
        br,
      };
    });
    return makeChoice(st, "breakthrough", `破境 · ${target.name}`,
      `寿元将尽，你已站在【${stageName(st)}】巅峰。下一步，是踏入【${target.name}期】。你要如何破这道关？`,
      opts, { target: target.name, baseChance: Math.round(base * 100) });
  }

  function availableSpecials(st) {
    const S = st.S;
    const stage = S.STAGES[st.stageIdx];
    const pool = (S.SPECIALS && S.SPECIALS[stage.id]) || [];
    return pool.filter(
      (sp) => !st.usedSpecials[sp.id] && (sp.cond || []).every((c) => evalCond(st, c))
    );
  }

  function specialChoice(st, sp) {
    const opts = sp.options.map((op, i) => {
      const req = reqInfo(st, op.req);
      const odds = oddsForOutcomes(op.outcomes);
      return {
        index: i, label: op.label, desc: op.desc || "",
        locked: !req.ok, req: op.req || "", reqText: req.text,
        lockText: req.ok ? "" : `${req.text}（现有 ${req.current}）`,
        odds, risk: riskLabel(odds),
        outcomes: op.outcomes,
      };
    });
    st.usedSpecials[sp.id] = true;
    st.stats.specials++;
    return makeChoice(st, "special", sp.title, sp.text, opts, {
      specialId: sp.id,
      hint: "每个选项都是一次独立的天命掷骰，概率已标注",
    });
  }

  function pickOutcome(rng, outcomes) {
    const total = outcomes.reduce((s, o) => s + Math.max(0, o.p || 0), 0) || 1;
    const point = rng() * 100;
    let acc = 0;
    let hit = outcomes[outcomes.length - 1];
    for (const o of outcomes) {
      acc += (Math.max(0, o.p || 0) / total) * 100;
      if (point < acc) { hit = o; break; }
    }
    return { outcome: hit, point: Math.round(point * 10) / 10 };
  }

  function ambientEventChoice(st, ev, cands) {
    const opts = cands.map((c, i) => {
      const odds = oddsForOutcomes(c.outcomes);
      return { index: i, label: c.label, desc: "", locked: false, odds, risk: riskLabel(odds), choice: c };
    });
    return makeChoice(st, "event", ev.title, ev.text, opts, { eventId: ev.id });
  }

  function yearStep(st) {
    const S = st.S;
    const stage = S.STAGES[st.stageIdx];
    const pool = (S.EVENTS[stage.id] || []).filter(
      (e) => !st.used[e.id] && (e.cond || []).every((c) => evalCond(st, c))
    );

    if (!pool.length) {
      const fillers = (S.FILLERS && S.FILLERS[stage.id]) || (S.FILLERS && S.FILLERS.mortal) || ["岁月无声，又过一年。"];
      const text = fillers[Math.floor(st.rng() * fillers.length)];
      const action = makeLog(st, "fill", "", text, { cls: "fill" });
      advanceYear(st);
      return action;
    }

    const ev = weightedPick(st, pool, (e) => e.weight || 1);
    st.used[ev.id] = true;

    if (ev.ask && ev.choices) {
      let cands = ev.choices.filter((c) => !c.cond_flag || st.flags[c.cond_flag]);
      if (!cands.length) cands = ev.choices;
      return ambientEventChoice(st, ev, cands);
    }

    let cands = ev.branches.filter((b) => !b.cond_flag || st.flags[b.cond_flag]);
    if (!cands.length) cands = ev.branches;
    const br = weightedPick(st, cands, (b) => b.p || 1);
    applyEffect(st, br);
    const action = makeLog(st, "event", `【${ev.title}】`, br.text, {
      effects: describeEffects(st, br),
      tier: inferTier(br),
    });
    advanceYear(st);
    if (br.jump) return { type: "jump", outcome: br, log: action };
    if (br.death) return { type: "jump", outcome: br, log: action };
    return action;
  }

  function resolveEnding(st, exclude) {
    const S = st.S;
    const ex = exclude || [];
    const hit = S.ENDINGS.filter((e) => !e.trigger && !ex.includes(e.id))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .find((e) => (e.cond || []).every((c) => evalCond(st, c)));
    return finish(st, hit || S.ENDINGS.find((e) => e.id === "end_death"));
  }
  function finishById(st, id) {
    const S = st.S;
    const hit = S.ENDINGS.find((e) => e.id === id || e.trigger === id);
    return finish(st, hit || S.ENDINGS.find((e) => e.id === "end_death"));
  }
  function finish(st, ending) {
    if (!st.finished) {
      st.finished = true;
      st.ending = ending || st.S.ENDINGS.find((e) => e.id === "end_death");
      st.pending = null;
    }
    return { type: "ending", summary: buildSummary(st) };
  }

  /* ---------------- 结局统计 ---------------- */
  function scoreOf(st) {
    let score = Math.max(0, st.stageIdx) * 140;
    for (const k of ATTR_KEYS) if (k !== "金铢") score += Math.max(0, st.attrs[k] || 0) * 2;
    score += Math.min(2000, Math.max(0, st.attrs["金铢"] || 0)) / 20;
    score += st.history.length * 4;
    if (st.flags["道心圆满"]) score += 80;
    if (st.flags["飞升"]) score += 120;
    if (st.flags["双飞升"]) score += 80;
    if (st.flags["魔染"] >= 3) score -= 60;
    return Math.round(score);
  }
  function gradeOf(score) {
    if (score >= 1800) return "S";
    if (score >= 1400) return "A";
    if (score >= 900) return "B";
    if (score >= 500) return "C";
    return "D";
  }
  function buildSummary(st) {
    const S = st.S;
    const stage = S.STAGES[Math.max(0, Math.min(st.stageIdx, S.STAGES.length - 1))];
    const flags = Object.entries(st.flags)
      .filter(([k, v]) => v > 0 && S.FLAG_NAMES && S.FLAG_NAMES[k])
      .map(([k, v]) => ({ key: k, name: S.FLAG_NAMES[k], value: v }));
    const score = scoreOf(st);
    return {
      ending: { id: st.ending.id, name: st.ending.name, desc: st.ending.desc },
      name: st.name,
      age: st.age,
      lifespan: st.lifespan,
      pathName: st.path ? st.path.name : "",
      stageName: stage.name,
      stageIdx: st.stageIdx,
      attrs: Object.assign({}, st.attrs),
      flags,
      stats: Object.assign({}, st.stats),
      history: st.history.slice(-10),
      score,
      grade: gradeOf(score),
      failReason: st.failReason || "",
    };
  }

  /* ---------------- 决策记录 ---------------- */
  function record(st, kind, title, label, tier, extra) {
    st.stats.decisions++;
    if (tier === "good") st.stats.good++;
    else if (tier === "bad") st.stats.bad++;
    else st.stats.mid++;
    st.history.push(Object.assign({ age: st.age, stage: stageName(st), kind, title, label, tier }, extra || {}));
  }

  /* ---------------- 对外 API ---------------- */
  function makeGameApi(st) {
    const api = {
      state: st,
      seed: st.seed,

      /** 取下一条消息：log / choice / ending / wait */
      next() {
        if (st.queue.length) return st.queue.shift();
        if (st.pending) return { type: "wait" };
        if (st.finished) return { type: "ending", summary: buildSummary(st) };
        if (!st.started) {
          st.started = true;
          return enterStage(st);
        }
        if (st.age > st.lifespan) {
          st.failReason = "寿元耗尽";
          return resolveEnding(st);
        }
        if (st.yearsLeft <= 0) {
          // 凡人期未能入道
          if (st.stageIdx === 0 && !(st.flags["入宗"] || st.flags["拜师"] || st.flags["散人"] || st.flags["得功法"] || st.flags["仙缘"])) {
            st.failReason = "仙缘未至";
            return finishById(st, "end_mortal");
          }
          if (st.stageIdx + 1 >= st.S.STAGES.length) return resolveEnding(st);
          return breakthroughChoice(st);
        }
        // 特色事件到点
        if (st.specialPtr < st.specialMarks.length && st.stageYear >= st.specialMarks[st.specialPtr]) {
          st.specialPtr++;
          const pool = availableSpecials(st);
          if (pool.length) {
            const sp = weightedPick(st, pool, (s) => s.weight || 1);
            return specialChoice(st, sp);
          }
        }
        const step = yearStep(st);
        if (step.type === "jump") {
          const act = step.log;
          const outcome = step.outcome;
          return finishByIdOrDeath(st, outcome, act);
        }
        return step;
      },

      /** 结算当前选项 */
      resolve(index) {
        const p = st.pending;
        if (!p) return { type: "error", message: "当前没有待决之事" };
        const opt = p.options[index];
        if (!opt) return { type: "error", message: "选项不存在" };
        if (opt.locked) return { type: "error", message: opt.lockText || "条件不足" };
        st.pending = null;

        /* ---- 破境 ---- */
        if (p.kind === "breakthrough") {
          const br = opt.br;
          const roll = st.rng();
          const ok = roll < opt.chance;
          record(st, "breakthrough", `破境·${p.meta.target}`, opt.label, ok ? "good" : "bad", { chance: opt.chancePct });
          st.stats.breakthroughs++;
          const cost = opt.cost || 0;
          if (cost && br.id === "br_pill") st.attrs["金铢"] = clampAttr("金铢", (st.attrs["金铢"] || 0) - cost);
          if (ok) {
            applyEffect(st, br.success);
            const result = {
              type: "result", kind: "breakthrough", tier: "good",
              title: `破境 · ${p.meta.target}`, label: opt.label,
              text: br.successText || "你成功破境。",
              effects: describeEffects(st, br.success),
              chancePct: opt.chancePct, roll: Math.round(roll * 1000) / 10,
              age: st.age, stage: stageName(st),
            };
            st.queue.push(enterStage(st));
            return result;
          }
          st.failReason = `冲击【${p.meta.target}期】失败，道基崩解`;
          const end = resolveEnding(st, ["end_longevity", "end_mortal"]);
          end.text = `你倾尽全力冲击【${p.meta.target}期】，终究功亏一篑。道基寸寸崩解，眼前的光一点点暗了下去。`;
          end.title = "破境失败";
          return end;
        }

        /* ---- 特殊事件 / 旧事件 ---- */
        const outcomes = p.kind === "special" ? p.options[index].outcomes : p.options[index].choice.outcomes;
        const pick = pickOutcome(st.rng, outcomes);
        const outcome = pick.outcome;
        applyEffect(st, outcome);
        const label = opt.label;
        const title = p.title;
        const kind = p.kind;
        const tier = inferTier(outcome);
        record(st, kind, title, label, tier, { roll: pick.point });
        advanceYear(st);

        if (outcome.jump || outcome.death || outcome.ending) {
          const end = outcome.ending ? finishById(st, outcome.ending)
            : outcome.jump ? finishById(st, outcome.jump)
            : resolveEnding(st);
          end.text = outcome.text;
          end.title = title;
          end.tier = tier;
          end.roll = pick.point;
          return end;
        }
        return {
          type: "result", kind, title, label,
          text: outcome.text,
          effects: describeEffects(st, outcome),
          tier, roll: pick.point,
          age: st.age, stage: stageName(st),
        };
      },

      /** 当前选项是否合法 */
      legalOptions() {
        if (!st.pending) return [];
        return st.pending.options.map((o, i) => (o.locked ? -1 : i)).filter((i) => i >= 0);
      },

      /** 自动抉择（托管模式）：在可用选项里随机挑一个 */
      autoPick() {
        const legal = api.legalOptions();
        if (!legal.length) return 0;
        return legal[Math.floor(st.rng() * legal.length)];
      },

      summary() { return buildSummary(st); },
      breakChance() { return breakChance(st); },
    };
    return api;
  }

  function finishByIdOrDeath(st, outcome, logAction) {
    // 先记录日志动作，再给出结局：调用方会先显示 logAction，再显示结局
    const end = outcome.jump ? finishById(st, outcome.jump)
      : outcome.ending ? finishById(st, outcome.ending)
      : resolveEnding(st);
    end.text = outcome.text;
    end.log = logAction;
    end.title = logAction && logAction.title;
    return end;
  }

  /* ---------------- 数据校验（测试用） ---------------- */
  function validateData(S) {
    const errors = [];
    const warnings = [];
    const ids = new Set();
    const endingIds = new Set(S.ENDINGS.map((e) => e.id));
    const validAttr = new Set(ATTR_KEYS);

    const checkOutcome = (where, o) => {
      if (!(o.p > 0)) errors.push(`${where}: p 必须 > 0`);
      if (o.tier && !TIER_ORDER.includes(o.tier)) errors.push(`${where}: 非法 tier ${o.tier}`);
      if (o.attr) for (const [k, v] of Object.entries(o.attr)) {
        if (!validAttr.has(k)) errors.push(`${where}: 非法属性 ${k}`);
        if (typeof v !== "number" || !isFinite(v)) errors.push(`${where}: 属性 ${k} 非数字`);
      }
      if (o.lifespan !== undefined && typeof o.lifespan !== "number") errors.push(`${where}: lifespan 非数字`);
      if (o.ending && !endingIds.has(o.ending)) errors.push(`${where}: 未知结局 ${o.ending}`);
      if (o.jump && !S.ENDINGS.some((e) => e.id === o.jump || e.trigger === o.jump)) errors.push(`${where}: 未知 jump ${o.jump}`);
    };

    for (const [stage, list] of Object.entries(S.SPECIALS || {})) {
      if (!S.STAGES.some((x) => x.id === stage)) errors.push(`SPECIALS: 未知境界 ${stage}`);
      for (const sp of list) {
        if (ids.has(sp.id)) errors.push(`重复事件 id ${sp.id}`);
        ids.add(sp.id);
        if (!sp.title || !sp.text) errors.push(`${sp.id}: 缺少标题或正文`);
        if (!Array.isArray(sp.options) || sp.options.length !== 3) {
          errors.push(`${sp.id}: 特色事件必须三选一（当前 ${sp.options ? sp.options.length : 0}）`);
          continue;
        }
        if (!sp.options.some((o) => !o.req)) errors.push(`${sp.id}: 至少应有一个无条件选项`);
        sp.options.forEach((opt, i) => {
          const where = `${sp.id}.选项${i + 1}`;
          const sum = opt.outcomes.reduce((s, o) => s + (o.p || 0), 0);
          if (sum !== 100) errors.push(`${where}: 概率合计 ${sum}，应为 100`);
          if (opt.req && !parseCond(opt.req)) errors.push(`${where}: 无法解析门槛 ${opt.req}`);
          opt.outcomes.forEach((o) => checkOutcome(where, o));
          if (!opt.outcomes.some((o) => inferTier(o) !== "bad") && !opt.label) warnings.push(`${where}: 全为下签`);
        });
        for (const c of sp.cond || []) if (!parseCond(c)) errors.push(`${sp.id}: 无法解析 cond ${c}`);
      }
    }

    for (const [stage, list] of Object.entries(S.EVENTS || {})) {
      for (const ev of list) {
        if (!Array.isArray(ev.branches) && !Array.isArray(ev.choices)) errors.push(`${ev.id}: 缺少分支`);
        (ev.branches || []).forEach((b, i) => checkOutcome(`${ev.id}.分支${i + 1}`, b));
        (ev.choices || []).forEach((c, ci) => {
          if (c.cond_flag && !c.cond_flag) warnings.push(`${ev.id}.选项${ci + 1}: 空 cond_flag`);
          (c.outcomes || []).forEach((o, i) => checkOutcome(`${ev.id}.选项${ci + 1}.结局${i + 1}`, o));
        });
        for (const c of ev.cond || []) if (!parseCond(c)) errors.push(`${ev.id}: 无法解析 cond ${c}`);
      }
    }

    for (const e of S.ENDINGS) {
      for (const c of e.cond || []) if (!parseCond(c)) errors.push(`${e.id}: 无法解析 cond ${c}`);
      if (!e.trigger && typeof e.priority !== "number") errors.push(`${e.id}: 缺少 priority`);
    }
    if ((S.BREAKTHROUGHS || []).length !== 3) errors.push("BREAKTHROUGHS 必须为 3 个");

    return { ok: errors.length === 0, errors, warnings };
  }

  return {
    createGame,
    validateData,
    breakChance,
    reqInfo,
    evalCond,
    oddsForOutcomes,
    inferTier,
    TIER_NAME,
    TIER_ORDER,
    ATTR_KEYS,
    _internal: { mulberry32, makeSeed, parseCond, pickOutcome },
  };
});
