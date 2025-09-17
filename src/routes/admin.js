const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const { authRequired, adminOnly } = require('../middlewares/auth');
const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');

const router = express.Router();


router.get('/__ping', (_req, res) => res.json({ ok: true, base: '/api/admin' }));


router.use(authRequired, adminOnly);


router.get('/me', async (req, res) => {
  const u = await User.findById(req.user.sub)
    .select('email role createdAt updatedAt')
    .lean();
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(u);
});


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

  await RefreshToken.deleteMany({ userId: user._id }); 
  res.json({ ok: true, message: 'Email updated. Please login again.' });
});


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
