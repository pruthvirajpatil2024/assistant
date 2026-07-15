import path from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { streamInterviewAnswer, transcribeAudio } from '../api/_groq'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')

const app = express()
app.use(express.json())

app.post('/api/interview', async (req, res) => {
  try {
    const question = req.body?.question
    if (typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ error: 'Missing question' })
      return
    }
    const stream = await streamInterviewAnswer(question)
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    Readable.fromWeb(stream as import('node:stream/web').ReadableStream<Uint8Array>).pipe(res)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

app.post(
  '/api/transcribe',
  express.raw({ type: '*/*', limit: '25mb' }),
  async (req, res) => {
    try {
      const buffer = req.body as Buffer
      if (!buffer || buffer.length === 0) {
        res.status(400).json({ error: 'Empty audio' })
        return
      }
      const mimeType = req.headers['content-type'] || 'audio/webm'
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      const text = await transcribeAudio(arrayBuffer, mimeType)
      res.json({ text })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
    }
  },
)

app.use(express.static(distDir))

// SPA fallback — anything not matched above serves index.html.
app.use((req, res) => {
  if (req.method !== 'GET') {
    res.status(404).end()
    return
  }
  res.sendFile(path.join(distDir, 'index.html'))
})

const port = Number(process.env.PORT) || 3000
app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
