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
          fs.promises.readFile(dbPath, 'utf-8').then((content: string) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(content)
          }).catch(() => {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Failed to read db.json' }))
          })
        } else if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => (body += chunk))
          req.on('end', () => {
            fs.promises.writeFile(dbPath, body, 'utf-8').then(() => {
              res.end(JSON.stringify({ ok: true }))
            }).catch(() => {
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'Failed to write db.json' }))
            })
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
