const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const cfg = require('../config');
const mime = require('mime-types');
const path = require('path');
const fs = require('fs');


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 }, 
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('Only image files allowed'));
    cb(null, true);
  }
});


const cloudEnabled = Boolean(
  cfg.cloudinary?.cloudName && cfg.cloudinary?.apiKey && cfg.cloudinary?.apiSecret
);

if (cloudEnabled) {
  cloudinary.config({
    cloud_name: cfg.cloudinary.cloudName,
    api_key: cfg.cloudinary.apiKey,
    api_secret: cfg.cloudinary.apiSecret
  });
}


function buildFolderPath(subfolder) {
  const base = cfg.cloudinary?.folder || process.env.CLOUDINARY_FOLDER || ''; 
  return [base, subfolder].filter(Boolean).join('/');
}


function uploadBufferToCloudinary(buffer, { folder } = {}) {
  if (!cloudEnabled) throw new Error('Cloudinary not configured');
  const folderPath = buildFolderPath(folder);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: folderPath || undefined, resource_type: 'image' },
      (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });
}


function ensureLocalUploadsDir() {
  const dir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}


async function handleUploads(files = [], opts = {}) {
  if (!files.length) return [];

  if (cloudEnabled) {
    const results = [];
    for (const f of files) {
      const { url, public_id } = await uploadBufferToCloudinary(f.buffer, { folder: opts.folder });
      results.push({ url, public_id });
    }
    return results;
  }


  const out = [];
  const base = ensureLocalUploadsDir();
  for (const f of files) {
    const ext = mime.extension(f.mimetype) || 'bin';
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    fs.writeFileSync(path.join(base, name), f.buffer);
    out.push({ url: `/uploads/${name}` });
  }
  return out;
}

// حذف صورة من Cloudinary عند وجود public_id
async function deleteImage(public_id) {
  if (!public_id) return;
  if (!cloudEnabled) return;
  try { await cloudinary.uploader.destroy(public_id); } catch (_) {}
}

module.exports = { upload, handleUploads, deleteImage };
