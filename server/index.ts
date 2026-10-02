import { app } from './app.js'
import { config } from './infrastructure/config.js'
import { disconnectDatabase, prisma } from './infrastructure/prisma.js'
import { deleteExpiredAuthRecords } from './modules/auth/data-access.js'
import { purgeExpiredDeletedStockData } from './modules/stock/data-access.js'

const cleanup = async () => {
  await deleteExpiredAuthRecords(prisma, new Date())
  await purgeExpiredDeletedStockData(prisma)
}
const server = app.listen(config.PORT, () => {
  console.log(`Sales Tracker listening on port ${config.PORT}`)
})
const cleanupTimer = setInterval(() => {
  void cleanup().catch((error) => console.error(JSON.stringify({ level: 'error', event: 'auth_cleanup_failed', error: error instanceof Error ? error.message : String(error) })))
}, config.AUTH_CLEANUP_INTERVAL_MS)
cleanupTimer.unref()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    clearInterval(cleanupTimer)
    server.close(() => void disconnectDatabase().finally(() => process.exit(0)))
  })
}
