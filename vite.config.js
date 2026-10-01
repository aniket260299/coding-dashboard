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
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router')) return 'router';
          if (id.includes('react-dom') || /(^|\/)react\//.test(id) || id.includes('/react/') || id.includes('scheduler'))
            return 'vendor';
          if (id.includes('@codemirror') || id.includes('@lezer') || id.includes('@marijn')) return 'editor';
          return 'deps';
        },
      },
    },
  },
});
