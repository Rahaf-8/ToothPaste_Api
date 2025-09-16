function validate(zodSchema) {
  return (req, res, next) => {
    try {
      const parsed = zodSchema.parse({ body: req.body, params: req.params, query: req.query });
      req.validated = parsed;
      next();
    } catch (e) {
      const issues = e.errors?.map(x => ({ path: x.path.join('.'), message: x.message })) || [{ message: 'Invalid input' }];
      res.status(400).json({ error: 'Validation failed', issues });
    }
  };
}
module.exports = { validate };
