const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    openBacpacFile: () => ipcRenderer.invoke('dialog:openFile'),

    // Database Explorer Methods
    connectDb: (config) => ipcRenderer.invoke('db:connect', config),
    getTables: () => ipcRenderer.invoke('db:getTables'),
    queryTable: (tableName) => ipcRenderer.invoke('db:queryTable', tableName),
    disconnectDb: () => ipcRenderer.invoke('db:disconnect'),

    // Auth & License Methods
    saveLicense: (payload) => ipcRenderer.invoke('license:save', payload),
    readLicense: () => ipcRenderer.invoke('license:read'),

    // Job Runner Methods (For Step 4)
    runImport: (filePath, targetServer) => ipcRenderer.invoke('job:runImport', filePath, targetServer),
    onLog: (callback) => ipcRenderer.on('job:log', (event, log) => callback(log)),
    removeLogListener: () => ipcRenderer.removeAllListeners('job:log')
});
