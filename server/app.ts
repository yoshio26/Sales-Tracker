import { randomUUID } from 'node:crypto'
import path from 'node:path'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { config } from './infrastructure/config.js'
import { logError } from './infrastructure/logger.js'
import { authRouter } from './modules/auth/routes.js'
import { productsRouter } from './modules/products/routes.js'
import { expensesRouter } from './modules/expenses/routes.js'
import { dashboardRouter } from './modules/dashboard/routes.js'
import { stockRouter } from './modules/stock/routes.js'
import { notesRouter } from './modules/notes/routes.js'
import { sessionMiddleware } from './middleware/session.js'

const app = express()

app.disable('x-powered-by')
app.set('trust proxy', config.NODE_ENV === 'production' ? 1 : 0)
app.use(helmet())
app.use(cors({ origin: config.APP_ORIGIN, credentials: true }))
app.use((req, res, next) => {
  req.requestId = req.get('x-request-id') || randomUUID()
  res.setHeader('x-request-id', req.requestId)
  next()
})
app.use(express.json({ limit: '10kb' }))
app.use(cookieParser())
app.get('/healthz', (_req, res) => res.json({ status: 'ok' }))
app.use(sessionMiddleware)

app.use('/api/auth', authRouter)
app.use('/api/products', productsRouter)
app.use('/api/expenses', expensesRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/stock', stockRouter)
app.use('/api/notes', notesRouter)

if (config.NODE_ENV === 'production') {
  const clientDist = path.resolve(process.cwd(), 'FrontEnd/dist')
  app.use(express.static(clientDist))
  app.get('*splat', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))
}

app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } })
})

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logError('request_failed', error, { requestId: req.requestId })
  if (res.headersSent) return next(error)
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } })
})

export { app }
