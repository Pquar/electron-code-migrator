# MCP Integration Guide

Este projeto agora inclui integração com o Model Context Protocol (MCP) para permitir que a IA acesse arquivos locais durante a conversão de código.

## Configuração do MCP

### 1. Instalar Dependências
```bash
npm install @modelcontextprotocol/sdk
```

### 2. Compilar o Servidor MCP
```bash
npm run build-mcp
```

### 3. Iniciar o Servidor MCP
```bash
npm run start-mcp
```

## Funcionalidades Disponíveis

### Ferramentas MCP Implementadas

1. **list_files_in_folder**
   - Lista arquivos em uma pasta específica
   - Parâmetros: `folderName` (destino final, intermediario, primaria)

2. **read_file_content**
   - Lê o conteúdo de um arquivo específico
   - Parâmetros: `filePath` (caminho completo do arquivo)

3. **search_files_by_extension**
   - Busca arquivos por extensão nas pastas alvo
   - Parâmetros: `extension` (.js, .ts, .py, etc.)

### Pastas Monitoradas

O sistema monitora as seguintes pastas:
- `destino final` - Arquivos convertidos finais
- `intermediario` - Arquivos em processo de conversão
- `primaria` - Arquivos fonte originais

## Como Usar

### Método 1: Integração Automática (Recomendado)

O conversor agora automaticamente obtém contexto dos arquivos locais:

```typescript
import { convertCode } from './converter';

const result = await convertCode(
  sourceCode,
  '.js',
  {
    provider: 'openai',
    apiKey: 'your-api-key',
    targetLanguage: 'python',
    customPrompt: 'Convert to Python with error handling'
  }
);
```

### Método 2: Uso Direto do MCP Converter

```typescript
import { MCPIntegratedConverter } from './mcp-converter';

const converter = new MCPIntegratedConverter('your-openai-api-key');

const convertedCode = await converter.convertCodeWithLocalContext(
  sourceCode,
  'javascript',
  'python'
);
```

## Configuração no Cliente OpenAI

Para usar com clientes externos, configure o arquivo `mcp-config.json`:

```json
{
  "mcpServers": {
    "local-file-access": {
      "command": "node",
      "args": ["dist/mcp-server.js"],
      "env": {
        "NODE_PATH": "node_modules"
      }
    }
  }
}
```

## Benefícios da Integração MCP

1. **Contexto Rico**: A IA tem acesso aos arquivos locais para entender melhor o contexto
2. **Conversões Mais Precisas**: Pode analisar dependências e estruturas existentes
3. **Consistência**: Mantém padrões e convenções do projeto
4. **Segurança**: Acesso controlado apenas às pastas especificadas

## Estrutura de Arquivos

```
src/
├── converter.ts          # Conversor principal com integração MCP
├── mcp-server.ts         # Servidor MCP local
├── mcp-converter.ts      # Classe de conversão integrada com MCP
└── ...

mcp-config.json          # Configuração do servidor MCP
```

## Solução de Problemas

### Erro: "Pasta não encontrada"
Certifique-se de que as pastas `destino final`, `intermediario` e `primaria` existem no diretório do projeto.

### Erro: "MCP Server não está rodando"
Execute `npm run start-mcp` para iniciar o servidor.

### Erro: "Permissões negadas"
Verifique se o Node.js tem permissões para acessar as pastas especificadas.

## Próximos Passos

1. Criar as pastas necessárias se não existirem
2. Testar a conversão com arquivos de exemplo
3. Configurar o MCP em sua IDE ou cliente preferido
