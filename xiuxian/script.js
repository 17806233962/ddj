/* ============================================================
 * 《一世仙途》修仙人生经历脚本  v2.0
 * ------------------------------------------------------------
 * 用途：离线单机文字修仙游戏的剧情数据文件（无放置要素）
 * 玩法：开局选名称/天赋/方向 → 逐年推演 → 特色事件三选一
 *       → 每个选项按各自的概率分布结算 → 属性/标记(flag)决定结局
 *
 * v2.0 新增（交互层）：
 *   SCRIPTS       四条人生支线的剧本：不同分支、不同年份触发三选一
 *   SPECIALS      特色事件池，开局后自动结算，结果按各自概率分布
 *   FILLERS       没有事件时的平淡年份旁白
 *
 * 数据结构说明（引擎直接消费）：
 *   TALENTS  开局天赋池，按稀有度加权抽取
 *   SECTS / PROFESSIONS / ALIGNMENTS / PARTNERS  开局五择中的后四择
 *   STAGES   境界表：每境界推进若干年，触发对应事件池
 *   EVENTS   旧事件池（多数自动结算，少数 ask:true 的也交给玩家抉择）
 *   SPECIALS 特色事件池，每个事件恰好 3 个选项；选项的 outcomes 是独立分布
 *   ENDINGS  结局表，按 priority 从高到低匹配
 * ============================================================ */

const CONFIG = {
  startAge: 8,          // 开局年龄（凡人少年）
  yearsPerStage: {      // 每境界停留年数（缩短节奏，一局约 200 年）
    mortal: 4, lianqi: 10, zhuji: 18, jindan: 30,
    yuanying: 45, huashen: 60, dujie: 30,
  },
  baseLifespan: 80,     // 凡人基础寿元，每次突破大境界延长
  lifespanBonus: { lianqi: 10, zhuji: 20, jindan: 40, yuanying: 80, huashen: 150, dujie: 250 },
  creationBase: { 悟性: 2, 根骨: 2, 心境: 2, 机缘: 2 },
  // 每个境界安排几次“特色事件”（不占普通事件名额）
  specialsPerStage: { mortal: 1, lianqi: 2, zhuji: 2, jindan: 2, yuanying: 2, huashen: 2, dujie: 2 },
  // UI 节奏（引擎不依赖）
  ui: { baseDelay: 620, resultDelay: 380 },
};

/* ============================ 天赋 ============================ */
/* grade: 1普通 2罕见 3史诗 4传说；effects 影响初始属性/标记 */
const TALENTS = [
  // 普通（容易抽到）
  { id: "t_world", name: "山村出身", grade: 1, desc: "清贫少年，心性坚韧", effects: { 根骨: 1, 心境: 1 } },
  { id: "t_book", name: "读过几年私塾", grade: 1, desc: "识文断字，悟性略高", effects: { 悟性: 2 } },
  { id: "t_hunter", name: "猎户之子", grade: 1, desc: "体魄强健", effects: { 根骨: 2 } },
  { id: "t_kind", name: "心地善良", grade: 1, desc: "乡里称颂", effects: { 善恶: 10, 声望: 1 } },
  { id: "t_stubborn", name: "性子执拗", grade: 1, desc: "认死理，心境略亏但意志坚定", effects: { 心境: -1, 根骨: 1 } },
  // 罕见
  { id: "t_spirit_eye", name: "灵目", grade: 2, desc: "能窥灵气流转", effects: { 悟性: 3, 机缘: 3 } },
  { id: "t_iron_body", name: "先天道体雏形", grade: 2, desc: "筋骨不凡", effects: { 根骨: 4 } },
  { id: "t_rich", name: "富商之家", grade: 2, desc: "家资万贯，可购开脉丹", effects: { 金铢: 500, 机缘: 1 } },
  { id: "t_calm", name: "泰山崩于前而色不变", grade: 2, desc: "道心稳固", effects: { 心境: 4 } },
  { id: "t_lucky", name: "福缘深厚", grade: 2, desc: "常逢奇遇", effects: { 机缘: 5 } },
  { id: "t_hated", name: "天煞孤星", grade: 2, desc: "克亲克友，独行之路", effects: { 心境: -2, 机缘: 2, flag孤星: 1 } },
  // 史诗
  { id: "t_sword_bone", name: "剑骨", grade: 3, desc: "天生为剑而生", effects: { 根骨: 3, 悟性: 3, flag剑心: 1 } },
  { id: "t_dan_fire", name: "丹火之体", grade: 3, desc: "体内自生温养之火", effects: { 悟性: 2, 机缘: 2, flag丹道: 1 } },
  { id: "t_royal", name: "皇朝遗孤", grade: 3, desc: "前朝血脉，身负秘藏", effects: { 金铢: 2000, 声望: 3, flag皇家: 1 } },
  { id: "t_demon_seed", name: "心魔种", grade: 3, desc: "梦中有低语呢喃……", effects: { 悟性: 4, 心境: -3, flag魔染: 1 } },
  { id: "t_old_soul", name: "宿慧通明", grade: 3, desc: "似有前世残忆", effects: { 悟性: 5, 心境: 2, flag宿慧: 1 } },
  // 传说
  { id: "t_chaos", name: "混沌灵体", grade: 4, desc: "万中无一，诸道皆容", effects: { 悟性: 5, 根骨: 5, 机缘: 5, flag混沌: 1 } },
  { id: "t_heaven_envy", name: "天道忌之", grade: 4, desc: "天资绝世，然天劫倍凶", effects: { 悟性: 8, 根骨: 4, flag天妒: 1 } },
  { id: "t_reborn", name: "重修者", grade: 4, desc: "你隐约记得——这条路你走过一次", effects: { 悟性: 6, 心境: 4, 机缘: 3, flag重修: 1 } },
];

/* ============================ 开局五择 ============================ */
const SECTS = [
  { id: "sect_qingyun", name: "青云宗", desc: "天下第一正道宗门。有师长、有同门、有资源，也有规矩。",
    effects: { attr: { 悟性: 2, 声望: 2, 金铢: 200 }, flag: { 入宗: 1, 散人: -1, 青云: 1 } } },
  { id: "sect_miaoyin", name: "妙音阁", desc: "亦正亦邪的音修之地。消息灵通，奇遇多，靠山少。",
    effects: { attr: { 机缘: 3, 心境: 1, 金铢: 300 }, flag: { 入宗: 1, 散人: -1, 妙音: 1 } } },
  { id: "sect_sanxiu", name: "无门无派", desc: "散修。没人管，也没人护。机缘最盛，风险最高。",
    effects: { attr: { 机缘: 4, 根骨: 1, 金铢: 100 }, flag: { 入宗: -1, 散人: 1 } } },
  { id: "sect_xuedao", name: "血刀门", desc: "刀头舔血的狠角色。门规只有一条：不能怂。",
    effects: { attr: { 根骨: 3, 悟性: 1, 金铢: 400 }, flag: { 入宗: 1, 散人: -1, 血刀: 1, 魔染: 1 } } },
  { id: "sect_wanbao", name: "万宝楼", desc: "半个修真界的生意都过它的手。有钱，但不姓你。",
    effects: { attr: { 金铢: 1500, 机缘: 2, 声望: 1 }, flag: { 入宗: 1, 散人: -1, 万宝: 1 } } },
];
const PROFESSIONS = [
  { id: "prof_sword", name: "剑修", desc: "一剑破万法。攻伐最盛，也最易死于刀兵。",
    effects: { attr: { 根骨: 2, 悟性: 1 }, flag: { 剑心: 2, 职业剑: 1 } } },
  { id: "prof_dan", name: "丹修", desc: "炼丹养道。寿元长，人脉广，最不缺盘缠。",
    effects: { attr: { 悟性: 2, 机缘: 2, 金铢: 500 }, flag: { 丹道: 2, 职业丹: 1 } } },
  { id: "prof_body", name: "体修", desc: "以身为炉。肉身成圣，硬撼天劫。",
    effects: { attr: { 根骨: 4, 心境: 1 }, flag: { 体修: 1, 职业体: 1 } } },
  { id: "prof_fu", name: "符修", desc: "一笔定乾坤。画符千张，救人也杀人。",
    effects: { attr: { 悟性: 2, 机缘: 1 }, flag: { 符道: 2, 职业符: 1 } } },
  { id: "prof_zhen", name: "阵修", desc: "布阵困万千敌。慢功出细活，最会保命。",
    effects: { attr: { 悟性: 1, 心境: 1, 机缘: 1 }, flag: { 阵道: 2, 职业阵: 1 } } },
];
const ALIGNMENTS = [
  { id: "align_righteous", name: "正道", desc: "守正持中，扶危济困。人望高，心魔少。",
    effects: { attr: { 善恶: 20, 声望: 3 }, flag: { 正道: 1, 中立: -1, 魔道: -1, 魔染: -99 } } },
  { id: "align_neutral", name: "亦正亦邪", desc: "只凭本心，不问正邪。机缘最盛，名声难说。",
    effects: { attr: { 机缘: 2, 心境: 1 }, flag: { 中立: 1, 正道: -1, 魔道: -1 } } },
  { id: "align_demon", name: "魔道", desc: "以力证道，百无禁忌。修为快，代价也重。",
    effects: { attr: { 悟性: 3, 金铢: 1000, 善恶: -20 }, flag: { 魔道: 1, 正道: -1, 中立: -1, 魔染: 2, 入魔: 2 } } },
  { id: "align_hidden", name: "隐世", desc: "不问江湖事，闭门修自己。心最静，也最孤。",
    effects: { attr: { 心境: 4, 悟性: 2 }, flag: { 隐世: 1, 正道: -1, 中立: -1, 魔道: -1 } } },
  { id: "align_daowu", name: "逆天", desc: "不信天道，只信自己手里的东西。快，也险。",
    effects: { attr: { 悟性: 4, 心境: -2 }, flag: { 无道: 1, 正道: -1, 中立: -1, 魔道: -1 } } },
];
const PARTNERS = [
  { id: "partner_qingmei", name: "苏挽月", desc: "青梅竹马。她会在你最难的时候出现。",
    effects: { attr: { 心境: 2, 善恶: 5 }, flag: { 情缘: 1, 道侣: 1, 无情: -1 } } },
  { id: "partner_hongyan", name: "白芷", desc: "红颜知己。亦正亦邪，与你并肩，也与你相争。",
    effects: { attr: { 机缘: 3, 悟性: 1 }, flag: { 情缘: 1, 道侣: 1, 无情: -1 } } },
  { id: "partner_luo", name: "洛清歌", desc: "同门师姐。剑比你快，话比你少，人总在你身后。",
    effects: { attr: { 根骨: 2, 悟性: 1 }, flag: { 情缘: 1, 道侣: 1, 无情: -1 } } },
  { id: "partner_feiyan", name: "绯烟", desc: "妖族圣女。与你并肩，也与全世界为敌。",
    effects: { attr: { 机缘: 3, 善恶: -5 }, flag: { 情缘: 1, 道侣: 1, 妖缘: 1, 无情: -1 } } },
  { id: "partner_none", name: "独身向道", desc: "不结道侣。心无挂碍，剑心通明。",
    effects: { attr: { 悟性: 3, 心境: 2 }, flag: { 道侣: -1, 无情: 1 } } },
];

/* ============================ 剧本（按分支、按年份触发） ============================
 * 天赋在开局选；其余四次由剧本在各自年份触发，不卡境界。
 * 不同分支走不同剧本，所以每次选择出现的年龄也不同。
 * 活不到那一年，就不会遇到。
 *
 * slot   选择槽位：sect 门派 / craft 职业 / align 正邪 / partner 道侣
 * after  必须先完成的前置槽位
 * atAge  该剧本触发的年龄
 * cond   额外条件（flag）
 * options 用 group + id 指向 SECTS / PROFESSIONS / ALIGNMENTS / PARTNERS
 * ============================================================ */
const SCRIPTS = [
  { id: "sc_sect_tianjiao", slot: "sect", atAge: 13, cond: ["flag:天骄>=1"],
    title: "三宗争徒",
    text: "测灵石在你掌心亮了一瞬，三宗使者同日至村口。青云宗的礼单是内门弟子，妙音阁的礼单是一卷音谱，无门无派的老散修只放下一柄旧剑，说：「跟我走，没人管你。」",
    options: [{ group: "SECTS", id: "sect_qingyun" }, { group: "SECTS", id: "sect_miaoyin" }, { group: "SECTS", id: "sect_sanxiu" }, { group: "SECTS", id: "sect_xuedao" }, { group: "SECTS", id: "sect_wanbao" }] },

  { id: "sc_sect_hanmen", slot: "sect", atAge: 17, cond: ["flag:寒门>=1"],
    title: "山门试炼",
    text: "你独自走到青云宗山门。执事看了你一眼，说外门还缺个扫地的；山道另一头，妙音阁的画舫正靠岸，琴声顺着风飘下来；身后是你来时的路，一个人也没有。",
    options: [{ group: "SECTS", id: "sect_qingyun" }, { group: "SECTS", id: "sect_miaoyin" }, { group: "SECTS", id: "sect_sanxiu" }, { group: "SECTS", id: "sect_xuedao" }, { group: "SECTS", id: "sect_wanbao" }] },

  { id: "sc_craft_qingyun", slot: "craft", after: "sect", atAge: 24, cond: ["flag:青云>=1"],
    title: "内门择业",
    text: "内门大比之后，掌门把你叫到殿前。剑峰、丹房、炼体堂各有一位长老看着你，谁都没有先开口。",
    options: [{ group: "PROFESSIONS", id: "prof_sword" }, { group: "PROFESSIONS", id: "prof_dan" }, { group: "PROFESSIONS", id: "prof_body" }, { group: "PROFESSIONS", id: "prof_fu" }, { group: "PROFESSIONS", id: "prof_zhen" }] },

  { id: "sc_craft_miaoyin", slot: "craft", after: "sect", atAge: 27, cond: ["flag:妙音>=1"],
    title: "音阁问心",
    text: "阁主把七弦琴推到你面前：「音阁不教人杀人，只教人听。你听见什么，就选什么。」琴声里有剑鸣，有药香，有骨头断裂的闷响。",
    options: [{ group: "PROFESSIONS", id: "prof_sword" }, { group: "PROFESSIONS", id: "prof_dan" }, { group: "PROFESSIONS", id: "prof_body" }, { group: "PROFESSIONS", id: "prof_fu" }, { group: "PROFESSIONS", id: "prof_zhen" }] },

  { id: "sc_craft_sanxiu", slot: "craft", after: "sect", atAge: 30, cond: ["flag:散人>=1"],
    title: "坊市谋生",
    text: "坊市里三份活计同时找上你：护一趟走黑水的镖，替丹铺看一炉不能熄的火，或者跟体修去乱葬岗搬一座山一样的棺材。都得吃饭。",
    options: [{ group: "PROFESSIONS", id: "prof_sword" }, { group: "PROFESSIONS", id: "prof_dan" }, { group: "PROFESSIONS", id: "prof_body" }, { group: "PROFESSIONS", id: "prof_fu" }, { group: "PROFESSIONS", id: "prof_zhen" }] },

  { id: "sc_align_sword", slot: "align", after: "craft", atAge: 44, cond: ["flag:职业剑>=1"],
    title: "杀伐之惑",
    text: "你剑下亡魂过百。雨夜里，一个魔道长老拦住你，问：「你的剑，是护人的，还是杀人的？」他没有拔刀，像是在等一个答案。",
    options: [{ group: "ALIGNMENTS", id: "align_righteous" }, { group: "ALIGNMENTS", id: "align_neutral" }, { group: "ALIGNMENTS", id: "align_demon" }, { group: "ALIGNMENTS", id: "align_hidden" }, { group: "ALIGNMENTS", id: "align_daowu" }] },

  { id: "sc_align_dan", slot: "align", after: "craft", atAge: 62, cond: ["flag:职业丹>=1"],
    title: "丹会风波",
    text: "丹会决赛，炉里的丹快成了，对面的魔道丹师却递来一包药：「加进去，你赢；不加，你输。」台下几百双眼睛看着你。",
    options: [{ group: "ALIGNMENTS", id: "align_righteous" }, { group: "ALIGNMENTS", id: "align_neutral" }, { group: "ALIGNMENTS", id: "align_demon" }, { group: "ALIGNMENTS", id: "align_hidden" }, { group: "ALIGNMENTS", id: "align_daowu" }] },

  { id: "sc_align_body", slot: "align", after: "craft", atAge: 67, cond: ["flag:职业体>=1"],
    title: "血战魔修",
    text: "魔修屠城，你以肉身挡在城门前。身后是没跑掉的百姓，面前是血海。魔修头领笑：「让开，我许你半城。」",
    options: [{ group: "ALIGNMENTS", id: "align_righteous" }, { group: "ALIGNMENTS", id: "align_neutral" }, { group: "ALIGNMENTS", id: "align_demon" }, { group: "ALIGNMENTS", id: "align_hidden" }, { group: "ALIGNMENTS", id: "align_daowu" }] },

  { id: "sc_partner_righteous", slot: "partner", after: "align", atAge: 95, cond: ["flag:正道>=1"],
    title: "上元灯会",
    text: "上元灯会，人潮如织。苏挽月在桥头等你，白芷在河对岸朝你举了举酒盏。你也可以谁也不见，转身走进人海里。",
    options: [{ group: "PARTNERS", id: "partner_qingmei" }, { group: "PARTNERS", id: "partner_hongyan" }, { group: "PARTNERS", id: "partner_luo" }, { group: "PARTNERS", id: "partner_feiyan" }, { group: "PARTNERS", id: "partner_none" }] },

  { id: "sc_partner_neutral", slot: "partner", after: "align", atAge: 105, cond: ["flag:中立>=1"],
    title: "渡口",
    text: "渡口只剩最后一班船。白衣的女修替你留了位置，黑衣的女修把伞往你这边偏了偏。船家问：「走不走？」",
    options: [{ group: "PARTNERS", id: "partner_qingmei" }, { group: "PARTNERS", id: "partner_hongyan" }, { group: "PARTNERS", id: "partner_luo" }, { group: "PARTNERS", id: "partner_feiyan" }, { group: "PARTNERS", id: "partner_none" }] },

  { id: "sc_partner_demon", slot: "partner", after: "align", atAge: 112, cond: ["flag:魔道>=1"],
    title: "魔渊来客",
    text: "魔渊的风很冷。她站在你身后，不问你杀过多少人，只问：「你还要走多远？」你也可以一个人走下去，走到谁都不认识你。",
    options: [{ group: "PARTNERS", id: "partner_qingmei" }, { group: "PARTNERS", id: "partner_hongyan" }, { group: "PARTNERS", id: "partner_luo" }, { group: "PARTNERS", id: "partner_feiyan" }, { group: "PARTNERS", id: "partner_none" }] },

  { id: "sc_craft_xuedao", slot: "craft", after: "sect", atAge: 34, cond: ["flag:血刀>=1"],
    title: "刑堂问路",
    text: "入血刀门第三年，堂主把你叫进刑堂，指着三条路：刀客、药人、阵奴。「挑一条。挑错的，连坟头都排不上。」",
    options: [{ group: "PROFESSIONS", id: "prof_sword" }, { group: "PROFESSIONS", id: "prof_dan" }, { group: "PROFESSIONS", id: "prof_body" }, { group: "PROFESSIONS", id: "prof_fu" }, { group: "PROFESSIONS", id: "prof_zhen" }] },

  { id: "sc_craft_wanbao", slot: "craft", after: "sect", atAge: 38, cond: ["flag:万宝>=1"],
    title: "后堂选差",
    text: "万宝楼年度大拍前夜，掌柜把你叫进后堂，推过来三块腰牌：「楼里缺鉴剑的、炼丹的、布防的。选一个，楼养你一辈子。」",
    options: [{ group: "PROFESSIONS", id: "prof_sword" }, { group: "PROFESSIONS", id: "prof_dan" }, { group: "PROFESSIONS", id: "prof_body" }, { group: "PROFESSIONS", id: "prof_fu" }, { group: "PROFESSIONS", id: "prof_zhen" }] },

  { id: "sc_align_fu", slot: "align", after: "craft", atAge: 50, cond: ["flag:职业符>=1"],
    title: "一符两卖",
    text: "你随手画的「净心符」被人描成了平乱的军符。朝廷拿着银子来买，魔修拿着人命来换。笔在你手里，墨往哪边蘸？",
    options: [{ group: "ALIGNMENTS", id: "align_righteous" }, { group: "ALIGNMENTS", id: "align_neutral" }, { group: "ALIGNMENTS", id: "align_demon" }, { group: "ALIGNMENTS", id: "align_hidden" }, { group: "ALIGNMENTS", id: "align_daowu" }] },

  { id: "sc_align_zhen", slot: "align", after: "craft", atAge: 56, cond: ["flag:职业阵>=1"],
    title: "阵图之争",
    text: "你的困龙阵困住一头祸乱三州的妖王。宗门要阵图邀功，魔修要阵图救人。同一个阵，两种说法，都在等你开口。",
    options: [{ group: "ALIGNMENTS", id: "align_righteous" }, { group: "ALIGNMENTS", id: "align_neutral" }, { group: "ALIGNMENTS", id: "align_demon" }, { group: "ALIGNMENTS", id: "align_hidden" }, { group: "ALIGNMENTS", id: "align_daowu" }] },

  { id: "sc_partner_hidden", slot: "partner", after: "align", atAge: 80, cond: ["flag:隐世>=1"],
    title: "叩门",
    text: "结庐隐居的第八年，山下有人一步一步爬上来，在门外站了很久。门开着，也可以不开。",
    options: [{ group: "PARTNERS", id: "partner_qingmei" }, { group: "PARTNERS", id: "partner_hongyan" }, { group: "PARTNERS", id: "partner_luo" }, { group: "PARTNERS", id: "partner_feiyan" }, { group: "PARTNERS", id: "partner_none" }] },

  { id: "sc_partner_daowu", slot: "partner", after: "align", atAge: 100, cond: ["flag:无道>=1"],
    title: "剑指的方向",
    text: "你与天道为敌的第十年，她站在你剑指的方向。跟着你，天下之大再无她容身处；不跟着，你也没有回头路。",
    options: [{ group: "PARTNERS", id: "partner_qingmei" }, { group: "PARTNERS", id: "partner_hongyan" }, { group: "PARTNERS", id: "partner_luo" }, { group: "PARTNERS", id: "partner_feiyan" }, { group: "PARTNERS", id: "partner_none" }] },
];

/* ============================ 境界 ============================ */
const STAGES = [
  { id: "mortal",  name: "凡人",   desc: "未入道途" },
  { id: "lianqi",  name: "练气",   desc: "引气入体" },
  { id: "zhuji",   name: "筑基",   desc: "道基初成" },
  { id: "jindan",  name: "金丹",   desc: "丹成一道" },
  { id: "yuanying",name: "元婴",   desc: "元婴现世" },
  { id: "huashen", name: "化神",   desc: "神游太虚" },
  { id: "dujie",   name: "渡劫",   desc: "九霄雷临" },
];

/* ============================ 平淡年份（没有事件时） ============================ */
const FILLERS = {
  mortal:  ["你替家里砍柴挑水，日子平淡如水。","村口的老槐树又绿了一茬。","你仰头看云，幻想云上住着神仙。","私塾先生罚你抄了十遍《千字文》。"],
  lianqi:  ["打坐吐纳，灵气在经脉中缓缓流转。","你为宗门浇了三个月灵田。","藏经阁整理书卷，顺便偷看了几页。","师父让你挑水，说是磨炼心境。"],
  zhuji:   ["闭关苦修，法力日臻圆满。","你下山斩了一头作乱的三阶妖狼。","坊市淘宝，与摊主讨价还价半日。","你在洞府中炼器，炸了三次炉。"],
  jindan:  ["丹田内金丹缓缓旋转，温养不休。","你游历四方，斩恶扶弱，薄有声名。","你与友人道友论道三日三夜。","你化作一道遁光，横渡了大漠。"],
  yuanying:["元婴出窍，遨游云海之上。","你收了两名弟子，倾囊相授。","你在东海之滨观潮百年，若有所悟。","正邪两道的大事里，都有了你的名字。"],
  huashen: ["神游太虚，与天地共鸣。","你枯坐山巅，看云卷云舒一甲子。","你一念之间，移山填海。","世间已渐渐流传你的传说。"],
  dujie:   ["雷云在头顶盘旋，你闭目养神。","你将毕生所悟整理成册，传于后人。","你静静地擦拭着伴随一生的兵器。","天地寂静，暴风雨前的宁静。"],
};

/* ============================ 事件池 ============================ */
const EVENTS = {

  /* ---------------- 凡人期：能否踏入仙途 ---------------- */
  mortal: [
    { id: "m1", title: "仙缘测试", weight: 10, once: true, ask: true,
      text: "青云宗云游弟子下山招收门人，测灵石在你额头一贴，石中光芒明灭不定。长老闭目不语，只道：「如何，测是不测？」",
      choices: [
        { label: "挺直腰板，主动一试", outcomes: [
          { p: 40, text: "灵光乍亮！测出灵根，被当场带走。", attr: { 声望: 1 }, flag: { 入宗: 1 } },
          { p: 35, text: "微光黯淡，仅余一线——杂灵根，勉强够格做外门弟子。", attr: { 心境: -1 }, flag: { 入宗: 1, 杂根: 1 } },
          { p: 25, text: "石中无光。身后传来低低的嗤笑声……但你注意到测灵石上崩落了一枚碎片，悄悄攥进了手心。", attr: { 机缘: 2 }, flag: { 碎石: 1, 散人: 1 } },
        ]},
        { label: "长跪山门，求一个机会", outcomes: [
          { p: 50, text: "三日三夜后，一位独臂老人驻足良久，将你收作药童。", attr: { 心境: 1, 悟性: 1 }, flag: { 拜师: 1 } },
          { p: 30, text: "无人理会。你黯然下山，却在半路拾到一册被雨水泡烂的《引气诀》。", attr: { 悟性: 1 }, flag: { 得功法: 1, 散人: 1 } },
          { p: 20, text: "执事弟子不堪其扰，赏了份杂役差事——扫山门，管饭，不管修行。", attr: { 根骨: 1 }, flag: { 入宗: 1, 杂役: 1 } },
        ]},
        { label: "转身回家，仙凡有别", outcomes: [
          { p: 50, text: "你回了村，从此春种秋收。只是偶尔，会望一望山那边的云。", attr: { 心境: 1 } },
          { p: 50, text: "回家路上救下一只白鹤，鹤衔来一枚青果。你咬下一口，只觉浑身通泰——当夜，你于梦中引气入体。", attr: { 根骨: 1, 机缘: 2 }, flag: { 得功法: 1, 散人: 1 } },
        ]},
      ] },
    { id: "m2", title: "山中遇险", weight: 8, once: true,
      text: "上山采药时，你失足跌入雾气弥漫的深谷。",
      cond: [],
      branches: [
        { p: 35, text: "谷底有一具枯坐百年的骸骨，怀中残卷《引气诀》尚可辨认。你依法吐纳，隐有气感。", attr: { 悟性: 2 }, flag: { 得功法: 1, 散人: 1 } },
        { p: 30, text: "谷底温泉暖骨，泡了三日竟觉神清气爽——因祸得福，根骨提升。", attr: { 根骨: 2 } },
        { p: 25, text: "你攀藤蔓艰难爬出，从此恐高，心境留下阴影。", attr: { 心境: -1 } },
        { p: 10, text: "雾中似有巨物游走，你侥幸逃出，却在袖中发现一枚温润的鳞片。", attr: { 机缘: 3 }, flag: { 蛟鳞: 1 } },
      ] },
    { id: "m3", title: "家变", weight: 6, once: true,
      text: "一伙马贼夜袭村落，火光冲天。",
      branches: [
        { p: 40, text: "你护着幼妹躲进地窖活了下来，从此立誓要掌握力量。", attr: { 心境: 1, 根骨: 1 } },
        { p: 30, text: "亲人皆亡。你望着灰烬，眼底再无少年意气。", attr: { 心境: -2, 悟性: 1 }, flag: { 孤星: 1 } },
        { p: 20, text: "一位路过的修士随手拂袖退敌，你叩首拜谢，他留下一枚玉简飘然而去。", attr: { 机缘: 2 }, flag: { 得功法: 1 } },
        { p: 10, text: "你趁乱捡走了贼人遗落的储物袋，内有金银与一瓶伤药。", attr: { 金铢: 300, 善恶: -5 } },
      ] },
    { id: "m4", title: "怪梦", weight: 5, once: true, cond: ["flag魔染>=1"],
      text: "梦中总有声音低语：「……把心交给我，我予你长生。」",
      branches: [
        { p: 50, text: "你在梦中与之对抗，醒来冷汗涔涔，心境反而凝练了几分。", attr: { 心境: 2 } },
        { p: 30, text: "你默许它靠近。自那夜起，修炼奇快，眼中偶有血丝。", attr: { 悟性: 2 }, flag: { 魔染: 1 } },
        { p: 20, text: "你依残声指引，在村后老槐树下掘出一册《噬魂录》。", attr: { 悟性: 1 }, flag: { 魔染: 2, 得魔功: 1 } },
      ] },
    { id: "m5", title: "私塾先生的旧书", weight: 5, once: true, cond: ["悟性>=3"],
      text: "先生临终赠你一箱旧书，其中夹着一页手抄的《道论》。",
      branches: [
        { p: 60, text: "你反复研读，隐约触到「道」的边角，悟性大增。", attr: { 悟性: 2 } },
        { p: 40, text: "书页以水浸之显出地图，指向百里外的废弃洞府。", attr: { 机缘: 2 }, flag: { 洞府图: 1 } },
      ] },
    { id: "m6", title: "乞儿与馒头", weight: 5, once: true,
      text: "城门洞下，一个乞儿奄奄一息，你手里的馒头是今日唯一的食物。",
      branches: [
        { p: 50, text: "你把馒头掰了一半给他。乞儿痊愈后消失无踪，你袖中多了一粒莹润丹药。", attr: { 善恶: 10, 机缘: 2 }, flag: { 善缘: 1 } },
        { p: 50, text: "你犹豫片刻还是走开了。夜里腹鸣如鼓，你第一次明白何为「取舍」。", attr: { 心境: 1, 善恶: -3 } },
      ] },
  ],

  /* ---------------- 练气期：初窥门径 ---------------- */
  lianqi: [
    { id: "l1", title: "引气入体", weight: 10, once: true,
      text: "月圆之夜，灵气如潮。你盘坐吐纳，气感游走四肢百骸。",
      branches: [
        { p: 45, text: "一举贯通十二条经脉，练气三层！同门侧目。", attr: { 悟性: 1, 声望: 1 } },
        { p: 35, text: "稳扎稳打，气感凝实，练气二层。", attr: { 心境: 1 } },
        { p: 20, text: "走火入座岔了气，卧床一月，道基微损。", attr: { 根骨: -1, 心境: -1 } },
      ] },
    { id: "l2", title: "坊市初行", weight: 8, once: true,
      text: "坊市人声鼎沸，法器灵丹琳琅满目，你的钱袋只够买一样。",
      branches: [
        { p: 30, text: "你买了柄最便宜的铁剑，每日挥剑千次。", attr: { 根骨: 1 }, flag: { 剑缘: 1 } },
        { p: 30, text: "你买了《百草图鉴》残本，蹲在丹房外偷师。", attr: { 悟性: 1 }, flag: { 丹道: 1 } },
        { p: 25, text: "你在角落摊上赌石，开出一条雷击木，可制符箓。", attr: { 机缘: 2 }, flag: { 符缘: 1 } },
        { p: 15, text: "你被人骗走了全部积蓄，记住了人心的险恶。", attr: { 心境: 1, 善恶: -2, 金铢: -100 } },
      ] },
    { id: "l3", title: "夜探后山", weight: 7, once: true,
      text: "传闻后山禁地夜有异光，你与同门约定一探究竟。",
      branches: [
        { p: 30, text: "异光是一窝灵狐。你放过了幼狐，母狐衔来一株百年灵芝相赠。", attr: { 善恶: 5, 机缘: 2 } },
        { p: 25, text: "同门为宝物向你出手！你侥幸反杀，第一次见到修士之血。", attr: { 心境: -1 }, flag: { 魔染: 1, 杀伐: 1 } },
        { p: 25, text: "禁地深处是一处前人洞府，你得了一柄无铭飞剑。", attr: { 机缘: 3 }, flag: { 剑心: 1, 得飞剑: 1 } },
        { p: 20, text: "你惊醒了沉睡的石傀儡，狼狈逃出，从此道号「泥猴」。", attr: { 声望: -1, 根骨: 1 } },
      ] },
    { id: "l4", title: "魔功之惑", weight: 9, cond: ["flag魔染>=2"], once: true,
      text: "《噬魂录》第一层已然练成，修炼速度倍于从前，但每进一步，便有一分嗜血之意。",
      branches: [
        { p: 40, text: "你以水磨功夫压制心魔，勉强维持灵台清明。", attr: { 心境: 2 } },
        { p: 40, text: "你顺势修炼，修为突飞猛进，眸中血丝愈重。", attr: { 悟性: 2, 善恶: -5 }, flag: { 魔染: 1 } },
        { p: 20, text: "夜半，你发现自己的影子在独立行动……", attr: { 心境: -2 }, flag: { 魔染: 1, 心魔: 1 } },
      ] },
    { id: "l5", title: "师尊讲道", weight: 6, once: true, cond: ["flag拜师>=1"],
      text: "独臂老人终于正式传你功法，只问了一句：「求道，求的是什么？」",
      branches: [
        { p: 35, text: "「求长生。」师尊摇头又点头：「记住你今日所答。」", attr: { 心境: 1 }, flag: { 道问长生: 1 } },
        { p: 35, text: "「求逍遥。」师尊大笑，传你遁法一篇。", attr: { 机缘: 2, 心境: 1 }, flag: { 道问逍遥: 1 } },
        { p: 30, text: "「求力量，护我在乎之人。」师尊沉默良久，传你一门护体神通。", attr: { 根骨: 2 }, flag: { 道问守护: 1 } },
      ] },
    { id: "l6", title: "初见师妹", weight: 7, once: true, cond: ["flag入宗>=1"],
      text: "藏经阁前，执灯的师妹回眸一笑：「这道友，你的鞋带开了。」",
      branches: [
        { p: 45, text: "你低头一看——根本没有鞋带。抬头时她已笑跑远。你竟记了很多年。", flag: { 情缘: 1 } },
        { p: 35, text: "你们因论道相争半日，不打不相识。", attr: { 悟性: 1 }, flag: { 情缘: 1, 挚友: 1 } },
        { p: 20, text: "你面无表情走开。多年后想起，只余一声轻叹。", attr: { 心境: 1 } },
      ] },
    { id: "l7", title: "筑基丹之争", weight: 8, once: true, ask: true,
      text: "宗门大比，前三名可得一枚筑基丹。你的对手是练气九层的天才师兄。战前一夜，你如何自处？",
      choices: [
        { label: "堂堂正正，全力一战", outcomes: [
          { p: 35, text: "你以巧破力，险胜半招！筑基丹到手。", attr: { 声望: 3, 心境: 1 }, flag: { 得筑基丹: 1 } },
          { p: 40, text: "力战而败。但长老看中你的心性，赐半枚筑基丹。", attr: { 声望: 1 }, flag: { 得筑基丹: 1, 半丹: 1 } },
          { p: 25, text: "两败俱伤，你断了三根肋骨，与丹药无缘。", attr: { 根骨: -1, 心境: 1 } },
        ]},
        { label: "主动认负，结个善缘", outcomes: [
          { p: 50, text: "师兄愕然，随后大笑扶你起身。他日后成为你最可靠的臂助。", attr: { 心境: 2 }, flag: { 挚友: 1 } },
          { p: 50, text: "众人讥你怯战。你默默回到洞府，加练了三百日的剑。", attr: { 根骨: 1, 声望: -1 } },
        ]},
        { label: "兵不厌诈，暗中使用手段", outcomes: [
          { p: 55, text: "你暗中在师兄水里下了泄药。赢了比试，输了一些说不清的东西。", attr: { 善恶: -8, 声望: 2 }, flag: { 得筑基丹: 1, 魔染: 1 } },
          { p: 45, text: "手段被当场揭穿！你被罚面壁三年，名誉扫地。", attr: { 善恶: -5, 声望: -3, 心境: 1 } },
        ]},
      ] },
  ],

  /* ---------------- 筑基期：道基决定上限 ---------------- */
  zhuji: [
    { id: "z1", title: "筑基", weight: 10, once: true,
      text: "筑基丹入腹，药力如江河倒灌。你的道台在灵气冲刷下逐渐成形。",
      branches: [
        { p: 30, text: "轰——！道台完美无瑕，引来紫气东来三千里！天骄之名传遍一域。", attr: { 声望: 5, 悟性: 2 }, flag: { 完美道基: 1 } },
        { p: 45, text: "道基稳固，虽非绝世，胜在扎实。", attr: { 心境: 1 } },
        { p: 25, text: "道基有一丝裂纹。寿元与上限俱损，你握紧了拳。", attr: { 心境: -1 }, flag: { 裂基: 1 } },
      ] },
    { id: "z2", title: "下山历练", weight: 8, once: true,
      text: "你奉命下山斩除为祸一方的妖寨。",
      branches: [
        { p: 35, text: "你连破三寨，救出被掳百姓，万民伞送到山门。", attr: { 声望: 3, 善恶: 10 } },
        { p: 30, text: "你发现妖寨背后是魔道坊市。你记下位置，没有打草惊蛇。", attr: { 悟性: 2 }, flag: { 知魔踪: 1 } },
        { p: 20, text: "寨中老妖设伏，你断一臂逃生，从此兵器谱上多了你「独臂」之名。", attr: { 根骨: -1, 心境: 2 }, flag: { 独臂: 1 } },
        { p: 15, text: "妖寨头领愿以半部功法求和。你收下了。", attr: { 善恶: -5, 悟性: 1 }, flag: { 魔染: 1 } },
      ] },
    { id: "z3", title: "秘境风波", weight: 9, once: true,
      text: "上古秘境百年一开，各宗弟子齐聚。入口石碑上血迹未干。",
      branches: [
        { p: 25, text: "你在秘境深处得前辈遗泽：一炉九转还魂丹的残方。", attr: { 机缘: 3, 悟性: 1 }, flag: { 丹道: 2, 得残方: 1 } },
        { p: 25, text: "一株万年份的雷击紫竹认主，钻入你的识海。", attr: { 根骨: 2 }, flag: { 雷竹: 1 } },
        { p: 20, text: "魔修在秘境中屠戮同道。你拼死救下三人，自己也重伤。", attr: { 善恶: 10, 声望: 2, 根骨: -1 }, flag: { 魔仇: 1 } },
        { p: 15, text: "你与魔修分赃秘境宝库，无人知晓。", attr: { 金铢: 3000, 善恶: -10 }, flag: { 魔染: 1 } },
        { p: 15, text: "你什么都没抢到，只在出口的石壁上悟出一式剑意。", attr: { 悟性: 2 }, flag: { 剑心: 1 } },
      ] },
    { id: "z4", title: "心魔劫", weight: 8, once: true, cond: ["flag心魔>=1"],
      text: "突破在即，心魔化作你最深的恐惧，盘踞识海。",
      branches: [
        { p: 35, text: "你直视心魔，看清它的面目——原来是幼年火光中的自己。相拥而泣，心魔自散。", attr: { 心境: 4 }, flag: { 心魔: -1 } },
        { p: 40, text: "你与心魔立约：各让一步。此后每逢月圆，你会变得沉默。", attr: { 心境: 1 }, flag: { 心魔: 1 } },
        { p: 25, text: "心魔渐占上风。你的笑声，开始让同门不安。", attr: { 悟性: 2, 善恶: -5 }, flag: { 魔染: 2 } },
      ] },
    { id: "z5", title: "宗门之难", weight: 7, once: true, cond: ["flag入宗>=1"],
      text: "魔道大举来犯，山门结界如纸。掌门令：弟子携典籍突围。",
      branches: [
        { p: 30, text: "你断后力战，身被七创，护数十弟子突出。宗门保住了火种。", attr: { 声望: 5, 根骨: 1, 善恶: 10 }, flag: { 宗门砥柱: 1 } },
        { p: 25, text: "你趁乱取走了藏经阁镇阁功法，从此隐姓埋名。", attr: { 悟性: 2, 善恶: -10 }, flag: { 叛宗: 1, 散人: 1, 魔染: 1 } },
        { p: 25, text: "魔道长老竟是当年害你全家的仇人！你红了眼，斩其一条手臂后被掳走。", attr: { 心境: -2 }, flag: { 魔仇: 1, 被掳: 1 } },
        { p: 20, text: "混战中师妹替你挡了致命一击，昏迷不醒。", attr: { 心境: -2 }, flag: { 情缘: 1, 师妹重伤: 1 } },
      ] },
    { id: "z6", title: "散修百味", weight: 7, once: true, cond: ["flag散人>=1"],
      text: "无宗门庇护的岁月里，你摆过摊、护过镖、也在乱葬岗里睡过。",
      branches: [
        { p: 35, text: "你炼制的符箓在散修中小有名气，人称「符痴」。", attr: { 金铢: 1000, 机缘: 1 }, flag: { 符缘: 1 } },
        { p: 30, text: "你救了一位垂死的老散修，他临终将毕生感悟倾囊相授。", attr: { 悟性: 3, 心境: 2 } },
        { p: 35, text: "你被悬赏追杀半年，于生死间磨出了自己的道。", attr: { 根骨: 2, 心境: 1, 善恶: -3 }, flag: { 杀伐: 1 } },
      ] },
    { id: "z7", title: "故人重逢", weight: 6, once: true, cond: ["flag情缘>=1"],
      text: "灯会上，已成一代医仙的她认出了你。「这些年，你过得好吗？」",
      branches: [
        { p: 45, text: "你们并肩看了一夜花灯。此后传讯玉符常亮至天明。", attr: { 心境: 3 }, flag: { 道侣: 1 } },
        { p: 30, text: "你以大道未成为由转身离去。她在原地站了很久。", attr: { 心境: -2, 悟性: 1 }, flag: { 负情: 1 } },
        { p: 25, text: "她已为人妇。你们相视一笑，往事随风。", attr: { 心境: 1 } },
      ] },
  ],

  /* ---------------- 金丹期：丹成一道 ---------------- */
  jindan: [
    { id: "j1", title: "结丹", weight: 10, once: true,
      text: "丹田内灵力旋成漩涡，金丹雏形缓缓凝聚。天地灵气疯狂涌来。",
      branches: [
        { p: 25, text: "九转丹成，金丹圆满，方圆百里灵气为之一空！一域震动。", attr: { 声望: 6, 悟性: 2 }, flag: { 九转丹: 1 } },
        { p: 50, text: "金丹凝成，中品之姿，前路仍宽。", attr: { 心境: 1 } },
        { p: 25, text: "丹成下品，且丹上有一道黑纹。", flag: { 裂基: 1, 魔染: 1 } },
      ] },
    { id: "j2", title: "丹道大会", weight: 8, once: true, cond: ["flag丹道>=1"],
      text: "百年一届的丹道大会，你以一炉「回春丹」压轴出场。",
      branches: [
        { p: 35, text: "丹香十里，八品丹成！丹道魁首，得「丹圣」真传一部。", attr: { 声望: 5, 悟性: 2 }, flag: { 丹道: 2, 丹圣传人: 1 } },
        { p: 40, text: "丹成七品，虽败犹荣，与丹道魁首结为好友。", attr: { 机缘: 2 }, flag: { 挚友: 1 } },
        { p: 25, text: "炉毁丹废。你在众目睽睽下离开，当夜重燃炉火。", attr: { 心境: 2 } },
      ] },
    { id: "j3", title: "斩妖除魔", weight: 8, once: true, cond: ["flag杀伐>=1"],
      text: "你的剑下亡魂已过百。这一夜，血魔宗长老设下十面埋伏。",
      branches: [
        { p: 30, text: "十面埋伏，一人一剑破之。江湖从此流传你的名号。", attr: { 声望: 4, 根骨: 1 }, flag: { 剑心: 1 } },
        { p: 30, text: "你重伤垂死，被一位路过的散修所救。他成了你生死之交。", attr: { 心境: 1 }, flag: { 挚友: 1 } },
        { p: 25, text: "你以血为引，初次动用了《噬魂录》第七层……敌人化为干尸。", attr: { 悟性: 2, 善恶: -10 }, flag: { 魔染: 2 } },
        { p: 15, text: "血战不敌，你陨落在乱石岗。——不，你咬碎藏在线中的后手，遁走千里。", attr: { 根骨: -2, 心境: 2 } },
      ] },
    { id: "j4", title: "皇朝旧事", weight: 6, once: true, cond: ["flag皇家>=1"],
      text: "当朝国师找到了你：「殿下，先朝的江山，可还想要吗？」",
      branches: [
        { p: 30, text: "你拒绝了。皇座是枷锁，大道才是归途。国师长叹而去。", attr: { 心境: 3 }, flag: { 弃皇位: 1 } },
        { p: 30, text: "你借皇朝之力搜罗天下灵物，修行一日千里。", attr: { 金铢: 10000, 机缘: 3 }, flag: { 用皇权: 1 } },
        { p: 25, text: "你入主皇朝暗中设立的「司天监」，正邪两道都不敢轻易招惹你。", attr: { 声望: 4 }, flag: { 司天监: 1 } },
        { p: 15, text: "此事被政敌揭发，皇朝发兵围山。你焚山而遁。", attr: { 声望: -3 }, flag: { 散人: 1 } },
      ] },
    { id: "j5", title: "道侣之劫", weight: 7, once: true, cond: ["flag道侣>=1"],
      text: "她的旧疾复发了——那是当年替你挡下的一击，寒毒入髓。",
      branches: [
        { p: 35, text: "你踏遍险地寻来九阳芝，亲手炼丹为她驱毒。她醒来第一句：「值得吗？」你说：「值得。」", attr: { 心境: 3, 善恶: 5 }, flag: { 挚爱: 1 } },
        { p: 30, text: "你闭关冲击元婴，想以境界碾压病魔。出关时，她的棺木已凉。", attr: { 心境: -3, 悟性: 2 }, flag: { 亡侣: 1 } },
        { p: 35, text: "你以自身精血为她续命，修为跌落一层，但你们都活着。", attr: { 根骨: -1, 心境: 2 }, flag: { 挚爱: 1 } },
      ] },
    { id: "j6", title: "雷竹化劫", weight: 6, once: true, cond: ["flag雷竹>=1"],
      text: "识海中的雷击紫竹已长至九节，每节都封存着一道天雷之力。",
      branches: [
        { p: 55, text: "你悟出「以雷炼体」之法，肉身强横堪比妖兽。", attr: { 根骨: 4 }, flag: { 雷体: 1 } },
        { p: 45, text: "紫竹自行引下一道小天雷为你洗炼经脉，你痛苦七日，脱胎换骨。", attr: { 根骨: 3, 心境: 1 }, flag: { 雷体: 1 } },
      ] },
    { id: "j7", title: "宗门权柄", weight: 6, once: true, cond: ["flag宗门砥柱>=1"],
      text: "老掌门寿元将尽，将掌门令牌与你尽唤至榻前。",
      branches: [
        { p: 40, text: "你接下宗门。从此修行之外，肩上多了一座山门。", attr: { 声望: 5 }, flag: { 掌门: 1 } },
        { p: 35, text: "你婉拒，荐贤而退。宗门上下敬你如师长。", attr: { 心境: 2, 声望: 2 }, flag: { 客卿长老: 1 } },
        { p: 25, text: "你接令牌，却在当夜取出宗门禁地中的镇派凶物研究……", attr: { 悟性: 3, 善恶: -8 }, flag: { 掌门: 1, 魔染: 1 } },
      ] },
  ],

  /* ---------------- 元婴期：婴现世，天地宽 ---------------- */
  yuanying: [
    { id: "y1", title: "元婴出窍", weight: 10, once: true,
      text: "金丹碎而元婴生。一个与你一般模样的婴儿盘坐识海，睁开双眼。",
      branches: [
        { p: 30, text: "元婴睁眼刹那，天地异象，紫雷环身——此婴有神灵之姿！", attr: { 悟性: 3, 声望: 3 }, flag: { 神婴: 1 } },
        { p: 50, text: "元婴凝实，神识可笼罩百里。你第一次觉得天地如此之近。", attr: { 心境: 2 } },
        { p: 20, text: "元婴眉心有一缕黑气盘旋，隐隐与你争夺主导。", attr: { 心境: -2 }, flag: { 魔染: 1, 心魔: 1 } },
      ] },
    { id: "y2", title: "域外天魔", weight: 7, once: true, cond: ["flag魔染>=3"],
      text: "识海深处，一道域外天魔的投影盘坐：「同道，何不与我共谋大道？」",
      branches: [
        { p: 30, text: "你以元婴之力将其炼化！反得魔门秘藏，道行大进。", attr: { 悟性: 3, 心境: 1 }, flag: { 魔染: -1, 知天魔: 1 } },
        { p: 40, text: "你与它虚与委蛇，暗中打探魔界虚实。", attr: { 悟性: 2 }, flag: { 知天魔: 1 } },
        { p: 30, text: "你接纳了它。修为暴涨的快感之下，你已分不清自己是人是魔。", attr: { 悟性: 3, 善恶: -15 }, flag: { 魔染: 2, 入魔: 1 } },
      ] },
    { id: "y3", title: "开宗立派", weight: 6, once: true, cond: ["flag掌门>=1"],
      text: "在你的手中，宗门从残破走向鼎盛。山门前求拜师者排至十里。",
      branches: [
        { p: 45, text: "你广开山门，有教无类。百年后，天下修士半出你门下。", attr: { 声望: 8, 善恶: 10 }, flag: { 万世师: 1 } },
        { p: 30, text: "你以铁腕治宗，宗门成为一方霸主，附庸小宗无数。", attr: { 声望: 6, 善恶: -5 }, flag: { 一域霸主: 1 } },
        { p: 25, text: "你渐感俗务缠身，道行停滞，遂急流勇退，传位弟子。", attr: { 心境: 3 }, flag: { 掌门: -1, 客卿长老: 1 } },
      ] },
    { id: "y4", title: "古战场遗迹", weight: 7, once: true,
      text: "你在荒漠之下发现一处上古战场，残留的剑意千年不散。",
      branches: [
        { p: 30, text: "你于剑意中枯坐三年，悟出上界剑诀一篇。", attr: { 悟性: 3 }, flag: { 剑心: 2, 得上界剑诀: 1 } },
        { p: 25, text: "你拾得半块「仙界令」，持此令者，渡劫时可引一线仙光护身。", attr: { 机缘: 4 }, flag: { 仙界令: 1 } },
        { p: 25, text: "古战场的怨魂缠上了你，夜夜入梦。你请高僧诵经三十年方解。", attr: { 心境: -1, 善恶: 3 } },
        { p: 20, text: "遗迹深处沉睡的魔将苏醒了。你全力一击将其轰回封印，名震两道。", attr: { 声望: 4, 根骨: 1 } },
      ] },
    { id: "y5", title: "旧仇了断", weight: 7, once: true, cond: ["flag魔仇>=1"],
      text: "血魔宗宗主——那个毁你全家、乱你宗门的人，此刻就在你面前十丈。",
      branches: [
        { p: 40, text: "百丈剑光起，恩怨今日了。你剑斩魔君，为亡者祭旗。", attr: { 心境: 3, 声望: 5, 善恶: 5 }, flag: { 魔仇: -1, 大仇得报: 1 } },
        { p: 25, text: "他自爆重伤你，却也被你同归于尽的一击打落境界。你活下来了。", attr: { 根骨: -2, 心境: 2 }, flag: { 魔仇: -1, 大仇得报: 1 } },
        { p: 20, text: "你发现他背后另有魔主。你按剑不动，放长线钓大鱼。", attr: { 悟性: 2 }, flag: { 知魔踪: 1 } },
        { p: 15, text: "杀了他之后，你站在原地很久。恨了半生的东西没了，心里空落落的。", attr: { 心境: -1, 悟性: 2 }, flag: { 魔仇: -1, 道问: 1 } },
      ] },
    { id: "y6", title: "天机阁问命", weight: 5, once: true,
      text: "你以千年寿元为酬，问天机阁一句：「我此生，可能飞升？」",
      branches: [
        { p: 40, text: "卦象显示：机缘一线，在东南三千里的死海。你即刻动身。", attr: { 机缘: 3 }, flag: { 得天机: 1 } },
        { p: 35, text: "卦象混沌。阁主摇头：「天机不可泄，亦不可求。」你若有所思。", attr: { 心境: 2, 悟性: 1 }, flag: { 道问: 1 } },
        { p: 25, text: "卦象竟是大凶！「雷劫加倍，仙路无门。」你冷笑：我命由我不由天。", attr: { 心境: 1 }, flag: { 天妒: 1 } },
      ] },
    { id: "y7", title: "魔道之邀", weight: 6, once: true, cond: ["flag入魔>=1"],
      text: "魔主亲临，黑袍如渊：「副教主之位，虚位以待。」",
      branches: [
        { p: 35, text: "你接受了。魔道大军在你整合下脱胎换骨。", attr: { 声望: 4, 善恶: -15 }, flag: { 魔道副尊: 1 } },
        { p: 30, text: "你表面归顺，实则意在魔主的《不死魔典》。", attr: { 悟性: 2, 善恶: -5 }, flag: { 魔道卧底: 1 } },
        { p: 35, text: "你拒绝了。魔主大笑：「那便看看，是你的道快，还是我的魔快。」", attr: { 心境: 2 }, flag: { 魔主之敌: 1 } },
      ] },
  ],

  /* ---------------- 化神期：神游太虚，问鼎大道 ---------------- */
  huashen: [
    { id: "h1", title: "化神", weight: 10, once: true,
      text: "元婴蜕变，神魂离体可游太虚。你看见了这个世界之外的东西——世界壁障上的裂缝。",
      branches: [
        { p: 35, text: "你神游天外，一窥仙界投影，道行暴涨。", attr: { 悟性: 4, 心境: 2 }, flag: { 见仙界: 1 } },
        { p: 40, text: "你稳住神魂，与天地共鸣，从此法力生生不息。", attr: { 根骨: 2, 心境: 1 } },
        { p: 25, text: "神游时你撞见了「它」——壁障外那个注视此界的存在。它看了你一眼。", attr: { 心境: -2, 机缘: 2 }, flag: { 被注视: 1 } },
      ] },
    { id: "h2", title: "大道之问", weight: 8, once: true, ask: true, cond: ["flag道问>=1"],
      text: "修行千年，你站在山巅自问：「我求的道，究竟是什么？」这一问，关乎此生道途。",
      choices: [
        { label: "「道是逍遥。」", outcomes: [
          { p: 60, text: "你大笑下山，从此天地为庐。心境大圆满。", attr: { 心境: 5 }, flag: { 道心圆满: 1 } },
          { p: 40, text: "话音落下，你心中却掠过一丝不甘——逍遥二字，说来容易。", attr: { 心境: 1 } },
        ]},
        { label: "「道是众生。」", outcomes: [
          { p: 55, text: "你开坛讲道三百年，桃李满天下。", attr: { 声望: 8, 善恶: 15 }, flag: { 道心圆满: 1, 万世师: 1 } },
          { p: 45, text: "听者寥寥。你在空荡的讲坛上独坐了一夜，若有所悟。", attr: { 声望: 2, 心境: 1 } },
        ]},
        { label: "「道是我。」", outcomes: [
          { p: 50, text: "你斩去犹疑，一念通天，杀伐道成。", attr: { 心境: 3, 善恶: -10 }, flag: { 剑心: 1, 道心圆满: 1 } },
          { p: 50, text: "「我」之一字太重，你被反噬心魔缠身。", attr: { 心境: -2 }, flag: { 心魔: 1 } },
        ]},
      ] },
    { id: "h3", title: "仙魔大战", weight: 8, once: true,
      text: "魔主撕开世界壁障，魔界大军压境。正道残存修士齐聚诛魔阵前。",
      branches: [
        { p: 25, text: "你执阵眼，率群雄血战九日，终将魔主打回魔界！天下修士奉你为「擎天柱」。", attr: { 声望: 10, 善恶: 15, 心境: 2 }, flag: { 诛魔首功: 1 } },
        { p: 20, text: "你临阵倒戈，与魔主里应外合。正道十不存一，你成了魔界之下的第一人。", attr: { 声望: -10, 善恶: -25 }, flag: { 魔染: 3, 入魔: 1, 魔道副尊: 2, 天下公敌: 1 } },
        { p: 20, text: "你与魔主单挑于九天之上，两败俱伤。你坠入凡尘养伤百年。", attr: { 根骨: -3, 心境: 3, 声望: 5 } },
        { p: 20, text: "战况惨烈，挚友为掩护你自爆元婴。你抱着他的遗蜕，一夜白头。", attr: { 心境: -2, 悟性: 3 }, flag: { 亡友: 1 } },
        { p: 15, text: "你赶到时大战已歇，遍地焦土。你在废墟里种下一棵桃树。", attr: { 心境: 2, 善恶: 5 } },
      ] },
    { id: "h4", title: "魔染清洗", weight: 8, once: true, ask: true, cond: ["flag魔染>=2"],
      text: "魔染已深。神魂中黑气与灵光各半，此消彼长。道途至此，如何自处？",
      choices: [
        { label: "挥剑自斩魔染", outcomes: [
          { p: 55, text: "你自斩魔染！修为跌落，神魂重创，但你还是你。", attr: { 心境: 4, 根骨: -2 }, flag: { 魔染: -3 } },
          { p: 45, text: "黑气早与道基相连，斩之不断，反伤本源。", attr: { 根骨: -2, 心境: -1 }, flag: { 魔染: -1 } },
        ]},
        { label: "以魔证道，黑白共生", outcomes: [
          { p: 60, text: "你以魔证道，从此亦正亦邪，只凭本心。", attr: { 心境: 2, 善恶: -5, 悟性: 2 }, flag: { 魔染: 0, 亦正亦邪: 1 } },
          { p: 40, text: "共生失败，黑气趁虚而入。", flag: { 魔染: 2, 入魔: 1 } },
        ]},
        { label: "放任自流，由它去", outcomes: [
          { p: 50, text: "你与魔染相安无事，只是夜里，越来越少入睡。", attr: { 悟性: 1 } },
          { p: 50, text: "黑气彻底吞没了灵光。你睁开眼，瞳孔已成竖环。", attr: { 悟性: 3, 善恶: -20 }, flag: { 魔染: 3, 入魔: 2 } },
        ]},
      ] },
    { id: "h5", title: "仙缘将至", weight: 6, once: true,
      text: "天穹之上雷云开始汇聚——那是天劫将至的征兆。世人皆言：劫起处，仙路开。",
      branches: [
        { p: 40, text: "你回到初入道时的那座山，静坐候劫。", attr: { 心境: 3 }, flag: { 归山: 1 } },
        { p: 30, text: "你与道侣执手，共赴雷劫。", attr: { 心境: 2 }, cond_flag: "道侣", flag: { 双修赴劫: 1 } },
        { p: 30, text: "你闭死关，将毕生所悟炼成最后一式。", attr: { 悟性: 2 }, flag: { 悟终极: 1 } },
      ] },
    { id: "h6", title: "桃树结果", weight: 4, once: true, cond: ["flag万世师>=1"],
      text: "当年废墟里的桃树已亭亭如盖。树下，你的弟子们正教着一群新入门的孩童。",
      branches: [
        { p: 60, text: "你看了一整天，直到暮色四合。「真好。」", attr: { 心境: 3 } },
        { p: 40, text: "一个孩童抬头望见你，怔怔地问：「仙人也會老吗？」你笑着没有回答。", attr: { 心境: 2, 悟性: 1 }, flag: { 道问: 1 } },
      ] },
  ],

  /* ---------------- 渡劫期：九霄雷临，各归其位 ---------------- */
  dujie: [
    { id: "d1", title: "天劫第一重", weight: 10, once: true,
      text: "雷云压城，第一道紫雷劈落，天地失色。",
      branches: [
        { p: 40, text: "你硬撼天雷，雷光洗礼肉身。第一重，过！", attr: { 根骨: 2, 心境: 1 } },
        { p: 40, text: "你以巧劲引雷入地，险险撑过。", attr: { 心境: 1 } },
        { p: 20, text: "雷力入体，你呕血不止，道基嗡鸣。", attr: { 根骨: -2, 心境: -1 }, flag: { 劫伤: 1 } },
      ] },
    { id: "d2", title: "天劫·心魔雷", weight: 10, once: true, cond: ["flag心魔>=1"],
      text: "第五重雷竟是心魔雷。雷光中，你看到了此生所有悔恨的场景。",
      branches: [
        { p: 30, text: "你直面一切悔恨，一一放下。心魔雷竟成了你的磨刀石。", attr: { 心境: 4 }, flag: { 心魔: -1, 道心圆满: 1 } },
        { p: 40, text: "你在幻境中沉浮良久，最终咬舌破幻，狼狈渡过。", attr: { 心境: -1 } },
        { p: 30, text: "幻境太美，你不想醒来——道躯在雷光中开始崩解。", death: true, jump: "end_dream" },
      ] },
    { id: "d3", title: "天劫·九霄灭世雷", weight: 20, once: true, ask: true,
      text: "第九重，灭世雷。雷海压顶，万丈紫光里连影子都被撕碎。此雷过后，或为仙，或为灰。最后一步，你怎么走？",
      choices: [
        { label: "身融剑诀，一剑开天", outcomes: [
          { p: 45, text: "你身融剑诀，一剑开天！雷海为你让路，九天之上裂开一线天光。", attr: { 心境: 2 }, flag: { 渡劫成功: 1 } },
          { p: 20, text: "剑势未尽，雷光已至。你硬撑着劈开雷海，半边身子焦黑，却终究站住了。", attr: { 根骨: -1, 心境: 1 }, flag: { 渡劫成功: 1, 劫伤: 1 } },
          { p: 20, text: "剑断，人未亡。元婴裹着神魂遁入轮回——兵解。", flag: { 兵解: 1 }, jump: "end_reincarnate" },
          { p: 15, text: "万丈雷光中，你的剑与你一同化为飞灰。", death: true, jump: "end_death" },
        ]},
        { label: "肉身为炉，硬扛九雷", outcomes: [
          { p: 35, text: "九雷灌体，骨骼寸寸碎裂又寸寸重生。雷散之时，你周身雷纹流转，宛如神祇。", attr: { 根骨: 3 }, flag: { 渡劫成功: 1, 雷体: 1 } },
          { p: 30, text: "你以血肉之躯生生扛下九雷。活下来了，只是此后每逢阴雨，骨头都疼。", attr: { 根骨: -1 }, flag: { 渡劫成功: 1, 劫伤: 1 } },
          { p: 20, text: "第五雷落下时，你的肉身终于崩解。元婴仓皇遁走，兵解转世。", flag: { 兵解: 1 }, jump: "end_reincarnate" },
          { p: 15, text: "最后一雷落下，天地间只剩一具焦黑的轮廓。", death: true, jump: "end_death" },
        ]},
        { label: "散去修为，兵解保命", outcomes: [
          { p: 100, text: "你散尽千年修为，以元婴裹住神魂遁入轮回。雷海在身后合拢，人间再无你的气息。来世，再走一遭。", flag: { 兵解: 1 }, jump: "end_reincarnate" },
        ]},
      ] },
    { id: "d4", title: "仙门开阖", weight: 9, once: true, ask: true, cond: ["flag渡劫成功>=1"],
      text: "雷散云开，一道仙门在九天之上缓缓打开。门后，是你从未见过的光。仙路在前，此身何往？",
      choices: [
        { label: "整衣冠，踏入仙门", outcomes: [
          { p: 75, text: "你一步踏入仙门，身后人间万里山河如画。后世修士谈起你，都说：那一年，白日飞升，天上人间共见。", flag: { 飞升: 1 } },
          { p: 25, text: "跨出门的一瞬，你想起山门前的老槐树，想起她……你收回了脚。", flag: { 留人间: 1 } },
        ]},
        { label: "执她之手，共赴仙门", cond_flag: "道侣", outcomes: [
          { p: 60, text: "此去仙界，也要并肩。", flag: { 双飞升: 1 } },
          { p: 40, text: "她摇头轻笑：「我的道在人间。」你在门前站了很久，最终还是留了下来。", attr: { 心境: 2 }, flag: { 留人间: 1, 挚爱: 1 } },
        ]},
        { label: "转身离去，此界即归宿", outcomes: [
          { p: 60, text: "仙门在你身后缓缓关闭，你没有回头。此后千年，荒漠有井，疫城有丹，恶水有桥。", flag: { 留人间: 1 } },
          { p: 40, text: "仙门之后传来说笑声，仙人对弈，视众生如棋。你冷笑离去——此界之外，未必是归宿。", attr: { 悟性: 2 }, flag: { 留人间: 1, 道问: 1 } },
        ]},
      ] },
  ],
};

/* ============================ 特色事件（自动结算） ============================
 * 每个选项的 outcomes 是独立概率分布：
 *   p     权重（与同组其它结果按比例归一）
 *   tier  good 上签 / mid 平 / bad 下签，用于结算配色
 *   attr / flag / lifespan 结算内容；ending 可指定结局；death 为身死
 * 选项的 req 为门槛：如 "金铢>=500"、"flag:剑心>=1"、"善恶>=20"
 * 玩家开局做完五次选择后，事件由天意自动挑选项、自动掷结果。
 * ============================================================ */
const SPECIALS = (typeof module !== "undefined" && module.exports)
  ? require("./specials.js")
  : (typeof window !== "undefined" ? (window.XIUXIAN_SPECIALS || {}) : {});

/* ============================ 标记名称（结局界面展示） ============================ */
const FLAG_NAMES = {
  剑心: "剑心通明", 剑魂: "古剑认主", 得飞剑: "本命飞剑", 剑缘: "剑缘初结",
  丹道: "丹道造诣", 器道: "器道造诣", 符缘: "符道机缘", 雷体: "雷劫淬体", 雷竹: "雷竹认主",
  魔染: "魔染", 入魔: "入魔", 心魔: "心魔缠身", 魔仇: "血海深仇", 魔主之敌: "魔主之敌",
  知魔踪: "洞悉魔踪", 知天魔: "知晓天魔", 道侣: "道侣", 挚爱: "挚爱", 情缘: "情缘",
  挚友: "生死之交", 亲情: "血脉亲情", 弟子: "亲传弟子", 掌门: "一宗之主", 客卿长老: "客卿长老",
  宗门砥柱: "宗门砥柱", 万世师: "万世师表", 道心圆满: "道心圆满", 道问: "大道之问",
  完美道基: "完美道基", 神婴: "神婴", 裂基: "道基有裂", 仙界令: "仙界令", 补天者: "补天者",
  被注视: "被注视", 留人间: "留驻人间", 飞升: "白日飞升", 双飞升: "携手飞升",
  善缘: "善缘", 功德: "功德", 妖缘: "妖缘", 妖仇: "妖仇", 结仇: "结仇", 孤星: "天煞孤星",
  上界传承: "上界传承", 见仙界: "得见仙界", 护界: "护界之功", 星核: "天外星核",
  仙缘: "仙缘", 同心: "同心", 见龙: "见龙", 剑意: "剑意",
  正道: "正道", 中立: "亦正亦邪", 魔道: "魔道", 无情: "无情道", 天骄: "天骄", 寒门: "寒门",
  血刀: "血刀门", 万宝: "万宝楼", 符道: "符道造诣", 阵道: "阵道造诣", 隐世: "隐世", 无道: "逆天者",
  破釜沉舟: "破釜沉舟", 稳中求进: "稳中求进", 借丹破境: "借丹破境",
};

/* ============================ 结局表 ============================
 * priority 数字越大越优先匹配（引擎从高到低扫描）。
 * ============================================================ */
const ENDINGS = [
  { id: "end_ascend_duo", priority: 100, name: "携手飞升",
    cond: ["flag双飞升>=1"],
    desc: "仙门之内，回望来路。她问你：「后悔吗？」你说：「有你在，哪里都是仙界。」\n——一世仙途，两人同行。" },

  { id: "end_ascend", priority: 95, name: "白日飞升",
    cond: ["flag飞升>=1"],
    desc: "你一步踏入仙门，身后人间万里山河如画。\n后世修士谈起你，都说：那一年，白日飞升，天上人间共见。" },

  { id: "end_sword_immortal", priority: 90, name: "剑仙证道",
    cond: ["flag渡劫成功>=1", "flag剑心>=2"],
    desc: "你以剑证道，没有走进仙门——你说仙界太小，装不下你的剑。\n从此人间多了一位剑仙，九天之上，剑气纵横三万里。" },

  { id: "end_stay", priority: 88, name: "人间行者",
    cond: ["flag留人间>=1"],
    desc: "你留了下来。仙门在你身后缓缓关闭，你没有回头。\n此后千年，荒漠有井，疫城有丹，恶水有桥。有人问你是谁，你只是笑。" },

  { id: "end_guardian", priority: 87, name: "界壁守望",
    cond: ["flag补天者>=1"],
    desc: "你没有飞升。你留在世界壁障的裂缝前，以身为针，一坐就是万年。\n后来有修士神游太虚，看见一道人影缝在虚空里，背对着人间。\n那人影没有回头，只留下一句话：别怕，还撑得住。" },

  { id: "end_demon_lord", priority: 96, name: "魔主临世",
    cond: ["flag入魔>=2", "flag渡劫成功>=1", "flag魔道>=1"],
    desc: "九雷渡尽，你立于魔渊之巅，俯瞰两界。\n仙门为你而开，你却笑了：「仙又如何？」\n——一个时代的梦魇，就此开始。" },

  { id: "end_holy_body", priority: 92, name: "肉身成圣",
    cond: ["flag渡劫成功>=1", "flag体修>=1"],
    desc: "雷光散尽，你周身金光如铸。你未借仙门，以肉身撞破世界壁障，一步踏出。\n壁障之上，留下了一个人的形状。" },

  { id: "end_dream", priority: 75, name: "长梦不醒",
    cond: [],
    trigger: "end_dream",
    desc: "幻境太美——那里有健全的家，有活着的故人，有未曾错过的人。\n你在雷光中微笑着闭上了眼，从此再也没有醒来。\n（渡劫失败·殁于心魔雷）" },

  { id: "end_reincarnate", priority: 70, name: "兵解转世",
    cond: ["flag兵解>=1"],
    desc: "元婴裹着你的神魂坠入轮回。奈何桥头，你回望仙路，一步之遥。\n——来世，再走一遭。\n（本结局可开启「二周目」：保留部分天赋重开）" },

  { id: "end_alchemy", priority: 60, name: "丹道祖师",
    cond: ["flag丹道>=2"],
    desc: "你终究没能等到自己的天劫——寿元在最后一炉丹的香气中燃尽。\n你留下的《九转残方》滋养了此后十万炼丹师。\n你炼的最后一颗丹，取名「人间」。" },

  { id: "end_artifact", priority: 58, name: "万器之祖",
    cond: ["flag器道>=2"],
    desc: "你一生炼器，炉火未曾熄过。你留下的第一万件法器是一柄没有开锋的剑，剑柄上刻着：给后来人。\n后世器修入门，都要先向你的炉位敬一炷香。" },

  { id: "end_talisman", priority: 59, name: "符道千秋",
    cond: ["flag符道>=2"],
    desc: "你画的最后一张符，贴在了人间与魔渊的裂缝上。三百年后符纸泛黄，裂缝没再开过。\n后来符修开笔，都要先朝你结庐的方向拜一拜。" },

  { id: "end_formation", priority: 57, name: "万阵之宗",
    cond: ["flag阵道>=2"],
    desc: "你以余生布下三千阵，山川湖泊皆是棋盘。魔潮来袭那夜，大地亮起了线。\n后世阵修入门第一课：阵不是困人的，是守人的。" },

  { id: "end_yao", priority: 56, name: "万妖之友",
    cond: ["flag妖缘>=2"],
    desc: "人妖两族打了几千年，你却在中立的荒原上开了一间酒肆。\n妖族长老来喝酒，正道修士也来喝酒。他们打起来的时候，你只是把酒价涨了一倍。\n你死那天，荒原上来了很多不是人的东西，为你守了七夜灵。" },

  { id: "end_sect_master", priority: 55, name: "桃李天下",
    cond: ["flag万世师>=1"],
    desc: "你没有飞升。你说：「仙界不缺一个仙人，人间缺一个讲道的。」\n千年之后，你坐化于桃树之下，满山弟子披麻，天下修士缟素。" },

  { id: "end_paragon", priority: 46, name: "正道魁首",
    cond: ["flag正道>=1"],
    desc: "你没有飞升，也没有堕入魔道。你在人间立了一座碑，碑上刻着所有被你救过的人的名字。\n后来碑被风雨磨平了，人们还是记得：那年有个正道修士，替他们挡过一刀。" },

  { id: "end_wanderer", priority: 43, name: "逍遥散人",
    cond: ["flag中立>=1"],
    desc: "你不属于任何一边。正道请你除魔，魔道请你喝酒，你谁的面子都不给。\n最后你在东海钓了三百年的鱼，鱼没钓到几条，倒是把自己钓明白了。" },

  { id: "end_demon_way", priority: 44, name: "魔道巨擘",
    cond: ["flag魔道>=1"],
    desc: "你没有成为魔主，却成了魔道最锋利的一把刀。正道怕你，魔道也怕你。\n你死之后，魔渊裂成两半，一半为你陪葬。" },

  { id: "end_solo", priority: 42, name: "太上忘情",
    cond: ["flag无情>=1"],
    desc: "你谁也没有选。剑就是你的道侣，风就是你的归处。\n后来有人在山顶看见一块无字碑，碑前插着一柄剑，剑还在等它的主人。" },

  { id: "end_hermit", priority: 89, name: "归隐林泉",
    cond: ["flag挚爱>=1", "flag道心圆满>=1"],
    desc: "大劫之后，你与她隐入南山。晨起采药，暮时对弈。\n偶尔有御剑的年轻人路过，讨一碗水喝，问起当年的大事，你们相视一笑：「不记得了。」" },

  { id: "end_demon_slain", priority: 45, name: "堕魔被诛",
    cond: ["flag魔染>=4"],
    desc: "你的疯魔惊动了天下。诛魔阵下，九位化神老怪围你七日。\n你死于昔日好友的剑下。他抱着你的尸身，像很多年前那个火夜一样，无声流泪。" },

  { id: "end_possess", priority: 91, name: "夺舍续命",
    cond: ["flag魔染>=3", "flag劫伤>=1"],
    desc: "劫伤难愈，寿元将尽。你最后一次炼化《噬魂录》，夺舍了一名天才少年。\n铜镜里陌生的脸上，浮现你熟悉的笑。\n——你活下来了。可「你」是谁？" },

  { id: "end_daotian", priority: 41, name: "逆天而行",
    cond: ["flag无道>=1"],
    desc: "天道要你低头，你偏要抬头。雷劫加身那夜，你笑着一剑指天。\n你输了，但从此天道的规矩里，多了一条由你写下的例外。" },

  { id: "end_hidden", priority: 40, name: "隐世高人",
    cond: ["flag隐世>=1"],
    desc: "天下大乱时你在种菜，天下太平后你在喂鸡。偶尔有人寻上山来，你也只是指指路。\n可满山鸡都听你的话，风也绕着你的屋檐走——这世上到底谁修为最高，说不清楚。" },

  { id: "end_longevity", priority: 30, name: "寿元耗尽",
    cond: [],
    desc: "卡在化神巅峰三百年，天劫始终未至。你的头发白了，牙齿落了，握剑的手开始颤抖。\n最后一夜，你坐在当年拜师的山门前，看着日出，慢慢闭上了眼。" },

  { id: "end_death", priority: 10, name: "身死道消",
    cond: [],
    desc: "大道争渡，百死一生。这一次，运气没有站在你这边。\n你的故事停在了一柄断剑、一座荒冢，和后来者一声轻轻的叹息里。" },
];

/* ============================ 分支总览（设计备忘） ============================
 *
 * 主干：凡人 → 练气 → 筑基 → 金丹 → 元婴 → 化神 → 渡劫 → 结局
 *
 * 核心分支轴：
 *   1. 正邪轴   flag魔染：0→纯净正道 / 2+→魔功缠身 / 4+→天下公敌 / 入魔2+→魔主线
 *   2. 流派轴   剑心(剑仙) / 丹道(丹祖) / 雷体(肉身成圣) / 万世师(桃李天下)
 *   3. 情缘轴   情缘→道侣→挚爱 / 亡侣(负反馈) / 负情 → 归隐结局需要挚爱+道心圆满
 *   4. 宗门轴   入宗/拜师/散人 → 宗门砥柱→掌门→万世师 / 叛宗→散人+魔染
 *   5. 超越轴   宿慧/重修(隐藏身世) / 被注视(天外存在，留作续作伏笔)
 *
 * 结局流转：
 *   渡劫成功 ──┬─ 入仙门 → 白日飞升 / 携手飞升(道侣)
 *              ├─ 剑心>=2 → 剑仙证道
 *              ├─ 雷体 → 肉身成圣
 *              ├─ 入魔2 → 魔主临世
 *              └─ 留人间 → 人间行者
 *   渡劫失败 ──┬─ 心魔雷幻境 → 长梦不醒
 *              ├─ 元婴遁走 → 兵解转世(二周目入口)
 *              └─ 灰飞烟灭 → 身死道消
 *   未至渡劫 ──┬─ 丹圣传人+寿尽 → 丹道祖师
 *              ├─ 万世师 → 桃李天下
 *              ├─ 挚爱+道心圆满 → 归隐林泉
 *              ├─ 魔染>=4 → 堕魔被诛
 *              ├─ 魔染>=3+劫伤 → 夺舍续命
 *              ├─ 寿元耗尽 → 寿元耗尽结局
 *              └─ 凡人期未入道 → 凡人终老
 *
 * ============================================================ */

/* 暴露给引擎（浏览器通过 <script src> 引入；Node 测试通过 require 读取） */
const XIUXIAN_SCRIPT = {
  CONFIG, TALENTS, STAGES, EVENTS, FILLERS, ENDINGS,
  SECTS, PROFESSIONS, ALIGNMENTS, PARTNERS, SCRIPTS,
  SPECIALS, FLAG_NAMES,
};
if (typeof window !== "undefined") window.XIUXIAN_SCRIPT = XIUXIAN_SCRIPT;
if (typeof module !== "undefined" && module.exports) module.exports = XIUXIAN_SCRIPT;
