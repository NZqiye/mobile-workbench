(() => {
  if (window.QiyeNative) return;
  let port, sequence = 0;
  const pending = new Map();
  function receive(message) {
    const data = JSON.parse(message.data);
    if (data.action === 'update-status') {
      window.QiyeNative.updateStatus = data.status;
      window.dispatchEvent(new CustomEvent('qiye-update-status', { detail: data.status }));
      return;
    }
    const task = pending.get(data.id);
    if (!task) return;
    if (data.started) { task.onStarted?.(); return; }
    pending.delete(data.id);
    if (data.error) {
      const error = new Error(data.error);
      error.name = data.name || 'Error';
      task.reject(error);
    } else task.resolve(data);
  }
  window.addEventListener('message', event => {
    if (event.data !== 'qiye-native-port' || !event.ports[0]) return;
    port?.close();
    for (const task of pending.values()) task.reject(new DOMException('手机连接已重置，请重试', 'AbortError'));
    pending.clear();
    port = event.ports[0];
    port.onmessage = receive;
    window.dispatchEvent(new Event('qiye-native-ready'));
  });
  const send = action => port?.postMessage(JSON.stringify({ action }));
  const request = (action, data = {}) => {
    if (!port) return Promise.reject(new Error('手机连接尚未就绪，请稍后重试'));
    return new Promise((resolve, reject) => {
      const id = String(++sequence);
      pending.set(id, { resolve, reject, action });
      port.postMessage(JSON.stringify({ id, action, ...data }));
    }).then(data => data.notifications);
  };
  window.QiyeNative = {
    version: '1.1.6',
    updateStatus: '',
    checkUpdates() {
      if (!port) return false;
      send('update-check');
      return true;
    },
    recordAudio(onStarted) {
      if (!port) return Promise.reject(new Error('手机录音尚未就绪，请稍后重试'));
      if ([...pending.values()].some(task => task.action === 'audio-start')) return Promise.reject(new Error('已有录音正在进行'));
      return new Promise((resolve, reject) => {
        const id = String(++sequence);
        pending.set(id, { resolve, reject, onStarted, action: 'audio-start' });
        port.postMessage(JSON.stringify({ id, action: 'audio-start' }));
      }).then(data => {
        const bytes = Uint8Array.from(atob(data.audio), char => char.charCodeAt(0));
        return new Blob([bytes], { type: 'audio/mp4' });
      });
    },
    stopRecording: () => send('audio-stop'),
    cancelRecording: () => send('audio-cancel'),
    openPermissions: () => send('permissions'),
    notificationState: () => request('notification-state'),
    enableNotifications: () => request('notification-enable'),
    disableNotifications: () => request('notification-disable'),
    syncReminders: tasks => request('notification-sync', { tasks }),
    syncWidgets: snapshot => { if (!port) return false; port.postMessage(JSON.stringify({ action: 'widgets-sync', snapshot })); return true; },
    testNotification: () => request('notification-test'),
    openNotificationSettings: () => send('notification-settings'),
    openExactAlarmSettings: () => send('notification-exact-settings'),
  };
  document.documentElement.classList.add('android-app');
  window.dispatchEvent(new Event('qiye-native-ready'));
})();
