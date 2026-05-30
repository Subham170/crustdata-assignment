import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';
import { badRequest } from './errorHandler.js';

const uploadDir = path.resolve(env.UPLOAD_DIR);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, _file, cb) => {
    cb(null, `${randomUUID()}.pdf`);
  },
});

const resumeUpload = multer({
  storage,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
      return;
    }
    cb(badRequest('Only PDF files are allowed'));
  },
});

export function handleResumeUpload(req, res, next) {
  resumeUpload.single('resume')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(badRequest(`File size exceeds ${env.MAX_FILE_SIZE_MB}MB limit`));
      }
      if (err.code === 'MISSING_FIELD_NAME') {
        return next(
          badRequest('Form field name is missing. In Postman, set the Key to "resume" (type: File).')
        );
      }
      if (err.name === 'MulterError') {
        return next(badRequest(err.message));
      }
      return next(err);
    }

    if (!req.file) {
      return next(
        badRequest(
          'Resume PDF file is required. Use form-data with Key = "resume" and Type = File.'
        )
      );
    }

    return next();
  });
}

export function getResumeRelativePath(filename) {
  const dirName = path.basename(uploadDir);
  return `${dirName}/${filename}`.replace(/\\/g, '/');
}

export function getResumeAbsolutePath(relativePath) {
  return path.resolve(relativePath);
}
