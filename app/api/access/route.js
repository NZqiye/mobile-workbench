export async function POST(request) {
  const { code } = await request.json();
  const expectedCode = process.env.WORKBENCH_ACCESS_CODE;

  if (!expectedCode) {
    return Response.json({ error: "尚未配置固定访问码" }, { status: 500 });
  }

  if (String(code || "") !== expectedCode) {
    return Response.json({ error: "访问码不正确" }, { status: 401 });
  }

  return Response.json({ ok: true });
}
