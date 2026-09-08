const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronApi', {
  askAssistant: (prompt, history) => ipcRenderer.invoke('ai-assistant:respond', prompt, history),
  openPath: (targetPath) => ipcRenderer.invoke('shell:open-path', targetPath),
  writeExportFile: (relativePath, content) => ipcRenderer.invoke('file:write-export', relativePath, content)
});