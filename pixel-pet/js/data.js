// ============ 像素画调色板 ============
// 每个字符对应一种颜色，'.' 为透明
const PAL = {
  k: '#1a1c2c', // 描边黑
  w: '#f4f4f4', // 白
  g: '#38c76a', // 绿
  G: '#1a7a3c', // 深绿
  b: '#3b9dde', // 蓝
  B: '#1d5fa8', // 深蓝
  y: '#fcd44c', // 黄
  o: '#f2953f', // 橙
  r: '#d9405c', // 红
  p: '#9d6cf0', // 紫
  P: '#5a34a8', // 深紫
  s: '#c0cbdc', // 银灰
  S: '#6b7285', // 深灰
  n: '#a5704a', // 棕
};

// ============ 宠物像素画（16x16）============
// 每条进化链 3 个阶段
const SPRITES = {
  spark1: [
    '................',
    '................',
    '................',
    '.....kkkk.......',
    '....kyyyyk......',
    '...kywyyyyk.....',
    '...kyyyyyyk.....',
    '...kykyykyk.....',
    '...kyyyyyyk..k..',
    '....kyyyyk..kyk.',
    '...kkyyyykk.yk..',
    '..kyykyykyykyk..',
    '..kyyyyyyyyk.k..',
    '...kkyyyykk.....',
    '.....kkkk.......',
    '................',
  ],
  spark2: [
    '................',
    '.....kkkk.......',
    '....kyyyyk..kk..',
    '...kywyyyyk.kyk.',
    '...kyyyyyyk.yk..',
    '...kykyykyk.ky..',
    '...kyyyyyykkk...',
    '...kyyyyyyyk....',
    '..kkyyyyykk.....',
    '.kyykyyyyk......',
    '.kyyyyyykkk.....',
    '..kkyyyyk..k.k..',
    '...kyykyykykyk..',
    '...kyyyyyyyyk...',
    '....kkkkkkk.....',
    '................',
  ],
  spark3: [
    '................',
    '..k..kkkkk..k...',
    '.kykkyyyyykkyk..',
    '.kyyyywyyyyyyk..',
    '.kykyyyyykykyk..',
    '.kyyyyyyyyyyyk..',
    '..kkyyyyyyykk...',
    '...kyyyyyyyk....',
    '..kkyyyyykkk....',
    '.kyykyyyykyyk...',
    '.kyyyyyyyyyyk...',
    '..kkyyyyyykk....',
    '...kyykyykyk....',
    '...kyyyyyyyk....',
    '....kkkkkkk.....',
    '................',
  ],
  leaf1: [
    '................',
    '................',
    '......kkgkk.....',
    '.....kgggggk....',
    '....kgwgggggk...',
    '....kgkggkggk...',
    '....kgggggggk...',
    '.....kgggggk....',
    '......kkggkk....',
    '....kkgggggkk...',
    '...kgggggggggk..',
    '...kgggggggggk..',
    '...kkGGGGGGkk...',
    '.....kkkkkk.....',
    '................',
    '................',
  ],
  leaf2: [
    '................',
    '.....kkgkk......',
    '....kggggk......',
    '...kgwggggk.....',
    '...kgkggkgk.....',
    '...kggggggk.....',
    '....kggggk......',
    '.....kkggk......',
    '...kkgggggkk....',
    '..kgggggggggk...',
    '..kgkgggggkgk...',
    '..kgggggggggk...',
    '...kkGGGGGkk....',
    '.....kkkkk......',
    '...kk.....kk....',
    '................',
  ],
  leaf3: [
    '..kkkk..kkkk....',
    '.kgggk..kgggk...',
    '.kggggkkggggk...',
    '..kkggggggkk....',
    '...kgwwwwwgk....',
    '...kgkggkgkgk...',
    '...kgggggggk....',
    '....kgggggk.....',
    '...kkggggggk....',
    '..kgggggggggk...',
    '..kgkgggggkgk...',
    '.kgggggggggggk..',
    '.kkGGGGGGGGkk...',
    '..kkkkkkkkk.....',
    '..kk.....kk.....',
    '................',
  ],
  aqua1: [
    '................',
    '................',
    '................',
    '................',
    '....kkkkkk......',
    '...kbbbbbbk.....',
    '..kbwkbbbbk.kk..',
    '..kbkbbkbbkkbbk.',
    '..kbbbbbbbbbbk..',
    '...kbbbbbbbbk...',
    '....kkbbbbkk....',
    '......kkkk......',
    '................',
    '................',
    '................',
    '................',
  ],
  aqua2: [
    '................',
    '................',
    '....kkkkkk......',
    '...kbbbbbbk.....',
    '..kbwkbbbbk.kk..',
    '..kbkbbkbbkkbbk.',
    '..kbbbbbbbbbkbk.',
    '..kbbbbbbbbbkk..',
    '..kkbbbbbbk.....',
    '...kbbbbbbk.....',
    '..kkbbbbbbkk....',
    '.kbbbbbbbbbbk...',
    '.kkBBBBBBBBkk...',
    '..kkkkkkkkk.....',
    '................',
    '................',
  ],
  aqua3: [
    '................',
    '.....kkkk.......',
    '....kbbbbk......',
    '...kbwkbbbk.....',
    '...kbkbbkbbkk...',
    '...kbbbbbbbbpk..',
    '..kkbbbbbbbpkk..',
    '.kbbbbbbbbbbk...',
    '.kbkbbbbbbkbk...',
    '.kbbbbbbbbbbk...',
    '..kkbbbbbbkk....',
    '...kbbbbbbk.....',
    '..kkBBBBBBkk....',
    '.kBBBBBBBBBBk...',
    '..kkkkkkkkkk....',
    '................',
  ],
};

// ============ 宠物种族 ============
const SPECIES = {
  spark: {
    name: '电电鼠', line: 'spark',
    stages: [
      { key: 'spark1', name: '电电鼠', evolveLv: 8 },
      { key: 'spark2', name: '霹雳兽', evolveLv: 18 },
      { key: 'spark3', name: '雷暴君', evolveLv: null },
    ],
    base: { hp: 30, atk: 6, def: 3 },
    wild: true,
  },
  leaf: {
    name: '芽芽', line: 'leaf',
    stages: [
      { key: 'leaf1', name: '芽芽', evolveLv: 8 },
      { key: 'leaf2', name: '藤藤兽', evolveLv: 18 },
      { key: 'leaf3', name: '森之主', evolveLv: null },
    ],
    base: { hp: 36, atk: 5, def: 4 },
    wild: true,
  },
  aqua: {
    name: '泡泡龟', line: 'aqua',
    stages: [
      { key: 'aqua1', name: '泡泡龟', evolveLv: 8 },
      { key: 'aqua2', name: '浪涛龟', evolveLv: 18 },
      { key: 'aqua3', name: '深渊霸主', evolveLv: null },
    ],
    base: { hp: 34, atk: 5, def: 5 },
    wild: true,
  },
};

// ============ 装备 ============
const EQUIPS = {
  claw:   { name: '铁爪',   slot: 'weapon', atk: 3, price: 30 },
  sword:  { name: '雷光剑', slot: 'weapon', atk: 6, price: 80 },
  armor:  { name: '皮甲',   slot: 'armor',  def: 3, price: 30 },
  shield: { name: '秘银盾', slot: 'armor',  def: 6, price: 80 },
  bell:   { name: '幸运铃', slot: 'trinket', luck: 2, price: 50 },
};

// ============ 野外敌人 ============
const ENEMIES = [
  { name: '野Slug',   spr: 'spark1', hp: 18, atk: 4, def: 1, exp: 8,  coins: 6 },
  { name: '刺刺虫',   spr: 'leaf1',  hp: 22, atk: 5, def: 2, exp: 10, coins: 8 },
  { name: '水滴怪',   spr: 'aqua1',  hp: 20, atk: 5, def: 3, exp: 11, coins: 9 },
  { name: '岩石傀儡', spr: 'leaf2',  hp: 34, atk: 7, def: 5, exp: 18, coins: 15 },
  { name: '暗影狼',   spr: 'spark2', hp: 30, atk: 9, def: 4, exp: 22, coins: 18 },
  { name: '深渊眼',   spr: 'aqua2',  hp: 38, atk: 10, def: 6, exp: 28, coins: 24 },
];
