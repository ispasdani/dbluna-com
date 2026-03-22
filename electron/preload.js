const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    openBacpacFile: () => ipcRenderer.invoke('dialog:openFile'),

    // Database Explorer Methods
    connectDb: (config) => ipcRenderer.invoke('db:connect', config),
    getDatabases: () => ipcRenderer.invoke('db:getDatabases'),
    getTables: (dbName) => ipcRenderer.invoke('db:getTables', dbName),
    getViews: (dbName) => ipcRenderer.invoke('db:getViews', dbName),
    getStoredProcedures: (dbName) => ipcRenderer.invoke('db:getStoredProcedures', dbName),
    queryTable: (dbName, tableName) => ipcRenderer.invoke('db:queryTable', dbName, tableName),
    disconnectDb: () => ipcRenderer.invoke('db:disconnect'),

    // Auth & License Methods
    saveLicense: (payload) => ipcRenderer.invoke('license:save', payload),
    readLicense: () => ipcRenderer.invoke('license:read'),

    // Job Runner Methods (For Step 4)
    runImport: (filePath, targetServer) => ipcRenderer.invoke('job:runImport', filePath, targetServer),
    onLog: (callback) => ipcRenderer.on('job:log', (event, log) => callback(log)),
    removeLogListener: () => ipcRenderer.removeAllListeners('job:log')
});
