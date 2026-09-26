import { defineConfig, type ProxyOptions } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import path from 'path'

const crossOriginHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

const DEFAULT_PORT = 6173;
const WORKER_ORIGIN = 'http://localhost:8787'

const workerProxy: ProxyOptions = {
  target: WORKER_ORIGIN,
  changeOrigin: true,
  configure(proxy) {
    proxy.on('proxyReq', (proxyReq, req) => {
      if (req.headers.host && req.headers.origin === `http://${req.headers.host}`) {
        proxyReq.setHeader('Origin', WORKER_ORIGIN)
      }
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    headers: crossOriginHeaders,
    port: DEFAULT_PORT,
    proxy: Object.fromEntries(
      ['/auth', '/feeds', '/tags', '/entries', '/monitor', '/query'].map(path => [
        path,
        workerProxy,
      ]),
    ),
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
