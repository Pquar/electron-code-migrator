const fs = require('fs');
const path = require('path');

function simplifyFile(content) {
  return content.replace(/\/\/.*$/gm, '').replace(/\bfunction\b/g, 'fn').replace(/\s+/g, ' ');
}

function processFolder(inputDir, outputDir) {
  const files = fs.readdirSync(inputDir);
  files.forEach(file => {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file);
    if (fs.statSync(inputPath).isFile()) {
      const content = fs.readFileSync(inputPath, 'utf-8');
      const simplified = simplifyFile(content);
      fs.writeFileSync(outputPath, simplified);
    }
  });
}

module.exports = { processFolder };
