// event-handlers.ts - Manipuladores de eventos para rastrear progresso e métricas

// Certifique-se de declarar as propriedades globais como variáveis no Window no arquivo global.d.ts:
// interface Window {
//   processingTotalFiles: number;
//   processingCompletedFiles: number; 
//   processingStartTimeEstimation: number;
//   processingTokensTotal: { sent: number; received: number };
//   setupEventHandlers: () => void; // Adicionando a função global
// }

// Função para configurar os event listeners no renderer.ts - será exposta globalmente
function setupEventListeners(windowObj: Window) {
  // Listeners para eventos de minificação
  setupMinificationListeners(windowObj);
  
  // Listeners para eventos de processamento/conversão
  setupProcessingListeners(windowObj);
}

// Expor a função para o contexto global do navegador
(window as any).setupEventHandlers = () => setupEventListeners(window);

// Configura os listeners para eventos de minificação
function setupMinificationListeners(windowObj: Window) {
  // Evento de início da minificação
  windowObj.logger.onMinifyStart((data: { totalFiles: number }) => {
    // Salvar contagem total de arquivos e iniciar timer
    const minifyStartTime = Date.now();
    
    // Log de início
    logMinificationMessage(`🚀 Iniciando minificação de ${data.totalFiles} arquivos...`);
    updateMinificationProgress(0, "Calculando...");
    
    // Armazenar em variáveis do DOM para fácil acesso
    const countElement = document.getElementById("fileCount");
    if (countElement) {
      countElement.textContent = `${data.totalFiles} arquivos`;
    }
  });
  
  // Evento de progresso da minificação
  windowObj.logger.onMinifyProgress((data: { 
    file: string,
    processed: number,
    total: number,
    tokens?: { before: number, after: number },
    size?: { before: string, after: string, beforeBytes: number, afterBytes: number },
    originalSize?: number,
    minifiedSize?: number
  }) => {
    // Calcular porcentagem de conclusão
    const percent = Math.floor((data.processed / data.total) * 100);
    
    // Calcular tempo estimado restante com base no progresso
    const elapsedTime = Date.now() - minifyStartTime;
    const progressRatio = data.processed / data.total;
    const estimatedTotalTime = elapsedTime / progressRatio;
    const remainingTime = estimatedTotalTime - elapsedTime;
    const timeEstimation = formatTime(remainingTime);
    
    // Atualizar UI
    updateMinificationProgress(percent, timeEstimation);
    
    // Atualizar detalhes do minification summary
    addFileToMinificationDetails(data);
    
    // Atualizar contadores de redução
    updateMinificationMetrics(data);
    
    // Log detalhado do arquivo
    let fileInfo = `Minificado: ${data.file}`;
    if (data.tokens) {
      fileInfo += ` (Tokens: ${data.tokens.before} → ${data.tokens.after})`;
    }
    if (data.size) {
      fileInfo += ` | Tamanho: ${data.size.before} → ${data.size.after}`;
    }
    
    logMinificationMessage(fileInfo);
  });
  
  // Evento de conclusão da minificação
  windowObj.logger.onMinifyComplete((data: {
    totalTime: number,
    totalFiles: number,
    sizeReduction: number,
    originalSize: number,
    minifiedSize: number,
    originalTokens: number,
    minifiedTokens: number
  }) => {
    // Atualizar UI para mostrar 100% concluído
    updateMinificationProgress(100, "Concluído");
    
    // Mostrar resumo
    logMinificationMessage(`✅ Minificação concluída em ${formatTime(data.totalTime)}`);
    logMinificationMessage(`📊 Arquivos: ${data.totalFiles} | Redução: ${data.sizeReduction}% | Tokens: ${data.originalTokens} → ${data.minifiedTokens}`);
    
    // Atualizar métricas finais
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
    
    // Habilitar botão de próxima etapa
    const nextButton = document.getElementById("nextStep3") as HTMLButtonElement;
    if (nextButton) {
      nextButton.disabled = false;
    }
  });
}

// Configura os listeners para eventos de processamento/conversão
function setupProcessingListeners(windowObj: Window) {
  // Variável para armazenar o tempo de início do processamento
  let processingStartTime = 0;
  let processingTotalTokens = { sent: 0, received: 0 };
  let processingFilesDetails: Array<{
    file: string;
    tokensInfo?: { sent: number, received: number };
    fileSize?: { original: number, processed: number };
  }> = [];
  
  // Evento de início do processamento
  windowObj.logger.onFileProcessingStart((data: { totalFiles: number }) => {
    // Salvar contagem total de arquivos e iniciar timer
    processingStartTime = Date.now();
    windowObj.processingStartTimeEstimation = processingStartTime;
    windowObj.processingTotalFiles = data.totalFiles;
    windowObj.processingCompletedFiles = 0;
    windowObj.processingTokensTotal = { sent: 0, received: 0 };
    
    // Resetar array de detalhes
    processingFilesDetails = [];
    
    // Log de início
    logMessage(`🚀 Iniciando processamento de ${data.totalFiles} arquivos...`);
    updateProgress(0, "Calculando...");
    
    // Atualizar contagem de arquivos no DOM
    const processedFilesElement = document.getElementById("processedFilesCount");
    if (processedFilesElement) {
      processedFilesElement.textContent = "0/" + data.totalFiles;
    }
  });
    // Evento de progresso do processamento de arquivos
  windowObj.logger.onFileProcessed((data: { 
    file: string,
    completed: number,
    total: number,
    tokens?: { sent: number, received: number },
    fileSize?: { original: number, processed: number },
    progress?: number
  }) => {
    // Atualizar contadores globais
    windowObj.processingCompletedFiles = data.completed;
    
    if (data.tokens) {
      windowObj.processingTokensTotal.sent += data.tokens.sent || 0;
      windowObj.processingTokensTotal.received += data.tokens.received || 0;
      processingTotalTokens.sent += data.tokens.sent || 0;
      processingTotalTokens.received += data.tokens.received || 0;
      
      // Atualizar métricas de tokens em tempo real na interface
      const sentTokensElement = document.getElementById("sentTokens");
      const receivedTokensElement = document.getElementById("receivedTokens");
      
      if (sentTokensElement) {
        sentTokensElement.textContent = processingTotalTokens.sent.toLocaleString();
      }
      
      if (receivedTokensElement) {
        receivedTokensElement.textContent = processingTotalTokens.received.toLocaleString();
      }
    }
    
    // Armazenar detalhes do arquivo para referência
    processingFilesDetails.push({
      file: data.file,
      tokensInfo: data.tokens,
      fileSize: data.fileSize
    });
    
    // Calcular porcentagem de conclusão
    const percent = Math.floor((data.completed / data.total) * 100);
    
    // Calcular tempo estimado restante com base no progresso
    const elapsedTime = Date.now() - processingStartTime;
    const progressRatio = data.completed / data.total;
    const estimatedTotalTime = elapsedTime / progressRatio;
    const remainingTime = estimatedTotalTime - elapsedTime;
    const timeEstimation = formatTime(remainingTime);
    
    // Atualizar UI
    updateProgress(percent, timeEstimation);
    
    // Atualizar contador de arquivos processados
    const processedFilesElement = document.getElementById("processedFilesCount");
    const conversionProcessedFilesElement = document.getElementById("conversionProcessedFiles");
    
    if (processedFilesElement) {
      processedFilesElement.textContent = `${data.completed}/${data.total}`;
    }
    
    if (conversionProcessedFilesElement) {
      conversionProcessedFilesElement.textContent = data.completed.toString();
    }
    
    // Log detalhado do arquivo
    let fileInfo = `Processado: ${data.file}`;
    
    if (data.tokens) {
      fileInfo += ` (Tokens - Enviados: ${data.tokens.sent}, Recebidos: ${data.tokens.received})`;
    }
    
    if (data.fileSize) {
      const originalSizeStr = formatBytes(data.fileSize.original);
      const processedSizeStr = formatBytes(data.fileSize.processed);
      fileInfo += ` | Tamanho: ${originalSizeStr} → ${processedSizeStr}`;
    }
    
    logMessage(fileInfo);
    
    // Adicionar ao log visível na interface
    addFileToProcessingDetails(data);
  });
  
  // Evento de conclusão do processamento
  windowObj.logger.onProcessingComplete((data: { 
    totalTime: number,
    totalTokens: { sent: number, received: number },
    totalFiles?: number,
    totalSize?: { original: number, processed: number }
  }) => {
    // Atualizar UI para mostrar 100% concluído
    updateProgress(100, "Concluído");
    
    // Mostrar resumo
    logMessage(`✅ Processamento concluído em ${formatTime(data.totalTime)}`);
    
    // Calcular e mostrar estatísticas
    const totalSent = data.totalTokens.sent;
    const totalReceived = data.totalTokens.received;
    logMessage(`📊 Total de Tokens - Enviados: ${totalSent}, Recebidos: ${totalReceived}`);
    
    if (data.totalSize) {
      const originalSizeStr = formatBytes(data.totalSize.original);
      const processedSizeStr = formatBytes(data.totalSize.processed);
      const sizeChangePercent = Math.round((data.totalSize.processed / data.totalSize.original) * 100);
      
      logMessage(`📁 Tamanho Total - Original: ${originalSizeStr}, Processado: ${processedSizeStr} (${sizeChangePercent}%)`);
    }
    
    // Atualizar métricas na interface
    const sentTokensElement = document.getElementById("sentTokens");
    const receivedTokensElement = document.getElementById("receivedTokens");
    const conversionProcessedFilesElement = document.getElementById("conversionProcessedFiles");
    
    if (sentTokensElement) {
      sentTokensElement.textContent = totalSent.toLocaleString();
    }
    
    if (receivedTokensElement) {
      receivedTokensElement.textContent = totalReceived.toLocaleString();
    }
    
    if (conversionProcessedFilesElement && data.totalFiles) {
      conversionProcessedFilesElement.textContent = data.totalFiles.toString();
    }
    
    // Atualizar tempo de processamento na interface
    const processingTimeElement = document.getElementById("processingTime");
    if (processingTimeElement) {
      processingTimeElement.textContent = formatTime(data.totalTime);
    }
    
    // Habilitar botão de próxima etapa (se existir)
    const nextButton = document.getElementById("nextStep4") as HTMLButtonElement;
    if (nextButton) {
      nextButton.disabled = false;
    }
  });
}

// Esta função não é mais necessária pois estamos acessando as propriedades diretamente

// Função auxiliar para formatar tamanho em bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Função para atualizar a barra de progresso
function updateProgress(percent: number, timeEstimation?: string) {
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const timeEstimationElement = document.getElementById("timeEstimation");

  if (progressBar && progressText) {
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}% concluído`;
    
    if (timeEstimationElement && timeEstimation) {
      timeEstimationElement.textContent = timeEstimation;
    }
  }
}

// Função para calcular e mostrar o tempo estimado de conclusão
function updateTimeEstimation(completedFiles: number, totalFiles: number, windowObj: Window) {
  if (completedFiles === 0 || totalFiles === 0) return "Calculando...";
  
  const elapsedTime = Date.now() - windowObj.processingStartTimeEstimation;
  const progressRatio = completedFiles / totalFiles;
  const estimatedTotalTime = elapsedTime / progressRatio;
  const remainingTime = estimatedTotalTime - elapsedTime;
  
  // Converter milissegundos para formato legível
  return formatTime(remainingTime);
}

// Função para formatar tempo em milissegundos para formato legível
function formatTime(ms: number): string {
  if (ms < 0) return "Finalizando...";
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m restantes`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s restantes`;
  } else {
    return `${seconds}s restantes`;
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

// Variável global para armazenar o tempo de início da minificação
let minifyStartTime = Date.now();

// Função para adicionar arquivo aos detalhes da minificação
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

// Função para atualizar métricas de minificação
function updateMinificationMetrics(data: {
  tokens?: { before: number, after: number },
  size?: { beforeBytes: number, afterBytes: number }
}) {
  // Implementar lógica para atualizar métricas acumuladas
  // Esta função pode ser expandida conforme necessário
}

// Função para adicionar arquivo aos detalhes do processamento
function addFileToProcessingDetails(data: {
  file: string,
  tokens?: { sent: number, received: number },
  fileSize?: { original: number, processed: number }
}) {
  const detailsElement = document.getElementById("processingDetails");
  if (!detailsElement) return;
  
  const row = document.createElement("tr");
  
  // Formatar tamanhos para exibição
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

// Função para atualizar a barra de progresso da minificação
function updateMinificationProgress(percent: number, timeEstimation?: string) {
  const progressBar = document.getElementById("minifyProgressBar");
  const progressText = document.getElementById("minifyProgressText");
  const timeEstimationElement = document.getElementById("minifyTimeEstimation");

  if (progressBar && progressText) {
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}% concluído`;
    
    if (timeEstimationElement && timeEstimation) {
      timeEstimationElement.textContent = timeEstimation;
    }
  }
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
