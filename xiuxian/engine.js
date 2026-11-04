/* ============================================================
 * 《一世仙途》推演引擎 v3.0
 * ------------------------------------------------------------
 * 玩家只做五次选择：天赋、门派、职业、正邪、道侣。
 * 之后全程自动：事件自动挑选项，结果按各自概率分布掷骰。
 * 纯逻辑、无 DOM，浏览器与 Node 共用。
 * ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.XIUXIAN_ENGINE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ATTR_KEYS = ["悟性", "根骨", "心境", "机缘", "声望", "善恶", "金铢"];
  const TIER_NAME = { good: "上签", mid: "平", bad: "下签" };

  /* ---------------- 随机数 ---------------- */
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

  /* ---------------- 条件 ---------------- */
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
    if (!req) return { ok: true, text: "", current: 0 };
    const c = parseCond(req);
    if (!c) return { ok: true, text: "", current: 0 };
    const v = c.isFlag ? st.flags[c.key] || 0 : st.attrs[c.key] || 0;
    return { ok: compare(v, c.op, c.num), text: `需 ${c.key} ${c.op} ${c.num}`, current: v };
  }

  /* ---------------- 效果 ---------------- */
  function clampAttr(key, v) {
    return key === "金铢" ? Math.max(0, v) : Math.max(-999, v);
  }
  function applyEffect(st, eff) {
    if (!eff) return;
    if (eff.attr || eff.flag || eff.lifespan !== undefined) {
      if (eff.attr) for (const [k, v] of Object.entries(eff.attr)) {
        st.attrs[k] = clampAttr(k, (st.attrs[k] || 0) + v);
      }
      if (eff.flag) for (const [k, v] of Object.entries(eff.flag)) {
        st.flags[k] = (st.flags[k] || 0) + v;
      }
      if (typeof eff.lifespan === "number") st.lifespan = Math.max(1, st.lifespan + eff.lifespan);
      return;
    }
    for (const [k, v] of Object.entries(eff)) {
      if (k.startsWith("flag")) {
        const key = k.slice(4);
        st.flags[key] = (st.flags[key] || 0) + v;
      } else if (ATTR_KEYS.includes(k)) {
        st.attrs[k] = clampAttr(k, (st.attrs[k] || 0) + v);
      }
    }
  }
  function describeEffects(eff, positiveOnly) {
    if (!eff) return "";
    const parts = [];
    if (eff.attr) for (const [k, v] of Object.entries(eff.attr)) {
      if (positiveOnly && v <= 0) continue;
      parts.push(`${k}${v >= 0 ? "+" : ""}${v}`);
    }
    if (eff.flag) for (const [k, v] of Object.entries(eff.flag)) {
      if (positiveOnly && v <= 0) continue;
      parts.push(`${k}${v >= 0 ? "+" : ""}${v}`);
    }
    if (eff.lifespan) parts.push(`寿元${eff.lifespan >= 0 ? "+" : ""}${eff.lifespan}`);
    return parts.join(" · ");
  }

  /* ---------------- 概率与分档 ---------------- */
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
  function inferTier(outcome) {
    if (!outcome) return "mid";
    if (outcome.tier) return outcome.tier;
    if (outcome.death) return "bad";
    let score = 0;
    if (outcome.attr) for (const [k, v] of Object.entries(outcome.attr)) {
      score += k === "善恶" ? v * 0.4 : k === "金铢" ? v / 100 : v;
    }
    if (outcome.flag) for (const v of Object.values(outcome.flag)) score += v > 0 ? 1 : v < 0 ? -1 : 0;
    if (outcome.lifespan) score += outcome.lifespan / 10;
    if (outcome.jump) score -= 5;
    return score >= 2 ? "good" : score <= -1 ? "bad" : "mid";
  }
  function oddsForOutcomes(outcomes) {
    const total = outcomes.reduce((s, o) => s + Math.max(0, o.p || 0), 0) || 1;
    const byTier = { good: 0, mid: 0, bad: 0 };
    for (const o of outcomes) byTier[inferTier(o)] += (Math.max(0, o.p || 0) / total) * 100;
    const order = ["good", "mid", "bad"];
    const rounded = order.map((t) => ({ tier: t, pct: Math.floor(byTier[t] || 0) }));
    let rest = 100 - rounded.reduce((s, x) => s + x.pct, 0);
    const fractions = order.map((t) => ({ t, f: (byTier[t] || 0) - Math.floor(byTier[t] || 0) }))
      .sort((a, b) => b.f - a.f);
    for (let i = 0; rest > 0; i++, rest--) rounded.find((x) => x.tier === fractions[i % 3].t).pct += 1;
    return rounded.filter((x) => x.pct > 0);
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
      name: (opts.name || "无名客").toString().slice(0, 12),
      attrs, flags: {},
      age: S.CONFIG.startAge,
      lifespan: S.CONFIG.baseLifespan,
      stageIdx: -1,
      yearsLeft: 0,
      stageYear: 0,
      used: {},
      usedSpecials: {},
      specialMarks: [],
      specialPtr: 0,
      queue: [],
      started: false,
      finished: false,
      ending: null,
      failReason: "",
      creation: [],
      scripts: {},
      pending: null,
      history: [],
      stats: { decisions: 0, specials: 0, events: 0, breakthroughs: 0, good: 0, mid: 0, bad: 0 },
    };

    const find = (list, id, name) => list.find((x) => x.id === id || x.name === id || x.name === name);

    applyEffect(st, S.CONFIG.creationBase);

    // 天赋：开局唯一一次选择
    const talentIds = opts.talentId ? [opts.talentId] : (opts.talentIds || opts.talents || []);
    const talents = talentIds.map((id) => find(S.TALENTS, id)).filter(Boolean);
    talents.forEach((t) => applyEffect(st, t.effects));
    st.creation.push({ label: "天赋", name: talents.map((t) => t.name).join("、") || "无" });
    const bestGrade = talents.reduce((m, t) => Math.max(m, t.grade || 1), 1);
    st.flags[bestGrade >= 3 ? "天骄" : "寒门"] = 1;

    return makeGameApi(st);
  }

  /* ---------------- 阶段 ---------------- */
  function stageName(st) {
    if (st.stageIdx < 0) return "凡尘";
    return st.S.STAGES[Math.min(st.stageIdx, st.S.STAGES.length - 1)].name;
  }
  function scheduleSpecials(st) {
    const S = st.S;
    const stage = S.STAGES[st.stageIdx];
    const n = (S.CONFIG.specialsPerStage && S.CONFIG.specialsPerStage[stage.id]) || 0;
    const years = S.CONFIG.yearsPerStage[stage.id];
    const marks = [];
    for (let i = 0; i < n && years > 1; i++) {
      const slot = years * ((i + 1) / (n + 1));
      const jitter = (st.rng() * 2 - 1) * Math.max(1, (years / (n + 1)) * 0.28);
      const y = Math.max(1, Math.min(years - 1, Math.round(slot + jitter)));
      if (!marks.includes(y)) marks.push(y);
    }
    st.specialMarks = marks.sort((a, b) => a - b);
    st.specialPtr = 0;
  }
  function enterStage(st) {
    const S = st.S;
    st.stageIdx++;
    const stage = S.STAGES[st.stageIdx];
    st.lifespan += S.CONFIG.lifespanBonus[stage.id] || 0;
    st.yearsLeft = S.CONFIG.yearsPerStage[stage.id];
    st.stageYear = 0;
    scheduleSpecials(st);
    return {
      type: "log", kind: "stage", cls: "brk", age: st.age, stage: stage.name,
      text: st.stageIdx === 0
        ? `— ${st.name} 降世，故事从 ${st.age} 岁那年开始 —`
        : `— 突破！踏入【${stage.name}期】 寿元增至 ${st.lifespan} 载 —`,
    };
  }
  function advanceYear(st) {
    st.age++;
    st.yearsLeft--;
    st.stageYear++;
  }
  function makeLog(st, kind, title, text, extra) {
    return Object.assign({
      type: "log", kind, age: st.age, stage: stageName(st), title, text,
    }, extra || {});
  }

  /* ---------------- 事件结算 ---------------- */
  function availableSpecials(st) {
    const S = st.S;
    const stage = S.STAGES[st.stageIdx];
    return ((S.SPECIALS && S.SPECIALS[stage.id]) || []).filter(
      (sp) => !st.usedSpecials[sp.id] && (sp.cond || []).every((c) => evalCond(st, c))
    );
  }
  function resolveSpecial(st, sp) {
    st.usedSpecials[sp.id] = true;
    st.stats.specials++;
    const options = sp.options.filter((o) => reqInfo(st, o.req).ok);
    const pool = options.length ? options : sp.options;
    const opt = weightedPick(st, pool, (o) => (o.weight || 1));
    const pick = pickOutcome(st.rng, opt.outcomes);
    const outcome = pick.outcome;
    const age = st.age;
    applyEffect(st, outcome);
    record(st, sp.title, opt.label, inferTier(outcome));
    advanceYear(st);
    if (outcome.jump || outcome.ending || outcome.death) {
      return {
        type: "jump", age, outcome,
        log: {
          type: "log", kind: "special", title: `【${sp.title}】`, age, stage: stageName(st),
          text: `${sp.text}\n▶ ${opt.label}。${outcome.text}`,
          effects: describeEffects(outcome), tier: inferTier(outcome),
        },
      };
    }
    return {
      type: "log", kind: "special", title: `【${sp.title}】`, age, stage: stageName(st),
      text: `${sp.text}\n▶ ${opt.label}。${outcome.text}`,
      effects: describeEffects(outcome), tier: inferTier(outcome),
    };
  }
  function resolveAsk(st, ev, cands) {
    const choice = weightedPick(st, cands, (c) => (c.weight || 1));
    const pick = pickOutcome(st.rng, choice.outcomes);
    const outcome = pick.outcome;
    const age = st.age;
    applyEffect(st, outcome);
    record(st, ev.title, choice.label, inferTier(outcome));
    advanceYear(st);
    if (outcome.jump || outcome.ending || outcome.death) {
      return {
        type: "jump", age, outcome,
        log: {
          type: "log", kind: "event", title: `【${ev.title}】`, age, stage: stageName(st),
          text: `${ev.text}\n▶ ${choice.label}。${outcome.text}`,
          effects: describeEffects(outcome), tier: inferTier(outcome),
        },
      };
    }
    return {
      type: "log", kind: "event", title: `【${ev.title}】`, age, stage: stageName(st),
      text: `${ev.text}\n▶ ${choice.label}。${outcome.text}`,
      effects: describeEffects(outcome), tier: inferTier(outcome),
    };
  }
  function yearStep(st) {
    const S = st.S;
    const stage = S.STAGES[st.stageIdx];
    const pool = (S.EVENTS[stage.id] || []).filter(
      (e) => !st.used[e.id] && (e.cond || []).every((c) => evalCond(st, c))
    );
    if (!pool.length) {
      const fillers = (S.FILLERS && S.FILLERS[stage.id]) || ["岁月无声，又过一年。"];
      const text = fillers[Math.floor(st.rng() * fillers.length)];
      const action = makeLog(st, "fill", "", text, { cls: "fill" });
      advanceYear(st);
      return action;
    }
    const ev = weightedPick(st, pool, (e) => e.weight || 1);
    st.used[ev.id] = true;
    st.stats.events++;

    if (ev.ask && ev.choices) {
      let cands = ev.choices.filter((c) => !c.cond_flag || st.flags[c.cond_flag]);
      if (!cands.length) cands = ev.choices;
      return resolveAsk(st, ev, cands);
    }

    let cands = ev.branches.filter((b) => !b.cond_flag || st.flags[b.cond_flag]);
    if (!cands.length) cands = ev.branches;
    const br = weightedPick(st, cands, (b) => b.p || 1);
    applyEffect(st, br);
    const action = makeLog(st, "event", `【${ev.title}】`, br.text, {
      effects: describeEffects(br), tier: inferTier(br),
    });
    advanceYear(st);
    if (br.jump || br.death) return { type: "jump", outcome: br, log: action };
    return action;
  }

  /* ---------------- 结局 ---------------- */
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
    }
    return { type: "ending", summary: buildSummary(st) };
  }
  function record(st, title, label, tier) {
    if (tier === "good") st.stats.good++;
    else if (tier === "bad") st.stats.bad++;
    else st.stats.mid++;
    st.history.push({ age: st.age, stage: stageName(st), title, label, tier });
  }

  /* ---------------- 评分 ---------------- */
  function scoreOf(st) {
    let score = Math.max(0, st.stageIdx) * 140;
    for (const k of ATTR_KEYS) if (k !== "金铢") score += Math.max(0, st.attrs[k] || 0) * 2;
    score += Math.min(2000, Math.max(0, st.attrs["金铢"] || 0)) / 20;
    score += st.stats.specials * 6;
    if (st.flags["道心圆满"]) score += 60;
    if (st.flags["飞升"]) score += 100;
    if (st.flags["双飞升"]) score += 60;
    if (st.flags["魔染"] >= 3) score -= 50;
    return Math.round(score);
  }
  function gradeOf(score) {
    if (score >= 1600) return "S";
    if (score >= 1200) return "A";
    if (score >= 800) return "B";
    if (score >= 400) return "C";
    return "D";
  }
  function buildSummary(st) {
    const S = st.S;
    const stage = S.STAGES[Math.max(0, Math.min(st.stageIdx, S.STAGES.length - 1))];
    const flags = Object.entries(st.flags)
      .filter(([k, v]) => v > 0 && S.FLAG_NAMES && S.FLAG_NAMES[k])
      .slice(0, 12)
      .map(([k]) => ({ key: k, name: S.FLAG_NAMES[k] }));
    const score = scoreOf(st);
    const choices = [{ label: "天赋", name: (st.creation[0] && st.creation[0].name) || "无" }];
    for (const [slot, label] of [["sect", "门派"], ["craft", "职业"], ["align", "正邪"], ["partner", "道侣"]]) {
      choices.push({ label, name: st.scripts[slot] || "未及" });
    }
    return {
      ending: { id: st.ending.id, name: st.ending.name, desc: st.ending.desc },
      name: st.name,
      age: st.age,
      lifespan: st.lifespan,
      stageName: stage.name,
      stageIdx: st.stageIdx,
      attrs: Object.assign({}, st.attrs),
      flags,
      creation: st.creation.slice(),
      choices,
      stats: Object.assign({}, st.stats),
      history: st.history.slice(-8),
      score,
      grade: gradeOf(score),
      failReason: st.failReason || "",
    };
  }

  function dueScript(st) {
    const S = st.S;
    for (const sc of S.SCRIPTS || []) {
      if (st.scripts[sc.slot]) continue;
      if (sc.after && !st.scripts[sc.after]) continue;
      if (st.age < sc.atAge) continue;
      if (!(sc.cond || []).every((c) => evalCond(st, c))) continue;
      return sc;
    }
    return null;
  }
  function scriptChoice(st, sc) {
    st.pending = { kind: "script", script: sc };
    const S = st.S;
    return {
      type: "choice", kind: "script", title: sc.title, text: sc.text,
      options: sc.options.map((o, i) => {
        const item = (S[o.group] || []).find((x) => x.id === o.id || x.name === o.id);
        return {
          index: i,
          label: item ? item.name : o.id,
          desc: item ? item.desc : "",
          effectsText: item ? describeEffects(item.effects, true) : "",
          group: o.group, id: o.id,
        };
      }),
    };
  }

  /* ---------------- 主循环 ---------------- */
  function makeGameApi(st) {
    return {
      state: st,
      seed: st.seed,
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
        const sc = dueScript(st);
        if (sc) return scriptChoice(st, sc);
        if (st.yearsLeft <= 0) {
          if (st.stageIdx + 1 >= st.S.STAGES.length) return resolveEnding(st);
          return breakthrough(st);
        }
        if (st.specialPtr < st.specialMarks.length && st.stageYear >= st.specialMarks[st.specialPtr]) {
          st.specialPtr++;
          const pool = availableSpecials(st);
          if (pool.length) {
            const sp = weightedPick(st, pool, (s) => s.weight || 1);
            const result = resolveSpecial(st, sp);
            return settleJump(st, result);
          }
        }
        const step = yearStep(st);
        if (step.type === "jump") return settleJump(st, step);
        return step;
      },
      resolve(index) {
        const p = st.pending;
        if (!p || p.kind !== "script") return { type: "error", message: "当前没有待决之事" };
        const sc = p.script;
        const ref = sc.options[index];
        if (!ref) return { type: "error", message: "选项不存在" };
        const item = (st.S[ref.group] || []).find((x) => x.id === ref.id || x.name === ref.id);
        if (!item) return { type: "error", message: "剧本选项数据缺失" };
        st.pending = null;
        applyEffect(st, item.effects);
        st.scripts[sc.slot] = item.name;
        st.stats.decisions = (st.stats.decisions || 0) + 1;
        return {
          type: "result", kind: "script", title: sc.title, label: item.name,
          text: `你选择了【${item.name}】。${item.desc}`,
          effects: describeEffects(item.effects),
          age: st.age, stage: stageName(st),
        };
      },
      summary() { return buildSummary(st); },
      breakChance() { return breakChance(st); },
    };
  }

  function breakthrough(st) {
    const S = st.S;
    const target = S.STAGES[st.stageIdx + 1];
    // 凡人踏入练气略高一档，但仍可能失败——活不到择门，就没有择门
    const chance = st.stageIdx === 0 ? Math.min(0.95, breakChance(st) + 0.1) : breakChance(st);
    st.stats.breakthroughs++;
    if (st.rng() > chance) {
      st.failReason = `冲击【${target.name}期】失败，道基崩解`;
      const end = resolveEnding(st, ["end_longevity", "end_mortal"]);
      end.text = `你倾尽全力冲击【${target.name}期】，终究功亏一篑。道基寸寸崩解，眼前的光一点点暗了下去。`;
      end.title = "破境失败";
      return end;
    }
    const action = {
      type: "log", kind: "breakthrough", age: st.age, stage: stageName(st),
      title: "破境", text: `你冲关成功，踏入【${target.name}期】。`, tier: "good",
    };
    st.queue.push(enterStage(st));
    return action;
  }
  function settleJump(st, result) {
    if (result.type !== "jump") return result;
    const end = result.outcome.jump ? finishById(st, result.outcome.jump)
      : result.outcome.ending ? finishById(st, result.outcome.ending)
      : resolveEnding(st);
    end.text = result.outcome.text;
    end.log = result.log;
    end.title = result.log && result.log.title;
    return end;
  }

  /* ---------------- 数据校验 ---------------- */
  function validateData(S) {
    const errors = [];
    const warnings = [];
    const ids = new Set();
    const endingIds = new Set(S.ENDINGS.map((e) => e.id));
    const validAttr = new Set(ATTR_KEYS);

    const checkOutcome = (where, o) => {
      if (!(o.p > 0)) errors.push(`${where}: p 必须 > 0`);
      if (o.tier && !TIER_NAME[o.tier]) errors.push(`${where}: 非法 tier ${o.tier}`);
      if (o.attr) for (const [k, v] of Object.entries(o.attr)) {
        if (!validAttr.has(k)) errors.push(`${where}: 非法属性 ${k}`);
        if (typeof v !== "number" || !isFinite(v)) errors.push(`${where}: 属性 ${k} 非数字`);
      }
      if (o.ending && !endingIds.has(o.ending)) errors.push(`${where}: 未知结局 ${o.ending}`);
      if (o.jump && !S.ENDINGS.some((e) => e.id === o.jump || e.trigger === o.jump)) errors.push(`${where}: 未知 jump ${o.jump}`);
    };

    for (const [stage, list] of Object.entries(S.SPECIALS || {})) {
      if (!S.STAGES.some((x) => x.id === stage)) errors.push(`SPECIALS: 未知境界 ${stage}`);
      for (const sp of list) {
        if (ids.has(sp.id)) errors.push(`重复事件 id ${sp.id}`);
        ids.add(sp.id);
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
        });
        for (const c of sp.cond || []) if (!parseCond(c)) errors.push(`${sp.id}: 无法解析 cond ${c}`);
      }
    }

    for (const [stage, list] of Object.entries(S.EVENTS || {})) {
      for (const ev of list) {
        if (!Array.isArray(ev.branches) && !Array.isArray(ev.choices)) errors.push(`${ev.id}: 缺少分支`);
        (ev.branches || []).forEach((b, i) => checkOutcome(`${ev.id}.分支${i + 1}`, b));
        (ev.choices || []).forEach((c, ci) => {
          (c.outcomes || []).forEach((o, i) => checkOutcome(`${ev.id}.选项${ci + 1}.结局${i + 1}`, o));
        });
        for (const c of ev.cond || []) if (!parseCond(c)) errors.push(`${ev.id}: 无法解析 cond ${c}`);
      }
    }

    for (const e of S.ENDINGS) {
      for (const c of e.cond || []) if (!parseCond(c)) errors.push(`${e.id}: 无法解析 cond ${c}`);
      if (!e.trigger && typeof e.priority !== "number") errors.push(`${e.id}: 缺少 priority`);
    }
    for (const [name, list] of [["SECTS", S.SECTS], ["PROFESSIONS", S.PROFESSIONS], ["ALIGNMENTS", S.ALIGNMENTS], ["PARTNERS", S.PARTNERS]]) {
      if (!Array.isArray(list) || list.length < 3) errors.push(`${name} 至少为 3 个`);
    }
    const slots = new Set(["sect", "craft", "align", "partner"]);
    const scriptIds = new Set();
    for (const sc of S.SCRIPTS || []) {
      if (scriptIds.has(sc.id)) errors.push(`SCRIPTS: 重复 id ${sc.id}`);
      scriptIds.add(sc.id);
      if (!slots.has(sc.slot)) errors.push(`SCRIPTS.${sc.id}: 非法 slot ${sc.slot}`);
      if (sc.after && !slots.has(sc.after)) errors.push(`SCRIPTS.${sc.id}: 非法 after ${sc.after}`);
      if (typeof sc.atAge !== "number") errors.push(`SCRIPTS.${sc.id}: 缺少 atAge`);
      if (!sc.options || sc.options.length < 3) errors.push(`SCRIPTS.${sc.id}: 至少三个选项`);
      for (const o of sc.options || []) {
        if (!S[o.group] || !S[o.group].some((x) => x.id === o.id || x.name === o.id)) {
          errors.push(`SCRIPTS.${sc.id}: 选项 ${o.group}/${o.id} 不存在`);
        }
      }
      for (const c of sc.cond || []) if (!parseCond(c)) errors.push(`SCRIPTS.${sc.id}: 无法解析 cond ${c}`);
    }
    for (const slot of slots) {
      if (!(S.SCRIPTS || []).some((sc) => sc.slot === slot)) errors.push(`SCRIPTS: 缺少 ${slot} 支线`);
    }
    if (!S.CONFIG.creationBase) warnings.push("缺少 creationBase");
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
    ATTR_KEYS,
    _internal: { mulberry32, makeSeed, pickOutcome, parseCond },
  };
});
