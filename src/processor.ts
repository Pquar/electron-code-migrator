import * as fs from "fs-extra";
import * as path from "path";
import { promisify } from "util";
import { simplifyCode } from "./simplifier";
import { convertCode } from "./converter";
import { LLama } from "llama-node";
import { LLamaCpp, LoadConfig } from "llama-node/dist/llm/llama-cpp.js";
import {
  ConversionOptions,
  ProcessOptions,
  SimplificationOptions,
} from "./interface";
import { app } from "electron";
import axios from "axios";

enum modelos_path {
  llma = "Llama-4-Scout-17B-16E-Instruct-UD-Q3_K_XL.gguf",
  mistral = "mistral-7b-instruct-v0.1.Q5_K_M.gguf",
}

const MODEL_PATH = path.resolve(
  process.env.NODE_ENV === "development"
    ? path.join(process.cwd(), "llms") // Corrigido para apontar para a pasta correta
    : path.join(app.getPath("userData"), "llms"),
  modelos_path.llma
);

// Função para garantir que a pasta llms existe e retorna o caminho
async function ensureLLMsFolder(): Promise<string> {
  const llmsPath = path.join(process.cwd(), "llms");
  await fs.ensureDir(llmsPath);
  return llmsPath;
}

// Função para listar os modelos disponíveis
export async function getAvailableModels(): Promise<string[]> {
  try {
    const llmsPath = await ensureLLMsFolder();
    console.log("Pasta llms:", llmsPath);

    const files = await fs.readdir(llmsPath);
    console.log("Arquivos encontrados:", files);

    return files.filter((file) => file.endsWith(".gguf"));
  } catch (error) {
    console.error("Erro ao listar modelos:", error);
    throw error;
  }
}

interface LlamaGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  repeatPenalty?: number;
  stop?: string[];
}

let llamaInstance: LLama<LLamaCpp> | null = null;

const getLlamaModelPath = async (modelName: string): Promise<string> => {
  const llmsPath = await ensureLLMsFolder();
  return path.join(llmsPath, modelName);
};

async function getLlamaModel(modelName?: string): Promise<LLama<LLamaCpp>> {
  if (llamaInstance) {
    // Se já existe uma instância e não foi solicitado um modelo específico, retorna a instância existente
    if (!modelName) return llamaInstance;
    // Se foi solicitado um modelo específico e é diferente do atual, fecha a instância existente
    llamaInstance = null;
  }

  try {
    console.log("Iniciando carregamento do modelo LLama...");
    const modelPath = await getLlamaModelPath(
      modelName || modelos_path.mistral
    );
    console.log("Caminho do modelo:", modelPath);

    if (!fs.existsSync(modelPath)) {
      throw new Error(`O modelo não foi encontrado no caminho: ${modelPath}`);
    }

    const config: LoadConfig = {
      modelPath,
      enableLogging: true,
      nCtx: 512,
      seed: 0,
      f16Kv: false,
      logitsAll: false,
      vocabOnly: false,
      useMlock: false,
      embedding: false,
      useMmap: true,
      nGpuLayers: 0,
    };

    const llamaModel = new LLama(LLamaCpp as any);
    await llamaModel.load(config);
    llamaInstance = llamaModel;
    console.log("Modelo LLama carregado com sucesso!");
  } catch (error) {
    if (error instanceof Error) {
      console.error("Erro ao carregar o modelo LLama:", error);
      throw new Error(`Erro ao carregar o modelo: ${error.message}`);
    } else {
      console.error("Erro desconhecido ao carregar o modelo LLama:", error);
      throw new Error("Erro desconhecido ao carregar o modelo.");
    }
  }
  return llamaInstance!;
}

async function generateWithLlama(
  model: LLama<LLamaCpp>,
  input: string,
  config: LlamaGenerationConfig = {}
): Promise<string> {
  const defaultConfig: LlamaGenerationConfig = {
    temperature: 0.2,
    topP: 0.9,
    topK: 40,
    maxTokens: 256, // Reduzido para evitar problemas de memória
    repeatPenalty: 1.2,
    stop: ["</s>", "```"],
  };

  const mergedConfig = { ...defaultConfig, ...config };

  try {
    console.log("Iniciando geração com LLama...");
    console.log("Prompt:", input);
    console.log("Configuração de geração:", mergedConfig);

    let output = "";
    await model.createCompletion(
      {
        nThreads: 2, // Reduzido para evitar sobrecarga
        nTokPredict: mergedConfig.maxTokens,
        topK: mergedConfig.topK,
        topP: mergedConfig.topP,
        temp: mergedConfig.temperature,
        repeatPenalty: mergedConfig.repeatPenalty,
        prompt: input,
      },
      (response) => {
        output += response.token;
      }
    );

    console.log("Geração concluída com sucesso.");
    return output.trim();
  } catch (error) {
    if (error instanceof Error) {
      console.error("Erro na geração com LLama:", error);
      throw new Error(`Erro na geração com LLama: ${error.message}`);
    } else {
      console.error("Erro desconhecido na geração com LLama:", error);
      throw new Error("Erro desconhecido na geração com LLama.");
    }
  }
}

export async function llamaApiConvert(
  prompt: string,
  apiUrl: string,
  apiKey: string
): Promise<string> {
  console.log("Iniciando chamada à API Llama...");

  try {
    const response = await axios.post(
      apiUrl,
      {
        model: "deepseek-r1:7b",
        prompt,
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 300000, // 300 segundos de timeout
      }
    );

    if (!response.data) {
      throw new Error("Resposta da API vazia");
    }

    // Tenta obter o resultado da resposta em diferentes formatos comuns de API
    let output = "";
    if (response.data.completion) {
      output = response.data.completion;
    } else if (response.data.response) {
      output = response.data.response;
    } else if (response.data.choices && response.data.choices[0]) {
      output =
        response.data.choices[0].text || response.data.choices[0].content || "";
    } else if (response.data.result) {
      output = response.data.result;
    } else if (response.data.text) {
      output = response.data.text;
    } else if (response.data.output) {
      output = response.data.output;
    } else if (response.data.text) {
      output = response.data.text;
    } else if (typeof response.data === "string") {
      output = response.data;
    } else {
      throw new Error("Formato de resposta da API não reconhecido");
    }

    // Limpa marcações de código e texto explicativo
    output = output.replace(/```[\w]*\n?/g, "").replace(/```$/g, "");

    // Tenta extrair apenas o código, removendo texto explicativo
    const codeMatch = output.match(
      /^[\s\S]*?((?:import|package|using|#include|function|class|def|pub|const|let|var|void|int|public|private)[\s\S]*$)/
    );
    if (codeMatch && codeMatch[1]) {
      output = codeMatch[1];
    }

    const trimmedOutput = output.trim();
    if (!trimmedOutput) {
      throw new Error("A API retornou uma resposta vazia após o processamento");
    }

    console.log("Código convertido com sucesso via API Llama");
    return trimmedOutput;
  } catch (error: any) {
    console.error("Erro na conversão via API Llama:", error);
    throw new Error(`Erro na conversão via API Llama: ${error.message}`);
  }
}

export async function llamaLocalConvert(prompt: string): Promise<string> {
  try {
    const model = await getLlamaModel();

    // Configura os parâmetros de geração
    const completion = await model.createCompletion(
      {
        nThreads: 4,
        nTokPredict: 512, // Limita o número de tokens previstos
        topK: 40,
        topP: 0.1,
        temp: 0.2,
        repeatPenalty: 1,
        prompt,
      },
      (response) => {
        process.stdout.write(response.token);
      }
    );

    let output = (completion.tokens || []).join("");

    output = output.replace(/```[\w]*\n/g, "").replace(/```$/g, "");

    // Remove explicações antes ou depois do código
    const codeMatch = output.match(
      /^[\s\S]*?((?:import|package|using|#include|function|class|def|pub|const|let|var|void|int|public|private)[\s\S]*$)/
    );
    if (codeMatch && codeMatch[1]) {
      output = codeMatch[1];
    }

    return output.trim();
  } catch (error: Error | any) {
    console.error("Erro na conversão local com LLama:", error);
    throw new Error(`Erro na conversão: ${error.message}`);
  }
}

export async function minifyFiles(options: ProcessOptions): Promise<{
  minifiedFiles: Array<{
    original: string;
    minified: string;
    originalTokens: number;
    minifiedTokens: number;
    originalSize: string;
    minifiedSize: string;
  }>;
  sizeReduction: number;
  totalOriginalSize: string;
  totalMinifiedSize: string;
  totalOriginalTokens: number;
  totalMinifiedTokens: number;
}> {
  const { sourceFolder, tempFolder, simplificationOptions } = options;

  // Verificar e criar a pasta temporária se não existir
  await fs.ensureDir(tempFolder);
  // Obter lista de arquivos na pasta de origem
  const sourceFiles = await getAllFiles(sourceFolder);
  
  // Enviar contagem total de arquivos para acompanhamento de progresso
  process.send?.({ type: 'minification-file-count', count: sourceFiles.length });
  
  const minifiedFiles: Array<{
    original: string;
    minified: string;
    originalTokens: number;
    minifiedTokens: number;
    originalSize: string;
    minifiedSize: string;
  }> = [];

  let originalTotalSize = 0;
  let minifiedTotalSize = 0;
  let totalOriginalTokens = 0;
  let totalMinifiedTokens = 0;

  for (const filePath of sourceFiles) {
    try {
      const relativePath = path.relative(sourceFolder, filePath);
      const tempFilePath = path.join(tempFolder, relativePath);

      // Garantir que os diretórios existam
      await fs.ensureDir(path.dirname(tempFilePath));

      // Ler o conteúdo do arquivo original
      const originalContent = await fs.readFile(filePath, "utf-8");
      const originalSize = Buffer.byteLength(originalContent, "utf-8");
      const originalTokenCount = estimateTokenCount(originalContent);
      originalTotalSize += originalSize;
      totalOriginalTokens += originalTokenCount;

      // Aplicar as simplificações selecionadas
      const minifiedContent = await simplifyCode(
        originalContent,
        path.extname(filePath),
        simplificationOptions
      );

      // Calcular tamanho e tokens após minificação
      const minifiedSize = Buffer.byteLength(minifiedContent, "utf-8");
      const minifiedTokenCount = estimateTokenCount(minifiedContent);
      minifiedTotalSize += minifiedSize;
      totalMinifiedTokens += minifiedTokenCount;

      // Escrever o conteúdo simplificado no arquivo temporário
      await fs.writeFile(tempFilePath, minifiedContent);      // Adicionar à lista de arquivos processados com métricas
      minifiedFiles.push({
        original: filePath,
        minified: tempFilePath,
        originalTokens: originalTokenCount,
        minifiedTokens: minifiedTokenCount,
        originalSize: formatFileSize(originalSize),
        minifiedSize: formatFileSize(minifiedSize),
      });      // Emitir progresso para a interface
      const progress = {
        file: relativePath,
        tokens: {
          before: originalTokenCount,
          after: minifiedTokenCount
        },
        size: {
          before: formatFileSize(originalSize),
          after: formatFileSize(minifiedSize),
          beforeBytes: originalSize,
          afterBytes: minifiedSize
        },
        fileInfo: `${path.extname(filePath)} | ${path.basename(filePath)} | Redução: ${Math.round((1 - minifiedSize / originalSize) * 100)}%`
      };
      
      process.send?.({ type: 'minification-progress', data: progress });
    } catch (error) {
      console.error(`Erro ao minificar arquivo ${filePath}:`, error);
    }
  }

  // Calcular a redução percentual de tamanho
  const sizeReduction =
    originalTotalSize > 0
      ? Math.round((1 - minifiedTotalSize / originalTotalSize) * 100)
      : 0;

  return {
    minifiedFiles,
    sizeReduction,
    totalOriginalSize: formatFileSize(originalTotalSize),
    totalMinifiedSize: formatFileSize(minifiedTotalSize),
    totalOriginalTokens,
    totalMinifiedTokens,
  };
}

export async function processFiles(options: ProcessOptions): Promise<{
  processedFiles: Array<{ original: string; simplified: string }>;
  convertedFiles: Array<{ simplified: string; converted: string }>;
}> {
  const {
    sourceFolder,
    tempFolder,
    outputFolder,
    simplificationOptions,
    conversionOptions,
  } = options;

  // Etapa 1: Verificar pastas e criar se não existirem
  await fs.ensureDir(tempFolder);
  await fs.ensureDir(outputFolder);
  // Etapa 2: Copiar arquivos da pasta base para a pasta temporária com simplificações
  const sourceFiles = await getAllFiles(sourceFolder);
  
  // Enviar contagem total de arquivos para acompanhamento de progresso
  process.send?.({ type: 'file-count', count: sourceFiles.length });
  
  const processedFiles = [];

  for (const filePath of sourceFiles) {
    try {
      const relativePath = path.relative(sourceFolder, filePath);
      const tempFilePath = path.join(tempFolder, relativePath);

      await fs.ensureDir(path.dirname(tempFilePath));

      let content = await fs.readFile(filePath, "utf-8");
      content = await simplifyCode(
        content,
        path.extname(filePath),
        simplificationOptions
      );      await fs.writeFile(tempFilePath, content);
      processedFiles.push({ original: filePath, simplified: tempFilePath });      // Emitir progresso para a interface
      process.send?.({ 
        type: 'conversion-progress', 
        data: { 
          status: 'simplified',
          file: relativePath,
          fileInfo: `${formatFileSize(Buffer.byteLength(content, "utf-8"))} | ${estimateTokenCount(content)} tokens`
        }
      });
    } catch (error) {
      console.error(`Erro ao processar arquivo ${filePath}:`, error);
    }
  }

  // Etapa 3: Converter arquivos da pasta temporária para a pasta de saída
  const convertedFiles = [];

  for (const file of processedFiles) {
    try {
      const relativePath = path.relative(tempFolder, file.simplified);
      const outputFilePath = path.join(
        outputFolder,
        getConvertedFilename(relativePath, conversionOptions.targetLanguage)
      );

      await fs.ensureDir(path.dirname(outputFilePath));      const content = await fs.readFile(file.simplified, "utf-8");
      const conversionResult = await convertCode(
        content,
        path.extname(file.simplified),
        conversionOptions
      );
      
      // Extrair o código convertido do resultado
      const convertedContent = conversionResult.code;

      await fs.writeFile(outputFilePath, convertedContent);
      convertedFiles.push({
        simplified: file.simplified,
        converted: outputFilePath,
        metrics: conversionResult.metrics
      });
      
      // Obter métricas de tokens da conversão
      const tokensInfo = conversionResult.metrics?.tokens || {
        sent: estimateTokenCount(content),
        received: estimateTokenCount(convertedContent)
      };
        const originalSizeBytes = Buffer.byteLength(content, "utf-8");
      const convertedSizeBytes = Buffer.byteLength(convertedContent, "utf-8");
      const fileSize = formatFileSize(convertedSizeBytes);
      const processingTime = conversionResult.metrics?.processingTime || 0;
      
      // Emitir progresso para a interface
      process.send?.({
        type: 'conversion-progress',
        data: {
          status: 'converted',
          file: relativePath,
          output: path.basename(outputFilePath),
          fileInfo: `${fileSize} | ${tokensInfo.received} tokens | Tempo: ${processingTime}ms`,
          tokensInfo: tokensInfo,
          fileSize: {
            original: originalSizeBytes,
            processed: convertedSizeBytes
          }
        }
      });
    } catch (error) {
      console.error(`Erro ao converter arquivo ${file.simplified}:`, error);
    }
  }

  return {
    processedFiles,
    convertedFiles,
  };
}

async function getAllFiles(dir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    const result: string[] = [];

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        const subFiles = await getAllFiles(filePath);
        result.push(...subFiles);
      } else {
        // Ignorar arquivos que não devem ser processados
        const ignoredExtensions = [
          ".exe",
          ".dll",
          ".obj",
          ".bin",
          ".jpg",
          ".png",
          ".gif",
        ];
        if (!ignoredExtensions.includes(path.extname(filePath).toLowerCase())) {
          result.push(filePath);
        }
      }
    }

    return result;
  } catch (error) {
    console.error(`Erro ao listar arquivos em ${dir}:`, error);
    return [];
  }
}

function getConvertedFilename(
  filePath: string,
  targetLanguage: string
): string {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const dir = path.dirname(filePath);

  const langExtMap: Record<string, string> = {
    javascript: ".js",
    typescript: ".ts",
    python: ".py",
    java: ".java",
    csharp: ".cs",
    cpp: ".cpp",
    ruby: ".rb",
    go: ".go",
    rust: ".rs",
    php: ".php",
    kotlin: ".kt",
    swift: ".swift",
    dart: ".dart",
  };

  const newExt = langExtMap[targetLanguage.toLowerCase()] || ext;
  return path.join(dir, `${base}${newExt}`);
}

// Função auxiliar para estimar o número de tokens em um texto
export function estimateTokenCount(text: string): number {
  // Remove comentários de múltiplas linhas
  text = text.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove comentários de linha única
  text = text.replace(/\/\/.*/g, "");

  // Divide o texto em palavras e símbolos
  const words = text.split(/\s+/).filter(Boolean);
  const symbols = text.match(/[{}()\[\]<>=+\-*/%!&|^~;:,]/g) || [];
  const stringLiterals = text.match(/"[^"]*"|'[^']*'|`[^`]*`/g) || [];

  // Cada palavra é aproximadamente 1-2 tokens
  // Cada símbolo é geralmente 1 token
  // Strings literais são calculadas pelo comprimento
  const wordTokens = words.length;
  const symbolTokens = symbols.length;
  const stringTokens = stringLiterals.reduce(
    (acc, str) => acc + Math.ceil(str.length / 4),
    0
  );

  return wordTokens + symbolTokens + stringTokens;
}

// Função auxiliar para formatar o tamanho do arquivo
function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// Funções utilitárias para manipulação de arquivos e pastas por instrução do agente
export async function createFolder(folderPath: string): Promise<void> {
  await fs.ensureDir(folderPath);
}

export async function moveFileOrFolder(src: string, dest: string): Promise<void> {
  await fs.move(src, dest, { overwrite: true });
}

export async function renameFileOrFolder(oldPath: string, newPath: string): Promise<void> {
  await fs.move(oldPath, newPath, { overwrite: true });
}

export async function deleteFileOrFolder(targetPath: string): Promise<void> {
  await fs.remove(targetPath);
}

export async function writeFile(targetPath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, content, 'utf-8');
}

export async function readFile(targetPath: string): Promise<string> {
  return await fs.readFile(targetPath, 'utf-8');
}

// Interface para sugestões do agente de IA
export interface AgentSuggestion {
  type: 'move' | 'rename' | 'create' | 'delete' | 'modify';
  description: string;
  path?: string;
  destination?: string;
  newName?: string;
  content?: string;
}

/**
 * Agente IA que analisa o código e sugere reorganizações
 * @param options Opções de processo
 * @param files Lista de arquivos convertidos
 * @returns Sugestões de reorganização
 */
export async function analyzeCodeWithAgent(
  options: ProcessOptions,
  files: Array<{ simplified: string; converted: string }>
): Promise<AgentSuggestion[]> {
  const { conversionOptions, outputFolder } = options;
  const suggestions: AgentSuggestion[] = [];

  // Preparar um resumo dos arquivos para enviar à IA
  const filesSummary = await Promise.all(files.map(async (file) => {
    const relativePath = path.relative(outputFolder, file.converted);
    const content = await fs.readFile(file.converted, 'utf-8');
    // Obter apenas as primeiras linhas para economizar tokens
    const preview = content.split('\n').slice(0, 10).join('\n');
    return { path: relativePath, preview };
  }));

  // Construir o prompt para a IA
  const prompt = `
Você é um assistente especializado em organizar código. Analise os arquivos convertidos para ${conversionOptions.targetLanguage} e sugira reorganizações que tornem o projeto mais limpo e bem estruturado.

Sugestões podem incluir:
1. Mover arquivos para pastas mais apropriadas
2. Renomear arquivos para nomes mais descritivos
3. Criar novas pastas para agrupar arquivos relacionados
4. Deletar arquivos temporários ou desnecessários
5. Modificar conteúdo de arquivos para corrigir problemas de compatibilidade

Lista de arquivos convertidos:
${JSON.stringify(filesSummary, null, 2)}

Forneça suas sugestões em formato JSON com esta estrutura:
[
  {
    "type": "move",
    "description": "Mover arquivo X para pasta Y para melhor organização",
    "path": "caminho/para/arquivo",
    "destination": "novo/caminho"
  },
  {
    "type": "rename",
    "description": "Renomear arquivo para nome mais descritivo",
    "path": "caminho/para/arquivo",
    "newName": "novo-nome.ext"
  },
  {
    "type": "create",
    "description": "Criar nova pasta para agrupar arquivos relacionados",
    "path": "nova/pasta"
  },
  {
    "type": "delete",
    "description": "Deletar arquivo temporário",
    "path": "caminho/para/arquivo/temp"
  },
  {
    "type": "modify",
    "description": "Corrigir problema de compatibilidade",
    "path": "caminho/para/arquivo",
    "content": "novo conteúdo"
  }
]

Limite-se a no máximo 5 sugestões, priorizando as mais importantes.
`;

  try {
    // Escolher a API de IA com base nas opções configuradas
    let aiResponse: string;
    
    if (conversionOptions.provider === "openai" || conversionOptions.provider === "gemini" || conversionOptions.provider === "anthropic") {
      // Usar APIs externas para análise mais sofisticada
      aiResponse = await llamaApiConvert(prompt, conversionOptions.apiUrl || "", conversionOptions.apiKey || "");
    } else {
      // Usar o Llama local como fallback
      aiResponse = await llamaApiConvert(prompt, "http://127.0.0.1:11434/api/generate", "test");
    }
      // Extrair JSON da resposta
    const jsonMatch = aiResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      try {
        const parsedSuggestions = JSON.parse(jsonMatch[0]) as AgentSuggestion[];
        return parsedSuggestions.filter(s => 
          s.type && 
          s.description && 
          (s.path || s.type === 'create')
        );
      } catch (parseError) {
        console.error("Erro ao analisar sugestões JSON:", parseError);
        return [];
      }
    }
    
    return [];
  } catch (error) {
    console.error("Erro ao analisar código com agente IA:", error);
    return [];
  }
}

/**
 * Executa as sugestões do agente IA para reorganizar arquivos
 * @param suggestions Lista de sugestões
 * @param outputFolder Pasta de saída
 * @returns Relatório de ações executadas
 */
export async function executeAgentSuggestions(
  suggestions: AgentSuggestion[],
  outputFolder: string
): Promise<Array<{ suggestion: AgentSuggestion; success: boolean; error?: string }>> {
  const results = [];
  
  for (const suggestion of suggestions) {
    try {
      switch (suggestion.type) {
        case 'move':
          if (suggestion.path && suggestion.destination) {
            const src = path.join(outputFolder, suggestion.path);
            const dest = path.join(outputFolder, suggestion.destination);
            await fs.ensureDir(path.dirname(dest));
            await moveFileOrFolder(src, dest);
            results.push({ suggestion, success: true });
          }
          break;
          
        case 'rename':
          if (suggestion.path && suggestion.newName) {
            const oldPath = path.join(outputFolder, suggestion.path);
            const newPath = path.join(path.dirname(oldPath), suggestion.newName);
            await renameFileOrFolder(oldPath, newPath);
            results.push({ suggestion, success: true });
          }
          break;
          
        case 'create':
          if (suggestion.path) {
            const dirPath = path.join(outputFolder, suggestion.path);
            await createFolder(dirPath);
            results.push({ suggestion, success: true });
          }
          break;
          
        case 'delete':
          if (suggestion.path) {
            const targetPath = path.join(outputFolder, suggestion.path);
            await deleteFileOrFolder(targetPath);
            results.push({ suggestion, success: true });
          }
          break;
          
        case 'modify':
          if (suggestion.path && suggestion.content) {
            const filePath = path.join(outputFolder, suggestion.path);
            await writeFile(filePath, suggestion.content);
            results.push({ suggestion, success: true });
          }
          break;
      }
    } catch (error: any) {
      results.push({ 
        suggestion, 
        success: false, 
        error: error.message 
      });
    }
  }
  
  return results;
}
