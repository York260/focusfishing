const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('beast', {
  info: () => ipcRenderer.invoke('info'),
  onForeground: cb => ipcRenderer.on('fg', (_e, d) => cb(d)),
  saveArt: (id, dataUrl) => ipcRenderer.invoke('art:save', id, dataUrl),
  removeArt: id => ipcRenderer.invoke('art:remove', id),
  openArtDir: () => ipcRenderer.invoke('art:open'),
  setRunning: v => ipcRenderer.send('running', v),
  notify: (title, body) => ipcRenderer.send('notify', title, body)
});
