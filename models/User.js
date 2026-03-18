import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  pwd: { type: String, required: true }
});

export default mongoose.model('User', userSchema);
