import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [nodePolyfills(),react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        zuzalu: resolve(__dirname, 'zuzalu.html'),
      },
    },
  },
  // optimizeDeps: {
  //   esbuildOptions: {
  //       // Node.js global to browser globalThis
  //       define: {
  //           global: 'globalThis'
  //       },
  //       // Enable esbuild polyfill plugins
  //       plugins: [
  //           NodeGlobalsPolyfillPlugin({
  //               buffer: true
  //           })
  //       ]
  //   }
  // }
})


