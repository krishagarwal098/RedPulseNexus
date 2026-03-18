import mongoose from 'mongoose';

const bankSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true }, // bloodBank, hospital
  city: { type: String, required: false },
  distance: { type: String, default: 'Unknown' },
  bloods: [{ type: String }],
  phone: { type: String }
}, { strict: false });

export default mongoose.model('Bank', bankSchema);
