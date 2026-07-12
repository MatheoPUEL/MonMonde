import multer from 'multer'
import path from 'path'
import fs from 'fs'

const COVERS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads', 'covers')
export const AVATARS_DIR = path.join(
  process.env.UPLOADS_DIR ? path.dirname(process.env.UPLOADS_DIR) : path.join(process.cwd(), 'uploads'),
  'avatars'
)

for (const dir of [COVERS_DIR, AVATARS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

const imageFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'))
  }
}

export const uploadCover = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, COVERS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
})

export const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATARS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      const userId = (req as Express.Request).user?.id ?? 'unknown'
      cb(null, `${userId}${ext}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
})

export const UPLOADS_BASE = process.env.UPLOADS_DIR
  ? path.dirname(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), 'uploads')
