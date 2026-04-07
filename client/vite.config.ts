import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import path from 'path'

const crossOriginHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

const DEFAULT_PORT = 6173;

// https://vite.dev/config/
export default defineConfig({
  server: {
    headers: crossOriginHeaders,
    port: DEFAULT_PORT
  },
  preview: {
    headers: crossOriginHeaders,
  },
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      $components: path.resolve(__dirname, 'src/components'),
      $lib: path.resolve(__dirname, 'src/lib'),
      $stores: path.resolve(__dirname, 'src/stores'),
    },
  },
})
