import { app } from './app.js'
import { config } from './infrastructure/config.js'

app.listen(config.PORT, () => {
  console.log(`Sales Tracker listening on port ${config.PORT}`)
})
