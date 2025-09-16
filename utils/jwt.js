const jwt = require('jsonwebtoken');
const cfg = require('../config');

function signAccess(payload) {
  return jwt.sign(payload, cfg.jwt.accessSecret, { expiresIn: cfg.jwt.accessTtl });
}
function signRefresh(payload) {
  return jwt.sign(payload, cfg.jwt.refreshSecret, { expiresIn: cfg.jwt.refreshTtl });
}
function verifyAccess(token) {
  return jwt.verify(token, cfg.jwt.accessSecret);
}
function verifyRefresh(token) {
  return jwt.verify(token, cfg.jwt.refreshSecret);
}
module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
