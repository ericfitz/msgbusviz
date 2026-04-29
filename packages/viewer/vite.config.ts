import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist-bundle',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: { entryFileNames: 'viewer.js', assetFileNames: '[name][extname]' },
    },
  },
});
