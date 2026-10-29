# 进度

- 已检查本地动漫接口、推荐合并、卡片交互与缓存。
- 已核查 Kazumi 数据请求实现，用户已选择优先当季新番、今日更新和热门推荐。
- 用户已确认具体方案；已修改 app/api/anime-updates/route.js 和 app/page.jsx。
- 网络探测失败：Bangumi 官方与 Next 端点本机均不可达，不能宣称实测返回数据。
- 新增行为测试 9 项通过；原有资产与行情 14 项通过。首次测试夹具缺少函数桩，补齐后通过。
- Next.js 生产构建通过，生成 24 条路由；设计检测无新增问题。
- 浏览器安全门禁拒绝本地预览地址，返回用户拒绝授权。未尝试其他浏览器、其他端口或自动化绕过；手机与桌面目视验收未完成。
- 一次整文件替换补丁因重复目标未执行，改为任务目录生成源文件后复制；一次混合补丁上下文不匹配未执行，拆成正确补丁后应用。
- 为避免无关请求，动漫标签中的手动刷新与 15 分钟定时刷新仅刷新动漫；其他影视页保持已有行为。
- 最终新增行为验证 12 项全部通过，最终代码生产构建成功（24 条路由）；差异空白检查通过。
- 新增独立动漫请求序号，避免动漫自动刷新使电影/电视剧的并行加载失效。进入动漫页即检查更新。
- 已保存整合与上传说明，复制两个功能文件到 upload/app；使用 Node 字节比较确认副本一致。PowerShell Get-FileHash 在本机不可用，改用 Node crypto 计算 SHA256。
- 本次启动的 3116/3117 验证进程已停止；没有上传 GitHub 或触发正式部署。

## 2026-10-19 TMDB display extension completed

- Recommendation API now matches Bangumi-selected items with TMDB zh-CN before rendering. Field-level Bangumi fallback preserves names, descriptions, posters, IDs, ranking and airing dates.
- Exact normalized titles, animation genre and compatible premiere year are required. Ambiguous or undated matches are retained as Bangumi items.
- Deduplicated matching uses 8 workers, a 12-second total budget and 2.5-second query timeouts. Successful matches cache for 24 hours, misses for 15 minutes; errors are retried. Frontend timeout is 30 seconds and partial metadata failures have a visible note.
- Removed redundant click-time title searches; matched cards already carry TMDB IDs when added to the watchlist.
- 19 anime behavior tests and 14 existing regression tests passed. Final production build passed (24 routes), whitespace diff check passed.
- Updated upload/app/page.jsx and upload/app/api/anime-updates/route.js; byte comparison and SHA256 verified. Updated local fixture preview for the new imports; syntax checked only, not started.
- No GitHub upload or deployment. Live Bangumi/TMDB data and browser appearance remain unverified; previous browser access rejection was respected.
