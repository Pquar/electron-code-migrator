console.log('Testando Node.js...');

const fs = require('fs');
const path = require('path');

console.log('Diretório atual:', process.cwd());

// Verificar se as pastas existem
const folders = ['primaria', 'intermediario', 'destino final'];

folders.forEach(folder => {
  const folderPath = path.join(process.cwd(), folder);
  const exists = fs.existsSync(folderPath);
  console.log(`${folder}: ${exists ? 'EXISTE' : 'NÃO EXISTE'} - ${folderPath}`);
  
  if (exists) {
    try {
      const files = fs.readdirSync(folderPath);
      console.log(`  Arquivos: ${files.join(', ')}`);
    } catch (err) {
      console.log(`  Erro: ${err.message}`);
    }
  }
});

console.log('Teste concluído!');
