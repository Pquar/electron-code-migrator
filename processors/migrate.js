function migrateJSContentToTS(content) {
  return content.replace(/\bvar\b/g, 'let')
                .replace(/(const|let) (.+) = require\((.+)\)/g, 'import $2 from $3');
}

module.exports = { migrateJSContentToTS };
