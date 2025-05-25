import axios from "axios";
import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { ConversionOptions, ConversionResult, TokenMetrics } from "./interface";
import { llamaLocalConvert, llamaApiConvert, estimateTokenCount } from "./processor";
import fs from 'fs';
import path from 'path';

/**
 * Converte código de uma linguagem para outra usando o provedor de IA especificado
 * @param code Código fonte a ser convertido
 * @param fileExtension Extensão do arquivo de origem
 * @param options Opções de conversão
 * @returns Objeto com código convertido e métricas
 */
export async function convertCode(
  code: string,
  fileExtension: string,
  options: ConversionOptions
): Promise<ConversionResult> {
  // Determina a linguagem de origem baseada na extensão do arquivo
  const sourceLanguage = getLanguageFromExtension(fileExtension);
  
  // Registra a tentativa de conversão
  console.log(`Convertendo de ${sourceLanguage} para ${options.targetLanguage} usando ${options.provider}`);
  
  // Iniciar contador de tempo
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
        throw new Error(`Provedor de IA não suportado: ${options.provider}`);
    }
    
    // Calcular tempo total de processamento se ainda não foi calculado
    if (result.metrics && !result.metrics.processingTime) {
      result.metrics.processingTime = Date.now() - startTime;
    }
    
    return result;
  } catch (error: any) {
    console.error(`Erro na conversão usando ${options.provider}:`, error);
    // Retornar o código original em caso de falha, com um comentário explicativo
    return {
      code: `// ERRO DE CONVERSÃO: ${error.message}\n\n${code}`,
      metrics: {
        tokens: { sent: estimateTokenCount(code), received: 0 },
        processingTime: Date.now() - startTime
      }
    };
  }
}

/**
 * Converte código usando a API OpenAI
 */
async function convertWithOpenAI(
  code: string,
  sourceLanguage: string,
  options: ConversionOptions
): Promise<ConversionResult> {
  if (!options.apiKey) {
    throw new Error("API Key da OpenAI não fornecida");
  }

  const client = new OpenAI({
    apiKey: options.apiKey,
  });

  const prompt = createConversionPrompt(code, sourceLanguage, options.targetLanguage);
  const promptTokens = estimateTokenCount(prompt);
  const startTime = Date.now();

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4",
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
    };
  } catch (error: any) {
    console.error("Erro ao chamar a API OpenAI:", error);
    throw new Error(`Falha ao converter o código usando OpenAI: ${error.message}`);
  }
}

/**
 * Converte código usando a API Gemini
 */
async function convertWithGemini(
  code: string,
  sourceLanguage: string,
  options: ConversionOptions
): Promise<ConversionResult> {
  if (!options.apiKey) {
    throw new Error("API Key do Gemini não fornecida");
  }

  const apiUrl = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent";
  const prompt = createConversionPrompt(code, sourceLanguage, options.targetLanguage);
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
    
    // Gemini não retorna contagens de tokens de forma direta, então usamos nossa estimativa
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
    console.error("Erro ao chamar a API Gemini:", error);
    throw new Error(`Falha ao converter o código usando Gemini: ${error.message}`);
  }
}

/**
 * Converte código usando a API Anthropic
 */
async function convertWithAnthropic(
  code: string,
  sourceLanguage: string,
  options: ConversionOptions
): Promise<ConversionResult> {
  if (!options.apiKey) {
    throw new Error("API Key da Anthropic não fornecida");
  }

  const anthropic = new Anthropic({
    apiKey: options.apiKey,
  });

  const prompt = createConversionPrompt(code, sourceLanguage, options.targetLanguage);
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
    };
  } catch (error: any) {
    console.error("Erro ao chamar a API Anthropic:", error);
    throw new Error(`Falha ao converter o código usando Anthropic: ${error.message}`);
  }
}

/**
 * Converte código usando o LLama (local ou API)
 */
async function convertWithLLama(
  code: string,
  sourceLanguage: string,
  options: ConversionOptions
): Promise<ConversionResult> {
  const prompt = createConversionPrompt(code, sourceLanguage, options.targetLanguage);
  const promptTokens = estimateTokenCount(prompt);
  const startTime = Date.now();
  
  try {
    let convertedCode: string;
    
    if (options.provider === "llama") {
      // Valida configurações da API
      if (!options.apiUrl) {
        throw new Error("URL da API Llama não fornecida");
      }
      if (!options.apiKey) {
        throw new Error("API Key do Llama não fornecida");
      }

      // Chama a versão da API HTTP
      convertedCode = await llamaApiConvert(prompt, options.apiUrl, options.apiKey);
    } else {
      // Chama a versão local
      convertedCode = await llamaLocalConvert(prompt);
    }
    
    const sanitizedCode = sanitizeCode(convertedCode);
    const outputTokens = estimateTokenCount(sanitizedCode);
    
    // Llama não retorna contagens de tokens, então usamos nossa estimativa
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
    console.error(`Erro ao converter com ${options.provider === "llama" ? "API" : "local"} Llama:`, error);
    throw new Error(`Falha ao converter o código usando ${options.provider === "llama" ? "API" : "local"} Llama: ${error.message}`);
  }
}

/**
 * Cria um prompt adequado para a conversão de código
 */
function createConversionPrompt(
  code: string,
  sourceLanguage: string,
  targetLanguage: string
): string {
  return `
# Instruções de Conversão de Código

- Linguagem de origem: ${sourceLanguage}
- Linguagem de destino: ${targetLanguage}

## Código original:
\`\`\`${sourceLanguage}
${code}
\`\`\`

## Diretrizes:
1. Converta o código acima para ${targetLanguage}
2. Mantenha a mesma funcionalidade e lógica
3. Adapte para os padrões e melhores práticas de ${targetLanguage}
4. Mantenha os nomes de variáveis e funções consistentes, a menos que violem convenções de ${targetLanguage}
5. Inclua comentários importantes apenas onde necessário para explicar a conversão
6. Não inclua texto explicativo antes ou depois do código

Retorne apenas o código convertido em ${targetLanguage}, sem explicações adicionais.
`;
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