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

interface Window {
  api: API;
  electronAPI: ElectronAPI;
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
  }
}