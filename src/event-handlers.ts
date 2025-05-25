// event-handlers.ts - Event handlers for tracking progress and metrics

// Make sure to declare global properties as variables in Window in global.d.ts:
// interface Window {
//   processingTotalFiles: number;
//   processingCompletedFiles: number;
//   processingStartTimeEstimation: number;
//   processingTokensTotal: { sent: number; received: number };
//   setupEventHandlers: () => void; // Adding the global function
// }

// Function to set up event listeners in renderer.ts - will be exposed globally
function setupEventListeners(windowObj: Window) {
  // Listeners for minification events
  setupMinificationListeners(windowObj);
  
  // Listeners for processing/conversion events
  setupProcessingListeners(windowObj);
}

// Expose the function to the global browser context
(window as any).setupEventHandlers = () => setupEventListeners(window);

// Set up listeners for minification events
function setupMinificationListeners(windowObj: Window) {
  // Minification start event
  windowObj.logger.onMinifyStart((data: { totalFiles: number }) => {
    const minifyStartTime = Date.now();
    logMinificationMessage(`🚀 Starting minification of ${data.totalFiles} files...`);
    updateMinificationProgress(0, "Calculating...");
    const countElement = document.getElementById("fileCount");
    if (countElement) {
      countElement.textContent = `${data.totalFiles} files`;
    }
  });
  
  // Minification progress event
  windowObj.logger.onMinifyProgress((data: { 
    file: string,
    processed: number,
    total: number,
    tokens?: { before: number, after: number },
    size?: { before: string, after: string, beforeBytes: number, afterBytes: number },
    originalSize?: number,
    minifiedSize?: number
  }) => {
    const percent = Math.floor((data.processed / data.total) * 100);
    const elapsedTime = Date.now() - minifyStartTime;
    const progressRatio = data.processed / data.total;
    const estimatedTotalTime = elapsedTime / progressRatio;
    const remainingTime = estimatedTotalTime - elapsedTime;
    const timeEstimation = formatTime(remainingTime);
    updateMinificationProgress(percent, timeEstimation);
    addFileToMinificationDetails(data);
    updateMinificationMetrics(data);
    let fileInfo = `Minified: ${data.file}`;
    if (data.tokens) {
      fileInfo += ` (Tokens: ${data.tokens.before} → ${data.tokens.after})`;
    }
    if (data.size) {
      fileInfo += ` | Size: ${data.size.before} → ${data.size.after}`;
    }
    logMinificationMessage(fileInfo);
  });
  
  // Minification complete event
  windowObj.logger.onMinifyComplete((data: {
    totalTime: number,
    totalFiles: number,
    sizeReduction: number,
    originalSize: number,
    minifiedSize: number,
    originalTokens: number,
    minifiedTokens: number
  }) => {
    updateMinificationProgress(100, "Completed");
    logMinificationMessage(`✅ Minification completed in ${formatTime(data.totalTime)}`);
    logMinificationMessage(`📊 Files: ${data.totalFiles} | Reduction: ${data.sizeReduction}% | Tokens: ${data.originalTokens} → ${data.minifiedTokens}`);
    const tokenReduction = document.getElementById("tokenReduction");
    const sizeReduction = document.getElementById("sizeReduction");
    const processedFilesCount = document.getElementById("processedFilesCount");
    if (tokenReduction) {
      const reductionPercent = Math.round((1 - data.minifiedTokens / data.originalTokens) * 100);
      tokenReduction.textContent = `${reductionPercent}% (${data.originalTokens} → ${data.minifiedTokens})`;
    }
    if (sizeReduction) {
      sizeReduction.textContent = `${data.sizeReduction}%`;
    }
    if (processedFilesCount) {
      processedFilesCount.textContent = data.totalFiles.toString();
    }
    const nextButton = document.getElementById("nextStep3") as HTMLButtonElement;
    if (nextButton) {
      nextButton.disabled = false;
    }
  });
}

// Set up listeners for processing/conversion events
function setupProcessingListeners(windowObj: Window) {
  let processingStartTime = 0;
  let processingTotalTokens = { sent: 0, received: 0 };
  let processingFilesDetails: Array<{
    file: string;
    tokensInfo?: { sent: number, received: number };
    fileSize?: { original: number, processed: number };
  }> = [];
  let totalFiles = 0;
  let completedFiles = 0;
  
  windowObj.logger.onFileProcessingStart((data: { totalFiles: number }) => {
    totalFiles = data.totalFiles;
    completedFiles = 0;
    processingStartTime = Date.now();
    windowObj.processingStartTimeEstimation = processingStartTime;
    windowObj.processingTotalFiles = data.totalFiles;
    windowObj.processingCompletedFiles = 0;
    windowObj.processingTokensTotal = { sent: 0, received: 0 };
    processingFilesDetails = [];
    logMessage(`🚀 Iniciando processamento de ${data.totalFiles} arquivos...`);
    updateProgress(0, "Calculando...");
    const processedFilesElement = document.getElementById("processedFilesCount");
    if (processedFilesElement) {
      processedFilesElement.textContent = "0/" + data.totalFiles;
    }
  });

  // Listener para atualizações de progresso da conversão
  windowObj.electronAPI.onConversionProgress((data: {
    status: string;
    file?: string;
    message?: string;
    fileInfo?: string;
    tokensInfo?: { sent: number, received: number };
    fileSize?: { original: number, processed: number };
  }) => {
    // Atualizar contadores se for uma conversão completa
    if (data.status === "converted" || data.status === "completed") {
      completedFiles++;
    }

    // Atualizar tokens processados
    if (data.tokensInfo) {
      windowObj.processingTokensTotal.sent += data.tokensInfo.sent || 0;
      windowObj.processingTokensTotal.received += data.tokensInfo.received || 0;
      const sentTokensElement = document.getElementById("sentTokens");
      const receivedTokensElement = document.getElementById("receivedTokens");
      if (sentTokensElement) {
        sentTokensElement.textContent = windowObj.processingTokensTotal.sent.toLocaleString();
      }
      if (receivedTokensElement) {
        receivedTokensElement.textContent = windowObj.processingTokensTotal.received.toLocaleString();
      }
    }

    // Atualizar mensagem de log com base no status
    if (data.message) {
      switch (data.status) {
        case "converting":
          logMessage(`ℹ️ ${data.message}`);
          break;
        case "completed":
          logMessage(`✅ ${data.message}`);
          break;
        case "error":
          logMessage(`❌ ${data.message}`);
          break;
        default:
          if (data.file) {
            let message = `📄 Processando: ${data.file}`;
            if (data.fileInfo) {
              message += ` | ${data.fileInfo}`;
            }
            logMessage(message);
          }
      }
    }

    // Atualizar progresso geral
    if (totalFiles > 0) {
      const percent = Math.floor((completedFiles / totalFiles) * 100);
      const elapsedTime = Date.now() - processingStartTime;
      const progressRatio = completedFiles / totalFiles;
      const estimatedTotalTime = elapsedTime / progressRatio;
      const remainingTime = estimatedTotalTime - elapsedTime;
      const timeEstimation = formatTime(remainingTime);
      
      updateProgress(percent, timeEstimation);
      
      const processedFilesElement = document.getElementById("processedFilesCount");
      const conversionProcessedFilesElement = document.getElementById("conversionProcessedFiles");
      
      if (processedFilesElement) {
        processedFilesElement.textContent = `${completedFiles}/${totalFiles}`;
      }
      if (conversionProcessedFilesElement) {
        conversionProcessedFilesElement.textContent = completedFiles.toString();
      }
    }

    // Adicionar detalhes do arquivo processado
    if (data.file && (data.tokensInfo || data.fileSize)) {
      processingFilesDetails.push({
        file: data.file,
        tokensInfo: data.tokensInfo,
        fileSize: data.fileSize
      });
    }
  });

  windowObj.logger.onProcessingComplete((data: { 
    totalTime: number,
    totalTokens: { sent: number, received: number },
    totalFiles?: number,
    totalSize?: { original: number, processed: number }
  }) => {
    updateProgress(100, "Concluído");
    logMessage(`✅ Processamento concluído em ${formatTime(data.totalTime)}`);
    const totalSent = data.totalTokens.sent;
    const totalReceived = data.totalTokens.received;
    logMessage(`📊 Total de Tokens - Enviados: ${totalSent.toLocaleString()}, Recebidos: ${totalReceived.toLocaleString()}`);
    if (data.totalSize) {
      const originalSizeStr = formatBytes(data.totalSize.original);
      const processedSizeStr = formatBytes(data.totalSize.processed);
      const sizeChangePercent = Math.round((data.totalSize.processed / data.totalSize.original) * 100);
      logMessage(`📁 Tamanho Total - Original: ${originalSizeStr}, Processado: ${processedSizeStr} (${sizeChangePercent}%)`);
    }
    
    const nextButton = document.getElementById("nextStep4") as HTMLButtonElement;
    if (nextButton) {
      nextButton.disabled = false;
    }
  });
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Update progress bar
function updateProgress(percent: number, timeEstimation?: string) {
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const timeEstimationElement = document.getElementById("timeEstimation");

  if (progressBar && progressText) {
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}% completed`;
    
    if (timeEstimationElement && timeEstimation) {
      timeEstimationElement.textContent = timeEstimation;
    }
  }
}

// Helper to calculate and show estimated completion time
function updateTimeEstimation(completedFiles: number, totalFiles: number, windowObj: Window) {
  if (completedFiles === 0 || totalFiles === 0) return "Calculating...";
  
  const elapsedTime = Date.now() - windowObj.processingStartTimeEstimation;
  const progressRatio = completedFiles / totalFiles;
  const estimatedTotalTime = elapsedTime / progressRatio;
  const remainingTime = estimatedTotalTime - elapsedTime;
  
  return formatTime(remainingTime);
}

// Helper to format ms to readable time
function formatTime(ms: number): string {
  if (ms < 0) return "Finishing...";
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m left`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s left`;
  } else {
    return `${seconds}s left`;
  }
}

// Add message to log
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

let minifyStartTime = Date.now();

// Add file to minification details
function addFileToMinificationDetails(data: {
  file: string,
  tokens?: { before: number, after: number },
  size?: { before: string, after: string }
}) {
  const detailsElement = document.getElementById("minificationDetails");
  if (!detailsElement) return;
  
  const row = document.createElement("tr");
  row.innerHTML = `
    <td class="py-2 px-4 border-b border-gray-200">${data.file}</td>
    <td class="py-2 px-4 border-b border-gray-200">${data.tokens?.before || "-"}</td>
    <td class="py-2 px-4 border-b border-gray-200">${data.tokens?.after || "-"}</td>
    <td class="py-2 px-4 border-b border-gray-200">${data.size?.before || "-"}</td>
    <td class="py-2 px-4 border-b border-gray-200">${data.size?.after || "-"}</td>
  `;
  
  detailsElement.appendChild(row);
}

// Update minification metrics
function updateMinificationMetrics(data: {
  tokens?: { before: number, after: number },
  size?: { beforeBytes: number, afterBytes: number }
}) {
  // Implement logic to update accumulated metrics if needed
}

// Add file to processing details
function addFileToProcessingDetails(data: {
  file: string,
  tokens?: { sent: number, received: number },
  fileSize?: { original: number, processed: number }
}) {
  const detailsElement = document.getElementById("processingDetails");
  if (!detailsElement) return;
  
  const row = document.createElement("tr");
  
  const originalSizeStr = data.fileSize ? formatBytes(data.fileSize.original) : "-";
  const processedSizeStr = data.fileSize ? formatBytes(data.fileSize.processed) : "-";
  
  row.innerHTML = `
    <td class="py-2 px-4 border-b border-gray-200">${data.file}</td>
    <td class="py-2 px-4 border-b border-gray-200">${data.tokens?.sent || "-"}</td>
    <td class="py-2 px-4 border-b border-gray-200">${data.tokens?.received || "-"}</td>
    <td class="py-2 px-4 border-b border-gray-200">${originalSizeStr}</td>
    <td class="py-2 px-4 border-b border-gray-200">${processedSizeStr}</td>
  `;
  
  detailsElement.appendChild(row);
}

// Update minification progress bar
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

// Add message to minification log
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
