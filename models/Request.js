import mongoose from 'mongoose';

const requestSchema = new mongoose.Schema({
  id: { type: String, required: true },
  blood: { type: String, required: true },
  units: { type: Number, required: true },
  hospital: { type: String, required: true },
  urgency: { type: String, required: true }, // emergency, urgent, planned
  status: { type: String, default: 'pending' }, // pending, fulfilled, rejected
  distance: { type: Number, default: 0 },
  time: { type: String, required: true },
  component: { type: String, default: 'Whole Blood' }
}, { strict: false });

export default mongoose.model('Request', requestSchema);
