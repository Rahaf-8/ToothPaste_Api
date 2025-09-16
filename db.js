const mongoose = require('mongoose');
mongoose.set('strictQuery', true);

async function connect(uri) {
  await mongoose.connect(uri, { maxPoolSize: 10 });
  mongoose.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_, ret) => { delete ret._id; }
  });
  return mongoose;
}
module.exports = { connect };
