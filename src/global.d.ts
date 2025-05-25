// global.d.ts - Definição de tipos globais para a aplicação

interface Window {
  // Variáveis globais para processamento
  processingTotalFiles: number;
  processingCompletedFiles: number;
  processingStartTimeEstimation: number;
  processingTokensTotal: { sent: number; received: number };
  
  // Função global para configuração de event handlers
  setupEventHandlers: () => void;
  
  // APIs expostas pelo Electron
  api: {
    selectFolder: () => Promise<string | null>;
    minifyFiles: (options: any) => Promise<any>;
    processCode: (options: any) => Promise<any>;
  };
  electronAPI: {
    logMessage: (message: string) => void;
    onMigrationProgress: (callback: (message: string) => void) => void;
    onConversionProgress: (callback: (data: {
      status: string;
      file?: string;
      message?: string;
      fileInfo?: string;
      tokensInfo?: { sent: number; received: number };
      fileSize?: { original: number; processed: number };
    }) => void) => void;
  };  logger: {
    onLogUpdate: (callback: (data: { type: string; message: string }) => void) => void;
    
    // Eventos para minificação
    onMinifyStart: (callback: (data: { totalFiles: number }) => void) => void;
    onMinifyProgress: (callback: (data: { 
      file: string; 
      processed: number; 
      total: number;
      tokens?: { before: number; after: number };
      size?: { before: string; after: string; beforeBytes: number; afterBytes: number };
      originalSize?: number;
      minifiedSize?: number;
    }) => void) => void;
    onMinifyComplete: (callback: (data: { 
      totalTime: number;
      totalFiles: number;
      sizeReduction: number;
      originalSize: number;
      minifiedSize: number;
      originalTokens: number;
      minifiedTokens: number;
    }) => void) => void;
    
    // Eventos para processamento/conversão de código
    onFileProcessingStart: (callback: (data: { totalFiles: number }) => void) => void;
    onFileProcessed: (callback: (data: { 
      file: string;
      completed: number;
      total: number;
      tokens?: { sent: number; received: number };
      fileSize?: { original: number; processed: number };
      progress?: number;
    }) => void) => void;
    onProcessingComplete: (callback: (data: { 
      totalTime: number;
      totalTokens: { sent: number; received: number };
      totalFiles?: number;
      totalSize?: { original: number; processed: number };
    }) => void) => void;
  };
  iaAgent: {
    analyzeCode: (options: any, files: any[]) => Promise<any>;
    executeSuggestions: (suggestions: any[], outputFolder: string) => Promise<any>;
  };
  agent: {
    createFolder: (folderPath: string) => Promise<any>;
    move: (src: string, dest: string) => Promise<any>;
    rename: (oldPath: string, newPath: string) => Promise<any>;
    delete: (targetPath: string) => Promise<any>;
    writeFile: (targetPath: string, content: string) => Promise<any>;
    readFile: (targetPath: string) => Promise<any>;
  };
}
