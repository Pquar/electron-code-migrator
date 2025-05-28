import { getLocalFilesInfo } from './converter';

/**
 * Script de teste para verificar a funcionalidade MCP
 */
async function testMCPIntegration() {
  console.log('=== Testando Integração MCP ===\n');

  try {
    // Testar a função de obter informações dos arquivos locais
    console.log('1. Testando getLocalFilesInfo...');
    const filesInfo = await getLocalFilesInfo();
    console.log('Informações dos arquivos locais:');
    console.log(filesInfo);
    console.log('\n');

    // Testar verificação direta das pastas
    console.log('2. Testando verificação direta das pastas...');
    const fs = require('fs');
    const path = require('path');

    const folders = ['primaria', 'intermediario', 'destino final'];
    const basePath = process.cwd();

    folders.forEach(folder => {
      const folderPath = path.join(basePath, folder);
      console.log(`\nPasta: ${folder}`);
      console.log(`Caminho: ${folderPath}`);
      
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);
        console.log(`Arquivos encontrados: ${files.length}`);
        files.forEach((file: string) => {
          const filePath = path.join(folderPath, file);
          const stats = fs.statSync(filePath);
          console.log(`  - ${file} (${stats.isDirectory() ? 'pasta' : 'arquivo'})`);
        });
      } else {
        console.log('  Pasta não encontrada!');
      }
    });

    console.log('\n=== Teste concluído com sucesso! ===');
  } catch (error) {
    console.error('Erro durante o teste:', error);
  }
}

// Executar o teste
testMCPIntegration();
