/* ============================================================
 * 《一世仙途 · 命途》树引擎 v1.0
 * ------------------------------------------------------------
 * 剧情树推进：到节点 → 判门槛（死关/凡关）→ 出选项 →
 * 选项结算（先结 舍/得，再掷 上/中/下签）→ 走向下一节点。
 * ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FATE_ENGINE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clampAttr(key, v) {
    if (key === "金铢") return Math.max(0, v);
    if (key === "寿元") return Math.max(1, v);
    return Math.max(-99, v);
  }
  function applyAttrs(st, eff) {
    if (!eff) return;
    for (const [k, v] of Object.entries(eff)) {
      st.attrs[k] = clampAttr(k, (st.attrs[k] || 0) + v);
    }
  }
  // lose 里的数值是"失去的量"（正数），结算时取负
  function neg(o) {
    const r = {};
    for (const [k, v] of Object.entries(o || {})) r[k] = -(v || 0);
    return r;
  }
  function fmt(eff) {
    if (!eff) return [];
    return Object.entries(eff).map(([k, v]) => `${k}${v >= 0 ? "+" : ""}${v}`);
  }

  /* ---------------- 门槛 ---------------- */
  function meetClause(st, c) {
    if (c.and) return c.and.every((x) => meetClause(st, x));
    const v = (c.stats || []).reduce((s, k) => s + (st.attrs[k] || 0), 0);
    return c.op === "<=" ? v <= c.value : v >= c.value;
  }
  function clauseText(c) {
    if (c.and) return c.and.map(clauseText).join(" 且 ");
    const name = (c.stats || []).join("+");
    return `需 ${name} ${c.op === "<=" ? "≤" : "≥"} ${c.value}`;
  }
  function meetsReq(st, req) {
    if (!req) return { ok: true };
    const clauses = Array.isArray(req) ? req : [req];
    const ok = clauses.some((c) => meetClause(st, c));
    const texts = clauses.map(clauseText);
    return { ok, label: texts.join(" 或 "), current: curText(st, clauses) };
  }
  function curText(st, clauses) {
    const parts = new Set();
    for (const c of clauses) {
      (c.and ? [c, ...c.and] : [c]).forEach((x) => (x.stats || []).forEach((k) => parts.add(k)));
    }
    return [...parts].map((k) => `${k}${st.attrs[k] || 0}`).join("/");
  }

  /* ---------------- 结局 ---------------- */
  function finish(st, id, overrideText) {
    if (st.finished) return;
    st.finished = true;
    const e = st.tree.ENDINGS[id] || { name: "命途终了", desc: "" };
    st.ending = {
      id, name: e.name,
      desc: overrideText || e.desc,
      path: st.path.slice(),
      age: st.age,
      attrs: Object.assign({}, st.attrs),
    };
  }

  /* ---------------- 创建/推进 ---------------- */
  function createRun(opts) {
    opts = opts || {};
    const tree = opts.tree || (typeof window !== "undefined" ? window.FATE_TREE : null);
    if (!tree) throw new Error("缺少 FATE_TREE 数据");
    const seed = (opts.seed != null ? opts.seed : (Math.random() * 4294967296)) >>> 0;
    const st = {
      tree, seed, rng: mulberry32(seed),
      attrs: Object.assign({}, tree.START),
      nodeId: null, age: tree.START.age || 8,
      path: [], finished: false, ending: null,
      stats: { choices: 0, good: 0, mid: 0, bad: 0 },
    };
    return makeApi(st);
  }

  function nodeText(st, n) {
    let text = n.text;
    for (const f of n.flavor || []) {
      if (meetsReq(st, f.cond).ok) text += "\n\n" + f.text;
    }
    return text;
  }

  function arrive(st, id, skips) {
    // 结局节点：直接终局
    if (st.tree.ENDINGS[id]) {
      finish(st, id);
      return;
    }
    st.nodeId = id;
    const n = st.tree.NODES[id];
    if (!n) { finish(st, "end_dead", "命途指往了一处不存在之地。"); return; }
    st.age = n.age;
    st.path.push(id);
    if (n.enter) applyAttrs(st, n.enter);
    if (st.age > (st.attrs["寿元"] || 0)) {
      finish(st, "end_peace", `行至 ${st.age} 岁，寿元耗尽，此生落幕。`);
      return;
    }
    const g = meetsReq(st, n.require);
    if (!g.ok) {
      if (n.gate === "death") {
        st.gateBroken = { label: g.label, current: g.current };
        // 死关结局也带上剧情记忆
        finish(st, "end_dead", n.failText + (nodeText(st, n) !== n.text ? "\n\n" + nodeText(st, n).slice(n.text.length + 2) : ""));
        return;
      }
      // 凡关：剧情不触发，直接跳过
      skips.push(`【未触发】${n.failText}`);
      arrive(st, n.failGoto || "end_plain", skips);
    }
  }

  /* ---------------- 属性修正后的签分布 ----------------
   * 悟性/机缘/心境 抬高上签，魔染 抬高下签；
   * 显示与结算使用同一套修正后概率，所见即所得。
   * -------------------------------------------------- */
  function rollOdds(st, odds) {
    const a = st.attrs;
    const up = Math.min(3, Math.max(0.3,
      1 + 0.05 * (a["悟性"] || 0) + 0.04 * (a["机缘"] || 0) + 0.03 * (a["心境"] || 0) - 0.06 * (a["魔染"] || 0)));
    const down = Math.min(3, Math.max(0.3,
      1 + 0.08 * (a["魔染"] || 0) - 0.04 * (a["悟性"] || 0) - 0.02 * (a["心境"] || 0)));
    const w = (odds || []).map((x) => {
      let v = Math.max(0, x.p || 0);
      if (v === 0) return 0;
      if (x.tier === "good") v *= up;
      else if (x.tier === "bad") v *= down;
      return Math.max(5, v);
    });
    const total = w.reduce((s, x) => s + x, 0) || 1;
    const pcts = w.map((x) => Math.floor((x / total) * 100));
    let rest = 100 - pcts.reduce((s, x) => s + x, 0);
    const order = w.map((x, i) => ({ i, f: (x / total) * 100 - Math.floor((x / total) * 100) }))
      .sort((p, q) => q.f - p.f);
    for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) pcts[order[k].i] += 1;
    return odds.map((x, i) => ({ tier: x.tier, pct: pcts[i], idx: i })).filter((x) => x.pct > 0);
  }

  function makeApi(st) {
    const api = {
      state: st,
      seed: st.seed,
      start() {
        arrive(st, st.tree.START_NODE, (st.skips = []));
        return this.view();
      },
      view() {
        if (st.finished) return { finished: true, ending: st.ending };
        const n = st.tree.NODES[st.nodeId];
        const g = meetsReq(st, n.require);
        // 剧情记忆：按属性追加呼应文案
        let text = n.text;
        for (const f of n.flavor || []) {
          if (meetsReq(st, f.cond).ok) text += "\n\n" + f.text;
        }
        const options = (n.options || []).map((o) => {
          const need = o.need ? meetsReq(st, o.need) : { ok: true };
          return {
            text: o.text,
            cost: fmt(neg(o.lose)),
            odds: rollOdds(st, o.odds),
            locked: !need.ok,
            lockText: need.ok ? "" : `需 ${clauseText(o.need)}`,
          };
        });
        return {
          finished: false,
          node: { id: n.id || st.nodeId, title: n.title, age: n.age, text },
          gate: n.require ? { ok: g.ok, label: g.label, current: g.current, kind: n.gate } : null,
          options,
        };
      },
      pick(i) {
        if (st.finished) return { error: "命途已终" };
        const n = st.tree.NODES[st.nodeId];
        const opt = (n.options || [])[i];
        if (!opt) return { error: "选项不存在" };
        if (opt.need && !meetsReq(st, opt.need).ok) return { error: "条件不足" };

        st.stats.choices++;
        applyAttrs(st, opt.gain);
        applyAttrs(st, neg(opt.lose));

        // 掷上/中/下签（按属性修正后的概率，与卡面显示一致）
        const adjusted = rollOdds(st, opt.odds);
        const point = st.rng() * 100;
        let acc = 0, hit = adjusted[adjusted.length - 1];
        for (const x of adjusted) {
          acc += x.pct;
          if (point < acc) { hit = x; break; }
        }
        const roll = opt.odds[hit.idx];
        applyAttrs(st, roll.bonus);
        if (roll.tier === "good") st.stats.good++;
        else if (roll.tier === "bad") st.stats.bad++;
        else st.stats.mid++;

        // 汇总本选项的净属性变化（得 + 舍 + 签加成），相互抵消的不显示
        const net = {};
        [opt.gain, neg(opt.lose), roll.bonus].forEach((eff) => {
          for (const [k, v] of Object.entries(eff || {})) net[k] = (net[k] || 0) + v;
        });
        for (const k of Object.keys(net)) if (net[k] === 0) delete net[k];

        st.skips = [];
        const go = roll.goto || opt.goto;
        arrive(st, go, st.skips);
        return {
          roll: {
            tier: roll.tier,
            text: roll.text,
            effects: fmt(roll.bonus).join(" · "),
          },
          gains: fmt(opt.gain),
          losses: fmt(neg(opt.lose)),
          changes: fmt(net),
          skips: st.skips.slice(),
        };
      },
    };
    return api;
  }

  /* ---------------- 数据校验 / 全路径遍历（测试用） ---------------- */
  function validate(tree) {
    const errors = [];
    const TIER = { good: 1, mid: 1, bad: 1 };
    for (const [id, n] of Object.entries(tree.NODES)) {
      if (!n.title || !n.text) errors.push(`${id}: 缺少标题或正文`);
      if (!n.options || n.options.length < 1) errors.push(`${id}: 至少一个选项`);
      for (const f of n.flavor || []) {
        if (!f.cond || !Array.isArray(f.cond.stats) || typeof f.cond.value !== "number") {
          errors.push(`${id}: 非法 flavor cond`);
        }
      }
      for (const o of n.options || []) {
        if (!o.goto && !(o.odds || []).every((x) => x.goto)) errors.push(`${id}: 选项既无 goto 也非全签分支`);
        const sum = (o.odds || []).reduce((s, x) => s + (x.p || 0), 0);
        if (sum !== 100) errors.push(`${id}: 选项概率合计 ${sum}，应为 100`);
        for (const x of o.odds || []) {
          if (!TIER[x.tier]) errors.push(`${id}: 非法 tier ${x.tier}`);
          if (x.goto && !tree.NODES[x.goto] && !tree.ENDINGS[x.goto]) errors.push(`${id}: 未知去向 ${x.goto}`);
        }
        if (o.goto && !tree.NODES[o.goto] && !tree.ENDINGS[o.goto]) errors.push(`${id}: 未知去向 ${o.goto}`);
      }
      if (n.gate === "death" && !n.failText) errors.push(`${id}: 死关缺少 failText`);
      if (n.gate === "skip" && !n.failGoto) errors.push(`${id}: 凡关缺少 failGoto`);
    }
    return { ok: errors.length === 0, errors };
  }

  /** 结构遍历：忽略属性，枚举所有选择/签分支，返回可达节点与结局 */
  function walk(tree) {
    const nodes = new Set(), endings = new Set();
    const seen = new Set();
    const stack = [tree.START_NODE];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      if (tree.ENDINGS[id]) { endings.add(id); continue; }
      const n = tree.NODES[id];
      if (!n) continue;
      nodes.add(id);
      for (const o of n.options || []) {
        if (o.goto) stack.push(o.goto);
        for (const x of o.odds || []) if (x.goto) stack.push(x.goto);
      }
      if (n.gate === "skip" && n.failGoto) stack.push(n.failGoto);
    }
    return { nodes: [...nodes], endings: [...endings] };
  }

  return { createRun, validate, walk, meetsReq, TIER_NAME: { good: "上签", mid: "平", bad: "下签" } };
});
