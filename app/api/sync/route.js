import { isAuthorized, isSameOrigin, readJson, unauthorizedResponse } from "../../../lib/access-auth";
import { nowText, syncBodyLimit, syncConfig } from "../../../lib/sync-server";

function unconfigured() {
  return Response.json({ error: "云同步尚未配置服务端密钥" }, { status: 503 });
}

export async function GET(request) {
  if (!isAuthorized(request)) return unauthorizedResponse();
  const config = syncConfig();
  if (!config) return unconfigured();

  const { data, error } = await config.supabase
    .from("workbench_records")
    .select("title,note,created_at")
    .eq("page", config.page)
    .like("title", `${config.userId}:%`)
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const latest = new Map();
  for (const row of data || []) {
    const name = String(row.title).slice(config.userId.length + 1);
    if (name && !latest.has(name)) latest.set(name, row.note);
  }
  const items = {};
  for (const [name, note] of latest) {
    try {
      items[name] = JSON.parse(note);
    } catch {
      items[name] = note;
    }
  }
  return Response.json({ items });
}

export async function POST(request) {
  if (!isSameOrigin(request)) return Response.json({ error: "来源不受信任" }, { status: 403 });
  if (!isAuthorized(request)) return unauthorizedResponse();
  const config = syncConfig();
  if (!config) return unconfigured();

  let body;
  try {
    body = await readJson(request, syncBodyLimit);
  } catch (error) {
    return Response.json({ error: error.message || "请求格式无效" }, { status: 400 });
  }

  const name = body?.name;
  if (typeof name !== "string" || !name || name.length > 64) {
    return Response.json({ error: "数据项名称无效" }, { status: 400 });
  }

  const title = `${config.userId}:${name}`;
  const { data, error } = await config.supabase
    .from("workbench_records")
    .insert({ page: config.page, title, meta: nowText(), note: JSON.stringify(body?.value ?? null) })
    .select("id");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const newId = data?.[0]?.id;
  if (newId) {
    const { error: deleteError } = await config.supabase
      .from("workbench_records")
      .delete()
      .eq("page", config.page)
      .eq("title", title)
      .neq("id", newId);
    if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
