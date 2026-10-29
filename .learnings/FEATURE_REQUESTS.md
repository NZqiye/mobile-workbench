# Feature Requests

Capabilities requested by the user.

---

## [FEAT-20260912-002] force-pwa-update

**Logged**: 2026-09-12T13:08:00+08:00
**Priority**: high
**Status**: resolved
**Area**: infra

### Requested Capability
每次打开网页都主动检查并切换到最新版本，避免 PWA 继续显示旧页面。

### User Context
部署新版本后手机端仍显示旧版本，怀疑 Service Worker 更新机制未生效。

### Complexity Estimate
simple

### Suggested Implementation
Service Worker 导航请求绕过 HTTP 缓存并保留离线兜底；注册时禁用脚本缓存，检测到新 worker 后自动刷新；静态资源缓存版本递增，并为 sw.js 设置 no-store。

### Metadata
- Frequency: first_time
- Related Features: pwa-cache

### Resolution
- **Resolved**: 2026-09-12T13:08:00+08:00
- **Notes**: 已更新 public/sw.js、app/register-service-worker.jsx 与 next.config.js，并通过生产构建及 sw.js 响应头验证。

---

## [FEAT-20260907-001] asset-lifecycle-fields

**Logged**: 2026-09-07T00:00:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Requested Capability
在资产记录中，为“已出售”增加出售日期、出售价格，为“退役”增加退役时间。

### User Context
完善资产生命周期记录，便于回看出售和退役信息。

### Complexity Estimate
simple

### Suggested Implementation
在资产表单按状态显示对应字段，并将字段保存到 assetRecords 后在列表卡片回显。

### Metadata
- Frequency: first_time
- Related Features: asset-records

### Resolution
- **Resolved**: 2026-09-07T00:00:00+08:00
- **Notes**: 已完成表单录入、assetRecords 持久化及状态列表回显。

---
