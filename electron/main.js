const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

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

            child.stdout.on('data', (data) => {
                if (mainWindow) mainWindow.webContents.send('job:log', data.toString());
            });

            child.stderr.on('data', (data) => {
                if (mainWindow) mainWindow.webContents.send('job:log', `[ERROR]: ${data.toString()}`);
            });

            child.on('close', (code) => {
                if (mainWindow) mainWindow.webContents.send('job:log', `\n[SYSTEM] Process exited with code ${code}`);
                resolve(code === 0);
            });

            child.on('error', (err) => {
                if (mainWindow) mainWindow.webContents.send('job:log', `\n[SYSTEM ERROR] Failed to start sqlpackage: ${err.message}. Is sqlpackage installed in your PATH?`);
                resolve(false);
            });

        } catch (error) {
            if (mainWindow) mainWindow.webContents.send('job:log', `\n[EXCEPTION] ${error.message}`);
            resolve(false);
        }
    });
});
