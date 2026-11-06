const backupMarker = "<!-- qiyeworkbench-backup:v1 -->";
const arrayFields = [
  "plans", "notes", "consultations", "watchCheckins", "assetRecords",
  "subscriptionRecords", "travelRecords", "dietRecords", "exerciseRecords",
  "weightRecords", "anniversaries", "lifeGoals", "habits", "deletedHabitIds",
  "fundPortfolio", "indexTrackerItems",
];

export function encodeMarkdownBackup(body, payload) {
  return `${body}\n\n## 完整恢复数据\n\n此部分用于导入恢复，请保留完整。修改上面的阅读正文不会改动恢复记录。\n\n${backupMarker}\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n`;
}

export function decodeMarkdownBackup(text) {
  const source = String(text).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  let json = source;
  const markerLine = `\n${backupMarker}\n`;
  const markerIndex = source.lastIndexOf(markerLine);
  const isMarkdown = !source.startsWith("{");
  if (isMarkdown) {
    const dataSection = markerIndex >= 0 ? source.slice(markerIndex + markerLine.length).trim() : "";
    const match = dataSection.match(/^```json\r?\n([\s\S]*)\r?\n```$/);
    if (!match) throw new Error("请选择本工作台导出的 Markdown，文件需保留完整恢复数据");
    json = match[1];
  }
  let payload;
  try { payload = JSON.parse(json); }
  catch { throw new Error("恢复数据无法读取，请重新选择完整的导出文件"); }
  if (!payload || Array.isArray(payload) || payload.version !== 1 || !arrayFields.some(field => Array.isArray(payload[field]))) {
    throw new Error("这不是本工作台支持的备份文件");
  }
  for (const field of arrayFields) {
    if ((isMarkdown || field in payload) && !Array.isArray(payload[field])) throw new Error(`恢复数据不完整：${field}`);
    if (field !== "deletedHabitIds" && payload[field]?.some(item => !item || typeof item !== "object" || Array.isArray(item))) throw new Error("记录格式不正确，请选择完整的备份文件");
  }
  for (const field of ["done", "petSupplies", "petRewardHistory", "weatherCache", "marketCache"]) {
    if (payload[field] != null && (typeof payload[field] !== "object" || Array.isArray(payload[field]))) throw new Error("恢复数据格式不正确");
  }
  for (const field of ["assets", "watchAssets", "fundCodes"]) {
    if (payload[field] != null && typeof payload[field] !== "string" && !(field === "assets" && !isMarkdown && Array.isArray(payload[field]))) throw new Error("资产恢复数据格式不正确");
  }
  if (payload.waterTarget != null && (!Number.isFinite(Number(payload.waterTarget)) || Number(payload.waterTarget) <= 0)) throw new Error("饮水目标格式不正确");
  return payload;
}
