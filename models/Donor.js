import mongoose from 'mongoose';

const donorSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  blood: { type: String, required: true },
  distance: { type: Number, default: 0 },
  city: { type: String, required: true },
  status: { type: String, default: 'available' },
  verified: { type: Boolean, default: true },
  lastDonation: { type: String },
  phone: { type: String },
  pwd: { type: String },
  available: { type: Boolean, default: true }
}, { strict: false });

export default mongoose.model('Donor', donorSchema);
