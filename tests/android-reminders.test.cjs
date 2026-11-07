const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

test('task reminders use Beijing time and remove completed, deleted and invalid tasks', async () => {
  const { nativeReminderTasks } = await import('../lib/native-reminders.js');
  const plans = [
    { id: 'a', title: 'Task', status: '未完成', reminderAt: '2026-11-07T10:30', reminderSentAt: 99 },
    { id: 'b', title: 'Done', status: '已完成', reminderAt: '2026-11-07T10:30' },
    { id: 'c', title: 'No reminder' },
    { id: 'd', title: 'Invalid', reminderAt: 'invalid' },
    { id: 'e', title: 'UTC', reminderAt: '2026-11-07T02:30:00Z' },
  ];
  assert.deepEqual(nativeReminderTasks(plans), [
    { id: 'a', title: 'Task', at: Date.parse('2026-11-07T02:30:00Z') },
    { id: 'e', title: 'UTC', at: Date.parse('2026-11-07T02:30:00Z') },
  ]);
  assert.deepEqual(nativeReminderTasks([]), []);
  assert.deepEqual(nativeReminderTasks([{ ...plans[0], status: '已完成' }]), []);
  assert.equal(nativeReminderTasks([{ ...plans[0], reminderAt: '2026-11-07T11:30' }])[0].at, Date.parse('2026-11-07T03:30Z'));
});

function bridge() {
  const listeners = new Map(), sent = [];
  const port = { postMessage: message => sent.push(JSON.parse(message)), close() {} };
  const context = vm.createContext({ Blob, Uint8Array, atob, DOMException, Event,
    window: { addEventListener: (name, callback) => listeners.set(name, callback), dispatchEvent() {} },
    document: { documentElement: { classList: { add() {} } } },
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'android/assets/native-shell.js'), 'utf8'), context);
  const connect = () => listeners.get('message')({ data: 'qiye-native-port', ports: [port] });
  const receive = data => port.onmessage({ data: JSON.stringify(data) });
  return { native: context.window.QiyeNative, sent, connect, receive };
}

test('notification requests resolve independently while a recording is active', async () => {
  const h = bridge(); h.connect();
  const state = h.native.notificationState();
  const audio = h.native.recordAudio();
  const sync = h.native.syncReminders([{ id: 'a', title: 'Task', at: 123 }]);
  assert.deepEqual(h.sent.map(item => item.action), ['notification-state', 'audio-start', 'notification-sync']);
  h.receive({ id: h.sent[2].id, notifications: { pending: 1 } });
  assert.equal((await sync).pending, 1);
  h.receive({ id: h.sent[0].id, notifications: { enabled: false, permitted: true } });
  assert.equal((await state).enabled, false);
  h.receive({ id: h.sent[1].id, audio: Buffer.from('aac').toString('base64') });
  assert.equal(await (await audio).text(), 'aac');
});

test('notification denial, test errors and channel reset remain recoverable', async () => {
  const h = bridge();
  await assert.rejects(h.native.notificationState(), /尚未就绪/);
  h.connect();
  const enable = h.native.enableNotifications();
  h.receive({ id: h.sent[0].id, notifications: { enabled: false, permitted: false } });
  assert.equal((await enable).permitted, false);
  const retry = h.native.testNotification();
  h.receive({ id: h.sent[1].id, error: 'Permission denied', name: 'NotAllowedError' });
  await assert.rejects(retry, { name: 'NotAllowedError' });
  h.native.openNotificationSettings(); h.native.openExactAlarmSettings();
  assert.deepEqual(h.sent.slice(-2).map(item => item.action), ['notification-settings', 'notification-exact-settings']);
  const disable = h.native.disableNotifications(); h.connect();
  await assert.rejects(disable, { name: 'AbortError' });
});

test('real Java reminder policy handles duplicate delivery, rescheduling and missed reminders', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'qiye-reminder-test-'));
  const javaDir = process.env.JAVA_HOME || 'C:/Program Files/ojdkbuild/java-17-openjdk-17.0.3.0.6-1';
  const source = `package cc.qiyeonline.workbench;
public class ReminderPolicyCheck {
  static void check(boolean value) { if (!value) throw new AssertionError(); }
  public static void main(String[] args) {
    long now=1000000000L;
    check(ReminderPolicy.due(now,0,now));
    check(!ReminderPolicy.due(now,now,now));
    check(!ReminderPolicy.pending(now,now,now));
    check(ReminderPolicy.pending(now+60000,now,now));
    check(!ReminderPolicy.due(now+60000,now,now));
    check(ReminderPolicy.due(now-3600000,0,now));
    check(!ReminderPolicy.pending(now-86400001,0,now));
    check(!ReminderPolicy.pending(0,0,now));
  }
}`;
  try {
    fs.writeFileSync(path.join(folder, 'ReminderPolicyCheck.java'), source);
    execFileSync(path.join(javaDir, 'bin/javac.exe'), ['-encoding', 'UTF-8', '-d', folder, path.join(root, 'android/src/cc/qiyeonline/workbench/ReminderPolicy.java'), path.join(folder, 'ReminderPolicyCheck.java')]);
    execFileSync(path.join(javaDir, 'bin/java.exe'), ['-cp', folder, 'cc.qiyeonline.workbench.ReminderPolicyCheck']);
  } finally {
    assert.ok(path.resolve(folder).startsWith(path.join(path.resolve(os.tmpdir()), 'qiye-reminder-test-')));
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
