function parseJson(text) {
  const clean = String(text || "").replace(/```json|```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : clean);
}

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "本地缺少 OPENAI_API_KEY，请先在环境变量里配置。" }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("image");
  if (!file || typeof file.arrayBuffer !== "function") {
    return Response.json({ error: "请上传一张食物图片。" }, { status: 400 });
  }
  if (!String(file.type || "").startsWith("image/")) {
    return Response.json({ error: "只支持图片文件。" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > 5 * 1024 * 1024) {
    return Response.json({ error: "图片不能超过 5MB。" }, { status: 400 });
  }

  const imageUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "请识别图片中的食物，并估算总热量。只返回 JSON，不要 Markdown。格式：{\"title\":\"食物简述\",\"calories\":数字,\"foods\":[{\"name\":\"食物\",\"portion\":\"估算份量\",\"calories\":数字}],\"confidence\":\"高/中/低\",\"note\":\"一句中文说明\"}。热量用 kcal，保守估算即可。",
              },
              {
                type: "input_image",
                image_url: imageUrl,
                detail: "low",
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "图片识别失败");
    const result = parseJson(data.output_text);

    return Response.json({
      title: String(result.title || "图片识别饮食"),
      calories: Math.max(0, Math.round(Number(result.calories || 0))),
      foods: Array.isArray(result.foods) ? result.foods : [],
      confidence: result.confidence || "中",
      note: result.note || "图片识别仅为估算，请按实际份量修正。",
    });
  } catch (error) {
    return Response.json({ error: error.message || "图片识别暂时不可用" }, { status: 500 });
  }
}
