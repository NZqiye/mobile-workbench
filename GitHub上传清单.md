# GitHub 上传清单

仓库：`NZqiye/mobile-workbench`

目标分支：`main`

## 本次必须上传或更新

以下路径要放在 GitHub 仓库根目录，保持目录结构不变：

```text
.gitignore
package.json
package-lock.json
vercel.json

app/page.jsx
app/api/push/cron/route.js
app/api/push/public-key/route.js
app/api/push/subscribe/route.js

lib/push-server.js
public/sw.js
```

## 建议一并上传

```text
README.md
supabase-push.sql
```

`supabase-push.sql` 只是数据库结构记录；推送表已经在 Supabase 执行成功，不上传也不影响运行。

## 不要上传

```text
.env.local
.next/
node_modules/
*.log
tmp/
_tmp/
*.bak-*
```

尤其不要上传：

- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PRIVATE_KEY`
- `CRON_SECRET`
- 任何 API Key、Session ID 或访问码

这些值已经保存在 Vercel 环境变量中。

## 上传后

1. 在 GitHub 提交到 `main` 分支。
2. Vercel 会自动触发新的 Production Deployment。
3. 部署成功后，在手机 PWA 的“设置”中点击“开启提醒”。
4. 新建任务时填写提醒时间，并确认云同步已开启。

当前 `vercel.json` 使用 `0 2 * * *`，对应北京时间每天 10:00 左右执行一次。
