import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CallToolRequestSchema,
  McpError,
  ErrorCode
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

/**
 * MCP Server for local file access
 * Allows AI to access files in specified local directories
 */
class LocalFileAccessServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "local-file-access-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          prompts: {}
        }
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
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
          },
          {
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
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "list_files_in_folder":
            return await this.listFilesInFolder(args as any);
          case "read_file_content":
            return await this.readFileContent(args as any);
          case "search_files_by_extension":
            return await this.searchFilesByExtension(args as any);
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
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Local File Access MCP server running on stdio");
  }
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
export default main;

