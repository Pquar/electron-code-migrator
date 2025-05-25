export interface ConversionOptions {
  targetLanguage: string;
  provider: "openai" | "gemini" | "anthropic" | "llama" | "llama-local";
  apiKey?: string;
  apiUrl?: string;  // API URL for providers that require it
  customPrompt?: string;  // Novo campo para o prompt customizado
}

export interface ProcessOptions {
  sourceFolder: string;
  tempFolder: string;
  outputFolder: string;
  simplificationOptions: SimplificationOptions;
  conversionOptions: ConversionOptions;
}

export interface SimplificationOptions {
  removeComments: boolean;
  reduceKeywords: boolean;
  minify: boolean;
}

export interface TokenMetrics {
  sent: number;
  received: number;
}

export interface ProcessingMetrics {
  startTime: number;
  estimatedEndTime?: number;
  progress: number;
  tokensProcessed: number;
  totalTokens: number;
}

export interface ConversionMetrics {
  tokens: TokenMetrics;
  fileSize: {
    before: string;
    after: string;
  };
  processingTime: number;
}

export interface ConversionResult {
  code: string;
  metrics?: {
    tokens: TokenMetrics;
    processingTime: number;
  };
}
