const fs = require('fs');
const path = require('path');

/**
 * Demonstração simples da funcionalidade MCP
 */
function demonstrateMCP() {
  console.log('=== Demonstração MCP - Acesso a Arquivos Locais ===\n');

  const folders = ['primaria', 'intermediario', 'destino final'];
  const basePath = process.cwd();

  folders.forEach(folder => {
    const folderPath = path.join(basePath, folder);
    console.log(`\n📁 Verificando pasta: ${folder}`);
    console.log(`   Caminho: ${folderPath}`);
    
    if (fs.existsSync(folderPath)) {
      try {
        const files = fs.readdirSync(folderPath, { withFileTypes: true });
        console.log(`   ✅ Pasta encontrada com ${files.length} item(s)`);
        
        files.forEach(file => {
          const filePath = path.join(folderPath, file.name);
          if (file.isFile()) {
            const ext = path.extname(file.name);
            const size = fs.statSync(filePath).size;
            console.log(`      📄 ${file.name} (${ext || 'sem extensão'}) - ${size} bytes`);
            
            // Se for um arquivo de código pequeno, mostrar uma prévia
            if (['.js', '.ts', '.py', '.java'].includes(ext) && size < 1000) {
              try {
                const content = fs.readFileSync(filePath, 'utf8');
                console.log(`         📝 Prévia: ${content.substring(0, 100)}...`);
              } catch (err) {
                console.log(`         ❌ Erro ao ler arquivo: ${err.message}`);
              }
            }
          } else if (file.isDirectory()) {
            console.log(`      📁 ${file.name}/ (subpasta)`);
          }
        });
      } catch (error) {
        console.log(`   ❌ Erro ao ler pasta: ${error.message}`);
      }
    } else {
      console.log(`   ⚠️ Pasta não encontrada`);
    }
  });

  console.log('\n=== Demonstração Concluída ===');
  
  // Simular como a IA usaria essas informações
  console.log('\n🤖 Como a IA usaria essas informações:');
  console.log('1. Analisar arquivos existentes para entender padrões de código');
  console.log('2. Verificar dependências e imports para conversões mais precisas');
  console.log('3. Manter consistência de estilo entre arquivos convertidos');
  console.log('4. Sugerir melhorias baseadas no contexto do projeto');
}

// Executar demonstração
demonstrateMCP();
