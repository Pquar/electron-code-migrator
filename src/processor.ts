import * as fs from "fs-extra";
import * as path from "path";
import { promisify } from "util";
import { simplifyCode } from "./simplifier";
import { convertCode } from "./converter";
import { LLama } from "llama-node";
import { OpenAI } from "openai"
import { LLamaCpp, LoadConfig } from "llama-node/dist/llm/llama-cpp.js";
import {
  ConversionOptions,
  ProcessOptions,
  SimplificationOptions,
} from "./interface";
import { app } from "electron";
import axios from "axios";

// MCP Integration imports
interface MCPFileInfo {
  path: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  extension?: string;
}

interface MCPFolderContext {
  folderName: string;
  files: MCPFileInfo[];
  totalFiles: number;
}

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
      message: "Starting Llama API call...",
    },
  });

  try {
    process.send?.({
      type: "conversion-progress",
      data: {
        status: "converting",
        message: "Sending request to Llama API...",
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
        message: "Processing Llama API response...",
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
        message: "Cleaning and formatting converted code...",
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
        message: "Code successfully converted via Llama API",
      },
    });

    console.log("Code successfully converted via LLama API");
    return trimmedOutput;
  } catch (error: any) {
    process.send?.({
      type: "conversion-progress",
      data: {
        status: "error",
        message: `Error in Llama API conversion: ${error.message}`,
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
    (acc: number, str: string) => acc + Math.ceil(str.length / 4),
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
  type: "move" | "rename" | "create" | "delete" | "modify" | "mcp_create" | "mcp_modify" | "mcp_delete";
  description: string;
  path?: string;
  destination?: string;
  newName?: string;
  content?: string;
  mcpFolder?: string;
}

/**
 * AI Agent that analyzes code and suggests reorganizations
 * @param options Process options
 * @param files List of converted files
 * @returns Reorganization suggestions
 */
async function analyzeWithProvider(
  prompt: string,
  provider: string,
  apiKey: string = "",
  apiUrl: string = ""
): Promise<string> {
  switch (provider) {
    case "openai":
      return callOpenAI(prompt, apiKey);
    case "gemini":
      return callGemini(prompt, apiKey);
    case "anthropic":
      return callAnthropic(prompt, apiKey); 
    case "llama":
      return llamaApiConvert(prompt, apiUrl || "http://127.0.0.1:11434/api/generate", apiKey);
    case "llama-local":
      return llamaApiConvert(prompt, "http://127.0.0.1:11434/api/generate", "test");
    default:
      throw new Error(`Provider ${provider} não suportado`);
  }
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {

  if (!apiKey) {
    throw new Error("OpenAI API Key not provided");
  }

  const client = new OpenAI({
    apiKey: apiKey,
  });
  const response = await client.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 4000,
    });


   const data = response.choices[0]?.message?.content || prompt;
  return data;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
    method: "POST", 
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{parts: [{text: prompt}]}],
    })
  });

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function callAnthropic(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-3-opus-20240229",
      max_tokens: 4096,
      messages: [{role: "user", content: prompt}]
    })
  });

  const data = await response.json();
  return data.content[0].text;
}

export async function analyzeCodeWithAgent(
  options: ProcessOptions,
  files: Array<{ simplified: string; converted: string }>
): Promise<AgentSuggestion[]> {
  const { conversionOptions, outputFolder } = options;
  const suggestions: AgentSuggestion[] = [];

  // Initialize MCP File Manager
  const mcpManager = new MCPFileManager();
  
  // Get MCP folders context
  const mcpContexts = await mcpManager.getAllFoldersContext();
  const mcpContextFormatted = mcpManager.formatContextForAI(mcpContexts);

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

  // Build the enhanced prompt for the AI with MCP context
  const prompt = `
You are an advanced AI assistant specialized in organizing and improving code projects. You have access to local files in three specific folders and can perform file operations in the "destino final" folder.

AVAILABLE MCP FOLDERS:
- "primaria": Source/input files (read-only)
- "intermediario": Intermediate processing files (read-only)  
- "destino final": Final output files (read/write/create/delete)

${mcpContextFormatted}

CURRENT CONVERTED FILES TO ANALYZE:
${JSON.stringify(filesSummary, null, 2)}

TARGET LANGUAGE: ${conversionOptions.targetLanguage}

YOU CAN PERFORM THESE ACTIONS:
1. Analyze code patterns from "primaria" and "intermediario" folders
2. Suggest improvements based on existing code structure
3. Create new files in "destino final" folder
4. Modify existing files in "destino final" folder
5. Delete unnecessary files in "destino final" folder
6. Move and organize files within the project

ENHANCED SUGGESTION TYPES:
{
  "type": "move" | "rename" | "create" | "delete" | "modify" | "mcp_create" | "mcp_modify" | "mcp_delete",
  "description": "string describing the action",
  "path": "path/to/file",
  "destination": "new/path" (for move),
  "newName": "new-name.ext" (for rename),
  "content": "new content" (for modify/create),
  "mcpFolder": "destino final" (for MCP operations)
}

IMPORTANT: You must respond ONLY with a valid JSON array containing suggestions. Do not include any explanatory text outside the JSON.

Focus on:
1. Code organization and structure improvements
2. Creating utilities or helper files in "destino final" based on patterns from other folders
3. Consolidating common functionality
4. Improving code readability and maintainability
5. Leveraging existing code from "primaria" and "intermediario" folders

Example response format:
[
  {"type":"mcp_create","description":"Create utility module based on common patterns","path":"utils.py","content":"# Utility functions\\ndef helper():\\n    pass","mcpFolder":"destino final"},
  {"type":"modify","description":"Improve main module structure","path":"main.py","content":"# Improved code"}
]
`;
    try {
      // Get response from selected provider
      const aiResponse = await analyzeWithProvider(
        prompt,
        conversionOptions.provider,
        conversionOptions.apiKey,
        conversionOptions.apiUrl
      );

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
                case "mcp_create":
                  return !!s.path && !!s.content;
                case "mcp_modify":
                  return !!s.path && !!s.content;
                case "mcp_delete":
                  return !!s.path;
                default:
                  return false;
              }
            })
            .slice(0, 10); // Increased limit for MCP operations
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
  const mcpManager = new MCPFileManager();

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

        // MCP Operations
        case "mcp_create":
          if (suggestion.path && suggestion.content) {
            const success = await mcpManager.createFileInDestination(suggestion.path, suggestion.content);
            results.push({ suggestion, success });
            if (!success) {
              results[results.length - 1].error = "Failed to create file in destination folder";
            }
          }
          break;

        case "mcp_modify":
          if (suggestion.path && suggestion.content) {
            const success = await mcpManager.modifyFileInDestination(suggestion.path, suggestion.content);
            results.push({ suggestion, success });
            if (!success) {
              results[results.length - 1].error = "Failed to modify file in destination folder or file not found";
            }
          }
          break;

        case "mcp_delete":
          if (suggestion.path) {
            const success = await mcpManager.deleteFileInDestination(suggestion.path);
            results.push({ suggestion, success });
            if (!success) {
              results[results.length - 1].error = "Failed to delete file from destination folder or file not found";
            }
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

/**
 * MCP File Manager for handling files in the three MCP folders
 */
class MCPFileManager {
  private basePath: string;
  private mcpFolders = ["primaria", "intermediario", "destino final"];

  constructor(basePath: string = "c:\\projetos\\electron-code-migrator") {
    this.basePath = basePath;
  }

  /**
   * Gets comprehensive context from all MCP folders
   */
  async getAllFoldersContext(): Promise<MCPFolderContext[]> {
    const contexts: MCPFolderContext[] = [];

    for (const folderName of this.mcpFolders) {
      try {
        const folderPath = path.join(this.basePath, folderName);
        const files = await this.getFilesInFolder(folderPath);
        
        contexts.push({
          folderName,
          files,
          totalFiles: files.length
        });
      } catch (error) {
        console.error(`Error reading folder ${folderName}:`, error);
        contexts.push({
          folderName,
          files: [],
          totalFiles: 0
        });
      }
    }

    return contexts;
  }

  /**
   * Gets files information from a specific folder
   */
  private async getFilesInFolder(folderPath: string): Promise<MCPFileInfo[]> {
    const files: MCPFileInfo[] = [];

    if (!(await fs.pathExists(folderPath))) {
      return files;
    }

    const items = await fs.readdir(folderPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(folderPath, item.name);
      const mcpFile: MCPFileInfo = {
        path: itemPath,
        name: item.name,
        type: item.isDirectory() ? 'directory' : 'file'
      };

      if (item.isFile()) {
        mcpFile.extension = path.extname(item.name);
        // Read content for text files (limit size to avoid token issues)
        try {
          const content = await fs.readFile(itemPath, 'utf-8');
          mcpFile.content = content.length > 2000 ? content.substring(0, 2000) + '...' : content;
        } catch (error) {
          mcpFile.content = '[Binary file or read error]';
        }
      }

      files.push(mcpFile);
    }

    return files;
  }

  /**
   * Creates a new file in the "destino final" folder
   */
  async createFileInDestination(fileName: string, content: string): Promise<boolean> {
    try {
      const destinationPath = path.join(this.basePath, "destino final", fileName);
      await fs.ensureDir(path.dirname(destinationPath));
      await fs.writeFile(destinationPath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error(`Error creating file ${fileName}:`, error);
      return false;
    }
  }

  /**
   * Modifies an existing file in the "destino final" folder
   */
  async modifyFileInDestination(fileName: string, content: string): Promise<boolean> {
    try {
      const destinationPath = path.join(this.basePath, "destino final", fileName);
      if (await fs.pathExists(destinationPath)) {
        await fs.writeFile(destinationPath, content, 'utf-8');
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error modifying file ${fileName}:`, error);
      return false;
    }
  }

  /**
   * Deletes a file from the "destino final" folder
   */
  async deleteFileInDestination(fileName: string): Promise<boolean> {
    try {
      const destinationPath = path.join(this.basePath, "destino final", fileName);
      if (await fs.pathExists(destinationPath)) {
        await fs.remove(destinationPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error deleting file ${fileName}:`, error);
      return false;
    }
  }

  /**
   * Formats the MCP context for AI prompts
   */
  formatContextForAI(contexts: MCPFolderContext[]): string {
    let formatted = "=== MCP LOCAL FILES CONTEXT ===\n\n";

    for (const context of contexts) {
      formatted += `📁 FOLDER: ${context.folderName.toUpperCase()}\n`;
      formatted += `Files found: ${context.totalFiles}\n\n`;

      if (context.files.length === 0) {
        formatted += "  (No files found)\n\n";
        continue;
      }

      for (const file of context.files) {
        formatted += `  📄 ${file.name}`;
        if (file.extension) {
          formatted += ` (${file.extension})`;
        }
        formatted += `\n`;

        if (file.content && file.type === 'file') {
          formatted += `     Content preview:\n`;
          formatted += `     ${file.content.split('\n').map(line => `     ${line}`).join('\n')}\n\n`;
        }
      }
      formatted += "\n";
    }

    return formatted;
  }
}
