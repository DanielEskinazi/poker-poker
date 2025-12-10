import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Resolve .js imports to .ts files (for ESM compatibility)
    extensions: ['.ts', '.js', '.json'],
    alias: {
      // Map .js extension to .ts for source files
    },
  },
  esbuild: {
    // Configure esbuild to handle .js to .ts resolution
    target: 'node18',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    pool: 'forks',
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.test.ts',
        '**/*.config.ts',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
