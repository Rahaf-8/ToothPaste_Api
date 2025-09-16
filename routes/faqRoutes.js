const express = require('express');
const { z } = require('zod');
const { validate } = require('../middlewares/validate');
const { authRequired, adminOnly } = require('../middlewares/auth');
const FAQ = require('../models/FAQ');

const router = express.Router();

router.get('/', async (_req, res) => {
  const items = await FAQ.find().sort({ createdAt: -1 });
  res.json(items);
});

const schema = z.object({ body: z.object({
  question: z.string().min(3).max(300),
  answer: z.string().min(3).max(5000)
}) });

router.post('/', authRequired, adminOnly, validate(schema), async (req, res) => {
  const item = await FAQ.create({ question: req.body.question, answer: req.body.answer });
  res.status(201).json(item);
});
router.put('/:id', authRequired, adminOnly, validate(schema), async (req, res) => {
  const item = await FAQ.findByIdAndUpdate(req.params.id, { question: req.body.question, answer: req.body.answer }, { new: true });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  const r = await FAQ.findByIdAndDelete(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
