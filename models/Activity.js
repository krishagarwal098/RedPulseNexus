import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  id: { type: String, required: true },
  icon: { type: String },
  text: { type: String, required: true },
  time: { type: String, required: true }
});

export default mongoose.model('Activity', activitySchema);
