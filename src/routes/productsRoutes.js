const express = require('express');
const { z } = require('zod');
const mongoose = require('mongoose');
const { validate } = require('../middlewares/validate');
const { authRequired, adminOnly } = require('../middlewares/auth');
const { adminLimiter } = require('../middlewares/security');
const { upload, handleUploads, deleteImage } = require('../utils/uploader');
const slugify = require('../utils/slug');
const Product = require('../models/Product');

const router = express.Router();

function isObjectId(s) { return mongoose.Types.ObjectId.isValid(s); }


router.get('/', async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(parseInt(req.query.limit || '12', 10), 50);
  const search = (req.query.search || '').trim();
  const filter = search ? { name: { $regex: search, $options: 'i' } } : {};
  const items = await Product.find(filter)
    .select('name slug images createdAt')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();


  const data = items.map(x => ({
    _id: x._id, name: x.name, slug: x.slug,
    coverImage: x.images?.[0]?.url || null,
    createdAt: x.createdAt
  }));
  res.json({ page, limit, items: data });
});

router.get('/:slugOrId', async (req, res) => {
  const s = req.params.slugOrId;
  const doc = isObjectId(s)
    ? await Product.findById(s).lean()
    : await Product.findOne({ slug: s }).lean();
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(doc);
});



const createSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120),
    description: z.string().min(5).max(5000)
  })
});

router.post('/',
  authRequired, adminOnly, adminLimiter(),
  upload.array('images', 10),
  async (req, res) => {
    try {
      createSchema.parse({ body: req.body });
      let slug = slugify(req.body.name);
      if (!slug) slug = `p-${Date.now().toString(36)}`;
    
      if (await Product.exists({ slug })) slug += '-' + Math.random().toString(36).slice(2,6);

     const images = await handleUploads(req.files || [], { folder: 'products' });

      const p = await Product.create({
        name: req.body.name,
        slug,
        description: req.body.description,
        images
      });
      res.status(201).json(p);
    } catch (e) {
      res.status(400).json({ error: e.message || 'Invalid input' });
    }
  }
);

const updateSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().min(5).max(5000).optional(),
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
      const doc = await Product.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Not found' });

      if (typeof req.body.name === 'string' && req.body.name !== doc.name) {
        doc.name = req.body.name;
        let newSlug = slugify(doc.name) || doc.slug;
        if (newSlug !== doc.slug && await Product.exists({ slug: newSlug })) {
          newSlug += '-' + Math.random().toString(36).slice(2,6);
        }
        doc.slug = newSlug;
      }
      if (typeof req.body.description === 'string') doc.description = req.body.description;

      if (req.files?.length) {
       const added = await handleUploads(req.files, { folder: 'products' });

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
    const doc = await Product.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
   
    for (const img of (doc.images || [])) { if (img.public_id) await deleteImage(img.public_id); }
    await doc.deleteOne();
    res.json({ ok: true });
  }
);

module.exports = router;
