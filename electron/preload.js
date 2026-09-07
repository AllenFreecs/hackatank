const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronApi', {
  askAssistant: (prompt) => ipcRenderer.invoke('ai-assistant:respond', prompt)
});