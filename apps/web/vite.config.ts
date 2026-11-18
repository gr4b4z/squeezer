import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const gateway = process.env.GATEWAY_URL ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': gateway,
      '/ws': { target: gateway.replace(/^http/, 'ws'), ws: true },
    },
  },
  build: { target: 'es2022', sourcemap: true },
});
