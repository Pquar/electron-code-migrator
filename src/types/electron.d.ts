interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

export interface IElectronAPI {
  processCode(formData: { sourceFolder: string; tempFolder: string; outputFolder: string; simplificationOptions: { removeComments: boolean; reduceKeywords: boolean; minify: boolean; }; conversionOptions: { targetLanguage: string; provider: string; apiKey: string; apiUrl?: string; }; }): unknown;
  selectFolder: () => Promise<string | null>;
}

interface API {
  selectFolder: () => Promise<string | null>;
  processCode: (formData: any) => Promise<any>;
}

interface ElectronAPI {
  logMessage: (message: string) => void;
  onMigrationProgress: (callback: (message: string) => void) => void;
}

interface LogData {
  type: 'minification' | 'conversion';
  message: string;
}

interface Logger {
  onLogUpdate: (callback: (data: LogData) => void) => void;
}

interface Window {
  api: API;
  electronAPI: ElectronAPI;
  logger: Logger;
  agent: AgentAPI;
}

declare global {
  namespace Electron {
    interface Dialog {
      showOpenDialog(options: any): Promise<OpenDialogResult>;
    }
  }
}

export {};

declare global {
  interface Window {
    api: {
      selectFolder: () => Promise<string | null>;
      minifyFiles: (formData: any) => Promise<any>;
      processCode: (formData: any) => Promise<any>;
      getAvailableModels: () => Promise<string[]>;
    };
    electronAPI: {
      logMessage: (message: string) => void;
      onMigrationProgress: (callback: (message: string) => void) => void;
    };
    logger: Logger;
    agent: AgentAPI;
    iaAgent: IAAgentAPI;
  }
}

interface AgentAPI {
  createFolder: (folderPath: string) => Promise<any>;
  move: (src: string, dest: string) => Promise<any>;
  rename: (oldPath: string, newPath: string) => Promise<any>;
  delete: (targetPath: string) => Promise<any>;
  writeFile: (targetPath: string, content: string) => Promise<any>;
  readFile: (targetPath: string) => Promise<any>;
}

interface IAAgentSuggestion {
  type: 'move' | 'rename' | 'create' | 'delete' | 'modify';
  description: string;
  path?: string;
  destination?: string;
  newName?: string;
  content?: string;
}

interface IAAgentAPI {
  analyzeCode: (options: any, files: any[]) => Promise<{
    success: boolean;
    suggestions?: IAAgentSuggestion[];
    error?: string;
  }>;
  executeSuggestions: (suggestions: IAAgentSuggestion[], outputFolder: string) => Promise<{
    success: boolean;
    results?: Array<{
      suggestion: IAAgentSuggestion;
      success: boolean;
      error?: string;
    }>;
    error?: string;
  }>;
}