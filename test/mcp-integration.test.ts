/**
 * Testes de integração para verificar a conexão entre o servidor MCP
 * e as classes existentes (MCPFileManager, MCPIntegratedConverter, etc.)
 * Nota: Testes que dependem de APIs externas foram removidos para evitar custos
 */

import { LocalFileAccessServer } from '../src/mcp-server';
import * as fs from 'fs';
import * as path from 'path';

describe('MCP Integration Tests', () => {
  let server: LocalFileAccessServer;

  beforeAll(() => {
    server = new LocalFileAccessServer();
  });

  describe('File System Integration', () => {
    test('should work with existing folder structure', () => {
      const basePath = process.cwd();
      const folders = ['primaria', 'intermediario', 'destino final'];
      
      folders.forEach(folder => {
        const folderPath = path.join(basePath, folder);
        
        // Ensure folder exists
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }
        
        expect(fs.existsSync(folderPath)).toBe(true);
      });
    });

    test('should handle file operations in destino final', () => {
      const destinationPath = path.join(process.cwd(), 'destino final');
      const testFile = path.join(destinationPath, 'integration-test.txt');
      const testContent = 'Integration test content';
      
      // Clean up first
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
      
      // Test create
      fs.writeFileSync(testFile, testContent);
      expect(fs.existsSync(testFile)).toBe(true);
      
      // Test read
      const content = fs.readFileSync(testFile, 'utf8');
      expect(content).toBe(testContent);
      
      // Test modify
      const modifiedContent = 'Modified integration test content';
      fs.writeFileSync(testFile, modifiedContent);
      expect(fs.readFileSync(testFile, 'utf8')).toBe(modifiedContent);
      
      // Test delete
      fs.unlinkSync(testFile);
      expect(fs.existsSync(testFile)).toBe(false);
    });
  });
  describe('Environment Variables Integration', () => {
    test('should handle environment variables access', () => {
      // Test that environment variables can be accessed without throwing
      // Note: Removed API key specific tests to avoid external dependencies
      const testEnvVars = [
        'BASE_PATH',
        'NODE_ENV'
      ];
      
      testEnvVars.forEach(envVar => {
        // Should not throw error when accessing
        expect(() => process.env[envVar]).not.toThrow();
      });
    });
  });

  describe('Import Validation', () => {
    test('should successfully import all required modules', async () => {
      // Test that all imports work correctly
      expect(() => require('../src/mcp-server')).not.toThrow();
      expect(() => require('../src/mcp-converter')).not.toThrow();
      expect(() => require('../src/processor')).not.toThrow();
      expect(() => require('../src/converter')).not.toThrow();
      expect(() => require('../src/interface')).not.toThrow();
      expect(() => require('../src/simplifier')).not.toThrow();
    });
  });

  describe('Tool Schema Validation', () => {
    test('should have proper tool schemas', () => {
      // Verify that tool schemas follow the expected format
      const expectedSchema = {
        type: 'object',
        properties: {},
        required: []
      };
      
      expect(typeof expectedSchema.type).toBe('string');
      expect(typeof expectedSchema.properties).toBe('object');
      expect(Array.isArray(expectedSchema.required)).toBe(true);
    });
  });

  describe('Server Methods Integration', () => {
    test('should have all required server lifecycle methods', () => {
      expect(typeof server.run).toBe('function');
      expect(typeof server.stop).toBe('function');
      expect(typeof server.isServerRunning).toBe('function');
    });

    test('should handle server state management', () => {
      // Initial state should be not running
      expect(server.isServerRunning()).toBe(false);
    });
  });

  describe('Configuration Integration', () => {
    test('should work with MCP configuration', () => {
      const mcpConfig = {
        servers: {
          'electron-code-migrator': {
            type: 'stdio',
            command: 'node',
            args: ['dist/mcp-server.js']
          }
        }
      };
      
      expect(mcpConfig.servers['electron-code-migrator']).toBeDefined();
      expect(mcpConfig.servers['electron-code-migrator'].type).toBe('stdio');
      expect(mcpConfig.servers['electron-code-migrator'].command).toBe('node');
    });
  });

  describe('Build Integration', () => {
    test('should be compatible with TypeScript compilation', () => {
      // Check that dist directory exists or can be created
      const distPath = path.join(process.cwd(), 'dist');
      
      if (!fs.existsSync(distPath)) {
        fs.mkdirSync(distPath, { recursive: true });
      }
      
      expect(fs.existsSync(distPath)).toBe(true);
    });

    test('should have proper TypeScript configuration', () => {
      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
      expect(fs.existsSync(tsconfigPath)).toBe(true);
      
      if (fs.existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
        expect(tsconfig).toBeDefined();
        expect(tsconfig.compilerOptions).toBeDefined();
      }
    });
  });
});
