const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const store = new Store();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    resizable: false,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Выберите файл'
  });
  
  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Выберите папку'
  });
  
  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    await fs.promises.unlink(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-files-in-directory', async (event, { directoryPath, extensions }) => {
  const results = {
    success: [],
    errors: []
  };

  try {
    const files = await fs.promises.readdir(directoryPath);
    const extensionArray = extensions.split(',').map(ext => ext.trim());
    
    for (const file of files) {
      const filePath = path.join(directoryPath, file);
      const fileExt = path.extname(file).toLowerCase();
      
      if (extensionArray.some(ext => ext.toLowerCase() === fileExt || 
                                    (ext.startsWith('.') ? ext.toLowerCase() === fileExt : `.${ext.toLowerCase()}` === fileExt))) {
        try {
          const stats = await fs.promises.stat(filePath);
          if (stats.isFile()) {
            await fs.promises.unlink(filePath);
            results.success.push(filePath);
          }
        } catch (error) {
          results.errors.push({ path: filePath, error: error.message });
        }
      }
    }
    
    return results;
  } catch (error) {
    return { success: [], errors: [{ path: directoryPath, error: error.message }] };
  }
});

ipcMain.handle('get-operations', () => {
  return store.get('operations', []);
});

ipcMain.handle('save-operations', (event, operations) => {
  store.set('operations', operations);
  return true;
});

ipcMain.handle('get-logs', (event, operationId) => {
  const logs = store.get('logs', {});
  return logs[operationId] || { success: [], errors: [] };
});

ipcMain.handle('save-logs', (event, { operationId, logs }) => {
  const allLogs = store.get('logs', {});
  allLogs[operationId] = logs;
  store.set('logs', allLogs);
  return true;
}); 
