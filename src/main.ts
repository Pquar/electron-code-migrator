import { app, BrowserWindow, dialog, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs-extra";
import { processFiles, minifyFiles } from "./processor";

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
    console.log("Modo de desenvolvimento ativo: DevTools aberto");
  }

  // Ao fechar a janela, liberar a referência
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Inicialização do aplicativo
app
  .whenReady()
  .then(() => {
    // Criar a janela principal
    createWindow();

    // No macOS, é comum recriar a janela quando o ícone do dock é clicado
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });

    // Configurar handlers IPC após a aplicação estar pronta
    setupIpcHandlers();

    console.log("Aplicativo iniciado");
  })
  .catch((error) => {
    console.error("Erro ao iniciar o aplicativo:", error);
  });

// Fechar o aplicativo quando todas as janelas forem fechadas (exceto no macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

/**
 * Configura todos os manipuladores de eventos IPC
 */
function setupIpcHandlers() {
  // Handler para selecionar pasta
  ipcMain.handle("select-folder", async () => {
    if (!mainWindow) return null;

    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
        buttonLabel: "Selecionar Pasta"
      });

      const dialogResult = result as unknown as { canceled: boolean; filePaths: string[] };
      return dialogResult.canceled ? null : dialogResult.filePaths[0];
    } catch (error) {
      console.error("Erro ao selecionar pasta:", error);
      return null;
    }
  });

  // Handler para minificar os arquivos
  ipcMain.handle("minify-files", async (_, options) => {
    console.log(
      "Iniciando minificação de arquivos com opções:",
      JSON.stringify(options, null, 2)
    );

    try {
      // Validar opções recebidas
      validateProcessOptions(options);

      // Processar arquivos - apenas etapa de minificação
      const result = await minifyFiles(options);

      console.log("Minificação concluída com sucesso");
      return {
        success: true,
        result,
        stats: {
          minifiedFiles: result.minifiedFiles.length,
          sizeReduction: result.sizeReduction,
        },
      };
    } catch (error: any) {
      console.error("Erro durante a minificação:", error);
      return {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  });

  // Handler para processar código
  ipcMain.handle("process-code", async (_, options) => {
    console.log(
      "Iniciando processamento de código com opções:",
      JSON.stringify(options, null, 2)
    );

    try {
      // Validar opções recebidas
      validateProcessOptions(options);

      // Processar arquivos com a nova API
      const result = await processFiles(options);

      console.log("Processamento concluído com sucesso");
      return {
        success: true,
        result,
        stats: {
          processed: result.processedFiles.length,
          converted: result.convertedFiles.length,
        },
      };
    } catch (error: any) {
      console.error("Erro durante o processamento:", error);
      return {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  });

  // Handler para verificar se o modelo LLama existe
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
      console.error("Erro ao verificar modelo LLama:", error);
      return {
        exists: false,
        error: (error as Error).message,
      };
    }
  });

  // Handler para salvar configurações
  ipcMain.handle("save-settings", async (_, settings) => {
    try {
      const userDataPath = app.getPath("userData");
      const settingsPath = path.join(userDataPath, "settings.json");

      await fs.writeJson(settingsPath, settings, { spaces: 2 });
      return { success: true };
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // Handler para carregar configurações
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
      console.error("Erro ao carregar configurações:", error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
}

/**
 * Valida as opções recebidas do frontend
 */
function validateProcessOptions(options: any) {
  if (!options) {
    throw new Error("Opções de processamento não fornecidas");
  }

  if (!options.sourceFolder) {
    throw new Error("Pasta de origem não especificada");
  }

  if (!options.tempFolder) {
    throw new Error("Pasta temporária não especificada");
  }

  if (!options.outputFolder) {
    throw new Error("Pasta de saída não especificada");
  }

  if (!options.conversionOptions?.targetLanguage) {
    throw new Error("Linguagem alvo não especificada");
  }

  if (!options.conversionOptions?.provider) {
    throw new Error("Provedor de IA não especificado");
  }

  // Verificar se a API Key foi fornecida para provedores que precisam  // Verifica se os provedores que precisam de API Key a forneceram
  const needsApiKey = ["openai", "gemini", "anthropic", "llama"].includes(
    options.conversionOptions.provider
  );
  if (needsApiKey && !options.conversionOptions.apiKey) {
    throw new Error(
      `API Key não fornecida para o provedor ${options.conversionOptions.provider}`
    );
  }

  // Verifica se o Llama API tem a URL fornecida
  if (options.conversionOptions.provider === "llama" && !options.conversionOptions.apiUrl) {
    throw new Error("URL da API Llama não fornecida");
  }
}
