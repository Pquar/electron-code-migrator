/**
 * Enhanced analyzeCodeWithAgent Demo
 * This script demonstrates the new MCP integration capabilities
 */

const { analyzeCodeWithAgent, executeAgentSuggestions } = require('./dist/processor');
const path = require('path');

async function demonstrateEnhancedAgent() {
  console.log('🚀 Enhanced analyzeCodeWithAgent Demo with MCP Integration\n');

  // Simulate process options
  const options = {
    sourceFolder: path.join(__dirname, 'primaria'),
    tempFolder: path.join(__dirname, 'temp'),
    outputFolder: path.join(__dirname, 'output'),
    simplificationOptions: {
      removeComments: true,
      reduceKeywords: false,
      minify: false
    },
    conversionOptions: {
      targetLanguage: 'python',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
    }
  };

  // Simulate converted files
  const files = [
    {
      simplified: path.join(__dirname, 'intermediario', 'example.py'),
      converted: path.join(__dirname, 'destino final', 'math_processor.py')
    }
  ];

  try {
    console.log('📁 Analyzing files with MCP context...');
    console.log('   - Reading from primaria/ folder');
    console.log('   - Reading from intermediario/ folder');
    console.log('   - Analyzing destino final/ folder');
    console.log('');

    // Call the enhanced function
    const suggestions = await analyzeCodeWithAgent(options, files);

    console.log(`✅ Analysis complete! Generated ${suggestions.length} suggestions:\n`);

    // Display suggestions
    suggestions.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion.type.toUpperCase()}: ${suggestion.description}`);
      
      if (suggestion.type.startsWith('mcp_')) {
        console.log(`   🔧 MCP Operation on: ${suggestion.path}`);
        if (suggestion.mcpFolder) {
          console.log(`   📂 Target folder: ${suggestion.mcpFolder}`);
        }
      }
      
      if (suggestion.content && suggestion.content.length > 0) {
        const preview = suggestion.content.substring(0, 100);
        console.log(`   📄 Content preview: ${preview}${suggestion.content.length > 100 ? '...' : ''}`);
      }
      
      console.log('');
    });

    // Demonstrate executing MCP suggestions
    if (suggestions.length > 0) {
      console.log('🎯 Executing MCP suggestions...\n');
      
      const results = await executeAgentSuggestions(suggestions, options.outputFolder);
      
      results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        const suggestion = result.suggestion;
        
        console.log(`${status} ${suggestion.type.toUpperCase()}: ${suggestion.description}`);
        
        if (!result.success && result.error) {
          console.log(`   Error: ${result.error}`);
        } else if (result.success && suggestion.type.startsWith('mcp_')) {
          console.log(`   MCP operation completed successfully`);
        }
      });
    }

    console.log('\n🎉 Demo completed successfully!');
    console.log('\nThe enhanced analyzeCodeWithAgent now provides:');
    console.log('• Full MCP folder context to AI');
    console.log('• Read access to primaria/ and intermediario/');
    console.log('• Write/create/delete access to destino final/');
    console.log('• Pattern-based code suggestions');
    console.log('• Intelligent file management');

  } catch (error) {
    console.error('❌ Error during demonstration:', error.message);
    console.log('\nTroubleshooting tips:');
    console.log('1. Ensure MCP folders exist (primaria/, intermediario/, destino final/)');
    console.log('2. Add some example files to the folders');
    console.log('3. Set a valid OpenAI API key if using OpenAI provider');
    console.log('4. Check that the dist/ folder exists (run npm run build)');
  }
}

// Example of how the AI might analyze and suggest improvements
function exampleAISuggestions() {
  return [
    {
      type: 'mcp_create',
      description: 'Create utility module based on common patterns from primaria folder',
      path: 'utils.py',
      content: `# Utility functions extracted from source files
def validate_input(data):
    """Validate input data based on patterns from source files"""
    if not data:
        return False
    return True

def format_output(result):
    """Format output consistently across modules"""
    return str(result).strip()

def log_operation(operation, success):
    """Log operations for debugging"""
    status = "SUCCESS" if success else "FAILED"
    print(f"[{status}] {operation}")
`,
      mcpFolder: 'destino final'
    },
    {
      type: 'mcp_modify',
      description: 'Enhance math_processor.py with error handling and logging',
      path: 'math_processor.py',
      content: `# Enhanced math processor with improved error handling
import sys
from utils import validate_input, format_output, log_operation

def process_numbers(numbers):
    """Process numbers with validation and logging"""
    log_operation("Starting number processing", True)
    
    if not validate_input(numbers):
        log_operation("Input validation failed", False)
        return None
    
    try:
        result = sum(numbers) / len(numbers)
        log_operation(f"Calculated average: {result}", True)
        return format_output(result)
    except Exception as e:
        log_operation(f"Calculation error: {e}", False)
        return None

if __name__ == "__main__":
    test_data = [1, 2, 3, 4, 5]
    print(process_numbers(test_data))
`,
      mcpFolder: 'destino final'
    },
    {
      type: 'mcp_create',
      description: 'Create configuration file based on project structure',
      path: 'config.py',
      content: `# Configuration settings for the project
import os

# Project paths
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
SOURCE_PATH = os.path.join(PROJECT_ROOT, '..', 'primaria')
INTERMEDIATE_PATH = os.path.join(PROJECT_ROOT, '..', 'intermediario')
OUTPUT_PATH = os.path.join(PROJECT_ROOT)

# Processing settings
DEFAULT_ENCODING = 'utf-8'
MAX_FILE_SIZE = 1024 * 1024  # 1MB
SUPPORTED_EXTENSIONS = ['.js', '.py', '.ts', '.txt']

# Logging configuration
LOG_LEVEL = 'INFO'
LOG_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'
`,
      mcpFolder: 'destino final'
    }
  ];
}

// Run the demonstration
if (require.main === module) {
  demonstrateEnhancedAgent().catch(console.error);
}

module.exports = {
  demonstrateEnhancedAgent,
  exampleAISuggestions
};
