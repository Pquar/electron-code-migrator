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

MIT