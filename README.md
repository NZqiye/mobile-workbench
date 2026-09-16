# 七夜online

这是移动优先的 PWA 工作台，包含生活记录、习惯打卡、待办、每日复盘、树洞、国内行情看板和 Supabase 云同步。

## 本地运行

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

## 手机端怎么解锁

1. 先把项目部署到 Vercel，得到一个 HTTPS 地址。
2. 手机浏览器打开这个地址。
3. 进入“设置”。
4. 在“云同步”里输入部署时配置的固定访问码。
5. 解锁成功后，状态会显示“云同步在线”。
6. 点“同步”，把本机数据上传到云端。

本地测试时也可以用 `http://localhost:3000` 登录，但手机无法直接访问电脑的 localhost。手机要测试本地版本，需要让手机和电脑在同一 Wi-Fi，并用电脑局域网 IP 访问。

## Supabase 配置

本地 `.env.local` 需要：

```text
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase anon / publishable key
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service role key（仅服务端）
VAPID_PUBLIC_KEY=Web Push 公钥
VAPID_PRIVATE_KEY=Web Push 私钥
VAPID_SUBJECT=mailto:你的邮箱
CRON_SECRET=Vercel Cron 请求密钥
WORKBENCH_SESSION_SECRET=至少 32 位的随机会话签名密钥（必填，仅配置在 Vercel）
WORKBENCH_ACCESS_CODE=工作台固定访问码（必填，仅配置在 Vercel）
OPENAI_API_KEY=你的 OpenAI API Key
DAILY_HOT_API_BASE=DailyHotApi 地址，建议正式部署时填写自建地址
TMDB_ACCOUNT_ID=你的 TMDB 账号 ID，用于同步待看片单
TMDB_SESSION_ID=你的 TMDB 会话 ID，用于同步待看片单
```

如果要使用“饮食记录”的拍照识别热量功能，需要配置 `OPENAI_API_KEY`。可选配置 `OPENAI_VISION_MODEL`，不填时默认使用项目内置的视觉模型名称。

“热榜时讯”使用 DailyHotApi 热榜接口。正式部署建议在 Vercel 配置 `DAILY_HOT_API_BASE`，填入你自建的 DailyHotApi 地址；不配置时会尝试默认公开地址，但公开地址不保证长期可用。

Supabase Dashboard 里需要确认：

```text
Authentication → Providers → Email 已启用
Authentication → URL Configuration → Site URL 填你的正式网址
Authentication → URL Configuration → Redirect URLs 加你的正式网址
```

### 后台消息提醒

1. 在 Supabase SQL Editor 执行项目根目录的 `supabase-push.sql`。
2. 生成一对 VAPID 密钥，并在 Vercel 配置 `SUPABASE_SERVICE_ROLE_KEY`、`VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT`、`CRON_SECRET`、`WORKBENCH_ACCESS_CODE` 和至少 32 位随机的 `WORKBENCH_SESSION_SECRET`。
3. 部署到 HTTPS 域名后，在手机 PWA 的“设置”中点击“开启提醒”。
4. 新建任务时填写提醒时间；Vercel Cron 每天北京时间 10:00 左右检查到期任务并发送推送（Hobby 计划可能延迟约 59 分钟）。

`SUPABASE_SERVICE_ROLE_KEY` 和 `VAPID_PRIVATE_KEY` 只能放在服务端环境变量，不能提交到仓库。

例如：

```text
https://你的项目.vercel.app
http://localhost:3000
```

## 当前同步方式

为了沿用旧表，当前同步使用 `workbench_records` 表里的 `app_state` 记录：

```text
page = app_state
title = 用户ID:数据项名称
note = JSON 数据
```

会同步：

```text
饮食记录
待办记录
每日复盘
树洞记录
习惯列表
今日打卡状态
自选资产
```

行情数据只做本地缓存，不写入数据库。

## 国内行情数据

当前行情接口：

```text
/api/market-quotes?symbols=SGE_AU9999,s_sh000001,s_sz399001,sh600519,sz300750
```

默认显示：

```text
SGE_AU9999  沪金 Au99.99
s_sh000001  上证指数
s_sz399001  深证成指
sh600519    贵州茅台
sz300750    宁德时代
```

当前版本使用国内公开行情源作为个人学习和工作台展示用途，不建议作为交易下单或商用数据源。

## 部署到 Vercel

1. 把 `next-mobile-workbench` 推到 GitHub。
2. 在 Vercel 新建项目，选择这个目录。
3. 在 Vercel 的 Environment Variables 里添加 Supabase、推送、Cron 和访问控制所需的服务端变量（完整清单见上文）。
4. 部署完成后，把 Vercel 域名填进 Supabase 的 Site URL 和 Redirect URLs。
5. 手机打开网址，添加到主屏幕。
