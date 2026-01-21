import { contextBridge, ipcRenderer } from 'electron';
import { RecordingState, RecordingMode } from '../../shared/types';

interface OverlayState {
  state: RecordingState;
  mode: RecordingMode;
  hotkey: string;
}

const overlayAPI = {
  getState: (): Promise<OverlayState> => {
    return ipcRenderer.invoke('overlay:get-state');
  },

  onStateChanged: (callback: (data: OverlayState) => void): (() => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: OverlayState) => callback(data);
    ipcRenderer.on('overlay:state-changed', subscription);
    return () => {
      ipcRenderer.removeListener('overlay:state-changed', subscription);
    };
  },

  onError: (callback: (data: { message: string }) => void): (() => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: { message: string }) => callback(data);
    ipcRenderer.on('overlay:error', subscription);
    return () => {
      ipcRenderer.removeListener('overlay:error', subscription);
    };
  },
};

contextBridge.exposeInMainWorld('overlayAPI', overlayAPI);

export type OverlayAPI = typeof overlayAPI;

declare global {
  interface Window {
    overlayAPI: OverlayAPI;
  }
}
