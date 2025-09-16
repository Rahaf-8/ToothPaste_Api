const jwt = require('jsonwebtoken');
const cfg = require('../config');

function getToken(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function authRequired(req, res, next) {
  const t = getToken(req);
  if (!t) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(t, cfg.jwt.accessSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function normalizeIp(ip = '') {
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return '127.0.0.1';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}
function isIpAllowed(req) {
  const raw = process.env.ADMIN_IP_ALLOWLIST || '';
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (list.length === 0) return true; // فاضي = اسمح بكل IP (dev/Render)

  const candidates = [normalizeIp(req.ip), ...(req.ips || []).map(normalizeIp)];
  return candidates.some(ip => list.some(pfx => ip.startsWith(pfx)));
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!isIpAllowed(req)) {
    return res.status(403).json({ error: 'Admin IP not allowed' });
  }
  next();
}

module.exports = { authRequired, adminOnly };
