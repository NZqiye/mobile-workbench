const messages = {
  payday: {
    today: "今天发薪，核对到账，也给储蓄留一份。",
    tomorrow: "明天发薪，把本月账单和储蓄计划理一理。",
    soon: "发薪日快到了，先列好必要开支，再安排小奖励。",
    future: "认真工作的每一天，都在为生活积攒底气。",
    past: "发薪日已过，记得核对到账和本月账单。",
  },
  birthday: {
    today: "生日快乐，愿这一岁有新的惊喜。",
    tomorrow: "明天生日，别忘了祝福与蛋糕。",
    soon: "生日快到了，把祝福和心意准备好。",
    future: "又一岁新的期待，愿美好慢慢靠近。",
    past: "新一岁已经开始，愿每一天都有小欢喜。",
  },
  love: {
    today: "一起走过的日子，今天又多一份纪念。",
    tomorrow: "明天的浪漫，记得留一点时间给彼此。",
    soon: "特别的日子将近，把心意悄悄准备好。",
    future: "一起走过的日子，正在闪闪发光。",
    past: "日子还在继续，陪伴就是长久的告白。",
  },
  exam: {
    today: "今天上场，稳住节奏，相信自己的准备。",
    tomorrow: "明天上场，带好证件，今晚早点休息。",
    soon: "保持专注，也记得休息。离目标又近一步。",
    future: "把目标写进计划，稳稳走好每一天。",
    past: "认真走过的这段路，每一步都算数。",
  },
  travel: {
    today: "出发吧，愿这一路都有好风景。",
    tomorrow: "明天出发，证件与行李再检查一次。",
    soon: "旅行越来越近，路线和行李可以准备了。",
    future: "远方正在靠近，好风景值得期待。",
    past: "把沿途的风景，慢慢收进回忆里。",
  },
  festival: {
    today: "愿今天的相聚与问候，都带着暖意。",
    tomorrow: "节日就在明天，记得给牵挂的人问个好。",
    soon: "节日将近，把团圆和问候提前安排好。",
    future: "等一个好日子，也等一次温暖的相聚。",
    past: "愿节日留下的暖意，继续陪着平常的日子。",
  },
  milestone: {
    today: "今天值得被记住，为一路的努力喝彩。",
    tomorrow: "明天是新的里程碑，给努力的自己鼓鼓劲。",
    soon: "重要的一步快到了，带着准备从容出发。",
    future: "认真走过的路，终会留下自己的光。",
    past: "记住来时的努力，也期待下一程的精彩。",
  },
  general: {
    today: "就是今天，给这个特别的日子留份纪念。",
    tomorrow: "重要的日子就在明天，别忘了心里的期待。",
    soon: "日子越来越近，给期待留一点准备的时间。",
    future: "把值得期待的日子，放在心上。",
    past: "有些日子走远了，仍然值得好好记住。",
  },
};

export function anniversaryMessages(item = {}) {
  const icon = item.icon || "", title = item.title || "";
  const kind = icon === "payday" || /发薪|工资|薪水/.test(title) ? "payday"
    : icon === "birthday" || item.type === "birthday" || /生日|生辰/.test(title) ? "birthday"
    : ["exam", "defense"].includes(icon) || /考试|高考|考研|中考|答辩|考公|考证/.test(title) ? "exam"
    : icon === "travel" || /旅行|旅游|出发|出游|度假/.test(title) ? "travel"
    : ["love", "wedding", "qixi", "extra-valentines-card", "extra-valentines-day"].includes(icon) || /恋爱|结婚|相识|相恋|领证|七夕|情人节/.test(title) ? "love"
    : ["work", "promotion", "graduation"].includes(icon) || /入职|毕业|升职|创业/.test(title) ? "milestone"
    : item.type === "festival" ? "festival" : "general";
  return messages[kind];
}

export function anniversaryMessage(item, days) {
  return anniversaryMessages(item)[days < 0 ? "past" : days === 0 ? "today" : days === 1 ? "tomorrow" : days <= 7 ? "soon" : "future"];
}
