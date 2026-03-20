const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const wrapped = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
}

contextBridge.exposeInMainWorld('quietmark', {
  files: {
    openDialog: () => ipcRenderer.invoke('quietmark:files:open-dialog'),
    openPath: (filePath) => ipcRenderer.invoke('quietmark:files:open-path', { path: filePath }),
    save: (payload) => ipcRenderer.invoke('quietmark:files:write', payload),
    saveAs: (payload) => ipcRenderer.invoke('quietmark:files:save-as', payload),
    exportHtml: (payload) => ipcRenderer.invoke('quietmark:files:export-html', payload),
    exportPdf: (payload) => ipcRenderer.invoke('quietmark:files:export-pdf', payload),
    reveal: (path) => ipcRenderer.invoke('quietmark:files:reveal', { path }),
    pickImage: (documentPath) => ipcRenderer.invoke('quietmark:files:pick-image', { documentPath }),
    resolveAssetPath: (documentPath, assetPath) =>
      ipcRenderer.invoke('quietmark:files:resolve-asset-path', { documentPath, assetPath }),
  },
  settings: {
    get: () => ipcRenderer.invoke('quietmark:settings:get'),
    update: (partial) => ipcRenderer.invoke('quietmark:settings:update', partial),
    reset: () => ipcRenderer.invoke('quietmark:settings:reset'),
  },
  ai: {
    chat: (payload) => ipcRenderer.invoke('quietmark:ai:chat', payload),
    validateProvider: (provider) => ipcRenderer.invoke('quietmark:ai:validate', provider),
    validateWebSearch: (config) => ipcRenderer.invoke('quietmark:ai:validate-web-search', config),
    getSessionStore: () => ipcRenderer.invoke('quietmark:ai:sessions:get'),
    saveSessionStore: (store) => ipcRenderer.invoke('quietmark:ai:sessions:save', store),
  },
  terminal: {
    start: (payload) => ipcRenderer.invoke('quietmark:terminal:start', payload),
    write: (sessionId, data) => ipcRenderer.invoke('quietmark:terminal:write', { sessionId, data }),
    resize: (sessionId, cols, rows) =>
      ipcRenderer.invoke('quietmark:terminal:resize', { sessionId, cols, rows }),
    stop: (sessionId) => ipcRenderer.invoke('quietmark:terminal:stop', { sessionId }),
    onData: (callback) => subscribe('quietmark:terminal:data', callback),
    onExit: (callback) => subscribe('quietmark:terminal:exit', callback),
  },
  app: {
    setTitle: (title) => ipcRenderer.send('quietmark:window:set-title', title),
    onCommand: (callback) => subscribe('quietmark:command', callback),
    onFilesOpened: (callback) => subscribe('quietmark:files-opened', callback),
    consumePendingFilesOpened: () => ipcRenderer.invoke('quietmark:files:consume-pending-opened'),
  },
});
