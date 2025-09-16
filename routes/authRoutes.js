const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { validate } = require('../middlewares/validate');
const { loginLimiter } = require('../middlewares/security');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const cfg = require('../config');

const router = express.Router();

const loginSchema = z.object({ body: z.object({ email: z.string().email(), password: z.string().min(8) }) });

router.post('/login', loginLimiter(), validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  user.lastLoginAt = new Date(); await user.save();

  const payload = { sub: user.id, role: user.role, email: user.email };
  const accessToken = signAccess(payload);
  const refreshToken = signRefresh({ sub: user.id });
  await RefreshToken.create({ userId: user.id, token: refreshToken, expiresAt: new Date(Date.now() + ms(cfg.jwt.refreshTtl)) });
  res.json({ accessToken, refreshToken });
});

const refreshSchema = z.object({ body: z.object({ refreshToken: z.string().min(10) }) });

router.post('/refresh', validate(refreshSchema), async (req, res) => {
  const { refreshToken } = req.body;
  try {
    const payload = verifyRefresh(refreshToken);
    const saved = await RefreshToken.findOne({ token: refreshToken, userId: payload.sub, revokedAt: { $exists: false } });
    if (!saved) return res.status(401).json({ error: 'Invalid refresh token' });
    await RefreshToken.deleteOne({ _id: saved._id }); // rotate
    const accessToken = signAccess({ sub: payload.sub, role: 'admin' });
    const newRefresh = signRefresh({ sub: payload.sub });
    await RefreshToken.create({ userId: payload.sub, token: newRefresh, expiresAt: new Date(Date.now() + ms(cfg.jwt.refreshTtl)) });
    res.json({ accessToken, refreshToken: newRefresh });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', validate(refreshSchema), async (req, res) => {
  await RefreshToken.deleteOne({ token: req.body.refreshToken });
  res.json({ ok: true });
});

// parse TTLs like "15m"/"7d"
function ms(s) {
  const m = String(s).match(/^(\d+)(ms|s|m|h|d)$/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const mult = { ms:1, s:1000, m:60000, h:3600000, d:86400000 }[m[2]];
  return n * mult;
}

module.exports = router;
