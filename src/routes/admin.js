const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const { authRequired, adminOnly } = require('../middlewares/auth');
const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');

const router = express.Router();

// تشخيص سريع (ممكن تمسحيه بعد ما تتأكدي)
router.get('/__ping', (_req, res) => res.json({ ok: true, base: '/api/admin' }));

// حمي كل مسارات الأدمن مرة واحدة
router.use(authRequired, adminOnly);

// GET /api/admin/me
router.get('/me', async (req, res) => {
  const u = await User.findById(req.user.sub)
    .select('email role createdAt updatedAt')
    .lean();
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(u);
});

// PATCH /api/admin/email
router.patch('/email', async (req, res) => {
  const schema = z.object({
    currentPassword: z.string().min(8),
    newEmail: z.string().email()
  });
  const { currentPassword, newEmail } = schema.parse(req.body);

  const user = await User.findById(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Wrong password' });

  if (await User.exists({ email: newEmail })) {
    return res.status(409).json({ error: 'Email already in use' });
  }

  user.email = newEmail;
  await user.save();

  await RefreshToken.deleteMany({ userId: user._id }); // إجبار إعادة تسجيل الدخول
  res.json({ ok: true, message: 'Email updated. Please login again.' });
});

// PATCH /api/admin/password
router.patch('/password', async (req, res) => {
  const schema = z.object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8)
  });
  const { currentPassword, newPassword } = schema.parse(req.body);

  const user = await User.findById(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Wrong password' });

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();

  await RefreshToken.deleteMany({ userId: user._id });
  res.json({ ok: true, message: 'Password updated. Please login again.' });
});

module.exports = router;
