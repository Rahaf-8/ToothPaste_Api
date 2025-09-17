const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const morgan = require('morgan');
const { sanitizeObject } = require('../utils/sanitize');
const cfg = require('../config');
const { guardKeys } = require('./guard');

function buildCors() {
  const allowed = cfg.corsAllowed;
  const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
  return cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      const ok = allowed.some(a => origin.startsWith(a)) || localhostRegex.test(origin);
      return ok ? cb(null, true) : cb(new Error('CORS blocked'));
    },
    credentials: false,
    methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization']
  });
}

function security(app) {
  app.set('trust proxy', 1);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-site' }
  }));
  if (process.env.NODE_ENV === 'production') {
    app.use(helmet.hsts({ maxAge: 15552000 })); 
  }

  app.use(compression());
  app.use(buildCors());
  app.use(hpp());
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  
  const { sanitizeObject } = require('../utils/sanitize');
  app.use((req, _res, next) => { if (req.body) req.body = sanitizeObject(req.body); next(); });
  app.use(guardKeys);

  app.use(rateLimit({ windowMs: 15*60*1000, max: 1000, standardHeaders: true, legacyHeaders: false }));
}

function loginLimiter() {
  return rateLimit({
    windowMs: 15*60*1000, max: 5,
    message: { error: 'Too many login attempts, try again later.' },
    standardHeaders: true, legacyHeaders: false
  });
}

function adminLimiter() {
  return rateLimit({
    windowMs: 15*60*1000, max: 200, 
    standardHeaders: true, legacyHeaders: false
  });
}module.exports = { security, loginLimiter, adminLimiter };
