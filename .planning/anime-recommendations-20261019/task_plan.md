# 动漫推荐数据整合

日期：2026-10-19（Asia/Shanghai）

## 目标

改善当季新番、今日放送和热门推荐的新鲜度，保持现有片单功能和视觉风格。

## 下一步

本地实现与可执行检查已完成；交付待上传文件。真实来源连通性与手机/桌面目视验收仍需后续验证。

## 阶段

1. 需求与来源核查：complete。用户已选择优先新番、今日更新与热门推荐。
2. 最小实现：complete。用户确认方案后，已完成接口和前端修改。
3. 行为测试与构建：complete。12 项新增行为测试、14 项原有检查通过，最终生产构建通过；手机和桌面目视验收因浏览器权限拒绝未进行。
4. 保存交付说明和待上传文件清单：complete。已整理 upload/app 下两个功能文件并逐字节核验。不自动发布本次新功能。

## 约束

- 保留已有手机端搜索和主题色修复。
- 不引入播放器、第三方视频站规则或新框架。
- 放送排期不冒充平台实际更新状态。
- 修改前保存原文件副本；验证脚本置于本任务目录。

## 遇到的问题

- 本机直连 Bangumi 与 Bangumi Next 请求失败；需区分网络验证与离线功能测试结果。

## TMDB display extension

5. complete: Enrich Bangumi-selected recommendations with TMDB zh-CN metadata before rendering; retain unmatched items, ranking and schedule.
6. complete: Verify matching, fallbacks, bounded fetching and frontend integration; build and refresh upload copies.
