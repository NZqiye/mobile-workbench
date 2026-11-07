import { normalizeTravelRecord } from "./travel";

// 字段白名单与现有记录格式一致；模型不能指定存储键或记录 ID。
export const quickRecordTypes = {
  water: { collection: "dietRecords", label: "饮水", page: "diet", fields: { amount: "positive!", date: "date", time: "time" } },
  meal: { collection: "dietRecords", label: "饮食热量", page: "diet", fields: { title: "text", meal: "早餐|午餐|晚餐|加餐!", calories: "positive!", date: "date", time: "time" } },
  exercise: { collection: "exerciseRecords", label: "运动", page: "exercise", fields: { type: "running|walking|gym|table-tennis|badminton|yoga|swimming|cycling|activity!", duration: "positive!", calories: "nonnegative", distanceKm: "positive", opponent: "text", score: "text", date: "date", time: "time" } },
  weight: { collection: "weightRecords", label: "体重", page: "exercise", fields: { weight: "positive!", date: "date", time: "time" } },
  task: { collection: "plans", label: "任务安排", page: "plans", fields: { title: "text!", date: "date", priority: "高|中|低", status: "未完成|已完成", note: "text", reminderAt: "datetime" } },
  habit: { collection: "habits", label: "习惯打卡", page: "plans", fields: { title: "text!", date: "date" } },
  note: { collection: "notes", label: "生活记录", page: "notes", fields: { title: "text!", content: "text", type: "life|food|treehole|review|idea", mood: "text", tags: "tags", date: "date", time: "time" } },
  asset: { collection: "assetRecords", label: "资产", page: "assets", fields: { name: "text!", price: "nonnegative!", purchaseDate: "date", category: "text", status: "服役中|已出售|退役", saleDate: "date", salePrice: "nonnegative", retirementDate: "date", notes: "text" } },
  subscription: { collection: "subscriptionRecords", label: "订阅", page: "assets", fields: { title: "text!", price: "nonnegative!", purchaseType: "订阅会员|永久会员!", purchaseDate: "date", billingCycle: "每月|每季|每年", endDate: "date", usageNote: "text" } },
  travel: { collection: "travelRecords", label: "旅行", page: "assets", fields: { destination: "text!", startDate: "date!", endDate: "date!", cost: "nonnegative", city: "text", notes: "text", spot: "text", date: "date", rating: "stars", review: "text" } },
  anniversary: { collection: "anniversaries", label: "纪念日", page: "plans", fields: { title: "text!", date: "date!", type: "countdown|memory|birthday|festival!", calendarType: "solar|lunar", startDate: "date" } },
  lifeGoal: { collection: "lifeGoals", label: "星光目标", page: "life", fields: { title: "text!", targetDate: "date!", items: "tags" } },
  lifeItem: { collection: "lifeGoals", label: "目标打卡项目", page: "life", fields: { goal: "text!", title: "text!" } },
  watch: { collection: "consultations", label: "观影", page: "consultations", fields: { title: "text!", type: "电影|电视剧|动漫|综艺", status: "想看的剧|正在看|看过的剧|暂停/弃剧", rating: "rating", review: "text", platform: "text", season: "integer", episodes: "episodes", watchedThrough: "integer", date: "date", time: "time" } },
  fund: { collection: "fundPortfolio", label: "基金持仓", page: "market", fields: { code: "code!", name: "text", tradeType: "buy|sell", amount: "positive", shares: "positive", price: "positive", date: "date", note: "text", alipayValue: "positive", alipayProfit: "number", alipayTodayProfit: "number" } },
  index: { collection: "indexTrackerItems", label: "指数追踪", page: "market", fields: { name: "text!", kind: "market|fund!", code: "text!", midAbove: "nonnegative", highAbove: "nonnegative", note: "text" } },
};

export function quickRecordDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type).value).join("-");
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function cleanField(value, rule, name) {
  if (value == null || value === "") return undefined;
  const type = rule.replace(/!$/, "");
  if (type === "tags" || type === "episodes") {
    if (!Array.isArray(value) || value.length > 100) throw new Error(`${name}格式不正确`);
    if (type === "episodes") {
      if (value.some((item) => !Number.isInteger(item) || item < 1 || item > 2000)) throw new Error("集数不正确");
      return [...new Set(value)].sort((a, b) => a - b);
    }
    if (value.some((item) => typeof item !== "string" || item.length > 200)) throw new Error(`${name}格式不正确`);
    return value.map((item) => item.trim()).filter(Boolean);
  }
  if (["positive", "nonnegative", "number", "integer", "rating", "stars"].includes(type)) {
    if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1e10) throw new Error(`${name}必须是有效数字`);
    if ((type === "positive" || type === "integer") && value <= 0 || type === "nonnegative" && value < 0 || type === "integer" && !Number.isInteger(value)) throw new Error(`${name}数值不正确`);
    if (type === "rating" && (value < 0 || value > 10) || type === "stars" && (!Number.isInteger(value) || value < 1 || value > 5)) throw new Error("评分超出范围");
    return value;
  }
  if (typeof value !== "string" || value.length > 2000) throw new Error(`${name}格式不正确`);
  const text = value.trim();
  if (type === "date" && !validDate(text)) throw new Error("日期不正确，请明确年月日");
  if (type === "datetime" && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text) || !validDate(text.slice(0, 10)) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(text.slice(11)))) throw new Error("提醒时间不正确");
  if (type === "time" && !/^(?:([01]\d|2[0-3]):[0-5]\d|凌晨|早上|上午|中午|下午|傍晚|晚上|夜里)$/.test(text)) throw new Error("时间不明确，请补充早晚");
  if (type === "code" && !/^\d{6}$/.test(text)) throw new Error("基金需要6位代码");
  if (type.includes("|") && !type.split("|").includes(text)) throw new Error(`${name}分类不正确`);
  return text || undefined;
}

export function normalizeQuickRecordDrafts(data, input, now = new Date()) {
  if (!data || !Array.isArray(data.records) || data.records.length > 30 || !Array.isArray(data.issues)) throw new Error("记录识别结果不完整，请缩短内容后重试");
  const today = quickRecordDate(now);
  const result = { records: [], issues: data.issues.filter((issue) => typeof issue === "string").map((issue) => issue.slice(0, 500)).slice(0, 30) };
  for (const draft of data.records) {
    const spec = Object.hasOwn(quickRecordTypes, draft?.kind) ? quickRecordTypes[draft.kind] : null;
    try {
      if (!spec || !["add", "update", "complete", "checkin"].includes(draft.action)) throw new Error("无法匹配工作台记录类型");
      if (typeof draft.source !== "string" || !draft.source.trim() || !input.includes(draft.source.trim())) throw new Error("识别结果无法对应原话，请重新描述");
      const allowedActions = { task: ["add", "update", "complete"], habit: ["add", "complete"], lifeItem: ["add", "complete"], watch: ["add", "update", "checkin"], travel: ["add", "update", "checkin"], fund: ["add", "update"] };
      if (!(allowedActions[draft.kind] || ["add", "update"]).includes(draft.action)) throw new Error("该记录不支持这种操作");
      if (["water", "meal", "exercise", "weight"].includes(draft.kind) && draft.action !== "add") throw new Error("请新增生活记录，修改已有记录请使用对应页面");
      const value = {};
      for (const [name, rule] of Object.entries(spec.fields)) {
        const fieldLabel = quickFieldLabels[name] || name;
        const cleaned = cleanField(draft.values?.[name], rule, fieldLabel);
        if (cleaned !== undefined) value[name] = cleaned;
        if (draft.action === "add" && rule.endsWith("!") && cleaned === undefined) throw new Error(`请补充${spec.label}的${fieldLabel}`);
      }
      const target = typeof draft.target === "string" ? draft.target.trim().slice(0, 200) : "";
      if (draft.action !== "add" && !target && !(draft.kind === "fund" && value.code)) throw new Error("请说出要更新的记录名称");
      if (value.time && !/(?:\d{1,2}[:：]\d{2}|(?:\d+|[零〇一二两三四五六七八九十]+)[点时]|凌晨|早上|上午|中午|下午|傍晚|晚上|夜里)/.test(draft.source)) delete value.time;
      if ((draft.action === "add" && ["water", "meal", "exercise", "weight", "note", "task", "habit", "watch"].includes(draft.kind)) || draft.action === "complete" && draft.kind === "habit" || draft.action === "checkin" && ["watch", "travel"].includes(draft.kind) || draft.kind === "fund") value.date ||= today;
      if (draft.action === "add" && ["water", "meal", "exercise", "weight", "note", "watch"].includes(draft.kind)) value.time ??= "";
      if (["task", "habit", "lifeItem"].includes(draft.kind) && draft.action === "complete" && (/没有|还没|未完成|打算|准备|明天|后天|取消|删除/.test(draft.source) || value.date > today)) throw new Error("未将尚未完成的事项标为完成");
      if (["water", "meal", "exercise", "weight", "fund"].includes(draft.kind) && (value.date > today || /没有|还没|未曾|不曾|打算|准备|将要|不要记|取消|删除/.test(draft.source))) throw new Error("未将尚未发生、否定或删除语句记为已完成事项");
      if (["asset", "subscription"].includes(draft.kind) && (value.purchaseDate > today || value.saleDate > today || value.retirementDate > today || /没有|还没|打算|将要|取消|删除/.test(draft.source))) throw new Error("请将未发生的购买、售出或退役记为任务计划");
      if (draft.kind === "watch" && (draft.action === "checkin" || value.status === "看过的剧") && (value.date > today || /还没|没有|未看|打算|取消|删除/.test(draft.source))) throw new Error("未将尚未看过的内容记为观影打卡");
      if (draft.kind === "watch" && value.watchedThrough != null && (value.watchedThrough > 2000 || !/看(?:到|至)|追(?:到|至)|看完.*(?:前|至|到)/.test(draft.source))) throw new Error("请明确看到第几集，或说明实际看过的集数");
      if (draft.kind === "water" && value.amount > 10000 || draft.kind === "exercise" && value.duration > 1440 || draft.kind === "weight" && value.weight > 500) throw new Error("数量超出合理范围，请检查");
      if (draft.kind === "lifeItem" && (!value.goal || draft.action === "add" && !value.title)) throw new Error("请说清所属目标和打卡项目名称");
      if (draft.kind === "fund" && (value.alipayValue != null) !== (value.alipayProfit != null)) throw new Error("基金校准需要同时说明市值和持有收益");
      result.records.push({ kind: draft.kind, action: draft.action, target, value, source: draft.source.trim() });
    } catch (error) { result.issues.push(`${spec?.label || "记录"}：${error.message}`); }
  }
  if (!result.records.length && !result.issues.length) result.issues.push("没有找到可记录的事项，请说出记录名称和相关信息");
  return result;
}

const activityLabels = { running: "跑步", walking: "散步", gym: "健身", "table-tennis": "乒乓球", badminton: "羽毛球", yoga: "瑜伽", swimming: "游泳", cycling: "骑行", activity: "运动" };
const quickFieldLabels = { title: "名称", name: "名称", amount: "数量或金额", date: "日期", time: "时间", meal: "餐次", calories: "热量", type: "类型", duration: "时长", distanceKm: "距离", opponent: "对手", score: "比分", weight: "体重", priority: "优先级", status: "状态", note: "备注", reminderAt: "提醒时间", content: "正文", mood: "心情", tags: "标签", price: "价格", purchaseDate: "购买日期", category: "分类", saleDate: "售出日期", salePrice: "售出价格", retirementDate: "退役日期", notes: "备注", purchaseType: "会员类型", billingCycle: "订阅周期", endDate: "结束日期", usageNote: "使用说明", destination: "目的地", startDate: "开始日期", cost: "费用", city: "城市", spot: "景点", rating: "评分", review: "评价", calendarType: "历法", targetDate: "目标日期", items: "项目", goal: "所属目标", platform: "平台", season: "季数", episodes: "集数", code: "代码", tradeType: "交易类型", shares: "份额", alipayValue: "市值", alipayProfit: "持有收益", alipayTodayProfit: "今日收益", kind: "类型", midAbove: "中位阈值", highAbove: "高位阈值" };
const sameName = (left, right) => String(left || "").replace(/[\s《》“”"'·]/g, "").toLowerCase() === String(right || "").replace(/[\s《》“”"'·]/g, "").toLowerCase();

// 先在内存中完整生成一批修改；有歧义的项目只返回提示，不改存储。
export function planQuickRecordChanges(drafts, state, makeId = () => crypto.randomUUID(), now = new Date()) {
  const collections = {};
  const changes = [];
  const records = [];
  const issues = [];
  const rewards = [];
  const today = quickRecordDate(now);
  const get = (name) => collections[name] ||= [...(state[name] || [])];
  const find = (name, title, fields = ["title", "name", "titleZh", "originalTitle", "destination", "code"]) => {
    const matches = get(name).filter((item) => fields.some((field) => sameName(item[field], title)));
    if (matches.length !== 1) throw new Error(matches.length ? `“${title}”有多条同名记录，请到对应页面选择` : `没有找到“${title}”，请核对完整名称`);
    return matches[0];
  };
  const put = (collection, before, value) => {
    const after = { ...value, id: before?.id || value.id || makeId() };
    const items = get(collection);
    collections[collection] = before ? items.map((item) => item.id === before.id ? after : item) : [after, ...items];
    changes.push({ collection, before: before || null, after });
    return after;
  };
  const reward = (type, amount, key = "") => rewards.push({ type, amount, key });
  for (const draft of drafts) {
    // 每项独立计算。发生错误时撤回本项产生的变化。
    const snapshot = { ...collections }, changeCount = changes.length, rewardCount = rewards.length;
    try {
      const spec = quickRecordTypes[draft.kind];
      if (!spec) throw new Error("不支持的记录类型");
      let v = { ...draft.value };
      const name = draft.target || v.title || v.name || v.destination || v.code;
      let before = draft.action === "update" ? find(spec.collection, draft.kind === "fund" ? v.code || name : name) : null;
      let after;
      if (draft.kind === "habit" && draft.action === "complete") {
        before = find("habits", name);
        const date = v.date || today;
        const collection = `done:${date}`;
        const previous = state[collection] || {};
        const doneChanges = changes.filter((item) => item.collection === collection);
        const current = doneChanges.at(-1)?.after || previous;
        if (current[before.id]) throw new Error("这项习惯当天已经打卡");
        changes.push({ collection, before: current, after: { ...current, [before.id]: true }, habitId: before.id });
        collections[collection] = changes.at(-1).after;
        reward("toy", 1, `habit:${date}:${before.id}`);
        after = { title: before.title, date, status: "已打卡" };
      } else if (draft.kind === "task" && draft.action === "complete") {
        before = find("plans", name);
        if (before.status === "已完成") throw new Error("这个任务已经完成");
        after = put("plans", before, { ...before, status: "已完成" });
        reward("toy", 1, `task:${after.id}`);
      } else if (draft.kind === "lifeItem") {
        before = find("lifeGoals", v.goal);
        const items = [...(before.items || [])];
        if (draft.action === "complete") {
          const matches = items.filter((item) => sameName(item.title, draft.target || v.title));
          if (matches.length !== 1) throw new Error("目标内的项目名称不存在或有重名，请说出完整项目名");
          if (matches[0].completed) throw new Error("这个目标项目已经完成");
          v.title = matches[0].title;
          put("lifeGoals", before, { ...before, items: items.map((item) => item.id === matches[0].id ? { ...item, completed: true } : item) });
        } else put("lifeGoals", before, { ...before, items: [...items, { id: makeId(), title: v.title, completed: false }] });
        after = { ...v, status: draft.action === "complete" ? "已完成" : "未完成" };
      } else if (draft.kind === "travel" && draft.action === "checkin") {
        before = find("travelRecords", name);
        if (!v.spot || !v.date) throw new Error("景点打卡需要景点名称和日期");
        after = put("travelRecords", before, normalizeTravelRecord({ ...before, checkins: [...(before.checkins || []), { id: makeId(), name: v.spot, date: v.date, rating: v.rating ?? null, review: v.review || "" }] }));
      } else if (draft.kind === "watch") {
        const matches = get("consultations").filter((item) => [item.title, item.titleZh, item.originalTitle].some((title) => sameName(title, name)));
        if (matches.length > 1) throw new Error("片名有多条匹配，请在观影页选择具体作品");
        before ||= matches[0] || null;
        if (draft.action !== "add" && !before) throw new Error("请先将这部作品加入观影记录");
        if (!before && !v.type) throw new Error("请说明是电影、电视剧、动漫还是综艺");
        const fields = { ...v };
        for (const field of ["season", "episodes", "watchedThrough", "date", "time"]) delete fields[field];
        const item = { ...(before || {}), ...fields, title: before?.title || v.title, type: v.type || before?.type, status: v.status || before?.status || "想看的剧" };
        const isMovie = item.type === "电影" || item.tmdbMediaType === "movie";
        const watched = draft.action === "checkin" || item.status === "看过的剧";
        if (watched && !isMovie && draft.action === "checkin") {
          const seasons = (before?.seasons || []).filter(entry => Number(entry.seasonNumber) > 0);
          v.season ||= Number(before?.currentSeason || before?.season || (seasons.length === 1 ? seasons[0].seasonNumber : 0));
          if (v.watchedThrough != null) {
            if (!Number.isInteger(v.watchedThrough) || v.watchedThrough < 1 || v.watchedThrough > 2000) throw new Error("集数不正确");
            v.episodes = Array.from({ length: v.watchedThrough }, (_, index) => index + 1);
          }
        }
        if (watched && !isMovie && draft.action === "checkin" && (!v.season || !v.episodes?.length)) throw new Error("剧集打卡请说明季数和实际看过的集数");
        if (watched) item.watchedDate = v.date || today;
        if (isMovie && watched) item.status = "看过的剧";
        if (!isMovie && v.episodes?.length) {
          const season = String(v.season);
          const episodes = [...new Set([...(before?.seasonProgress?.[season] || []), ...v.episodes])].sort((a, b) => a - b);
          const count = Number(before?.seasonEpisodeCounts?.[season] || before?.seasons?.find((entry) => String(entry.seasonNumber) === season)?.episodeCount || 0);
          if (count && episodes.at(-1) > count) throw new Error("集数超过该季总集数");
          item.seasonProgress = { ...(before?.seasonProgress || {}), [season]: episodes };
          if (v.rating != null) item.seasonRatings = { ...(before?.seasonRatings || {}), [season]: String(v.rating) };
          item.currentSeason = season; item.season = season; item.currentEpisode = String(episodes.at(-1)); item.status = "正在看";
          const seasons = before?.seasons || [];
          if (seasons.length && seasons.every((entry) => { const watchedEpisodes = item.seasonProgress[String(entry.seasonNumber)] || []; const total = Number(entry.episodeCount); return total > 0 && Array.from({ length: total }, (_, index) => index + 1).every((episode) => watchedEpisodes.includes(episode)); })) item.status = "看过的剧";
        }
        after = put("consultations", before, item);
        if (watched) {
          const mode = isMovie ? "movie" : v.episodes?.length ? "season" : "legacy";
          const season = v.season ? String(v.season) : "";
          const existing = get("watchCheckins").find((entry) => entry.consultationId === after.id && entry.mode === mode && (mode !== "season" || String(entry.season) === season));
          put("watchCheckins", existing, { ...(existing || {}), consultationId: after.id, tmdbId: after.tmdbId || "", tmdbMediaType: isMovie ? "movie" : "tv", title: after.title, titleZh: after.titleZh || "", originalTitle: after.originalTitle || "", posterUrl: after.posterUrl || "", type: after.type, mode, season, episodes: mode === "season" ? after.seasonProgress[season] : [], rating: v.rating ?? existing?.rating ?? "", date: v.date || today, time: v.time || "" });
          if (isMovie) reward("stick", 1, `watch-checkin:${after.id}:movie`);
          else (v.episodes || []).forEach((episode) => reward("stick", 1, `watch-checkin:${after.id}:${season}:${episode}`));
        }
      } else if (draft.kind === "fund") {
        before ||= get("fundPortfolio").find((item) => item.code === v.code) || null;
        const item = { ...(before || { code: v.code, name: v.name || "", trades: [] }) };
        if (v.name) item.name = v.name;
        if (v.alipayValue != null) Object.assign(item, { alipayValue: v.alipayValue, alipayProfit: v.alipayProfit, alipayTodayProfit: v.alipayTodayProfit ?? null, alipayCalibratedAt: `${v.date} ${v.time || ""}`.trim() });
        if (v.tradeType) {
          const amount = v.amount || (v.shares && v.price ? v.shares * v.price : 0);
          const shares = v.shares || (amount && v.price ? amount / v.price : 0);
          if (!amount || !shares) throw new Error("基金交易需要金额、份额或成交净值中的两项，不能用当前估值代替成交价");
          const holding = (item.trades || []).reduce((sum, trade) => sum + (trade.type === "sell" ? -1 : 1) * Number(trade.shares || 0), 0);
          if (v.tradeType === "sell" && shares > holding + 1e-6) throw new Error("卖出份额超过已记录持仓，请先补齐持仓");
          item.trades = [...(item.trades || []), { id: makeId(), type: v.tradeType, amount, shares, price: v.price || amount / shares, date: v.date, note: v.note || "" }];
        }
        after = put("fundPortfolio", before, item);
      } else {
        if (draft.kind === "water") { v = { ...v, type: "water", cups: v.amount / 250 }; reward("water", Math.max(1, Math.round(v.cups))); }
        if (draft.kind === "meal") v = { ...v, type: "meal", title: v.title || `${v.meal}热量` };
        if (draft.kind === "exercise") {
          v.label = activityLabels[v.type]; v.calories ??= null;
          if (v.score) { const score = v.score.match(/^(\d+)\s*[:：-]\s*(\d+)$/); if (!score || score[1] === score[2] || v.type !== "table-tennis") throw new Error("请说明有效的乒乓球比分，我方在前"); v.score = `${Number(score[1])}:${Number(score[2])}`; v.result = Number(score[1]) > Number(score[2]) ? "win" : "loss"; }
          reward("bone", 1);
        }
        if (draft.kind === "weight") before = get("weightRecords").find((item) => item.date === v.date) || null;
        if (draft.kind === "task" && !before) v = { priority: "中", status: "未完成", note: "", reminderAt: "", reminderSentAt: "", ...v };
        if (draft.kind === "note" && !before) v = { type: "life", content: "", mood: "", tags: [], ...v };
        if (draft.kind === "asset" && !before) v = { purchaseDate: today, category: "", status: "服役中", saleDate: "", salePrice: "", retirementDate: "", notes: "", icon: "thiings:box", ...v };
        if (draft.kind === "asset") {
          const item = { ...(before || {}), ...v };
          if (item.status === "已出售" && (!item.saleDate || item.salePrice === "" || item.salePrice == null)) throw new Error("售出资产需要售出日期和售出金额");
          if (item.status === "退役" && !item.retirementDate) throw new Error("退役资产需要退役日期");
          if (item.saleDate && item.saleDate < item.purchaseDate || item.retirementDate && item.retirementDate < item.purchaseDate) throw new Error("售出或退役日期不能早于购买日期");
        }
        if (draft.kind === "subscription") {
          v = { ...(before || { purchaseDate: today, billingCycle: "", endDate: "", usageNote: "", icon: "thiings-subscribe:credit-card" }), ...v };
          if (v.purchaseType === "订阅会员" && (!v.billingCycle || !v.endDate)) throw new Error("请说明订阅周期和到期日期，例如每月、12月4日到期");
          if (v.endDate && v.endDate < v.purchaseDate) throw new Error("订阅到期日期不能早于购买日期");
          if (v.purchaseType === "永久会员") { v.billingCycle = ""; v.endDate = ""; }
        }
        if (draft.kind === "travel") {
          const { spot, date, rating, review, ...trip } = v;
          if (spot && !date) throw new Error("景点打卡需要说明日期");
          const checkins = [...(before?.checkins || [])];
          if (spot) checkins.push({ id: makeId(), name: spot, date, rating: rating ?? null, review: review || "" });
          v = normalizeTravelRecord({ ...(before || {}), ...trip, cost: v.cost ?? before?.cost ?? null, checkins });
        }
        if (draft.kind === "anniversary") { if (!before) v = { calendarType: "solar", startDate: "", ...v }; if ((v.calendarType || before?.calendarType) === "lunar") throw new Error("阴历纪念日请在纪念日页面选择，语音日期暂按阳历填写"); const item = { ...(before || {}), ...v }; if (item.startDate && item.startDate > item.date) throw new Error("起始日期不能晚于目标日期"); }
        if (draft.kind === "lifeGoal" && !before) v.items = (v.items || []).map((title) => ({ id: makeId(), title, completed: false }));
        if (draft.kind === "lifeGoal" && before && v.items) throw new Error("请用目标打卡项目逐项新增，不能覆盖整个项目列表");
        if (draft.kind === "index") {
          const item = { ...(before || {}), kind: before?.fundCode ? "fund" : "market", code: before?.fundCode || before?.marketSymbol, ...v };
          if (item.kind === "fund" && !/^\d{6}$/.test(item.code)) throw new Error("追踪基金需要6位代码");
          if (item.kind === "market" && !/^(?:s_)?(?:sh|sz|hk)?[\da-zA-Z_]+$/.test(item.code)) throw new Error("请使用行情页支持的指数代码");
          v = { ...(before || {}), name: item.name, marketSymbol: item.kind === "market" ? item.code : "", fundCode: item.kind === "fund" ? item.code : "", midAbove: item.midAbove || 0, highAbove: item.highAbove || 0, metrics: item.note ? [["观察备注", item.note]] : before?.metrics || [] };
          if (v.highAbove && v.midAbove > v.highAbove) throw new Error("中位阈值不能高于高位阈值");
        }
        after = put(spec.collection, before, { ...(before || {}), ...v });
        if (draft.kind === "task" && after.status === "已完成" && before?.status !== "已完成") reward("toy", 1, `task:${after.id}`);
      }
      records.push({ ...draft, requestedValue: draft.kind === "watch" ? v : draft.value, label: spec.label, page: spec.page, value: after });
    } catch (error) {
      Object.keys(collections).forEach((key) => delete collections[key]); Object.assign(collections, snapshot);
      changes.length = changeCount; rewards.length = rewardCount;
      issues.push(`${quickRecordTypes[draft.kind]?.label || "记录"}：${error.message}`);
    }
  }
  return { records, issues, changes, rewards, collections };
}

export function undoQuickRecordChanges(changes, state) {
  const collections = {};
  const deleted = [];
  let skipped = 0;
  for (const change of [...changes].reverse()) {
    const current = collections[change.collection] || state[change.collection] || (change.habitId ? {} : []);
    if (change.habitId) {
      if (current[change.habitId] !== change.after[change.habitId]) { skipped++; continue; }
      const next = { ...current };
      if (Object.hasOwn(change.before, change.habitId)) next[change.habitId] = change.before[change.habitId];
      else delete next[change.habitId];
      collections[change.collection] = next;
      continue;
    }
    const index = current.findIndex((item) => item.id === change.after.id);
    const omitStamp = (item) => { const { updatedAt, ...value } = item; return value; };
    if (index < 0 || JSON.stringify(omitStamp(current[index])) !== JSON.stringify(omitStamp(change.after))) { skipped++; continue; }
    if (change.before) collections[change.collection] = current.map((item, at) => at === index ? change.before : item);
    else { collections[change.collection] = current.filter((item) => item.id !== change.after.id); deleted.push({ collection: change.collection, id: change.after.id }); }
  }
  return { collections, deleted, skipped };
}

export function describeQuickRecord(record) {
  const v = record.value;
  const details = {
    water: `${v.amount} ml`, meal: `${v.meal} · ${v.title} · ${v.calories} kcal`, exercise: `${v.label} ${v.duration}分钟${v.distanceKm ? ` · ${v.distanceKm}公里` : ""}${v.score ? ` · ${v.opponent || ""} ${v.score}` : ""}`, weight: `${v.weight} kg`,
    task: `${v.title} · ${v.status}`, habit: `${v.title} · ${record.action === "complete" ? "已打卡" : "新增习惯"}`, note: `${v.title}${v.content ? ` · ${v.content}` : ""}`,
    asset: `${v.name} · ¥${v.price} · ${v.status}${v.saleDate ? ` · ${v.saleDate}售出 ¥${v.salePrice}` : ""}${v.retirementDate ? ` · ${v.retirementDate}退役` : ""}`,
    subscription: `${v.title} · ¥${v.price} · ${v.purchaseType} ${v.billingCycle || ""}${v.endDate ? ` · 到期${v.endDate}` : ""}`,
    travel: `${v.destination} · ${v.startDate}至${v.endDate}${v.cost != null ? ` · ¥${v.cost}` : ""}${record.kind === "travel" && record.action === "checkin" ? ` · 打卡${record.value.checkins.at(-1)?.name}` : ""}`,
    anniversary: `${v.title} · ${v.date} · 阳历`, lifeGoal: `${v.title} · 目标日期${v.targetDate}`, lifeItem: `${v.goal} / ${v.title} · ${v.status}`,
    watch: `${v.titleZh || v.title} · ${v.status}${v.currentSeason ? ` · 第${v.currentSeason}季 第${v.currentEpisode}集` : ""}${v.rating != null && v.rating !== "" ? ` · ${v.rating}/10分` : ""}`,
    fund: `${v.code} ${v.name || ""}${record.requestedValue?.tradeType ? ` · ${v.trades.at(-1).type === "sell" ? "卖出" : "买入"} ¥${v.trades.at(-1).amount} / ${v.trades.at(-1).shares}份 · ${v.trades.at(-1).date}` : ""}${v.alipayValue != null ? ` · 市值¥${v.alipayValue} · 持有收益¥${v.alipayProfit}` : ""}`,
    index: `${v.name} · ${v.fundCode || v.marketSymbol} · 中位${v.midAbove} / 高位${v.highAbove}`,
  };
  const detailFields = { exercise: ["calories"], task: ["priority", "note", "reminderAt"], note: ["mood"], asset: ["purchaseDate", "category", "notes"], subscription: ["purchaseDate", "usageNote"], travel: ["city", "notes"], watch: ["platform", "review"] };
  const extra = (detailFields[record.kind] || []).filter((name) => v[name] !== "" && v[name] != null).map((name) => `${quickFieldLabels[name]}：${v[name]}`);
  if (record.kind === "watch" && record.requestedValue?.watchedThrough) extra.push(`进度已到：第${record.requestedValue.season}季 第${record.requestedValue.watchedThrough}集`);
  else if (record.kind === "watch" && record.requestedValue?.episodes?.length) extra.push(`本次看过：第${record.requestedValue.season}季 ${record.requestedValue.episodes.join("、")}集`);
  if (record.kind === "travel" && record.action === "checkin") { const spot = v.checkins.at(-1); extra.push(`${spot.date} ${spot.rating ? `${spot.rating}/5星` : "未评分"}${spot.review ? ` · ${spot.review}` : ""}`); }
  if (record.kind === "lifeGoal" && v.items?.length) extra.push(`项目：${v.items.map((item) => item.title).join("、")}`);
  return `${record.label || quickRecordTypes[record.kind]?.label} · ${[v.date, v.time, details[record.kind], ...extra].filter(Boolean).join(" · ")}`;
}
