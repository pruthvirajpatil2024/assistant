import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { getInterviewAnswer } from '../api/_groq'

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
    const answer = await getInterviewAnswer(question)
    res.json({ answer })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

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
