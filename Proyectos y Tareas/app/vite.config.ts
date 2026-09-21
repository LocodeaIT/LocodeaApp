import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Rutas relativas: así el build sirve igual en la raíz de un dominio que
// colgando de un subdirectorio, sin tener que recompilar.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 3000, strictPort: true },
  build: { target: 'es2022' },
})
