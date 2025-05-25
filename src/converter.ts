import axios from "axios";
import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { ConversionOptions, ConversionResult, TokenMetrics } from "./interface";
import { llamaLocalConvert, llamaApiConvert, estimateTokenCount } from "./processor";
import fs from 'fs';
import path from 'path';

/**
 * Converts code from one language to another using the specified AI provider
 * @param code Source code to be converted
 * @param fileExtension Source file extension
 * @param options Conversion options
 * @returns Object with converted code and metrics
 */
export async function convertCode(
  code: string,
  fileExtension: string,
  options: ConversionOptions
): Promise<ConversionResult> {
  // Determine source language based on file extension
  const sourceLanguage = getLanguageFromExtension(fileExtension);
  
  // Log conversion attempt
  console.log(`Converting from ${sourceLanguage} to ${options.targetLanguage} using ${options.provider}`);
  
  // Start time counter
  const startTime = Date.now();
    try {
    let result: ConversionResult;
    
    switch (options.provider) {
      case "openai":
        result = await convertWithOpenAI(code, sourceLanguage, options);
        break;
      case "gemini":
        result = await convertWithGemini(code, sourceLanguage, options);
        break;
      case "anthropic":
        result = await convertWithAnthropic(code, sourceLanguage, options);
        break;
      case "llama-local":
      case "llama":
        result = await convertWithLLama(code, sourceLanguage, options);
        break;
      default:
        throw new Error(`Unsupported AI provider: ${options.provider}`);
    }
    
    // Calculate total processing time if not already calculated
    if (result.metrics && !result.metrics.processingTime) {
      result.metrics.processingTime = Date.now() - startTime;
    }
    
    return result;  } catch (error: any) {
    console.error(`Conversion error using ${options.provider}:`, error);
    // Return original code in case of failure, with an explanatory comment
    return {
      code: `// CONVERSION ERROR: ${error.message}\n\n${code}`,
      metrics: {
        tokens: { sent: estimateTokenCount(code), received: 0 },
        processingTime: Date.now() - startTime
      }
    };
  }
}

/**
 * Convert code using OpenAI API
 */
async function convertWithOpenAI(
  code: string,
  sourceLanguage: string,
  options: ConversionOptions
): Promise<ConversionResult> {
  if (!options.apiKey) {
    throw new Error("OpenAI API Key not provided");
  }

  const client = new OpenAI({
    apiKey: options.apiKey,
  });

  const prompt = createConversionPrompt(code, sourceLanguage, options.targetLanguage, options.customPrompt);
  const promptTokens = estimateTokenCount(prompt);
  const startTime = Date.now();

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 4000,
    });

    const convertedCode = response.choices[0]?.message?.content || code;
    const sanitizedCode = sanitizeCode(convertedCode);
    const outputTokens = estimateTokenCount(sanitizedCode);
    
    // Usar valores reais da API se disponíveis, caso contrário usar nossa estimativa
    const tokenMetrics: TokenMetrics = {
      sent: response.usage?.prompt_tokens || promptTokens,
      received: response.usage?.completion_tokens || outputTokens
    };
    
    return {
      code: sanitizedCode,
      metrics: {
        tokens: tokenMetrics,
        processingTime: Date.now() - startTime
      }
    };  } catch (error: any) {
    console.error("Error calling OpenAI API:", error);
    throw new Error(`Failed to convert code using OpenAI: ${error.message}`);
  }
}

/**
 * Convert code using Gemini API
 */
async function convertWithGemini(
  code: string,
  sourceLanguage: string,
  options: ConversionOptions
): Promise<ConversionResult> {
  if (!options.apiKey) {
    throw new Error("Gemini API Key not provided");
  }

  const apiUrl = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent";
  const prompt = createConversionPrompt(code, sourceLanguage, options.targetLanguage, options.customPrompt);
  const promptTokens = estimateTokenCount(prompt);
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${apiUrl}?key=${options.apiKey}`,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4000,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const convertedCode = response.data.candidates[0]?.content?.parts[0]?.text || code;
    const sanitizedCode = sanitizeCode(convertedCode);
    const outputTokens = estimateTokenCount(sanitizedCode);
      // Gemini doesn't directly return token counts, so we use our estimate
    const tokenMetrics: TokenMetrics = {
      sent: promptTokens,
      received: outputTokens
    };
    
    return {
      code: sanitizedCode,
      metrics: {
        tokens: tokenMetrics,
        processingTime: Date.now() - startTime
      }
    };
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    throw new Error(`Failed to convert code using Gemini: ${error.message}`);
  }
}

/**
 * Convert code using Anthropic API
 */
async function convertWithAnthropic(
  code: string,
  sourceLanguage: string,
  options: ConversionOptions
): Promise<ConversionResult> {
  if (!options.apiKey) {
    throw new Error("Anthropic API Key not provided");
  }

  const anthropic = new Anthropic({
    apiKey: options.apiKey,
  });

  const prompt = createConversionPrompt(code, sourceLanguage, options.targetLanguage, options.customPrompt);
  const promptTokens = estimateTokenCount(prompt);
  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 4000,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Concatenar todos os blocos de texto da resposta
    const convertedCodeBlocks = response.content
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => {
        if (block.type === "text" && typeof block.text === "string") {
          return block.text;
        }
        return "";
      })
      .join("\n");

    const sanitizedCode = sanitizeCode(convertedCodeBlocks);
    const outputTokens = estimateTokenCount(sanitizedCode);
    
    // Anthropic retorna estimativas de token
    const tokenMetrics: TokenMetrics = {
      sent: response.usage?.input_tokens || promptTokens,
      received: response.usage?.output_tokens || outputTokens
    };
    
    return {
      code: sanitizedCode,
      metrics: {
        tokens: tokenMetrics,
        processingTime: Date.now() - startTime
      }
    };  } catch (error: any) {
    console.error("Error calling Anthropic API:", error);
    throw new Error(`Failed to convert code using Anthropic: ${error.message}`);
  }
}

/**
 * Convert code using LLama (local or API)
 */
async function convertWithLLama(
  code: string,
  sourceLanguage: string,
  options: ConversionOptions
): Promise<ConversionResult> {
  const prompt = createConversionPrompt(code, sourceLanguage, options.targetLanguage, options.customPrompt);
  const promptTokens = estimateTokenCount(prompt);
  const startTime = Date.now();
  
  try {
    let convertedCode: string;
    
    if (options.provider === "llama") {
      // Validate API settings
      if (!options.apiUrl) {
        throw new Error("Llama API URL not provided");
      }
      if (!options.apiKey) {
        throw new Error("Llama API Key not provided");
      }

      // Chama a versão da API HTTP
      convertedCode = await llamaApiConvert(prompt, options.apiUrl, options.apiKey);
    } else {
      // Chama a versão local
      convertedCode = await llamaLocalConvert(prompt);
    }
    
    const sanitizedCode = sanitizeCode(convertedCode);
    const outputTokens = estimateTokenCount(sanitizedCode);
      // Llama doesn't return token counts, so we use our estimate
    const tokenMetrics: TokenMetrics = {
      sent: promptTokens,
      received: outputTokens
    };
    
    return {
      code: sanitizedCode,
      metrics: {
        tokens: tokenMetrics,
        processingTime: Date.now() - startTime
      }
    };
  } catch (error: any) {
    console.error(`Error converting with ${options.provider === "llama" ? "API" : "local"} Llama:`, error);
    throw new Error(`Failed to convert code using ${options.provider === "llama" ? "API" : "local"} Llama: ${error.message}`);
  }
}

/**
 * Creates an appropriate prompt for code conversion
 */
function createConversionPrompt(
  code: string,
  sourceLanguage: string,
  targetLanguage: string,
  customPrompt?: string
): string {
  if (!customPrompt) {
    // Se não houver prompt customizado, use um prompt básico
    return `Convert this ${sourceLanguage} code to ${targetLanguage}, maintaining functionality:

\`\`\`${sourceLanguage}
${code}
\`\`\``;
  }

  // Substituir placeholders no prompt customizado
  return customPrompt
    .replace(/\{sourceLanguage\}/g, sourceLanguage)
    .replace(/\{targetLanguage\}/g, targetLanguage)
    .replace(/\{code\}/g, code);
}

/**
 * Limpa o código gerado para remover possíveis marcações e explicações
 */
function sanitizeCode(codeText: string): string {
  // Remove blocos de código markdown
  let cleanedCode = codeText.replace(/```[\w]*\n/g, "").replace(/```$/g, "");
  
  // Remove explicações antes ou depois do código
  const codeBlockMatch = cleanedCode.match(/^[\s\S]*?((?:import|package|using|#include|function|class|def|pub|const|let|var|void|int|public|private)[\s\S]*$)/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleanedCode = codeBlockMatch[1];
  }
  
  return cleanedCode.trim();
}

export async function convertFileToLanguage(
  filePath: string,
  targetLanguage: string,
  apiUrl: string,
  apiKey: string
): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }

  const code = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath);
  const sourceLanguage = getLanguageFromExtension(ext);
  const prompt = createConversionPrompt(code, sourceLanguage, targetLanguage);

  const result = await llamaApiConvert(prompt, apiUrl, apiKey);
  return result;
}

/**
 * Determina a linguagem com base na extensão do arquivo
 */
function getLanguageFromExtension(fileExtension: string): string {
  const extensionMap: Record<string, string> = {
    ".js": "javascript",
    ".ts": "typescript",
    ".py": "python",
    ".java": "java",
    ".cs": "csharp",
    ".cpp": "cpp",
    ".c": "c",
    ".rb": "ruby",
    ".go": "go",
    ".rs": "rust",
    ".php": "php",
    ".kt": "kotlin",
    ".swift": "swift",
    ".dart": "dart",
    ".scala": "scala",
    ".hs": "haskell",
    ".ex": "elixir",
    ".r": "r",
    ".lua": "lua",
    ".sh": "bash",
  };

  return extensionMap[fileExtension.toLowerCase()] || "plaintext"; // Retorna 'plaintext' como padrão em vez de 'unknown'
}