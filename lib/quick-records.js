const numberPattern = "(?:\\d+(?:\\.\\d+)?|[零〇一二两三四五六七八九十百千]+)";
const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const activities = [
  [/跑步|慢跑|跑了/, "running", "跑步"],
  [/散步|走路|步行/, "walking", "散步"],
  [/健身|力量训练/, "gym", "健身"],
  [/乒乓球/, "table-tennis", "乒乓球"],
  [/羽毛球/, "badminton", "羽毛球"],
  [/瑜伽/, "yoga", "瑜伽"],
  [/游泳/, "swimming", "游泳"],
  [/骑行|骑车/, "cycling", "骑行"],
  [/运动|锻炼/, "activity", "运动"],
];

function numberValue(text) {
  if (/^\d/.test(text)) return Number(text);
  let total = 0;
  let current = 0;
  for (const char of text) {
    const unit = { 十: 10, 百: 100, 千: 1000 }[char];
    if (unit) { total += (current || 1) * unit; current = 0; }
    else current = digits[char] ?? 0;
  }
  return total + current;
}

function shanghaiDate(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function recordDate(text, today, previous) {
  const explicit = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  const chineseDate = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})[日号]/);
  const monthDay = text.match(/(\d{1,2})月(\d{1,2})[日号]/);
  const fullDate = explicit || chineseDate;
  if (fullDate || monthDay) {
    const year = fullDate ? fullDate[1] : today.slice(0, 4);
    const month = fullDate ? fullDate[2] : monthDay[1];
    const day = fullDate ? fullDate[3] : monthDay[2];
    const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const parsed = new Date(`${date}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date && date <= today ? date : null;
  }
  if (/前天|昨天|今天/.test(text)) {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (/前天/.test(text) ? 2 : /昨天/.test(text) ? 1 : 0));
    return date.toISOString().slice(0, 10);
  }
  return previous;
}

function recordTime(text) {
  const period = text.match(/凌晨|早上|上午|中午|下午|傍晚|晚上|夜里/)?.[0] || "";
  const colon = text.match(/\b(\d{1,2})[:：](\d{2})\b/);
  const spoken = text.match(new RegExp(`(${numberPattern})[点时](半|一刻|三刻|(${numberPattern})分?)?`));
  if (!colon && !spoken) return { time: period };
  let hour = colon ? Number(colon[1]) : numberValue(spoken[1]);
  const suffix = spoken?.[2];
  const minute = colon ? Number(colon[2]) : suffix === "半" ? 30 : suffix === "一刻" ? 15 : suffix === "三刻" ? 45 : spoken?.[3] ? numberValue(spoken[3]) : 0;
  if (hour > 23 || minute > 59 || !Number.isInteger(hour) || !Number.isInteger(minute)) return { issue: "时间不正确，请修改后重试" };
  if (period && hour <= 12) {
    if (/下午|傍晚|晚上|夜里/.test(period) && hour < 12) hour += 12;
    if (/凌晨|晚上|夜里/.test(period) && hour === 12) hour = 0;
    if (period === "中午" && hour < 11) hour += 12;
  } else if (!colon && hour > 0 && hour <= 12) {
    return { issue: "请补充早晚，例如“早上9点半”或“晚上9点半”" };
  }
  return { time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
}

function waterAmount(text, cupSize) {
  const volume = text.match(new RegExp(`(${numberPattern})\\s*(毫升|ml|mL|升|[lL])`));
  if (volume) return numberValue(volume[1]) * (/升|^[lL]$/.test(volume[2]) && volume[2] !== "毫升" ? 1000 : 1);
  if (/半杯/.test(text)) return cupSize / 2;
  const cups = text.match(new RegExp(`(${numberPattern})\\s*杯(半)?`));
  return cups ? (numberValue(cups[1]) + (cups[2] ? 0.5 : 0)) * cupSize : null;
}

function exerciseMinutes(text) {
  const hours = text.match(new RegExp(`(${numberPattern})\\s*(?:个)?(?:半)?小时(?:半)?`));
  const minutes = text.match(new RegExp(`(${numberPattern})\\s*分钟`));
  const halfHour = /半(?:个)?小时|半个钟头/.test(text);
  const hourCount = hours ? numberValue(hours[1]) + (/半/.test(hours[0]) ? 0.5 : 0) : halfHour ? 0.5 : 0;
  return hourCount * 60 + (minutes ? numberValue(minutes[1]) : 0);
}

// 常用观影句式直接取片名和集数，避免模型混淆“看到”和“看了”。
export function parseWatchProgress(input, now = new Date()) {
  const records = [];
  let remainingText = String(input);
  const integer = "(?:\\d+|[零〇一二两三四五六七八九十百千]+)";
  const prefix = "(?:(?:我|今天|昨天|前天|刚刚|刚|已经|今晚|昨晚|早上|上午|中午|下午|晚上|夜里|凌晨|现在|记录一下|记录|帮我记一下|帮我记录)\\s*)*";
  const title = "(《[^》]{1,200}》|“[^”]{1,200}”|[^《》，,。；;！？?!\\n]{1,200}?)";
  const progress = `\\s*(?:第?(${integer})\\s*季\\s*)?第?(${integer})\\s*集(?:了|啦)?`;
  const action = "(看到了|看到|看至|追到了|追到|看了|看完了|看完)";
  const leading = new RegExp(`^${prefix}${action}\\s*${title}${progress}$`);
  const trailing = new RegExp(`^${prefix}${title}\\s*${action}${progress}$`);
  for (const raw of String(input).split(/[，,。；;\n]+/)) {
    const clause = raw.trim();
    if (!clause) continue;
    const first = clause.match(leading), second = first ? null : clause.match(trailing);
    const match = first || second;
    if (!match || /还没|没有|未看|打算|准备|取消|删除|明天|后天|如果|建议|应该|不要|不曾/.test(clause)) continue;
    const verb = first ? match[1] : match[2];
    const name = (first ? match[2] : match[1]).replace(/^[《“]|[》”]$/g, "").trim();
    const season = match[3] ? numberValue(match[3]) : null;
    const episode = numberValue(match[4]);
    if (!name || episode < 1 || episode > 2000 || season != null && season < 1) continue;
    const date = recordDate(clause.replace("昨晚", "昨天晚上"), shanghaiDate(now), shanghaiDate(now));
    const timing = recordTime(clause);
    if (!date || timing.issue) continue;
    const values = { date, ...(timing.time ? { time: timing.time } : {}), ...(season ? { season } : {}), ...(/到|至/.test(verb) ? { watchedThrough: episode } : { episodes: [episode] }) };
    records.push({ kind: "watch", action: "checkin", target: name, source: clause, values });
    remainingText = remainingText.replace(clause, "");
  }
  return { records, remainingText: remainingText.replace(/^[，,。；;\s]+|[，,。；;\s]+$/g, "") };
}

export function parseQuickRecords(input, now = new Date(), cupSize = 250) {
  const text = String(input || "").trim();
  const today = shanghaiDate(now);
  const records = [];
  const issues = [];
  let date = today;
  const clauses = text.split(/[，,。；;！!\n]+|然后|另外|并且|(?=(?:晚上|下午|上午|早上|中午|凌晨|傍晚)[^，,。；;！!]*?(?:运动|锻炼|健身|跑步|散步|瑜伽|喝|饮水))/).filter(Boolean);
  for (const raw of clauses) {
    const clause = raw.trim();
    date = recordDate(clause, today, date);
    const water = /喝.*水|饮水|喝水/.test(clause);
    const activity = activities.find(([pattern]) => pattern.test(clause));
    if (!water && !activity) { if (/^(?:我|我们)?(?:今天|昨天|前天)?$/.test(clause)) continue; issues.push(`“${clause}”需要在线记录理解服务，请先启用服务或到对应页面记录`); continue; }
    if (/没|未|别记|不用记|不想|不曾|不要|不(?:会)?(?:喝|跑|运动|锻炼|健身|散步|游泳|骑)|打算|计划|准备|想要|想喝|想运动|想健身|想跑|要(?:喝|跑|运动|健身|散步|游泳|骑)|待会|等会|稍后|明天|后天|明年|下周|下个月|将要|要去|还要|取消|删除|每天|每晚|每周|如果|建议|应该/.test(clause)) {
      issues.push(`未记录“${clause}”：只记录已经发生的事项`);
      continue;
    }
    if (/上周|上个月|去年|星期|周末|周[一二三四五六日天]|[零〇一二两三四五六七八九十\d]+(?:天|小时|分钟)前/.test(clause)) {
      issues.push("请把日期时间说清楚，例如“昨天”或“2025年11月3日”，这类相对时间暂未支持");
      continue;
    }
    if (!date) { issues.push(`“${clause}”的日期无效或在未来`); continue; }
    if (water && activity) { issues.push("请用逗号分开饮水和运动，便于准确记录"); continue; }
    const timing = recordTime(clause);
    if (timing.issue) { issues.push(timing.issue); continue; }
    if (water) {
      const amount = waterAmount(clause, cupSize);
      if (!amount || amount <= 0 || amount > 10000) { issues.push("请说明饮水量，例如“一杯水”或“300毫升水”"); continue; }
      records.push({ collection: "dietRecords", label: "饮水", value: { type: "water", cups: amount / cupSize, amount, date, time: timing.time } });
    } else {
      const duration = exerciseMinutes(clause.slice(clause.search(activity[0])));
      if (duration <= 0 || duration > 1440) { issues.push("请说明运动时长，例如“健身30分钟”"); continue; }
      records.push({ collection: "exerciseRecords", label: activity[2], value: { type: activity[1], label: activity[2], duration, calories: null, date, time: timing.time } });
    }
  }
  if (!records.length && !issues.length) issues.push("暂时支持饮水和运动，例如“今天早上9点喝一杯水，晚上健身半小时”");
  return { records, issues };
}
