import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
  },
  preview: {
    port: 3000,
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 400,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'router', test: /node_modules\/(react-router|@remix-run)\// },
            { name: 'vendor', test: /node_modules\/(react|react-dom|scheduler)\// },
            { name: 'editor', test: /node_modules\/(@codemirror|@lezer|@marijn)\// },
            { name: 'deps', test: /node_modules\// },
          ],
        },
      },
    },
  },
});
