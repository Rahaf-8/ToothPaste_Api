const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { loginLimiter } = require('../middlewares/security');
const cfg = require('../config');

const router = express.Router();


function ms(s) {
  const m = String(s).match(/^(\d+)(ms|s|m|h|d)$/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const mult = { ms:1, s:1000, m:60000, h:3600000, d:86400000 }[m[2]];
  return n * mult;
}


router.post('/login', loginLimiter(), async (req, res) => {
  try {
    const body = z.object({
      email: z.string().email(),
      password: z.string().min(8)
    }).parse(req.body);

    const user = await User.findOne({ email: body.email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    user.lastLoginAt = new Date();
    await user.save();

    const payload = { sub: user.id, role: user.role, email: user.email };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh({ sub: user.id });

    await RefreshToken.create({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + ms(cfg.jwt.refreshTtl))
    });

    res.json({ accessToken, refreshToken });
  } catch (e) {
    res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid input' });
  }
});

router.post('/refresh', async (req, res) => {
  const body = z.object({ refreshToken: z.string().min(10) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid input' });

  try {
    const payload = verifyRefresh(body.data.refreshToken);
    const saved = await RefreshToken.findOne({ token: body.data.refreshToken, userId: payload.sub, revokedAt: { $exists: false } });
    if (!saved) return res.status(401).json({ error: 'Invalid refresh token' });

    await RefreshToken.deleteOne({ _id: saved._id }); // rotate
    const accessToken = signAccess({ sub: payload.sub, role: 'admin' });
    const newRefresh = signRefresh({ sub: payload.sub });

    await RefreshToken.create({
      userId: payload.sub,
      token: newRefresh,
      expiresAt: new Date(Date.now() + ms(cfg.jwt.refreshTtl))
    });

    res.json({ accessToken, refreshToken: newRefresh });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});


router.post('/logout', async (req, res) => {
  const body = z.object({ refreshToken: z.string().min(10) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid input' });

  await RefreshToken.deleteOne({ token: body.data.refreshToken });
  res.json({ ok: true });
});

module.exports = router;
