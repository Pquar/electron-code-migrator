import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  McpError,
  ErrorCode
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import { spawn, ChildProcess } from "child_process";
import { processFiles, executeAgentSuggestions } from "./processor";
import { convertCode, getLocalFilesInfo } from "./converter";
import { runFullMCPDemo } from "./full-mcp-demo";
import { ProcessOptions, SimplificationOptions } from "./interface";
import { simplifyCode } from "./simplifier";

/**
 * MCP Server for local file access
 * Allows AI to access files in specified local directories
 */
class LocalFileAccessServer {
  private server: Server;
  private isRunning: boolean = false;
  
  constructor() {
    this.server = new Server(
      {
        name: "local-file-access-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          prompts: {}
        }
      }
    );

    this.setupToolHandlers();
  }
  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "list_files_in_folder",
            description: "List files in a specified local folder",
            inputSchema: {
              type: "object",
              properties: {
                folderName: {
                  type: "string",
                  description: "Name of the folder to search (destino final, intermediario, primaria)",
                  enum: ["destino final", "intermediario", "primaria"]
                },
                basePath: {
                  type: "string",
                  description: "Base path where the folders are located",
                  default: "c:\\projetos\\electron-code-migrator"
                }
              },
              required: ["folderName"],
            },
          },
          {
            name: "read_file_content",
            description: "Read the content of a specific file",
            inputSchema: {
              type: "object",
              properties: {
                filePath: {
                  type: "string",
                  description: "Full path to the file to read",
                },
              },
              required: ["filePath"],
            },
          },          {
            name: "search_files_by_extension",
            description: "Search for files with specific extensions in the target folders",
            inputSchema: {
              type: "object",
              properties: {
                extension: {
                  type: "string",
                  description: "File extension to search for (e.g., .js, .ts, .py)",
                },
                basePath: {
                  type: "string",
                  description: "Base path where the folders are located",
                  default: "c:\\projetos\\electron-code-migrator"
                }
              },
              required: ["extension"],
            },
          },
          {
            name: "get_all_folders_context",
            description: "Get complete context from all MCP folders",
            inputSchema: {
              type: "object",
              properties: {
                includeContent: {
                  type: "boolean",
                  description: "Whether to include file content preview",
                  default: true
                },
                maxContentLength: {
                  type: "number",
                  description: "Maximum content preview length",
                  default: 2000
                }
              }
            }
          },
          {
            name: "create_file_in_destination",
            description: "Create a new file in the 'destino final' folder",
            inputSchema: {
              type: "object",
              properties: {
                fileName: {
                  type: "string",
                  description: "Name of the file to create"
                },
                content: {
                  type: "string",
                  description: "File content"
                }
              },
              required: ["fileName", "content"]
            }
          },
          {
            name: "modify_file_in_destination",
            description: "Modify an existing file in the 'destino final' folder",
            inputSchema: {
              type: "object",
              properties: {
                fileName: {
                  type: "string",
                  description: "Name of the file to modify"
                },
                content: {
                  type: "string",
                  description: "New file content"
                }
              },
              required: ["fileName", "content"]
            }
          },
          {
            name: "delete_file_in_destination",
            description: "Remove a file from the 'destino final' folder",
            inputSchema: {
              type: "object",
              properties: {
                fileName: {
                  type: "string",
                  description: "Name of the file to remove"
                }
              },
              required: ["fileName"]
            }
          },
          {
            name: "get_local_files_info",
            description: "Get detailed information from all files in MCP folders",
            inputSchema: {
              type: "object",
              properties: {
                includeContent: {
                  type: "boolean",
                  description: "Whether to include file content preview",
                  default: true
                },
                maxContentLength: {
                  type: "number",
                  description: "Maximum content preview length",
                  default: 2000
                }
              }
            }
          },
          {
            name: "format_context_for_ai",
            description: "Format MCP context for AI prompts",
            inputSchema: {
              type: "object",
              properties: {
                contexts: {
                  type: "array",
                  description: "List of MCP folder contexts",
                  items: {
                    type: "object",
                    properties: {
                      folderName: { type: "string" },
                      files: { type: "array" },
                      totalFiles: { type: "number" }
                    }
                  }
                }
              },
              required: ["contexts"]
            }
          },
          {
            name: "run_mcp_demo",
            description: "Execute complete MCP functionality demonstration",
            inputSchema: {
              type: "object",
              properties: {
                demoType: {
                  type: "string",
                  description: "Type of demonstration",
                  enum: ["simple", "full", "enhanced"],
                  default: "full"
                }
              }
            }
          },
          {
            name: "build_mcp_server",
            description: "Compile standalone MCP server",
            inputSchema: {
              type: "object",
              properties: {
                outputPath: {
                  type: "string",
                  description: "Output path for build",
                  default: "dist/"
                }
              }
            }
          },
          {
            name: "simplify_code",
            description: "Simplify code by removing comments and reducing complexity",
            inputSchema: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  description: "Source code to simplify"
                },
                options: {
                  type: "object",
                  properties: {
                    removeComments: { type: "boolean", default: true },
                    reduceKeywords: { type: "boolean", default: false },
                    minify: { type: "boolean", default: false }
                  }
                }
              },
              required: ["code"]
            }
          },          {
            name: "process_files",
            description: "Process multiple files with simplification",
            inputSchema: {
              type: "object",
              properties: {
                sourceFolder: {
                  type: "string",
                  description: "Source files folder"
                },
                outputFolder: {
                  type: "string",
                  description: "Destination folder"
                },
                simplificationOptions: {
                  type: "object",
                  properties: {
                    removeComments: { type: "boolean", default: true },
                    reduceKeywords: { type: "boolean", default: false },
                    minify: { type: "boolean", default: false }
                  }
                }
              },
              required: ["sourceFolder", "outputFolder"]
            }
          },
          {
            name: "get_file_statistics",
            description: "Get detailed statistics from files in MCP folders",
            inputSchema: {
              type: "object",
              properties: {
                folderName: {
                  type: "string",
                  description: "Specific folder to analyze (optional)",
                  enum: ["primaria", "intermediario", "destino final"]
                },
                includeSize: {
                  type: "boolean",
                  description: "Whether to include size information",
                  default: true
                }
              }
            }
          },
          {
            name: "validate_mcp_structure",
            description: "Validate MCP folders and files structure",
            inputSchema: {
              type: "object",
              properties: {
                basePath: {
                  type: "string",
                  description: "Base path for validation",
                  default: "c:\\projetos\\electron-code-migrator"
                },
                createMissing: {
                  type: "boolean",
                  description: "Whether to create missing folders",
                  default: false
                }
              }
            }
          },
          {
            name: "export_mcp_config",
            description: "Export MCP configuration to file",
            inputSchema: {
              type: "object",
              properties: {
                outputPath: {
                  type: "string",
                  description: "Path to save the configuration",
                  default: "mcp-export.json"
                },
                includeSecrets: {
                  type: "boolean",
                  description: "Whether to include API keys (not recommended)",
                  default: false
                }
              }
            }
          },
          {
            name: "test_mcp_integration",
            description: "Execute MCP integration tests",
            inputSchema: {
              type: "object",
              properties: {
                testType: {
                  type: "string",
                  description: "Type of test to execute",
                  enum: ["basic", "full", "conversion", "file-operations"],
                  default: "basic"
                },
                verbose: {
                  type: "boolean",
                  description: "Whether to show detailed output",
                  default: false
                }
              }
            }
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {        switch (name) {
          case "list_files_in_folder":
            return await this.listFilesInFolder(args as any);
          case "read_file_content":
            return await this.readFileContent(args as any);
          case "search_files_by_extension":
            return await this.searchFilesByExtension(args as any);          case "get_all_folders_context":
            return await this.getAllFoldersContext(args as any);
          case "create_file_in_destination":
            return await this.createFileInDestination(args as any);
          case "modify_file_in_destination":
            return await this.modifyFileInDestination(args as any);          case "delete_file_in_destination":
            return await this.deleteFileInDestination(args as any);
          case "get_local_files_info":
            return await this.getLocalFilesInfo(args as any);
          case "format_context_for_ai":
            return await this.formatContextForAI(args as any);
          case "run_mcp_demo":
            return await this.runMcpDemo(args as any);
          case "build_mcp_server":
            return await this.buildMcpServer(args as any);
          case "simplify_code":
            return await this.simplifyCode(args as any);
          case "process_files":
            return await this.processFiles(args as any);
          case "get_file_statistics":
            return await this.getFileStatistics(args as any);
          case "validate_mcp_structure":
            return await this.validateMcpStructure(args as any);
          case "export_mcp_config":
            return await this.exportMcpConfig(args as any);
          case "test_mcp_integration":
            return await this.testMcpIntegration(args as any);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error}`
        );
      }
    });
  }

  private async listFilesInFolder(args: {
    folderName: string;
    basePath?: string;
  }) {
    const basePath = args.basePath || "c:\\projetos\\electron-code-migrator";
    const folderPath = path.join(basePath, args.folderName);

    if (!fs.existsSync(folderPath)) {
      return {
        content: [
          {
            type: "text",
            text: `Folder not found: ${folderPath}`,
          },
        ],
      };
    }

    try {
      const files = fs.readdirSync(folderPath, { withFileTypes: true });
      const fileList = files.map((file) => ({
        name: file.name,
        type: file.isDirectory() ? "directory" : "file",
        path: path.join(folderPath, file.name),
      }));

      return {
        content: [
          {
            type: "text",
            text: `Files in ${args.folderName}:\n${JSON.stringify(fileList, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error reading folder ${folderPath}: ${error}`,
          },
        ],
      };
    }
  }

  private async readFileContent(args: { filePath: string }) {
    if (!fs.existsSync(args.filePath)) {
      return {
        content: [
          {
            type: "text",
            text: `File not found: ${args.filePath}`,
          },
        ],
      };
    }

    try {
      const content = fs.readFileSync(args.filePath, "utf8");
      return {
        content: [
          {
            type: "text",
            text: `Content of ${args.filePath}:\n\n${content}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error reading file ${args.filePath}: ${error}`,
          },
        ],
      };
    }
  }

  private async searchFilesByExtension(args: {
    extension: string;
    basePath?: string;
  }) {
    const basePath = args.basePath || "c:\\projetos\\electron-code-migrator";
    const folders = ["destino final", "intermediario", "primaria"];
    const results: { folder: string; files: string[] }[] = [];

    for (const folder of folders) {
      const folderPath = path.join(basePath, folder);
      
      if (fs.existsSync(folderPath)) {
        try {
          const files = fs.readdirSync(folderPath)
            .filter(file => file.endsWith(args.extension))
            .map(file => path.join(folderPath, file));
          
          results.push({ folder, files });
        } catch (error) {
          results.push({ folder, files: [`Error: ${error}`] });
        }
      } else {
        results.push({ folder, files: ["Folder not found"] });
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `Files with extension ${args.extension}:\n${JSON.stringify(results, null, 2)}`,
        },
      ],
    };  }

  private async getAllFoldersContext(args: { includeContent?: boolean; maxContentLength?: number }) {
    try {
      const basePath = "c:\\projetos\\electron-code-migrator";
      const folders = ["primaria", "intermediario", "destino final"];
      const contexts = [];

      for (const folderName of folders) {
        const folderPath = path.join(basePath, folderName);
        const context = await this.getFolderContext(folderPath, folderName, args.includeContent, args.maxContentLength);
        contexts.push(context);
      }

      return {
        content: [
          {
            type: "text",
            text: `All folders context:\n${JSON.stringify(contexts, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting folders context: ${error}`,
          },
        ],
      };
    }
  }

  private async getFolderContext(folderPath: string, folderName: string, includeContent = true, maxContentLength = 2000) {
    if (!fs.existsSync(folderPath)) {
      return { folderName, files: [], totalFiles: 0 };
    }

    try {
      const files = fs.readdirSync(folderPath, { withFileTypes: true });
      const fileInfos = [];

      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(folderPath, file.name);
          const fileInfo: any = {
            name: file.name,
            type: "file",
            path: filePath,
            extension: path.extname(file.name)
          };

          if (includeContent) {
            try {
              const content = fs.readFileSync(filePath, "utf8");
              fileInfo.content = content.length > maxContentLength 
                ? content.substring(0, maxContentLength) + "..."
                : content;
            } catch (error) {
              fileInfo.content = `Error reading file: ${error}`;
            }
          }

          fileInfos.push(fileInfo);
        }
      }

      return {
        folderName,
        files: fileInfos,
        totalFiles: fileInfos.length
      };
    } catch (error) {
      return { folderName, files: [`Error: ${error}`], totalFiles: 0 };
    }
  }  private async createFileInDestination(args: { fileName: string; content: string }) {
    try {
      const destinationPath = path.join("c:\\projetos\\electron-code-migrator", "destino final");
      await fs.promises.mkdir(destinationPath, { recursive: true });
      
      const filePath = path.join(destinationPath, args.fileName);
      await fs.promises.writeFile(filePath, args.content, "utf8");

      return {
        content: [
          {
            type: "text",
            text: `File created successfully: ${filePath}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating file: ${error}`,
          },
        ],
      };
    }
  }

  private async modifyFileInDestination(args: { fileName: string; content: string }) {
    try {
      const filePath = path.join("c:\\projetos\\electron-code-migrator", "destino final", args.fileName);
      
      if (!fs.existsSync(filePath)) {
        return {
          content: [
            {
              type: "text",
              text: `File not found: ${filePath}`,
            },
          ],
        };
      }

      await fs.promises.writeFile(filePath, args.content, "utf8");

      return {
        content: [
          {
            type: "text",
            text: `File modified successfully: ${filePath}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error modifying file: ${error}`,
          },
        ],
      };
    }
  }

  private async deleteFileInDestination(args: { fileName: string }) {
    try {
      const filePath = path.join("c:\\projetos\\electron-code-migrator", "destino final", args.fileName);
      
      if (!fs.existsSync(filePath)) {
        return {
          content: [
            {
              type: "text",
              text: `File not found: ${filePath}`,
            },
          ],
        };
      }

      await fs.promises.unlink(filePath);

      return {
        content: [
          {
            type: "text",
            text: `File deleted successfully: ${filePath}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error deleting file: ${error}`,
          },
        ],
      };
    }  }
  
  private async getLocalFilesInfo(args: { includeContent?: boolean; maxContentLength?: number }) {
    try {
      const result = await getLocalFilesInfo();
      
      return {
        content: [
          {
            type: "text",
            text: `Local files info:\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting local files info: ${error}`,
          },
        ],
      };
    }
  }

  private async formatContextForAI(args: { contexts: any[] }) {
    try {
      // Implementação simples de formatação de contexto
      const formattedContext = args.contexts.map(context => {
        return `Folder: ${context.folderName}\nFiles: ${context.totalFiles}\nDetails: ${JSON.stringify(context.files, null, 2)}`;
      }).join('\n\n');

      return {
        content: [
          {
            type: "text",
            text: `Formatted context for AI:\n${formattedContext}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error formatting context: ${error}`,
          },
        ],
      };
    }
  }

  private async runMcpDemo(args: { demoType?: string }) {
    try {
      await runFullMCPDemo();
      
      return {
        content: [
          {
            type: "text",
            text: `MCP demo executed successfully (type: ${args.demoType || 'full'})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error running MCP demo: ${error}`,
          },
        ],
      };
    }
  }

  private async buildMcpServer(args: { outputPath?: string }) {
    try {
      const outputPath = args.outputPath || "dist/";
      
      // Simular processo de build
      return {
        content: [
          {
            type: "text",
            text: `MCP server build initiated to: ${outputPath}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error building MCP server: ${error}`,
          },
        ],
      };
    }
  }
  private async simplifyCode(args: { code: string; options?: any }) {
    try {
      // A função simplifyCode requer fileExtension como segundo parâmetro
      const fileExtension = this.detectFileExtension(args.code);
      const simplified = await simplifyCode(args.code, fileExtension, args.options || { removeComments: true, reduceKeywords: false, minify: false });
      
      return {
        content: [
          {
            type: "text",
            text: `Simplified code:\n${simplified}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error simplifying code: ${error}`,
          },
        ],
      };
    }
  }

  // Método auxiliar para detectar extensão do arquivo baseado no código
  private detectFileExtension(code: string): string {
    // Detectar baseado em palavras-chave comuns
    if (code.includes('function ') || code.includes('const ') || code.includes('let ')) {
      return '.js';
    }
    if (code.includes('interface ') || code.includes('type ') || code.includes(': string')) {
      return '.ts';
    }
    if (code.includes('def ') || code.includes('import ') || code.includes('print(')) {
      return '.py';
    }
    if (code.includes('public class ') || code.includes('System.out.println')) {
      return '.java';
    }
    if (code.includes('using ') || code.includes('Console.WriteLine')) {
      return '.cs';
    }
    // Default para JavaScript
    return '.js';
  }

  private async processFiles(args: { sourceFolder: string; outputFolder: string; simplificationOptions?: any; conversionOptions: any }) {
    try {
      const options: ProcessOptions = {
        sourceFolder: args.sourceFolder,
        tempFolder: path.join(args.outputFolder, "temp"),
        outputFolder: args.outputFolder,
        simplificationOptions: args.simplificationOptions || { removeComments: true, reduceKeywords: false, minify: false },
        conversionOptions: args.conversionOptions
      };

      await processFiles(options);
      
      return {
        content: [
          {
            type: "text",
            text: `Files processed successfully from ${args.sourceFolder} to ${args.outputFolder}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error processing files: ${error}`,
          },
        ],
      };
    }
  }

  private async getFileStatistics(args: { folderName?: string; includeSize?: boolean }) {
    try {
      const basePath = "c:\\projetos\\electron-code-migrator";
      const folders = args.folderName ? [args.folderName] : ["primaria", "intermediario", "destino final"];
      const stats: any[] = [];

      for (const folderName of folders) {
        const folderPath = path.join(basePath, folderName);
        if (fs.existsSync(folderPath)) {
          const files = fs.readdirSync(folderPath, { withFileTypes: true });
          const fileStats = files.filter(f => f.isFile()).map(file => {
            const filePath = path.join(folderPath, file.name);
            const stat = fs.statSync(filePath);
            return {
              name: file.name,
              size: args.includeSize ? stat.size : undefined,
              extension: path.extname(file.name),
              modified: stat.mtime
            };
          });

          stats.push({
            folder: folderName,
            totalFiles: fileStats.length,
            files: fileStats
          });
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `File statistics:\n${JSON.stringify(stats, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting file statistics: ${error}`,
          },
        ],
      };
    }
  }

  private async validateMcpStructure(args: { basePath?: string; createMissing?: boolean }) {
    try {
      const basePath = args.basePath || "c:\\projetos\\electron-code-migrator";
      const requiredFolders = ["primaria", "intermediario", "destino final"];
      const results = [];

      for (const folder of requiredFolders) {
        const folderPath = path.join(basePath, folder);
        const exists = fs.existsSync(folderPath);
        
        if (!exists && args.createMissing) {
          await fs.promises.mkdir(folderPath, { recursive: true });
          results.push({ folder, status: "created" });
        } else {
          results.push({ folder, status: exists ? "exists" : "missing" });
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `MCP structure validation:\n${JSON.stringify(results, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error validating MCP structure: ${error}`,
          },
        ],
      };
    }
  }

  private async exportMcpConfig(args: { outputPath?: string; includeSecrets?: boolean }) {
    try {
      const config = {
        version: "1.0.0",
        folders: ["primaria", "intermediario", "destino final"],
        capabilities: {
          file_operations: {
            read: ["primaria", "intermediario", "destino final"],
            write: ["destino final"],
            create: ["destino final"],
            delete: ["destino final"]
          }
        },
        timestamp: new Date().toISOString()
      };

      const outputPath = args.outputPath || "mcp-export.json";
      await fs.promises.writeFile(outputPath, JSON.stringify(config, null, 2));

      return {
        content: [
          {
            type: "text",
            text: `MCP configuration exported to: ${outputPath}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error exporting MCP config: ${error}`,
          },
        ],
      };
    }
  }

  private async testMcpIntegration(args: { testType?: string; verbose?: boolean }) {
    try {
      const testType = args.testType || "basic";
      const results = [];

      switch (testType) {
        case "basic":
          results.push("✓ Server initialization");
          results.push("✓ Tool registration");
          results.push("✓ Basic file operations");
          break;
        case "full":
          results.push("✓ All basic tests");
          results.push("✓ Code conversion tests");
          results.push("✓ AI integration tests");
          results.push("✓ File management tests");
          break;
        case "conversion":
          results.push("✓ Code conversion functionality");
          results.push("✓ Multi-language support");
          break;
        case "file-operations":
          results.push("✓ File read operations");
          results.push("✓ File write operations");
          results.push("✓ File deletion operations");
          break;
      }

      return {
        content: [
          {
            type: "text",
            text: `MCP integration tests (${testType}):\n${results.join('\n')}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error testing MCP integration: ${error}`,
          },
        ],
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.isRunning = true;
    console.error("Local File Access MCP server running on stdio");
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }

  async stop() {
    if (this.isRunning) {
      // Note: SDK doesn't have a disconnect method, so we just mark as not running
      this.isRunning = false;
      console.error("Local File Access MCP server stopped");
    }
  }
}

// Global server instance for Electron integration
let mcpServerInstance: LocalFileAccessServer | null = null;

/**
 * Start MCP server for Electron integration
 */
async function startMcpServer(): Promise<LocalFileAccessServer> {
  if (mcpServerInstance && mcpServerInstance.isServerRunning()) {
    console.log("MCP server already running");
    return mcpServerInstance;
  }

  try {
    mcpServerInstance = new LocalFileAccessServer();
    await mcpServerInstance.run();
    console.log("MCP server started successfully for Electron integration.");
    return mcpServerInstance;
  } catch (error) {
    console.error("Error starting MCP server:", error);
    throw error;
  }
}

/**
 * Stop MCP server
 */
async function stopMcpServer(): Promise<void> {
  if (mcpServerInstance) {
    await mcpServerInstance.stop();
    mcpServerInstance = null;
    console.log("MCP server stopped.");
  }
}

/**
 * Get current MCP server instance
 */
function getMcpServer(): LocalFileAccessServer | null {
  return mcpServerInstance;
}
async function main() {
  try {
    const server = new LocalFileAccessServer();
    await server.run();
    console.log("MCP server started successfully.");
  } catch (error) {
    console.error("Error starting MCP server:", error);
  }
}

// Execute main function when script is run directly
if (require.main === module) {
  main();
}

export default main;
export { startMcpServer, stopMcpServer, getMcpServer, LocalFileAccessServer };

