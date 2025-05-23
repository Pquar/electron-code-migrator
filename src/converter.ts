import axios from "axios";
import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { ConversionOptions } from "./interface";
import { llamaLocalConvert, llamaApiConvert } from "./processor";
import fs from 'fs';
import path from 'path';

/**
 * Converte código de uma linguagem para outra usando o provedor de IA especificado
 * @param code Código fonte a ser convertido
 * @param fileExtension Extensão do arquivo de origem
 * @param options Opções de conversão
 * @returns Código convertido
 */
export async function convertCode(
  code: string,
  fileExtension: string,
  options: ConversionOptions
): Promise<string> {
  // Determina a linguagem de origem baseada na extensão do arquivo
  const sourceLanguage = getLanguageFromExtension(fileExtension);
  
  // Registra a tentativa de conversão
  console.log(`Convertendo de ${sourceLanguage} para ${options.targetLanguage} usando ${options.provider}`);
  
  try {
    switch (options.provider) {
      case "openai":
        return await convertWithOpenAI(code, sourceLanguage, options);
      case "gemini":
        return await convertWithGemini(code, sourceLanguage, options);
      case "anthropic":
        return await convertWithAnthropic(code, sourceLanguage, options);
      case "llama-local":
      case "llama":
        return await convertWithLLama(code, sourceLanguage, options);
      default:
        throw new Error(`Provedor de IA não suportado: ${options.provider}`);
    }
  } catch (error: any) {
    console.error(`Erro na conversão usando ${options.provider}:`, error);
    // Retornar o código original em caso de falha, com um comentário explicativo
    return `// ERRO DE CONVERSÃO: ${error.message}\n\n${code}`;
  }
}

/**
 * Converte código usando a API OpenAI
 */
async function convertWithOpenAI(
  code: string,
  sourceLanguage: string,
  options: ConversionOptions
): Promise<string> {
  if (!options.apiKey) {
    throw new Error("API Key da OpenAI não fornecida");
  }

  const client = new OpenAI({
    apiKey: options.apiKey,
  });

  const prompt = createConversionPrompt(code, sourceLanguage, options.targetLanguage);

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 4000,
    });

    const convertedCode = response.choices[0]?.message?.content || code;
    return sanitizeCode(convertedCode);
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
): Promise<string> {
  if (!options.apiKey) {
    throw new Error("API Key do Gemini não fornecida");
  }

  const apiUrl = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent";
  const prompt = createConversionPrompt(code, sourceLanguage, options.targetLanguage);

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
    return sanitizeCode(convertedCode);
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
): Promise<string> {
  if (!options.apiKey) {
    throw new Error("API Key da Anthropic não fornecida");
  }

  const anthropic = new Anthropic({
    apiKey: options.apiKey,
  });

  const prompt = createConversionPrompt(code, sourceLanguage, options.targetLanguage);

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
    const convertedCode = response.content
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.type)
      .join("\n");

    return sanitizeCode(convertedCode);
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
): Promise<string> {
  try {
    const prompt = createConversionPrompt(code, sourceLanguage, options.targetLanguage);
    
    if (options.provider === "llama") {
      // Valida configurações da API
      if (!options.apiUrl) {
        throw new Error("URL da API Llama não fornecida");
      }
      if (!options.apiKey) {
        throw new Error("API Key do Llama não fornecida");
      }

      // Chama a versão da API HTTP
      const convertedCode = await llamaApiConvert(prompt, options.apiUrl, options.apiKey);
      return sanitizeCode(convertedCode);
    } else {
      // Chama a versão local
      const convertedCode = await llamaLocalConvert(prompt);
      return sanitizeCode(convertedCode);
    }
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