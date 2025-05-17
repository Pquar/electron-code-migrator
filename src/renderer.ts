// Adicione no início do renderer.ts
console.log("Renderer script loaded");
const folder = window.api.selectFolder();
// Adicione nos event listenconst folder = await window.api.selectFolder();ers
document
  .getElementById("selectSourceFolder")
  ?.addEventListener("click", async () => {
    console.log("Select source folder clicked");
    const folder = await window.api.selectFolder();
    console.log("Selected folder:", folder);
    // ... resto do código
  });

document.addEventListener("DOMContentLoaded", () => {
  let currentStep = 1;
  const totalSteps = 4;

  let processingStartTime = 0;
  let processingResults: any = null;

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
    },
  };

  // Selecionadores de elementos
  const stepIndicators: Record<number, HTMLElement | null> = {
    1: document.getElementById("step1-indicator"),
    2: document.getElementById("step2-indicator"),
    3: document.getElementById("step3-indicator"),
    4: document.getElementById("step4-indicator"),
  };

  const stepContents: Record<number, HTMLElement | null> = {
    1: document.getElementById("step1"),
    2: document.getElementById("step2"),
    3: document.getElementById("step3"),
    4: document.getElementById("step4"),
  };

  const lineIndicators: Record<number, HTMLElement | null> = {
    1: document.getElementById("line1"),
    2: document.getElementById("line2"),
    3: document.getElementById("line3"),
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
    .getElementById("startNew")
    ?.addEventListener("click", resetApplication);

  // Botões de seleção de pastas
  document
    .getElementById("selectSourceFolder")
    ?.addEventListener("click", async () => {
      const folder = await window.api.selectFolder();
      if (folder) {
        formData.sourceFolder = folder;
        (document.getElementById("sourceFolder") as HTMLInputElement).value =
          folder;
        validateStep1();
      }
    });

  document
    .getElementById("selectTempFolder")
    ?.addEventListener("click", async () => {
      const folder = await window.api.selectFolder();
      if (folder) {
        formData.tempFolder = folder;
        (document.getElementById("tempFolder") as HTMLInputElement).value =
          folder;
        validateStep2();
      }
    });

  document
    .getElementById("selectOutputFolder")
    ?.addEventListener("click", async () => {
      const folder = await window.api.selectFolder();
      if (folder) {
        formData.outputFolder = folder;
        (document.getElementById("outputFolder") as HTMLInputElement).value =
          folder;
        validateStep2();
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
    formData.conversionOptions.provider = (e.target as HTMLSelectElement)
      .value as any;
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
      updateSummary();
    }
  }

  // Função para atualizar o resumo na etapa 3
  function updateSummary() {
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
      default:
        return provider;
    }
  }

  // Função para iniciar o processamento
  async function startProcessing() {
    const startButton = document.getElementById(
      "startProcessing"
    ) as HTMLButtonElement;
    const nextButton = document.getElementById(
      "nextStep3"
    ) as HTMLButtonElement;

    startButton.disabled = true;
    startButton.textContent = "Processando...";
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
            {
              original: `${formData.sourceFolder}/app.js`,
              simplified: `${formData.tempFolder}/app.js`,
            },
            {
              original: `${formData.sourceFolder}/utils.js`,
              simplified: `${formData.tempFolder}/utils.js`,
            },
            {
              original: `${formData.sourceFolder}/lib/helper.js`,
              simplified: `${formData.tempFolder}/lib/helper.js`,
            },
          ],
          convertedFiles: [
            {
              simplified: `${formData.tempFolder}/app.js`,
              converted: `${formData.outputFolder}/app.${getFileExtension()}`,
            },
            {
              simplified: `${formData.tempFolder}/utils.js`,
              converted: `${formData.outputFolder}/utils.${getFileExtension()}`,
            },
            {
              simplified: `${formData.tempFolder}/lib/helper.js`,
              converted: `${
                formData.outputFolder
              }/lib/helper.${getFileExtension()}`,
            },
          ],
        },
      };

      // Atualizar UI com resultados
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

    processingResults = null;

    navigateToStep(1);
  }

  // Inicialização da interface
  validateStep1();
  validateStep2();
});
