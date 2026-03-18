import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

// Import Models
import Donor from './models/Donor.js';
import Request from './models/Request.js';
import Bank from './models/Bank.js';
import Activity from './models/Activity.js';
import Notification from './models/Notification.js';
import User from './models/User.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));


// --- REST API ENDPOINTS ---

// GET: Combine all initial data to hydrate the frontend state
app.get('/api/data', async (req, res) => {
  try {
    const donors = await Donor.find().sort({ _id: -1 });
    const requests = await Request.find().sort({ _id: -1 });
    const banks = await Bank.find().sort({ _id: -1 });
    const activities = await Activity.find().sort({ _id: -1 });
    const notifications = await Notification.find().sort({ _id: -1 });
    const authUsers = await User.find();
    
    // We send back an object matching the expected local 'state' shape
    res.json({ donors, requests, banks, recentActivity: activities, notifications, authUsers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch initial data' });
  }
});

// POST: Add a new Donor
app.post('/api/donors', async (req, res) => {
  try {
    const donor = new Donor(req.body);
    await donor.save();
    res.status(201).json(donor);
  } catch (err) {
    res.status(400).json({ error: 'Invalid donor data' });
  }
});

// POST: Update a Donor Status (E.g Login)
app.put('/api/donors/:phone', async (req, res) => {
  try {
    const p = req.params.phone;
    const upd = req.body;
    await Donor.updateOne({ phone: p }, { $set: upd });
    res.json({ success: true });
  } catch(err) {
    res.status(400).json({ error: 'Failed' });
  }
});

// POST: Create a new Request
app.post('/api/requests', async (req, res) => {
  try {
    const request = new Request(req.body);
    await request.save();
    res.status(201).json(request);
  } catch (err) {
    res.status(400).json({ error: 'Invalid request data' });
  }
});

// PUT: Update Request Status (Fulfill/Cancel)
app.put('/api/requests/:id', async (req, res) => {
  try {
    const updated = await Request.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update request' });
  }
});

// POST: Register a Blood Bank
app.post('/api/banks', async (req, res) => {
  try {
    const bank = new Bank(req.body);
    await bank.save();
    res.status(201).json(bank);
  } catch (err) {
    res.status(400).json({ error: 'Invalid bank data' });
  }
});

// POST: Add Activity
app.post('/api/activity', async (req, res) => {
  try {
    const act = new Activity(req.body);
    await act.save();
    res.status(201).json(act);
  } catch(err) {
    res.status(400).json({ error: 'Failed' });
  }
});

// POST: Add Notification
app.post('/api/notifications', async (req, res) => {
  try {
    const notif = new Notification(req.body);
    await notif.save();
    res.status(201).json(notif);
  } catch(err) {
    res.status(400).json({ error: 'Failed' });
  }
});

// POST: Register User
app.post('/api/users', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch(err) {
    res.status(400).json({ error: 'Failed' });
  }
});


// Start Server
app.listen(PORT, () => {
  console.log(`🚀 RedPulse Backend running on http://localhost:${PORT}`);
});
