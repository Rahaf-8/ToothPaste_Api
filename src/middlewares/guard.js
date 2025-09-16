
function scan(obj, path = []) {
  if (obj == null) return;
  if (Array.isArray(obj)) return obj.forEach((v, i) => scan(v, path.concat(String(i))));
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      if (k.startsWith('$') || k.includes('.') || k === '__proto__' || k === 'constructor') {
        const p = path.concat(k).join('.');
        throw Object.assign(new Error(`Illegal key in input: ${p}`), { status: 400 });
      }
      scan(obj[k], path.concat(k));
    }
  }
}

function guardKeys(req, _res, next) {
  try {
    scan(req.body); scan(req.query); scan(req.params);
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { guardKeys };
