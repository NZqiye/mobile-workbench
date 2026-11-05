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

---

## [LRN-20261105-001] correction

**Logged**: 2026-11-05
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
简化录入界面不能隐藏手打入口、服务状态或实际保存动作；识别结果不等于已经写入栏目。

### Details
用户反馈快速记录过于简洁，输入没有进入各栏目。本机虽然已配置语音供应商，原接口仍强制要求尚未配置的云同步会话，结果退回只支持饮水和运动的规则；“识别并填写”还需另一次确认，入口折叠后难以发现。

### Resolution
天气下面改为紧凑的录音与手打录入区。完整识别直接保存，缺项明确提示未保存；错误与跨页切换保留原文。本机开发回环访问仅在未配置会话密钥时使用本地语音配置，生产环境继续要求签名会话。验证了真实语音服务、各模块实际存储、更新与撤销。

### Metadata
- Source: user_feedback
- Related Files: app/components/voice-quick-record.jsx, lib/voice-access.js
- Tags: input, persistence, service-status, verification

---

## [LRN-20261105-002] correction

**Logged**: 2026-11-05
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
UI优化应保留用户原有角色图标、头像和功能图标，不能将统一图标技能建议直接覆盖用户的视觉偏好。

### Details
用户反馈原先的图标都没了。上一轮将角色导航与路飞头像替换为线性图标，也替换了饮水和宠物物资等图标，削弱了用户熟悉的界面特色。

### Resolution
恢复原有图片映射、图标组件及功能图标，调整容器尺寸与对齐；保留新版排版、配色及录入修复。后续优化遵循这一明确偏好。

### Metadata
- Source: user_feedback
- Related Files: app/page.jsx, app/workbench-ui.css
- Tags: icons, personal-preference, preserve-identity

---

## [LRN-20261105-003] correction

**Logged**: 2026-11-05
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
用户认可原有整体风格，要求主题切换继续改变背景、卡片和按钮配色，不能将主题降为单一强调色。

### Resolution
撤回统一纸白的全局覆盖，恢复原始样式与8种主题变化，仅保留天气下方快速录入、分类写入、错误提示及草稿修复。后续UI优化在原有风格内作局部调整。

### Metadata
- Source: user_feedback
- Related Files: app/layout.js, app/page.jsx, app/globals.css
- Tags: theme, personal-preference, preserve-style
