// ============================================================
// 云顶之弈 S1 翻版 —— 数据文件 (基于 Set 1 最终版 9.19 整理)
// tier: 费用 1-5; origin: 起源; class: 职业
// hp/ad/as/arm/mr/range: 1星数值; 星级成长: 血 x1.8, 攻 x1.5
// ============================================================

const ORIGINS = {
  Demon:    { zh:"恶魔",   tiers:[2,4,6],  desc:["燃烧敌人法力","燃烧敌人法力","燃烧敌人法力"] },
  Dragon:   { zh:"龙族",   tiers:[2],      desc:["获得75%魔法伤害减免"] },
  Exile:    { zh:"浪人",   tiers:[1],      desc:["战斗开始获得最大生命值的护盾"] },
  Glacial:  { zh:"冰川",   tiers:[2,4,6],  desc:["20%几率冰冻1.5秒","30%几率冰冻1.5秒","45%几率冰冻1.5秒"] },
  Hextech:  { zh:"海克斯", tiers:[2,4],    desc:["禁用2个随机敌人的装备","禁用4个随机敌人的装备"] },
  Imperial: { zh:"帝国",   tiers:[2,4],    desc:["1个随机帝国单位伤害翻倍","所有帝国单位伤害翻倍"] },
  Ninja:    { zh:"忍者",   tiers:[1,4],    desc:["唯一的忍者+40攻击力","所有忍者+80攻击力"] },
  Noble:    { zh:"贵族",   tiers:[3,6],    desc:["1个随机贵族+100护甲/魔抗且回血","所有贵族+100护甲/魔抗且回血"] },
  Phantom:  { zh:"幻影",   tiers:[2],      desc:["开局诅咒生命值最低的敌人"] },
  Pirate:   { zh:"海盗",   tiers:[3],      desc:["战胜玩家获得额外金币"] },
  Robot:    { zh:"机器人", tiers:[1],      desc:["战斗开始时法力值全满"] },
  Void:     { zh:"虚空",   tiers:[2],      desc:["虚空单位造成真实伤害"] },
  Wild:     { zh:"野性",   tiers:[2,4],    desc:["野性单位攻速可叠加(最高+10%×5)","所有友军攻速可叠加"] },
  Yordle:   { zh:"约德尔", tiers:[3,6],    desc:["25%闪避几率","45%闪避几率"] },
};

const CLASSES = {
  Assassin:     { zh:"刺客",     tiers:[3,6],    desc:["+150%暴击伤害","暴击伤害+150%且刺客获得额外伤害","暴击伤害+350%"] },
  Blademaster:  { zh:"剑士",     tiers:[3,6],    desc:["35%几率额外攻击","65%几率额外攻击"] },
  Brawler:      { zh:"斗士",     tiers:[2,4],    desc:["额外+300最大生命","额外+700最大生命"] },
  Elementalist: { zh:"元素使",   tiers:[3],      desc:["召唤元素之灵参战"] },
  Guardian:     { zh:"守护者",   tiers:[2],      desc:["自身及相邻友军+30护甲"] },
  Gunslinger:   { zh:"枪手",     tiers:[2,4,6],  desc:["50%几率额外射击","75%几率额外射击2次","100%几率额外射击3次"] },
  Knight:       { zh:"骑士",     tiers:[2,4,6],  desc:["格挡15点伤害","格挡30点伤害","格挡55点伤害"] },
  Ranger:       { zh:"游侠",     tiers:[2,4],    desc:["1秒后+40%攻速","1秒后+100%攻速"] },
  Shapeshifter: { zh:"变形师",   tiers:[3],      desc:["变形时额外+60%最大生命"] },
  Sorcerer:     { zh:"法师",     tiers:[3,6],    desc:["+45%法术强度","+100%法术强度"] },
};

// ============ 棋子 (1星数值, 取自官方维基 S1 数据模块及 9.19 整理) ============
// dmg: 技能魔法伤害 [1星,2星,3星]; stun: 技能眩晕秒数; tgt: 技能目标数; aoe: 溅射半径(hex)
const CHAMPS = [
  // ---- 1费 ----
  {n:"Darius",   zh:"德莱厄斯", t:1, o:["Imperial"], c:["Knight"],       hp:600, ad:60, as:.6, rng:1, arm:35, mana:50, mr:20,  dmg:[150,225,450]},
  {n:"Fiora",    zh:"菲奥娜",   t:1, o:["Noble"],    c:["Blademaster"],  hp:450, ad:55, as:.7, rng:1, arm:35, mana:100, mr:20, dmg:[100,175,350]},
  {n:"Garen",    zh:"盖伦",     t:1, o:["Noble"],    c:["Knight"],       hp:600, ad:60, as:.6, rng:1, arm:35, mana:100, mr:20, dmg:[300,450,900]},
  {n:"Kassadin", zh:"卡萨丁",   t:1, o:["Void"],     c:["Sorcerer"],     hp:550, ad:65, as:.6, rng:1, arm:35, mana:60, mr:20,  dmg:[200,325,650]},
  {n:"Kha'Zix",  zh:"卡兹克",   t:1, o:["Void"],     c:["Assassin"],     hp:500, ad:55, as:.65,rng:1, arm:20, mana:60, mr:20,  dmg:[150,225,450]},
  {n:"Mordekaiser", zh:"莫德凯撒", t:1, o:["Phantom"], c:["Knight"],    hp:550, ad:60, as:.6, rng:1, arm:35, mana:75, mr:20,  dmg:[200,325,650]},
  {n:"Nidalee",  zh:"奈德丽",   t:1, o:["Wild"],     c:["Shapeshifter"], hp:600, ad:60, as:.65,rng:3, arm:20, mana:90, mr:20,  dmg:[60,110,220]},
  {n:"Poppy",    zh:"波比",     t:1, o:["Yordle"],   c:["Knight"],       hp:650, ad:50, as:.6, rng:1, arm:40, mana:100, mr:20, dmg:[300,450,900]},
  {n:"Tristana", zh:"崔丝塔娜", t:1, o:["Yordle"],   c:["Gunslinger"],   hp:500, ad:50, as:.65,rng:4, arm:20, mana:50, mr:20,  dmg:[120,180,360]},
  {n:"Vayne",    zh:"薇恩",     t:1, o:["Noble"],    c:["Ranger"],       hp:550, ad:55, as:.7, rng:4, arm:20, mana:75, mr:20,  dmg:[80,120,240]},
  {n:"Warwick",  zh:"沃里克",   t:1, o:["Wild"],     c:["Brawler"],      hp:600, ad:55, as:.6, rng:1, arm:30, mana:75, mr:20,  dmg:[200,300,600]},
  // ---- 2费 ----
  {n:"Ahri",     zh:"阿狸",     t:2, o:["Wild"],     c:["Sorcerer"],     hp:450, ad:50, as:.55,rng:3, arm:20, mana:75, mr:20,  dmg:[175,250,375]},
  {n:"Blitzcrank", zh:"布里茨", t:2, o:["Robot"],    c:["Brawler"],      hp:650, ad:55, as:.6, rng:1, arm:30, mana:125, mr:20, dmg:[250,375,750]},
  {n:"Braum",    zh:"布隆",     t:2, o:["Glacial"],  c:["Guardian"],     hp:750, ad:50, as:.6, rng:1, arm:50, mana:75, mr:20,  dmg:[175,300,600]},
  {n:"Graves",   zh:"格雷福斯", t:2, o:["Pirate"],   c:["Gunslinger"],   hp:600, ad:60, as:.6, rng:1, arm:40, mana:50, mr:20,  dmg:[150,225,450]},
  {n:"Jayce",    zh:"杰斯",     t:2, o:["Hextech"],  c:["Shapeshifter"], hp:650, ad:60, as:.65,rng:1, arm:35, mana:100, mr:20, dmg:[200,325,650]},
  {n:"Lissandra",zh:"丽桑卓",   t:2, o:["Glacial"],  c:["Elementalist"], hp:450, ad:50, as:.6, rng:3, arm:20, mana:75, mr:20,  dmg:[175,250,375], stun:1.5},
  {n:"Lucian",   zh:"卢锡安",   t:2, o:["Noble"],    c:["Gunslinger"],   hp:600, ad:65, as:.65,rng:4, arm:25, mana:50, mr:20,  dmg:[150,225,450]},
  {n:"Pyke",     zh:"派克",     t:2, o:["Pirate"],   c:["Assassin"],     hp:600, ad:60, as:.65,rng:1, arm:25, mana:75, mr:20,  dmg:[150,200,350], stun:2},
  {n:"Rek'Sai",  zh:"雷克塞",   t:2, o:["Void"],     c:["Brawler"],      hp:650, ad:60, as:.6, rng:1, arm:35, mana:100, mr:20, dmg:[175,300,600]},
  {n:"Shen",     zh:"慎",       t:2, o:["Ninja"],    c:["Blademaster"],  hp:650, ad:65, as:.65,rng:1, arm:45, mana:100, mr:20, dmg:[150,250,500]},
  {n:"Volibear", zh:"沃利贝尔", t:2, o:["Glacial"],  c:["Brawler"],      hp:700, ad:70, as:.6, rng:1, arm:35, mana:100, mr:20, dmg:[200,325,650]},
  {n:"Zed",      zh:"劫",       t:2, o:["Ninja"],    c:["Assassin"],     hp:600, ad:70, as:.65,rng:1, arm:25, mana:75, mr:20,  dmg:[150,225,450]},
  // ---- 3费 ----
  {n:"Aatrox",   zh:"亚托克斯", t:3, o:["Demon"],    c:["Blademaster"],  hp:700, ad:65, as:.65,rng:1, arm:35, mana:75, mr:20,  dmg:[300,600,900]},
  {n:"Ashe",     zh:"艾希",     t:3, o:["Glacial"],  c:["Ranger"],       hp:550, ad:65, as:.7, rng:4, arm:20, mana:125, mr:20, dmg:[200,400,600], stun:2},
  {n:"Camille",  zh:"卡蜜尔",   t:3, o:["Hextech"],  c:["Blademaster"],  hp:600, ad:75, as:.65,rng:1, arm:35, mana:75, mr:20,  dmg:[250,400,800]},
  {n:"Cho'Gath", zh:"科加斯",   t:3, o:["Void"],     c:["Brawler"],      hp:800, ad:75, as:.6, rng:1, arm:30, mana:150, mr:20, dmg:[350,500,1000]},
  {n:"Evelynn",  zh:"伊芙琳",   t:3, o:["Demon"],    c:["Assassin"],     hp:600, ad:70, as:.65,rng:1, arm:20, mana:75, mr:20,  dmg:[200,275,350]},
  {n:"Gangplank",zh:"普朗克",   t:3, o:["Pirate"],   c:["Gunslinger","Blademaster"], hp:700, ad:70, as:.6, rng:1, arm:45, mana:100, mr:20, dmg:[200,300,500], aoe:2},
  {n:"Katarina", zh:"卡特琳娜", t:3, o:["Imperial"], c:["Assassin"],     hp:600, ad:65, as:.65,rng:3, arm:20, mana:100, mr:20, dmg:[350,500,700]},
  {n:"Kennen",   zh:"凯南",     t:3, o:["Ninja"],    c:["Elementalist"], hp:650, ad:60, as:.6, rng:3, arm:35, mana:100, mr:20, dmg:[300,400,500], aoe:1, stun:1.5},
  {n:"Lulu",     zh:"璐璐",     t:3, o:["Yordle"],   c:["Sorcerer"],     hp:500, ad:50, as:.6, rng:3, arm:20, mana:100, mr:20, dmg:[200,300,600]},
  {n:"Morgana",  zh:"莫甘娜",   t:3, o:["Demon"],    c:["Sorcerer"],     hp:650, ad:55, as:.6, rng:3, arm:20, mana:100, mr:20, dmg:[300,400,500], aoe:1},
  {n:"Rengar",   zh:"雷恩加尔", t:3, o:["Wild"],     c:["Assassin"],     hp:600, ad:70, as:.65,rng:1, arm:30, mana:75, mr:20,  dmg:[150,225,450]},
  {n:"Shyvana",  zh:"希瓦娜",   t:3, o:["Dragon"],   c:["Shapeshifter"], hp:650, ad:70, as:.7, rng:1, arm:30, mana:100, mr:20, dmg:[300,450,900]},
  {n:"Veigar",   zh:"维迦",     t:3, o:["Yordle"],   c:["Sorcerer"],     hp:500, ad:50, as:.55,rng:3, arm:20, mana:75, mr:20,  dmg:[350,650,1000]},
  {n:"Vi",       zh:"蔚",       t:3, o:["Hextech"],  c:["Brawler"],      hp:650, ad:70, as:.65,rng:1, arm:40, mana:150, mr:20, dmg:[250,350,700], stun:1.5},
  // ---- 4费 ----
  {n:"Akali",    zh:"阿卡丽",   t:4, o:["Ninja"],    c:["Assassin"],     hp:600, ad:80, as:.85,rng:1, arm:20, mana:75, mr:20,  dmg:[250,400,800]},
  {n:"Aurelion Sol", zh:"铸星龙王", t:4, o:["Dragon"], c:["Sorcerer"],   hp:600, ad:60, as:.7, rng:3, arm:20, mana:100, mr:20, dmg:[400,600,1200]},
  {n:"Brand",    zh:"布兰德",   t:4, o:["Demon"],    c:["Elementalist"], hp:600, ad:60, as:.6, rng:4, arm:20, mana:100, mr:20, dmg:[350,500,1000], aoe:1},
  {n:"Draven",   zh:"德莱文",   t:4, o:["Imperial"], c:["Blademaster"],  hp:700, ad:80, as:.75,rng:3, arm:25, mana:75, mr:20,  dmg:[300,450,900]},
  {n:"Gnar",     zh:"纳尔",     t:4, o:["Wild","Yordle"], c:["Shapeshifter"], hp:700, ad:70, as:.7, rng:3, arm:25, mana:100, mr:20, dmg:[300,400,800], stun:1.5},
  {n:"Jinx",     zh:"金克丝",   t:4, o:["Hextech"],  c:["Gunslinger"],   hp:650, ad:75, as:.75,rng:4, arm:20, mana:100, mr:20, dmg:[300,450,900]},
  {n:"Kindred",  zh:"千珏",     t:4, o:["Phantom"],  c:["Ranger"],       hp:600, ad:65, as:.7, rng:4, arm:20, mana:75, mr:20,  dmg:[250,350,700]},
  {n:"Leona",    zh:"蕾欧娜",   t:4, o:["Noble"],    c:["Guardian"],     hp:800, ad:60, as:.6, rng:1, arm:60, mana:100, mr:20, dmg:[300,450,900]},
  {n:"Sejuani",  zh:"瑟庄妮",   t:4, o:["Glacial"],  c:["Knight"],       hp:800, ad:65, as:.6, rng:1, arm:50, mana:150, mr:20, dmg:[250,350,700], aoe:1, stun:2},
  {n:"Swain",    zh:"斯维因",   t:4, o:["Imperial","Demon"], c:["Shapeshifter"], hp:850, ad:65, as:.65,rng:1, arm:40, mana:150, mr:20, dmg:[350,500,1000]},
  // ---- 5费 ----
  {n:"Anivia",   zh:"艾尼维亚", t:5, o:["Glacial"],  c:["Elementalist"], hp:600, ad:60, as:.6, rng:4, arm:25, mana:125, mr:20, dmg:[400,600,1200], stun:1.5},
  {n:"Karthus",  zh:"卡尔萨斯", t:5, o:["Phantom"],  c:["Sorcerer"],     hp:650, ad:65, as:.7, rng:4, arm:25, mana:100, mr:20, dmg:[350,550,1100]},
  {n:"Kayle",    zh:"凯尔",     t:5, o:["Noble"],    c:["Knight"],       hp:800, ad:70, as:.75,rng:3, arm:35, mana:100, mr:20, dmg:[400,600,1200]},
  {n:"Miss Fortune", zh:"厄运小姐", t:5, o:["Pirate"], c:["Gunslinger"], hp:700, ad:75, as:.75,rng:4, arm:30, mana:125, mr:20, dmg:[400,600,1200], aoe:1},
  {n:"Pantheon", zh:"潘森",     t:5, o:["Dragon"],   c:["Guardian"],     hp:850, ad:80, as:.7, rng:1, arm:60, mana:100, mr:20, dmg:[400,600,1200], stun:2},
  {n:"Yasuo",    zh:"亚索",     t:5, o:["Exile"],    c:["Blademaster"],  hp:700, ad:80, as:.75,rng:1, arm:35, mana:75, mr:20,  dmg:[300,450,900]},
];

// ============ 商店概率表 (来自官方数据) ============
const SHOP_ODDS = {
  1:[100,0,0,0,0], 2:[100,0,0,0,0], 3:[75,25,0,0,0], 4:[55,30,15,0,0],
  5:[45,33,20,2,0], 6:[30,40,25,5,0], 7:[19,30,40,10,1], 8:[15,20,32,30,3],
  9:[10,17,25,33,15],
};
const POOL_SIZE = {1:30, 2:25, 3:18, 4:10, 5:9};   // 每张卡在卡池中的数量
const XP_NEEDED = {2:2, 3:6, 4:10, 5:20, 6:36, 7:56, 8:80, 9:100}; // 升到该级累计所需经验
const BOARD_SIZE = 9;   // 简化棋盘: 每方最多上阵棋子 = 玩家等级
