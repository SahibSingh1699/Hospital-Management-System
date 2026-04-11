// ============================================================
// NexCare HMS — app.js v3
// Full data consistency enforced on frontend + backend
// ============================================================

const API_BASE = '/api';

// ── Toast ────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  let tc = document.getElementById('toastContainer');
  if (!tc) { tc = document.createElement('div'); tc.id = 'toastContainer'; document.body.appendChild(tc); }
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  tc.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 4000);
}

// ── Inline Alert ─────────────────────────────────────────────
function showAlert(id, msg, type = 'warning') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `alert alert-${type} show`;
}
function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) { el.textContent = ''; el.className = 'alert'; }
}

// ── Navigation ───────────────────────────────────────────────
function setActiveNav(targetId) {
  document.querySelectorAll('.nav-item').forEach(a => {
    a.classList.toggle('active', a.getAttribute('data-target') === targetId);
  });
}
function navigateTo(targetId) {
  document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(targetId);
  if (target) target.classList.add('active');
  setActiveNav(targetId);
  fetchData();
}
document.querySelectorAll('.nav-item').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const id = e.currentTarget.getAttribute('data-target');
    history.replaceState(null, '', `#${id}`);
    navigateTo(id);
  });
});
window.addEventListener('hashchange', () => {
  navigateTo(window.location.hash.substring(1) || 'dashboard');
});

// Hamburger
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  toggle?.addEventListener('click', () => {
    links.classList.toggle('nav-open');
    toggle.classList.toggle('open');
  });
  links?.querySelectorAll('.nav-item').forEach(a => {
    a.addEventListener('click', () => { links.classList.remove('nav-open'); toggle.classList.remove('open'); });
  });
});

// ── Data Cache ────────────────────────────────────────────────
const cache = { patients: [], doctors: [], departments: [], inventory: [], billing: [] };

// ── Fetch All Data ────────────────────────────────────────────
async function fetchData() {
  try {
    const [patients, doctors, departments, appointments, staff, records, inventory, billing] = await Promise.all([
      fetch(`${API_BASE}/patients`).then(r => r.json()),
      fetch(`${API_BASE}/doctors`).then(r => r.json()),
      fetch(`${API_BASE}/departments`).then(r => r.json()),
      fetch(`${API_BASE}/appointments`).then(r => r.json()),
      fetch(`${API_BASE}/staff`).then(r => r.json()),
      fetch(`${API_BASE}/records`).then(r => r.json()),
      fetch(`${API_BASE}/inventory`).then(r => r.json()),
      fetch(`${API_BASE}/billing`).then(r => r.json()),
    ]);

    Object.assign(cache, { patients, doctors, departments, inventory, billing });

    // Metrics
    set('count-patients',     patients.length);
    set('count-doctors',      doctors.length);
    set('count-departments',  departments.length);
    set('count-appointments', appointments.length);

    // Tables
    renderDepartments(departments);
    renderDoctors(doctors);
    renderPatients(patients);
    renderAppointments(appointments);
    renderStaff(staff);
    renderRecords(records);
    renderInventory(inventory);
    renderBilling(billing);

    // Selects
    populateSelect('docDepartment',   departments);
    populateSelect('staffDepartment', departments);
    populateSelect('appPatient',      patients);
    populateSelect('appDoctor',       doctors);
    populateSelect('recPatient',      patients);
    populateSelect('recDoctor',       doctors);
    populateSelect('billPatient',     patients);
  } catch (err) {
    console.error('Fetch error:', err);
    showToast('Could not connect to server. Is the backend running?', 'error');
  }
}

function set(id, val) { const e = document.getElementById(id); if (e) e.innerText = val; }

// ── Render Helpers ────────────────────────────────────────────
function renderTable(id, rows) {
  const tbody = document.getElementById(id);
  if (!tbody) return;
  tbody.innerHTML = rows.length ? rows.join('') :
    `<tr><td colspan="10"><div class="table-empty"><span class="empty-icon">📭</span>No records yet</div></td></tr>`;
}

function renderDepartments(data) {
  renderTable('departmentTableBody', data.map(d => `<tr><td>${d.id}</td><td>${esc(d.name)}</td></tr>`));
}
function renderDoctors(data) {
  renderTable('doctorTableBody', data.map(d =>
    `<tr><td>Dr. ${esc(d.name)}</td><td>${esc(d.specialty || '—')}</td><td>${esc(d.department?.name || '—')}</td></tr>`));
}
function renderPatients(data) {
  renderTable('patientTableBody', data.map(p =>
    `<tr><td>${p.id}</td><td>${esc(p.name)}</td><td>${esc(p.contactDetails || '—')}</td></tr>`));
}
function renderAppointments(data) {
  renderTable('appointmentTableBody', data.map(a => {
    const isPast = new Date(a.appointmentDate) < new Date();
    return `<tr>
      <td>${new Date(a.appointmentDate).toLocaleString()}</td>
      <td>${esc(a.patients.map(p => p.name).join(', '))}</td>
      <td>Dr. ${esc(a.doctor.name)}</td>
    </tr>`;
  }));
}
function renderStaff(data) {
  renderTable('staffTableBody', data.map(s =>
    `<tr><td>${esc(s.name)}</td><td>${esc(s.position || '—')}</td><td>${esc(s.department?.name || '—')}</td></tr>`));
}
function renderRecords(data) {
  renderTable('recordTableBody', data.map(r =>
    `<tr>
      <td>${esc(r.patient?.name || '—')}</td>
      <td>${esc(r.diagnosis || '—')}</td>
      <td>${esc(r.treatment || '—')}</td>
      <td>${new Date(r.createdAt).toLocaleDateString()}</td>
    </tr>`));
}
function renderInventory(data) {
  const lowCount = data.filter(i => i.quantity <= i.minThreshold).length;
  const badge = document.getElementById('lowStockBadge');
  if (badge) badge.innerHTML = lowCount > 0 ? `<span class="badge badge-danger">${lowCount} Low Stock</span>` : '';

  renderTable('inventoryTableBody', data.map(i => {
    const low = i.quantity <= i.minThreshold;
    return `<tr>
      <td>${esc(i.name)}</td>
      <td>${esc(i.category || '—')}</td>
      <td>${i.quantity}</td>
      <td>$${parseFloat(i.unitPrice).toFixed(2)}</td>
      <td><span class="badge ${low ? 'badge-danger' : 'badge-success'}">${low ? '⚠ Low' : '✓ OK'}</span></td>
    </tr>`;
  }));
}
function renderBilling(data) {
  const badgeMap = { Paid: 'badge-success', Partial: 'badge-warning', Unpaid: 'badge-danger' };
  renderTable('billingTableBody', data.map(b => `<tr>
    <td>#${b.id}</td>
    <td>${esc(b.patient?.name || '—')}</td>
    <td>$${parseFloat(b.totalAmount).toFixed(2)}</td>
    <td><span class="badge ${badgeMap[b.status] || 'badge-info'}">${b.status}</span></td>
    <td>
      <select class="status-select" data-id="${b.id}" onchange="updateInvoiceStatus(${b.id}, this.value)">
        <option ${b.status==='Unpaid'?'selected':''}>Unpaid</option>
        <option ${b.status==='Partial'?'selected':''}>Partial</option>
        <option ${b.status==='Paid'?'selected':''}>Paid</option>
      </select>
    </td>
  </tr>`));
}

function populateSelect(id, data) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const curr = sel.value;
  const def = sel.options[0];
  sel.innerHTML = '';
  sel.appendChild(def);
  data.forEach(item => {
    const o = document.createElement('option');
    o.value = item.id;
    o.textContent = item.name;
    sel.appendChild(o);
  });
  if (curr) sel.value = curr;
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── API Helpers ───────────────────────────────────────────────
async function apiPost(endpoint, data) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}
async function apiPatch(endpoint, data) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
}

// ── Inline Invoice Status Update ──────────────────────────────
async function updateInvoiceStatus(id, status) {
  const { ok, body } = await apiPatch(`/billing/${id}`, { status });
  if (ok) {
    showToast(`Invoice #${id} updated to ${status}.`, 'success');
    fetchData();
  } else {
    showToast(body.error || 'Failed to update status.', 'error');
    fetchData(); // revert UI
  }
}

// ── Form: Departments ─────────────────────────────────────────
document.getElementById('departmentForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  hideAlert('deptAlert');
  const name = document.getElementById('deptName').value.trim();
  if (!name) { showAlert('deptAlert', 'Department name is required.'); return; }

  const { ok, body } = await apiPost('/departments', { name });
  if (ok) {
    showToast(`Department "${name}" created!`);
    e.target.reset();
    fetchData();
  } else {
    showAlert('deptAlert', body.error || 'Failed to create department.');
  }
});

// ── Form: Doctors ─────────────────────────────────────────────
document.getElementById('doctorForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  hideAlert('docAlert');
  const name  = document.getElementById('docName').value.trim();
  const deptId = document.getElementById('docDepartment').value;
  if (!name)  { showAlert('docAlert', 'Doctor name is required.'); return; }
  if (!deptId){ showAlert('docAlert', 'Please select a department.'); return; }

  const { ok, body } = await apiPost('/doctors', {
    name, specialty: document.getElementById('docSpecialty').value,
    contactInformation: document.getElementById('docContact').value, departmentId: deptId
  });
  if (ok) { showToast(`Dr. ${name} registered!`); e.target.reset(); fetchData(); }
  else showAlert('docAlert', body.error || 'Failed to register doctor.');
});

// ── Form: Staff ───────────────────────────────────────────────
document.getElementById('staffForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  hideAlert('staffAlert');
  const name = document.getElementById('staffName').value.trim();
  const pos  = document.getElementById('staffPosition').value.trim();
  const dept = document.getElementById('staffDepartment').value;
  if (!name) { showAlert('staffAlert', 'Staff name is required.'); return; }
  if (!pos)  { showAlert('staffAlert', 'Position/Role is required.'); return; }
  if (!dept) { showAlert('staffAlert', 'Please select a department.'); return; }

  const { ok, body } = await apiPost('/staff', {
    name, position: pos, contactDetails: document.getElementById('staffContact').value, departmentId: dept
  });
  if (ok) { showToast(`${name} added to staff!`); e.target.reset(); fetchData(); }
  else showAlert('staffAlert', body.error || 'Failed to add staff member.');
});

// ── Form: Patients ────────────────────────────────────────────
document.getElementById('patientForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  hideAlert('patAlert');
  const name = document.getElementById('patName').value.trim();
  if (!name) { showAlert('patAlert', 'Patient name is required.'); return; }

  const { ok, body } = await apiPost('/patients', {
    name, contactDetails: document.getElementById('patContact').value,
    address: document.getElementById('patAddress').value
  });
  if (ok) { showToast(`Patient ${name} registered!`); e.target.reset(); fetchData(); }
  else showAlert('patAlert', body.error || 'Failed to register patient.');
});

// ── Form: Appointments ────────────────────────────────────────
document.getElementById('appointmentForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  hideAlert('apptAlert');
  const date    = document.getElementById('appDate').value;
  const patient = document.getElementById('appPatient').value;
  const doctor  = document.getElementById('appDoctor').value;

  if (!date)   { showAlert('apptAlert', 'Please pick a date and time.'); return; }
  if (new Date(date) < new Date()) { showAlert('apptAlert', 'Appointment date must be in the future.'); return; }
  if (!patient){ showAlert('apptAlert', 'Please select a patient.'); return; }
  if (!doctor) { showAlert('apptAlert', 'Please select a doctor.'); return; }

  const { ok, body } = await apiPost('/appointments', {
    appointmentDate: date, doctorId: doctor, patientIds: [patient],
    notes: document.getElementById('appNotes').value
  });
  if (ok) { showToast('Appointment scheduled!'); e.target.reset(); fetchData(); }
  else showAlert('apptAlert', body.error || 'Failed to schedule appointment.');
});

// ── Form: EHR (load existing on patient change) ───────────────
document.getElementById('recPatient')?.addEventListener('change', async function () {
  const patientId = this.value;
  if (!patientId) {
    document.getElementById('ehrFormTitle').textContent = 'Create EHR';
    document.getElementById('ehrSubmitBtn').textContent = '💾 Save Health Record';
    showAlert('ehrAlert', 'Select a patient to check for an existing record.', 'info');
    document.getElementById('recDiagnosis').value = '';
    document.getElementById('recTreatment').value = '';
    document.getElementById('recDoctor').value = '';
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/records/patient/${patientId}`);
    const record = await res.json();
    if (record) {
      document.getElementById('recDiagnosis').value = record.diagnosis || '';
      document.getElementById('recTreatment').value = record.treatment || '';
      if (record.doctorId) document.getElementById('recDoctor').value = record.doctorId;
      document.getElementById('ehrFormTitle').textContent = 'Update EHR';
      document.getElementById('ehrSubmitBtn').textContent = '✏️ Update Health Record';
      showAlert('ehrAlert', '⚠️ This patient already has a health record. Submitting will update it.', 'warning');
    } else {
      document.getElementById('ehrFormTitle').textContent = 'Create EHR';
      document.getElementById('ehrSubmitBtn').textContent = '💾 Save Health Record';
      showAlert('ehrAlert', '✅ No existing record found. A new EHR will be created.', 'success');
      document.getElementById('recDiagnosis').value = '';
      document.getElementById('recTreatment').value = '';
    }
  } catch {
    hideAlert('ehrAlert');
  }
});

document.getElementById('recordForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const patient = document.getElementById('recPatient').value;
  const diagnosis = document.getElementById('recDiagnosis').value.trim();
  const treatment = document.getElementById('recTreatment').value.trim();

  if (!patient)   { showAlert('ehrAlert', 'Please select a patient.', 'warning'); return; }
  if (!diagnosis) { showToast('Diagnosis is required.', 'error'); return; }
  if (!treatment) { showToast('Treatment plan is required.', 'error'); return; }

  const { ok, body } = await apiPost('/records', {
    patientId: patient, doctorId: document.getElementById('recDoctor').value,
    diagnosis, treatment
  });
  if (ok) {
    const msg = body.updated ? 'EHR updated successfully!' : 'EHR created successfully!';
    showToast(msg);
    e.target.reset();
    document.getElementById('ehrFormTitle').textContent = 'Create EHR';
    document.getElementById('ehrSubmitBtn').textContent = '💾 Save Health Record';
    showAlert('ehrAlert', 'Select a patient to check for an existing record.', 'info');
    fetchData();
  }
  else showToast(body.error || 'Failed to save EHR.', 'error');
});

// ── Form: Inventory ───────────────────────────────────────────
document.getElementById('inventoryForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  hideAlert('invAlert');
  const name = document.getElementById('invName').value.trim();
  const qty  = document.getElementById('invQuantity').value;
  if (!name)          { showAlert('invAlert', 'Item name is required.'); return; }
  if (!qty || qty < 0){ showAlert('invAlert', 'Quantity must be 0 or more.'); return; }

  const { ok, body } = await apiPost('/inventory', {
    name, category: document.getElementById('invCategory').value,
    quantity: qty, unitPrice: document.getElementById('invPrice').value, minThreshold: 10
  });
  if (ok) {
    if (body.restocked) {
      showToast(`Restocked! ${body.message}`, 'info');
    } else {
      showToast(`"${name}" added to inventory!`);
    }
    e.target.reset();
    document.getElementById('invQuantity').value = 1;
    document.getElementById('invPrice').value = 0;
    fetchData();
  } else showAlert('invAlert', body.error || 'Failed to add item.');
});

// ── Form: Billing (check existing on patient select) ──────────
document.getElementById('billPatient')?.addEventListener('change', async function () {
  const patientId = this.value;
  const alertEl = document.getElementById('billExistingAlert');
  const submitBtn = document.getElementById('billSubmitBtn');
  if (!patientId) { if (alertEl) alertEl.style.display = 'none'; return; }

  try {
    const res = await fetch(`${API_BASE}/billing/patient/${patientId}`);
    const invoices = await res.json();
    const active = invoices.find(i => i.status === 'Unpaid' || i.status === 'Partial');
    if (active && alertEl) {
      alertEl.className = 'alert alert-warning show';
      alertEl.textContent = `⚠️ Active invoice #${active.id} exists for $${parseFloat(active.totalAmount).toFixed(2)} (${active.status}). A new invoice with Unpaid/Partial status will be blocked. Settle it first, or create a Paid invoice only.`;
      alertEl.style.display = 'flex';
      if (submitBtn) submitBtn.textContent = '🧾 Generate Paid Invoice Only';
    } else {
      if (alertEl) alertEl.style.display = 'none';
      if (submitBtn) submitBtn.textContent = '🧾 Generate Invoice';
    }
  } catch { if (alertEl) alertEl.style.display = 'none'; }
});

document.getElementById('billingForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  hideAlert('billAlert');
  const patient = document.getElementById('billPatient').value;
  const amount  = document.getElementById('billAmount').value;
  const status  = document.getElementById('billStatus').value;

  if (!patient)          { showAlert('billAlert', 'Please select a patient.'); return; }
  if (!amount || amount <= 0) { showAlert('billAlert', 'Amount must be greater than $0.'); return; }

  const { ok, body } = await apiPost('/billing', { patientId: patient, totalAmount: amount, status });
  if (ok) {
    showToast('Invoice created!');
    e.target.reset();
    document.getElementById('billExistingAlert').style.display = 'none';
    document.getElementById('billSubmitBtn').textContent = '🧾 Generate Invoice';
    fetchData();
  } else showAlert('billAlert', body.error || 'Failed to generate invoice.');
});

// ── Auth ──────────────────────────────────────────────────────
(function initAuth() {
  if (localStorage.getItem('hms_token')) {
    document.getElementById('authOverlay').style.display = 'none';
    navigateTo(window.location.hash.substring(1) || 'dashboard');
  }
})();

document.getElementById('loginForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('loginErr');
  errEl.style.display = 'none';
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: document.getElementById('loginUser').value, password: document.getElementById('loginPass').value })
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('hms_token', data.token);
      document.getElementById('authOverlay').style.display = 'none';
      navigateTo('dashboard');
    } else {
      const body = await res.json().catch(() => ({}));
      errEl.textContent = body.error || 'Invalid credentials.';
      errEl.style.display = 'block';
    }
  } catch {
    errEl.textContent = 'Server unreachable. Is node server.js running?';
    errEl.style.display = 'block';
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('hms_token');
  window.location.reload();
});
