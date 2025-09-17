module.exports = function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()

    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
};
