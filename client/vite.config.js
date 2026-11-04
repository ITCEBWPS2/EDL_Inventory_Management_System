import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // strictPort prevents Vite from silently falling back to next available port (e.g. 5174)
    strictPort: true,
    host: true,
  },
});
