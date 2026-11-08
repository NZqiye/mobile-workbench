const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { bundledAssets } = require('../scripts/bundle-android-assets.cjs');

const root = path.resolve(__dirname, '..');
const versions = JSON.parse(fs.readFileSync(path.join(root, 'lib/bundled-asset-versions.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'lib/bundled-assets.js'), 'utf8').replace(/^import .*$/gm, '').replace('export function', 'function');
const context = vm.createContext({ versions, URLSearchParams });
vm.runInContext(source, context);

test('every bundled resource has a stable version and website versions match the package source', () => {
  const manifest = bundledAssets();
  assert.deepEqual(manifest.scopes, versions);
  for (const file of Object.keys(manifest.files)) {
    const url = new URL(context.bundledAssetUrl(file), 'https://qiyeonline.cc.cd');
    assert.equal(url.pathname, file);
    assert.match(url.searchParams.get('bundle'), /^[a-f0-9]{64}$/);
  }
  for (const file of ['/crew/kuma-transparent.png', '/codex-pets/whale-girl/snack.webm', '/codex-pets/whale-girl/LICENSE', '/assets-icons/thiings/leisure/puzzle-cube.webp', '/assets-icons/china-landmarks/cn-west-lake.svg']) assert.ok(manifest.files[file] > 0);
});

test('versioned resource URLs preserve other parameters, leave APIs and outside images alone, and are idempotent', () => {
  const first = context.bundledAssetUrl('/crew/luffy.png?size=40#preview');
  assert.equal(new URL(first, 'https://qiyeonline.cc.cd').searchParams.get('size'), '40');
  assert.ok(first.endsWith('#preview'));
  assert.equal(context.bundledAssetUrl(first), first);
  for (const value of ['', undefined, '/api/media-artwork?id=42', 'https://image.tmdb.org/poster.jpg', '//example.com/crew/luffy.png', 'data:image/png;base64,AA', '/unknown.png']) assert.equal(context.bundledAssetUrl(value), value);
});

test('real Java policy serves only trusted versioned resources and validates video byte ranges', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'qiye-bundled-test-'));
  const javaHome = process.env.JAVA_HOME || 'C:/Program Files/ojdkbuild/java-17-openjdk-17.0.3.0.6-1';
  const code = `package cc.qiyeonline.workbench;
import java.util.Arrays;
public class BundledAssetCheck {
  static void check(boolean value) { if (!value) throw new AssertionError(); }
  static void range(String value, long length, long start, long end) { check(Arrays.equals(BundledAssetPolicy.range(value,length),new long[]{start,end})); }
  public static void main(String[] args) {
    String version="${versions['/crew/']}";
    String url="https://qiyeonline.cc.cd/crew/luffy.png?bundle="+version;
    check("/crew/luffy.png".equals(BundledAssetPolicy.path(url)));
    check(version.equals(BundledAssetPolicy.version(url)));
    check(BundledAssetPolicy.path(url.replace("https:","http:"))==null);
    check(BundledAssetPolicy.path(url.replace("qiyeonline.cc.cd","qiyeonline.cc.cd.evil.example"))==null);
    check(BundledAssetPolicy.path(url.replace("qiyeonline.cc.cd","user@qiyeonline.cc.cd"))==null);
    check(BundledAssetPolicy.path(url.replace("/crew/","/../crew/"))==null);
    check(BundledAssetPolicy.path(url.replace("/crew/","/%2e%2e/crew/"))==null);
    check(BundledAssetPolicy.path(url.replace("/crew/","//crew/"))==null);
    check(BundledAssetPolicy.version(url+"&bundle="+version)==null);
    check(BundledAssetPolicy.version(url.replace(version,"wrong"))==null);
    range(null,100,0,99); range("bytes=0-",100,0,99); range("bytes=10-19",100,10,19);
    range("bytes=10-500",100,10,99); range("bytes=-20",100,80,99); range("bytes=-500",100,0,99);
    for(String invalid:new String[]{"bytes=100-","bytes=20-10","bytes=0-1,4-5","bytes=-0","bytes=","bytes=999999999999999999999-"}) check(BundledAssetPolicy.range(invalid,100)==null);
  }
}`;
  try {
    fs.writeFileSync(path.join(folder, 'BundledAssetCheck.java'), code);
    execFileSync(path.join(javaHome, 'bin/javac.exe'), ['-encoding', 'UTF-8', '-d', folder, path.join(root, 'android/src/cc/qiyeonline/workbench/BundledAssetPolicy.java'), path.join(folder, 'BundledAssetCheck.java')]);
    execFileSync(path.join(javaHome, 'bin/java.exe'), ['-cp', folder, 'cc.qiyeonline.workbench.BundledAssetCheck']);
  } finally {
    assert.ok(path.resolve(folder).startsWith(path.join(path.resolve(os.tmpdir()), 'qiye-bundled-test-')));
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
