import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' agar aset termuat dari berkas lokal di dalam APK (Capacitor).
export default defineConfig({
  base: './',
  plugins: [react()],
  // Data Al-Qur'an dimuat sebagai JSON.parse agar lebih cepat dibuka di HP.
  json: { stringify: true },
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 4000 },
});
