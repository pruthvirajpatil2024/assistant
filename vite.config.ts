import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only middleware that mimics the Vercel Edge Function at api/interview.ts,
// so `npm run dev` works without the Vercel CLI. Production deploys use api/interview.ts directly.
function interviewApiDevMiddleware(env: Record<string, string>): Plugin {
  return {
    name: 'interview-api-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/interview', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        process.env.GROQ_API_KEY = env.GROQ_API_KEY
        process.env.GROQ_MODEL = env.GROQ_MODEL

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')

          const { getInterviewAnswer } = await server.ssrLoadModule('/api/_groq.ts')
          const answer = await getInterviewAnswer(body.question)

          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ answer }))
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
    plugins: [react(), interviewApiDevMiddleware(env)],
  }
})
