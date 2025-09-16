const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const cfg = require('../config');
const mime = require('mime-types');
const path = require('path');
const fs = require('fs');
let useCloudinary = false;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('Only image files allowed'));
    cb(null, true);
  }
});

let useCloud = false;
if (cfg.cloudinary.cloudName && cfg.cloudinary.apiKey && cfg.cloudinary.apiSecret) {
  cloudinary.config({
    cloud_name: cfg.cloudinary.cloudName,
    api_key: cfg.cloudinary.apiKey,
    api_secret: cfg.cloudinary.apiSecret
  });
  useCloud = true;
}

async function handleUploads(files) {
  if (!files || files.length === 0) return [];
  if (useCloud) {
    const results = [];
    for (const f of files) {
      const res = await new Promise((resolve, reject) => {
        const s = cloudinary.uploader.upload_stream({ folder: 'blogs' }, (err, result) => {
          if (err) reject(err); else resolve(result);
        });
        s.end(f.buffer);
      });
      results.push({ url: res.secure_url, public_id: res.public_id });
    }
    return results;
  } else {
    const out = [];
    const base = path.join(process.cwd(), 'uploads');
    fs.mkdirSync(base, { recursive: true });
    for (const f of files) {
      const ext = mime.extension(f.mimetype) || 'bin';
      const name = `${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
      const p = path.join(base, name);
      fs.writeFileSync(p, f.buffer);
      out.push({ url: `/uploads/${name}` });
    }
    return out;
  }
}
async function deleteImage(public_id) {
  if (!public_id) return;
  if (useCloudinary) {
    try { await cloudinary.uploader.destroy(public_id); } catch {}
  }
  // التخزين المحلي: اتجاوز (لأن عندنا URL فقط)، أو ارسميه لاحقًا لو احتجتي
}

module.exports = { upload, handleUploads, deleteImage };
