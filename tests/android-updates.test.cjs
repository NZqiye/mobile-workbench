const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

test('manual update checks use the native channel and status messages do not finish a recording', async () => {
  const listeners = new Map(), sent = [], events = [];
  const port = { postMessage: value => sent.push(JSON.parse(value)), close() {} };
  class CustomEvent extends Event { constructor(type, options) { super(type); this.detail = options.detail; } }
  const context = vm.createContext({ Blob, Uint8Array, atob, DOMException, Event, CustomEvent,
    window: { addEventListener: (name, callback) => listeners.set(name, callback), dispatchEvent: event => events.push(event) },
    document: { documentElement: { classList: { add() {} } } },
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'android/assets/native-shell.js'), 'utf8'), context);
  const native = context.window.QiyeNative;
  assert.equal(native.checkUpdates(), false);
  listeners.get('message')({ data: 'qiye-native-port', ports: [port] });
  const audio = native.recordAudio();
  const id = sent[0].id;
  assert.equal(native.checkUpdates(), true);
  assert.equal(sent[1].action, 'update-check');
  port.onmessage({ data: JSON.stringify({ action: 'update-status', status: '已是最新版本' }) });
  assert.equal(native.updateStatus, '已是最新版本');
  assert.equal(events.at(-1).detail, '已是最新版本');
  port.onmessage({ data: JSON.stringify({ id, audio: Buffer.from('recording').toString('base64') }) });
  assert.equal(await (await audio).text(), 'recording');
});

const javaDir = process.env.JAVA_HOME || (process.platform === 'win32' ? 'C:/Program Files/ojdkbuild/java-17-openjdk-17.0.3.0.6-1' : '');
const javac = javaDir ? path.join(javaDir, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac') : 'javac';
const java = javaDir ? path.join(javaDir, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
test('real Java update validation rejects foreign URLs, HTTP, and altered installation files', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'qiye-update-test-'));
  const source = `package cc.qiyeonline.workbench;
import java.io.File;
import java.nio.file.Files;
public class UpdateSecurityCheck {
  static void check(boolean condition) { if (!condition) throw new AssertionError(); }
  public static void main(String[] args) throws Exception {
    String url="https://github.com/NZqiye/mobile-workbench/releases/download/android-v1.1.2/qiyeonline-1.1.2.apk";
    String hash="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    check(UpdateSecurity.validRelease("1.1.2",4,url,hash));
    check(!UpdateSecurity.validRelease("1.1.3",4,url,hash));
    check(!UpdateSecurity.validRelease("1.1.2",0,url,hash));
    check(!UpdateSecurity.validRelease("1.1.2",4,url.replace("NZqiye", "other"),hash));
    check(!UpdateSecurity.validRelease("1.1.2",4,url,"not-a-hash"));
    check(UpdateSecurity.trustedDownload("https://release-assets.githubusercontent.com/a?token=test"));
    check(!UpdateSecurity.trustedDownload("http://github.com/a"));
    check(!UpdateSecurity.trustedDownload("https://github.com.evil.example/a"));
    check(!UpdateSecurity.trustedDownload("https://user@github.com/a"));
    check(!UpdateSecurity.trustedDownload("https://github.com:444/a"));
    File file=new File(args[0],"sample.apk");
    Files.write(file.toPath(),"abc".getBytes("UTF-8"));
    check(UpdateSecurity.matchesHash(file,hash));
    Files.write(file.toPath(),"changed".getBytes("UTF-8"));
    check(!UpdateSecurity.matchesHash(file,hash));
  }
}`;
  try {
    fs.writeFileSync(path.join(folder, 'UpdateSecurityCheck.java'), source);
    execFileSync(javac, ['-encoding', 'UTF-8', '-d', folder, path.join(root, 'android/src/cc/qiyeonline/workbench/UpdateSecurity.java'), path.join(folder, 'UpdateSecurityCheck.java')]);
    execFileSync(java, ['-cp', folder, 'cc.qiyeonline.workbench.UpdateSecurityCheck', folder]);
  } finally {
    assert.ok(path.resolve(folder).startsWith(path.join(path.resolve(os.tmpdir()), 'qiye-update-test-')));
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
