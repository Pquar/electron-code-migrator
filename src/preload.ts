// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// Expose secure functions to the renderer process
contextBridge.exposeInMainWorld('api', {
  // This function allows selecting a folder
  selectFolder: async () => {
    try {
      return await ipcRenderer.invoke('select-folder');
    } catch (error) {
      console.error('Error selecting folder:', error);
      return null;
    }
  },
  // This function performs file minification
  minifyFiles: async (options: any) => {
    try {
      return await ipcRenderer.invoke('minify-files', options);
    } catch (error) {
      console.error('Error minifying files:', error);
      throw error;
    }
  },
  // This function processes code with the specified options
  processCode: async (options: any) => {
    try {
      return await ipcRenderer.invoke('process-code', options);
    } catch (error) {
      console.error('Error processing code:', error);
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

// Expose log events
contextBridge.exposeInMainWorld('logger', {
  onLogUpdate: (callback: (data: { type: string; message: string }) => void) => {
    ipcRenderer.on('update-log', (_event, data) => callback(data));
  },
  
  // Events for minification
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
  
  // Events for code processing/conversion
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

// Interface for AI Intelligent Agent
contextBridge.exposeInMainWorld('iaAgent', {
  analyzeCode: async (options: any, files: any[]) => {
    try {
      return await ipcRenderer.invoke('analyze-code', options, files);
    } catch (error) {
      console.error('Error analyzing code with AI agent:', error);
      throw error;
    }
  },
  executeSuggestions: async (suggestions: any[], outputFolder: string) => {
    try {
      return await ipcRenderer.invoke('execute-suggestions', suggestions, outputFolder);
    } catch (error) {
      console.error('Error executing AI agent suggestions:', error);
      throw error;
    }
  }
});