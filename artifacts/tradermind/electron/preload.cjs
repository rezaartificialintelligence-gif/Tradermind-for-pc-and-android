// Preload script — runs in renderer context with Node.js access
// Currently empty — extend here to expose safe APIs to renderer via contextBridge
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
});
