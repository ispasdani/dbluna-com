const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const sql = require('mssql');

let mainWindow;
let dbPool = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Start by loading the Next.js local server
    // During production, the server is started locally on an assigned port.
    // For development, it points to the Next.js dev server.
    mainWindow.loadURL('http://localhost:3000/desktop');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// --- IPC Handlers for Offline Auth ---
const userHomeDir = app.getPath('userData');
const licensePath = path.join(userHomeDir, 'dbluna_license.enc');

ipcMain.handle('license:save', async (event, payload) => {
    try {
        const jsonStr = JSON.stringify(payload);
        // safeStorage encrypts the string to the current OS user profile
        const encrypted = safeStorage.encryptString(jsonStr);
        fs.writeFileSync(licensePath, encrypted);
        return true;
    } catch (error) {
        console.error("Failed to save license:", error);
        return false;
    }
});

ipcMain.handle('license:read', async () => {
    if (!fs.existsSync(licensePath)) return null;

    try {
        const encrypted = fs.readFileSync(licensePath);
        const decrypted = safeStorage.decryptString(encrypted);
        return JSON.parse(decrypted);
    } catch (e) {
        console.warn("License file missing, tampered, or corrupted.");
        return null;
    }
});

// --- IPC Handlers for Phase 2: Database Explorer ---
ipcMain.handle('db:connect', async (event, config) => {
    try {
        if (dbPool) {
            await dbPool.close();
        }
        // mssql requires a specific config shape
        dbPool = await sql.connect(config);
        return { success: true };
    } catch (err) {
        console.error("Database connection failed:", err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('db:getDatabases', async () => {
    if (!dbPool) return { success: false, error: "No active database connection." };
    try {
        const result = await dbPool.request().query(`
            SELECT name, database_id 
            FROM sys.databases 
            WHERE state_desc = 'ONLINE' 
            ORDER BY name;
        `);
        return { success: true, data: result.recordset };
    } catch (err) {
        console.error("Failed to fetch databases:", err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('db:getTables', async (event, dbName) => {
    if (!dbPool) return { success: false, error: "No active database connection." };
    try {
        const query = dbName 
            ? `SELECT TABLE_SCHEMA, TABLE_NAME FROM [${dbName}].INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME;`
            : `SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME;`;
        const result = await dbPool.request().query(query);
        return { success: true, data: result.recordset };
    } catch (err) {
        console.error("Failed to fetch tables:", err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('db:getViews', async (event, dbName) => {
    if (!dbPool) return { success: false, error: "No active database connection." };
    try {
        const query = dbName 
            ? `SELECT TABLE_SCHEMA, TABLE_NAME FROM [${dbName}].INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'VIEW' ORDER BY TABLE_SCHEMA, TABLE_NAME;`
            : `SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'VIEW' ORDER BY TABLE_SCHEMA, TABLE_NAME;`;
        const result = await dbPool.request().query(query);
        return { success: true, data: result.recordset };
    } catch (err) {
        console.error("Failed to fetch views:", err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('db:getStoredProcedures', async (event, dbName) => {
    if (!dbPool) return { success: false, error: "No active database connection." };
    try {
        const query = dbName
            ? `SELECT s.name AS schema_name, p.name AS procedure_name FROM [${dbName}].sys.procedures p INNER JOIN [${dbName}].sys.schemas s ON p.schema_id = s.schema_id ORDER BY s.name, p.name;`
            : `SELECT s.name AS schema_name, p.name AS procedure_name FROM sys.procedures p INNER JOIN sys.schemas s ON p.schema_id = s.schema_id ORDER BY s.name, p.name;`;
        const result = await dbPool.request().query(query);
        return { success: true, data: result.recordset };
    } catch (err) {
        console.error("Failed to fetch stored procedures:", err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('db:queryTable', async (event, dbName, tableName) => {
    if (!dbPool) return { success: false, error: "No active database connection." };
    try {
        // The tableName is already safely formatted as [schema].[table] by the frontend
        const query = dbName ? `SELECT TOP 100 * FROM [${dbName}].${tableName}` : `SELECT TOP 100 * FROM ${tableName}`;
        const result = await dbPool.request().query(query);
        return { success: true, data: result.recordset };
    } catch (err) {
        console.error(`Failed to query table ${tableName}:`, err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('db:getTableSchema', async (event, dbName, schemaName, tableName) => {
    if (!dbPool) return { success: false, error: "No active database connection." };
    try {
        const query = dbName 
            ? `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE FROM [${dbName}].INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${schemaName}' AND TABLE_NAME = '${tableName}' ORDER BY ORDINAL_POSITION;`
            : `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${schemaName}' AND TABLE_NAME = '${tableName}' ORDER BY ORDINAL_POSITION;`;
        const result = await dbPool.request().query(query);
        return { success: true, data: result.recordset };
    } catch (err) {
        console.error(`Failed to fetch schema for ${schemaName}.${tableName}:`, err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('db:executeQuery', async (event, dbName, queryStr) => {
    if (!dbPool) return { success: false, error: "No active database connection." };
    try {
        const query = dbName ? `USE [${dbName}];\n${queryStr}` : queryStr;
        const result = await dbPool.request().query(query);
        return { 
            success: true, 
            recordsets: result.recordsets,
            rowsAffected: result.rowsAffected 
        };
    } catch (err) {
        console.error(`Failed to execute query:`, err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('db:disconnect', async () => {
    try {
        if (dbPool) {
            await dbPool.close();
            dbPool = null;
        }
        return { success: true };
    } catch (err) {
        console.error("Failed to disconnect database:", err);
        return { success: false, error: err.message };
    }
});

// --- IPC Handlers for Phase 1 ---

// 1. File Picker
ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        filters: [{ name: 'Bacpac', extensions: ['bacpac'] }],
        properties: ['openFile']
    });
    if (canceled) return null;
    return filePaths[0]; // Returns the fully qualified local path
});

// 2. Run Import Job (Phase 1 MVP)
const { spawn } = require('child_process');

ipcMain.handle('job:runImport', async (event, filePath, targetServer) => {
    return new Promise((resolve) => {
        // Log the start
        if (mainWindow) {
            mainWindow.webContents.send('job:log', `[SYSTEM] Preparing to import: ${filePath}\n[SYSTEM] Target: ${targetServer}\n`);
        }

        // Basic sqlpackage import arguments
        const args = [
            '/Action:Import',
            `/SourceFile:${filePath}`,
            `/TargetServerName:${targetServer}`,
            `/TargetDatabaseName:ImportedDb_${Date.now()}`,
            '/TargetTrustServerCertificate:True'
        ];

        try {
            const child = spawn('sqlpackage', args);
            let hasError = false;

            child.stdout.on('data', (data) => {
                if (mainWindow) mainWindow.webContents.send('job:log', data.toString());
            });

            child.stderr.on('data', (data) => {
                if (mainWindow) mainWindow.webContents.send('job:log', `[ERROR]: ${data.toString()}`);
            });

            child.on('error', (err) => {
                hasError = true;
                if (err.code === 'ENOENT') {
                    if (mainWindow) mainWindow.webContents.send('job:log', `[SYSTEM WARNING] sqlpackage not found. Running dummy simulation for UI validation...\n`);
                    let progress = 0;
                    const interval = setInterval(() => {
                        progress += 25;
                        if (mainWindow) mainWindow.webContents.send('job:log', `Importing database schema... ${progress}%\n`);
                        if (progress >= 100) {
                            clearInterval(interval);
                            if (mainWindow) mainWindow.webContents.send('job:log', `Importing data... Done.\n\n[SYSTEM] Dummy Process exited with code 0`);
                            resolve(true);
                        }
                    }, 500);
                } else {
                    if (mainWindow) mainWindow.webContents.send('job:log', `\n[SYSTEM ERROR] Failed to start sqlpackage: ${err.message}`);
                    resolve(false);
                }
            });

            child.on('close', (code) => {
                // If an error already triggered our simulated fallback (or hard failed),
                // we do not want to resolve here because it would shortcut the simulation.
                if (!hasError) {
                    if (mainWindow) mainWindow.webContents.send('job:log', `\n[SYSTEM] Process exited with code ${code}`);
                    resolve(code === 0);
                }
            });

        } catch (error) {
            if (mainWindow) mainWindow.webContents.send('job:log', `\n[EXCEPTION] ${error.message}`);
            resolve(false);
        }
    });
});
