// ═══════════════════════════════════════════════════════
//  RedPulse Nexus — Main App Logic (Fully Dynamic)
//  Data persists via localStorage. Nothing is pre-seeded.
// ═══════════════════════════════════════════════════════

/* ─── STATE — loaded from MongoDB ─── */
let state = {
  authUsers:     [],
  donors:        [],
  requests:      [],
  notifications: [],
  activityFeed:  [],
  banks:         [],
  currentUrgency:'emergency',
  currentSection:'home',
  bannerVisible: false,
  notifPanelOpen:false,
  currentUserId: localStorage.getItem('bl_currentUser'),
  currentBankId: localStorage.getItem('bl_currentBank'),
};

const API_BASE = 'http://localhost:5000/api';

/* ─── SAVE helpers ─── */
// Persists local session only. DB updates happen explicitly via REST.
function persist() {
  localStorage.setItem('bl_currentUser', state.currentUserId || '');
  localStorage.setItem('bl_currentBank', state.currentBankId || '');
}

async function loadMongoData() {
  try {
    const res = await fetch(`${API_BASE}/data`);
    if(res.ok) {
      const db = await res.json();
      state.donors = db.donors || [];
      state.requests = db.requests || [];
      state.banks = db.banks || [];
      state.activityFeed = db.recentActivity || [];
      state.notifications = db.notifications || [];
      state.authUsers = db.authUsers || [];
    }
  } catch(e) { console.error('MongoDB load error:', e); }
}

/* ─── UTILS ─── */
const $ = id => document.getElementById(id);
const uid = prefix => prefix + Math.random().toString(36).substr(2,6).toUpperCase();
const timeAgo = () => 'just now';

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${type==='success'?'✅':type==='error'?'❌':'ℹ️'}</span> ${msg}`;
  $('toast-container').appendChild(t);
  setTimeout(() => { t.style.animation = 'toastOut 0.3s ease forwards'; setTimeout(() => t.remove(), 300); }, 3500);
}

function emptyState(msg, icon = '📭') {
  return `<div style="text-align:center;padding:48px 24px;color:var(--text2)">
    <div style="font-size:3rem;margin-bottom:12px">${icon}</div>
    <p style="font-size:0.95rem">${msg}</p>
  </div>`;
}

/* ─── AUTHENTICATION PORTAL ─── */
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.textContent.toLowerCase().replace(' ', '-') === tab || t.textContent.toLowerCase() === tab));
  $('loginForm').classList.toggle('active', tab === 'login');
  $('registerForm').classList.toggle('active', tab === 'register');
  $('forgotForm').classList.toggle('active', tab === 'forgot');
  if ($('bloodBankForm')) $('bloodBankForm').classList.toggle('active', tab === 'blood-bank');
  // Reset blood bank sub-tab to login when switching back
  if (tab === 'blood-bank') switchBankTab('login');
}

function switchBankTab(tab) {
  $('bbLoginSection').style.display = tab === 'login' ? '' : 'none';
  $('bbRegSection').style.display = tab === 'register' ? '' : 'none';
  $('bbLoginTab').classList.toggle('active', tab === 'login');
  $('bbRegTab').classList.toggle('active', tab === 'register');
}

function handleBankLogin() {
  const phone = $('bbLoginPhone').value.trim();
  const pwd   = $('bbLoginPwd').value;
  const bank  = state.banks.find(b => b.phone === phone && b.pwd === pwd);
  if (!bank) {
    showToast('No blood bank found with these credentials.', 'error');
    return;
  }
  state.currentBankId = phone;
  state.currentUserId = null; // Clear regular user login
  persist();
  document.body.classList.remove('auth-active');
  updateNavAuthUI();
  showToast(`Welcome, ${bank.name}! 🏥`, 'success');
  setTimeout(() => showSection('locator'), 500);
}

function handleLogin(e) {
  e.preventDefault();
  const id = $('loginId').value.trim();
  const pwd = $('loginPwd').value;

  // User Login Check against state.authUsers
  const user = state.authUsers.find(u => u.phone === id);
  if (!user) {
    showToast('New user found! Please register first.', 'error');
    setTimeout(() => switchAuthTab('register'), 1500);
  } else if (user.pwd === pwd) {
    completeLogin(user.phone, user.name);
  } else {
    showToast('Wrong password.', 'error');
  }
}

function handleRegister(e) {
  e.preventDefault();
  const name = $('regName').value.trim();
  const phone = $('regPhone').value.trim();
  const pwd = $('regPwd').value;

  if (state.authUsers.find(u => u.phone === phone)) {
    showToast('Already registered! Please go login.', 'info');
    setTimeout(() => {
      switchAuthTab('login');
      $('loginId').value = phone;
    }, 1500);
    return;
  }

  if (name.length > 2 && phone.length >= 10 && pwd.length >= 4) {
    // Save to authUsers database via REST and locally
    state.authUsers.push({ phone, pwd, name });
    fetch(`${API_BASE}/users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, pwd, name })
    }).catch(e => console.error(e));
    
    persist();
    completeLogin(phone, name);
    showToast('Registration successful! Welcome to RedPulse Nexus.', 'success');
  } else {
    showToast('Please enter valid details (Phone must be at least 10 chars, Pwd 4 chars)', 'error');
  }
}

function handleForgot(e) {
  e.preventDefault();
  const phone = $('forgotPhone').value.trim();
  const newPwd = $('forgotPwd').value;

  const user = state.authUsers.find(u => u.phone === phone);
  if (!user) {
    showToast('No account found with this phone number. Please register.', 'error');
    setTimeout(() => {
      switchAuthTab('register');
      $('regPhone').value = phone;
    }, 1500);
    return;
  }

  if (newPwd.length >= 4) {
    user.pwd = newPwd;
    persist();
    showToast('Password updated successfully! Please login.', 'success');
    setTimeout(() => {
      switchAuthTab('login');
      $('loginId').value = phone;
    }, 1500);
  } else {
    showToast('Password must be at least 4 characters long.', 'error');
  }
}

function updateNavAuthUI() {
  const authActions = document.getElementById('authActions');
  const userProfile = document.getElementById('userProfile');
  const userNameDisplay = document.getElementById('userNameDisplay');

  const heroDonorBtns = document.querySelectorAll('.btn-hero-primary');
  const donateLink = document.querySelector('.nav-link[data-section="donate"]');

  if (state.currentUserId) {
    if (authActions) authActions.style.display = 'none';
    if (userProfile) {
      userProfile.style.display = 'flex';
      const user = state.authUsers.find(u => u.phone === state.currentUserId);
      const donor = state.donors.find(d => d.phone === state.currentUserId);
      const badge = donor ? getDonorBadgeHtml(donor.donationCount) : '';
      userNameDisplay.innerHTML = `<span style="display:flex;align-items:center;">${user ? user.name : state.currentUserId}${badge}</span>`;
    }
    if (donateLink) donateLink.parentElement.style.display = '';
    // Check if user is already a registered donor
    const isRegistered = state.donors.some(d => d.phone === state.currentUserId);
    heroDonorBtns.forEach(btn => {
      if (isRegistered) {
        btn.style.display = 'none'; // already a donor — hide button
      } else {
        btn.style.display = '';
        btn.innerHTML = '<span>💉</span> Register as Donor'; // logged in, not yet a donor
      }
    });
    // Show donor inbox nav for logged-in users
    const donorInboxNav = document.getElementById('donorInboxNavItem');
    if (donorInboxNav) donorInboxNav.style.display = '';

    // Check for compatible emergencies for this donor
    const donor = state.donors.find(d => d.phone === state.currentUserId);
    if (donor && donor.available) {
      const activeEmergency = state.requests.find(r => 
        r.status === 'active' && 
        r.urgency === 'emergency' && 
        r.requesterId !== state.currentUserId &&
        isCompatible(r.blood, donor.blood)
      );
      if (activeEmergency) {
        showEmergencyBanner(activeEmergency.blood, activeEmergency.hospital || 'a nearby hospital');
      } else {
        closeBanner();
      }
    } else {
      closeBanner();
    }
  } else if (state.currentBankId) {
    if (authActions) authActions.style.display = 'none';
    if (userProfile) {
      userProfile.style.display = 'flex';
      const bank = state.banks.find(b => b.phone === state.currentBankId);
      userNameDisplay.textContent = bank ? `🏥 ${bank.name}` : state.currentBankId;
    }
    if (donateLink) donateLink.parentElement.style.display = 'none';
    const stockNav = document.getElementById('stockNavItem');
    if (stockNav) stockNav.style.display = '';
    const inboxNav = document.getElementById('inboxNavItem');
    if (inboxNav) inboxNav.style.display = '';
    heroDonorBtns.forEach(btn => btn.style.display = 'none'); // banks don't need donor button
    closeBanner(); // banks don't get emergency popups for donors
  } else {
    // Logged out
    if (authActions) authActions.style.display = 'flex';
    if (userProfile) userProfile.style.display = 'none';
    if (donateLink) donateLink.parentElement.style.display = '';
    const stockNav = document.getElementById('stockNavItem');
    if (stockNav) stockNav.style.display = 'none';
    const inboxNav = document.getElementById('inboxNavItem');
    if (inboxNav) inboxNav.style.display = 'none';
    const donorInboxNav = document.getElementById('donorInboxNavItem');
    if (donorInboxNav) donorInboxNav.style.display = 'none';
    heroDonorBtns.forEach(btn => {
      btn.style.display = '';
      btn.innerHTML = '<span>💉</span> Login as Donor';
    });
    closeBanner();
  }
}

function handleLogout() {
  state.currentUserId = null;
  state.currentBankId = null;
  persist();
  updateNavAuthUI();
  showToast('Logged out successfully', 'info');
  if (state.currentSection !== 'home') {
    showSection('home');
  }
}

function completeLogin(phone, userName) {
  document.body.classList.remove('auth-active');
  state.currentUserId = phone; // Store phone number as unique ID
  persist();
  showToast(`Welcome back, ${userName}!`, 'success');
  updateNavAuthUI();
  
  checkMyCompletedRequests(); // Check if any requests user submitted were fulfilled
  
  // Refresh layout after login
  setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
  renderRequestCards('all'); // Refresh requests with user context
}

// Check for fulfilled requests the user created that they haven't been notified about yet
function checkMyCompletedRequests() {
  if (!state.currentUserId) return;
  let notificationsShown = 0;
  let changed = false;

  state.requests.forEach(r => {
    if (r.requesterId !== state.currentUserId) return;

    // ── Notify about each new partial/full donor donation ──
    const donorsSeen = r._notifiedDonorCount || 0;
    const donorsNow  = r.donors ? r.donors.length : 0;

    if (donorsNow > donorsSeen && r.donors) {
      r.donors.slice(donorsSeen).forEach(d => {
        const remaining = r.remainingUnits ?? r.units;
        const received  = r.units - remaining;
        setTimeout(() => {
          $('modalIcon').textContent = remaining <= 0 ? '🎉' : '💉';
          $('modalTitle').textContent = remaining <= 0 ? 'Request Fully Fulfilled!' : 'Donation Received!';
          let html = `Your <strong>${r.blood}</strong> request at <strong>${r.hospital}</strong> received a donation!<br><br>`;
          html += `<strong>Donor:</strong> ${d.name}<br>`;
          html += `<strong>Blood:</strong> ${d.blood}<br>`;
          html += `<strong>Units Donated:</strong> ${d.units}<br>`;
          html += `<strong>Contact:</strong> 📞 ${d.phone}<br>`;
          html += `<strong>Time:</strong> ${d.time}<br><br>`;
          html += `<strong>Progress:</strong> ${received}/${r.units} unit(s) received`;
          if (remaining > 0) html += ` — <span style="color:var(--orange)">${remaining} still needed</span>`;
          else html += ` — <span style="color:var(--green)">✅ Fully fulfilled!</span>`;
          $('modalMsg').innerHTML = html;
          $('modalDonorCard').innerHTML = '';
          $('modalOverlay').classList.add('show');
        }, notificationsShown * 1200);
        notificationsShown++;
      });
      r._notifiedDonorCount = donorsNow;
      changed = true;
    }

    // ── Blood bank fulfillment popup ──
    if (r.status === 'fulfilled' && !r.notified && r.fulfilledBy && !(r.donors?.length)) {
      setTimeout(() => {
        $('modalIcon').textContent = '🎉';
        $('modalTitle').textContent = 'Request Fulfilled!';
        let html = `Your <strong>${r.blood}</strong> request at <strong>${r.hospital}</strong> has been fulfilled!<br><br>`;
        html += `<strong>Fulfilled By:</strong> ${r.fulfilledBy.name}<br>`;
        html += `<strong>Contact:</strong> ${r.fulfilledBy.phone}`;
        if (r.fulfilledBy.bankInfo) {
          const bk = r.fulfilledBy.bankInfo;
          html += `<br><strong>Type:</strong> ${bk.type}`;
          html += `<br><strong>Address:</strong> ${bk.address}`;
          html += `<br><strong>Hours:</strong> ${bk.open}`;
        }
        $('modalMsg').innerHTML = html;
        $('modalDonorCard').innerHTML = '';
        $('modalOverlay').classList.add('show');
      }, notificationsShown * 1200);
      notificationsShown++;
      r.notified = true;
      changed = true;
    }
  });

  if (changed) persist();
}

/* ─── NAVIGATION ─── */
function showSection(name) {
  if (!state.currentUserId && !state.currentBankId && name !== 'home') {
    document.body.classList.add('auth-active');
    showToast('Please login or register to continue.', 'info');
    return;
  }
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.section === name));
  const el = $(`section-${name}`);
  if (el) { el.classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  state.currentSection = name;
  if (name === 'dashboard')     renderDashboard();
  if (name === 'donate')        renderDonorTable();
  if (name === 'locator')       { 
    renderBankList(); 
    // Small delay ensures the section is visible before Leaflet tries to measure dimensions
    setTimeout(initLeafletMap, 100); 
  }
  if (name === 'manage')        renderRequestCards('all');
  if (name === 'stock')         renderBloodStock();
  if (name === 'inbox')         renderInbox('all');
  if (name === 'donor-inbox')   renderDonorInbox('all');
  if (name === 'register-bank') { /* form is static */ }
}

/* ─── DONOR APPOINTMENT INBOX ─── */
function renderDonorInbox(filter = 'all') {
  const list    = $('donorInboxList');
  const countEl = $('donorInboxCount');
  if (!list) return;
  if (!state.currentUserId) { list.innerHTML = emptyState('Please login to see your appointments.', '🔒'); return; }

  // Collect all appointments across all banks that match this donor's phone
  const myAppts = [];
  state.banks.forEach(bank => {
    (bank.appointments || []).forEach(a => {
      if (a.donorPhone === state.currentUserId) {
        myAppts.push({ ...a, bankName: bank.name, bankPhone: bank.phone, bankAddress: bank.address });
      }
    });
  });
  // Sort newest first
  myAppts.sort((a, b) => new Date(b.bookedAt) - new Date(a.bookedAt));

  const visible = filter === 'all' ? myAppts : myAppts.filter(a => a.status === filter);
  if (countEl) countEl.textContent = `${myAppts.length} appointment${myAppts.length !== 1 ? 's' : ''}`;

  if (!visible.length) {
    list.innerHTML = emptyState(
      filter === 'all' ? 'No appointments booked yet. Visit Find Blood Bank to book one!' : `No ${filter} appointments.`,
      '📅');
    return;
  }

  list.innerHTML = `
    <table class="donor-table">
      <thead><tr>
        <th>Blood Bank</th><th>Address</th><th>Blood</th>
        <th>Date</th><th>Time</th><th>Note</th><th>Status</th>
      </tr></thead>
      <tbody>
        ${visible.map(a => `
          <tr>
            <td style="font-weight:600;">${a.bankName}</td>
            <td style="font-size:0.8rem;color:var(--text2);">${a.bankAddress || '—'}</td>
            <td><span class="blood-chip">${a.blood}</span></td>
            <td>${a.date}</td>
            <td style="color:var(--green);font-weight:600;">${a.time}</td>
            <td style="font-size:0.8rem;color:var(--text3);">${a.note || '—'}</td>
            <td><span style="padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;
              background:${a.status==='confirmed'?'var(--green)':a.status==='done'?'var(--text3)':a.status==='cancelled'?'var(--red)':'var(--orange)'};
              color:#fff;">${a.status}</span></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function filterDonorInbox(status, btn) {
  document.querySelectorAll('#section-donor-inbox .filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderDonorInbox(status);
}

/* ─── APPOINTMENT INBOX ─── */
function renderInbox(filter = 'all') {
  const bank    = state.banks.find(b => b.phone === state.currentBankId);
  const list    = $('inboxAppointmentList');
  const countEl = $('inboxTotalCount');
  if (!list) return;
  if (!bank) { list.innerHTML = emptyState('No blood bank session found.', '🏥'); return; }

  const appts  = bank.appointments || [];
  const visible = filter === 'all' ? appts : appts.filter(a => a.status === filter);
  if (countEl) countEl.textContent = `${appts.length} appointment${appts.length !== 1 ? 's' : ''}`;

  if (!visible.length) {
    list.innerHTML = emptyState(
      filter === 'all' ? 'No appointments yet. Donors will appear here after booking.' : `No ${filter} appointments.`,
      '📅');
    return;
  }

  list.innerHTML = `
    <table class="donor-table">
      <thead><tr>
        <th>Donor</th><th>Blood</th><th>Date</th><th>Time</th>
        <th>Phone</th><th>Note</th><th>Booked</th><th>Status</th><th>Action</th>
      </tr></thead>
      <tbody>
        ${visible.map(a => `
          <tr>
            <td style="font-weight:600;">${a.donorName}</td>
            <td><span class="blood-chip">${a.blood}</span></td>
            <td>${a.date}</td>
            <td style="color:var(--green);font-weight:600;">${a.time}</td>
            <td style="color:var(--text2);">${a.donorPhone}</td>
            <td style="font-size:0.8rem;color:var(--text3);">${a.note || '—'}</td>
            <td style="font-size:0.76rem;color:var(--text3);">${a.bookedAt}</td>
            <td><span style="padding:3px 8px;border-radius:12px;font-size:0.75rem;font-weight:600;
              background:${a.status==='confirmed'?'var(--green)':a.status==='done'?'var(--text3)':'var(--orange)'};
              color:#fff;">${a.status}</span></td>
            <td>
              ${a.status === 'pending'
                ? `<button class="btn-fulfill" style="font-size:0.75rem;padding:4px 10px;" onclick="updateApptStatus('${bank.id}','${a.id}','confirmed')">✅ Confirm</button>`
                : a.status === 'confirmed'
                ? `<button class="btn-fulfill" style="font-size:0.75rem;padding:4px 10px;background:var(--text3)" onclick="updateApptStatus('${bank.id}','${a.id}','done')">✓ Done</button>`
                : '<span style="color:var(--text3);font-size:0.78rem;">✔ Done</span>'}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function filterInbox(status, btn) {
  document.querySelectorAll('#section-inbox .filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderInbox(status);
}

function updateApptStatus(bankId, apptId, newStatus) {
  const bank = state.banks.find(b => b.id === bankId);
  if (!bank?.appointments) return;
  const appt = bank.appointments.find(a => a.id === apptId);
  if (!appt) return;
  appt.status = newStatus;

  // Gamification: If appointment marked as done, increment donor's donation count
  if (newStatus === 'done') {
    const donor = state.donors.find(d => d.phone === appt.donorPhone);
    if (donor) {
      donor.donationCount = (donor.donationCount || 0) + 1;
      donor.lastDonation = new Date().toLocaleDateString('en-IN');
      persist();
    }
  }

  saveData('bl_banks', state.banks.filter(b => b.registered));
  renderInbox();
  renderBloodStock();
  showToast(`Appointment ${newStatus} ✅`, 'success');
}

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    showSection(link.dataset.section);
    if (link.dataset.section === 'locator') {
      // Small delay lets the section become visible first so Leaflet can measure dimensions
      setTimeout(initLeafletMap, 100);
    }
    closeMobileMenu();
  });
});

window.addEventListener('scroll', () => {
  document.querySelector('.navbar').classList.toggle('scrolled', window.scrollY > 20);
});

/* ─── MOBILE MENU ─── */
function toggleMobileMenu() { $('navLinks').classList.toggle('mobile-open'); }
function closeMobileMenu()  { $('navLinks').classList.remove('mobile-open'); }

/* ─── EMERGENCY BANNER ─── */
function closeBanner() {
  $('emergencyBanner').style.display = 'none';
  document.querySelector('.navbar').classList.add('no-banner');
  state.bannerVisible = false;
}

function respondToEmergency() {
  if (!state.currentUserId) {
    document.body.classList.add('auth-active');
    showToast('Please login or register to respond to emergencies.', 'info');
    return;
  }
  showSection('manage');
  showToast('Please find the emergency request below and click Fulfill.', 'success');
  closeBanner();
}

function showEmergencyBanner(blood, hospital) {
  $('emergencyText').innerHTML = `🚨 <strong>URGENT:</strong> ${blood} blood needed at ${hospital}`;
  $('emergencyBanner').style.display = 'flex';
  document.querySelector('.navbar').classList.remove('no-banner');
  state.bannerVisible = true;
}

/* ─── NOTIFICATIONS ─── */
function renderNotifications() {
  const list = $('notifList');
  if (!state.notifications.length) {
    list.innerHTML = emptyState('No notifications yet.<br>They appear when you register or submit requests.', '🔔');
    return;
  }
  list.innerHTML = state.notifications.map(n => `
    <div class="notif-item ${n.type}">
      <div class="notif-icon">${n.icon}</div>
      <div class="notif-text">
        <strong>${n.title}</strong>
        <small>${n.desc}</small>
      </div>
      <span class="notif-time">${n.time}</span>
    </div>
  `).join('');
  $('notifBadge').textContent = state.notifications.length || '';
}

function toggleNotifPanel() {
  state.notifPanelOpen = !state.notifPanelOpen;
  $('notifPanel').classList.toggle('show', state.notifPanelOpen);
  $('notifOverlay').classList.toggle('show', state.notifPanelOpen);
  renderNotifications();
}

function clearAllNotifs() {
  state.notifications = [];
  persist();
  $('notifBadge').textContent = '';
  renderNotifications();
  showToast('All notifications cleared', 'info');
}

function addNotification(type, icon, title, message) {
  const item = { id: uid('N'), type, icon, title, message, time: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }), read: false };
  state.notifications.unshift(item);
  fetch(`${API_BASE}/notifications`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  }).catch(e => e);
  persist();
  renderNotifications();
}

function addActivity(icon, html) {
  const item = { id: uid('A'), icon, text: html, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
  state.activityFeed.unshift(item);
  fetch(`${API_BASE}/activity`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  }).catch(e => e);
  persist();
  if (state.activityFeed.length > 50) state.activityFeed.pop(); // keep last 50
}

/* ─── HOME: COUNTERS (computed from real data) ─── */
function animateCounter(el, target) {
  if (target === 0) { el.textContent = '0'; return; }
  const dur = 1500;
  const step = target / (dur / 16);
  let cur = 0;
  const timer = setInterval(() => {
    cur += step;
    if (cur >= target) { cur = target; clearInterval(timer); }
    el.textContent = Math.floor(cur).toLocaleString();
  }, 16);
}

function updateHeroStats() {
  const donorCount   = state.donors.length;
  const requestCount = state.requests.length;
  const fulfilled    = state.requests.filter(r => r.status === 'fulfilled').length;

  // Update hero stat targets
  document.querySelectorAll('[data-target]').forEach(el => {
    const key = el.dataset.target;
    let value = 0;
    if (key === 'donors')    value = donorCount;
    if (key === 'lives')     value = fulfilled;
    if (key === 'hospitals') value = state.banks.length; // all blood banks, hospitals & camps
    if (key === 'requests')  value = state.requests.filter(r => r.status === 'active' || r.status === 'rejected').length;
    animateCounter(el, value);
  });
}

/* ─── HOME: BLOOD TYPE GRID (from actual donors) ─── */
function renderBloodGrid() {
  const grid = $('bloodGrid');
  if (!grid) return;
  grid.innerHTML = BLOOD_TYPES.map(bt => {
    const count = state.donors.filter(d => d.blood === bt).length;
    const available = state.donors.filter(d => d.blood === bt && d.available).length;
    const pct = count === 0 ? 0 : Math.min(100, count * 10);
    return `
      <div class="blood-card" onclick="showSection('donate')">
        <div class="blood-type">${bt}</div>
        <div class="blood-count">${count}</div>
        <div class="blood-label">Registered Donors</div>
        <div class="blood-bar">
          <div class="blood-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="blood-label" style="margin-top:6px;color:var(--green)">${available} available now</div>
      </div>`;
  }).join('');
}

/* ─── DASHBOARD ─── */
function renderDashboard() {
  const active    = state.requests.filter(r => r.status === 'active' || r.status === 'rejected');
  const fulfilled = state.requests.filter(r => r.status === 'fulfilled');

  // Stat cards
  $('activeRequests').textContent  = active.length;
  $('fulfilledToday').textContent  = fulfilled.length;
  $('onlineDonors').textContent    = state.donors.filter(d => d.available).length;
  $('activeHospitals').textContent = state.banks.length; // all banks, hospitals & camps
  $('urgentCount').textContent     = `${active.filter(r => r.urgency === 'emergency').length} urgent`;

  // Urgent requests list
  const urgentList = $('urgentRequestList');
  if (!active.length) {
    urgentList.innerHTML = emptyState('No active blood requests yet.<br>Submit one using "Request Blood".', '🩸');
  } else {
    urgentList.innerHTML = active.slice(0, 6).map(r => `
      <div class="req-item">
        <div class="req-blood">${r.blood}</div>
        <div class="req-info">
          <strong>${r.hospital}</strong>
          <small>${r.address} • ${r.units} unit(s) ${r.component ? 'of ' + r.component : ''} needed</small>
        </div>
        <span class="req-urgency urgency-${r.urgency}">${r.urgency}</span>
      </div>
    `).join('');
  }

  // Inventory (computed from registered donors)
  const invList = $('inventoryList');
  invList.innerHTML = BLOOD_TYPES.map(bt => {
    const count = state.donors.filter(d => d.blood === bt && d.available).length;
    const pct   = count === 0 ? 0 : Math.min(100, count * 8);
    const colorClass = pct === 0 ? 'color-low' : pct < 40 ? 'color-medium' : 'color-high';
    
    let infoHtml = count === 0 
      ? `<span style="background:var(--red);color:#fff;font-size:0.65rem;padding:2px 6px;border-radius:4px;font-weight:700;">CRITICAL</span>`
      : `<span style="color:var(--text);font-weight:600;">${count}</span><span style="color:var(--text2);font-weight:400;margin-left:4px">donors</span>`;

    return `
      <div class="inv-item">
        <div class="inv-blood">${bt}</div>
        <div class="inv-bar-wrap"><div class="inv-bar ${colorClass}" style="width:${Math.max(pct,2)}%"></div></div>
        <div class="inv-count">${infoHtml}</div>
      </div>`;
  }).join('');

  // Activity feed
  const feed = $('activityFeed');
  if (!state.activityFeed.length) {
    feed.innerHTML = emptyState('No activity yet. Register donors or submit requests to see live updates.', '📡');
  } else {
    feed.innerHTML = state.activityFeed.slice(0, 15).map(item => `
      <div class="feed-item">
        <div class="feed-icon">${item.icon}</div>
        <div class="feed-text">${item.text}</div>
        <div class="feed-time">${item.time}</div>
      </div>
    `).join('');
  }
}

/* ─── DONOR REGISTRATION ─── */
function switchTab(tab) {
  document.querySelectorAll('.form-tab').forEach((t, i) =>
    t.classList.toggle('active', (i === 0 && tab === 'new') || (i === 1 && tab === 'existing')));
  document.querySelectorAll('.tab-content').forEach(c =>
    c.classList.toggle('active', c.dataset.tab === tab));
}

function registerDonor(e) {
  e.preventDefault();
  const donor = {
    id:           uid('D'),
    name:         $('dName').value.trim(),
    age:          $('dAge').value,
    phone:        $('dPhone').value.trim(),
    email:        $('dEmail').value.trim(),
    blood:        $('dBlood').value,
    gender:       $('dGender').value,
    address:      $('dAddress').value.trim(),
    city:         $('dCity').value.trim(),
    lastDonation: $('dLastDonation').value || 'First donation',
    available:    $('dAvailable').checked === true,
    registeredAt: new Date().toLocaleDateString(),
  };

  // Check duplicate phone
  if (state.donors.find(d => d.phone === donor.phone)) {
    showToast('A donor with this phone number is already registered.', 'error');
    return;
  }

  // Save to DB optimistically
  state.donors.unshift(donor);
  fetch(`${API_BASE}/donors`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(donor)
  }).catch(console.error);
  
  addActivity('💉', `<strong>${donor.name}</strong> registered as ${donor.blood} donor in ${donor.city}`);
  addNotification('success', '✅', 'Registration Successful!', `Welcome ${donor.name}, you're now a RedPulse Nexus donor.`);
  persist();
  renderDonorTable();
  renderBloodGrid();
  updateHeroStats();
  e.target.reset();

  // Show modal with donor card
  $('modalIcon').textContent = '🎉';
  $('modalTitle').textContent = 'Welcome, Hero!';
  $('modalMsg').textContent = `You're now registered as a ${donor.blood} donor. You'll receive alerts when patients nearby need your blood type.`;
  $('modalDonorCard').innerHTML = `
    <div class="donor-id-card">
      <div class="did-blood">${donor.blood}</div>
      <div class="did-name">${donor.name}</div>
      <div class="did-meta">${donor.city} • ${donor.phone}${donor.email ? '<br>' + donor.email : ''}</div>
      <div class="did-id">DONOR ID: ${donor.id} • Registered: ${donor.registeredAt}</div>
    </div>`;
  $('modalOverlay').classList.add('show');
  showToast(`${donor.name} registered as ${donor.blood} donor! 🎉`, 'success');
}

function findDonorProfile() {
  const phone = $('searchPhone').value.trim();
  const donor = state.donors.find(d => d.phone === phone);
  const res   = $('profileResult');
  if (donor) {
    res.innerHTML = `
      <div class="profile-card">
        <div class="profile-avatar">${donor.blood}</div>
        <div class="profile-info">
          <h3>${donor.name}</h3>
          <p>${donor.phone} • ${donor.city}</p>
          <p>Last donation: ${donor.lastDonation}</p>
          <p>Registered: ${donor.registeredAt || '—'}</p>
          <span class="req-urgency ${donor.available ? 'urgency-planned' : 'urgency-emergency'}" style="display:inline-block;margin-top:6px">
            ${donor.available ? '✅ Available' : '⏸ Unavailable'}
          </span>
        </div>
      </div>`;
  } else {
    res.innerHTML = `<p style="color:var(--text2);margin-top:16px;font-size:0.875rem;">
      No donor found with this number.
      <a href="#" onclick="switchTab('new')" style="color:var(--red)">Register as new donor →</a></p>`;
  }
}

/* ─── GAMIFICATION ─── */
function getDonorBadgeHtml(count) {
  if (!count) return '';
  if (count >= 10) return `<span title="Hero (10+ donations)" style="font-size:1.1rem;margin-left:4px">🌟</span>`;
  if (count >= 5)  return `<span title="Life Saver (5+ donations)" style="font-size:1.1rem;margin-left:4px">❤️</span>`;
  if (count >= 1)  return `<span title="First Drop (1+ donations)" style="font-size:1.1rem;margin-left:4px">🩸</span>`;
  return '';
}

/* ─── DONOR TABLE ─── */
function renderDonorTable() {
  const container = $('donorTableContainer');
  const query = ($('donorSearch')?.value || '').toLowerCase();
  const filtered = state.donors.filter(d =>
    d.name.toLowerCase().includes(query) ||
    d.blood.toLowerCase().includes(query) ||
    (d.city || '').toLowerCase().includes(query)
  );
  if (!state.donors.length) {
    container.innerHTML = emptyState('No donors registered yet.<br>Be the first to register above!', '💉');
    return;
  }
  if (!filtered.length) {
    container.innerHTML = emptyState('No donors match your search.', '🔍');
    return;
  }
  container.innerHTML = `
    <table class="donor-table">
      <thead><tr>
        <th>Donor ID</th><th>Name</th><th>Blood</th><th>City</th><th>Phone</th><th>Last Donation</th><th>Status</th>
      </tr></thead>
      <tbody>
        ${filtered.map(d => `
          <tr>
            <td style="color:var(--text3);font-size:0.78rem">${d.id}</td>
            <td style="font-weight:600;display:flex;align-items:center;">${d.name}${getDonorBadgeHtml(d.donationCount)}</td>
            <td><span class="blood-chip">${d.blood}</span></td>
            <td>${d.city || '—'}</td>
            <td style="color:var(--text2)">${d.phone}</td>
            <td style="color:var(--text2);font-size:0.8rem">${d.lastDonation}</td>
            <td>
              <span class="status-dot ${d.available ? 'available' : 'unavailable'}">
                <span class="dot"></span>${d.available ? 'Available' : 'Unavailable'}
              </span>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function filterDonors() { renderDonorTable(); }

/* ─── BLOOD REQUEST ─── */
function selectUrgency(u) {
  state.currentUrgency = u;
  document.querySelectorAll('.urgency-option').forEach(opt =>
    opt.classList.toggle('active', opt.dataset.urgency === u));
}

function submitRequest(e) {
  e.preventDefault();
  const req = {
    id:       uid('R'),
    name:     $('rName').value.trim(),
    phone:    $('rPhone').value.trim(),
    blood:    $('rBlood').value,
    component:$('rComponent').value,
    units:    parseInt($('rUnits').value),
    hospital: $('rHospital').value.trim(),
    address:  $('rAddress').value.trim(),
    notes:    $('rNotes').value.trim(),
    urgency:  state.currentUrgency,
    status:   'active',
    requesterId: state.currentUserId, // Track who created this request
    notified: false, // Track if they've been notified about fulfillment
    rejectedBy: [], // Array of user IDs who rejected this
    time:     new Date().toLocaleString(),
  };

  // Push to local array and server
  state.requests.unshift(req);
  fetch(`${API_BASE}/requests`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  }).catch(console.error);

  addActivity('🚨', `New ${req.urgency} request for <strong>${req.blood}</strong> at ${req.hospital}`);
  addNotification('emergency', '🚨', 'New Blood Request', `${req.units} unit(s) of ${req.blood} needed at ${req.hospital}`);
  
  if (req.urgency === 'emergency') {
    showEmergencyBanner(req.blood, req.hospital);
  }
  
  persist();
  updateHeroStats();

  const compat = state.donors.filter(d => d.available && isCompatible(req.blood, d.blood)).length;

  $('modalIcon').textContent = '🚨';
  $('modalTitle').textContent = 'Request Submitted!';
  $('modalMsg').textContent = `Your ${req.blood} request at ${req.hospital} is live. ${compat} compatible donor(s) in the network have been alerted.`;
  $('modalDonorCard').innerHTML = '';
  $('modalOverlay').classList.add('show');

  showToast(`Blood request live — alerting ${compat} compatible donor(s)!`, 'success');
  e.target.reset();

  // Redirect to manage page
  setTimeout(() => showSection('manage'), 1500);
}

function isCompatible(needed, donor) {
  const compat = {
    'O-':  ['O-'],
    'O+':  ['O-','O+'],
    'A-':  ['O-','A-'],
    'A+':  ['O-','O+','A-','A+'],
    'B-':  ['O-','B-'],
    'B+':  ['O-','O+','B-','B+'],
    'AB-': ['O-','A-','B-','AB-'],
    'AB+': ['O-','O+','A-','A+','B-','B+','AB-','AB+'],
  };
  return compat[needed]?.includes(donor) ?? false;
}

/* ─── BLOOD BANK LOCATOR ─── */
function renderBankList(banks = state.banks) {
  const list = $('bankList');
  if (!banks.length) { list.innerHTML = emptyState('No blood banks match your filters.', '🏦'); return; }
  list.innerHTML = banks.map(b => `
    <div class="bank-card" id="bank-${b.id}" onclick="highlightBank('${b.id}')">
      <div class="bank-card-header">
        <div>
          <div class="bank-name">${b.name}</div>
          <div class="bank-type">${b.type} • ${b.open}</div>
        </div>
        <span class="bank-dist">📍 ${b.dist} km</span>
      </div>
      <div class="bank-address">📌 ${b.address}</div>
      <div class="bank-blood-tags">${(() => {
        // Derive from stock keys (all types with units > 0), fallback to b.blood if no stock set
        const availBlood = b.stock && Object.keys(b.stock).length
          ? Object.entries(b.stock).filter(([, u]) => u > 0).map(([bt]) => bt)
          : (b.blood || []);
        return availBlood.length
          ? availBlood.map(bt => {
              const units = b.stock ? (b.stock[bt] ?? '—') : '—';
              return `<span class="blood-tag" style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;">
                <span>${bt}</span>
                <span style="font-size:0.68rem;opacity:0.85;">${units} units</span>
              </span>`;
            }).join('')
          : `<span style="color:var(--red);font-size:0.8rem;">⚠️ All blood types currently out of stock</span>`;
      })()}</div>
      <div class="bank-footer">
        <button class="btn-call"  onclick="event.stopPropagation();showToast('Calling ${b.phone}…','info')">📞 ${b.phone}</button>
        <button class="btn-route" onclick="event.stopPropagation();getDirections(${JSON.stringify({id:b.id,name:b.name,address:b.address,lat:b.lat,lng:b.lng}).replace(/"/g,'&quot;')})">🗺️ Directions</button>
        <button class="btn-fulfill" onclick="event.stopPropagation();bookAppointment('${b.id}')" style="margin-left:auto;">📅 Book Appointment</button>
      </div>
    </div>
  `).join('');
}

/* ─── LEAFLET MAP ─── */
let _leafletMap = null;
let _bankMarkers = [];
let _userMarker  = null;

/** Generate a coordinate based on the city in the address, falling back to a random central Indian point. */
function randomIndianCoords(address = '') {
  const adr = address.toLowerCase();
  const cities = {
    'delhi': [28.61, 77.20], 'new delhi': [28.61, 77.20], 'noida': [28.53, 77.39], 'gurgaon': [28.45, 77.02], 'ghaziabad': [28.66, 77.45],
    'mumbai': [19.07, 72.87], 'pune': [18.52, 73.85], 'nagpur': [21.14, 79.08],
    'bangalore': [12.97, 77.59], 'bengaluru': [12.97, 77.59],
    'chennai': [13.08, 80.27], 'hyderabad': [17.38, 78.48],
    'kolkata': [22.57, 88.36],
    'ahmedabad': [23.02, 72.57], 'surat': [21.17, 72.83],
    'jaipur': [26.91, 75.78],
    'lucknow': [26.84, 80.94], 'kanpur': [26.44, 80.33], 'agra': [27.17, 78.00],
    'patna': [25.59, 85.13],
    'bhopal': [23.25, 77.41], 'indore': [22.71, 75.85],
    'bhubaneswar': [20.29, 85.82], 'kochi': [9.93, 76.26]
  };
  
  // Find if address contains any of our known cities
  for (const [city, coords] of Object.entries(cities)) {
    if (adr.includes(city)) {
      // Return city coordinates with a small random offset (~1-5km) so pins don't overlap exactly
      const lat = coords[0] + (Math.random() - 0.5) * 0.05;
      const lng = coords[1] + (Math.random() - 0.5) * 0.05;
      return { lat: parseFloat(lat.toFixed(5)), lng: parseFloat(lng.toFixed(5)) };
    }
  }

  // If no city matches, fall back to central India (Nagpur/MP area) with a moderate offset
  const lat = 21.14  + (Math.random() - 0.5) * 5.0; // +/- 5 deg
  const lng = 79.08  + (Math.random() - 0.5) * 5.0; 
  return { lat: parseFloat(lat.toFixed(5)), lng: parseFloat(lng.toFixed(5)) };
}

function initLeafletMap() {
  if (_leafletMap) return; // already initialised
  const el = document.getElementById('leafletMap');
  if (!el || typeof L === 'undefined') return;

  // Centre on India by default
  _leafletMap = L.map('leafletMap', { zoomControl: true }).setView([20.5937, 78.9629], 5);

  // OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(_leafletMap);

  // Ensure every bank has real-ish coordinates (migrate legacy/null banks, or ones wildly outside India like Finland)
  let coordsFixed = false;
  state.banks.forEach(b => {
    const isInvalid = b.lat == null || b.lng == null || isNaN(parseFloat(b.lat)) || isNaN(parseFloat(b.lng));
    const isOutOfBounds = parseFloat(b.lat) > 40 || parseFloat(b.lat) < 5 || parseFloat(b.lng) > 100 || parseFloat(b.lng) < 60;
    
    if (isInvalid || isOutOfBounds) {
      const c = randomIndianCoords(b.address);
      b.lat = c.lat;
      b.lng = c.lng;
      coordsFixed = true;
    }
  });
  if (coordsFixed) saveData('bl_banks', state.banks.filter(b => b.registered));

  // Ensure the map fills the container correctly (fixes grey tiles on first render)
  setTimeout(() => _leafletMap.invalidateSize(), 200);

  // Plot any existing banks
  updateMapMarkers(state.banks);
}

function _bankIcon(type) {
  const emoji = type === 'Blood Bank' ? '🏦' : type === 'Hospital' ? '🏥' : '⛺';
  return L.divIcon({
    html: `<div style="font-size:1.5rem;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));">${emoji}</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
  });
}

function _userIcon() {
  return L.divIcon({
    html: `<div style="background:var(--rose,#f43f5e);border:3px solid #fff;border-radius:50%;width:18px;height:18px;box-shadow:0 2px 8px rgba(244,63,94,0.6);"></div>`,
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function updateMapMarkers(banks) {
  if (!_leafletMap) return;

  // Clear existing bank markers
  _bankMarkers.forEach(m => _leafletMap.removeLayer(m));
  _bankMarkers = [];

  banks.forEach(b => {
    const lat = parseFloat(b.lat);
    const lng = parseFloat(b.lng);
    if (isNaN(lat) || isNaN(lng)) return; // skip banks without real coordinates

    const marker = L.marker([lat, lng], { icon: _bankIcon(b.type) }).addTo(_leafletMap);
    const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    marker.bindPopup(`
      <div style="min-width:180px;font-family:inherit;">
        <strong style="font-size:0.95rem;">${b.name}</strong><br>
        <small style="opacity:0.75;">${b.type} • ${b.hours || '24/7'}</small><br>
        <small>📍 ${b.address}</small><br>
        <small>📞 ${b.phone}</small><br><br>
        <small>📍 ${b.address}</small><br>
        <small>📞 ${b.phone}</small><br><br>
        <button onclick="getDirections(${JSON.stringify({id:b.id,name:b.name,address:b.address,lat:b.lat,lng:b.lng}).replace(/"/g,'&quot;')})"
           style="background:#22c55e;color:#fff;padding:6px 12px;border:none;border-radius:8px;cursor:pointer;font-size:0.82rem;display:inline-block;">
          🧭 Get Directions
        </button>
      </div>
    `);
    marker.on('click', () => highlightBank(b.id));
    _bankMarkers.push(marker);
  });
}

function getDirections(b) {
  let modal = document.getElementById('mapModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'mapModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:800px; width:95%; height:80vh; padding:0; display:flex; flex-direction:column; overflow:hidden;">
        <div style="padding:16px 20px; background:var(--bg1); display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border);">
          <h3 style="margin:0;font-size:1.2rem;">📍 Map & Directions</h3>
          <button onclick="document.getElementById('mapModal').classList.remove('show'); document.getElementById('mapIframe').src='';" style="background:none;border:none;font-size:2rem;cursor:pointer;color:var(--text2);line-height:1;">&times;</button>
        </div>
        <iframe id="mapIframe" width="100%" style="flex-grow:1;border:0;" allowfullscreen></iframe>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  const destLat = parseFloat(b.lat);
  const destLng = parseFloat(b.lng);
  
  let q = (!isNaN(destLat) && !isNaN(destLng)) ? `${destLat},${destLng}` : encodeURIComponent(`${b.name}, ${b.address}, India`);
  
  let src = '';
  if (_userMarker) {
    const pos = _userMarker.getLatLng();
    src = `https://maps.google.com/maps?saddr=${pos.lat},${pos.lng}&daddr=${q}&output=embed&z=14`;
  } else {
    src = `https://maps.google.com/maps?q=${q}&output=embed&z=14`;
  }
  
  document.getElementById('mapIframe').src = src;
  modal.classList.add('show');
}

function highlightBank(id) {
  // Highlight the card in the list
  document.querySelectorAll('.bank-card').forEach(c => c.classList.remove('highlighted'));
  const card = $(`bank-${id}`);
  if (card) { card.classList.add('highlighted'); card.scrollIntoView({ behavior:'smooth', block:'nearest' }); }

  // Open the popup for this bank on the map
  const bank = state.banks.find(b => b.id === id);
  if (bank && _leafletMap) {
    const lat = parseFloat(bank.lat);
    const lng = parseFloat(bank.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      _leafletMap.flyTo([lat, lng], 14, { animate: true, duration: 1 });
      const idx = state.banks.filter(b2 => !isNaN(parseFloat(b2.lat)) && !isNaN(parseFloat(b2.lng))).findIndex(b2 => b2.id === id);
      if (idx !== -1 && _bankMarkers[idx]) _bankMarkers[idx].openPopup();
    }
  }
}

function filterBanks() {
  const loc   = $('locationInput').value.toLowerCase();
  const type  = $('typeFilter').value;
  const blood = $('bloodFilter').value;
  const filtered = state.banks.filter(b => {
    const matchLoc  = !loc   || b.address.toLowerCase().includes(loc) || b.name.toLowerCase().includes(loc) || (b.city && b.city.toLowerCase().includes(loc));
    const matchType = !type  || b.type === type;
    const matchBld  = !blood || b.blood.includes(blood);
    return matchLoc && matchType && matchBld;
  });
  renderBankList(filtered);
  updateMapMarkers(filtered);
}

function useMyLocation() {
  showToast('Getting your GPS location…', 'info');
  if (!navigator.geolocation) { showToast('GPS not supported in this browser.', 'error'); return; }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;

      if (!_leafletMap) initLeafletMap();

      // Remove old user marker
      if (_userMarker) _leafletMap.removeLayer(_userMarker);

      _userMarker = L.marker([lat, lng], { icon: _userIcon(), zIndexOffset: 1000 })
        .addTo(_leafletMap)
        .bindPopup('<strong>📍 You are here</strong>')
        .openPopup();

      _leafletMap.flyTo([lat, lng], 13, { animate: true, duration: 1.5 });
      showToast('Location found! Map centred on your position.', 'success');

      // Show all banks on map (those with coordinates will show pins)
      updateMapMarkers(state.banks);
    },
    (err) => {
      const msgs = { 1: 'Location access denied.', 2: 'Position unavailable.', 3: 'GPS timed out.' };
      showToast(`${msgs[err.code] || 'Could not get location.'} Using default demo coordinates.`, 'info');
      
      // Fallback to central India (Nagpur) for demonstration purposes
      const lat = 21.1458;
      const lng = 79.0882;
      
      if (!_leafletMap) initLeafletMap();
      if (_userMarker) _leafletMap.removeLayer(_userMarker);
      _userMarker = L.marker([lat, lng], { icon: _userIcon(), zIndexOffset: 1000 })
        .addTo(_leafletMap)
        .bindPopup('<strong>📍 Demo Location (GPS Blocked)</strong>')
        .openPopup();
        
      _leafletMap.flyTo([lat, lng], 13, { animate: true, duration: 1.5 });
      updateMapMarkers(state.banks);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

/* ─── REQUEST MANAGEMENT ─── */
function renderRequestCards(filter) {
  const cards = $('manageRequestCards');

  if (!state.requests.length) {
    cards.innerHTML = emptyState('No blood requests submitted yet.<br>Use "Request Blood" to add one.', '🆘');
    return;
  }
  
  // Filter list by rejected status based on current user view
  let viewList = state.requests.map(r => {
    // If the current user rejected it, and it's not fulfilled globally, show as rejected for them
    // Safety check: ensure rejectedBy exists and current user id is actually set
    const isRejectedByMe = state.currentUserId && r.rejectedBy && r.rejectedBy.includes(state.currentUserId) && r.status !== 'fulfilled';
    return { ...r, _displayStatus: isRejectedByMe ? 'rejected' : r.status };
  });

  // Filter if we selected a specific tab
  if (filter === 'mine' && state.currentUserId) {
    viewList = viewList.filter(r => r.requesterId === state.currentUserId);
  } else if (filter !== 'all') {
    viewList = viewList.filter(r => r.urgency === filter || r._displayStatus === filter);
  }

  if (!viewList.length) {
    cards.innerHTML = emptyState(`No ${filter} requests found.`, '📋');
    return;
  }
  
  cards.innerHTML = viewList.map(r => `
    <div class="req-card card-${r._displayStatus==='fulfilled'?'fulfilled':r._displayStatus==='rejected'?'rejected':r.urgency}" id="card-${r.id}">
      <div class="req-card-header">
        <div class="req-card-blood">${r.blood} <small style="display:block;font-size:0.7rem;opacity:0.8;">${r.component || ''}</small></div>
        <span class="req-urgency urgency-${r.urgency}">${r.urgency}</span>
      </div>
      <div class="req-card-body">
        <strong>${r.hospital}</strong>
        <p>${r.address}</p>
      </div>
      <div class="req-card-meta">
        <span class="meta-pill">Patient: <span>${r.name}</span></span>
        <span class="meta-pill">Units Required: <span>${r.units}</span></span>
        <span class="meta-pill" style="color:${(r.remainingUnits ?? r.units) > 0 ? 'var(--orange)' : 'var(--green)'}">
          Received: <span>${r.units - (r.remainingUnits ?? r.units)}/${r.units}</span>
        </span>
        <span class="meta-pill">📞 <span>${r.phone}</span></span>
        <span class="meta-pill">🕐 <span>${r.time}</span></span>
      </div>
      ${r.donors && r.donors.length ? `
        <div style="font-size:0.82rem;background:var(--bg3);border-radius:var(--radius-sm);padding:10px;margin-top:6px;">
          <strong>💉 Donors so far:</strong>
          <ul style="margin:6px 0 0 16px;padding:0;">
            ${r.donors.map(d => `<li>${d.name} (${d.blood}) — ${d.units} unit(s) &bull; 📞 ${d.phone} &bull; ${d.time}</li>`).join('')}
          </ul>
        </div>` : ''}
      ${r.notes ? `<div style="font-size:0.8rem;color:var(--text2);background:var(--bg3);padding:10px;border-radius:var(--radius-sm);margin-top:4px">${r.notes}</div>` : ''}
      ${r.fulfilledBy ? `<div style="font-size:0.85rem;color:var(--green);background:rgba(34,197,94,0.1);padding:10px;border-radius:var(--radius-sm);margin-top:8px;border:1px solid rgba(34,197,94,0.2)"><strong>Fulfilled By:</strong> ${r.fulfilledBy.name} (${r.fulfilledBy.phone})</div>` : ''}
      <div class="req-card-actions" style="margin-top:12px">
        ${r._displayStatus === 'fulfilled'
          ? `<div class="btn-fulfilled-tag">✅ Fulfilled</div>`
          : r.requesterId === state.currentUserId
             ? `<div class="btn-fulfilled-tag" style="color:var(--text2); background:transparent; border: 1px dashed var(--border2)">Your Request • Waiting...</div>
                ${r._displayStatus === 'active' ? `<button class="btn-cancel" onclick="closeMyRequest('${r.id}')" style="margin-top:8px">Cancel Request</button>` : ''}`
             : r._displayStatus === 'rejected'
                ? `<div class="badge-rejected">⚠️ Rejected By You</div>
                   <button class="btn-reopen" onclick="fulfillRequest('${r.id}')">✅ Fulfill Anyway</button>`
                : `<button class="btn-fulfill" onclick="fulfillRequest('${r.id}')">✅ Mark Fulfilled</button>
                   <button class="btn-cancel"  onclick="rejectRequest('${r.id}')">✕ Reject</button>`}
      </div>
    </div>
  `).join('');
}

function filterRequests(filter, btn) {
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderRequestCards(filter);
}

function fulfillRequest(id) {
  const req = state.requests.find(r => r.id === id);
  if (!req) return;

  // ── Blood Bank fulfillment path ──
  if (state.currentBankId) {
    const bank = state.banks.find(b => b.phone === state.currentBankId);
    if (!bank) { showToast('Blood bank session error.', 'error'); return; }

    if (!bank.stock) bank.stock = {};
    const available     = bank.stock[req.blood] ?? 0;
    const remainingUnits = req.remainingUnits ?? req.units; // use partial remaining, not original

    if (available < remainingUnits) {
      showToast(`Insufficient stock! You have ${available} unit(s) of ${req.blood} but ${remainingUnits} unit(s) are still needed. Please update your stock first.`, 'error');
      showSection('stock');
      return;
    }

    // Deduct only the remaining units from bank stock
    bank.stock[req.blood] = available - remainingUnits;
    
    // Log donation history with actual units donated
    if (!bank.donationHistory) bank.donationHistory = [];
    bank.donationHistory.unshift({
      blood:    req.blood,
      units:    remainingUnits,
      patient:  req.name,
      phone:    req.phone,
      hospital: req.hospital,
      time:     new Date().toLocaleString(),
    });
    
    saveData('bl_banks', state.banks.filter(b => b.registered));

    req.status = 'fulfilled';
    req.fulfilledBy = { 
      name: bank.name, 
      phone: bank.phone,
      bankInfo: {
        type:    bank.type,
        address: bank.address,
        open:    bank.open,
        blood:   bank.blood,
      },
      donorInfo: null 
    };

    addActivity('✅', `<strong>${req.blood}</strong> request at ${req.hospital} fulfilled by <strong>${bank.name}</strong>!`);
    addNotification('success', '✅', 'Request Fulfilled', `${req.blood} blood delivered to ${req.hospital} from ${bank.name}`);
    req.remainingUnits = 0; // mark fully fulfilled
    persist();
    updateHeroStats();
    renderRequestCards('all');
    showToast(`Request fulfilled! ${remainingUnits} unit(s) of ${req.blood} deducted from your stock. ✅`, 'success');
    return;
  }

  // ── Regular donor fulfillment path ──
  const user     = state.authUsers.find(u => u.phone === state.currentUserId);
  const donorInfo = state.donors.find(d => d.phone === state.currentUserId);

  if (!donorInfo) {
    showToast('Please register as a donor first to fulfill a request!', 'info');
    showSection('donate');
    return;
  }

  // 1. Blood compatibility check
  if (!isCompatible(req.blood, donorInfo.blood)) {
    showToast(`Your blood type (${donorInfo.blood}) is not compatible with the requested type (${req.blood}).`, 'error');
    return;
  }

  // 2. Two-month cooldown check
  const lastDonation = donorInfo.lastDonation;
  if (lastDonation && lastDonation !== 'First donation') {
    const parts = lastDonation.split('/');
    if (parts.length >= 3) {
      const lastDate = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
      const daysSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 60) {
        const daysLeft = Math.ceil(60 - daysSince);
        showToast(`You must wait ${daysLeft} more day(s) before donating again (2-month cooldown).`, 'error');
        return;
      }
    }
  }

  // 3. Check remaining units needed (supports partial fulfillment)
  const remaining = req.remainingUnits ?? req.units;
  if (remaining <= 0) {
    showToast('This request has already been fully fulfilled!', 'info');
    return;
  }

  // 4. Open unit-selection dialog
  state._pendingFulfillId = id;
  const maxUnits = Math.min(2, remaining);
  const sel = $('donateUnitsSelect');
  sel.innerHTML = '';
  for (let i = 1; i <= maxUnits; i++) {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = `${i} Unit${i > 1 ? 's' : ''}`;
    sel.appendChild(opt);
  }
  $('donateModalInfo').innerHTML =
    `Donating <strong>${donorInfo.blood}</strong> → <strong>${req.blood}</strong> at ${req.hospital}.<br>
     <span style="color:var(--text2);">${remaining} unit(s) still needed.</span>`;
  $('donateModalOverlay').classList.add('show');
}

function closeDonateModal() {
  $('donateModalOverlay').classList.remove('show');
  state._pendingFulfillId = null;
}

function confirmDonorFulfill() {
  const id = state._pendingFulfillId;
  if (!id) return;
  closeDonateModal();

  const req      = state.requests.find(r => r.id === id);
  const user     = state.authUsers.find(u => u.phone === state.currentUserId);
  const donorInfo = state.donors.find(d => d.phone === state.currentUserId);
  if (!req || !donorInfo) return;

  const donatedUnits = parseInt($('donateUnitsSelect').value) || 1;
  const remaining    = req.remainingUnits ?? req.units;
  const newRemaining = remaining - donatedUnits;

  // Track partial donations and update count
  donorInfo.donationCount = (donorInfo.donationCount || 0) + 1;
  if (!req.donors) req.donors = [];
  req.donors.push({ name: donorInfo.name, phone: donorInfo.phone, units: donatedUnits, blood: donorInfo.blood, time: new Date().toLocaleString() });
  req.remainingUnits = newRemaining;

  if (newRemaining <= 0) {
    req.status = 'fulfilled';
    req.fulfilledBy = { name: donorInfo.name, phone: state.currentUserId, donorInfo };
    addActivity('✅', `<strong>${req.blood}</strong> request at ${req.hospital} fully fulfilled!`);
    addNotification('success', '✅', 'Request Fulfilled', `${req.blood} blood delivered to ${req.hospital}`);
    showToast(`Request fully fulfilled! You donated ${donatedUnits} unit(s). ✅`, 'success');
  } else {
    addActivity('💉', `<strong>${donorInfo.name}</strong> donated ${donatedUnits} unit(s) of ${donorInfo.blood} — ${newRemaining} more unit(s) needed.`);
    showToast(`Thank you! You donated ${donatedUnits} unit(s). ${newRemaining} more unit(s) still needed.`, 'success');
  }

  // Update donor's last donation date
  const donationDate = new Date();
  donorInfo.lastDonation = donationDate.toLocaleDateString('en-IN');

  // Auto-cancel only appointments within the 60-day cooldown window
  let cancelledCount = 0;
  const cooldownDeadline = new Date(donationDate);
  cooldownDeadline.setDate(cooldownDeadline.getDate() + 60);

  state.banks.forEach(bank => {
    (bank.appointments || []).forEach(appt => {
      if (appt.donorPhone === state.currentUserId && (appt.status === 'pending' || appt.status === 'confirmed')) {
        // Only cancel if the appointment date falls within 60 days of donation
        const apptDate = new Date(appt.date);
        if (apptDate <= cooldownDeadline) {
          appt.status = 'cancelled';
          cancelledCount++;
        }
      }
    });
  });
  if (cancelledCount > 0) {
    saveData('bl_banks', state.banks.filter(b => b.registered));
    showToast(`${cancelledCount} appointment(s) within the 60-day window auto-cancelled.`, 'info');
  }

  persist();
  updateHeroStats();
  renderRequestCards('all');
}

function rejectRequest(id) {
  const req = state.requests.find(r => r.id === id);
  if (req) {
    if (!req.rejectedBy) req.rejectedBy = [];
    if (!req.rejectedBy.includes(state.currentUserId)) {
      req.rejectedBy.push(state.currentUserId);
    }
    // Note: We DO NOT change req.status to 'rejected' globally. 
    // It remains 'active' for all other users.
    persist();
    updateHeroStats();
    renderRequestCards('all');
    showToast('Request rejected by you. It is still available for others.', 'info');
  }
}

function closeMyRequest(id) {
  const req = state.requests.find(r => r.id === id);
  if (req && req.requesterId === state.currentUserId) {
    req.status = 'fulfilled'; // or a new state like 'cancelled', but fulfilled works for demo
    req.notified = true; // don't notify creator of their own manual cancellation
    persist();
    updateHeroStats();
    renderRequestCards('mine');
    showToast('Your request has been cancelled/closed.', 'info');
  }
}

/* ─── BLOOD STOCK MANAGEMENT ─── */
function renderBloodStock() {
  const grid = $('stockGrid');
  if (!grid) return;
  const bank = state.banks.find(b => b.phone === state.currentBankId);
  if (!bank) { grid.innerHTML = emptyState('No blood bank session found.', '🏥'); return; }

  const stock = bank.stock || {};

  grid.innerHTML = BLOOD_TYPES.map(bt => {
    const units = stock[bt] ?? 0;
    const pct   = Math.min(100, units * 2);
    const color = units === 0 ? 'var(--red)' : units < 10 ? 'var(--orange)' : 'var(--green)';
    return `
      <div class="blood-card" style="cursor:default;">
        <div class="blood-type">${bt}</div>
        <div class="blood-count" style="color:${color};">${units}</div>
        <div class="blood-label">Units Available</div>
        <div class="blood-bar">
          <div class="blood-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="blood-label" style="margin-top:6px;color:${color};">
          ${units === 0 ? '⚠️ Out of stock' : units < 10 ? '⚠️ Low stock' : '✅ Available'}
        </div>
      </div>`;
  }).join('');

  // Render donation history
  const histList = $('donationHistoryList');
  const histCount = $('donationHistoryCount');
  const history = bank.donationHistory || [];
  if (histCount) histCount.textContent = `${history.length} record${history.length !== 1 ? 's' : ''}`;
  if (histList) {
    if (!history.length) {
      histList.innerHTML = emptyState('No donations made yet. Fulfilled requests will appear here.', '📊');
    } else {
      histList.innerHTML = `
        <table class="donor-table" style="margin-top:8px;">
          <thead><tr>
            <th>Time</th><th>Blood</th><th>Units</th><th>Patient</th><th>Hospital</th><th>Phone</th>
          </tr></thead>
          <tbody>
            ${history.map(h => `
              <tr>
                <td style="font-size:0.78rem;color:var(--text3);">${h.time}</td>
                <td><span class="blood-chip">${h.blood}</span></td>
                <td style="font-weight:600;color:var(--red);">${h.units}</td>
                <td>${h.patient}</td>
                <td>${h.hospital}</td>
                <td style="color:var(--text2);">${h.phone}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    }
  }

  // Render incoming appointments
  const appts = bank.appointments || [];
  const apptEl = $('apptInboxList');
  const apptCount = $('apptInboxCount');
  if (apptCount) apptCount.textContent = `${appts.length} appointment${appts.length !== 1 ? 's' : ''}`;
  if (apptEl) {
    if (!appts.length) {
      apptEl.innerHTML = emptyState('No appointments yet. Donors will book here.', '📅');
    } else {
      apptEl.innerHTML = `
        <table class="donor-table" style="margin-top:8px;">
          <thead><tr>
            <th>Donor</th><th>Blood</th><th>Date</th><th>Time</th><th>Phone</th><th>Note</th><th>Status</th>
          </tr></thead>
          <tbody>
            ${appts.map(a => `
              <tr>
                <td style="font-weight:600;">${a.donorName}</td>
                <td><span class="blood-chip">${a.blood}</span></td>
                <td>${a.date}</td>
                <td style="color:var(--green);font-weight:600;">${a.time}</td>
                <td style="color:var(--text2);">${a.donorPhone}</td>
                <td style="font-size:0.8rem;color:var(--text3);">${a.note || '—'}</td>
                <td><span class="req-urgency urgency-planned" style="font-size:0.75rem;">${a.status}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    }
  }

}

function updateStock() {
  const bt    = $('stockBloodType').value;
  const units = parseInt($('stockUnits').value);
  if (!bt) { showToast('Please select a blood group.', 'error'); return; }
  if (isNaN(units) || units < 0) { showToast('Please enter a valid unit count.', 'error'); return; }

  const bank = state.banks.find(b => b.phone === state.currentBankId);
  if (!bank) { showToast('No blood bank session.', 'error'); return; }

  if (!bank.stock) bank.stock = {};
  bank.stock[bt] = units;

  // Sync bank.blood so the locator always reflects live stock
  if (!bank.blood) bank.blood = [];
  if (units > 0 && !bank.blood.includes(bt)) {
    bank.blood.push(bt);
  } else if (units === 0) {
    bank.blood = bank.blood.filter(b => b !== bt);
  }

  // Persist only user-registered banks
  saveData('bl_banks', state.banks.filter(b => b.registered));

  renderBloodStock();
  $('stockBloodType').value = '';
  $('stockUnits').value = '';
  showToast(`${bt} stock updated to ${units} unit(s) ✅`, 'success');
}

/* ─── BLOOD BANK REGISTRATION ─── */
function registerBloodBank() {
  const name    = ($('bbName')?.value || '').trim();
  const type    = $('bbType')?.value;
  const address = ($('bbAddress')?.value || '').trim();
  const phone   = ($('bbPhone')?.value || '').trim();
  const pwd     = ($('bbPwd')?.value || '');
  const open    = ($('bbOpen')?.value || '').trim();
  const blood   = [...document.querySelectorAll('.bb-blood:checked')].map(cb => cb.value);
  
  if (!name || !type || !address || !phone || !pwd || !open) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }
  if (pwd.length < 4) {
    showToast('Password must be at least 4 characters.', 'error');
    return;
  }
  if (!blood.length) {
    showToast('Please select at least one blood group.', 'error');
    return;
  }
  if (state.banks.find(b => b.phone === phone)) {
    showToast('A blood bank with this phone is already registered. Please login.', 'error');
    switchBankTab('login');
    return;
  }
  
  const c = randomIndianCoords(address);
  const newBank = {
    id:      uid('HB'),
    name, type, address, phone, pwd, open, blood,
    dist:    parseFloat((Math.random() * 15 + 1).toFixed(1)),
    lat:     c.lat, // Will be overwritten by geocoding if successful
    lng:     c.lng,
    registered: true,
  };
  
  // Add to DB
  state.banks.push(newBank);
  fetch(`${API_BASE}/banks`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newBank)
  }).catch(console.error);

  addActivity('🏥', `<strong>${name}</strong> registered as a ${type} on RedPulse Nexus.`);
  addNotification('success', '🏥', 'Blood Bank Registered!', `${name} is now listed on the RedPulse Nexus network.`);
  persist();

  // Try to geocode the address using OpenStreetMap Nominatim (free, no key)
  const geocodeQuery = encodeURIComponent(`${address}, India`);
  fetch(`https://nominatim.openstreetmap.org/search?q=${geocodeQuery}&format=json&limit=1`, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'RedPulseNexus-App' }
  })
  .then(r => r.json())
  .then(results => {
    if (results && results.length > 0) {
      newBank.lat = parseFloat(results[0].lat);
      newBank.lng = parseFloat(results[0].lon);
      saveData('bl_banks', state.banks.filter(b => b.registered));
      // Refresh map markers if map is already open
      if (_leafletMap) updateMapMarkers(state.banks);
    }
  })
  .catch(() => {
    // Geocoding failed — assign city-based coordinates so the pin still appears nearby
    const c = randomIndianCoords(address);
    newBank.lat = c.lat;
    newBank.lng = c.lng;
    saveData('bl_banks', state.banks.filter(b => b.registered));
    if (_leafletMap) updateMapMarkers(state.banks);
  });
  persist();
  
  // Auto-login the bank
  state.currentBankId = phone;
  state.currentUserId = null;
  persist();
  document.body.classList.remove('auth-active');
  updateNavAuthUI();
  
  $('modalIcon').textContent = '🏥';
  $('modalTitle').textContent = 'Blood Bank Registered!';
  $('modalMsg').textContent = `${name} is now live on RedPulse Nexus and will appear in the Blood Bank Locator.`;
  $('modalDonorCard').innerHTML = '';
  $('modalOverlay').classList.add('show');
  
  showToast(`${name} registered on RedPulse Nexus! 🏥`, 'success');
  setTimeout(() => showSection('locator'), 2000);
}

/* ─── APPOINTMENT BOOKING ─── */
function bookAppointment(bankId) {
  if (!state.currentUserId) {
    showToast('Please login first to book an appointment.', 'info');
    document.body.classList.add('auth-active');
    return;
  }

  // 2-month cooldown check (from last donation)
  const donor = state.donors.find(d => d.phone === state.currentUserId);
  if (donor?.lastDonation && donor.lastDonation !== 'First donation') {
    const parts = donor.lastDonation.split('/');
    if (parts.length >= 3) {
      const lastDate = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
      const daysSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 60) {
        const daysLeft = Math.ceil(60 - daysSince);
        showToast(`You donated blood recently. You can book again in ${daysLeft} day(s).`, 'error');
        return;
      }
    }
  }

  // One-appointment-at-a-time rule: block if already has an active appointment within 60 days
  let hasActiveAppt = false;
  const now = Date.now();
  state.banks.forEach(bank => {
    (bank.appointments || []).forEach(appt => {
      if (appt.donorPhone === state.currentUserId && (appt.status === 'pending' || appt.status === 'confirmed')) {
        const bookedMs = new Date(appt.bookedAt).getTime();
        if ((now - bookedMs) / (1000 * 60 * 60 * 24) < 60) hasActiveAppt = true;
      }
    });
  });
  if (hasActiveAppt) {
    showToast('You already have an active appointment. You can book another only after 60 days or if it is cancelled/done.', 'error');
    return;
  }
  state._pendingApptBankId = bankId;
  const bank = state.banks.find(b => b.id === bankId);
  $('apptBankName').textContent = bank ? `🏥 ${bank.name}` : '';

  // Auto-fill from donor/user profile (donor already fetched above)
  const user = state.authUsers.find(u => u.phone === state.currentUserId);
  $('apptName').value  = donor?.name  || user?.name  || '';
  $('apptPhone').value = donor?.phone || user?.phone || state.currentUserId;
  if (donor?.blood) $('apptBlood').value = donor.blood;

  // Set minimum date to today
  $('apptDate').min = new Date().toISOString().split('T')[0];
  $('apptDate').value = '';
  $('apptTime').value = '';
  $('apptNote').value = '';

  $('apptModalOverlay').classList.add('show');
}

function closeApptModal() {
  $('apptModalOverlay').classList.remove('show');
  state._pendingApptBankId = null;
}

function confirmAppointment() {
  const bankId = state._pendingApptBankId;
  const bank   = state.banks.find(b => b.id === bankId);
  if (!bank) { showToast('Bank not found.', 'error'); return; }

  const name  = $('apptName').value.trim();
  const phone = $('apptPhone').value.trim();
  const blood = $('apptBlood').value;
  const date  = $('apptDate').value;
  const time  = $('apptTime').value;
  const note  = $('apptNote').value.trim();

  if (!name || !phone || !blood || !date || !time) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }

  const appt = {
    id:      uid('APT'),
    donorName:  name,
    donorPhone: phone,
    blood, date, time, note,
    bookedAt: new Date().toLocaleString(),
    status: 'pending',
  };

  // Save appointment to the bank
  if (!bank.appointments) bank.appointments = [];
  bank.appointments.unshift(appt);
  saveData('bl_banks', state.banks.filter(b => b.registered));

  closeApptModal();
  showToast(`Appointment booked at ${bank.name} on ${date} at ${time}! ✅`, 'success');
  addActivity('📅', `<strong>${name}</strong> booked a donation appointment at <strong>${bank.name}</strong> for ${blood} on ${date} at ${time}.`);
}

/* ─── MODAL ─── */
function closeModal() { $('modalOverlay').classList.remove('show'); }

function resetAllData() {
  if (!confirm('Delete ALL donors, blood banks, users & requests?')) return;
  ['bl_donors','bl_banks','bl_users','bl_requests','bl_notifications','bl_activity','bl_currentUser','bl_currentBank'].forEach(k => localStorage.removeItem(k));
  location.reload();
}

/* ─── AI CHATBOT ─── */
function toggleChatbot() {
  const win = $('chatbotWindow');
  win.classList.toggle('open');
  if (win.classList.contains('open')) {
    setTimeout(() => $('chatInput').focus(), 300);
  }
}

function handleChatKey(e) {
  if (e.key === 'Enter') sendChatMessage();
}

function sendChatMessage() {
  const input = $('chatInput');
  const text = input.value.trim();
  if (!text) return;
  
  appendChatMsg(text, 'user');
  input.value = '';
  
  // Show typing indicator
  const typingId = 'typing-' + Date.now();
  appendChatMsg('<span class="pulse-dot" style="margin-right:2px"></span><span class="pulse-dot" style="animation-delay:0.2s;margin-right:2px"></span><span class="pulse-dot" style="animation-delay:0.4s"></span>', 'bot', typingId);
  
  setTimeout(() => {
    const typingMsg = document.getElementById(typingId);
    if (typingMsg) typingMsg.remove();
    appendChatMsg(getBotResponse(text.toLowerCase()), 'bot');
  }, 1000 + Math.random() * 800);
}

function appendChatMsg(text, sender, id = '') {
  const container = $('chatMessages');
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${sender}`;
  if (id) msgDiv.id = id;
  msgDiv.innerHTML = text;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function getBotResponse(input) {
  const q = input.toLowerCase();
  
  // Extract entities
  const bloodTypeMatch = q.match(/([oab]-|[oab]\+|ab-|ab\+)/i);
  const type = bloodTypeMatch ? bloodTypeMatch[0].toUpperCase() : null;
  
  const componentMatch = q.match(/(plasma|platelet|platelets|rbc|red cell|red cells|whole blood)/i);
  const component = componentMatch ? componentMatch[0].toLowerCase() : null;
  
  const locMatch = q.match(/(?:in|at|near|from|to|closest|nearest|around)\s+(?:to\s+)?([a-z\s]+)(?:$|\?|\.)/i);
  let loc = locMatch ? locMatch[1].trim() : null;
  if (loc && ['me', 'us', 'here', 'the', 'a', 'an', 'is', 'are'].includes(loc)) loc = null;

  const wantDonors = q.includes('donor') || q.includes('person') || q.includes('people');
  const wantBanks = q.includes('bank') || q.includes('hospital') || q.includes('camp');
  
  // 0. Name matching (e.g. "what is blood type of mr x", "mobile number of mr x")
  let nameMatchFound = null;
  for (const d of state.donors) {
    if (d.name && q.includes(d.name.toLowerCase())) {
      nameMatchFound = d;
      break;
    }
  }
  if (nameMatchFound) {
    if (q.includes('phone') || q.includes('mobile') || q.includes('number') || q.includes('contact')) {
      return `The contact number for **${nameMatchFound.name}** is **${nameMatchFound.phone}**.`;
    }
    if (q.includes('blood') || q.includes('type') || q.includes('status') || q.includes('available')) {
      return `**${nameMatchFound.name}** has **${nameMatchFound.blood}** blood and is currently marked as **${nameMatchFound.available ? 'Available' : 'Unavailable'}** in ${nameMatchFound.city || 'their location'}.`;
    }
  }
  
  // 0.5 Bank Name matching (e.g. "how much a- is available in rajveer blood bank", "mobile number of city hospital")
  let bankMatchFound = null;
  for (const b of state.banks) {
    if (b.name && q.includes(b.name.toLowerCase())) {
      bankMatchFound = b;
      break;
    }
  }
  if (bankMatchFound) {
    if (q.includes('phone') || q.includes('mobile') || q.includes('number') || q.includes('contact')) {
      return `The contact number for **${bankMatchFound.name}** is **${bankMatchFound.phone}**.`;
    }
    if (type) {
      const units = (bankMatchFound.stock && bankMatchFound.stock[type]) ? bankMatchFound.stock[type] : 0;
      return `**${bankMatchFound.name}** currently has **${units}** unit(s) of **${type}** blood available.`;
    } else {
      let stockStr = (bankMatchFound.stock && Object.keys(bankMatchFound.stock).length > 0) 
        ? Object.entries(bankMatchFound.stock).map(([t,u]) => `${t}: ${u} unit(s)`).join(', ') 
        : 'no currently recorded stock';
      return `**${bankMatchFound.name}** is located in **${bankMatchFound.city || 'Unknown'}**.\nCurrently available stock: ${stockStr}.`;
    }
  }
  
  // 1. Broad listings (e.g. "which blood bank is registered with you")
  if (q.includes('which') || q.includes('what') || q.includes('list') || q.includes('tell') || q.includes('show') || q.includes('registered') || q.includes('name')) {
    if (wantBanks && !loc && !q.includes('how many')) {
      if (state.banks.length === 0) return "We don't have any blood banks registered yet.";
      const bankNames = state.banks.slice(0, 5).map(b => `• **${b.name}** (${b.city || 'Unknown'})`).join('\n');
      return `We currently have **${state.banks.length}** registered banks/hospitals.\nHere are a few:\n${bankNames}${state.banks.length > 5 ? '\n...and more.' : ''}`;
    }
    if (wantDonors && !loc && !type && !q.includes('how many')) {
      return `We have **${state.donors.length}** donors registered. Try asking for donors in a specific city, or with a specific blood type!`;
    }
  }

  // 2. Location-based queries (Closest/Nearest or In a location)
  if (loc && (wantDonors || wantBanks || type || q.includes('closest') || q.includes('nearest') || q.includes('where') || q.includes('any'))) {
    if (wantBanks || (!wantDonors && q.includes('bank'))) {
      const matchBanks = state.banks.filter(b => 
        (b.city && b.city.toLowerCase().includes(loc)) || 
        (b.address && b.address.toLowerCase().includes(loc))
      );
      if (matchBanks.length === 0) return `I couldn't find any verified blood banks or hospitals in or near **${loc}**.`;
      const bankNames = matchBanks.slice(0, 3).map(b => b.name).join(', ');
      return `We have **${matchBanks.length}** blood bank(s) located near **${loc}**. (e.g., ${bankNames}${matchBanks.length > 3 ? '...' : ''})`;
    } else {
      // Default to donors and bank stock for generic location searches
      let matchDonors = state.donors.filter(d => 
        (d.city && d.city.toLowerCase().includes(loc)) || 
        (d.address && d.address.toLowerCase().includes(loc))
      );
      if (type) matchDonors = matchDonors.filter(d => d.blood === type);
      
      const availableDonors = matchDonors.filter(d => d.available);
      
      // Also check blood bank stock in that location
      let bankStock = 0;
      let banksWithStock = [];
      if (type) {
        state.banks.forEach(b => {
          if ((b.city && b.city.toLowerCase().includes(loc)) || (b.address && b.address.toLowerCase().includes(loc))) {
            if (b.stock && b.stock[type]) {
              bankStock += b.stock[type];
              banksWithStock.push(b.name);
            }
          }
        });
      }
      
      let msg = '';
      if (matchDonors.length === 0 && bankStock === 0) {
        msg = `I couldn't find any ${type ? type + ' ' : ''}donors or blood bank stock in or near **${loc}** right now.`;
      } else {
        msg = `Here is what I found for ${type ? type + ' ' : ''}blood near **${loc}**:\n`;
        if (availableDonors.length > 0) {
          msg += `• **${availableDonors.length}** available donor(s) (Closest: ${availableDonors[0].name}, Ph: ${availableDonors[0].phone})\n`;
        } else if (matchDonors.length > 0) {
          msg += `• **${matchDonors.length}** registered donor(s), but none are marked as currently available.\n`;
        }
        
        if (bankStock > 0) {
          msg += `• **${bankStock}** unit(s) available in blood banks (${banksWithStock.slice(0, 2).join(', ')}${banksWithStock.length > 2 ? '...' : ''})\n`;
        }
      }
      
      return msg;
    }
  }

  // 3. Quantity & Type Queries (How many X blood type, or just how many donors)
  if (q.includes('how many') || q.includes('how much') || q.includes('count')) {
    if (wantBanks) {
      return `We currently have **${state.banks.length}** verified blood banks and hospitals registered in our network!`;
    }
    if (q.includes('request')) {
      const active = state.requests.filter(r => r.status === 'active' || r.status === 'rejected').length;
      return `There are currently **${active}** active blood requests on the platform.`;
    }
    
    // Donor count / Blood type count
    let pool = state.donors;
    if (type) pool = pool.filter(d => d.blood === type);
    
    const available = pool.filter(d => d.available).length;
    
    if (type) {
      let bankStock = 0;
      state.banks.forEach(b => { if (b.stock && b.stock[type]) bankStock += b.stock[type]; });
      return `For **${type}** blood:\n• **${pool.length}** registered donor(s) (**${available}** available now)\n• **${bankStock}** unit(s) available across our blood banks.`;
    } else {
      return `We have a total of **${pool.length}** generous donors registered across the platform, and **${available}** are marked as available to donate right now!`;
    }
  }

  // 4. Simple Availability Check for a Blood Type ("i need o+ blood", "do you have a-")
  const needsBlood = q.includes('need') || q.includes('want') || q.includes('looking for');
  if (type && (needsBlood || q.includes('available') || q.includes('have') || q.includes('is there') || q.includes('which'))) {
    const donorCount = state.donors.filter(d => d.blood === type && d.available).length;
    let bankStock = 0;
    state.banks.forEach(b => { if (b.stock && b.stock[type]) bankStock += b.stock[type]; });
    
    if (donorCount === 0 && bankStock === 0) {
      return `Currently, we don't have any available donors or blood bank stock for **${type}** blood. If it's an emergency, please submit a blood request on the platform!`;
    }
    return `Yes! For **${type}** blood we currently have:\n• **${donorCount}** available donor(s)\n• **${bankStock}** unit(s) in blood banks.\n\nYou can go to the "Find Blood Bank" section to see exactly where it is!`;
  }

  // 5. Static FAQs
  if (q.includes('hi ') || q.includes('hello') || q === 'hi') return "Hello there! 🩸 Try asking me:\n- 'How many A+ donors are available?'\n- 'Which donor is closest to Delhi?'\n- 'Which blood banks are registered?'";
  if (q.includes('who can') || q.includes('eligib')) return "Most healthy adults aged 18-65 weighing at least 50kg can donate blood. Hemoglobin levels will be checked at the bank.";
  if (q.includes('how often')) return "You can safely donate whole blood every 3 months (90 days). RedPulse Nexus enforces a 60-day resting cooldown across all banks.";
  
  return "I'm connected directly to the network data! Try asking me:\n• 'What is the blood type of [Donor Name]?'\n• 'Which blood banks are registered?'\n• 'How many O+ donors do you have?'";
}

/* ─── THEME TOGGLE ─── */
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('bl_theme', newTheme);
  const themeIcon = $('themeIcon');
  if (themeIcon) themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

/* ─── INIT ─── */
async function init() {
  await loadMongoData();

  // Hide emergency banner on load (only show when real emergency is submitted)
  $('emergencyBanner').style.display = 'none';
  document.querySelector('.navbar').classList.add('no-banner');

  // Load theme preference
  const savedTheme = localStorage.getItem('bl_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeIcon = $('themeIcon');
  if (themeIcon) themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

  renderBloodGrid();
  renderDonorTable();
  renderNotifications();
  updateHeroStats();
  updateNavAuthUI();
  
  checkMyCompletedRequests(); // Check active completions on loaded data
}

document.addEventListener('DOMContentLoaded', init);
