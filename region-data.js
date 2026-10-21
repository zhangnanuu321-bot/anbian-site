export const SHANGLUO_REGION = {
  name: "陕西 · 商洛",
  shortName: "商洛",
  admin: "陕西省商洛市",
  center: { latitude: 33.87, longitude: 109.94, elevation: 720 },
  basins: ["汉江水系", "丹江", "金钱河", "旬河", "洛河"],
  terrain: "秦岭山地河谷",
  note: "鱼种以商洛主要河谷常见淡水鱼为范围，具体可钓品种须以当地禁渔、限钓和保护区公告为准。",
  source: "区域垂钓品种整理；保护等级与可钓状态需以渔业主管部门公告复核"
};

export const SHANGLUO_FISH = [
  {
    id: "crucian",
    name: "鲫鱼",
    latin: "Carassius auratus",
    regional: true,
    seasons: { spring: 91, summer: 73, autumn: 90, winter: 81 },
    times: { morning: 5, noon: -1, evening: 5, night: -4 },
    water: { clear: -2, normal: 3, muddy: 2 },
    flow: { still: 4, slow: 5, fast: -11 },
    tempRange: [8, 24],
    habit: "贴底巡游，偏好缓坡、草边和结构外沿",
    bait: "腥香饵或蚯蚓",
    depth: "近岸 1.5—3 米",
    note: "小饵小钩先找口，鱼口转密后再补窝",
    baits: {
      cold: ["纯腥", "腥香"],
      cool: ["腥香", "纯香"],
      mild: ["腥香", "纯香"],
      warm: ["纯香", "腥香"]
    }
  },
  {
    id: "common-carp",
    name: "鲤鱼",
    latin: "Cyprinus carpio",
    regional: true,
    seasons: { spring: 75, summer: 84, autumn: 91, winter: 61 },
    times: { morning: 5, noon: -3, evening: 4, night: 5 },
    water: { clear: -4, normal: 3, muddy: 7 },
    flow: { still: 3, slow: 4, fast: -8 },
    tempRange: [12, 26],
    habit: "沿岸线坎边和回湾找食，对水色变化敏感",
    bait: "谷物香发酵饵或玉米",
    depth: "2—4 米结构外沿",
    note: "少打窝、保持安静，守结构边缘",
    baits: {
      cold: ["腥香", "纯腥"],
      cool: ["腥香", "纯香"],
      mild: ["纯香", "腥香"],
      warm: ["纯香", "腥香"]
    }
  },
  {
    id: "grass-carp",
    name: "草鱼",
    latin: "Ctenopharyngodon idella",
    regional: true,
    seasons: { spring: 68, summer: 89, autumn: 76, winter: 45 },
    times: { morning: 5, noon: 1, evening: 4, night: -8 },
    water: { clear: 3, normal: 2, muddy: -6 },
    flow: { still: 1, slow: 3, fast: -5 },
    tempRange: [18, 30],
    habit: "暖水时段巡游于明水和嫩草之间",
    bait: "嫩草、玉米或清淡谷物饵",
    depth: "中下层至 4 米",
    note: "先观察岸边嫩草是否有啃食痕迹",
    baits: {
      cold: ["腥香", "纯香"],
      cool: ["纯香", "腥香"],
      mild: ["纯香", "腥香"],
      warm: ["纯香", "腥香"]
    }
  },
  {
    id: "bream",
    name: "鳊鱼",
    latin: "Megalobrama amblycephala",
    regional: true,
    seasons: { spring: 76, summer: 72, autumn: 84, winter: 57 },
    times: { morning: 3, noon: 2, evening: 5, night: -3 },
    water: { clear: 1, normal: 3, muddy: 0 },
    flow: { still: 2, slow: 5, fast: -4 },
    tempRange: [12, 27],
    habit: "成群在中下层活动，偏好岸线缓流",
    bait: "麸香饵或玉米粒",
    depth: "2—4 米缓坡",
    note: "鱼口出现后可缩短抛竿节奏",
    baits: {
      cold: ["腥香", "纯腥"],
      cool: ["腥香", "纯香"],
      mild: ["纯香", "腥香"],
      warm: ["纯香", "腥香"]
    }
  },
  {
    id: "topmouth-culter",
    name: "翘嘴鲌",
    latin: "Culter alburnus",
    regional: true,
    seasons: { spring: 59, summer: 84, autumn: 81, winter: 54 },
    times: { morning: 4, noon: -5, evening: 8, night: 1 },
    water: { clear: 5, normal: 2, muddy: -5 },
    flow: { still: -3, slow: 3, fast: 6 },
    tempRange: [15, 28],
    habit: "追食小鱼，常在明水与水流交界巡游",
    bait: "亮片、小型米诺或腥香饵",
    depth: "中上层，按鱼讯调整",
    note: "扇形搜索水面，留意小鱼炸水",
    baits: {
      cold: ["纯腥", "腥香"],
      cool: ["腥香", "纯腥"],
      mild: ["腥香", "纯香"],
      warm: ["腥香", "纯香"]
    }
  },
  {
    id: "yellow-catfish",
    name: "黄颡鱼",
    latin: "Tachysurus fulvidraco",
    regional: true,
    seasons: { spring: 65, summer: 87, autumn: 82, winter: 52 },
    times: { morning: 3, noon: -4, evening: 7, night: 10 },
    water: { clear: -3, normal: -1, muddy: 8 },
    flow: { still: 3, slow: 3, fast: -3 },
    tempRange: [14, 28],
    habit: "贴底藏于石缝和硬结构附近，夜间活跃",
    bait: "蚯蚓或纯腥饵",
    depth: "贴底，结构旁 1—2 米",
    note: "摘钩时注意背鳍和胸鳍硬刺",
    baits: {
      cold: ["纯腥", "腥香"],
      cool: ["纯腥", "腥香"],
      mild: ["腥香", "纯腥"],
      warm: ["腥香", "纯腥"]
    }
  },
  {
    id: "catfish",
    name: "鲶鱼",
    latin: "Silurus asotus",
    regional: true,
    seasons: { spring: 55, summer: 85, autumn: 74, winter: 39 },
    times: { morning: 2, noon: -8, evening: 7, night: 11 },
    water: { clear: -2, normal: 0, muddy: 8 },
    flow: { still: 3, slow: 2, fast: -4 },
    tempRange: [18, 29],
    habit: "夜间和浑水更活跃，贴底藏在结构附近",
    bait: "蚯蚓、小鱼或纯腥饵",
    depth: "贴底，靠近结构边缘",
    note: "夜钓必须结伴并带可靠照明",
    baits: {
      cold: ["纯腥"],
      cool: ["纯腥", "腥香"],
      mild: ["纯腥", "腥香"],
      warm: ["纯腥", "腥香"]
    }
  },
  {
    id: "chinese-hook-snout",
    name: "马口鱼",
    latin: "Opsariichthys bidens",
    regional: true,
    seasons: { spring: 78, summer: 76, autumn: 71, winter: 51 },
    times: { morning: 5, noon: -1, evening: 4, night: -7 },
    water: { clear: 7, normal: 1, muddy: -6 },
    flow: { still: -5, slow: 2, fast: 8 },
    tempRange: [12, 24],
    habit: "喜欢清澈流动水体，常在中上层觅食",
    bait: "小亮片、昆虫或腥味小饵",
    depth: "浅水上层至中层",
    note: "小饵快搜，沿流水方向抛投",
    baits: {
      cold: ["纯腥"],
      cool: ["纯腥", "腥香"],
      mild: ["腥香", "纯腥"],
      warm: ["腥香", "纯香"]
    }
  },
  {
    id: "chinese-zacco",
    name: "宽鳍鱲",
    latin: "Zacco platypus",
    regional: true,
    seasons: { spring: 80, summer: 75, autumn: 72, winter: 48 },
    times: { morning: 5, noon: -1, evening: 5, night: -7 },
    water: { clear: 8, normal: 1, muddy: -7 },
    flow: { still: -5, slow: 2, fast: 9 },
    tempRange: [12, 25],
    habit: "栖于清澈溪流中上层，喜靠流水和浅滩",
    bait: "小亮片、昆虫或腥味小饵",
    depth: "浅滩中上层",
    note: "以观察和短时试钓为主，减少频繁走位",
    baits: {
      cold: ["纯腥"],
      cool: ["纯腥", "腥香"],
      mild: ["腥香", "纯腥"],
      warm: ["腥香", "纯香"]
    }
  },
  {
    id: "southern-barbel",
    name: "赤眼鳟",
    latin: "Squaliobarbus curriculus",
    regional: true,
    seasons: { spring: 74, summer: 82, autumn: 78, winter: 50 },
    times: { morning: 5, noon: -2, evening: 5, night: -3 },
    water: { clear: 3, normal: 3, muddy: 0 },
    flow: { still: -1, slow: 5, fast: 3 },
    tempRange: [15, 28],
    habit: "沿河道缓流带和小鱼群附近活动",
    bait: "玉米、谷香饵或小亮片",
    depth: "中下层至中层",
    note: "优先搜索水流与静水的交界",
    baits: {
      cold: ["腥香", "纯腥"],
      cool: ["腥香", "纯香"],
      mild: ["纯香", "腥香"],
      warm: ["纯香", "腥香"]
    }
  }
];

export const PROTECTED_AQUATIC = [
  {
    id: "qinling-lenok",
    name: "秦岭细鳞鲑",
    latin: "Brachymystax lenok tsinlingensis",
    status: "保护水生动物，禁止垂钓或捕捞",
    recognition: "出现疑似个体立即放回并停止试钓，不据此定位"
  },
  {
    id: "ony-twohorn",
    name: "多鳞白甲鱼",
    latin: "Onychostoma macrolepis",
    status: "秦岭溪流保护关注物种，具体等级以当地公告为准",
    recognition: "避免进入保护区或禁钓河段"
  },
  {
    id: "giant-salamander",
    name: "大鲵",
    latin: "Andrias davidianus",
    status: "保护水生动物，禁止捕捉",
    recognition: "发现即远离，不触碰、不驱赶"
  }
];

export function toFishProfiles() {
  return SHANGLUO_FISH.map((fish) => ({
    ...fish,
    match: 0
  }));
}
