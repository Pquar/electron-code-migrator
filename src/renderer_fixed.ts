// filepath: c:\projetos\electron-code-migrator\src\renderer.ts
console.log("Renderer script loaded");

// Removemos a chamada imediata de selectFolder() que estava causando o problema

document.addEventListener("DOMContentLoaded", () => {
  let currentStep = 1;
  const totalSteps = 5;

  let processingStartTime = 0;
  let processingResults: any = null;
  let minificationResults: any = null;

  // Dados do formulário
  const formData = {
    sourceFolder: "",
    tempFolder: "",
    outputFolder: "",
    simplificationOptions: {
      removeComments: true,
      reduceKeywords: false,
      minify: false,
    },
    conversionOptions: {
      targetLanguage: "javascript",
      provider: "openai",
      apiKey: "",
      apiUrl: "",
    },
  };

  // Selecionadores de elementos
  const stepIndicators: Record<number, HTMLElement | null> = {
    1: document.getElementById("step1-indicator"),
    2: document.getElementById("step2-indicator"),
    3: document.getElementById("step3-indicator"),
    4: document.getElementById("step4-indicator"),
    5: document.getElementById("step5-indicator"),
  };

  const stepContents: Record<number, HTMLElement | null> = {
    1: document.getElementById("step1"),
    2: document.getElementById("step2"),
    3: document.getElementById("step3"),
    4: document.getElementById("step4"),
    5: document.getElementById("step5"),
  };

  const lineIndicators: Record<number, HTMLElement | null> = {
    1: document.getElementById("line1"),
    2: document.getElementById("line2"),
    3: document.getElementById("line3"),
    4: document.getElementById("line4"),
  };

  // Botões de navegação
  document
    .getElementById("nextStep1")
    ?.addEventListener("click", () => navigateToStep(2));
  document
    .getElementById("prevStep2")
    ?.addEventListener("click", () => navigateToStep(1));
  document
    .getElementById("nextStep2")
    ?.addEventListener("click", () => navigateToStep(3));
  document
    .getElementById("prevStep3")
    ?.addEventListener("click", () => navigateToStep(2));
  document
    .getElementById("nextStep3")
    ?.addEventListener("click", () => navigateToStep(4));
  document
    .getElementById("prevStep4")
    ?.addEventListener("click", () => navigateToStep(3));
  document
    .getElementById("nextStep4")
    ?.addEventListener("click", () => navigateToStep(5));
  document
    .getElementById("prevStep5")
    ?.addEventListener("click", () => navigateToStep(4));
  document
    .getElementById("startNew")
    ?.addEventListener("click", resetApplication);

  // Botões de seleção de pastas
  document
    .getElementById("selectSourceFolder")
    ?.addEventListener("click", async () => {
      try {
        console.log("Selecionando pasta de origem...");
        const folder = await window.api.selectFolder();
        console.log("Pasta selecionada:", folder);
        if (folder) {
          formData.sourceFolder = folder;
          (document.getElementById("sourceFolder") as HTMLInputElement).value =
            folder;
          validateStep1();
        } else {
          console.log("Nenhuma pasta selecionada ou diálogo cancelado");
        }
      } catch (error) {
        console.error("Erro ao selecionar pasta:", error);
      }
    });

  document
    .getElementById("selectTempFolder")
    ?.addEventListener("click", async () => {
      try {
        console.log("Selecionando pasta temporária...");
        const folder = await window.api.selectFolder();
        console.log("Pasta temporária selecionada:", folder);
        if (folder) {
          formData.tempFolder = folder;
          (document.getElementById("tempFolder") as HTMLInputElement).value =
            folder;
          validateStep2();
        } else {
          console.log(
            "Nenhuma pasta temporária selecionada ou diálogo cancelado"
          );
        }
      } catch (error) {
        console.error("Erro ao selecionar pasta temporária:", error);
      }
    });

  document
    .getElementById("selectOutputFolder")
    ?.addEventListener("click", async () => {
      try {
        console.log("Selecionando pasta de saída...");
        const folder = await window.api.selectFolder();
        console.log("Pasta de saída selecionada:", folder);
        if (folder) {
          formData.outputFolder = folder;
          (document.getElementById("outputFolder") as HTMLInputElement).value =
            folder;
          validateStep2();
        } else {
          console.log(
            "Nenhuma pasta de saída selecionada ou diálogo cancelado"
          );
        }
      } catch (error) {
        console.error("Erro ao selecionar pasta de saída:", error);
      }
    });

  // Event listeners para checkboxes
  document.getElementById("removeComments")?.addEventListener("change", (e) => {
    formData.simplificationOptions.removeComments = (
      e.target as HTMLInputElement
    ).checked;
  });

  document.getElementById("reduceKeywords")?.addEventListener("change", (e) => {
    formData.simplificationOptions.reduceKeywords = (
      e.target as HTMLInputElement
    ).checked;
  });

  document.getElementById("minify")?.addEventListener("change", (e) => {
    formData.simplificationOptions.minify = (
      e.target as HTMLInputElement
    ).checked;
  });

  // Event listeners para selects e inputs
  document.getElementById("provider")?.addEventListener("change", (e) => {
    const provider = (e.target as HTMLSelectElement).value;
    formData.conversionOptions.provider = provider as any;
    
    // Mostrar/esconder o campo de URL da API para o Llama
    const apiUrlContainer = document.getElementById("apiUrlContainer");
    if (apiUrlContainer) {
      apiUrlContainer.style.display = provider === "llama" ? "block" : "none";
    }
    
    validateStep2();
  });

  document.getElementById("targetLanguage")?.addEventListener("change", (e) => {
    formData.conversionOptions.targetLanguage = (
      e.target as HTMLSelectElement
    ).value;
  });

  document.getElementById("apiKey")?.addEventListener("input", (e) => {
    formData.conversionOptions.apiKey = (e.target as HTMLInputElement).value;
    validateStep2();
  });

  document.getElementById("apiUrl")?.addEventListener("input", (e) => {
    formData.conversionOptions.apiUrl = (e.target as HTMLInputElement).value;
    validateStep2();
  });

  // Botão de iniciar minificação
  document
    .getElementById("startMinification")
    ?.addEventListener("click", startMinification);

  // Botão de iniciar processamento
  document
    .getElementById("startProcessing")
    ?.addEventListener("click", startProcessing);

  // Botão para abrir pasta de saída
  document.getElementById("openOutputFolder")?.addEventListener("click", () => {
    if (formData.outputFolder) {
      // Em um app real, aqui seria usado o electron.shell.openPath
      logMessage(`Abrindo pasta: ${formData.outputFolder}`);
    }
  });

  // Função para validar a Etapa 1
  function validateStep1() {
    const nextButton = document.getElementById(
      "nextStep1"
    ) as HTMLButtonElement;
    nextButton.disabled = !formData.sourceFolder;
  }

  // Função para validar a Etapa 2
  function validateStep2() {
    const nextButton = document.getElementById(
      "nextStep2"
    ) as HTMLButtonElement;
    
    const needsApiKey = ["openai", "gemini", "anthropic", "llama"].includes(
      formData.conversionOptions.provider
    );
    
    const needsApiUrl = formData.conversionOptions.provider === "llama";
    
    const isValid = Boolean(
      formData.tempFolder &&
        formData.outputFolder &&
        (!needsApiKey || formData.conversionOptions.apiKey) &&
        (!needsApiUrl || formData.conversionOptions.apiUrl)
    );
    
    nextButton.disabled = !isValid;
  }

  // Função para navegar entre as etapas
  function navigateToStep(step: number) {
    if (step < 1 || step > totalSteps) return;

    // Ocultar todas as etapas
    for (let i = 1; i <= totalSteps; i++) {
      stepContents[i]?.classList.add("hidden");

      // Atualizar indicadores
      const indicator = stepIndicators[i];
      if (indicator) {
        indicator.classList.remove(
          "step-active",
          "step-completed",
          "step-pending"
        );

        if (i < step) {
          indicator.classList.add("step-completed");
        } else if (i === step) {
          indicator.classList.add("step-active");
        } else {
          indicator.classList.add("step-pending");
        }
      }

      // Atualizar linhas de conexão
      if (i < totalSteps && lineIndicators[i]) {
        if (i < step) {
          lineIndicators[i]?.classList.remove("bg-gray-300");
          lineIndicators[i]?.classList.add("bg-green-500");
        } else {
          lineIndicators[i]?.classList.remove("bg-green-500");
          lineIndicators[i]?.classList.add("bg-gray-300");
        }
      }
    }

    // Exibir etapa atual
    stepContents[step]?.classList.remove("hidden");
    currentStep = step;
    
    // Ações específicas para cada etapa
    if (step === 3) {
      // Atualizar informações na tela de minificação
      const minifySourceElement = document.getElementById("minifySource");
      const minifyTempElement = document.getElementById("minifyTemp");
      const minifyOptionsElement = document.getElementById("minifyOptions");

      if (minifySourceElement && minifyTempElement && minifyOptionsElement) {
        minifySourceElement.textContent = formData.sourceFolder;
        minifyTempElement.textContent = formData.tempFolder;
        
        const options = [];
        if (formData.simplificationOptions.removeComments)
          options.push("Remover comentários");
        if (formData.simplificationOptions.reduceKeywords)
          options.push("Reduzir palavras-chave");
        if (formData.simplificationOptions.minify)
          options.push("Minificar código");
        
        minifyOptionsElement.textContent = options.join(", ") || "Nenhuma";
      }

      // Se já temos resultados, mostrar o resumo
      if (minificationResults && minificationResults.success) {
        updateMinificationSummary();
      }
    } else if (step === 4) {
      updateConversionSummary();
    }
  }

  // Função para atualizar o resumo na etapa 4 (conversão)
  function updateConversionSummary() {
    if (document.getElementById("summarySource")) {
      document.getElementById("summarySource")!.textContent =
        formData.sourceFolder;
      document.getElementById("summaryTemp")!.textContent = formData.tempFolder;
      document.getElementById("summaryOutput")!.textContent =
        formData.outputFolder;
      document.getElementById("summaryProvider")!.textContent = getProviderName(
        formData.conversionOptions.provider
      );
      document.getElementById("summaryLanguage")!.textContent =
        formData.conversionOptions.targetLanguage;

      const options = [];
      if (formData.simplificationOptions.removeComments)
        options.push("Remover comentários");
      if (formData.simplificationOptions.reduceKeywords)
        options.push("Reduzir palavras-chave");
      if (formData.simplificationOptions.minify)
        options.push("Minificar código");      
        
      document.getElementById("summaryOptions")!.textContent =
        options.join(", ") || "Nenhuma";
    }
  }

  function getProviderName(provider: string): string {
    switch (provider) {
      case "openai":
        return "OpenAI (GPT)";
      case "gemini":
        return "Google Gemini";
      case "anthropic":
        return "Anthropic Claude";
      case "llama":
        return "Llama API";
      default:
        return provider;
    }
  }

  // Função para iniciar a minificação
  async function startMinification() {
    const startButton = document.getElementById(
      "startMinification"
    ) as HTMLButtonElement;
    const nextButton = document.getElementById(
      "nextStep3"
    ) as HTMLButtonElement;

    startButton.disabled = true;
    startButton.textContent = "Minificando...";
    resetMinificationProgress();

    try {
      logMinificationMessage("🚀 Iniciando minificação dos arquivos...");

      // Simulação inicial para feedback visual
      await simulateMinificationProgress(10);
      
      // Chamar o processo real de minificação
      const result: any = await window.api.minifyFiles(formData);
      
      if (!result || !result.success) {
        throw new Error(result?.error || "Erro desconhecido na minificação");
      }
      
      // Simulação final para feedback visual
      for (let i = 50; i <= 100; i += 10) {
        await simulateMinificationProgress(i);
      }
      
      minificationResults = result;
      logMinificationMessage(`✅ Minificação concluída com sucesso! ${result.result.minifiedFiles.length} arquivos processados.`);
      
      // Atualizar informações na UI
      updateMinificationSummary();
      nextButton.disabled = false;
    } catch (error) {
      logMinificationMessage(`❌ Erro durante a minificação: ${error}`);
    } finally {
      startButton.disabled = false;
      startButton.textContent = "Iniciar Minificação";
    }
  }

  // Função para iniciar o processamento
  async function startProcessing() {
    const startButton = document.getElementById(
      "startProcessing"
    ) as HTMLButtonElement;
    const nextButton = document.getElementById(
      "nextStep4"
    ) as HTMLButtonElement;

    startButton.disabled = true;
    startButton.textContent = "Processando...";
    resetProgress();

    processingStartTime = Date.now();

    try {
      logMessage("🚀 Iniciando processamento do código...");

      const result: any = await window.api.processCode(formData);
      if (!result || !result.success) {
        throw new Error(result?.error || "Erro desconhecido no processamento");
      }
      processingResults = result;
      nextButton.disabled = false;
      logMessage("✅ Processamento concluído com sucesso!");
    } catch (error) {
      logMessage(`❌ Erro durante o processamento: ${error}`);
    } finally {
      startButton.disabled = false;
      startButton.textContent = "Iniciar Processamento";
      updateProcessingResults();
    }
  }

  function getFileExtension(): string {
    const langExtMap: Record<string, string> = {
      javascript: "js",
      typescript: "ts",
      python: "py",
      java: "java",
      csharp: "cs",
      cpp: "cpp",
      ruby: "rb",
      go: "go",
      rust: "rs",
      php: "php",
    };

    return (
      langExtMap[formData.conversionOptions.targetLanguage.toLowerCase()] ||
      "txt"
    );
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
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");

    if (progressBar && progressText) {
      progressBar.style.width = `${percent}%`;
      progressText.textContent = `${percent}% concluído`;
    }
  }

  // Função para resetar o progresso
  function resetProgress() {
    updateProgress(0);
    const logElement = document.getElementById("processLog");
    if (logElement) {
      logElement.innerHTML = "";
    }
  }

  // Função para resetar o progresso da minificação
  function resetMinificationProgress() {
    updateMinificationProgress(0);
    const logElement = document.getElementById("minifyLog");
    if (logElement) {
      logElement.innerHTML = "";
    }
  }

  // Função para atualizar a barra de progresso da minificação
  function updateMinificationProgress(percent: number) {
    const progressBar = document.getElementById("minifyProgressBar");
    const progressText = document.getElementById("minifyProgressText");

    if (progressBar && progressText) {
      progressBar.style.width = `${percent}%`;
      progressText.textContent = `${percent}% concluído`;
    }
  }

  // Função para simular o progresso da minificação
  function simulateMinificationProgress(percent: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        updateMinificationProgress(percent);
        if (percent % 30 === 0) {
          logMinificationMessage(`${percent}% - Minificando arquivos...`);
        }
        resolve();
      }, 200);
    });
  }

  // Função para adicionar mensagem ao log da minificação
  function logMinificationMessage(message: string) {
    const logElement = document.getElementById("minifyLog");
    if (logElement) {
      const timestamp = new Date().toLocaleTimeString();
      const logLine = document.createElement("div");
      logLine.innerHTML = `<span class="text-gray-500">[${timestamp}]</span> ${message}`;
      logElement.appendChild(logLine);
      logElement.scrollTop = logElement.scrollHeight;
    }
  }

  // Função para atualizar o resumo da minificação
  function updateMinificationSummary() {
    // Atualiza informações básicas sobre a minificação
    const minifySourceElement = document.getElementById("minifySource");
    const minifyTempElement = document.getElementById("minifyTemp");
    const minifyOptionsElement = document.getElementById("minifyOptions");

    if (minifySourceElement && minifyTempElement && minifyOptionsElement) {
      minifySourceElement.textContent = formData.sourceFolder;
      minifyTempElement.textContent = formData.tempFolder;
      
      const options = [];
      if (formData.simplificationOptions.removeComments)
        options.push("Remover comentários");
      if (formData.simplificationOptions.reduceKeywords)
        options.push("Reduzir palavras-chave");
      if (formData.simplificationOptions.minify)
        options.push("Minificar código");
      
      minifyOptionsElement.textContent = options.join(", ") || "Nenhuma";
    }
    
    // Se já temos resultados, mostra o resumo completo
    if (minificationResults && minificationResults.success) {
      const totalFiles = minificationResults.result.minifiedFiles?.length || 0;
      const totalSizeReduction = minificationResults.result.sizeReduction || 0;
      
      const fileCountElement = document.getElementById("fileCount");
      if (fileCountElement) {
        fileCountElement.textContent = `${totalFiles} arquivos`;
      }
      
      const summaryElement = document.getElementById("minificationSummary");
      if (summaryElement) {
        summaryElement.innerHTML = `
          <div class="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-green-800">Minificação Concluída</h3>
                <div class="mt-2 text-sm text-green-700">
                  <p>📁 Arquivos processados: <strong>${totalFiles}</strong></p>
                  <p>📉 Redução de tamanho: <strong>${totalSizeReduction}%</strong></p>
                  <p>📂 Arquivos salvos em: <strong>${formData.tempFolder}</strong></p>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    }
  }

  // Função para adicionar mensagem ao log
  function logMessage(message: string) {
    const logElement = document.getElementById("processLog");
    if (logElement) {
      const timestamp = new Date().toLocaleTimeString();
      const logLine = document.createElement("div");
      logLine.innerHTML = `<span class="text-gray-500">[${timestamp}]</span> ${message}`;
      logElement.appendChild(logLine);
      logElement.scrollTop = logElement.scrollHeight;
    }
  }

  // Função para atualizar os resultados na etapa 4
  function updateProcessingResults() {
    if (!processingResults || !processingResults.success) return;

    const processingTime = Math.round(
      (Date.now() - processingStartTime) / 1000
    );
    const filesCount = processingResults.result.convertedFiles.length;

    if (document.getElementById("filesCount")) {
      document.getElementById("filesCount")!.textContent =
        filesCount.toString();
      document.getElementById(
        "processingTime"
      )!.textContent = `${processingTime}s`;
      document.getElementById("filesSize")!.textContent = `${
        filesCount * 25
      } KB`; // Valor fictício
    }

    // Preencher tabela de arquivos
    const filesList = document.getElementById("filesList");
    if (filesList) {
      filesList.innerHTML = "";

      for (let i = 0; i < processingResults.result.convertedFiles.length; i++) {
        const original = processingResults.result.processedFiles[i].original;
        const simplified =
          processingResults.result.processedFiles[i].simplified;
        const converted = processingResults.result.convertedFiles[i].converted;

        const row = document.createElement("tr");
        row.innerHTML = `
          <td class="py-2 px-4 border-b border-gray-200">${getShortPath(
            original
          )}</td>
          <td class="py-2 px-4 border-b border-gray-200">${getShortPath(
            simplified
          )}</td>
          <td class="py-2 px-4 border-b border-gray-200">${getShortPath(
            converted
          )}</td>
        `;

        filesList.appendChild(row);
      }
    }
  }

  // Função para encurtar caminhos longos
  function getShortPath(path: string): string {
    if (path.length > 40) {
      const parts = path.split("/");
      const filename = parts.pop() || "";

      if (parts.length > 2) {
        return `.../${parts[parts.length - 1]}/${filename}`;
      }
    }
    return path;
  }

  // Função para resetar o aplicativo
  function resetApplication() {
    formData.sourceFolder = "";
    formData.tempFolder = "";
    formData.outputFolder = "";
    formData.simplificationOptions.removeComments = true;
    formData.simplificationOptions.reduceKeywords = false;
    formData.simplificationOptions.minify = false;
    formData.conversionOptions.targetLanguage = "javascript";
    formData.conversionOptions.provider = "openai";
    formData.conversionOptions.apiKey = "";
    formData.conversionOptions.apiUrl = "";

    (document.getElementById("sourceFolder") as HTMLInputElement).value = "";
    (document.getElementById("tempFolder") as HTMLInputElement).value = "";
    (document.getElementById("outputFolder") as HTMLInputElement).value = "";
    (document.getElementById("removeComments") as HTMLInputElement).checked =
      true;
    (document.getElementById("reduceKeywords") as HTMLInputElement).checked =
      false;
    (document.getElementById("minify") as HTMLInputElement).checked = false;
    (document.getElementById("provider") as HTMLSelectElement).value = "openai";
    (document.getElementById("targetLanguage") as HTMLSelectElement).value =
      "javascript";
    (document.getElementById("apiKey") as HTMLInputElement).value = "";
    (document.getElementById("apiUrl") as HTMLInputElement).value = "";

    processingResults = null;
    minificationResults = null;

    navigateToStep(1);
  }

  // Inicialização da interface
  validateStep1();
  validateStep2();

  window.electronAPI.logMessage("Iniciando a etapa 3: Conversão de arquivos...");

  // Adiciona um listener para exibir o progresso da migração
  window.electronAPI.onMigrationProgress((message: string) => {
    const progressElement = document.getElementById("migration-progress");
    if (progressElement) {
      progressElement.textContent = message;
    }
  });
});
