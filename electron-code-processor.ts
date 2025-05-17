// README.md
# Electron Code Processor

Um aplicativo desktop para processar código-fonte em etapas:
1. Selecionar código-fonte original
2. Aplicar simplificações (remover comentários, reduzir palavras-chave, minificar)
3. Converter para outra linguagem usando APIs de IA (OpenAI, Google Gemini ou Anthropic Claude)

![Screenshot do aplicativo](https://via.placeholder.com/800x450)

## Funcionalidades

- Interface de usuário em etapas (wizard)
- Seleção de pastas de origem e destino
- Opções de simplificação de código personalizáveis
- Integração com múltiplas APIs de IA para conversão de código
- Visualização de progresso em tempo real
- Sumário detalhado dos resultados

## Requisitos

- Node.js 16+
- npm ou yarn

## Instalação

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/seu-usuario/electron-code-processor.git
cd electron-code-processor
npm install
```

## Compilação e Execução

Para compilar o TypeScript e executar o aplicativo:

```bash
npm run build   # Compila o TypeScript
npm start       # Inicia o aplicativo Electron
```

Ou use o comando de desenvolvimento que compila e inicia o aplicativo:

```bash
npm run dev
```

## Modo de Desenvolvimento

Para desenvolvimento, você pode usar o modo de observação que recompila automaticamente quando os arquivos são alterados:

```bash
npm run watch   # Compila em modo de observação
```

Em outro terminal, execute o aplicativo:

```bash
npm start
```

## Uso do Aplicativo

1. **Etapa 1**: Selecione a pasta base com o código-fonte original.
2. **Etapa 2**: Configure as pastas de saída (intermediária e final), opções de simplificação e opções de conversão.
3. **Etapa 3**: Revise as configurações e inicie o processamento.
4. **Etapa 4**: Veja o resultado do processamento e acesse os arquivos convertidos.

## Configuração das APIs

Para usar as funcionalidades de conversão, você precisará de chaves de API:

- **OpenAI (GPT)**: Obtenha uma chave em [https://platform.openai.com](https://platform.openai.com)
- **Google Gemini**: Obtenha uma chave em [https://ai.google.dev](https://ai.google.dev)
- **Anthropic Claude**: Obtenha uma chave em [https://www.anthropic.com/](https://www.anthropic.com/)

## Construção para Produção

Para criar um pacote de distribuição:

```bash
# Instale electron-builder como dependência de desenvolvimento
npm install --save-dev electron-builder

# Adicione script de construção ao package.json
"scripts": {
  "dist": "electron-builder"
}

# Execute o comando de construção
npm run dist
```

Isso irá criar um instalador para seu sistema operacional atual na pasta `dist`.

## Licença

MIT// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "sourceMap": true,
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "*": ["node_modules/*"]
    },
    "strict": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}// package.json
{
  "name": "electron-code-processor",
  "version": "1.0.0",
  "description": "Aplicativo para processamento de código em etapas",
  "main": "dist/main.js",
  "scripts": {
    "start": "electron .",
    "build": "tsc",
    "dev": "tsc && electron .",
    "watch": "tsc -w"
  },
  "dependencies": {
    "electron": "^28.0.0",
    "openai": "^4.20.0",
    "google-auth-library": "^9.0.0",
    "anthropic": "^0.9.0",
    "axios": "^1.6.0",
    "fs-extra": "^11.1.0",
    "tailwindcss": "^3.3.0"
  },
  "devDependencies": {
    "typescript": "^5.2.0",
    "@types/fs-extra": "^11.0.0",
    "@types/node": "^20.0.0",
    "electron-reload": "^2.0.0"
  }
}

// src/main.ts
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { processFiles } from './processor';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '../assets/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, '../index.html'));
  
  // Apenas em ambiente de desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('process-code', async (_, options) => {
  try {
    const result = await processFiles(
      options.sourceFolder,
      options.tempFolder,
      options.outputFolder,
      options.simplificationOptions,
      options.conversionOptions
    );
    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  processCode: (options: any) => ipcRenderer.invoke('process-code', options)
});

// src/processor.ts
import * as fs from 'fs-extra';
import * as path from 'path';
import { simplifyCode } from './simplifier';
import { convertCode } from './converter';

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
  provider: 'openai' | 'gemini' | 'anthropic';
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
    
    let content = await fs.readFile(filePath, 'utf-8');
    content = await simplifyCode(content, path.extname(filePath), simplificationOptions);
    
    await fs.writeFile(tempFilePath, content);
    processedFiles.push({ original: filePath, simplified: tempFilePath });
  }
  
  // Etapa 3: Converter arquivos da pasta temporária para a pasta de saída
  const convertedFiles = [];
  
  for (const file of processedFiles) {
    const relativePath = path.relative(tempFolder, file.simplified);
    const outputFilePath = path.join(outputFolder, getConvertedFilename(relativePath, conversionOptions.targetLanguage));
    
    await fs.ensureDir(path.dirname(outputFilePath));
    
    const content = await fs.readFile(file.simplified, 'utf-8');
    const convertedContent = await convertCode(content, path.extname(file.simplified), conversionOptions);
    
    await fs.writeFile(outputFilePath, convertedContent);
    convertedFiles.push({ simplified: file.simplified, converted: outputFilePath });
  }
  
  return {
    processedFiles,
    convertedFiles
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

function getConvertedFilename(filePath: string, targetLanguage: string): string {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const dir = path.dirname(filePath);
  
  const langExtMap: Record<string, string> = {
    'javascript': '.js',
    'typescript': '.ts',
    'python': '.py',
    'java': '.java',
    'csharp': '.cs',
    'cpp': '.cpp',
    'ruby': '.rb',
    'go': '.go',
    'rust': '.rs',
    'php': '.php'
  };
  
  const newExt = langExtMap[targetLanguage.toLowerCase()] || ext;
  return path.join(dir, `${base}${newExt}`);
}

// src/simplifier.ts
export interface SimplificationOptions {
  removeComments: boolean;
  reduceKeywords: boolean;
  minify: boolean;
}

export async function simplifyCode(
  code: string,
  fileExtension: string,
  options: SimplificationOptions
): Promise<string> {
  let result = code;
  
  // Remover comentários
  if (options.removeComments) {
    result = removeComments(result, fileExtension);
  }
  
  // Reduzir palavras-chave
  if (options.reduceKeywords) {
    result = reduceKeywords(result, fileExtension);
  }
  
  // Minificar levemente
  if (options.minify) {
    result = minifyLightly(result, fileExtension);
  }
  
  return result;
}

function removeComments(code: string, fileExtension: string): string {
  // Implementação simplificada - na prática precisaria de um parser específico para cada linguagem
  // Remove comentários de linha única
  let result = code.replace(/\/\/.*$/gm, '');
  
  // Remove comentários de múltiplas linhas
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  
  return result;
}

function reduceKeywords(code: string, fileExtension: string): string {
  // Implementação básica - na prática precisaria de análise sintática real
  const keywordsMap: Record<string, string> = {
    'function': 'fn',
    'const ': 'c ',
    'let ': 'l ',
    'var ': 'v ',
    'return ': 'r ',
  };
  
  let result = code;
  Object.entries(keywordsMap).forEach(([keyword, replacement]) => {
    result = result.replace(new RegExp(keyword, 'g'), replacement);
  });
  
  return result;
}

function minifyLightly(code: string, fileExtension: string): string {
  // Minificação leve: remover espaços em branco extras e quebras de linha
  return code
    .replace(/\s+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\s*{\s*/g, '{')
    .replace(/\s*}\s*/g, '}')
    .replace(/\s*;\s*/g, ';')
    .replace(/\s*,\s*/g, ',');
}

// src/converter.ts
import axios from 'axios';
import { Configuration, OpenAIApi } from 'openai';
import { GoogleAuth } from 'google-auth-library';
import Anthropic from 'anthropic';

export interface ConversionOptions {
  targetLanguage: string;
  provider: 'openai' | 'gemini' | 'anthropic';
  apiKey: string;
}

export async function convertCode(
  code: string,
  fileExtension: string,
  options: ConversionOptions
): Promise<string> {
  switch (options.provider) {
    case 'openai':
      return await convertWithOpenAI(code, fileExtension, options);
    case 'gemini':
      return await convertWithGemini(code, fileExtension, options);
    case 'anthropic':
      return await convertWithAnthropic(code, fileExtension, options);
    default:
      throw new Error(`Provedor de IA não suportado: ${options.provider}`);
  }
}

async function convertWithOpenAI(
  code: string,
  fileExtension: string,
  options: ConversionOptions
): Promise<string> {
  const configuration = new Configuration({
    apiKey: options.apiKey
  });
  
  const openai = new OpenAIApi(configuration);
  
  const prompt = `Converta o seguinte código para ${options.targetLanguage}. Mantenha a mesma funcionalidade, mas adapte para os padrões da linguagem alvo:
  
  ${code}
  
  Apenas retorne o código convertido, sem explicações adicionais.`;
  
  try {
    const response = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }]
    });
    
    return response.data.choices[0]?.message?.content || code;
  } catch (error) {
    console.error('Erro ao chamar a API OpenAI:', error);
    throw new Error('Falha ao converter o código usando OpenAI');
  }
}

async function convertWithGemini(
  code: string,
  fileExtension: string,
  options: ConversionOptions
): Promise<string> {
  const apiUrl = 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent';
  
  try {
    const response = await axios.post(
      `${apiUrl}?key=${options.apiKey}`,
      {
        contents: [{
          parts: [{
            text: `Converta o seguinte código para ${options.targetLanguage}. Mantenha a mesma funcionalidade, mas adapte para os padrões da linguagem alvo:
            
            ${code}
            
            Apenas retorne o código convertido, sem explicações adicionais.`
          }]
        }]
      }
    );
    
    return response.data.candidates[0]?.content?.parts[0]?.text || code;
  } catch (error) {
    console.error('Erro ao chamar a API Gemini:', error);
    throw new Error('Falha ao converter o código usando Gemini');
  }
}

async function convertWithAnthropic(
  code: string,
  fileExtension: string,
  options: ConversionOptions
): Promise<string> {
  const anthropic = new Anthropic({
    apiKey: options.apiKey
  });
  
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `Converta o seguinte código para ${options.targetLanguage}. Mantenha a mesma funcionalidade, mas adapte para os padrões da linguagem alvo:
        
        ${code}
        
        Apenas retorne o código convertido, sem explicações adicionais.`
      }]
    });
    
    return response.content[0].text || code;
  } catch (error) {
    console.error('Erro ao chamar a API Anthropic:', error);
    throw new Error('Falha ao converter o código usando Anthropic');
  }
}

// index.html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Processador de Código</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .step-indicator {
      @apply flex items-center justify-center w-10 h-10 rounded-full border-2 font-bold;
    }
    .step-active {
      @apply bg-blue-500 text-white border-blue-500;
    }
    .step-completed {
      @apply bg-green-500 text-white border-green-500;
    }
    .step-pending {
      @apply bg-white text-gray-500 border-gray-300;
    }
  </style>
</head>
<body class="bg-gray-100 min-h-screen">
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold text-center mb-8">Processador de Código em Etapas</h1>
    
    <div id="app" class="bg-white rounded-lg shadow-lg p-6">
      <!-- Indicadores de Etapas -->
      <div class="flex items-center justify-between mb-8 px-4">
        <div class="flex flex-col items-center">
          <div id="step1-indicator" class="step-indicator step-active">1</div>
          <span class="text-sm mt-2">Selecionar Pasta</span>
        </div>
        <div class="h-0.5 flex-1 bg-gray-300 mx-2" id="line1"></div>
        <div class="flex flex-col items-center">
          <div id="step2-indicator" class="step-indicator step-pending">2</div>
          <span class="text-sm mt-2">Configurar</span>
        </div>
        <div class="h-0.5 flex-1 bg-gray-300 mx-2" id="line2"></div>
        <div class="flex flex-col items-center">
          <div id="step3-indicator" class="step-indicator step-pending">3</div>
          <span class="text-sm mt-2">Processar</span>
        </div>
        <div class="h-0.5 flex-1 bg-gray-300 mx-2" id="line3"></div>
        <div class="flex flex-col items-center">
          <div id="step4-indicator" class="step-indicator step-pending">4</div>
          <span class="text-sm mt-2">Resultados</span>
        </div>
      </div>
      
      <!-- Conteúdo das Etapas -->
      <div id="step1" class="step-content">
        <h2 class="text-xl font-semibold mb-4">Etapa 1: Selecionar Pasta Base</h2>
        <p class="mb-4">Selecione a pasta que contém o código original que você deseja processar.</p>
        
        <div class="flex items-center mb-6">
          <input type="text" id="sourceFolder" class="flex-1 border border-gray-300 rounded-l px-4 py-2" placeholder="Caminho da pasta base" readonly>
          <button id="selectSourceFolder" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r">Selecionar</button>
        </div>
        
        <div class="mt-8 flex justify-end">
          <button id="nextStep1" class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded disabled:bg-gray-400" disabled>Próximo</button>
        </div>
      </div>
      
      <div id="step2" class="step-content hidden">
        <h2 class="text-xl font-semibold mb-4">Etapa 2: Configurar Processamento</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="border border-gray-200 rounded-lg p-4">
            <h3 class="font-semibold mb-3">Pastas de Saída</h3>
            
            <div class="mb-4">
              <label class="block text-sm font-medium mb-1">Pasta Intermediária</label>
              <div class="flex">
                <input type="text" id="tempFolder" class="flex-1 border border-gray-300 rounded-l px-4 py-2" placeholder="Caminho para pasta intermediária" readonly>
                <button id="selectTempFolder" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r">Selecionar</button>
              </div>
            </div>
            
            <div class="mb-4">
              <label class="block text-sm font-medium mb-1">Pasta de Saída Final</label>
              <div class="flex">
                <input type="text" id="outputFolder" class="flex-1 border border-gray-300 rounded-l px-4 py-2" placeholder="Caminho para pasta de saída" readonly>
                <button id="selectOutputFolder" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r">Selecionar</button>
              </div>
            </div>
          </div>
          
          <div class="border border-gray-200 rounded-lg p-4">
            <h3 class="font-semibold mb-3">Opções de Simplificação</h3>
            
            <div class="flex items-center mb-3">
              <input type="checkbox" id="removeComments" class="mr-2" checked>
              <label for="removeComments">Remover comentários</label>
            </div>
            
            <div class="flex items-center mb-3">
              <input type="checkbox" id="reduceKeywords" class="mr-2">
              <label for="reduceKeywords">Reduzir palavras-chave</label>
            </div>
            
            <div class="flex items-center">
              <input type="checkbox" id="minify" class="mr-2">
              <label for="minify">Minificar levemente o código</label>
            </div>
          </div>
        </div>
        
        <div class="mt-8 border border-gray-200 rounded-lg p-4">
          <h3 class="font-semibold mb-3">Opções de Conversão</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Provedor de IA</label>
              <select id="provider" class="w-full border border-gray-300 rounded px-4 py-2">
                <option value="openai">OpenAI (GPT)</option>
                <option value="gemini">Google Gemini</option>
                <option value="anthropic">Anthropic Claude</option>
              </select>
            </div>
            
            <div>
              <label class="block text-sm font-medium mb-1">Linguagem Alvo</label>
              <select id="targetLanguage" class="w-full border border-gray-300 rounded px-4 py-2">
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="csharp">C#</option>
                <option value="cpp">C++</option>
                <option value="ruby">Ruby</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="php">PHP</option>
              </select>
            </div>
          </div>
          
          <div class="mt-4">
            <label class="block text-sm font-medium mb-1">Chave de API</label>
            <input type="password" id="apiKey" class="w-full border border-gray-300 rounded px-4 py-2" placeholder="Insira sua chave de API">
          </div>
        </div>
        
        <div class="mt-8 flex justify-between">
          <button id="prevStep2" class="border border-gray-300 bg-white hover:bg-gray-100 text-gray-800 px-6 py-2 rounded">Anterior</button>
          <button id="nextStep2" class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded disabled:bg-gray-400" disabled>Próximo</button>
        </div>
      </div>
      
      <div id="step3" class="step-content hidden">
        <h2 class="text-xl font-semibold mb-4">Etapa 3: Processando Código</h2>
        
        <div class="bg-gray-100 rounded-lg p-6 mb-6">
          <h3 class="font-semibold mb-3">Resumo da Configuração</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p><strong>Pasta Base:</strong> <span id="summarySource" class="text-sm"></span></p>
              <p><strong>Pasta Intermediária:</strong> <span id="summaryTemp" class="text-sm"></span></p>
              <p><strong>Pasta de Saída:</strong> <span id="summaryOutput" class="text-sm"></span></p>
            </div>
            
            <div>
              <p><strong>Provedor de IA:</strong> <span id="summaryProvider"></span></p>
              <p><strong>Linguagem Alvo:</strong> <span id="summaryLanguage"></span></p>
              <p><strong>Opções:</strong> <span id="summaryOptions" class="text-sm"></span></p>
            </div>
          </div>
        </div>
        
        <div class="mb-6">
          <div class="w-full bg-gray-200 rounded-full h-4">
            <div id="progressBar" class="bg-blue-500 h-4 rounded-full transition-all duration-300" style="width: 0%"></div>
          </div>
          <p id="progressText" class="text-center mt-2">Aguardando início do processamento...</p>
        </div>
        
        <div class="mb-6">
          <h3 class="font-semibold mb-2">Log de Processamento</h3>
          <div id="processLog" class="h-40 overflow-y-auto border border-gray-300 rounded p-3 bg-gray-50 font-mono text-sm"></div>
        </div>
        
        <div class="mt-8 flex justify-between">
          <button id="prevStep3" class="border border-gray-300 bg-white hover:bg-gray-100 text-gray-800 px-6 py-2 rounded">Anterior</button>
          <button id="startProcessing" class="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded">Iniciar Processamento</button>
          <button id="nextStep3" class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded disabled:bg-gray-400" disabled>Próximo</button>
        </div>
      </div>
      
      <div id="step4" class="step-content hidden">
        <h2 class="text-xl font-semibold mb-4">Etapa 4: Resultados</h2>
        
        <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div class="flex items-center mb-2">
            <svg class="w-6 h-6 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <h3 class="font-semibold text-green-700">Processamento Concluído</h3>
          </div>
          <p>O código foi processado com sucesso. Resumo do processamento:</p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div class="border border-gray-200 rounded-lg p-4">
            <h3 class="font-semibold mb-2">Arquivos Processados</h3>
            <p id="filesCount" class="text-2xl font-bold text-blue-600">0</p>
            <p class="text-sm text-gray-600">Arquivos processados com sucesso</p>
          </div>
          
          <div class="border border-gray-200 rounded-lg p-4">
            <h3 class="font-semibold mb-2">Tempo de Processamento</h3>
            <p id="processingTime" class="text-2xl font-bold text-blue-600">0s</p>
            <p class="text-sm text-gray-600">Tempo total de processamento</p>
          </div>
          
          <div class="border border-gray-200 rounded-lg p-4">
            <h3 class="font-semibold mb-2">Tamanho dos Arquivos</h3>
            <p id="filesSize" class="text-2xl font-bold text-blue-600">0 KB</p>
            <p class="text-sm text-gray-600">Tamanho total dos arquivos processados</p>
          </div>
        </div>
        
        <div class="mb-6">
          <h3 class="font-semibold mb-2">Detalhes dos Arquivos</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full bg-white border border-gray-200">
              <thead>
                <tr>
                  <th class="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Arquivo Original</th>
                  <th class="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Arquivo Simplificado</th>
                  <th class="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Arquivo Convertido</th>
                </tr>
              </thead>
              <tbody id="filesList">
                <!-- Os arquivos processados serão inseridos aqui -->
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="mt-8 flex justify-between">
          <button id="prevStep4" class="border border-gray-300 bg-white hover:bg-gray-100 text-gray-800 px-6 py-2 rounded">Anterior</button>
          <button id="openOutputFolder" class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded">Abrir Pasta de Saída</button>
          <button id="startNew" class="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded">Novo Processamento</button>
        </div>
      </div>
    </div>
  </div>
  
  <script src="dist/renderer.js"></script>
</body>
</html>

// src/renderer.ts
document.addEventListener('DOMContentLoaded', () => {
  let currentStep = 1;
  const totalSteps = 4;

  let processingStartTime = 0;
  let processingResults: any = null;

  // Dados do formulário
  const formData = {
    sourceFolder: '',
    tempFolder: '',
    outputFolder: '',
    simplificationOptions: {
      removeComments: true,
      reduceKeywords: false,
      minify: false
    },
    conversionOptions: {
      targetLanguage: 'javascript',
      provider: 'openai',
      apiKey: ''
    }
  };

  // Selecionadores de elementos
  const stepIndicators = {
    1: document.getElementById('step1-indicator'),
    2: document.getElementById('step2-indicator'),
    3: document.getElementById('step3-indicator'),
    4: document.getElementById('step4-indicator')
  };

  const stepContents = {
    1: document.getElementById('step1'),
    2: document.getElementById('step2'),
    3: document.getElementById('step3'),
    4: document.getElementById('step4')
  };

  const lineIndicators = {
    1: document.getElementById('line1'),
    2: document.getElementById('line2'),
    3: document.getElementById('line3')
  };

  // Botões de navegação
  document.getElementById('nextStep1')?.addEventListener('click', () => navigateToStep(2));
  document.getElementById('prevStep2')?.addEventListener('click', () => navigateToStep(1));
  document.getElementById('nextStep2')?.addEventListener('click', () => navigateToStep(3));
  document.getElementById('prevStep3')?.addEventListener('click', () => navigateToStep(2));
  document.getElementById('nextStep3')?.addEventListener('click', () => navigateToStep(4));
  document.getElementById('prevStep4')?.addEventListener('click', () => navigateToStep(3));
  document.getElementById('startNew')?.addEventListener('click', resetApplication);

  // Botões de seleção de pastas
  document.getElementById('selectSourceFolder')?.addEventListener('click', async () => {
    const folder = await window.api.selectFolder();
    if (folder) {
      formData.sourceFolder = folder;
      (document.getElementById('sourceFolder') as HTMLInputElement).value = folder;
      validateStep1();
    }
  });

  document.getElementById('selectTempFolder')?.addEventListener('click', async () => {
    const folder = await window.api.selectFolder();
    if (folder) {
      formData.tempFolder = folder;
      (document.getElementById('tempFolder') as HTMLInputElement).value = folder;
      validateStep2();
    }
  });

  document.getElementById('selectOutputFolder')?.addEventListener('click', async () => {
    const folder = await window.api.selectFolder();
    if (folder) {
      formData.outputFolder = folder;
      (document.getElementById('outputFolder') as HTMLInputElement).value = folder;
      validateStep2();
    }
  });

  // Event listeners para checkboxes
  document.getElementById('removeComments')?.addEventListener('change', (e) => {
    formData.simplificationOptions.removeComments = (e.target as HTMLInputElement).checked;
  });

  document.getElementById('reduceKeywords')?.addEventListener('change', (e) => {
    formData.simplificationOptions.reduceKeywords = (e.target as HTMLInputElement).checked;
  });

  document.getElementById('minify')?.addEventListener('change', (e) => {
    formData.simplificationOptions.minify = (e.target as HTMLInputElement).checked;
  });

  // Event listeners para selects e inputs
  document.getElementById('provider')?.addEventListener('change', (e) => {
    formData.conversionOptions.provider = (e.target as HTMLSelectElement).value as any;
    validateStep2();
  });

  document.getElementById('targetLanguage')?.addEventListener('change', (e) => {
    formData.conversionOptions.targetLanguage = (e.target as HTMLSelectElement).value;
  });

  document.getElementById('apiKey')?.addEventListener('input', (e) => {
    formData.conversionOptions.apiKey = (e.target as HTMLInputElement).value;
    validateStep2();
  });

  // Botão de iniciar processamento
  document.getElementById('startProcessing')?.addEventListener('click', startProcessing);
  
  // Botão para abrir pasta de saída
  document.getElementById('openOutputFolder')?.addEventListener('click', () => {
    if (formData.outputFolder) {
      // Em um app real, aqui seria usado o electron.shell.openPath
      logMessage(`Abrindo pasta: ${formData.outputFolder}`);
    }
  });

  // Função para validar a Etapa 1
  function validateStep1() {
    const nextButton = document.getElementById('nextStep1') as HTMLButtonElement;
    nextButton.disabled = !formData.sourceFolder;
  }

  // Função para validar a Etapa 2
  function validateStep2() {
    const nextButton = document.getElementById('nextStep2') as HTMLButtonElement;
    const isValid = Boolean(
      formData.tempFolder && 
      formData.outputFolder && 
      formData.conversionOptions.apiKey
    );
    nextButton.disabled = !isValid;
  }

  // Função para navegar entre as etapas
  function navigateToStep(step: number) {
    if (step < 1 || step > totalSteps) return;

    // Ocultar todas as etapas
    for (let i = 1; i <= totalSteps; i++) {
      stepContents[i]?.classList.add('hidden');
      
      // Atualizar indicadores
      if (stepIndicators[i]) {
        stepIndicators[i].classList.remove('step-active', 'step-completed', 'step-pending');
        
        if (i < step) {
          stepIndicators[i].classList.add('step-completed');
        } else if (i === step) {
          stepIndicators[i].classList.add('step-active');
        } else {
          stepIndicators[i].classList.add('step-pending');
        }
      }
      
      // Atualizar linhas de conexão
      if (i < totalSteps && lineIndicators[i]) {
        if (i < step) {
          lineIndicators[i].classList.remove('bg-gray-300');
          lineIndicators[i].classList.add('bg-green-500');
        } else {
          lineIndicators[i].classList.remove('bg-green-500');
          lineIndicators[i].classList.add('bg-gray-300');
        }
      }
    }
    
    // Exibir etapa atual
    stepContents[step]?.classList.remove('hidden');
    currentStep = step;
    
    // Ações específicas para cada etapa
    if (step === 3) {
      updateSummary();
    }
  }

  // Função para atualizar o resumo na etapa 3
  function updateSummary() {
    if (document.getElementById('summarySource')) {
      document.getElementById('summarySource')!.textContent = formData.sourceFolder;
      document.getElementById('summaryTemp')!.textContent = formData.tempFolder;
      document.getElementById('summaryOutput')!.textContent = formData.outputFolder;
      document.getElementById('summaryProvider')!.textContent = getProviderName(formData.conversionOptions.provider);
      document.getElementById('summaryLanguage')!.textContent = formData.conversionOptions.targetLanguage;
      
      const options = [];
      if (formData.simplificationOptions.removeComments) options.push('Remover comentários');
      if (formData.simplificationOptions.reduceKeywords) options.push('Reduzir palavras-chave');
      if (formData.simplificationOptions.minify) options.push('Minificar código');
      
      document.getElementById('summaryOptions')!.textContent = options.join(', ') || 'Nenhuma';
    }
  }

  function getProviderName(provider: string): string {
    switch (provider) {
      case 'openai': return 'OpenAI (GPT)';
      case 'gemini': return 'Google Gemini';
      case 'anthropic': return 'Anthropic Claude';
      default: return provider;
    }
  }

  // Função para iniciar o processamento
  async function startProcessing() {
    const startButton = document.getElementById('startProcessing') as HTMLButtonElement;
    const nextButton = document.getElementById('nextStep3') as HTMLButtonElement;
    
    startButton.disabled = true;
    startButton.textContent = 'Processando...';
    resetProgress();
    
    processingStartTime = Date.now();
    
    try {
      // Simulação de log de progresso
      for (let i = 0; i <= 100; i += 10) {
        await simulateProgress(i);
      }
      
      // Em um app real, aqui seria chamada a API window.api.processCode
      // const result = await window.api.processCode(formData);
      
      // Simulamos um resultado para demonstração
      processingResults = {
        success: true,
        result: {
          processedFiles: [
            { original: `${formData.sourceFolder}/app.js`, simplified: `${formData.tempFolder}/app.js` },
            { original: `${formData.sourceFolder}/utils.js`, simplified: `${formData.tempFolder}/utils.js` },
            { original: `${formData.sourceFolder}/lib/helper.js`, simplified: `${formData.tempFolder}/lib/helper.js` }
          ],
          convertedFiles: [
            { simplified: `${formData.tempFolder}/app.js`, converted: `${formData.outputFolder}/app.${getFileExtension()}` },
            { simplified: `${formData.tempFolder}/utils.js`, converted: `${formData.outputFolder}/utils.${getFileExtension()}` },
            { simplified: `${formData.tempFolder}/lib/helper.js`, converted: `${formData.outputFolder}/lib/helper.${getFileExtension()}` }
          ]
        }
      };
      
      // Atualizar UI com resultados
      nextButton.disabled = false;
      logMessage('✅ Processamento concluído com sucesso!');
    } catch (error) {
      logMessage(`❌ Erro durante o processamento: ${error}`);
    } finally {
      startButton.disabled = false;
      startButton.textContent = 'Iniciar Processamento';
      updateProcessingResults();
    }
  }

  function getFileExtension(): string {
    const langExtMap: Record<string, string> = {
      'javascript': 'js',
      'typescript': 'ts',
      'python': 'py',
      'java': 'java',
      'csharp': 'cs',
      'cpp': 'cpp',
      'ruby': 'rb',
      'go': 'go',
      'rust': 'rs',
      'php': 'php'
    };
    
    return langExtMap[formData.conversionOptions.targetLanguage.toLowerCase()] || 'txt';
  }

  // Função para simular o progresso
  function simulateProgress(percent: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        updateProgress(percent);
        if (percent % 30 === 0) {
          logMessage(`${percent}% - Processando arquivos...`);
        }
        resolve();
      }, 300);
    });
  }

  // Função para atualizar a barra de progresso
  function updateProgress(percent: number) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    if (progressBar && progressText) {
      progressBar.style.width = `${percent}%`;
      progressText.textContent = `${percent}% concluído`;
    }
  }

  // Função para resetar o progresso
  function resetProgress() {
    updateProgress(0);
    const logElement = document.getElementById('processLog');
    if (logElement) {
      logElement.innerHTML = '';
    }
  }

  // Função para adicionar mensagem ao log
  function logMessage(message: string) {
    const logElement = document.getElementById('processLog');
    if (logElement) {
      const timestamp = new Date().toLocaleTimeString();
      const logLine = document.createElement('div');
      logLine.innerHTML = `<span class="text-gray-500">[${timestamp}]</span> ${message}`;
      logElement.appendChild(logLine);
      logElement.scrollTop = logElement.scrollHeight;
    }
  }

  // Função para atualizar os resultados na etapa 4
  function updateProcessingResults() {
    if (!processingResults || !processingResults.success) return;
    
    const processingTime = Math.round((Date.now() - processingStartTime) / 1000);
    const filesCount = processingResults.result.convertedFiles.length;
    
    if (document.getElementById('filesCount')) {
      document.getElementById('filesCount')!.textContent = filesCount.toString();
      document.getElementById('processingTime')!.textContent = `${processingTime}s`;
      document.getElementById('filesSize')!.textContent = `${filesCount * 25} KB`; // Valor fictício
    }
    
    // Preencher tabela de arquivos
    const filesList = document.getElementById('filesList');
    if (filesList) {
      filesList.innerHTML = '';
      
      for (let i = 0; i < processingResults.result.convertedFiles.length; i++) {
        const original = processingResults.result.processedFiles[i].original;
        const simplified = processingResults.result.processedFiles[i].simplified;
        const converted = processingResults.result.convertedFiles[i].converted;
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td class="py-2 px-4 border-b border-gray-200">${getShortPath(original)}</td>
          <td class="py-2 px-4 border-b border-gray-200">${getShortPath(simplified)}</td>
          <td class="py-2 px-4 border-b border-gray-200">${getShortPath(converted)}</td>
        `;
        
        filesList.appendChild(row);
      }
    }
  }

  // Função para encurtar caminhos longos
  function getShortPath(path: string): string {
    if (path.length > 40) {
      const parts = path.split('/');
      const filename = parts.pop() || '';
      
      if (parts.length > 2) {
        return `.../${parts[parts.length - 1]}/${filename}`;
      }
    }
    return path;
  }

  // Função para resetar o aplicativo
  function resetApplication() {
    formData.sourceFolder = '';
    formData.tempFolder = '';
    formData.outputFolder = '';
    formData.simplificationOptions.removeComments = true;
    formData.simplificationOptions.reduceKeywords = false;
    formData.simplificationOptions.minify = false;
    formData.conversionOptions.targetLanguage = 'javascript';
    formData.conversionOptions.provider = 'openai';
    formData.conversionOptions.apiKey = '';
    
    (document.getElementById('sourceFolder') as HTMLInputElement).value = '';
    (document.getElementById('tempFolder') as HTMLInputElement).value = '';
    (document.getElementById('outputFolder') as HTMLInputElement).value = '';
    (document.getElementById('removeComments') as HTMLInputElement).checked = true;
    (document.getElementById('reduceKeywords') as HTMLInputElement).checked = false;
    (document.getElementById('minify') as HTMLInputElement).checked = false;
    (document.getElementById('provider') as HTMLSelectElement).value = 'openai';
    (document.getElementById('targetLanguage') as HTMLSelectElement).value = 'javascript';
    (document.getElementById('apiKey') as HTMLInputElement).value = '';
    
    processingResults = null;
    
    navigateToStep(1);
  }

  // Inicialização da interface
  validateStep1();
  validateStep2();
});