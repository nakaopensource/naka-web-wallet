import {fileURLToPath, URL} from 'node:url';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'happy-dom',
    /** Node 22+ ships its own (broken without --localstorage-file) localStorage global that shadows happy-dom's */
    execArgv:
      Number(process.versions.node.split('.')[0]) >= 22
        ? ['--no-experimental-webstorage']
        : [],
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    clearMocks: true
  }
});
