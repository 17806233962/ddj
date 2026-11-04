/* ============================================================
 * 《一世仙途 · 命途》剧情树数据 v1.0
 * ------------------------------------------------------------
 * 一棵连续的剧情树：每个节点固定、每个选项有舍有得，
 * 且每个选项自带 上/中/下签 概率分布（下签可能把枝走歪）。
 *
 * 节点字段：
 *   title / age / text      年龄与剧情
 *   require                 属性门槛（死关 gate:"death" 不达标即死；
 *                           凡关 gate:"skip" 不达标剧情不触发，直接跳 failGoto）
 *   enter                   到达本节点时自动结算的属性
 *   options[]               选项
 * 选项字段：
 *   text / gain(得) / lose(舍，数值=失去的量，引擎自动扣除)
 *   need(使用前提) / goto(默认去向)
 *   odds[]                  上/中/下签分布：{p, tier, text, bonus, goto}
 * ============================================================ */
(function (root, factory) {
  const d = factory();
  if (typeof module === "object" && module.exports) module.exports = d;
  if (root) root.FATE_TREE = d;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const START = { 悟性: 2, 根骨: 2, 心境: 2, 机缘: 2, 声望: 1, 魔染: 0, 金铢: 0, 寿元: 80 };
  const ATTR_KEYS = ["悟性", "根骨", "心境", "机缘", "声望", "魔染", "金铢", "寿元"];

  const NODES = {
    /* ---------------- 共通 ---------------- */
    n0: {
      title: "出身", age: 8,
      text: "你生在云梦山脚下的溪尾村。这一年你八岁，人生的第一个岔口，其实在你出生那天就已经摆好了。",
      options: [
        { text: "农家子，筋骨结实", gain: { 根骨: 2 }, goto: "n1",
          odds: [
            { p: 30, tier: "good", text: "你天生神力，村里人都说你该去屠龙。", bonus: { 根骨: 1 } },
            { p: 70, tier: "mid", text: "你在田埂上长大，吃得苦。" },
          ] },
        { text: "商贾子，家底殷实", gain: { 金铢: 250 }, goto: "n1",
          odds: [
            { p: 30, tier: "good", text: "你从小耳濡目染，一眼能看出货的虚实。", bonus: { 机缘: 1 } },
            { p: 70, tier: "mid", text: "你识字比摸锄头早。" },
          ] },
        { text: "书香子，读书种子", gain: { 悟性: 2 }, goto: "n1",
          odds: [
            { p: 30, tier: "good", text: "先生说你过目不忘。", bonus: { 悟性: 1 } },
            { p: 70, tier: "mid", text: "你比同龄人瘦，也比同龄人静。" },
          ] },
      ],
    },

    n1: {
      title: "山中来客", age: 12,
      text: "十二岁那年秋天，山外来了三个人：一位云游老道，一个货郎，一个咳血的病书生。三人都在村里歇脚，都多看了你一眼。这一眼，就是三条命途。",
      options: [
        { text: "拜老道为师，踏上问道之路", gain: { 悟性: 2, 声望: 1 }, goto: "n_a1",
          odds: [
            { p: 40, tier: "good", text: "老道抚须而笑，收你为关门弟子。", bonus: { 声望: 1 } },
            { p: 45, tier: "mid", text: "老道收下你，却什么也不教，只让你先挑三年水。" },
            { p: 15, tier: "bad", text: "老道看了很久，摇头走了。你追出十里，他终于停下，传了你一段呼吸法。", bonus: { 机缘: 1 } },
          ] },
        { text: "跟货郎走，去山外闯荡", gain: { 魔染: 2, 悟性: 1, 金铢: 100 }, goto: "n_b1",
          odds: [
            { p: 30, tier: "good", text: "货郎教你的第一味药，是断肠草。" },
            { p: 50, tier: "mid", text: "你跟着他走街串巷，学会了看人脸色吃饭。" },
            { p: 20, tier: "bad", text: "货郎半路想把你卖了，你偷了他的钱袋连夜跑路。", bonus: { 金铢: 100 } },
          ] },
        { text: "留下照顾病书生，听他讲山外的天下", gain: { 心境: 2 }, goto: "n_c1",
          odds: [
            { p: 35, tier: "good", text: "你帮家里收了秋粮，来年赋税减免，县令夸你聪慧。", bonus: { 声望: 1 } },
            { p: 65, tier: "mid", text: "你守着几亩田，日子平淡，心里踏实。" },
          ] },
      ],
    },

    /* ---------------- 问道线 ---------------- */
    n_a1: {
      title: "入门试炼", age: 16, gate: "death",
      require: { stats: ["根骨"], value: 2 },
      failText: "青云崖高千丈。负石登崖那日，你筋骨太弱，半途吐血坠下。同门把你葬在了崖底。",
      text: "入门第一课：负石登青云崖。崖高千丈，同门十个里，有一个下不来。",
      options: [
        { text: "苦读道经，以悟破关", gain: { 悟性: 2 }, goto: "n_a2",
          odds: [
            { p: 45, tier: "good", text: "你把《青云引》倒背如流，执事长老多看了你一眼。", bonus: { 悟性: 1 } },
            { p: 40, tier: "mid", text: "你中规中矩，通过了试炼。" },
            { p: 15, tier: "bad", text: "你走火岔气，吐了三日血。", bonus: { 根骨: -1 } },
          ] },
        { text: "负石登崖，以身淬体", gain: { 根骨: 2, 机缘: 1 }, lose: { 寿元: 5 }, goto: "n_a2",
          odds: [
            { p: 40, tier: "good", text: "你在崖顶看云海翻涌，忽然懂了什么叫气。", bonus: { 悟性: 1 } },
            { p: 45, tier: "mid", text: "你咬牙登顶，双腿抖了一路。" },
            { p: 15, tier: "bad", text: "你在崖腰失手，摔断了一条腿。", bonus: { 根骨: -2 } },
          ] },
        { text: "广结同门，借力通关", gain: { 声望: 2 }, goto: "n_a2",
          odds: [
            { p: 35, tier: "good", text: "人人都愿意帮你背一段路。" },
            { p: 50, tier: "mid", text: "你混在队伍中段，有惊无险。" },
            { p: 15, tier: "bad", text: "你最好的朋友偷了你的储物袋。", bonus: { 金铢: -100 } },
          ] },
      ],
    },

    n_a2: {
      title: "筑基死关", age: 24, gate: "death",
      require: { stats: ["悟性", "根骨"], value: 6 },
      failText: "筑基那夜，道基崩裂。你走火入魔，死在了自己撞上的第一道大关口。",
      text: "筑基之日已至。这些年修下的底子是厚是薄，道台最诚实——撑不住的人，当场化作血雾。",
      options: [
        { text: "道基初成，闭关温养", gain: { 心境: 1 }, goto: "n_a3",
          odds: [
            { p: 50, tier: "good", text: "三年枯坐，水到渠成。" },
            { p: 35, tier: "mid", text: "你闯过关，险些脱力。" },
            { p: 15, tier: "bad", text: "差一线火候，你呕血不止。", bonus: { 根骨: -1 } },
          ] },
        { text: "不待元气平复，以神识淬体", gain: { 悟性: 2 }, lose: { 寿元: 8 }, goto: "n_a3",
          odds: [
            { p: 55, tier: "good", text: "你以命相搏，竟真撞开了那扇门。" },
            { p: 30, tier: "mid", text: "门开了一半，你挤了过去。" },
            { p: 15, tier: "bad", text: "你伤了对的根本，此后修为一日慢过一日。", bonus: { 根骨: -2 } },
          ] },
      ],
    },

    n_a3: {
      title: "同门构陷", age: 32,
      text: "与你同期入门的师姐，把你参悟出的内门功法抢先献给了长老，反咬一口，说是你偷她的。人证是她自己。",
      options: [
        { text: "隐忍不发，以静制动", gain: { 心境: 2 }, goto: "n_a4",
          odds: [
            { p: 50, tier: "good", text: "两年后她修炼出岔，是你救的她。她跪在你门前一夜。" },
            { p: 50, tier: "mid", text: "你忍下了。夜里你磨剑磨到天亮。" },
          ] },
        { text: "当众对质，讨个公道", gain: { 声望: 2 }, goto: "n_a4",
          odds: [
            { p: 40, tier: "good", text: "你对答如流，长老明察，师姐被罚思过。", bonus: { 声望: 1 } },
            { p: 40, tier: "mid", text: "长老和了稀泥，事情不了了之。" },
            { p: 20, tier: "bad", text: "长老各打五十大板。你咽不下这口气。", bonus: { 魔染: 1 } },
          ] },
        { text: "夜杀叛徒，以绝后患", gain: { 魔染: 2 }, goto: "n_a4",
          odds: [
            { p: 50, tier: "good", text: "月黑风高，无人知晓。" },
            { p: 35, tier: "mid", text: "她死前抓伤了你的手背。疤留了一辈子。" },
            { p: 15, tier: "bad", text: "被巡夜弟子撞见，你只得灭口。", bonus: { 魔染: 1 } },
          ] },
      ],
    },

    n_a4: {
      title: "秘境之邀", age: 40, gate: "skip",
      require: { stats: ["机缘"], value: 2 },
      failText: "秘境名额二十人，没有你。你站在山门口，看他们进去，又看他们出来。",
      failGoto: "n_a5",
      text: "青云秘境百年一开，机缘者入。名额按历年功过与气数划定。",
      options: [
        { text: "深入禁地，探人未探之处", gain: { 机缘: 2 }, goto: "n_a5",
          odds: [
            { p: 40, tier: "good", text: "你在禁地深处拾得半卷剑诀。", bonus: { 悟性: 2 } },
            { p: 40, tier: "mid", text: "你捡了些灵石灵草，不虚此行。", bonus: { 金铢: 150 } },
            { p: 20, tier: "bad", text: "守护傀儡苏醒，你拼死逃出。", bonus: { 根骨: -2 } },
          ] },
        { text: "护同门周全，同进同退", gain: { 声望: 3, 心境: 1 }, goto: "n_a5",
          odds: [
            { p: 55, tier: "good", text: "你背出两名重伤同门，掌门亲赐丹药。", bonus: { 根骨: 1 } },
            { p: 45, tier: "mid", text: "你平安带队出入，落了个稳妥的名声。" },
          ] },
        { text: "独吞宝物，瞒天过海", gain: { 金铢: 300, 魔染: 1 }, goto: "n_a5",
          odds: [
            { p: 45, tier: "good", text: "你找到一方小千世界的遗藏，取走全部灵石。" },
            { p: 40, tier: "mid", text: "你只来得及拿走一半。" },
            { p: 15, tier: "bad", text: "宝物是诱饵，你被魔修捉去做了一月苦力。", bonus: { 根骨: -1 } },
          ] },
      ],
    },

    n_a5: {
      title: "金丹天劫", age: 48, gate: "death",
      require: [
        { stats: ["根骨"], value: 4 },
        { stats: ["金铢"], value: 300 },
      ],
      failText: "雷劫轰顶。你的护体灵光像纸一样破了，第九道雷落下时，人间再无你。",
      text: "结丹需渡雷劫。要么根骨硬到扛得住，要么有钱买到护劫符。天道不讲情面，但收钱。",
      options: [
        { text: "硬撼雷劫，以身证道", gain: { 根骨: 1 }, lose: { 寿元: 10 }, goto: "n_a6",
          odds: [
            { p: 55, tier: "good", text: "你在雷光里悟出了自己的道。", bonus: { 悟性: 2 } },
            { p: 30, tier: "mid", text: "你焦头烂额地撑过了九雷。" },
            { p: 15, tier: "bad", text: "九道雷，你在第八道上倒了下去。", bonus: { 根骨: -2 } },
          ] },
        { text: "重金求购护劫符", lose: { 金铢: 300 }, goto: "n_a6",
          need: { stats: ["金铢"], value: 300 },
          odds: [
            { p: 80, tier: "good", text: "符光护体，你安然渡过，只是金丹品相一般。" },
            { p: 20, tier: "bad", text: "符是假的。你险些被卖符的坑死。", bonus: { 根骨: -1 } },
          ] },
      ],
    },

    n_a6: {
      title: "心魔夜", age: 60, gate: "death",
      enter: { 寿元: 40 },
      require: { and: [
        { stats: ["心境"], value: 5 },
        { stats: ["魔染"], value: 2, op: "<=" },
      ] },
      failText: "心魔自识海炸开。你看见此生所有的遗憾排着队向你走来，你再也没有醒来。",
      text: "元婴之前，必过心魔。道行再高，心境不够，一夜之间也是枉然。",
      flavor: [
        { cond: { stats: ["魔染"], value: 1 },
          text: "识海里排着队向你走来的，不全是你自己的遗憾——还有那些死于你手的人。" },
      ],
      options: [
        { text: "直视本我，与心魔对坐", gain: { 心境: 2 }, goto: "n_a7",
          odds: [
            { p: 55, tier: "good", text: "一夜对坐，天明时它化作了你的影子。" },
            { p: 45, tier: "mid", text: "你险险压住了它。" },
          ] },
        { text: "以魔压魔，快刀斩乱麻", gain: { 悟性: 2, 魔染: 1 }, goto: "n_a7",
          odds: [
            { p: 45, tier: "good", text: "你借魔念镇住心魔，快，且脏。" },
            { p: 40, tier: "mid", text: "两败俱伤，但你撑过来了。" },
            { p: 15, tier: "bad", text: "魔念反客为主。", bonus: { 魔染: 1, 心境: -1 } },
          ] },
      ],
    },

    n_a7: {
      title: "大道之顶", age: 80,
      text: "寿元将尽，仙门洞开。你此生问道，终于站到了门口。门里是光，门外是你的一整段人间。",
      options: [
        { text: "整衣冠，步入仙门", goto: "end_ascend",
          odds: [{ p: 100, tier: "good", text: "你一步踏入，山河万里在身后铺开。" }] },
        { text: "回身，留驻人间", goto: "end_stay",
          odds: [{ p: 100, tier: "good", text: "仙门在你身后缓缓关闭。你没有回头。" }] },
        { text: "自散修为，兵解转世", lose: { 寿元: 1 }, goto: "end_reincarnate",
          odds: [{ p: 100, tier: "mid", text: "元婴裹着神魂坠入轮回。来世再走一遭。" }] },
      ],
    },

    /* ---------------- 入魔线 ---------------- */
    n_b1: {
      title: "黑市学徒", age: 15,
      text: "货郎把你领进云梦山背面的黑市。这里卖的不是货，是路子。路子都沾血。",
      options: [
        { text: "学炼丹，掌一门手艺", gain: { 悟性: 2 }, goto: "n_b2",
          odds: [
            { p: 45, tier: "good", text: "你天赋异禀，三个月出师。", bonus: { 金铢: 100 } },
            { p: 40, tier: "mid", text: "你学得慢，但学得扎实。" },
            { p: 15, tier: "bad", text: "你炸了老板的炉，被打了个半死。", bonus: { 根骨: -1 } },
          ] },
        { text: "修噬魂功，走最快的路", gain: { 魔染: 2, 悟性: 2 }, goto: "n_b2",
          odds: [
            { p: 40, tier: "good", text: "你第一次引魂入体，又快，又冷。" },
            { p: 45, tier: "mid", text: "功法驳杂，你练得磕磕绊绊。" },
            { p: 15, tier: "bad", text: "功法反噬，你咳出的血是黑色的。", bonus: { 根骨: -1 } },
          ] },
      ],
    },

    n_b2: {
      title: "初炉", age: 20, gate: "death",
      require: { stats: ["悟性"], value: 4 },
      failText: "丹炉在你面前炸开，火油泼了满身。功法驳杂还敢强催地火的人，黑市从不缺尸体。",
      text: "学徒的第一炉，炼的是聚气丹。悟性不够硬催地火的，黑市规矩：就地埋。",
      options: [
        { text: "稳火慢炼，不求有功", gain: { 金铢: 200 }, goto: "n_b3",
          odds: [
            { p: 50, tier: "good", text: "第一炉成了，老板难得夸了你一句。" },
            { p: 50, tier: "mid", text: "成是成了，品相差些。" },
          ] },
        { text: "偷炼禁药，搏一把大的", gain: { 魔染: 1, 悟性: 1 }, goto: "n_b3",
          odds: [
            { p: 45, tier: "good", text: "禁药出丹那夜，整条街的修士都来抢。", bonus: { 金铢: 300 } },
            { p: 40, tier: "mid", text: "药成了，但你不敢卖高价。" },
            { p: 15, tier: "bad", text: "禁药引来执法队，你侥幸逃脱。", bonus: { 金铢: -100 } },
          ] },
      ],
    },

    n_b3: {
      title: "黑市恩怨", age: 28,
      text: "你出师了。老板设宴给你贺喜，酒里下了软筋散——黑市的规矩：徒弟出师，就是威胁。",
      options: [
        { text: "先下手为强", gain: { 魔染: 1, 金铢: 400 }, goto: "n_b4",
          odds: [
            { p: 50, tier: "good", text: "你比他快了一步。" },
            { p: 35, tier: "mid", text: "你们几乎同时出手，你险胜。" },
            { p: 15, tier: "bad", text: "他早防着这一手，你带着一身伤逃出黑市。", bonus: { 根骨: -1 } },
          ] },
        { text: "连夜远走，不与他争", gain: { 机缘: 1 }, lose: { 金铢: 200 }, goto: "n_b4",
          odds: [
            { p: 60, tier: "good", text: "你连夜离城，从此天高海阔。" },
            { p: 40, tier: "mid", text: "你走得不体面，但走脱了。" },
          ] },
      ],
    },

    n_b4: {
      title: "魔功大成", age: 36,
      enter: { 魔染: 2 },
      text: "八年魔功，一朝大成。你在铜镜里看见自己的眼睛，已经不像是自己的了。",
      options: [
        { text: "血祭冲关，再进一步", gain: { 悟性: 2, 魔染: 1 }, lose: { 寿元: 10 }, goto: "n_b5",
          odds: [
            { p: 45, tier: "good", text: "你以满窖死囚血祭，魔功贯通。" },
            { p: 40, tier: "mid", text: "血祭惊动了正道，你换了三个藏身处。" },
            { p: 15, tier: "bad", text: "正道围剿，你重伤遁走。", bonus: { 根骨: -2 } },
          ] },
        { text: "寻镇魔古玉，先洗去一身魔气", gain: { 心境: 2, 魔染: -4 }, lose: { 金铢: 200 }, goto: "n_b5",
          odds: [
            { p: 55, tier: "good", text: "古玉温养神魂，魔念如潮水般退去。" },
            { p: 45, tier: "mid", text: "古玉是赝品，但你额外的功课补上了。" },
          ] },
      ],
    },

    n_b5: {
      title: "金丹反噬", age: 44, gate: "death",
      require: { stats: ["魔染"], value: 4, op: "<=" },
      failText: "魔染反噬。你的识海像被泼进滚油的纸，一寸一寸烧成了灰。",
      text: "魔功结丹，须过反噬关：魔染压不住的人，成为魔功的养料。",
      options: [
        { text: "拥抱魔染，与魔合一", gain: { 魔染: 2, 悟性: 2 }, goto: "n_b6",
          odds: [
            { p: 50, tier: "good", text: "既然赶不走，那就吞了它。" },
            { p: 35, tier: "mid", text: "你吞得艰难，呕了三日血。" },
            { p: 15, tier: "bad", text: "魔念吞了你七天七夜。你活下来，但有些东西没跟着活下来。", bonus: { 心境: -1 } },
          ] },
        { text: "悬崖勒马，散功压魔", gain: { 心境: 2, 魔染: -3 }, goto: "n_b6",
          odds: [
            { p: 55, tier: "good", text: "你散去三成魔功，把线一根一根抽了出来。" },
            { p: 45, tier: "mid", text: "抽得慢，抽得疼，但抽完了。" },
          ] },
      ],
    },

    n_b6: {
      title: "魔主之邀", age: 58,
      text: "血河宗宗主亲至，黑袍如渊：「魔渊之下，还缺一位副教主。」你此生入魔，走到了岔口。",
      options: [
        { text: "受副尊之位", goto: "end_lord",
          odds: [{ p: 100, tier: "good", text: "你俯身受印。魔渊上下，从此多了一个不能惹的名字。" }] },
        { text: "弑主自立", odds: [
            { p: 45, tier: "good", text: "你一击得手，吞了魔主毕生修为。", goto: "end_storm" },
            { p: 55, tier: "bad", text: "你败了。魔主的袖袍拂过，你像一粒灰一样散了。", goto: "end_dead" },
          ] },
        { text: "金盆洗手，烧毁魔功", gain: { 魔染: -2 }, goto: "end_redemption",
          odds: [{ p: 100, tier: "mid", text: "火烧了整整一夜。灰烬里你觉得轻，也说不上是解脱还是空虚。" }] },
      ],
    },

    /* ---------------- 红尘线 ---------------- */
    n_c1: {
      title: "谋生", age: 15,
      text: "你不修仙。仙人的传说离溪尾村太远，柴米油盐很近。",
      options: [
        { text: "进县城商铺当学徒", gain: { 金铢: 100, 心境: 1 }, goto: "n_c2",
          odds: [
            { p: 45, tier: "good", text: "掌柜说你眼睛里有算盘。" },
            { p: 55, tier: "mid", text: "你从扫地开始学起。" },
          ] },
        { text: "苦读诗书，走科举之路", gain: { 悟性: 2, 声望: 1 }, goto: "n_c2",
          odds: [
            { p: 40, tier: "good", text: "县试案首，全县闻名。", bonus: { 声望: 1 } },
            { p: 45, tier: "mid", text: "你中了秀才，不算风光，算开端。" },
            { p: 15, tier: "bad", text: "你读坏了眼睛，榜上无名。", bonus: { 心境: -1 } },
          ] },
      ],
    },

    n_c2: {
      title: "商路匪祸", age: 22, gate: "death",
      require: [
        { stats: ["金铢"], value: 150 },
        { stats: ["根骨"], value: 3 },
      ],
      failText: "山匪劫道。你连人带货，一起消失在了黑水林里。",
      text: "第一批大生意要过黑水林。那里三年里劫了十一批货。要么钱多到雇得起刀客，要么身子骨硬到自保。",
      options: [
        { text: "疏财结义，养一支刀队", gain: { 声望: 2 }, lose: { 金铢: 100 }, goto: "n_c3",
          odds: [
            { p: 50, tier: "good", text: "你散财养了一队刀客，从此黑水林无人敢动你的货。" },
            { p: 50, tier: "mid", text: "刀队良莠不齐，但好歹是自己人。" },
          ] },
        { text: "奇货可居，铤而走险", gain: { 金铢: 300 }, goto: "n_c3",
          odds: [
            { p: 45, tier: "good", text: "你倒卖军盐，一夜暴富。", bonus: { 金铢: 200 } },
            { p: 40, tier: "mid", text: "货出手了，钱没你想的多。" },
            { p: 15, tier: "bad", text: "官府查账，你破财免灾。", bonus: { 金铢: -200 } },
          ] },
      ],
    },

    n_c3: {
      title: "站队", age: 30,
      text: "县里来了新县令，拉拢本地大族。站错队的人，坟头草已经两尺高了。",
      flavor: [
        { cond: { stats: ["声望"], value: 4 },
          text: "县令设宴都请了你三次——你在县里的名望，比他的告示还管用。" },
      ],
      options: [
        { text: "捐官入仕，正经做官", lose: { 金铢: 200 }, gain: { 声望: 2 }, goto: "n_c4",
          need: { stats: ["金铢"], value: 200 },
          odds: [
            { p: 50, tier: "good", text: "你成了县丞。官虽小，是官。" },
            { p: 35, tier: "mid", text: "你成了县丞，被同僚排挤。" },
            { p: 15, tier: "bad", text: "银子花了，官帽被人顶了。", bonus: { 心境: -1 } },
          ] },
        { text: "不沾官面，声名鹊起", gain: { 声望: 2, 心境: 1 }, goto: "n_c4",
          odds: [
            { p: 45, tier: "good", text: "你修桥补路，县志上记了你一笔。" },
            { p: 55, tier: "mid", text: "你是本地善人，说话有分量。" },
          ] },
      ],
    },

    n_c4: {
      title: "乱世", age: 42, gate: "death",
      require: [
        { stats: ["声望"], value: 5 },
        { stats: ["金铢"], value: 500 },
      ],
      failText: "乱兵入城，火烧了三天。没有人记得溪尾村出过一个人物。",
      text: "天下乱了。乱兵过境，有钱有势有人望的，才守得住一座城。",
      options: [
        { text: "开仓放粮，聚民守城", gain: { 声望: 3 }, lose: { 金铢: 300 }, goto: "n_c5",
          odds: [
            { p: 55, tier: "good", text: "饥民为你守了城门。你第一次觉得，钱能这么用。" },
            { p: 45, tier: "mid", text: "粮散了一半，城守住了。" },
          ] },
        { text: "举族南迁，避其锋芒", gain: { 心境: 2 }, lose: { 金铢: 100 }, goto: "n_c5",
          odds: [
            { p: 65, tier: "good", text: "你带着全族安然过江。" },
            { p: 35, tier: "mid", text: "路上折了些人手，家底还在。" },
          ] },
      ],
    },

    n_c5: {
      title: "功成", age: 55,
      text: "大乱平定。你的名字已经不只在县志上了。",
      options: [
        { text: "位极人臣，经略一方", goto: "end_minister",
          odds: [{ p: 100, tier: "good", text: "朝廷征你入京。你婉拒了三次，第四次，你去了一半。" }] },
        { text: "急流勇退，做个富家翁", goto: "end_wealth",
          odds: [{ p: 100, tier: "good", text: "你把生意交给了儿孙，自己盖了座园子。" }] },
        { text: "寻仙问路，补上少年那口气", need: { stats: ["悟性"], value: 5 }, goto: "n_c6",
          odds: [
            { p: 60, tier: "good", text: "你在深山里真的找到了修士的踪迹。", goto: "n_c6" },
            { p: 40, tier: "bad", text: "仙缘渺茫，你回到宅院，从此不提。", goto: "end_wealth" },
          ] },
      ],
    },

    n_c6: {
      title: "暮年", age: 72,
      text: "七十二岁的你，在山里真的遇见了一个云游老道——像极了十二岁那年村口的那个。他看了你很久，说：「你这悟性，不修仙，可惜了。」",
      options: [
        { text: "拜师，七十岁开始修仙", goto: "end_latedao",
          odds: [{ p: 100, tier: "good", text: "你把家业交给儿孙，跟着老道上山。" }] },
      ],
    },
  };

  /* ---------------- 结局 ---------------- */
  const ENDINGS = {
    end_dead: { name: "道消身殒", dynamic: true,
      desc: "大道争渡，百死一生。你的命途，在此断绝。" },
    end_ascend: { name: "白日飞升",
      desc: "仙门之后是万里山河。你回头看了一眼，然后转身走了进去。\n——命途：问道，有成。" },
    end_stay: { name: "人间行者",
      desc: "仙门在你身后缓缓关闭，你没有回头。此后千年，荒漠有井，疫城有丹。\n——命途：问道，在人间。" },
    end_reincarnate: { name: "兵解转世",
      desc: "元婴裹着神魂坠入轮回。奈何桥头，你回望此生，一步之遥。\n——来世，再走一遭。" },
    end_lord: { name: "魔主临世",
      desc: "你入魔渊十年，从副教主坐到了那个位置。登顶那天，正道十大宗门齐聚渊外——不是来讨伐，是来递降书。\n——命途：入魔，登顶。" },
    end_storm: { name: "化魔成圣",
      desc: "你把魔主的头颅放在魔渊边上。正道不敢杀你，魔道不敢惹你。\n你以魔证道，成了这世间最不讲道理的存在。" },
    end_redemption: { name: "放下屠刀",
      desc: "你散尽家财，在黑市原址修了一座医馆。\n没人知道掌柜的当年是魔道巨擘。你也不说。" },
    end_minister: { name: "一代权臣",
      desc: "你官至宰辅，门生故旧遍布朝野。史书给你写了半页，一半夸，一半骂。\n你八十一岁寿终，皇帝亲自吊唁。" },
    end_wealth: { name: "富甲一方",
      desc: "你把生意做遍三十六州。临终前算了算，这辈子赚的钱十辈子花不完。\n你想起十二岁那年没跟货郎走。若走了，会怎样？" },
    end_latedao: { name: "老来悟道",
      desc: "你七十岁开始修仙，天下人笑你。\n你一百二十岁筑基，天下人不笑了——他们死了，你还没死。" },
    end_peace: { name: "寿终正寝",
      desc: "寿元耗尽。你死在床上，儿孙绕膝。\n没有仙缘，没有雷劫，安安稳稳。这也是一种命。" },
    end_plain: { name: "碌碌百年",
      desc: "那些传说、秘境、仙缘，一样都没轮到你。\n你活得很长，也很平。偶尔夜里听见山那边有剑鸣，你翻个身，继续睡。" },
  };

  return { START, NODES, ENDINGS, ATTR_KEYS: ATTR_KEYS, START_NODE: "n0" };
});
