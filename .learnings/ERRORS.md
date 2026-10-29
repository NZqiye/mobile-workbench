# Errors

Command failures and integration errors.

---

## [ERR-20260913-002] cua-browser-auth-method

**Logged**: 2026-09-13T22:30:00+08:00
**Priority**: medium
**Status**: pending
**Area**: infra

### Summary
重试接管 Supabase 浏览器标签页时，浏览器枚举仍因 Codex 认证方式不受支持而失败。

### Error
```text
unsupported Codex auth method: apikey
```

### Context
- 当前标签页为 Supabase Dashboard 项目页。
- 已按 Computer Use 恢复流程重新初始化并重试一次，仍返回相同错误。

### Suggested Fix
恢复 Codex 浏览器工具的受支持认证方式，或由用户手动在 Supabase SQL Editor 执行推送表 SQL。

### Metadata
- Reproducible: yes
- Related Files: supabase-push.sql

---

## [ERR-20260913-001] cua-local-browser-timeout

**Logged**: 2026-09-13T22:15:00+08:00
**Priority**: low
**Status**: pending
**Area**: tests

### Summary
本地页面的浏览器自动化检查在建立连接时超时。

### Error
```text
js execution timed out; kernel reset
```

### Context
- 尝试打开 `http://127.0.0.1:3000` 进行推送设置界面检查。
- Next.js 生产构建已通过，本地开发服务也已启动。

### Suggested Fix
优先使用已启动服务的 HTTP 检查；需要视觉验证时重启浏览器自动化会话后再试。

### Metadata
- Reproducible: unknown
- Related Files: app/page.jsx

---

## [ERR-20260912-004] github-fetch-reset

**Logged**: 2026-09-12T13:00:00+08:00
**Priority**: low
**Status**: pending
**Area**: infra

### Summary
拉取 GitHub 远端最新引用时连接被重置。

### Error
```text
fatal: unable to access 'https://github.com/NZqiye/mobile-workbench.git/': Recv failure: Connection was reset
```

### Context
- 用于核对用户所说的 GitHub 最新版本。
- 本地已有 origin/main 引用，远端实时状态未能刷新。

### Suggested Fix
网络恢复后重新执行 git fetch，或直接在 GitHub/Vercel 控制台核对最新 commit。

### Metadata
- Reproducible: unknown
- Related Files: public/sw.js, app/register-service-worker.jsx

---

## [ERR-20260912-003] browser-preview-auth

**Logged**: 2026-09-12T11:55:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
The browser automation surface was unavailable because the local Codex auth method was unsupported.

### Error
```text
unsupported Codex auth method: apikey
```

### Context
- Attempted to inspect the local preview at a phone-sized viewport.
- Used build output, process inspection, CSS rule checks, and an HTTP 200 request as the verification fallback.

### Suggested Fix
Use the browser automation surface when its authentication is available; otherwise keep preview verification reproducible with a restarted service and build checks.

### Metadata
- Reproducible: unknown
- Related Files: app/globals.css

### Resolution
- **Resolved**: 2026-09-12T11:55:00+08:00
- **Notes**: Verified the rebuilt service on port 3120 and confirmed the mobile rules are present.

---

## [ERR-20260910-003] vm-cross-realm-assertion

**Logged**: 2026-09-10T00:13:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
The helper smoke test used deepStrictEqual on an object created in a separate VM realm.

### Error
```text
AssertionError: Values have same structure but are not reference-equal
```

### Context
- Values were numerically correct; the failure was only a cross-realm prototype mismatch.

### Suggested Fix
Assert individual scalar properties or normalize through JSON before comparing.

### Metadata
- Reproducible: yes
- Related Files: app/page.jsx

### Resolution
- **Resolved**: 2026-09-10T00:13:00+08:00
- **Notes**: Switched the smoke check to scalar property assertions.

---

## [ERR-20260910-002] helper-smoke-test-extraction

**Logged**: 2026-09-10T00:12:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
A one-off VM smoke test omitted a helper function from its extracted source slice.

### Error
```text
ReferenceError: isTableTennisRecord is not defined
```

### Context
- The test extracted score/stat helpers from page.jsx but started after the record-type helper.

### Suggested Fix
Include dependent helper definitions or test the helpers in a standalone fixture.

### Metadata
- Reproducible: yes
- Related Files: app/page.jsx

### Resolution
- **Resolved**: 2026-09-10T00:12:00+08:00
- **Notes**: Reran with the complete helper slice including isTableTennisRecord.

---

## [ERR-20260910-001] powershell-reserved-variable

**Logged**: 2026-09-10T00:05:00+08:00
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
A verification command attempted to assign the PowerShell-reserved `$PID` variable.

### Error
```text
Cannot overwrite variable PID because it is read-only or constant.
```

### Context
- The command was intended to stop the local dev server before running a production build.

### Suggested Fix
Use a task-specific variable name such as `$taskPid`.

### Metadata
- Reproducible: yes
- Related Files: none

### Resolution
- **Resolved**: 2026-09-10T00:05:00+08:00
- **Notes**: Retried with `$taskPid`.

---

## [ERR-20260909-002] impeccable-detector-existing-css

**Logged**: 2026-09-09T23:20:00+08:00
**Priority**: low
**Status**: resolved
**Area**: frontend

### Summary
The Impeccable detector returned two pre-existing side-tab accent warnings outside the exercise card changes.

### Error
```text
globals.css:167 border-left: 3px solid #f2c37b
globals.css:594 anniversary-card::before 4px pseudo-element stripe
```

### Context
- Detector was run once after the exercise UI pass as required.
- Both findings are in unrelated existing anniversary/theme styles; no exercise selector was flagged.

### Suggested Fix
Leave unchanged unless the user requests a broader visual cleanup.

### Metadata
- Reproducible: yes
- Related Files: app/globals.css

### Resolution
- **Resolved**: 2026-09-09T23:20:00+08:00
- **Notes**: Reviewed findings and kept scope limited to the requested exercise/乒乓球 card.

---

## [ERR-20260909-001] apply-patch-context-drift

**Logged**: 2026-09-09T08:58:00+08:00
**Priority**: low
**Status**: resolved
**Area**: frontend

### Summary
An aggregated CSS patch failed because one expected context line no longer matched the file.

### Error
```text
apply_patch verification failed: Failed to find expected lines in app/globals.css
```

### Context
- A multi-hunk patch targeted the exercise form and dark-theme rules at once.
- The component was being edited concurrently, so exact context needed to be re-read.

### Suggested Fix
Read the current rule block and apply smaller, independently anchored hunks.

### Metadata
- Reproducible: yes
- Related Files: app/globals.css

### Resolution
- **Resolved**: 2026-09-09T08:58:00+08:00
- **Notes**: Re-read the live CSS and split the changes into narrowly anchored patches.

---

## [ERR-20260907-005] github-api-rate-limit

**Logged**: 2026-09-07T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
GitHub 未认证 REST API 在完成初步搜索后触发共享 IP 限额。

### Error
```text
API rate limit exceeded
```

### Context
- 搜索结果和候选项目元数据已获取。
- 后续项目能力核对改用 raw.githubusercontent.com 的 README。

### Suggested Fix
下次大量调用时使用认证请求，或减少搜索次数。

### Metadata
- Reproducible: yes
- Related Files: none

### Resolution
- **Resolved**: 2026-09-07T00:00:00+08:00
- **Notes**: 通过项目 README 完成必要核对。

---

## [ERR-20260907-004] tavily-api-key-missing

**Logged**: 2026-09-07T00:00:00+08:00
**Priority**: low
**Status**: pending
**Area**: config

### Summary
Tavily 搜索脚本因本机未配置 API Key 无法运行。

### Error
```text
TAVILY_API_KEY environment variable not set
```

### Context
- 尝试查找 GitHub 上的 A 股行情开源项目。
- 改用 GitHub 官方搜索接口作为降级方案。

### Suggested Fix
在 Codex/OpenClaw 环境中配置 `TAVILY_API_KEY`。

### Metadata
- Reproducible: yes
- Related Files: F:/Codex/.codex/skills/tavily-search-pro/SKILL.md

---

## [ERR-20260907-003] tavily-script-path

**Logged**: 2026-09-07T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
Tavily skill 文档中的 `lib/tavily_search.py` 与本机实际安装路径不符。

### Error
```text
python: can't open file '.../tavily-search-pro/lib/tavily_search.py'
```

### Context
- 本机实际脚本位于 `tavily-search-pro/tavily_search.py`。

### Suggested Fix
调用前先定位实际脚本，或修正 skill 文档中的路径。

### Metadata
- Reproducible: yes
- Related Files: F:/Codex/.codex/skills/tavily-search-pro/SKILL.md

### Resolution
- **Resolved**: 2026-09-07T00:00:00+08:00
- **Notes**: 已定位并改用实际脚本路径。

---

## [ERR-20260907-002] local-dev-server-unavailable

**Logged**: 2026-09-07T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
本地 3000 端口没有运行开发服务器，无法通过 HTTP 做运行时页面检查。

### Error
```text
Invoke-WebRequest: 无法连接到远程服务器
```

### Context
- 构建检查已通过。
- 仅尝试访问 localhost:3000，未启动新的长期进程。

### Suggested Fix
需要运行 `npm run dev` 后再进行浏览器交互检查。

### Metadata
- Reproducible: yes
- Related Files: app/page.jsx

### Resolution
- **Resolved**: 2026-09-07T00:00:00+08:00
- **Notes**: 以生产构建成功作为本次验证结果；运行时交互未执行。

---

## [ERR-20260907-001] rtk-windows-command-resolution

**Logged**: 2026-09-07T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
RTK could not resolve Unix-style commands or PowerShell cmdlets as standalone executables on Windows.

### Error
```text
Binary 'ls' not found on PATH; Get-Content and grep were also not resolvable as executables.
```

### Context
- Commands were launched from PowerShell on Windows.
- A nested double-quoted PowerShell command also expanded `$_` before reaching the child process.

### Suggested Fix
Use `rtk proxy rg` for search and wrap PowerShell cmdlets in a single-quoted `powershell -NoProfile -Command` script.

### Metadata
- Reproducible: yes
- Related Files: .learnings/ERRORS.md
- See Also: ERR-20260906-001

### Resolution
- **Resolved**: 2026-09-07T00:00:00+08:00
- **Notes**: Switched to RTK-proxied executables and safe nested PowerShell quoting.

---

## [ERR-20260906-001] powershell-command-quoting

**Logged**: 2026-09-06T14:10:00+08:00
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
PowerShell variables were expanded by the outer shell in a nested double-quoted command.

### Error
```text
The nested command lost its variable name and started with `=`.
```

### Context
- A nested `powershell -Command` string used double quotes inside an existing PowerShell session.
- A later `rtk ls` call also failed because Unix `ls` was unavailable on this Windows PATH.

### Suggested Fix
Use a single-quoted nested PowerShell script or invoke native PowerShell commands directly with literal paths.

### Metadata
- Reproducible: yes
- Related Files: public/assets-icons

### Resolution
- **Resolved**: 2026-09-06T14:10:00+08:00
- **Notes**: Retried with explicit literal paths and verified the target files and removed directory.

---

## 2026-09-23 项目总结追加脚本

- 使用 PowerShell 包装 Node 单行脚本追加多行 Markdown 时，字符串定界符写法不兼容，导致 Node 语法错误；未修改目标文件。
- 后续改用持久化 Node REPL 读取并追加 UTF-8 文件，避免多层 shell 引号和转义冲突。

## [ERR-20261019-001] diagnosis-command-escaping

**Logged**: 2026-10-19T20:42:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
Windows RTK cannot execute Unix ls; nested double-quoted PowerShell expands $_ too early. A generated CJS fixture also converted escaped newlines inside string literals into real newlines.

### Resolution
Used RTK-proxied PowerShell with single-quoted command text and Node filesystem APIs; preserved string-literal escapes in the isolated fixture. Reproduction assertions then passed. No live watchlist writes occurred.

### Metadata
- See Also: ERR-20260907-001
- Related Files: .planning/slow-horses-diagnosis-20261019/reproduce.cjs
