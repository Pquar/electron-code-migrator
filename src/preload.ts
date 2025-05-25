// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// Expõe as funções seguras para o processo de renderização
contextBridge.exposeInMainWorld('api', {
  // Esta função permite selecionar uma pasta
  selectFolder: async () => {
    try {
      return await ipcRenderer.invoke('select-folder');
    } catch (error) {
      console.error('Erro ao selecionar pasta:', error);
      return null;
    }
  },
  // Esta função realiza a minificação dos arquivos
  minifyFiles: async (options: any) => {
    try {
      return await ipcRenderer.invoke('minify-files', options);
    } catch (error) {
      console.error('Erro ao minificar arquivos:', error);
      throw error;
    }
  },
  // Esta função processa o código com as opções especificadas
  processCode: async (options: any) => {
    try {
      return await ipcRenderer.invoke('process-code', options);
    } catch (error) {
      console.error('Erro ao processar código:', error);
      throw error;
    }
  }
});

contextBridge.exposeInMainWorld("electronAPI", {
  logMessage: (message: string) => ipcRenderer.send("log:message", message),
  onMigrationProgress: (callback: (message: string) => void) => {
    ipcRenderer.on("migration:progress", (_, message) => callback(message));
  },
});

// Expor eventos de log
contextBridge.exposeInMainWorld('logger', {
  onLogUpdate: (callback: (data: { type: string; message: string }) => void) => {
    ipcRenderer.on('update-log', (_event, data) => callback(data));
  },
  
  // Eventos para minificação
  onMinifyStart: (callback: (data: { totalFiles: number }) => void) => {
    ipcRenderer.on('minify:start', (_event, data) => callback(data));
  },
  onMinifyProgress: (callback: (data: { 
    file: string, 
    processed: number, 
    total: number,
    tokens?: { before: number, after: number },
    size?: { before: string, after: string, beforeBytes: number, afterBytes: number },
    originalSize?: number,
    minifiedSize?: number
  }) => void) => {
    ipcRenderer.on('minify:progress', (_event, data) => callback(data));
  },
  onMinifyComplete: (callback: (data: { 
    totalTime: number,
    totalFiles: number,
    sizeReduction: number,
    originalSize: number,
    minifiedSize: number,
    originalTokens: number,
    minifiedTokens: number
  }) => void) => {
    ipcRenderer.on('minify:complete', (_event, data) => callback(data));
  },
  
  // Eventos para processamento/conversão de código
  onFileProcessingStart: (callback: (data: { totalFiles: number }) => void) => {
    ipcRenderer.on('processing:start', (_event, data) => callback(data));
  },
  onFileProcessed: (callback: (data: { 
    file: string, 
    completed: number, 
    total: number, 
    tokens?: { sent: number, received: number },
    fileSize?: { original: number, processed: number },
    progress?: number
  }) => void) => {
    ipcRenderer.on('processing:file-processed', (_event, data) => callback(data));
  },
  onProcessingComplete: (callback: (data: { 
    totalTime: number,
    totalTokens: { sent: number, received: number },
    totalFiles?: number,
    totalSize?: { original: number, processed: number }
  }) => void) => {
    ipcRenderer.on('processing:complete', (_event, data) => callback(data));
  }
});

contextBridge.exposeInMainWorld('agent', {
  createFolder: async (folderPath: string) => ipcRenderer.invoke('agent:create-folder', folderPath),
  move: async (src: string, dest: string) => ipcRenderer.invoke('agent:move', src, dest),
  rename: async (oldPath: string, newPath: string) => ipcRenderer.invoke('agent:rename', oldPath, newPath),
  delete: async (targetPath: string) => ipcRenderer.invoke('agent:delete', targetPath),
  writeFile: async (targetPath: string, content: string) => ipcRenderer.invoke('agent:write-file', targetPath, content),
  readFile: async (targetPath: string) => ipcRenderer.invoke('agent:read-file', targetPath),
});

// Interface para Agente Inteligente de IA
contextBridge.exposeInMainWorld('iaAgent', {
  analyzeCode: async (options: any, files: any[]) => {
    try {
      return await ipcRenderer.invoke('analyze-code', options, files);
    } catch (error) {
      console.error('Erro ao analisar código com agente IA:', error);
      throw error;
    }
  },
  executeSuggestions: async (suggestions: any[], outputFolder: string) => {
    try {
      return await ipcRenderer.invoke('execute-suggestions', suggestions, outputFolder);
    } catch (error) {
      console.error('Erro ao executar sugestões do agente IA:', error);
      throw error;
    }
  }
});