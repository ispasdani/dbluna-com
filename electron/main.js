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

ipcMain.handle('db:getObjectDefinition', async (event, dbName, schemaName, objectName) => {
    if (!dbPool) return { success: false, error: "No active database connection." };
    try {
        const query = dbName
            ? `USE [${dbName}]; SELECT OBJECT_DEFINITION(OBJECT_ID('[${schemaName}].[${objectName}]')) AS definition;`
            : `SELECT OBJECT_DEFINITION(OBJECT_ID('[${schemaName}].[${objectName}]')) AS definition;`;
        const result = await dbPool.request().query(query);
        return { success: true, data: result.recordset[0]?.definition || null };
    } catch (err) {
        console.error(`Failed to fetch definition for ${schemaName}.${objectName}:`, err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('db:getSchemaDictionary', async (event, dbName) => {
    if (!dbPool) return { success: false, error: "No active database connection." };
    try {
        const query = dbName
            ? `
                SELECT
                    t.TABLE_SCHEMA AS schema_name,
                    t.TABLE_NAME AS table_name,
                    c.COLUMN_NAME AS column_name
                FROM [${dbName}].INFORMATION_SCHEMA.TABLES t
                JOIN [${dbName}].INFORMATION_SCHEMA.COLUMNS c 
                    ON t.TABLE_CATALOG = c.TABLE_CATALOG
                    AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
                    AND t.TABLE_NAME = c.TABLE_NAME
                WHERE t.TABLE_TYPE = 'BASE TABLE' OR t.TABLE_TYPE = 'VIEW'
            `
            : `
                SELECT
                    t.TABLE_SCHEMA AS schema_name,
                    t.TABLE_NAME AS table_name,
                    c.COLUMN_NAME AS column_name
                FROM INFORMATION_SCHEMA.TABLES t
                JOIN INFORMATION_SCHEMA.COLUMNS c 
                    ON t.TABLE_CATALOG = c.TABLE_CATALOG
                    AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
                    AND t.TABLE_NAME = c.TABLE_NAME
                WHERE t.TABLE_TYPE = 'BASE TABLE' OR t.TABLE_TYPE = 'VIEW'
            `;
        const result = await dbPool.request().query(query);
        return { success: true, data: result.recordset };
    } catch (err) {
        console.error("Failed to fetch schema dictionary:", err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('db:getERDData', async (event, dbName) => {
    if (!dbPool) return { success: false, error: "No active database connection." };
    try {
        const useStmt = dbName ? `USE [${dbName}]; ` : '';
        
        // 1. Get Tables & Columns
        const columnsQuery = useStmt + `
            SELECT 
                s.name AS schema_name,
                t.name AS table_name,
                c.name AS column_name,
                ty.name AS data_type,
                c.is_nullable,
                CAST(ISNULL(ic.index_id, 0) AS BIT) AS is_pk,
                c.is_identity AS is_auto_increment
            FROM sys.tables t
            JOIN sys.schemas s ON t.schema_id = s.schema_id
            JOIN sys.columns c ON t.object_id = c.object_id
            JOIN sys.types ty ON c.user_type_id = ty.user_type_id
            LEFT JOIN sys.index_columns ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id AND ic.index_id = 1
        `;
        
        // 2. Get Foreign Key Relationships
        const relationshipsQuery = useStmt + `
            SELECT 
                fk.name AS fk_name,
                OBJECT_SCHEMA_NAME(fk.parent_object_id) AS source_schema,
                tp.name AS source_table,
                cp.name AS source_column,
                OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS target_schema,
                tr.name AS target_table,
                cr.name AS target_column
            FROM sys.foreign_keys fk
            JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
            JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
            JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
            JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
        `;

        const columnsResult = await dbPool.request().query(columnsQuery);
        const relationshipsResult = await dbPool.request().query(relationshipsQuery);

        return { 
            success: true, 
            data: {
                columns: columnsResult.recordset,
                relationships: relationshipsResult.recordset
            } 
        };
    } catch (err) {
        console.error("Failed to fetch ERD data:", err);
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

// --- IPC Handlers for Diagrams ---
const diagramsDir = path.join(userHomeDir, 'diagrams');
if (!fs.existsSync(diagramsDir)) {
    fs.mkdirSync(diagramsDir, { recursive: true });
}

ipcMain.handle('diagram:list', async () => {
    try {
        const files = fs.readdirSync(diagramsDir).filter(f => f.endsWith('.dbld'));
        const diagrams = files.map(file => {
            const data = fs.readFileSync(path.join(diagramsDir, file), 'utf8');
            const parsed = JSON.parse(data);
            return {
                id: parsed.id,
                name: parsed.name || file.replace('.dbld', ''),
                lastModified: parsed.lastModified || fs.statSync(path.join(diagramsDir, file)).mtimeMs
            };
        });
        // Sort by last Modified desc
        diagrams.sort((a,b) => b.lastModified - a.lastModified);
        return { success: true, data: diagrams };
    } catch (err) {
        console.error("Failed to list diagrams:", err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('diagram:load', async (event, id) => {
    try {
        const filePath = path.join(diagramsDir, `${id}.dbld`);
        if (!fs.existsSync(filePath)) return { success: false, error: "Diagram not found." };
        
        const data = fs.readFileSync(filePath, 'utf8');
        return { success: true, data: JSON.parse(data) };
    } catch (err) {
        console.error(`Failed to load diagram ${id}:`, err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('diagram:save', async (event, payload) => {
    try {
        if (!payload || !payload.id) return { success: false, error: "Invalid payload: missing id" };
        const filePath = path.join(diagramsDir, `${payload.id}.dbld`);
        payload.lastModified = Date.now();
        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
        return { success: true };
    } catch (err) {
        console.error(`Failed to save diagram ${payload?.id}:`, err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('diagram:delete', async (event, id) => {
    try {
        const filePath = path.join(diagramsDir, `${id}.dbld`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return { success: true };
    } catch (err) {
        console.error(`Failed to delete diagram ${id}:`, err);
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

ipcMain.handle('dialog:saveFile', async (event, defaultName, filters) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultName || 'export.bacpac',
        filters: filters || [{ name: 'Bacpac', extensions: ['bacpac'] }]
    });
    if (canceled) return null;
    return filePath;
});

ipcMain.handle('file:writeTextData', async (event, filePath, textData) => {
    try {
        fs.writeFileSync(filePath, textData, 'utf8');
        return { success: true };
    } catch (err) {
        console.error("Failed to write text data:", err);
        return { success: false, error: err.message };
    }
});

// 2. Run Import Job (Phase 1 MVP)
const { spawn } = require('child_process');

ipcMain.handle('job:runImport', async (event, filePath, targetServer, targetDb) => {
    return new Promise((resolve) => {
        // Log the start
        if (mainWindow) {
            mainWindow.webContents.send('job:log', `[SYSTEM] Preparing to import: ${filePath}\n[SYSTEM] Target Server: ${targetServer}\n[SYSTEM] Target DB: ${targetDb}\n`);
        }

        // Basic sqlpackage import arguments
        const args = [
            '/Action:Import',
            `/SourceFile:${filePath}`,
            `/TargetServerName:${targetServer}`,
            `/TargetDatabaseName:${targetDb || `ImportedDb_${Date.now()}`}`,
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
                    if (mainWindow) mainWindow.webContents.send('job:log', `[SYSTEM ERROR] sqlpackage.exe not found. You must install the Microsoft SQL Server Data-Tier Application Framework and add it to your system PATH.\n`);
                    resolve(false);
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

ipcMain.handle('job:runExport', async (event, sourceServer, sourceDb, targetFile) => {
    return new Promise((resolve) => {
        if (mainWindow) {
            mainWindow.webContents.send('job:log', `[SYSTEM] Preparing to export: ${sourceDb} from ${sourceServer}\n[SYSTEM] Target File: ${targetFile}\n`);
        }

        const args = [
            '/Action:Export',
            `/SourceServerName:${sourceServer}`,
            `/SourceDatabaseName:${sourceDb}`,
            `/TargetFile:${targetFile}`,
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
                    if (mainWindow) mainWindow.webContents.send('job:log', `[SYSTEM ERROR] sqlpackage.exe not found. You must install the Microsoft SQL Server Data-Tier Application Framework and add it to your system PATH.\n`);
                    resolve(false);
                } else {
                    if (mainWindow) mainWindow.webContents.send('job:log', `\n[SYSTEM ERROR] Failed to start sqlpackage: ${err.message}`);
                    resolve(false);
                }
            });

            child.on('close', (code) => {
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
