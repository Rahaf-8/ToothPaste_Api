const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  public_id: { type: String } // لو Cloudinary
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  slug: { type: String, required: true, unique: true, index: true },
  images: { type: [imageSchema], default: [] },
  description: { type: String, required: true, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
