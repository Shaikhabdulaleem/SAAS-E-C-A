import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { logger } from './logger';

const UPLOADS_ROOT = path.resolve(process.cwd(), '..', '..', 'uploads');

function ensureDir(category: string): string {
  const dir = path.join(UPLOADS_ROOT, category);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function uploadToS3(buffer: Buffer, key: string, contentType: string): Promise<string> {
  const bucket = process.env.S3_UPLOAD_BUCKET;
  const region = process.env.AWS_REGION ?? 'us-east-1';
  const endpoint = process.env.S3_ENDPOINT;

  if (!bucket) throw new Error('S3_UPLOAD_BUCKET not configured');

  const baseUrl = endpoint ?? `https://s3.${region}.amazonaws.com`;
  const url = `${baseUrl}/${bucket}/${key}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
    },
    body: buffer as unknown as BodyInit,
  });

  if (!response.ok) throw new Error(`S3 upload failed: ${response.status}`);
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export async function saveUploadedFile(file: Express.Multer.File, category: string): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase() || '.bin';
  const filename = `${randomUUID()}${ext}`;

  if (process.env.S3_UPLOAD_BUCKET) {
    try {
      const key = `${category}/${filename}`;
      const publicUrl = await uploadToS3(file.buffer, key, file.mimetype);
      logger.info('file_uploaded_s3', { key, size: file.size });
      return publicUrl;
    } catch (error) {
      logger.error('s3_upload_failed', { error: error instanceof Error ? error.message : String(error) });
    }
  }

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
