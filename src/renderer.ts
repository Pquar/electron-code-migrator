console.log("Renderer script loaded");
// Removed the import and using a global function that will be defined in event-handlers.js

// Initializing global properties
window.processingTotalFiles = 0;
window.processingCompletedFiles = 0;
window.processingStartTimeEstimation = 0;
window.processingTokensTotal = { sent: 0, received: 0 };

const defaultPrompt = `# Code Conversion Instructions

- Source language: {sourceLanguage}
- Target language: {targetLanguage}

## Original code:
\`\`\`{sourceLanguage}
{code}
\`\`\`

## Guidelines:
1. Convert the code above to {targetLanguage}
2. Keep the same functionality and logic
3. Adapt to the standards and best practices of {targetLanguage}
4. Keep variable and function names consistent unless they violate {targetLanguage} conventions
5. Include important comments only where necessary to explain the conversion
6. Do not include explanatory text before or after the code

Return only the converted code in {targetLanguage}, with no additional explanations.`;

document.addEventListener("DOMContentLoaded", () => {
  let currentStep = 1;
  const totalSteps = 5;

  let processingStartTime = 0;
  let processingResults: any = null;
  let minificationResults: any = null;

  // Form data
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
      customPrompt: defaultPrompt,
    },
  };
  // Element selectors
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
  // Navigation buttons
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

  // Folder selection buttons
  document
    .getElementById("selectSourceFolder")
    ?.addEventListener("click", async () => {
      try {
        console.log("Selecting source folder...");
        const folder = await window.api.selectFolder();
        console.log("Selected folder:", folder);
        if (folder) {
          formData.sourceFolder = folder;
          (document.getElementById("sourceFolder") as HTMLInputElement).value =
            folder;
          validateStep1();
        } else {
          console.log("No folder selected or dialog canceled");
        }
      } catch (error) {
        console.error("Error selecting folder:", error);
      }
    });

  document
    .getElementById("selectTempFolder")
    ?.addEventListener("click", async () => {
      try {
        console.log("Selecting temp folder...");
        const folder = await window.api.selectFolder();
        console.log("Selected temp folder:", folder);
        if (folder) {
          formData.tempFolder = folder;
          (document.getElementById("tempFolder") as HTMLInputElement).value =
            folder;
          validateStep2();
        } else {
          console.log("No temp folder selected or dialog canceled");
        }
      } catch (error) {
        console.error("Error selecting temp folder:", error);
      }
    });

  document
    .getElementById("selectOutputFolder")
    ?.addEventListener("click", async () => {
      try {
        console.log("Selecting output folder...");
        const folder = await window.api.selectFolder();
        console.log("Selected output folder:", folder);
        if (folder) {
          formData.outputFolder = folder;
          (document.getElementById("outputFolder") as HTMLInputElement).value =
            folder;
          validateStep2();
        } else {
          console.log("No output folder selected or dialog canceled");
        }
      } catch (error) {
        console.error("Error selecting output folder:", error);
      }
    });

  // Checkbox event listeners
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

  // Select and input event listeners
  document.getElementById("provider")?.addEventListener("change", (e) => {
    const provider = (e.target as HTMLSelectElement).value;
    formData.conversionOptions.provider = provider as any;
    
    // Show/hide API URL field for Llama
    const apiUrlContainer = document.getElementById("apiUrlContainer");
    const customPromptContainer = document.getElementById("customPromptContainer");
    if (apiUrlContainer) {
      apiUrlContainer.style.display = provider === "llama" ? "block" : "none";
    }
    if (customPromptContainer) {
      customPromptContainer.style.display = "block";
    }
    
    validateStep2();
  });

  document.getElementById("targetLanguage")?.addEventListener("change", (e) => {
    const value = (e.target as HTMLSelectElement).value;
    formData.conversionOptions.targetLanguage = value;
    
    // Show custom prompt field
    const customPromptContainer = document.getElementById("customPromptContainer");
    if (customPromptContainer) {
      customPromptContainer.style.display = "block";
    }
    showCustomPrompt();
  });

  document.getElementById("customLanguage")?.addEventListener("input", (e) => {
    const value = (e.target as HTMLInputElement).value;
    if (value) {
      const targetLanguageSelect = document.getElementById("targetLanguage") as HTMLSelectElement;
      if (targetLanguageSelect) {
        targetLanguageSelect.value = "";
      }
      formData.conversionOptions.targetLanguage = value.toLowerCase();
    }
    
    // Show custom prompt field
    const customPromptContainer = document.getElementById("customPromptContainer");
    if (customPromptContainer) {
      customPromptContainer.style.display = "block";
    }
    showCustomPrompt();
  });

  // Function to show and update the custom prompt
  function showCustomPrompt() {
    const promptTextarea = document.getElementById("conversionPrompt") as HTMLTextAreaElement;
    if (!promptTextarea) return;

    // Update the prompt with the selected language
    let updatedPrompt = defaultPrompt
      .replace(/\{sourceLanguage\}/g, "auto detect")
      .replace(/\{targetLanguage\}/g, formData.conversionOptions.targetLanguage);

    promptTextarea.value = updatedPrompt;
    formData.conversionOptions.customPrompt = updatedPrompt;
  }

  // Event listener for the custom prompt
  document.getElementById("conversionPrompt")?.addEventListener("input", (e) => {
    formData.conversionOptions.customPrompt = (e.target as HTMLTextAreaElement).value;
  });

  // Event listener to reset the prompt
  document.getElementById("resetPrompt")?.addEventListener("click", () => {
    const promptTextarea = document.getElementById("conversionPrompt") as HTMLTextAreaElement;
    if (promptTextarea) {
      showCustomPrompt();
    }
  });

  document.getElementById("apiKey")?.addEventListener("input", (e) => {
    formData.conversionOptions.apiKey = (e.target as HTMLInputElement).value;
    validateStep2();
  });

  document.getElementById("apiUrl")?.addEventListener("input", (e) => {
    formData.conversionOptions.apiUrl = (e.target as HTMLInputElement).value;
    validateStep2();
  });

  // Button to start minification
  document
    .getElementById("startMinification")
    ?.addEventListener("click", startMinification);

  // Button to start processing
  document
    .getElementById("startProcessing")
    ?.addEventListener("click", startProcessing);

  // Button to open output folder
  document.getElementById("openOutputFolder")?.addEventListener("click", () => {
    if (formData.outputFolder) {
      // In a real app, electron.shell.openPath would be used here
      logMessage(`Opening folder: ${formData.outputFolder}`);
    }
  });

  // Function to validate Step 1
  function validateStep1() {
    const nextButton = document.getElementById(
      "nextStep1"
    ) as HTMLButtonElement;
    nextButton.disabled = !formData.sourceFolder;
  }

  // Function to validate Step 2
  function validateStep2() {
    const nextButton = document.getElementById(
      "nextStep2"
    ) as HTMLButtonElement;
    
    const needsApiKey = ["openai", "gemini", "anthropic", "llama"].includes(
      formData.conversionOptions.provider
    );
    
    const needsApiUrl = formData.conversionOptions.provider === "llama";
    
    const hasTargetLanguage = Boolean(formData.conversionOptions.targetLanguage);
    
    const isValid = Boolean(
      formData.tempFolder &&
        formData.outputFolder &&
        hasTargetLanguage &&
        (!needsApiKey || formData.conversionOptions.apiKey) &&
        (!needsApiUrl || formData.conversionOptions.apiUrl)
    );
    
    nextButton.disabled = !isValid;

    // Show the custom prompt if a language is selected
    const customPromptContainer = document.getElementById("customPromptContainer");
    if (customPromptContainer) {
      customPromptContainer.style.display = hasTargetLanguage ? "block" : "none";
    }
    
    // If a language is selected, update the prompt
    if (hasTargetLanguage) {
      showCustomPrompt();
    }
  }

  // Function to navigate between steps
  function navigateToStep(step: number) {
    if (step < 1 || step > totalSteps) return;

    // Hide all steps
    for (let i = 1; i <= totalSteps; i++) {
      stepContents[i]?.classList.add("hidden");

      // Update indicators
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

      // Update connection lines
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

    stepContents[step]?.classList.remove("hidden");
    currentStep = step;
    
    // Specific actions for each step
    if (step === 3) {
      // Update information on the minification screen
      const minifySourceElement = document.getElementById("minifySource");
      const minifyTempElement = document.getElementById("minifyTemp");
      const minifyOptionsElement = document.getElementById("minifyOptions");

      if (minifySourceElement && minifyTempElement && minifyOptionsElement) {
        minifySourceElement.textContent = formData.sourceFolder;
        minifyTempElement.textContent = formData.tempFolder;
        
        const options = [];
        if (formData.simplificationOptions.removeComments)
          options.push("Remove comments");
        if (formData.simplificationOptions.reduceKeywords)
          options.push("Reduce keywords");
        if (formData.simplificationOptions.minify)
          options.push("Minify code");
        
        minifyOptionsElement.textContent = options.join(", ") || "None";
      }

      // If we already have results, show the summary
      if (minificationResults && minificationResults.success) {
        updateMinificationSummary();
      }
    } else if (step === 4) {
      updateConversionSummary();
    }
  }

  // Function to update the summary in step 4 (conversion)
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
        options.push("Remove comments");
      if (formData.simplificationOptions.reduceKeywords)
        options.push("Reduce keywords");
      if (formData.simplificationOptions.minify)
        options.push("Minify code");      
        
      document.getElementById("summaryOptions")!.textContent =
        options.join(", ") || "None";
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
  // Variables to calculate estimated times
  let processingTotalFiles = 0;
  let processingCompletedFiles = 0;
  let processingStartTimeEstimation = 0;
  let processingTokensTotal: { sent: number; received: number } = { sent: 0, received: 0 };
  
  // Function to calculate and show estimated completion time
  function updateTimeEstimation(completedFiles: number, totalFiles: number) {
    if (completedFiles === 0 || totalFiles === 0) return "Calculating...";
    
    const elapsedTime = Date.now() - processingStartTimeEstimation;
    const progressRatio = completedFiles / totalFiles;
    const estimatedTotalTime = elapsedTime / progressRatio;
    const remainingTime = estimatedTotalTime - elapsedTime;
    
    // Convert milliseconds to readable format
    return formatTime(remainingTime);
  }
  
  // Function to format time in milliseconds to readable format
  function formatTime(ms: number): string {
    if (ms < 0) return "Finishing...";
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m remaining`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s remaining`;
    } else {
      return `${seconds}s remaining`;
    }
  }

  // Helper function to format size in bytes
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Function to start minification
  async function startMinification() {
    const startButton = document.getElementById(
      "startMinification"
    ) as HTMLButtonElement;
    const nextButton = document.getElementById(
      "nextStep3"
    ) as HTMLButtonElement;

    startButton.disabled = true;
    startButton.textContent = "Minifying...";
    resetMinificationProgress();

    try {
      logMinificationMessage("🚀 Starting minification of files...");

      // Initial simulation for visual feedback
      await simulateMinificationProgress(10);
      
      // Call the real minification process
      const result: any = await window.api.minifyFiles(formData);
      
      if (!result || !result.success) {
        throw new Error(result?.error || "Unknown error during minification");
      }
      
      // Final simulation for visual feedback
      for (let i = 50; i <= 100; i += 10) {
        await simulateMinificationProgress(i);
      }
      
      minificationResults = result;
      logMinificationMessage(`✅ Minification completed successfully! ${result.result.minifiedFiles.length} files processed.`);
      
      // Update information in the UI
      updateMinificationSummary();
      nextButton.disabled = false;
    } catch (error) {
      logMinificationMessage(`❌ Error during minification: ${error}`);
    } finally {
      startButton.disabled = false;
      startButton.textContent = "Start Minification";
    }
  }

  // Function to start processing
  async function startProcessing() {
    const startButton = document.getElementById(
      "startProcessing"
    ) as HTMLButtonElement;
    const nextButton = document.getElementById(
      "nextStep4"
    ) as HTMLButtonElement;

    startButton.disabled = true;
    startButton.textContent = "Processing...";
    resetProgress();

    processingStartTime = Date.now();
    processingStartTimeEstimation = Date.now(); // Start estimated time calculation

    try {
      logMessage("🚀 Starting code processing...");

      const result: any = await window.api.processCode(formData);
      if (!result || !result.success) {
        throw new Error(result?.error || "Unknown error in processing");
      }
      processingResults = result;
      nextButton.disabled = false;
      logMessage("✅ Processing completed successfully!");
    } catch (error) {
      logMessage(`❌ Error during processing: ${error}`);
    } finally {
      startButton.disabled = false;
      startButton.textContent = "Start Processing";
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

  // Function to simulate progress
  function simulateProgress(percent: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        updateProgress(percent);
        if (percent % 30 === 0) {
          logMessage(`${percent}% - Processing files...`);
        }
        resolve();
      }, 300);
    });
  }

  // Function to update the progress bar
  function updateProgress(percent: number, timeEstimation?: string) {
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");
    const timeEstimationElement = document.getElementById("timeEstimation");

    if (progressBar && progressText) {
      progressBar.style.width = `${percent}%`;
      progressText.textContent = `${percent}% completed`;
      
      // Update the remaining time estimation if provided
      if (timeEstimationElement && timeEstimation) {
        timeEstimationElement.textContent = timeEstimation;
      }
      // Otherwise, calculate estimation based on progress variables
      else if (timeEstimationElement && processingTotalFiles > 0) {
        const estimation = updateTimeEstimation(processingCompletedFiles, processingTotalFiles);
        timeEstimationElement.textContent = estimation;
      }
    }
  }

  // Function to reset progress
  function resetProgress() {
    updateProgress(0);
    const logElement = document.getElementById("processLog");
    if (logElement) {
      logElement.innerHTML = "";
    }
    
    // Restart time estimation variables
    processingTotalFiles = 0;
    processingCompletedFiles = 0;
    processingStartTimeEstimation = Date.now();
    processingTokensTotal = { sent: 0, received: 0 };
    
    // Reset time estimation element
    const timeEstimationElement = document.getElementById("timeEstimation");
    if (timeEstimationElement) {
      timeEstimationElement.textContent = "Calculating...";
    }
    
    // Reset metrics elements
    const sentTokensElement = document.getElementById("sentTokens");
    const receivedTokensElement = document.getElementById("receivedTokens");
    const processedFilesElement = document.getElementById("conversionProcessedFiles");
    
    if (sentTokensElement) sentTokensElement.textContent = "-";
    if (receivedTokensElement) receivedTokensElement.textContent = "-";
    if (processedFilesElement) processedFilesElement.textContent = "-";
  }

  // Function to reset minification progress
  function resetMinificationProgress() {
    updateMinificationProgress(0);
    const logElement = document.getElementById("minifyLog");
    if (logElement) {
      logElement.innerHTML = "";
    }
  }

  // Function to update the minification progress bar
  function updateMinificationProgress(percent: number, timeEstimation?: string) {
    const progressBar = document.getElementById("minifyProgressBar");
    const progressText = document.getElementById("minifyProgressText");
    const timeEstimationElement = document.getElementById("minifyTimeEstimation");

    if (progressBar && progressText) {
      progressBar.style.width = `${percent}%`;
      progressText.textContent = `${percent}% completed`;
      
      if (timeEstimationElement && timeEstimation) {
        timeEstimationElement.textContent = timeEstimation;
      }
    }
  }

  // Function to simulate minification progress
  function simulateMinificationProgress(percent: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Calculate estimated time based on progress
        const timeEstimation = percent < 100 ? 
          `${Math.round((100 - percent) / 10)}s remaining (estimate)` : "Completed!";
        
        updateMinificationProgress(percent, timeEstimation);
        
        if (percent % 30 === 0) {
          logMinificationMessage(`${percent}% - Minifying files...`);
        }
        resolve();
      }, 200);
    });
  }

  // Function to add message to minification log
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

  // Function to update minification summary
  function updateMinificationSummary() {
    // Update basic information about minification
    const minifySourceElement = document.getElementById("minifySource");
    const minifyTempElement = document.getElementById("minifyTemp");
    const minifyOptionsElement = document.getElementById("minifyOptions");

    if (minifySourceElement && minifyTempElement && minifyOptionsElement) {
      minifySourceElement.textContent = formData.sourceFolder;
      minifyTempElement.textContent = formData.tempFolder;
      
      const options = [];
      if (formData.simplificationOptions.removeComments)
        options.push("Remove comments");
      if (formData.simplificationOptions.reduceKeywords)
        options.push("Reduce keywords");
      if (formData.simplificationOptions.minify)
        options.push("Minify code");
      
      minifyOptionsElement.textContent = options.join(", ") || "None";
    }
    
    // If we already have results, show the complete summary
    if (minificationResults && minificationResults.success) {
      const totalFiles = minificationResults.result.minifiedFiles?.length || 0;
      const totalSizeReduction = minificationResults.result.sizeReduction || 0;
      
      const fileCountElement = document.getElementById("fileCount");
      if (fileCountElement) {
        fileCountElement.textContent = `${totalFiles} files`;
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
                <h3 class="text-sm font-medium text-green-800">Minification Completed</h3>
                <div class="mt-2 text-sm text-green-700">
                  <p>📁 Files processed: <strong>${totalFiles}</strong></p>
                  <p>📉 Size reduction: <strong>${totalSizeReduction}%</strong></p>
                  <p>📂 Files saved in: <strong>${formData.tempFolder}</strong></p>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    }
  }

  // Function to add message to log
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

  // Function to update results in step 4
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
      } KB`; // Fictitious value
    }

    // Fill file table
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

  // Function to shorten long paths
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

  // Function to reset the application
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
  // Interface initialization
  validateStep1();  validateStep2();

  // Set up listeners for progress and metrics events using the global function
  if (typeof window.setupEventHandlers === 'function') {
    window.setupEventHandlers();
  } else {
    console.error('setupEventHandlers is not available. Check if event-handlers.js was loaded correctly.');
  }

  window.electronAPI.logMessage("Starting step 3: File Conversion...");

  // Add a listener to show migration progress
  window.electronAPI.onMigrationProgress((message: string) => {
    const progressElement = document.getElementById("migration-progress");
    if (progressElement) {
      progressElement.textContent = message;
    }
  });

  // AI agent functions
  document.getElementById("btnAnalyzeWithIA")?.addEventListener("click", analyzeCodeWithIA);
  document.getElementById("btnApplySuggestions")?.addEventListener("click", applyIASuggestions);
  document.getElementById("btnCancelSuggestions")?.addEventListener("click", cancelIASuggestions);
  
  let iaSuggestions: any[] = [];
  
  // Event listeners for AI provider
  document.getElementById("iaProvider")?.addEventListener("change", (e) => {
    const provider = (e.target as HTMLSelectElement).value;
    const apiKeyContainer = document.getElementById("iaApiKeyContainer");
    const apiUrlContainer = document.getElementById("iaApiUrlContainer");
    
    if (apiKeyContainer && apiUrlContainer) {
      const needsApiKey = ["openai", "gemini", "anthropic", "llama"].includes(provider);
      const needsApiUrl = provider === "llama";
      
      apiKeyContainer.style.display = needsApiKey ? "block" : "none";
      apiUrlContainer.style.display = needsApiUrl ? "block" : "none";
    }
  });

  document.getElementById("iaApiKey")?.addEventListener("input", (e) => {
    formData.conversionOptions.apiKey = (e.target as HTMLInputElement).value;
  });

  document.getElementById("iaApiUrl")?.addEventListener("input", (e) => {
    formData.conversionOptions.apiUrl = (e.target as HTMLInputElement).value;
  });
    async function analyzeCodeWithIA() {
    // Show loading
    document.getElementById("iaLoading")?.classList.remove("hidden");
    document.getElementById("iaSuggestions")?.classList.add("hidden");
    document.getElementById("iaResults")?.classList.add("hidden");
    document.getElementById("btnAnalyzeWithIA")?.setAttribute("disabled", "true");
    
    try {
      if (!processingResults || !processingResults.success) {
        throw new Error("No processing result available");
      }
      
      // Get values from the selected provider
      const provider = (document.getElementById("iaProvider") as HTMLSelectElement).value;
      const apiKey = (document.getElementById("iaApiKey") as HTMLInputElement).value;
      const apiUrl = (document.getElementById("iaApiUrl") as HTMLInputElement).value;

      // Validate required fields
      const needsApiKey = ["openai", "gemini", "anthropic", "llama"].includes(provider);
      const needsApiUrl = provider === "llama";

      if (needsApiKey && !apiKey) {
        throw new Error("API Key is required for the selected provider");
      }
      if (needsApiUrl && !apiUrl) {
        throw new Error("API URL is required for Llama provider");
      }
      
      // Add AI options to formData
      formData.conversionOptions.provider = provider;
      formData.conversionOptions.apiKey = apiKey;
      formData.conversionOptions.apiUrl = apiUrl;
      
      // Get converted files for analysis
      const files = processingResults.result.convertedFiles;
      
      // Call the AI agent API
      const result = await window.iaAgent.analyzeCode(formData, files);
      
      if (result.success && result.suggestions && result.suggestions.length > 0) {
        iaSuggestions = result.suggestions;
        displaySuggestions(iaSuggestions);
      } else {
        throw new Error("No suggestions found by AI");
      }
    } catch (error) {
      logMessage(`❌ Error analyzing code with AI: ${error}`);
      document.getElementById("iaResults")?.classList.remove("hidden");
      const resultsList = document.getElementById("iaResultsList");
      if (resultsList) {
        resultsList.innerHTML = `<div class="p-3 bg-red-50 border border-red-200 rounded text-red-700">Error analyzing code: ${error}</div>`;
      }
    } finally {
      document.getElementById("iaLoading")?.classList.add("hidden");
      document.getElementById("btnAnalyzeWithIA")?.removeAttribute("disabled");
    }
  }
    function displaySuggestions(suggestions: any[]) {
    const suggestionsList = document.getElementById("suggestionsList");
    if (!suggestionsList) return;
    suggestionsList.innerHTML = "";
    suggestions.forEach((suggestion, index) => {
      const item = document.createElement("div");
      item.className = "p-3 bg-blue-50 border border-blue-200 rounded";
      let details = "";
      let badge = "";
      
      switch (suggestion.type) {
        case "move":
          details = `Move <span class="font-semibold">${suggestion.path}</span> to <span class="font-semibold">${suggestion.destination}</span>`;
          break;
        case "rename":
          details = `Rename <span class="font-semibold">${suggestion.path}</span> to <span class="font-semibold">${suggestion.newName}</span>`;
          break;
        case "create":
          details = `Create folder <span class="font-semibold">${suggestion.path}</span>`;
          break;
        case "delete":
          details = `Delete <span class="font-semibold">${suggestion.path}</span>`;
          break;
        case "modify":
          details = `Modify <span class="font-semibold">${suggestion.path}</span>`;
          break;
        case "mcp_create":
          details = `Create file <span class="font-semibold">${suggestion.path}</span> in MCP destination folder`;
          badge = '<span class="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full ml-2">MCP</span>';
          break;
        case "mcp_modify":
          details = `Modify file <span class="font-semibold">${suggestion.path}</span> in MCP destination folder`;
          badge = '<span class="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full ml-2">MCP</span>';
          break;
        case "mcp_delete":
          details = `Delete file <span class="font-semibold">${suggestion.path}</span> from MCP destination folder`;
          badge = '<span class="inline-block px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full ml-2">MCP</span>';
          break;
      }
      item.innerHTML = `
        <div class="flex items-start">
          <div class="flex-shrink-0 mt-0.5">
            <input type="checkbox" id="suggestion-${index}" class="suggestion-checkbox" checked />
          </div>
          <div class="ml-3 flex-1">
            <p class="text-sm font-medium text-blue-800">${suggestion.type.toUpperCase()}: ${details}${badge}</p>
            <p class="text-sm text-gray-600">${suggestion.description}</p>
            ${suggestion.content ? `<div class="mt-2 p-2 bg-gray-100 rounded text-xs font-mono max-h-20 overflow-y-auto">${suggestion.content.substring(0, 200)}${suggestion.content.length > 200 ? '...' : ''}</div>` : ''}
          </div>
        </div>
      `;
      suggestionsList.appendChild(item);
    });
    document.getElementById("iaSuggestions")?.classList.remove("hidden");
  }
  
  async function applyIASuggestions() {
    // Get selected suggestions
    const selectedSuggestions = iaSuggestions.filter((_, index) => {
      const checkbox = document.getElementById(`suggestion-${index}`) as HTMLInputElement;
      return checkbox && checkbox.checked;
    });
    if (selectedSuggestions.length === 0) {
      logMessage("No suggestion selected to apply");
      return;
    }
    // Show loading
    document.getElementById("iaLoading")?.classList.remove("hidden");
    document.getElementById("iaSuggestions")?.classList.add("hidden");
    document.getElementById("btnAnalyzeWithIA")?.setAttribute("disabled", "true");
    try {
      // Execute suggestions
      const result = await window.iaAgent.executeSuggestions(
        selectedSuggestions,
        formData.outputFolder
      );
      if (result.success) {
        displayResults(result.results || []);
      } else {
        throw new Error(result.error || "Error applying suggestions");
      }
    } catch (error) {
      logMessage(`❌ Error applying suggestions: ${error}`);
      const iaResults = document.getElementById("iaResults");
      if (iaResults) {
        iaResults.innerHTML = `<div class="p-3 bg-red-50 border border-red-200 rounded text-red-700">Error applying suggestions: ${error}</div>`;
        iaResults.classList.remove("hidden");
      }
    } finally {
      document.getElementById("iaLoading")?.classList.add("hidden");
      document.getElementById("btnAnalyzeWithIA")?.removeAttribute("disabled");
    }
  }
  
  function displayResults(results: any[]) {
    const resultsList = document.getElementById("iaResultsList");
    if (!resultsList) return;
    resultsList.innerHTML = "";
    results.forEach(result => {
      const item = document.createElement("div");
      item.className = `p-3 mb-2 border rounded ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`;
      const suggestion = result.suggestion;
      let details = "";
      switch (suggestion.type) {
        case "move":
          details = `Move <span class="font-semibold">${suggestion.path}</span> to <span class="font-semibold">${suggestion.destination}</span>`;
          break;
        case "rename":
          details = `Rename <span class="font-semibold">${suggestion.path}</span> to <span class="font-semibold">${suggestion.newName}</span>`;
          break;
        case "create":
          details = `Create folder <span class="font-semibold">${suggestion.path}</span>`;
          break;
        case "delete":
          details = `Delete <span class="font-semibold">${suggestion.path}</span>`;
          break;
        case "modify":
          details = `Modify <span class="font-semibold">${suggestion.path}</span>`;
          break;
      }
      item.innerHTML = `
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="w-5 h-5 ${result.success ? 'text-green-500' : 'text-red-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${result.success ? 'M5 13l4 4L19 7' : 'M6 18L18 6M6 6l12 12'}"></path>
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium ${result.success ? 'text-green-800' : 'text-red-800'}">${suggestion.type.toUpperCase()}: ${details}</p>
            ${result.error ? `<p class="text-sm text-red-600">Error: ${result.error}</p>` : ''}
          </div>
        </div>
      `;
      resultsList.appendChild(item);
    });
    document.getElementById("iaResults")?.classList.remove("hidden");
  }
  
  function cancelIASuggestions() {
    document.getElementById("iaSuggestions")?.classList.add("hidden");
    iaSuggestions = [];
  }

  // Variables to estimate time during minification
  let minifyTotalFiles = 0;
  let minifyProcessedFiles = 0;
  let minifyStartTime = 0;
  
  // Add listeners for minification events
  window.logger.onLogUpdate((data) => {
    if (data.type === 'minify') {
      logMinificationMessage(data.message);
    } else if (data.type === 'process') {
      logMessage(data.message);
    }
  });
  // Listener for minification start
  document.addEventListener('minifyStart', (e: any) => {
    minifyTotalFiles = e.detail.totalFiles || 0;
    minifyProcessedFiles = 0;
    minifyStartTime = Date.now();
    logMinificationMessage(`🚀 Starting minification of ${minifyTotalFiles} files...`);
    updateMinificationProgress(0, "Calculating...");
  });
  // Listener for minification progress update
  document.addEventListener('minifyProgress', (e: any) => {
    minifyProcessedFiles = e.detail.processed || 0;
    const percent = Math.floor((minifyProcessedFiles / minifyTotalFiles) * 100);
    const elapsedTime = Date.now() - minifyStartTime;
    const estimatedTimePerFile = minifyProcessedFiles > 0 ? elapsedTime / minifyProcessedFiles : 0;
    const remainingFiles = minifyTotalFiles - minifyProcessedFiles;
    const timeRemaining = estimatedTimePerFile * remainingFiles;
    const timeEstimation = formatTime(timeRemaining);
    updateMinificationProgress(percent, timeEstimation);
    // Show file details in the log
    if (e.detail.file) {
      let fileInfo = `Minified: ${e.detail.file}`;
      if (e.detail.sizes) {
        fileInfo += ` (${formatBytes(e.detail.sizes.original)} → ${formatBytes(e.detail.sizes.minified)})`;
      }
      logMinificationMessage(fileInfo);
    }
  });
  // Listener for minification completion
  document.addEventListener('minifyComplete', (e: any) => {
    const totalTime = Date.now() - minifyStartTime;
    updateMinificationProgress(100, "Completed!");
    logMinificationMessage(`✅ Minification completed in ${formatTime(totalTime)}`);
    if (e.detail.stats) {
      logMinificationMessage(`📊 Total reduced: ${e.detail.stats.sizeReduction}% (${formatBytes(e.detail.stats.originalSize)} → ${formatBytes(e.detail.stats.minifiedSize)})`);
    }
    const nextButton = document.getElementById("nextStep3") as HTMLButtonElement;
    if (nextButton) {
      nextButton.disabled = false;
    }
  });
});
