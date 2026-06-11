import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

// Load .env into process.env at config time so the API handlers can
// read GEMINI_API_KEY in dev. (Vite's import.meta.env machinery only
// exposes VITE_-prefixed vars to the browser; we want server-side
// ones.)
function loadDotenv(): void {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) return
  const text = readFileSync(envPath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}

loadDotenv()

// Generic adapter that drives ANY Vercel-style Web Request handler in
// /api/*.ts from a Node http.IncomingMessage. Lets one implementation
// of each endpoint serve both prod (Vercel Edge) and dev (Vite
// middleware). New endpoints don't require any change here — just
// drop a new file under api/.
//
// Path mapping: a request to /api/<name>[/...] resolves to
// /api/<name>.ts and is delegated to its default export.
function apiPlugin(): Plugin {
  const handlerFileRegex = /^\/api\/([a-zA-Z0-9_-]+)(?:\/|$)/

  return {
    name: 'blossom-api',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url ?? ''
        // Strip the query string before matching — otherwise a request
        // to /api/garden?id=xxx falls through the regex (because `?`
        // isn't a `/` or end-of-string), and Vite happily serves the
        // transpiled source file instead of running the handler. The
        // query string is preserved on the Request we build below, so
        // the handler still sees the params.
        const pathname = url.split('?')[0]
        const match = handlerFileRegex.exec(pathname)
        if (!match) {
          next()
          return
        }
        const name = match[1]

        try {
          // Convert IncomingMessage → Web Request.
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const body = chunks.length ? Buffer.concat(chunks) : undefined

          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) {
            if (Array.isArray(v)) headers.set(k, v.join(','))
            else if (v) headers.set(k, v)
          }

          const fullUrl = `http://localhost${url}`
          const webReq = new Request(fullUrl, {
            method: req.method,
            headers,
            body: body && req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
          })

          // Try both `.ts` and `.tsx` — handlers that use JSX (like
          // api/og.tsx via @vercel/og) need the .tsx extension; others
          // stay .ts. Vercel resolves both automatically in prod, so
          // dev should too.
          let mod
          let handlerPath: string
          try {
            handlerPath = `/api/${name}.ts`
            mod = await server.ssrLoadModule(handlerPath)
          } catch {
            handlerPath = `/api/${name}.tsx`
            mod = await server.ssrLoadModule(handlerPath)
          }
          const handler = mod.default
          if (typeof handler !== 'function') {
            throw new Error(`No default export from ${handlerPath}`)
          }
          const webRes: Response = await handler(webReq)

          res.statusCode = webRes.status
          webRes.headers.forEach((value, key) => res.setHeader(key, value))

          if (webRes.body) {
            const reader = webRes.body.getReader()
            const pump = async () => {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                res.write(Buffer.from(value))
              }
              res.end()
            }
            void pump()
          } else {
            res.end()
          }
        } catch (err) {
          // Surface the real error in the response so the frontend can
          // show it during development.
          const message = err instanceof Error ? err.message : 'Unknown server error'
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiPlugin()],
})
