interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

export interface IElectronAPI {
  selectFolder: () => Promise<string | null>;
}

declare global {
  interface Window {
    api: IElectronAPI
  }
  
  namespace Electron {
    interface Dialog {
      showOpenDialog(options: any): Promise<OpenDialogResult>;
    }
  }
}