const express = require('express');
const { z } = require('zod');
const mongoose = require('mongoose');
const { authRequired, adminOnly } = require('../middlewares/auth');
const { adminLimiter } = require('../middlewares/security');
const { upload, handleUploads, deleteImage } = require('../utils/uploader');
const slugify = require('../utils/slug');
const Blog = require('../models/Blog');

const router = express.Router();
function isObjectId(s) { return mongoose.Types.ObjectId.isValid(s); }

// ======= Public: list (عناوين/غلاف) + detail =======
router.get('/', async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
  const items = await Blog.find()
    .select('title slug images publishedAt')
    .sort({ publishedAt: -1 })
    .skip((page-1)*limit)
    .limit(limit)
    .lean();

  const data = items.map(x => ({
    _id: x._id, title: x.title, slug: x.slug,
    coverImage: x.images?.[0]?.url || null,
    publishedAt: x.publishedAt
  }));
  res.json({ page, limit, items: data });
});

router.get('/:slugOrId', async (req, res) => {
  const s = req.params.slugOrId;
  const doc = isObjectId(s) ? await Blog.findById(s).lean() : await Blog.findOne({ slug: s }).lean();
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(doc);
});

// ======= Admin: create/update/delete =======
const createSchema = z.object({ body: z.object({ title: z.string().min(3).max(200), body: z.string().min(10) }) });

router.post('/',
  authRequired, adminOnly, adminLimiter(),
  upload.array('images', 10),
  async (req, res) => {
    try {
      createSchema.parse({ body: req.body });
      let slug = slugify(req.body.title);
      if (!slug) slug = `b-${Date.now().toString(36)}`;
      if (await Blog.exists({ slug })) slug += '-' + Math.random().toString(36).slice(2,6);
      const images = await handleUploads(req.files || []);
      const item = await Blog.create({ title: req.body.title, slug, body: req.body.body, images });
      res.status(201).json(item);
    } catch (e) {
      res.status(400).json({ error: e.message || 'Invalid input' });
    }
  }
);

const updateSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(200).optional(),
    body: z.string().min(10).optional(),
    removePublicIds: z.string().optional()
  })
});

router.put('/:id',
  authRequired, adminOnly, adminLimiter(),
  upload.array('images', 10),
  async (req, res) => {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    try {
      updateSchema.parse({ body: req.body });
      const doc = await Blog.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Not found' });

      if (typeof req.body.title === 'string' && req.body.title !== doc.title) {
        doc.title = req.body.title;
        let newSlug = slugify(doc.title) || doc.slug;
        if (newSlug !== doc.slug && await Blog.exists({ slug: newSlug })) {
          newSlug += '-' + Math.random().toString(36).slice(2,6);
        }
        doc.slug = newSlug;
      }
      if (typeof req.body.body === 'string') doc.body = req.body.body;

      if (req.files?.length) {
        const added = await handleUploads(req.files);
        doc.images.push(...added);
      }
      if (req.body.removePublicIds) {
        const ids = req.body.removePublicIds.split(',').map(s => s.trim()).filter(Boolean);
        if (ids.length) {
          doc.images = doc.images.filter(img => {
            const del = img.public_id && ids.includes(img.public_id);
            if (del) deleteImage(img.public_id);
            return !del;
          });
        }
      }

      await doc.save();
      res.json(doc);
    } catch (e) {
      res.status(400).json({ error: e.message || 'Invalid input' });
    }
  }
);

router.delete('/:id',
  authRequired, adminOnly, adminLimiter(),
  async (req, res) => {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const doc = await Blog.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    for (const img of (doc.images || [])) { if (img.public_id) await deleteImage(img.public_id); }
    await doc.deleteOne();
    res.json({ ok: true });
  }
);

module.exports = router;
