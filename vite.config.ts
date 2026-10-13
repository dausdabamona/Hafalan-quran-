import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' agar aset termuat dari berkas lokal di dalam APK (Capacitor).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 800 },
});
