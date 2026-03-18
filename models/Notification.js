import mongoose from 'mongoose';

const notifSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true }, // emergency, info, success
  icon: { type: String },
  title: { type: String, required: true },
  message: { type: String, required: true },
  time: { type: String, required: true },
  read: { type: Boolean, default: false }
});

export default mongoose.model('Notification', notifSchema);
