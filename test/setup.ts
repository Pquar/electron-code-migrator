// Setup file for Jest tests
import * as fs from 'fs';
import * as path from 'path';

// Setup test environment
beforeAll(() => {
  // Ensure test directories exist
  const testDirs = [
    path.join(process.cwd(), 'primaria'),
    path.join(process.cwd(), 'intermediario'),
    path.join(process.cwd(), 'destino final')
  ];

  testDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Set environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.BASE_PATH = process.cwd();
});

// Clean up after tests
afterAll(() => {
  // Clean up test files if needed
  const testOutputDir = path.join(process.cwd(), 'destino final');
  if (fs.existsSync(testOutputDir)) {
    const files = fs.readdirSync(testOutputDir);
    files.forEach(file => {
      if (file.startsWith('test-')) {
        fs.unlinkSync(path.join(testOutputDir, file));
      }
    });
  }
});
