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
  AgentSuggestion
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

      // Configurar listeners para eventos de progresso da minificação
      const startTime = Date.now();
      let filesProcessed = 0;
      let totalFiles = 0;
      let originalTotalSize = 0;
      let minifiedTotalSize = 0;
      
      // Processar eventos de minificação
      process.on('message', (message: any) => {
        if (message.type === 'minification-file-count') {
          totalFiles = message.count;
          // Emitir evento de início da minificação com contagem total de arquivos
          mainWindow?.webContents.send('minify:start', { totalFiles });
        } else if (message.type === 'minification-progress') {
          filesProcessed++;
          
          // Atualizar tamanhos totais para cálculo de redução
          if (message.data.size) {
            const originalSize = typeof message.data.size.beforeBytes === 'number' 
              ? message.data.size.beforeBytes 
              : 0;
              
            const minifiedSize = typeof message.data.size.afterBytes === 'number' 
              ? message.data.size.afterBytes 
              : 0;
              
            originalTotalSize += originalSize;
            minifiedTotalSize += minifiedSize;
          }
          
          // Emitir evento de progresso da minificação
          mainWindow?.webContents.send('minify:progress', {
            file: message.data.file,
            processed: filesProcessed,
            total: totalFiles,
            tokens: message.data.tokens,
            size: message.data.size,
            originalSize: originalTotalSize,
            minifiedSize: minifiedTotalSize
          });
          
          // Emitir evento de log para manter compatibilidade
          mainWindow?.webContents.send('update-log', {
            type: 'minify',
            message: `Minificando: ${message.data.file} (${filesProcessed}/${totalFiles})`
          });
        }
      });

      // Processar arquivos - apenas etapa de minificação
      const result = await minifyFiles(options);
      
      // Emitir evento de conclusão da minificação com métricas
      const processingTime = Date.now() - startTime;
      mainWindow?.webContents.send('minify:complete', {
        totalTime: processingTime,
        totalFiles: result.minifiedFiles.length,
        sizeReduction: result.sizeReduction,
        originalSize: originalTotalSize,
        minifiedSize: minifiedTotalSize,
        originalTokens: result.totalOriginalTokens,
        minifiedTokens: result.totalMinifiedTokens
      });

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
      
      // Configurar listeners para eventos de progresso
      const startTime = Date.now();
      let totalTokensSent = 0;
      let totalTokensReceived = 0;
      let filesProcessed = 0;
      let totalFilesEstimate = 0;
      let totalOriginalSize = 0;
      let totalProcessedSize = 0;
      
      // Processar eventos de progresso
      process.on('message', (message: any) => {
        if (message.type === 'file-count') {
          totalFilesEstimate = message.count;
          mainWindow?.webContents.send('processing:start', { totalFiles: totalFilesEstimate });
        } else if (message.type === 'conversion-progress') {
          filesProcessed++;
          
          if (message.data.tokensInfo) {
            totalTokensSent += message.data.tokensInfo.sent || 0;
            totalTokensReceived += message.data.tokensInfo.received || 0;
          }
            // Calcular tamanho do arquivo
          let fileSizeInfo: { original: number, processed: number } | undefined;
          
          if (message.data.fileSize) {
            fileSizeInfo = message.data.fileSize;
            totalOriginalSize += message.data.fileSize.original || 0;
            totalProcessedSize += message.data.fileSize.processed || 0;
          }
          
          // Enviar evento de progresso com todos os detalhes
          mainWindow?.webContents.send('processing:file-processed', {
            file: message.data.file,
            completed: filesProcessed,
            total: totalFilesEstimate,
            tokens: message.data.tokensInfo,
            fileSize: fileSizeInfo,
            progress: Math.floor((filesProcessed / totalFilesEstimate) * 100)
          });
          
          // Emitir evento de log para manter compatibilidade
          mainWindow?.webContents.send('update-log', {
            type: 'process',
            message: `Processando: ${message.data.file} (${filesProcessed}/${totalFilesEstimate})`
          });
        }
      });

      // Processar arquivos com a nova API
      const result = await processFiles(options);
      
      // Enviar evento de conclusão com métricas
      const processingTime = Date.now() - startTime;
      mainWindow?.webContents.send('processing:complete', {
        totalTime: processingTime,
        totalTokens: {
          sent: totalTokensSent,
          received: totalTokensReceived
        },
        totalFiles: result.convertedFiles.length,
        totalSize: {
          original: totalOriginalSize,
          processed: totalProcessedSize
        }
      });

      console.log("Processamento concluído com sucesso");
      return {
        success: true,
        result,
        stats: {
          processed: result.processedFiles.length,
          converted: result.convertedFiles.length,
          tokensProcessed: {
            sent: totalTokensSent,
            received: totalTokensReceived
          },
          processingTime
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

  // Eventos de progresso  
  ipcMain.on('minification-progress', (event, data) => {
    const { file, tokens, size, fileInfo } = data;
    mainWindow?.webContents.send('update-log', {
      type: 'minification',
      message: `Arquivo: ${file}\nDetalhes: ${fileInfo || 'N/A'}\nTokens: ${tokens.before} → ${tokens.after}\nTamanho: ${size.before} → ${size.after}\n`
    });
  });
  ipcMain.on('conversion-progress', (event, data) => {
    const { status, file, output, fileInfo, tokensInfo } = data;
    let message = '';
    
    if (status === 'simplified') {
      message = `Arquivo simplificado: ${file}\nDetalhes: ${fileInfo || 'N/A'}`;
    } else if (status === 'converted') {
      const tokensText = tokensInfo ? `\nTokens: ${tokensInfo.sent} enviados / ${tokensInfo.received} recebidos` : '';
      message = `Arquivo convertido: ${file} → ${output}\nDetalhes: ${fileInfo || 'N/A'}${tokensText}`;
    }
    
    mainWindow?.webContents.send('update-log', {
      type: 'conversion',
      message
    });
  });

  // Handlers para manipulação de arquivos e pastas pelo agente IA
  ipcMain.handle('agent:create-folder', async (_event, folderPath: string) => {
    try {
      await createFolder(folderPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('agent:move', async (_event, src: string, dest: string) => {
    try {
      await moveFileOrFolder(src, dest);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('agent:rename', async (_event, oldPath: string, newPath: string) => {
    try {
      await renameFileOrFolder(oldPath, newPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('agent:delete', async (_event, targetPath: string) => {
    try {
      await deleteFileOrFolder(targetPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('agent:write-file', async (_event, targetPath: string, content: string) => {
    try {
      await writeFile(targetPath, content);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('agent:read-file', async (_event, targetPath: string) => {
    try {
      const content = await readFile(targetPath);
      return { success: true, content };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Handlers para funcionalidades do agente IA
  ipcMain.handle("analyze-code", async (_, options, files) => {
    try {
      const suggestions = await analyzeCodeWithAgent(options, files);
      return { success: true, suggestions };
    } catch (error) {
      console.error("Erro ao analisar código com agente:", error);
      return { 
        success: false, 
        error: (error as Error).message 
      };
    }
  });

  ipcMain.handle("execute-suggestions", async (_, suggestions, outputFolder) => {
    try {
      const results = await executeAgentSuggestions(suggestions, outputFolder);
      return { success: true, results };
    } catch (error) {
      console.error("Erro ao executar sugestões:", error);
      return { 
        success: false, 
        error: (error as Error).message 
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
