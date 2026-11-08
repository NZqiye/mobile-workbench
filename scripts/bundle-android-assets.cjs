const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const publicRoot = path.join(root, 'public');

function bundledAssets() {
  const folders = ['crew', 'codex-pets/whale-girl', 'assets-icons/china-landmarks', 'icons',
    ...fs.readdirSync(path.join(publicRoot, 'assets-icons/thiings'), { withFileTypes: true })
      .filter(entry => entry.isDirectory()).map(entry => `assets-icons/thiings/${entry.name}`)];
  const groups = folders.map(folder => [folder, fs.readdirSync(path.join(publicRoot, folder)).filter(name => /\.(png|webp|svg|webm)$/i.test(name) || name === 'LICENSE').map(name => `${folder}/${name}`)]);
  groups.push(['avatar-cultivation.webp', ['avatar-cultivation.webp']]);
  const scopes = {}, files = {};
  for (const [scope, names] of groups.sort(([a], [b]) => a.localeCompare(b))) {
    const hash = crypto.createHash('sha256');
    for (const name of names.sort()) {
      const contents = fs.readFileSync(path.join(publicRoot, name));
      hash.update(name).update('\0').update(contents).update('\0');
      files[`/${name}`] = contents.length;
    }
    scopes[`/${scope}${names.length === 1 && scope === names[0] ? '' : '/'}`] = hash.digest('hex');
  }
  return { scopes, files };
}

function writeAssetVersions(manifest) {
  const target = path.join(root, 'lib/bundled-asset-versions.json');
  const contents = JSON.stringify(manifest.scopes, null, 2) + '\n';
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== contents) fs.writeFileSync(target, contents);
}

function copyBundledAssets(destination) {
  const manifest = bundledAssets();
  writeAssetVersions(manifest);
  for (const name of Object.keys(manifest.files)) {
    const target = path.join(destination, 'web', name.slice(1));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(publicRoot, name.slice(1)), target);
  }
  fs.writeFileSync(path.join(destination, 'bundled-assets.json'), JSON.stringify(manifest));
  console.log(`Bundled ${Object.keys(manifest.files).length} files (${(Object.values(manifest.files).reduce((sum, size) => sum + size, 0) / 1048576).toFixed(1)} MB).`);
}

if (require.main === module) writeAssetVersions(bundledAssets());
module.exports = { bundledAssets, writeAssetVersions, copyBundledAssets };
