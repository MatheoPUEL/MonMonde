import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import authRouter from './routes/auth'
import modulesRouter from './routes/modules'
import shortcutsRouter from './routes/shortcuts'
import readingRouter from './routes/reading'
import journalRouter from './routes/journal'
import routinesRouter from './routes/routines'
import citationsRouter from './routes/citations'
import exportRouter from './routes/export'
import importRouter from './routes/import'

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

// Serve uploaded files statically
const uploadsDir = process.env.UPLOADS_DIR
  ? path.dirname(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
app.use('/uploads', express.static(uploadsDir))

app.use('/api/auth', authRouter)
app.use('/api/modules', modulesRouter)
app.use('/api/shortcuts', shortcutsRouter)
app.use('/api/reading', readingRouter)
app.use('/api/journal', journalRouter)
app.use('/api/routines', routinesRouter)
app.use('/api/citations', citationsRouter)
app.use('/api/export', exportRouter)
app.use('/api/import', importRouter)

// Global error handler — catches errors forwarded via next(err)
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

export default app
