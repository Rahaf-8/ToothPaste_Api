const { verifyAccess } = require('../utils/jwt');
const cfg = require('../config');

function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing Authorization: Bearer token' });
  try {
    req.user = verifyAccess(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const allowed = cfg.adminBootstrap.ipAllowlist || [];
  if (allowed.length > 0) {
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
    const ok = allowed.some(prefix => ip.startsWith(prefix));
    if (!ok) return res.status(403).json({ error: 'Admin IP not allowed' });
  }
  next();
}
module.exports = { authRequired, adminOnly };
