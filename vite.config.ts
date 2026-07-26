import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

function localDbPlugin() {
  return {
    name: 'local-db',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/local/db.json', (req, res) => {
        const dbPath = path.resolve(process.cwd(), 'db.json')
        if (req.method === 'GET') {
          const content = fs.readFileSync(dbPath, 'utf-8')
          res.setHeader('Content-Type', 'application/json')
          res.end(content)
        } else if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => (body += chunk))
          req.on('end', () => {
            fs.writeFileSync(dbPath, body, 'utf-8')
            res.end(JSON.stringify({ ok: true }))
          })
        } else {
          res.statusCode = 405
          res.end()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localDbPlugin()],
  base: '/DataBaseProducts/',
  server: {
    proxy: {
      '/github-proxy': {
        target: 'https://api.github.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/github-proxy/, ''),
      },
    },
  },
})
