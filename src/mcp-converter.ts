import { OpenAI } from "openai";

/**
 * Exemplo de como integrar o servidor MCP local com o cliente OpenAI
 * Este arquivo demonstra como configurar e usar o acesso a arquivos locais
 */

export class MCPIntegratedConverter {
  private client: OpenAI;
  private mcpServerUrl: string;

  constructor(apiKey: string, mcpServerUrl: string = "http://localhost:3000") {
    this.client = new OpenAI({
      apiKey: apiKey,
    });
    this.mcpServerUrl = mcpServerUrl;
  }

  /**
   * Converte código com contexto dos arquivos locais
   */
  async convertCodeWithLocalContext(
    code: string,
    sourceLanguage: string,
    targetLanguage: string,
    customPrompt?: string
  ): Promise<string> {
    try {
      // Obter contexto dos arquivos locais
      const localContext = await this.getLocalFilesContext();

      // Criar prompt enriquecido
      const enrichedPrompt = this.createEnrichedPrompt(
        code,
        sourceLanguage,
        targetLanguage,
        localContext,
        customPrompt
      );

      // Fazer a conversão usando OpenAI
      const response = await this.client.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert code converter. Use the provided local file context to understand the codebase better and provide more accurate conversions."
          },
          {
            role: "user",
            content: enrichedPrompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      });

      return response.choices[0]?.message?.content || code;
    } catch (error) {
      console.error("Error converting code with local context:", error);
      throw error;
    }
  }

  /**
   * Obtém contexto dos arquivos locais usando as funções do MCP
   */
  private async getLocalFilesContext(): Promise<string> {
    const folders = ["destino final", "intermediario", "primaria"];
    let context = "=== LOCAL FILES CONTEXT ===\n";

    for (const folder of folders) {
      try {
        // Simular chamada para o servidor MCP local
        const filesInfo = await this.callMCPTool("list_files_in_folder", {
          folderName: folder,
        });
        context += `\n${folder}:\n${filesInfo}\n`;
      } catch (error) {
        context += `\n${folder}: Error accessing folder - ${error}\n`;
      }
    }

    return context;
  }

  /**
   * Simula uma chamada para o servidor MCP
   * Em uma implementação real, isso faria uma chamada HTTP ou use o SDK do MCP
   */
  private async callMCPTool(toolName: string, args: any): Promise<string> {
    // Por enquanto, usar a implementação local direta
    const fs = require("fs");
    const path = require("path");

    if (toolName === "list_files_in_folder") {
      const basePath = "c:\\projetos\\electron-code-migrator";
      const folderPath = path.join(basePath, args.folderName);

      if (!fs.existsSync(folderPath)) {
        return `Folder not found: ${folderPath}`;
      }

      const files = fs.readdirSync(folderPath, { withFileTypes: true });
      return files
        .map((file: any) => `- ${file.name} (${file.isDirectory() ? "dir" : "file"})`)
        .join("\n");
    }

    return "Tool not implemented";
  }

  /**
   * Cria um prompt enriquecido com contexto local
   */
  private createEnrichedPrompt(
    code: string,
    sourceLanguage: string,
    targetLanguage: string,
    localContext: string,
    customPrompt?: string
  ): string {
    const basePrompt = customPrompt || 
      `Convert this ${sourceLanguage} code to ${targetLanguage}, maintaining functionality:`;

    return `${basePrompt}

${localContext}

SOURCE CODE TO CONVERT:
\`\`\`${sourceLanguage}
${code}
\`\`\`

Please convert this code to ${targetLanguage}, taking into account the local file context provided above to ensure compatibility and proper integration.`;
  }
}

// Exemplo de uso
export async function exampleUsage() {
  const converter = new MCPIntegratedConverter("your-openai-api-key");
  
  const sourceCode = `
function processData(data) {
  return data.map(item => item * 2);
}
  `;

  try {
    const convertedCode = await converter.convertCodeWithLocalContext(
      sourceCode,
      "javascript",
      "python"
    );
    
    console.log("Converted code:", convertedCode);
  } catch (error) {
    console.error("Conversion failed:", error);
  }
}
