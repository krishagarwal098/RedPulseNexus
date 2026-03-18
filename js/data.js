// ═══════════════════════════════════════════════════════
//  RedPulse Nexus — Constants & localStorage Persistence
//  All user data is DYNAMIC — loaded from localStorage
// ═══════════════════════════════════════════════════════

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Blood banks — only real registered ones are loaded from localStorage
const BLOOD_BANKS = []; // empty by default; populated only via blood bank registration

// ─── localStorage helpers ─────────────────────────────
function loadData(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveData(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ─── Dynamic state (persisted) ────────────────────────
// Donors: only those registered through the form
// Requests: only those submitted through the form
// Notifications: generated from actions
// ActivityFeed: generated from actions
