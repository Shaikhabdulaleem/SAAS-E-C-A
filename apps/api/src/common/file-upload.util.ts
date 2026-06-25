import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const UPLOADS_ROOT = path.resolve(process.cwd(), '..', '..', 'uploads');

function ensureDir(category: string): string {
  const dir = path.join(UPLOADS_ROOT, category);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveUploadedFile(file: Express.Multer.File, category: string): string {
  const ext = path.extname(file.originalname).toLowerCase() || '.bin';
  const filename = `${randomUUID()}${ext}`;
  const dir = ensureDir(category);
  fs.writeFileSync(path.join(dir, filename), file.buffer);
  return `/uploads/${category}/${filename}`;
}

export function deleteUploadedFile(relativePath: string | null | undefined): void {
  if (!relativePath || !relativePath.startsWith('/uploads/')) return;
  try {
    const resolved = path.resolve(UPLOADS_ROOT, relativePath.replace(/^\/uploads\//, ''));
    if (resolved.startsWith(UPLOADS_ROOT) && fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
    }
  } catch {}
}

function fileFilter(allowed: RegExp) {
  return (_req: any, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  };
}

export function imageUploadOptions(): MulterOptions {
  return {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter(/^\.(png|jpe?g|gif|webp|svg)$/),
  };
}

export function documentUploadOptions(): MulterOptions {
  return {
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: fileFilter(/^\.(pdf|docx?)$/),
  };
}

export function recordingUploadOptions(): MulterOptions {
  return {
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: fileFilter(/^\.(mp3|mp4|wav|webm|ogg|m4a)$/),
  };
}
