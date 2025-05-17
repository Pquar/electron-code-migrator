const fs = require('fs');
const path = require('path');

function copyFile(source, target) {
  fs.copyFileSync(source, target);
}

module.exports = { copyFile };
