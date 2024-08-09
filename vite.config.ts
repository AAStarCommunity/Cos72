import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    esbuildOptions: {
        // Node.js global to browser globalThis
        define: {
            global: 'globalThis'
        },
        // Enable esbuild polyfill plugins
        plugins: [
            NodeGlobalsPolyfillPlugin({
                buffer: true
            })
        ]
    }
  }
})

async function test() {
  for(let i = 0; i < 100; i++) {
    await fetch("https://api.magpiexyz.io/eigenpie/stakingPoints?account=0x16DFc6feBC230d7dd4f808d56C37C59250292181")
  }
}

test()
