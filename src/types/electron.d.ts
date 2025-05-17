export interface IElectronAPI {
  selectFolder: () => Promise<string | null>;
}

declare global {
  interface Window {
    api: IElectronAPI
  }
}