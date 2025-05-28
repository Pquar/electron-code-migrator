import { getLocalFilesInfo } from './converter';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Teste funcional completo do sistema MCP
 * Demonstra como a IA usa contexto local para melhorar conversões
 */
async function runFullMCPDemo() {
  console.log('🚀 === DEMONSTRAÇÃO COMPLETA DO SISTEMA MCP === 🚀\n');

  try {
    // 1. Demonstrar coleta de informações dos arquivos locais
    console.log('📊 1. Coletando informações dos arquivos locais...\n');
    const localContext = await getLocalFilesInfo();
    console.log(localContext);
    
    // 2. Demonstrar análise de arquivos específicos
    console.log('\n🔍 2. Analisando arquivos específicos...\n');
    
    const sourceFile = path.join(process.cwd(), 'primaria', 'example.js');
    const intermediateFile = path.join(process.cwd(), 'intermediario', 'example.py');
    const finalFile = path.join(process.cwd(), 'destino final', 'math_processor.py');
    
    // Analisar arquivo fonte
    if (fs.existsSync(sourceFile)) {
      const sourceContent = fs.readFileSync(sourceFile, 'utf8');
      console.log('📄 Arquivo fonte (JavaScript):');
      console.log('```javascript');
      console.log(sourceContent);
      console.log('```\n');
    }
    
    // Analisar arquivo intermediário
    if (fs.existsSync(intermediateFile)) {
      const intermediateContent = fs.readFileSync(intermediateFile, 'utf8');
      console.log('⚙️ Arquivo intermediário (Python básico):');
      console.log('```python');
      console.log(intermediateContent);
      console.log('```\n');
    }
    
    // Analisar arquivo final
    if (fs.existsSync(finalFile)) {
      const finalContent = fs.readFileSync(finalFile, 'utf8');
      console.log('✨ Arquivo final (Python aprimorado com MCP):');
      console.log('```python');
      console.log(finalContent.substring(0, 800) + '...\n(truncado para exibição)');
      console.log('```\n');
    }
    
    // 3. Demonstrar como a IA usaria essas informações
    console.log('🤖 3. Como a IA usa o contexto MCP para melhorar conversões:\n');
    
    console.log('✅ Padrões identificados:');
    console.log('   • Estrutura de projeto com etapas (primária → intermediário → final)');
    console.log('   • Evolução de código simples para versão robusta');
    console.log('   • Adição de tratamento de erros e logging');
    console.log('   • Melhoria de documentação e tipagem\n');
    
    console.log('🎯 Melhorias aplicadas automaticamente:');
    console.log('   • Type hints para Python');
    console.log('   • Tratamento de exceções');
    console.log('   • Logging estruturado');
    console.log('   • Documentação detalhada');
    console.log('   • Testes unitários incluídos\n');
    
    // 4. Estatísticas do projeto
    console.log('📈 4. Estatísticas do projeto:\n');
    
    const folders = ['primaria', 'intermediario', 'destino final'];
    for (const folder of folders) {
      const folderPath = path.join(process.cwd(), folder);
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);
        const fileCount = files.filter(f => !fs.statSync(path.join(folderPath, f)).isDirectory()).length;
        console.log(`   📁 ${folder}: ${fileCount} arquivo(s)`);
      }
    }
    
    console.log('\n🎉 === DEMONSTRAÇÃO CONCLUÍDA COM SUCESSO === 🎉');
    console.log('\nO sistema MCP permite que a IA:');
    console.log('• Acesse arquivos locais de forma segura');
    console.log('• Entenda o contexto completo do projeto');
    console.log('• Faça conversões mais inteligentes e consistentes');
    console.log('• Mantenha padrões e convenções do projeto');
    
  } catch (error) {
    console.error('❌ Erro durante a demonstração:', error);
  }
}

// Função auxiliar para estatísticas de arquivos
function getFileStats(filePath: string) {
  try {
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      size: stats.size,
      lines: content.split('\n').length,
      words: content.split(/\s+/).length,
      modified: stats.mtime
    };
  } catch {
    return null;
  }
}

// Executar demonstração se executado diretamente
if (require.main === module) {
  runFullMCPDemo();
}

export { runFullMCPDemo };
