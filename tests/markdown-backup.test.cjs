const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const backup = {};
vm.createContext(backup);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../lib/markdown-backup.js'), 'utf8').replaceAll('export function', 'function'), backup);

function payload() {
  const result = {version:1,exportedAt:'2026-11-07T00:00:00Z',assets:'sh603629',watchAssets:'sh600519',fundCodes:'000001',waterTarget:1800,done:{reading:true},petSupplies:{food:3},petSuppliesUpdatedAt:123,petRewardHistory:{reading:'2026-11-07'},weatherCache:{current:14},marketCache:{quotes:[]}};
  for(const field of ['plans','notes','consultations','watchCheckins','assetRecords','subscriptionRecords','travelRecords','dietRecords','exerciseRecords','weightRecords','anniversaries','lifeGoals','habits','fundPortfolio','indexTrackerItems']) result[field] = [{id:field,title:'中文记录',extra:{preserved:true}}];
  result.deletedHabitIds = ['deleted'];
  result.notes[0].content = '# 日记\n```json\n{"version":999}\n```\n<!-- qiyeworkbench-backup:v1 -->';
  result.petSupplies = { bone: 2, water: 3, toy: 4, stick: 5, gift: 6, cat: 7, happiness: 42 };
  return result;
}

test('Markdown backup round-trip preserves every collection and nested field, including notes containing fences', () => {
  const original = payload();
  const markdown = backup.encodeMarkdownBackup('# 七夜online\n\n' + original.notes[0].content, original);
  assert.ok(markdown.startsWith('# 七夜online'));
  assert.deepEqual(JSON.parse(JSON.stringify(backup.decodeMarkdownBackup(markdown))), original);
  assert.deepEqual(JSON.parse(JSON.stringify(backup.decodeMarkdownBackup('\uFEFF' + markdown.replaceAll('\n','\r\n')))), original);
});

test('legacy version 1 JSON backups remain importable', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(backup.decodeMarkdownBackup(JSON.stringify(payload())))), payload());
  assert.deepEqual(JSON.parse(JSON.stringify(backup.decodeMarkdownBackup('{"version":1,"notes":[]}'))), {version:1,notes:[]});
});

test('unrelated Markdown, corrupt data, unknown versions and missing collections fail before restoration', () => {
  assert.throws(() => backup.decodeMarkdownBackup('# 我的笔记'), /完整恢复数据/);
  assert.throws(() => backup.decodeMarkdownBackup('{}'), /不.*支持/);
  assert.throws(() => backup.decodeMarkdownBackup('{broken'), /无法读取/);
  assert.throws(() => backup.decodeMarkdownBackup(backup.encodeMarkdownBackup('# Export',{...payload(),version:2})), /不.*支持/);
  const missing = payload(); delete missing.notes;
  assert.throws(() => backup.decodeMarkdownBackup(backup.encodeMarkdownBackup('# Export',missing)), /不完整/);
});

test('invalid record collections and settings are rejected before any state can be written', () => {
  for (const patch of [{plans:{}},{notes:[null]},{done:[]},{assets:{}},{waterTarget:-1}]) {
    assert.throws(() => backup.decodeMarkdownBackup(backup.encodeMarkdownBackup('# Export',{...payload(),...patch})));
  }
});
