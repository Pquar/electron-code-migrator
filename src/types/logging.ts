export interface LogData {
  type: string;
  message: string;
}

// Interface para o logger global
export interface Logger {
  onLogUpdate: (callback: (data: LogData) => void) => void;
  onMinifyStart: (callback: (data: { totalFiles: number }) => void) => void;
  onMinifyProgress: (callback: (data: { file: string; progress: number; totalFiles: number; currentFile: number; originalSize?: number; minifiedSize?: number }) => void) => void;
  onMinifyComplete: (callback: (data: { success: boolean; errors?: string[] }) => void) => void;
}