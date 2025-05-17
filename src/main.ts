import { app, BrowserWindow, dialog, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs-extra";
import { processFiles } from "./processor";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "../dist/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, "../public/assets/icon.png"),
  });

  mainWindow.loadFile(path.join(__dirname, "../src/index.html"));

  // Apenas em ambiente de desenvolvimento
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  }) as unknown as Electron.OpenDialogReturnValue;

  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("process-code", async (_, options) => {
  try {
    const result = await processFiles(
      options.sourceFolder,
      options.tempFolder,
      options.outputFolder,
      options.simplificationOptions,
      options.conversionOptions
    );
    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
