# 🚀 Guia Completo de Comandos MCP - Electron Code Migrator

## 📋 Visão Geral

O arquivo `.mcp.json` agora contém **todos os comandos disponíveis** no Electron Code Migrator com integração MCP completa. Este guia explica como usar cada comando.

## 🔧 Configuração Inicial

### 1. Inputs Obrigatórios
```json
{
  "github_pat": "Seu GitHub Personal Access Token",
  "openai_api_key": "Sua chave da API OpenAI",
  "base_path": "c:\\projetos\\electron-code-migrator"
}
```

### 2. Servidores MCP Configurados

#### `github` - Servidor GitHub oficial
- Acesso a repositórios GitHub via Docker
- Usa token de acesso pessoal

#### `electron-code-migrator` - Servidor principal do projeto
- Servidor MCP customizado do projeto
- Acesso completo às funcionalidades locais

#### `file-processor` - Processador de arquivos
- Especializado em operações de arquivos
- Acesso às três pastas MCP

#### `code-converter` - Conversor de código
- Conversão inteligente com contexto
- Integração com IA

## 🛠️ Comandos Disponíveis

### 📁 **Operações de Arquivos**

#### 1. `list_files_in_folder`
Lista arquivos em uma pasta específica.

**Parâmetros:**
```json
{
  "folderName": "primaria|intermediario|destino final",
  "basePath": "caminho_base_opcional"
}
```

**Exemplo de uso:**
```typescript
const files = await mcp.callTool("list_files_in_folder", {
  "folderName": "primaria"
});
```

#### 2. `read_file_content`
Lê o conteúdo de um arquivo específico.

**Parâmetros:**
```json
{
  "filePath": "caminho_completo_do_arquivo",
  "maxLength": 2000
}
```

**Exemplo de uso:**
```typescript
const content = await mcp.callTool("read_file_content", {
  "filePath": "c:\\projetos\\electron-code-migrator\\primaria\\example.js"
});
```

#### 3. `search_files_by_extension`
Busca arquivos por extensão.

**Parâmetros:**
```json
{
  "extension": ".js|.ts|.py|.java",
  "folderName": "pasta_opcional"
}
```

**Exemplo de uso:**
```typescript
const jsFiles = await mcp.callTool("search_files_by_extension", {
  "extension": ".js"
});
```

### 🤖 **Operações com IA**

#### 4. `analyze_code_with_agent`
Análise inteligente de código com contexto MCP.

**Parâmetros:**
```json
{
  "files": [
    {
      "simplified": "caminho_simplificado",
      "converted": "caminho_convertido"
    }
  ],
  "targetLanguage": "python|javascript|java",
  "provider": "openai|gemini|anthropic|llama"
}
```

**Exemplo de uso:**
```typescript
const suggestions = await mcp.callTool("analyze_code_with_agent", {
  "files": [{
    "simplified": "intermediario/example.py",
    "converted": "destino final/math_processor.py"
  }],
  "targetLanguage": "python",
  "provider": "openai"
});
```

#### 5. `convert_code_with_context`
Conversão de código com contexto local.

**Parâmetros:**
```json
{
  "code": "código_fonte",
  "sourceLanguage": "linguagem_origem",
  "targetLanguage": "linguagem_destino",
  "customPrompt": "prompt_personalizado_opcional"
}
```

**Exemplo de uso:**
```typescript
const converted = await mcp.callTool("convert_code_with_context", {
  "code": "function add(a, b) { return a + b; }",
  "sourceLanguage": "javascript",
  "targetLanguage": "python"
});
```

### ✏️ **Operações de Escrita (Apenas "destino final")**

#### 6. `create_file_in_destination`
Cria novo arquivo na pasta "destino final".

**Parâmetros:**
```json
{
  "fileName": "nome_do_arquivo.ext",
  "content": "conteúdo_do_arquivo"
}
```

#### 7. `modify_file_in_destination`
Modifica arquivo existente na pasta "destino final".

**Parâmetros:**
```json
{
  "fileName": "arquivo_existente.ext",
  "content": "novo_conteúdo"
}
```

#### 8. `delete_file_in_destination`
Remove arquivo da pasta "destino final".

**Parâmetros:**
```json
{
  "fileName": "arquivo_para_remover.ext"
}
```

### 📊 **Operações de Contexto**

#### 9. `get_local_files_info`
Obtém informações detalhadas de todas as pastas MCP.

**Parâmetros:**
```json
{
  "includeContent": true,
  "maxContentLength": 2000
}
```

#### 10. `format_context_for_ai`
Formata contexto para prompts de IA.

**Parâmetros:**
```json
{
  "contexts": [
    {
      "folderName": "primaria",
      "files": [...],
      "totalFiles": 5
    }
  ]
}
```

### 🧪 **Operações de Demonstração**

#### 11. `run_mcp_demo`
Executa demonstrações das funcionalidades.

**Parâmetros:**
```json
{
  "demoType": "simple|full|enhanced"
}
```

#### 12. `build_mcp_server`
Compila o servidor MCP.

**Parâmetros:**
```json
{
  "outputPath": "dist/"
}
```

## 🚀 **Workflows Pré-configurados**

### 1. `code_migration` - Migração Completa de Código
```
1. get_local_files_info → Obtém contexto
2. analyze_code_with_agent → Analisa com IA
3. convert_code_with_context → Converte código
4. create_file_in_destination → Salva resultado
```

### 2. `project_analysis` - Análise de Projeto
```
1. list_files_in_folder → Lista arquivos
2. search_files_by_extension → Busca por tipo
3. read_file_content → Lê conteúdo
4. format_context_for_ai → Formata para IA
```

### 3. `ai_assisted_conversion` - Conversão Assistida por IA
```
1. get_local_files_info → Contexto local
2. convert_code_with_context → Conversão inteligente
3. analyze_code_with_agent → Análise final
```

## 🛡️ **Capacidades e Segurança**

### Operações de Arquivos:
- **Leitura**: `primaria`, `intermediario`, `destino final`
- **Escrita/Criação/Exclusão**: Apenas `destino final`

### Linguagens Suportadas:
- JavaScript, TypeScript, Python, Java, C#, Go, Rust

### Provedores de IA:
- OpenAI, Google Gemini, Anthropic, Llama

## 📖 **Exemplos Práticos**

### Exemplo 1: Análise Completa de Projeto
```typescript
// 1. Obter contexto completo
const context = await mcp.callTool("get_local_files_info");

// 2. Analisar arquivos JavaScript
const jsFiles = await mcp.callTool("search_files_by_extension", {
  "extension": ".js"
});

// 3. Converter com contexto
const converted = await mcp.callTool("convert_code_with_context", {
  "code": sourceCode,
  "sourceLanguage": "javascript",
  "targetLanguage": "python"
});
```

### Exemplo 2: Workflow de Migração
```typescript
// Executar workflow completo
const result = await mcp.executeWorkflow("code_migration", {
  files: [{ 
    simplified: "intermediario/app.js",
    converted: "destino final/app.py"
  }],
  targetLanguage: "python"
});
```

## 🎯 **Próximos Passos**

1. **Configurar inputs** no arquivo `.mcp.json`
2. **Testar comandos básicos** como `list_files_in_folder`
3. **Experimentar workflows** pré-configurados
4. **Personalizar** para suas necessidades específicas

## 📞 **Suporte**

- **Documentação completa**: `MCP-README.md`
- **Status da implementação**: `STATUS-MCP-UPDATED.md`
- **Funcionalidades avançadas**: `ENHANCED-ANALYZE-AGENT.md`

---

**🎉 Agora você tem acesso completo a todas as funcionalidades MCP do Electron Code Migrator!**
