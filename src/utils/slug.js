module.exports = function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    // اسمح بحروف عربية + أرقام + لاتيني، وحوّل الباقي لفواصل -
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
};
