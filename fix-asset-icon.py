import re

file_path = r"F:\Codex\个人知识库\01-Projects（当前项目）\手机端个人工作台\mobile-workbench-main\app\page.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Find the AssetIcon function using a more specific pattern
# Match from "function AssetIcon" to the closing brace before "const assetIconCategories"
marker_start = "function AssetIcon({ name, size = 20 }) {"
marker_end = "const assetIconCategories"

idx_start = content.find(marker_start)
idx_end = content.find(marker_end)

if idx_start == -1 or idx_end == -1:
    print(f"Markers not found: start={idx_start}, end={idx_end}")
    exit(1)

old_block = content[idx_start:idx_end].rstrip()

new_block = """function AssetIcon({ name, size = 20 }) {
  const [err, setErr] = React.useState(false);
  const src = thiingsIconByKey[name] || assetIconImageMap[name];
  if (!src || err) {
    return (
      <span className="asset-icon-fallback" style={{ width: size, height: size, fontSize: Math.max(12, Math.floor(size * 0.55)) }}>
        {String(name || "?").slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img className="asset-icon-img" src={src} width={size} height={size} alt="" loading="eager" decoding="async" onError={() => setErr(true)} />;
}

"""

content = content[:idx_start] + new_block + content[idx_end:]
with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("AssetIcon replaced successfully")
print(f"Old block length: {len(old_block)}")
print(f"New block length: {len(new_block)}")