const express = require('express');
const path = require('path');

const cfg = require('./config');
const { connect } = require('./db');
const { security } = require('./middlewares/security');

const bcrypt = require('bcryptjs');
const User = require('./models/User');

// Routers
const adminRoutes   = require('./routes/admin');
const authRoutes    = require('./routes/authRoutes');
const productRoutes = require('./routes/productsRoutes');
const blogRoutes    = require('./routes/blogsRoutes');
const faqRoutes     = require('./routes/faqRoutes');

async function bootstrapAdmin() {
  const count = await User.countDocuments();
  if (count === 0 && cfg.adminBootstrap.email && cfg.adminBootstrap.password) {
    const hash = await bcrypt.hash(cfg.adminBootstrap.password, 12);
    await User.create({ email: cfg.adminBootstrap.email, passwordHash: hash, role: 'admin' });
    console.log(`[Bootstrap] Admin created: ${cfg.adminBootstrap.email}`);
  }
}

async function main() {
  await connect(cfg.mongoUri);
  await bootstrapAdmin();

  const app = express();


  app.set('trust proxy', true);

  // parsers
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

 
  security(app);

  
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  
  app.get('/healthz', (_req, res) => res.json({ ok: true, env: cfg.env }));


  app.use('/api/admin',    adminRoutes);
  app.use('/api/auth',     authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/blogs',    blogRoutes);
  app.use('/api/faqs',     faqRoutes);


 
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

 
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  const port = process.env.PORT || cfg.port || 8080;
  app.listen(port, () => console.log(`Server on :${port}`));
}

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
