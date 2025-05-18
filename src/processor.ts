import * as fs from "fs-extra";
import * as path from "path";
import { simplifyCode } from "./simplifier";
import { convertCode } from "./converter";
import { LLama } from "llama-node";
import { LLamaCpp } from "llama-node/dist/llm/llama-cpp.js";
import {
  ConversionOptions,
  ProcessOptions,
  SimplificationOptions,
} from "./interface";

const MODEL_PATH = path.resolve(
  process.env.NODE_ENV === "development"
    ? process.cwd()
    : path.join(process.resourcesPath, "models"),
  "Llama-4-Scout-17B-16E-Instruct-UD-Q3_K_XL.gguf"
);

let llamaInstance: LLama | null = null;

export interface LlamaContext {
  model: LLama;
}

interface LlamaChatSession {
  context: LlamaContext;
  prompt(text: string, options: any): Promise<{ message: { content: string } }>;
}

// Inicializa o modelo LLama
async function getLlamaModel(): Promise<LLama> {
  if (!llamaInstance) {
    try {
      const llamaModel = new LLama(LLamaCpp);
      const config = {
        modelPath: MODEL_PATH,
        enableLogging: true,
        nCtx: 2048, // Contexto maior para processamento de código
        seed: 0,
        f16Kv: false,
        logitsAll: false,
        vocabOnly: false,
        useMlock: false,
        embedding: false,
        useMmap: true,
        nGpuLayers: 0,
      };

      await llamaModel.load(config);
      llamaInstance = llamaModel;
      console.log("Modelo LLama carregado com sucesso!");
    } catch (error) {
      console.error("Erro ao carregar o modelo LLama:", error);
      throw error;
    }
  }
  return llamaInstance;
}

class LlamaContextImpl implements LlamaContext {
  constructor(public model: LLama) {}
}
class LlamaChatSessionImpl implements LlamaChatSession {
  constructor(public context: LlamaContext) {}

  async prompt(
    text: string,
    options: any
  ): Promise<{ message: { content: string } }> {
    try {
      const response = await (this.context.model as any).createCompletion({
        prompt: text,
        temperature: options.temperature || 0.2,
        max_tokens: options.maxTokens || 2048,
        stop: options.stop || ["</s>"],
      });

      return {
        message: {
          content: response.text || "",
        },
      };
    } catch (error) {
      console.error("Erro durante o prompt LLama:", error);
      throw error;
    }
  }
}

export async function llamaLocalConvert(prompt: string): Promise<string> {
  try {
    const model = await getLlamaModel();
    const context = new LlamaContextImpl(model);
    const session = new LlamaChatSessionImpl(context);

    const response = await session.prompt(prompt, {
      temperature: 0.2,
      maxTokens: 2048,
      stop: ["</s>"],
    });

    return response.message.content;
  } catch (error: Error | any) {
    console.error("Erro na conversão local com LLama:", error);
    return `Erro na conversão: ${error.message}`;
  }
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
