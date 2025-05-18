export interface ConversionOptions {
  targetLanguage: string;
  provider: "openai" | "gemini" | "anthropic" | "llama";
  apiKey?: string;
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
