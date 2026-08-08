import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['index.html'],
      exclude: ['tests/**', 'node_modules/**']
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
