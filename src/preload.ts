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