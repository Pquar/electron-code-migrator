import * as fs from "fs-extra";
import * as path from "path";
import { simplifyCode } from "./simplifier";
import { convertCode } from "./converter";

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

export interface ConversionOptions {
  targetLanguage: string;
  provider: "openai" | "gemini" | "anthropic";
  apiKey: string;
}

export async function processFiles(
  sourceFolder: string,
  tempFolder: string,
  outputFolder: string,
  simplificationOptions: SimplificationOptions,
  conversionOptions: ConversionOptions
) {
  // Etapa 1: Verificar pastas e criar se não existirem
  await fs.ensureDir(tempFolder);
  await fs.ensureDir(outputFolder);

  // Etapa 2: Copiar arquivos da pasta base para a pasta temporária com simplificações
  const sourceFiles = await getAllFiles(sourceFolder);
  const processedFiles = [];

  for (const filePath of sourceFiles) {
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
  }

  // Etapa 3: Converter arquivos da pasta temporária para a pasta de saída
  const convertedFiles = [];

  for (const file of processedFiles) {
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
  }

  return {
    processedFiles,
    convertedFiles,
  };
}

async function getAllFiles(dir: string): Promise<string[]> {
  const files = await fs.readdir(dir);
  const result: string[] = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      const subFiles = await getAllFiles(filePath);
      result.push(...subFiles);
    } else {
      result.push(filePath);
    }
  }

  return result;
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
  };

  const newExt = langExtMap[targetLanguage.toLowerCase()] || ext;
  return path.join(dir, `${base}${newExt}`);
}
