const xss = require('xss');

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return xss(str, {
    whiteList: {
      a: ['href','title','target','rel'],
      b: [], i: [], em: [], strong: [], u: [], p: [], br: [],
      ul: [], ol: [], li: [],
      h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
      img: ['src','alt'], blockquote: [], code: [], pre: []
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script','style','iframe']
  });
}

function sanitizeObject(obj) {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = sanitizeObject(obj[k]);
    return out;
  }
  return sanitizeString(obj);
}
module.exports = { sanitizeObject };
