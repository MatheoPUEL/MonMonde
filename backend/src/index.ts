import 'dotenv/config'
import app from './app'
import { backfillCovers } from './lib/coverBackfill'

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  backfillCovers().catch(err => console.error('Cover backfill failed', err))
})
