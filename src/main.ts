import { app, BrowserWindow, dialog, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs-extra";
import {
  processFiles,
  minifyFiles,
  createFolder,
  moveFileOrFolder,
  renameFileOrFolder,
  deleteFileOrFolder,
  writeFile,
  readFile,
  analyzeCodeWithAgent,
  executeAgentSuggestions,
  AgentSuggestion,
} from "./processor";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, "../assets/icon.png"),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, "../src/index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
    console.log("Development mode active: DevTools opened");
  }

  // Release the window reference when closing
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Application initialization
app
  .whenReady()
  .then(() => {
    // Create the main window
    createWindow();

    // On macOS, it's common to recreate the window when the dock icon is clicked
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });

    // Set up IPC handlers after the application is ready
    setupIpcHandlers();

    console.log("Application started");
  })
  .catch((error) => {
    console.error("Error starting application:", error);
  });

// Close the application when all windows are closed (except on macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

/**
 * Sets up all IPC event handlers
 */
function setupIpcHandlers() {
  // Handler for folder selection
  ipcMain.handle("select-folder", async () => {
    if (!mainWindow) return null;

    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
        buttonLabel: "Select Folder",
      });

      const dialogResult = result as unknown as {
        canceled: boolean;
        filePaths: string[];
      };
      return dialogResult.canceled ? null : dialogResult.filePaths[0];
    } catch (error) {
      console.error("Error selecting folder:", error);
      return null;
    }
  });

  // Handler for minifying files
  ipcMain.handle("minify-files", async (_, options) => {
    console.log(
      "Starting file minification with options:",
      JSON.stringify(options, null, 2)
    );

    try {
      // Validate received options
      validateProcessOptions(options);

      // Set up listeners for minification progress events
      const startTime = Date.now();
      let filesProcessed = 0;
      let totalFiles = 0;
      let originalTotalSize = 0;
      let minifiedTotalSize = 0;

      // Process minification events
      process.on("message", (message: any) => {
        if (message.type === "minification-file-count") {
          totalFiles = message.count;
          // Emit start event for minification with total file count
          mainWindow?.webContents.send("minify:start", { totalFiles });
        } else if (message.type === "minification-progress") {
          filesProcessed++;

          // Update total sizes for reduction calculation
          if (message.data.size) {
            const originalSize =
              typeof message.data.size.beforeBytes === "number"
                ? message.data.size.beforeBytes
                : 0;

            const minifiedSize =
              typeof message.data.size.afterBytes === "number"
                ? message.data.size.afterBytes
                : 0;

            originalTotalSize += originalSize;
            minifiedTotalSize += minifiedSize;
          }

          // Emit minification progress event
          mainWindow?.webContents.send("minify:progress", {
            file: message.data.file,
            processed: filesProcessed,
            total: totalFiles,
            tokens: message.data.tokens,
            size: message.data.size,
            originalSize: originalTotalSize,
            minifiedSize: minifiedTotalSize,
          });

          // Emit log event to maintain compatibility
          mainWindow?.webContents.send("update-log", {
            type: "minify",
            message: `Minifying: ${message.data.file} (${filesProcessed}/${totalFiles})`,
          });
        }
      });

      // Process files - minification step only
      const result = await minifyFiles(options);

      // Emit minification completion event with metrics
      const processingTime = Date.now() - startTime;
      mainWindow?.webContents.send("minify:complete", {
        totalTime: processingTime,
        totalFiles: result.minifiedFiles.length,
        sizeReduction: result.sizeReduction,
        originalSize: originalTotalSize,
        minifiedSize: minifiedTotalSize,
        originalTokens: result.totalOriginalTokens,
        minifiedTokens: result.totalMinifiedTokens,
      });

      console.log("Minification completed successfully");
      return {
        success: true,
        result,
        stats: {
          minifiedFiles: result.minifiedFiles.length,
          sizeReduction: result.sizeReduction,
        },
      };
    } catch (error: any) {
      console.error("Error during minification:", error);
      return {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  });
  // Handler for processing code
  ipcMain.handle("process-code", async (_event, options) => {
    console.log(
      "Starting code processing with options:",
      JSON.stringify(options, null, 2)
    );

    try {
      // Validate received options
      validateProcessOptions(options);

      // Set up listeners for progress events
      const startTime = Date.now();
      let totalTokensSent = 0;
      let totalTokensReceived = 0;
      let filesProcessed = 0;
      let totalFilesEstimate = 0;
      let totalOriginalSize = 0;
      let totalProcessedSize = 0;

      // Process progress events
      process.on("message", (message: any) => {
        if (message.type === "file-count") {
          totalFilesEstimate = message.count;
          mainWindow?.webContents.send("processing:start", {
            totalFiles: totalFilesEstimate,
          });
        } else if (message.type === "conversion-progress") {
          filesProcessed++;

          if (message.data.tokensInfo) {
            totalTokensSent += message.data.tokensInfo.sent || 0;
            totalTokensReceived += message.data.tokensInfo.received || 0;
          }
          // Calculate file size
          let fileSizeInfo: { original: number; processed: number } | undefined;

          if (message.data.fileSize) {
            fileSizeInfo = message.data.fileSize;
            totalOriginalSize += message.data.fileSize.original || 0;
            totalProcessedSize += message.data.fileSize.processed || 0;
          }

          // Send progress event with all details
          mainWindow?.webContents.send("processing:file-processed", {
            file: message.data.file,
            completed: filesProcessed,
            total: totalFilesEstimate,
            tokens: message.data.tokensInfo,
            fileSize: fileSizeInfo,
            progress: Math.floor((filesProcessed / totalFilesEstimate) * 100),
          });
          // Emit log event to maintain compatibility
          if (process.send) {
            process.send({
              type: "log",
              message: `Processing: ${message.data.file} (${filesProcessed}/${totalFilesEstimate})`,
            });
          }

          mainWindow?.webContents.send("update-log", {
            type: "process",
            message: `Processing: ${message.data.file} (${filesProcessed}/${totalFilesEstimate})`,
          });
        }
      });

      // Process files with the new API
      const result = await processFiles(options);

      // Send completion event with metrics
      const processingTime = Date.now() - startTime;
      mainWindow?.webContents.send("processing:complete", {
        totalTime: processingTime,
        totalTokens: {
          sent: totalTokensSent,
          received: totalTokensReceived,
        },
        totalFiles: result.convertedFiles.length,
        totalSize: {
          original: totalOriginalSize,
          processed: totalProcessedSize,
        },
      });

      console.log("Processing completed successfully");
      return {
        success: true,
        result,
        stats: {
          processed: result.processedFiles.length,
          converted: result.convertedFiles.length,
          tokensProcessed: {
            sent: totalTokensSent,
            received: totalTokensReceived,
          },
          processingTime,
        },
      };
    } catch (error: any) {
      console.error("Error during processing:", error);
      return {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  });

  // Handler to check if the LLama model exists
  ipcMain.handle("check-llama-model", async () => {
    const modelPath = path.resolve(
      process.env.NODE_ENV === "development"
        ? process.cwd()
        : path.join(process.resourcesPath, "models"),
      "Llama-4-Scout-17B-16E-Instruct-UD-Q3_K_XL.gguf"
    );

    try {
      const exists = await fs.pathExists(modelPath);
      return {
        exists,
        path: modelPath,
      };
    } catch (error) {
      console.error("Error checking LLama model:", error);
      return {
        exists: false,
        error: (error as Error).message,
      };
    }
  });

  // Handler to save settings
  ipcMain.handle("save-settings", async (_, settings) => {
    try {
      const userDataPath = app.getPath("userData");
      const settingsPath = path.join(userDataPath, "settings.json");

      await fs.writeJson(settingsPath, settings, { spaces: 2 });
      return { success: true };
    } catch (error) {
      console.error("Error saving settings:", error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // Handler to load settings
  ipcMain.handle("load-settings", async () => {
    try {
      const userDataPath = app.getPath("userData");
      const settingsPath = path.join(userDataPath, "settings.json");

      if (await fs.pathExists(settingsPath)) {
        const settings = await fs.readJson(settingsPath);
        return { success: true, settings };
      }

      return { success: true, settings: {} };
    } catch (error) {
      console.error("Error loading settings:", error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // Progress events
  ipcMain.on("minification-progress", (event, data) => {
    const { file, tokens, size, fileInfo } = data;
    mainWindow?.webContents.send("update-log", {
      type: "minification",
      message: `File: ${file}\nDetails: ${fileInfo || "N/A"}\nTokens: ${
        tokens.before
      } → ${tokens.after}\nSize: ${size.before} → ${size.after}\n`,
    });
  });

  ipcMain.on("conversion-progress", (event, data) => {
    const { status, file, output, fileInfo, tokensInfo } = data;
    let message = "";

    if (status === "simplified") {
      message = `Simplified file: ${file}\nDetails: ${fileInfo || "N/A"}`;
    } else if (status === "converted") {
      const tokensText = tokensInfo
        ? `\nTokens: ${tokensInfo.sent} sent / ${tokensInfo.received} received`
        : "";
      message = `Converted file: ${file} → ${output}\nDetails: ${
        fileInfo || "N/A"
      }${tokensText}`;
    }

    mainWindow?.webContents.send("update-log", {
      type: "conversion",
      message,
    });
  });

  // Handlers for file and folder manipulation by the AI agent
  ipcMain.handle("agent:create-folder", async (_event, folderPath: string) => {
    try {
      await createFolder(folderPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("agent:move", async (_event, src: string, dest: string) => {
    try {
      await moveFileOrFolder(src, dest);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(
    "agent:rename",
    async (_event, oldPath: string, newPath: string) => {
      try {
        await renameFileOrFolder(oldPath, newPath);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle("agent:delete", async (_event, targetPath: string) => {
    try {
      await deleteFileOrFolder(targetPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(
    "agent:write-file",
    async (_event, targetPath: string, content: string) => {
      try {
        await writeFile(targetPath, content);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle("agent:read-file", async (_event, targetPath: string) => {
    try {
      const content = await readFile(targetPath);
      return { success: true, content };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Handlers for AI agent functionalities
  ipcMain.handle("analyze-code", async (_, options, files) => {
    try {
      const suggestions = await analyzeCodeWithAgent(options, files);
      return { success: true, suggestions };
    } catch (error) {
      console.error("Error analyzing code with agent:", error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  ipcMain.handle(
    "execute-suggestions",
    async (_, suggestions, outputFolder) => {
      try {
        const results = await executeAgentSuggestions(
          suggestions,
          outputFolder
        );
        return { success: true, results };
      } catch (error) {
        console.error("Error executing suggestions:", error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );
}

/**
 * Validates the options received from the frontend
 */
function validateProcessOptions(options: any) {
  if (!options) {
    throw new Error("Processing options not provided");
  }

  if (!options.sourceFolder) {
    throw new Error("Source folder not specified");
  }

  if (!options.tempFolder) {
    throw new Error("Temporary folder not specified");
  }

  if (!options.outputFolder) {
    throw new Error("Output folder not specified");
  }

  if (!options.conversionOptions?.targetLanguage) {
    throw new Error("Target language not specified");
  }

  if (!options.conversionOptions?.provider) {
    throw new Error("AI provider not specified");
  }

  // Check if API Key is provided for providers that need it
  const needsApiKey = ["openai", "gemini", "anthropic", "llama"].includes(
    options.conversionOptions.provider
  );
  if (needsApiKey && !options.conversionOptions.apiKey) {
    throw new Error(
      `API Key not provided for provider ${options.conversionOptions.provider}`
    );
  }

  // Check if Llama API has the URL provided
  if (
    options.conversionOptions.provider === "llama" &&
    !options.conversionOptions.apiUrl
  ) {
    throw new Error("Llama API URL not provided");
  }
}
