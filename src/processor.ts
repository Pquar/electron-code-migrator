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

enum ModelPaths {
  llama = "Llama-4-Scout-17B-16E-Instruct-UD-Q3_K_XL.gguf",
  mistral = "mistral-7b-instruct-v0.1.Q5_K_M.gguf",
}

const MODEL_PATH = path.resolve(
  process.env.NODE_ENV === "development"
    ? path.join(process.cwd(), "llms") // Point to the correct folder
    : path.join(app.getPath("userData"), "llms"),
  ModelPaths.llama
);

// Ensure the llms folder exists and return its path
async function ensureLLMsFolder(): Promise<string> {
  const llmsPath = path.join(process.cwd(), "llms");
  await fs.ensureDir(llmsPath);
  return llmsPath;
}

// List available models
export async function getAvailableModels(): Promise<string[]> {
  try {
    const llmsPath = await ensureLLMsFolder();
    console.log("LLMs folder:", llmsPath);

    const files = await fs.readdir(llmsPath);
    console.log("Files found:", files);

    return files.filter((file) => file.endsWith(".gguf"));
  } catch (error) {
    console.error("Error listing models:", error);
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
    // If an instance already exists and no specific model was requested, return the existing instance
    if (!modelName) return llamaInstance;
    // If a specific model was requested and it's different from the current one, close the existing instance
    llamaInstance = null;
  }

  try {
    console.log("Starting LLama model loading...");
    const modelPath = await getLlamaModelPath(modelName || ModelPaths.mistral);
    console.log("Model path:", modelPath);

    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model not found at path: ${modelPath}`);
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
    console.log("LLama model loaded successfully!");
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error loading LLama model:", error);
      throw new Error(`Error loading model: ${error.message}`);
    } else {
      console.error("Unknown error loading LLama model:", error);
      throw new Error("Unknown error loading model.");
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
    maxTokens: 256, // Reduced to avoid memory issues
    repeatPenalty: 1.2,
    stop: ["</s>", "```"],
  };

  const mergedConfig = { ...defaultConfig, ...config };

  try {
    console.log("Starting generation with LLama...");
    console.log("Prompt:", input);
    console.log("Generation config:", mergedConfig);

    let output = "";
    await model.createCompletion(
      {
        nThreads: 2, // Reduced to avoid overload
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

    console.log("Generation completed successfully.");
    return output.trim();
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error in LLama generation:", error);
      throw new Error(`Error in LLama generation: ${error.message}`);
    } else {
      console.error("Unknown error in LLama generation:", error);
      throw new Error("Unknown error in LLama generation.");
    }
  }
}

export async function llamaApiConvert(
  prompt: string,
  apiUrl: string,
  apiKey: string
): Promise<string> {
  console.log("Starting LLama API call..." + prompt);
  process.send?.({
    type: "conversion-progress",
    data: {
      status: "converting",
      message: "Iniciando chamada à API Llama...",
    },
  });

  try {
    process.send?.({
      type: "conversion-progress",
      data: {
        status: "converting",
        message: "Enviando requisição para a API Llama...",
      },
    });

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
        timeout: 300000, // 300 seconds timeout
      }
    );

    if (!response.data) {
      throw new Error("Empty API response");
    }

    process.send?.({
      type: "conversion-progress",
      data: {
        status: "converting",
        message: "Processando resposta da API Llama...",
      },
    });

    // Try to get the result from the response in different common API formats
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
    } else if (typeof response.data === "string") {
      output = response.data;
    } else {
      throw new Error("Unrecognized API response format");
    }

    // Clean code markings and explanatory text
    output = output.replace(/```[\w]*\n?/g, "").replace(/```$/g, "");

    process.send?.({
      type: "conversion-progress",
      data: {
        status: "converting",
        message: "Limpando e formatando o código convertido...",
      },
    });

    // Try to extract only the code, removing explanatory text
    const codeMatch = output.match(
      /^[\s\S]*?((?:import|package|using|#include|function|class|def|pub|const|let|var|void|int|public|private)[\s\S]*$)/
    );
    if (codeMatch && codeMatch[1]) {
      output = codeMatch[1];
    }

    const trimmedOutput = output.trim();
    if (!trimmedOutput) {
      throw new Error("The API returned an empty response after processing");
    }

    process.send?.({
      type: "conversion-progress",
      data: {
        status: "completed",
        message: "Código convertido com sucesso via API Llama",
      },
    });

    console.log("Code successfully converted via LLama API");
    return trimmedOutput;
  } catch (error: any) {
    process.send?.({
      type: "conversion-progress",
      data: {
        status: "error",
        message: `Erro na conversão via API Llama: ${error.message}`,
      },
    });
    console.error("Error in LLama API conversion:", error);
    throw new Error(`Error in LLama API conversion: ${error.message}`);
  }
}

export async function llamaLocalConvert(prompt: string): Promise<string> {
  try {
    const model = await getLlamaModel();

    // Configure generation parameters
    const completion = await model.createCompletion(
      {
        nThreads: 4,
        nTokPredict: 512, // Limit the number of predicted tokens
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

    // Remove explanations before or after the code
    const codeMatch = output.match(
      /^[\s\S]*?((?:import|package|using|#include|function|class|def|pub|const|let|var|void|int|public|private)[\s\S]*$)/
    );
    if (codeMatch && codeMatch[1]) {
      output = codeMatch[1];
    }

    return output.trim();
  } catch (error: Error | any) {
    console.error("Error in local LLama conversion:", error);
    throw new Error(`Error in conversion: ${error.message}`);
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

  // Check and create the temporary folder if it doesn't exist
  await fs.ensureDir(tempFolder);
  // Get list of files in the source folder
  const sourceFiles = await getAllFiles(sourceFolder);

  // Send total file count for progress tracking
  process.send?.({
    type: "minification-file-count",
    count: sourceFiles.length,
  });

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

      // Ensure directories exist
      await fs.ensureDir(path.dirname(tempFilePath));

      // Read original file content
      const originalContent = await fs.readFile(filePath, "utf-8");
      const originalSize = Buffer.byteLength(originalContent, "utf-8");
      const originalTokenCount = estimateTokenCount(originalContent);
      originalTotalSize += originalSize;
      totalOriginalTokens += originalTokenCount;

      // Apply selected simplifications
      const minifiedContent = await simplifyCode(
        originalContent,
        path.extname(filePath),
        simplificationOptions
      );

      // Calculate size and tokens after minification
      const minifiedSize = Buffer.byteLength(minifiedContent, "utf-8");
      const minifiedTokenCount = estimateTokenCount(minifiedContent);
      minifiedTotalSize += minifiedSize;
      totalMinifiedTokens += minifiedTokenCount;

      // Write simplified content to temporary file
      await fs.writeFile(tempFilePath, minifiedContent); // Add to processed files list with metrics
      minifiedFiles.push({
        original: filePath,
        minified: tempFilePath,
        originalTokens: originalTokenCount,
        minifiedTokens: minifiedTokenCount,
        originalSize: formatFileSize(originalSize),
        minifiedSize: formatFileSize(minifiedSize),
      }); // Emit progress to the interface
      const progress = {
        file: relativePath,
        tokens: {
          before: originalTokenCount,
          after: minifiedTokenCount,
        },
        size: {
          before: formatFileSize(originalSize),
          after: formatFileSize(minifiedSize),
          beforeBytes: originalSize,
          afterBytes: minifiedSize,
        },
        fileInfo: `${path.extname(filePath)} | ${path.basename(
          filePath
        )} | Reduction: ${Math.round(
          (1 - minifiedSize / originalSize) * 100
        )}%`,
      };

      process.send?.({ type: "minification-progress", data: progress });
    } catch (error) {
      console.error(`Error minifying file ${filePath}:`, error);
    }
  }

  // Calculate size reduction percentage
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

  // Step 1: Check folders and create if not exist
  await fs.ensureDir(tempFolder);
  await fs.ensureDir(outputFolder);
  // Step 2: Copy files from base folder to temporary folder with simplifications
  const sourceFiles = await getAllFiles(sourceFolder);

  // Send total file count for progress tracking
  process.send?.({ type: "file-count", count: sourceFiles.length });

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
      processedFiles.push({ original: filePath, simplified: tempFilePath }); // Emit progress to the interface
      process.send?.({
        type: "conversion-progress",
        data: {
          status: "simplified",
          file: relativePath,
          fileInfo: `${formatFileSize(
            Buffer.byteLength(content, "utf-8")
          )} | ${estimateTokenCount(content)} tokens`,
        },
      });
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }

  // Step 3: Convert files from temporary folder to output folder
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
      const conversionResult = await convertCode(
        content,
        path.extname(file.simplified),
        conversionOptions
      );

      // Extract converted code from result
      const convertedContent = conversionResult.code;

      await fs.writeFile(outputFilePath, convertedContent);
      convertedFiles.push({
        simplified: file.simplified,
        converted: outputFilePath,
        metrics: conversionResult.metrics,
      });

      // Get token metrics from conversion
      const tokensInfo = conversionResult.metrics?.tokens || {
        sent: estimateTokenCount(content),
        received: estimateTokenCount(convertedContent),
      };
      const originalSizeBytes = Buffer.byteLength(content, "utf-8");
      const convertedSizeBytes = Buffer.byteLength(convertedContent, "utf-8");
      const fileSize = formatFileSize(convertedSizeBytes);
      const processingTime = conversionResult.metrics?.processingTime || 0;

      // Emit progress to the interface
      process.send?.({
        type: "conversion-progress",
        data: {
          status: "converted",
          file: relativePath,
          output: path.basename(outputFilePath),
          fileInfo: `${fileSize} | ${tokensInfo.received} tokens | Time: ${processingTime}ms`,
          tokensInfo: tokensInfo,
          fileSize: {
            original: originalSizeBytes,
            processed: convertedSizeBytes,
          },
        },
      });
    } catch (error) {
      console.error(`Error converting file ${file.simplified}:`, error);
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
        // Ignore files that should not be processed
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
    console.error(`Error listing files in ${dir}:`, error);
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

// Helper function to estimate the number of tokens in a text
export function estimateTokenCount(text: string): number {
  // Remove multi-line comments
  text = text.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove single-line comments
  text = text.replace(/\/\/.*/g, "");

  // Split text into words and symbols
  const words = text.split(/\s+/).filter(Boolean);
  const symbols = text.match(/[{}()\[\]<>=+\-*/%!&|^~;:,]/g) || [];
  const stringLiterals = text.match(/"[^"]*"|'[^']*'|`[^`]*`/g) || [];

  // Each word is approximately 1-2 tokens
  // Each symbol is generally 1 token
  // String literals are calculated by length
  const wordTokens = words.length;
  const symbolTokens = symbols.length;
  const stringTokens = stringLiterals.reduce(
    (acc, str) => acc + Math.ceil(str.length / 4),
    0
  );

  return wordTokens + symbolTokens + stringTokens;
}

// Helper function to format file size
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

// Utility functions for file and folder manipulation per agent instruction
export async function createFolder(folderPath: string): Promise<void> {
  await fs.ensureDir(folderPath);
}

export async function moveFileOrFolder(
  src: string,
  dest: string
): Promise<void> {
  await fs.move(src, dest, { overwrite: true });
}

export async function renameFileOrFolder(
  oldPath: string,
  newPath: string
): Promise<void> {
  await fs.move(oldPath, newPath, { overwrite: true });
}

export async function deleteFileOrFolder(targetPath: string): Promise<void> {
  await fs.remove(targetPath);
}

export async function writeFile(
  targetPath: string,
  content: string
): Promise<void> {
  await fs.ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, content, "utf-8");
}

export async function readFile(targetPath: string): Promise<string> {
  return await fs.readFile(targetPath, "utf-8");
}

// Interface for AI agent suggestions
export interface AgentSuggestion {
  type: "move" | "rename" | "create" | "delete" | "modify";
  description: string;
  path?: string;
  destination?: string;
  newName?: string;
  content?: string;
}

/**
 * AI Agent that analyzes code and suggests reorganizations
 * @param options Process options
 * @param files List of converted files
 * @returns Reorganization suggestions
 */
export async function analyzeCodeWithAgent(
  options: ProcessOptions,
  files: Array<{ simplified: string; converted: string }>
): Promise<AgentSuggestion[]> {
  const { conversionOptions, outputFolder } = options;
  const suggestions: AgentSuggestion[] = [];

  // Prepare a summary of files to send to the AI
  const filesSummary = await Promise.all(
    files.map(async (file) => {
      const relativePath = path.relative(outputFolder, file.converted);
      const content = await fs.readFile(file.converted, "utf-8");
      // Get only the first lines to save tokens
      const preview = content.split("\n").slice(0, 10).join("\n");
      return { path: relativePath, preview };
    })
  );

  // Build the prompt for the AI
  const prompt = `
You are an assistant specialized in organizing code. Analyze the converted files for ${
    conversionOptions.targetLanguage
  } and suggest reorganizations that make the project cleaner and well-structured.

IMPORTANT: You must respond ONLY with a valid JSON array containing suggestions. Do not include any explanatory text outside the JSON.

Each suggestion in the array must follow this exact structure:
{
  "type": "move" | "rename" | "create" | "delete" | "modify",
  "description": "string describing the action",
  "path": "path/to/file" (optional for create type),
  "destination": "new/path" (required for move type),
  "newName": "new-name.ext" (required for rename type),
  "content": "new content" (required for modify type)
}

List of converted files:
${JSON.stringify(filesSummary, null, 2)}

Remember:
1. Response must be a single JSON array containing up to 5 suggestions
2. Each suggestion must have all required fields for its type
3. Do not include any text outside the JSON array
4. JSON must be properly formatted and valid
5. Prioritize the most important suggestions

Example of valid response format:
[{"type":"move","description":"Move utilities to dedicated folder","path":"utils.ts","destination":"utils/utils.ts"}]
`;

  try {
    // Choose AI API based on configured options
    let aiResponse: string;

    if (
      conversionOptions.provider === "openai" ||
      conversionOptions.provider === "gemini" ||
      conversionOptions.provider === "anthropic"
    ) {
      // Use external APIs for more sophisticated analysis
      aiResponse = await llamaApiConvert(
        prompt,
        conversionOptions.apiUrl || "",
        conversionOptions.apiKey || ""
      );
    } else {
      // Use local Llama as fallback
      aiResponse = await llamaApiConvert(
        prompt,
        "http://127.0.0.1:11434/api/generate",
        "test"
      );
    }

    // Extract JSON from response using improved matching
    const jsonMatch = aiResponse.match(
      /\[(?:[^[\]]*|\[(?:[^[\]]*|\[[^[\]]*\])*\])*\]/
    );
    if (jsonMatch) {
      try {
        // Attempt to parse the matched JSON
        const parsedSuggestions = JSON.parse(jsonMatch[0]) as AgentSuggestion[];

        // Validate each suggestion has required fields based on its type
        return parsedSuggestions
          .filter((s) => {
            if (!s.type || !s.description) return false;

            switch (s.type) {
              case "move":
                return !!s.path && !!s.destination;
              case "rename":
                return !!s.path && !!s.newName;
              case "create":
                return !!s.path;
              case "delete":
                return !!s.path;
              case "modify":
                return !!s.path && !!s.content;
              default:
                return false;
            }
          })
          .slice(0, 5); // Limit to 5 suggestions
      } catch (parseError) {
        console.error("Error parsing JSON suggestions:", parseError);
        return [];
      }
    }

    console.error("No valid JSON array found in AI response");
    return [];
  } catch (error) {
    console.error("Error analyzing code with AI agent:", error);
    return [];
  }
}

/**
 * Executes AI agent suggestions to reorganize files
 * @param suggestions List of suggestions
 * @param outputFolder Output folder
 * @returns Report of executed actions
 */
export async function executeAgentSuggestions(
  suggestions: AgentSuggestion[],
  outputFolder: string
): Promise<
  Array<{ suggestion: AgentSuggestion; success: boolean; error?: string }>
> {
  const results = [];

  for (const suggestion of suggestions) {
    try {
      switch (suggestion.type) {
        case "move":
          if (suggestion.path && suggestion.destination) {
            const src = path.join(outputFolder, suggestion.path);
            const dest = path.join(outputFolder, suggestion.destination);
            await fs.ensureDir(path.dirname(dest));
            await moveFileOrFolder(src, dest);
            results.push({ suggestion, success: true });
          }
          break;

        case "rename":
          if (suggestion.path && suggestion.newName) {
            const oldPath = path.join(outputFolder, suggestion.path);
            const newPath = path.join(
              path.dirname(oldPath),
              suggestion.newName
            );
            await renameFileOrFolder(oldPath, newPath);
            results.push({ suggestion, success: true });
          }
          break;

        case "create":
          if (suggestion.path) {
            const dirPath = path.join(outputFolder, suggestion.path);
            await createFolder(dirPath);
            results.push({ suggestion, success: true });
          }
          break;

        case "delete":
          if (suggestion.path) {
            const targetPath = path.join(outputFolder, suggestion.path);
            await deleteFileOrFolder(targetPath);
            results.push({ suggestion, success: true });
          }
          break;

        case "modify":
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
        error: error.message,
      });
    }
  }

  return results;
}
