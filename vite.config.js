import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, Vite serves the app and forwards /api to the Node backend (server.js on :4300).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:4300' } },
});
