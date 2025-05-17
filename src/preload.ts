// @ts-ignore
import { ipcRenderer } from "electron";
const contextBridge = (window as any).contextBridge || require('electron').contextBridge;

contextBridge.exposeInMainWorld("api", {
  selectFolder: async () => {
    return await ipcRenderer.invoke("select-folder");
  },
  processCode: (options: any) => {
    return ipcRenderer.invoke("process-code", options);
  },
});