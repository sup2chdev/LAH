/** Narrow bridge; the renderer never receives Node or arbitrary IPC access. */
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('lah', {
  getState: () => ipcRenderer.invoke('lah:state'),
  saveSettings: settings => ipcRenderer.invoke('lah:settings', settings),
  chooseWorkspace: () => ipcRenderer.invoke('lah:workspace'),
  discoverModels: endpoint => ipcRenderer.invoke('lah:models', endpoint),
  send: input => ipcRenderer.invoke('lah:send', input),
  newSession: () => ipcRenderer.invoke('lah:new-session'),
  stop: () => ipcRenderer.invoke('lah:stop'),
  onEvent: callback => {
    const listener = (_event, value) => callback(value)
    ipcRenderer.on('lah:event', listener)
    return () => ipcRenderer.removeListener('lah:event', listener)
  },
})
