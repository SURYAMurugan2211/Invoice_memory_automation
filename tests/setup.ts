// Jest setup file for basic test configuration

// Global test timeout for database operations
jest.setTimeout(15000);

// Mock console methods for cleaner test output
const originalConsole = console;

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    warn: jest.fn(),
    error: originalConsole.error, // Keep errors visible
    info: jest.fn(),
    debug: jest.fn(),
  };
});

afterAll(() => {
  // Restore original console
  global.console = originalConsole;
});

// Note: Database cleanup is handled in individual test files