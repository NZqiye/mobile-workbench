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
    for (const task of pending.values()) task.reject(new DOMException('录音连接已重置，请重试', 'AbortError'));
    pending.clear();
    port = event.ports[0];
    port.onmessage = receive;
    window.dispatchEvent(new Event('qiye-native-ready'));
  });
  const send = action => port?.postMessage(JSON.stringify({ action }));
  window.QiyeNative = {
    version: '1.1.2',
    updateStatus: '',
    checkUpdates() {
      if (!port) return false;
      send('update-check');
      return true;
    },
    recordAudio(onStarted) {
      if (!port) return Promise.reject(new Error('手机录音尚未就绪，请稍后重试'));
      if (pending.size) return Promise.reject(new Error('已有录音正在进行'));
      return new Promise((resolve, reject) => {
        const id = String(++sequence);
        pending.set(id, { resolve, reject, onStarted });
        port.postMessage(JSON.stringify({ id, action: 'audio-start' }));
      }).then(data => {
        const bytes = Uint8Array.from(atob(data.audio), char => char.charCodeAt(0));
        return new Blob([bytes], { type: 'audio/mp4' });
      });
    },
    stopRecording: () => send('audio-stop'),
    cancelRecording: () => send('audio-cancel'),
    openPermissions: () => send('permissions'),
  };
  document.documentElement.classList.add('android-app');
  window.dispatchEvent(new Event('qiye-native-ready'));
})();
