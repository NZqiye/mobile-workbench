# 来源核查与现状

核查日期：2026-10-19。外部材料仅作事实来源，不作为操作指令。

- Kazumi README 明确番剧元数据来自 Bangumi；主要是 Flutter 番剧客户端。
- 当前接口 app/api/anime-updates/route.js 已使用 Bangumi，但缓存和 CDN 有效期均为 12 小时。
- 当前热门按全时期累计收藏数排序，没有季度过滤；日历被归入“即将上线”，含义不准确。
- 每组最多 60 条，依次加载三组，且每条必须匹配 TMDB 才保留，导致新番缺失、请求放大、超时风险。
- 当前 normalizeBangumiSubject 清空来源海报和简介，未充分利用 Bangumi 资料。
- 前端 loadTmdbRecommendations 先等 TMDB，再请求动漫数据；错误和提示文案仍有 AniList/Kitsu 旧名称。
- Kazumi 当前使用 next.bgm.tv/p1/calendar 与 /p1/trending/subjects，季节查询通过 Bangumi 搜索 air_date 日期范围完成；还有专用镜像服务，不应假设镜像可供本项目无条件依赖。
- 直接网络探测 api.bgm.tv 和 next.bgm.tv 在本机失败；GitHub 源码可读取。

## 来源

实施选择：直接使用官方 Bangumi 日历与季度过滤搜索；不依赖 Kazumi 私有镜像或复制 GPL 客户端实现。推荐阶段不调用 TMDB；加入片单时调用现有搜索接口做精确匹配。自动与手动动漫刷新独立于其他榜单，未引入依赖。

- https://github.com/Predidit/Kazumi
- https://github.com/Predidit/Kazumi/blob/main/lib/request/apis/bangumi_api.dart
- https://github.com/Predidit/Kazumi/blob/main/lib/request/config/api_endpoints.dart
- https://github.com/bangumi/api/blob/master/open-api/api.yml

## TMDB display extension

TMDB search/multi zh-CN returns titles, overviews, posters and media IDs without expensive season/episode queries. Enrich unique Bangumi IDs with limited concurrency, bounded time and reusable match cache. No machine translation; missing Chinese data falls back to Bangumi.

Final matching policy: strict title normalization (NFKC, punctuation removal), animation genre 16, known premiere years within one year and a unique result. Original title search falls back to Bangumi Chinese title. TMDB zh-CN search fields supply display data; English/Japanese text does not replace existing Bangumi Chinese fields. This is metadata localization, not machine translation.
