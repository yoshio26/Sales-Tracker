import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cookieParser from 'cookie-parser'
import express from 'express'
import { authRouter } from './modules/auth/routes.js'
import { sessionMiddleware } from './middleware/session.js'

const app = express()
const currentDirectory = path.dirname(fileURLToPath(import.meta.url))

app.disable('x-powered-by')
app.use(express.json({ limit: '10kb' }))
app.use(cookieParser())
app.use(sessionMiddleware)

app.use('/api/auth', authRouter)

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(currentDirectory, '../../client/dist')
  app.use(express.static(clientDist))
  app.get('*splat', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))
}

app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } })
})

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Request failed', error instanceof Error ? error.message : 'unknown error')
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } })
})

export { app }
