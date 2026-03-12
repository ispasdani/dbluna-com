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
