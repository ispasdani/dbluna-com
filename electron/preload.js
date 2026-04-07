const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    openBacpacFile: () => ipcRenderer.invoke('dialog:openFile'),
    saveBacpacFile: (defaultName) => ipcRenderer.invoke('dialog:saveFile', defaultName),
    saveFile: (defaultName, filters) => ipcRenderer.invoke('dialog:saveFile', defaultName, filters),
    writeTextData: (filePath, textData) => ipcRenderer.invoke('file:writeTextData', filePath, textData),

    // Database Explorer Methods
    connectDb: (config) => ipcRenderer.invoke('db:connect', config),
    getDatabases: () => ipcRenderer.invoke('db:getDatabases'),
    getTables: (dbName) => ipcRenderer.invoke('db:getTables', dbName),
    getViews: (dbName) => ipcRenderer.invoke('db:getViews', dbName),
    getStoredProcedures: (dbName) => ipcRenderer.invoke('db:getStoredProcedures', dbName),
    queryTable: (dbName, tableName) => ipcRenderer.invoke('db:queryTable', dbName, tableName),
    getTableSchema: (dbName, schemaName, tableName) => ipcRenderer.invoke('db:getTableSchema', dbName, schemaName, tableName),
    getObjectDefinition: (dbName, schemaName, objectName) => ipcRenderer.invoke('db:getObjectDefinition', dbName, schemaName, objectName),
    getSchemaDictionary: (dbName) => ipcRenderer.invoke('db:getSchemaDictionary', dbName),
    getERDData: (dbName) => ipcRenderer.invoke('db:getERDData', dbName),
    executeQuery: (dbName, queryStr) => ipcRenderer.invoke('db:executeQuery', dbName, queryStr),
    disconnectDb: () => ipcRenderer.invoke('db:disconnect'),

    // Auth & License Methods
    saveLicense: (payload) => ipcRenderer.invoke('license:save', payload),
    readLicense: () => ipcRenderer.invoke('license:read'),

    // Job Runner Methods (For Step 4)
    runImport: (filePath, targetServer, targetDb) => ipcRenderer.invoke('job:runImport', filePath, targetServer, targetDb),
    runExport: (sourceServer, sourceDb, targetFile) => ipcRenderer.invoke('job:runExport', sourceServer, sourceDb, targetFile),
    onLog: (callback) => ipcRenderer.on('job:log', (event, log) => callback(log)),
    removeLogListener: () => ipcRenderer.removeAllListeners('job:log'),

    // Diagram Methods
    listDiagrams: () => ipcRenderer.invoke('diagram:list'),
    loadDiagram: (id) => ipcRenderer.invoke('diagram:load', id),
    saveDiagram: (payload) => ipcRenderer.invoke('diagram:save', payload),
    deleteDiagram: (id) => ipcRenderer.invoke('diagram:delete', id)
});
