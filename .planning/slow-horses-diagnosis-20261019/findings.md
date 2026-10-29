# 排查证据

- app/page.jsx:6644-6718：importTmdb 串行等待详情、OMDb、TMDB watchlist POST 后才保存本地记录。单个请求无客户端超时。
- 当前线上页面显示“TMDB 片单同步失败：请先在工作台设置中解锁访问”；本地保存与 TMDB 片单同步的错误处理分离，不能直接断言鉴权是无法本地加入的唯一原因。

- 线上搜索 Slow Horses 成功（200，tmdbId=95480，tmdbMediaType=tv）；详情 200。
- 在当前用户网页“我的片单”中搜索 slow，实际已有 “Slow Horses 看过的剧 · 2022 · 剧集”。因此并非完全未加入。
- 只读无 cookie 片单 GET 返回 401，与用户浏览器已显示的解锁提示一致。
- OMDb 请求返回 HTML，需记录状态确认是否端点不存在；该错误被 catch 吞掉，不直接阻止本地导入。

- 已证实主要原因：Slow Horses 的旧记录状态为看过的剧，默认 completedLibraryOpen=false 排除它；本地搜索命中也不展开。
- 已隔离验证代码缺陷：去重后保留旧 ID，importTmdb 却返回新 ID，评分页面选中校正会跳回其他未看作品。
- 详见 排查结论.md 与 reproduce.cjs。

## 手机端截图后续

- app/globals.css:6675 搜索按钮 aria-label 选择器乱码，无法匹配 JSX 的“搜索作品”。搜索文案因此继承 40px 宽、22px 字体的图标按钮样式而挤成两行。
- 标题栏和同步栏背景写死为酒红色，当前青瓷主题仍显示红条。将限手机端复用既有主题变量。
