import { prisma } from '../server/infrastructure/prisma.js'
import { config, normalizeSeedEmail } from '../server/infrastructure/seed-config.js'

if (config.NODE_ENV === 'production') {
  throw new Error('Refusing to seed a production environment')
}

const email = normalizeSeedEmail(config.ALLOWLIST_EMAIL)
if (!email) throw new Error('ALLOWLIST_EMAIL must be set for seeding')

await prisma.allowedEmail.upsert({ where: { email }, create: { email }, update: {} })
await prisma.$disconnect()
console.log(`Seeded allowlist email ${email}`)
