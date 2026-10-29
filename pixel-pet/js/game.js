// ============ 存档与状态 ============
const SAVE_KEY = 'pixelPetSave_v1';

function newPet(lineKey, name) {
  const sp = SPECIES[lineKey];
  return {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'pet_' + Date.now() + '_' + Math.floor(Math.random() * 1e9),
    line: lineKey,
    name: name || sp.stages[0].name,
    level: 1,
    exp: 0,
    hunger: 80,   // 饱食度
    mood: 80,     // 心情
    clean: 80,    // 清洁
    energy: 80,   // 体力
    equips: {},   // slot -> equipKey
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { coins: 50, bag: {}, pets: [], activeId: null };
}

let S = loadState();
function save() { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }

function activePet() { return S.pets.find(p => p.id === S.activeId) || null; }

function petStats(p) {
  const sp = SPECIES[p.line];
  const stageIdx = evolutionIndex(p);
  const st = sp.stages[stageIdx];
  let hp = sp.base.hp + p.level * 3 + stageIdx * 8;
  let atk = sp.base.atk + p.level + stageIdx * 2;
  let def = sp.base.def + Math.floor(p.level / 2) + stageIdx;
  let spd = sp.base.spd + Math.floor(p.level / 3) + stageIdx;
  let luck = 0;
  for (const slot in p.equips) {
    const e = EQUIPS[p.equips[slot]];
    if (!e) continue;
    atk += e.atk || 0; def += e.def || 0; luck += e.luck || 0;
  }
  return { hp, atk, def, spd, luck, stageName: st.name };
}

function evolutionIndex(p) {
  const st = SPECIES[p.line].stages;
  let idx = 0;
  for (let i = 1; i < st.length; i++) {
    if (p.level >= st[i].evolveLv) idx = i;
  }
  return idx;
}

function expNeeded(p) { return 10 + p.level * 8; }

function gainExp(p, n) {
  p.exp += n;
  const log = [];
  while (p.exp >= expNeeded(p)) {
    p.exp -= expNeeded(p);
    p.level++;
    log.push(`⬆ ${p.name} 升到了 Lv.${p.level}！`);
    const idx = evolutionIndex(p);
    const st = SPECIES[p.line].stages[idx];
    if (st.name !== p.name) {
      log.push(`✨ ${p.name} 进化成了 ${st.name}！`);
      p.name = st.name;
    }
  }
  return log;
}

// ============ 像素画渲染 ============
function drawSprite(canvas, spriteKey, scale = 6) {
  const rows = SPRITES[spriteKey];
  const w = rows[0].length, h = rows.length;
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      if (c === '.' || !PAL[c]) continue;
      ctx.fillStyle = PAL[c];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

function petSpriteKey(p) {
  return SPECIES[p.line].stages[evolutionIndex(p)].key;
}

// ============ UI 基础 ============
const $ = sel => document.querySelector(sel);

function log(msg) {
  const box = $('#log');
  const div = document.createElement('div');
  div.className = 'logline';
  div.textContent = msg;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  while (box.children.length > 80) box.removeChild(box.firstChild);
}

function setMenu(title, items) {
  $('#menuTitle').textContent = title;
  const box = $('#menu');
  box.innerHTML = '';
  items.forEach((it, i) => {
    const b = document.createElement('button');
    b.className = 'menu-item';
    b.innerHTML = `<span class="idx">${i + 1}.</span> ${it.label}`;
    b.onclick = it.action;
    box.appendChild(b);
  });
}

function showMain() {
  battle = null;
  $('#enemyPanel').classList.add('hidden');
  save();
  const p = activePet();
  renderPet(p);
  const items = [];
  if (!p) {
    items.push({ label: '🐾 选择/捕捉宠物', action: showCatch });
  } else {
    items.push({ label: '🍖 养成', action: showCare });
    items.push({ label: '✨ 进化/查看状态', action: showStatus });
    items.push({ label: '⚔️ 装备', action: showEquip });
    items.push({ label: '🗺️ 探索打怪', action: showExplore });
    items.push({ label: '🔄 更换宠物', action: showCatch });
  }
  items.push({ label: '💾 清空存档', action: () => {
    if (confirm('确定清空所有存档？')) { localStorage.removeItem(SAVE_KEY); S = loadState(); log('存档已清空'); showMain(); }
  }});
  setMenu('主菜单', items);
  $('#coins').textContent = S.coins;
}

function renderPet(p) {
  const cv = $('#petCanvas');
  if (!p) { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); $('#petInfo').textContent = '（还没有宠物，去捕捉一只吧！）'; return; }
  drawSprite(cv, petSpriteKey(p));
  const st = petStats(p);
  $('#petInfo').innerHTML =
    `${p.name} Lv.${p.level}<br>` +
    `❤️HP ${st.hp} ⚔️ATK ${st.atk} 🛡️DEF ${st.def} 🍀LUCK ${st.luck}<br>` +
    `EXP ${p.exp}/${expNeeded(p)}<br>` +
    bar('饱食', p.hunger) + bar('心情', p.mood) + bar('清洁', p.clean) + bar('体力', p.energy);
}
function bar(label, v) {
  v = Math.max(0, Math.min(100, v));
  return `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${v}%"></i></div></div>`;
}

// ============ 抓宠/选择宠物 ============
function showCatch() {
  const wilds = Object.keys(SPECIES).filter(k => SPECIES[k].wild);
  setMenu('捕捉宠物', [
    ...wilds.map(k => ({
      label: `🎯 野外寻找 ${SPECIES[k].name}（消耗 10 金币）`,
      action: () => {
        if (S.coins < 10) { log('金币不足！'); return; }
        S.coins -= 10;
        const ok = Math.random() < 0.6;
        if (ok) {
          const pet = newPet(k);
          S.pets.push(pet);
          S.activeId = pet.id;
          log(`🎉 成功捕获了 ${SPECIES[k].name}！它加入了你的队伍。`);
        } else {
          log('💭 它逃走了……再试一次吧。');
        }
        showMain();
      }
    })),
    ...S.pets.map(p => ({
      label: `▶ 设为主战：${p.name} Lv.${p.level}`,
      action: () => { S.activeId = p.id; log(`已选择 ${p.name}`); showMain(); }
    })),
    { label: '⬅ 返回主菜单', action: showMain },
  ]);
}

// ============ 养成 ============
function showCare() {
  const p = activePet();
  if (!p) { log('先去捕捉一只宠物！'); return showMain(); }
  setMenu('养成', [
    { label: '🍖 喂食（饱食+30，3 金币）', action: () => doCare(p, 'hunger', 30, 3) },
    { label: '🛁 清洁（清洁+30，2 金币）', action: () => doCare(p, 'clean', 30, 2) },
    { label: '🎾 玩耍（心情+30，体力-15，2 金币）', action: () => {
      if (S.coins < 2) return log('金币不足！');
      if (p.energy < 15) return log('它太累了，让它休息吧。');
      S.coins -= 2; p.mood += 30; p.energy -= 15; p.exp += 2;
      log(`${p.name} 玩得很开心！心情+30`);
      decay(p); showMain();
    }},
    { label: '😴 休息（体力+50）', action: () => {
      p.energy += 50; log(`${p.name} 睡了个好觉，体力恢复了不少。`);
      decay(p); showMain();
    }},
    { label: '⬅ 返回', action: showMain },
  ]);
}
function doCare(p, stat, amt, cost) {
  if (S.coins < cost) return log('金币不足！');
  S.coins -= cost;
  p[stat] += amt;
  p.exp += 1;
  log(`照顾了 ${p.name}，${stat === 'hunger' ? '饱食' : '清洁'}+${amt}`);
  decay(p); showMain();
}
// 随时间轻微衰减，逼玩家照顾
function decay(p) {
  p.hunger -= 3; p.clean -= 2; p.mood -= 2;
  p.hunger = Math.max(0, Math.min(100, p.hunger));
  p.clean = Math.max(0, Math.min(100, p.clean));
  p.mood = Math.max(0, Math.min(100, p.mood));
  p.energy = Math.max(0, Math.min(100, p.energy));
}

// ============ 状态/进化 ============
function showStatus() {
  const p = activePet();
  if (!p) { log('先去捕捉一只宠物！'); return showMain(); }
  const st = petStats(p);
  const sp = SPECIES[p.line];
  const idx = evolutionIndex(p);
  const next = sp.stages[idx + 1];
  setMenu(`${p.name} 的状态`, [
    { label: `ℹ️ ${st.stageName} · Lv.${p.level} · HP${st.hp} ATK${st.atk} DEF${st.def}`, action: () => {} },
    { label: next ? `✨ 下次进化：${next.name}（需 Lv.${next.evolveLv}）` : '🌟 已是最终形态', action: () => {} },
    { label: '🧪 训练（体力-20，获得大量经验）', action: () => {
      if (p.energy < 20) return log('体力不足，先休息吧。');
      p.energy -= 20; p.hunger -= 8;
      const logs = gainExp(p, 12);
      log(`训练完成！`); logs.forEach(l => log(l));
      showMain();
    }},
    { label: '⬅ 返回', action: showMain },
  ]);
}

// ============ 装备 ============
function showEquip() {
  const p = activePet();
  if (!p) { log('先去捕捉一只宠物！'); return showMain(); }
  const items = [];
  for (const key in EQUIPS) {
    const e = EQUIPS[key];
    const bonus = e.atk ? `ATK+${e.atk}` : e.def ? `DEF+${e.def}` : `LUCK+${e.luck}`;
    const owned = S.bag[key] > 0;
    const equipped = Object.values(p.equips).includes(key);
    if (equipped) {
      items.push({ label: `✔ ${e.name}（${bonus}）已装备 - 点击卸下`, action: () => {
        for (const slot in p.equips) if (p.equips[slot] === key) delete p.equips[slot];
        log(`卸下了 ${e.name}`); showEquip();
      }});
    } else if (owned) {
      items.push({ label: `🎒 ${e.name}（${bonus}）×${S.bag[key]} - 装备`, action: () => {
        p.equips[e.slot] = key; S.bag[key]--;
        log(`装备了 ${e.name}！`); showEquip();
      }});
    } else {
      items.push({ label: `🛒 ${e.name}（${bonus}）${e.price} 金币 - 购买`, action: () => {
        if (S.coins < e.price) return log('金币不足！');
        S.coins -= e.price; S.bag[key] = (S.bag[key] || 0) + 1;
        log(`买到了 ${e.name}！`); showEquip();
      }});
    }
  }
  items.push({ label: '⬅ 返回', action: showMain });
  setMenu('装备商店 / 装备管理', items);
}

// ============ 探索打怪 ============
let battle = null;

function showExplore() {
  const p = activePet();
  if (!p) { log('先去捕捉一只宠物！'); return showMain(); }
  if (p.energy < 20) { log('体力不足（需要 20），先让它休息。'); return showMain(); }
  p.energy -= 20;
  const e = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
  battle = { pet: p, petHp: petStats(p).hp, enemy: { ...e, maxHp: e.hp }, turn: 'pet' };
  $('#enemyPanel').classList.remove('hidden');
  drawSprite($('#enemyCanvas'), e.spr, 5);
  $('#enemyInfo').textContent = `野生 ${e.name} 出现了！`;
  // 速度决定先手：敌人更快则抢先攻击（PokéRogue/宝可梦规则）
  if (e.spd > petStats(p).spd) {
    log(`${e.name} 速度更快，抢先出手！`);
    enemyTurn();
  } else if (petStats(p).spd > e.spd) {
    log(`${p.name} 抢先占得先机！`);
  }
  if (battle) battleMenu();
}

// 敌方回合（选招 + 属性克制 + 会心）
function enemyTurn() {
  const b = battle; if (!b) return;
  const p = b.pet, e = b.enemy;
  const st = petStats(p);
  const move = enemyPickMove(e);
  const mult = typeMult(e.type, SPECIES[p.line].type);
  const { dmg: edmg, crit: ecrit } = calcDamage(e.atk, st.def, mult, move.mult);
  b.petHp -= edmg;
  let msg = `${e.name} 使出「${move.name}」！`;
  if (mult > 1) msg += '效果绝佳！';
  if (mult < 1) msg += '效果不太理想……';
  if (ecrit) msg += '会心一击！💥';
  msg += `${p.name} 受到 ${edmg} 伤害。（HP ${Math.max(0, b.petHp)}/${st.hp}）`;
  log(msg);
  if (b.petHp <= 0) {
    log(`💤 ${p.name} 倒下了……被送回了家（无大碍，但本次探索结束）`);
    p.energy = Math.max(0, p.energy - 10);
    battle = null; showMain();
  }
}

function battleMenu() {
  const b = battle, p = b.pet, e = b.enemy;
  const st = petStats(p);
  const eff = typeMult(SPECIES[p.line].type, e.type);
  const effTxt = eff > 1 ? '（属性克制中，占上风 ✓）' : eff < 1 ? '（被对方克制 ⚠）' : '';
  $('#enemyInfo').textContent = `${e.name} HP ${e.hp}/${e.maxHp} · ⚔️${e.atk} 🛡️${e.def} ${effTxt}`;
  setMenu('⚔️ 战斗', [
    { label: '🗡️ 攻击', action: () => battleAction('atk') },
    { label: `💥 技能（消耗 15 体力，威力 x2）`, action: () => battleAction('skill') },
    { label: '🧢 尝试捕捉（幸运越高越容易）', action: () => battleAction('catch') },
    { label: '🏃 逃跑', action: () => { log('逃跑了……'); battle = null; showMain(); } },
  ]);
  $('#petInfo').innerHTML = `${p.name} HP ${b.petHp}/${st.hp} ⚔️${st.atk} 🛡️${st.def} ⚡${st.spd}<br>` + bar('体力', p.energy);
}

// 通用伤害计算（学习自宝可梦公式）：基础伤害 x 随机波动 x 属性克制，1/16 概率会心一击 x1.5
function calcDamage(atk, def, mult, power) {
  let dmg = Math.max(1, Math.round((atk * power - def) * (0.85 + Math.random() * 0.3) * mult));
  let crit = false;
  if (Math.random() < 1 / 16) { crit = true; dmg = Math.round(dmg * 1.5); }
  return { dmg, crit };
}

// 敌方 AI：SMART_RANDOM 简化版——按招式权重随机选招
function enemyPickMove(e) {
  const total = e.moves.reduce((s, m) => s + m.weight, 0);
  let r = Math.random() * total;
  for (const m of e.moves) { r -= m.weight; if (r <= 0) return m; }
  return e.moves[0];
}

function battleAction(kind) {
  const b = battle; if (!b) return;
  const p = b.pet, e = b.enemy;
  const st = petStats(p);
  const petType = SPECIES[p.line].type;
  if (kind === 'catch') {
    const chance = 0.15 + st.luck * 0.08 + (1 - e.hp / e.maxHp) * 0.45;
    if (Math.random() < chance) {
      const caught = newPet(p.line);
      S.pets.push(caught);
      log(`🧢 捕捉成功！获得了一只新的 ${SPECIES[p.line].stages[0].name}！`);
      battle = null; return showMain();
    } else {
      log('捕捉失败了……');
    }
  } else {
    let power, name;
    if (kind === 'skill') {
      if (p.energy < 15) return log('体力不足，无法使用技能！');
      p.energy -= 15;
      power = 2; name = '强力技能';
    } else {
      power = 1; name = '攻击';
    }
    const mult = typeMult(petType, e.type);
    const { dmg, crit } = calcDamage(st.atk, e.def, mult, power);
    e.hp -= dmg;
    let msg = `${p.name} 使出${name}！`;
    if (mult > 1) msg += '效果绝佳！';
    if (mult < 1) msg += '效果不太理想……';
    if (crit) msg += '会心一击！💥';
    msg += `造成 ${dmg} 伤害。`;
    log(msg);
    if (e.hp <= 0) {
      log(`🎉 击败了 ${e.name}！获得 ${e.exp} 经验、${e.coins} 金币。`);
      S.coins += e.coins;
      gainExp(p, e.exp).forEach(l => log(l));
      battle = null; return showMain();
    }
  }
  // 敌人回合
  enemyTurn();
  if (battle) battleMenu();
}

// ============ 启动 ============
showMain();
log('欢迎来到像素宠物！先去「捕捉宠物」获得你的第一只伙伴吧。');
