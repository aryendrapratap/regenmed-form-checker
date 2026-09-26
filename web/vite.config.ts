import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During local dev, /api/* is proxied to the backend (FastAPI default port 8000).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
});
