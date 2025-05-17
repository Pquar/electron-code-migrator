
export interface SimplificationOptions {
  removeComments: boolean;
  reduceKeywords: boolean;
  minify: boolean;
}

export async function simplifyCode(
  code: string,
  fileExtension: string,
  options: SimplificationOptions
): Promise<string> {
  let result = code;
  
  // Remover comentários
  if (options.removeComments) {
    result = removeComments(result, fileExtension);
  }
  
  // Reduzir palavras-chave
  if (options.reduceKeywords) {
    result = reduceKeywords(result, fileExtension);
  }
  
  // Minificar levemente
  if (options.minify) {
    result = minifyLightly(result, fileExtension);
  }
  
  return result;
}

function removeComments(code: string, fileExtension: string): string {
  // Implementação simplificada - na prática precisaria de um parser específico para cada linguagem
  // Remove comentários de linha única
  let result = code.replace(/\/\/.*$/gm, '');
  
  // Remove comentários de múltiplas linhas
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  
  return result;
}

function reduceKeywords(code: string, fileExtension: string): string {
  // Implementação básica - na prática precisaria de análise sintática real
  const keywordsMap: Record<string, string> = {
    'function': 'fn',
    'const ': 'c ',
    'let ': 'l ',
    'var ': 'v ',
    'return ': 'r ',
  };
  
  let result = code;
  Object.entries(keywordsMap).forEach(([keyword, replacement]) => {
    result = result.replace(new RegExp(keyword, 'g'), replacement);
  });
  
  return result;
}

function minifyLightly(code: string, fileExtension: string): string {
  // Minificação leve: remover espaços em branco extras e quebras de linha
  return code
    .replace(/\s+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\s*{\s*/g, '{')
    .replace(/\s*}\s*/g, '}')
    .replace(/\s*;\s*/g, ';')
    .replace(/\s*,\s*/g, ',');
}
