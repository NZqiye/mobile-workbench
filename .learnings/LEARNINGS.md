# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice

---

## [LRN-20260912-003] best_practice

**Logged**: 2026-09-12T11:55:00+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
After frontend CSS changes, verify that the local preview process is serving the latest build.

### Details
The mobile rating layout had already been changed in source, but port 3120 was an old `next start` process. The browser therefore showed the previous two-column layout and made the source fix appear ineffective.

### Suggested Action
After `npm run build`, restart the production preview process or use `npm run dev`; confirm the process working directory and HTTP 200 response before visual verification.

### Metadata
- Source: error
- Related Files: app/globals.css
- Tags: local-preview, nextjs, responsive

### Resolution
- **Resolved**: 2026-09-12T11:55:00+08:00
- **Notes**: Rebuilt the project and restarted the service on port 3120.

---

## [LRN-20260912-002] correction

**Logged**: 2026-09-12T01:10:00+08:00
**Priority**: high
**Status**: pending
**Area**: frontend

### Summary
移动端信息密集页面不能只压缩桌面布局，必须重新组织为可读的单列流程。

### Details
观影评分页在手机端沿用桌面左右双栏时，片单和详情会被挤窄，文字与内容不可读。移动端应切换为单列作品列表、全宽详情和可读的集数内容；桌面端再使用左右分栏与独立滚动。

### Suggested Action
新增移动端规则时使用 `.mobile-shell` 作为明确边界，并验证最终选择器优先级，避免仅依赖视口宽度或字号压缩。

### Metadata
- Source: user_feedback
- Related Files: F:/Codex/个人知识库/01-Projects（当前项目）/手机端个人工作台/mobile-workbench-main/app/globals.css
- Tags: responsive, mobile, readability

---

## [LRN-20260923-001] correction

**Logged**: 2026-09-23
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
新增业务模块不能只写入 localStorage，需要接入现有云端同步链路。

### Details
用户反馈星光计划在多端之间不同步。原因是模块只使用 `writeStorage("lifeGoals", next)`，没有加入 `syncedCollections`、云端合并、同步回写和备份流程。

### Suggested Action
新增跨端数据模块时，同时检查：本地状态初始化、`mergeCloudWithLocal`、`applyCloud`、登录/手动同步保存列表、业务 mutation 的 `persist` 调用，以及备份导入导出。

### Metadata
- Source: user_feedback
- Related Files: app/page.jsx
- Tags: sync, localStorage, supabase
