import { Readable } from 'node:stream'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only middleware that mimics the Vercel Edge Functions in api/, so
// `npm run dev` works without the Vercel CLI. Production deploys use the
// api/ handlers (Vercel) or server/index.ts (Render) directly.
function apiDevMiddleware(env: Record<string, string>): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      const setEnv = () => {
        process.env.GROQ_API_KEY = env.GROQ_API_KEY
        process.env.GROQ_MODEL = env.GROQ_MODEL
        process.env.GROQ_STT_MODEL = env.GROQ_STT_MODEL
      }

      server.middlewares.use('/api/interview', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        setEnv()
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')

          const { streamInterviewAnswer } = await server.ssrLoadModule('/api/_groq.ts')
          const stream = await streamInterviewAnswer(body.question)

          res.setHeader('content-type', 'text/plain; charset=utf-8')
          Readable.fromWeb(stream).pipe(res)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }))
        }
      })

      server.middlewares.use('/api/transcribe', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        setEnv()
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const audioBuffer = Buffer.concat(chunks)
          if (audioBuffer.length === 0) {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: 'Empty audio' }))
            return
          }
          const mimeType = req.headers['content-type'] || 'audio/webm'

          const { transcribeAudio } = await server.ssrLoadModule('/api/_groq.ts')
          const text = await transcribeAudio(
            audioBuffer.buffer.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength),
            mimeType,
          )

          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ text }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), apiDevMiddleware(env)],
  }
})
