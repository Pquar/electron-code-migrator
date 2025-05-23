import * as fs from "fs-extra";
import * as path from "path";
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
  logMessage("Iniciando chamada à API Llama...");

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
      await fs.writeFile(tempFilePath, minifiedContent);

      // Adicionar à lista de arquivos processados com métricas
      minifiedFiles.push({
        original: filePath,
        minified: tempFilePath,
        originalTokens: originalTokenCount,
        minifiedTokens: minifiedTokenCount,
        originalSize: formatFileSize(originalSize),
        minifiedSize: formatFileSize(minifiedSize),
      });

      console.log(`Arquivo minificado: ${relativePath}`);
      console.log(`Tokens: ${originalTokenCount} -> ${minifiedTokenCount}`);
      console.log(
        `Tamanho: ${formatFileSize(originalSize)} -> ${formatFileSize(
          minifiedSize
        )}`
      );
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
      );

      await fs.writeFile(tempFilePath, content);
      processedFiles.push({ original: filePath, simplified: tempFilePath });
      console.log(`Arquivo simplificado: ${relativePath}`);
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

      await fs.ensureDir(path.dirname(outputFilePath));

      const content = await fs.readFile(file.simplified, "utf-8");
      const convertedContent = await convertCode(
        content,
        path.extname(file.simplified),
        conversionOptions
      );

      await fs.writeFile(outputFilePath, convertedContent);
      convertedFiles.push({
        simplified: file.simplified,
        converted: outputFilePath,
      });
      console.log(
        `Arquivo convertido: ${relativePath} -> ${path.basename(
          outputFilePath
        )}`
      );
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
function estimateTokenCount(text: string): number {
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
