const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronApi', {
  askAssistant: (prompt, history) => ipcRenderer.invoke('ai-assistant:respond', prompt, history)
});