// ============================================================
// NexCare HMS — Backend Server
// SQLite-compatible validation (no mode:'insensitive')
// All checks done via JS toLowerCase comparison
// ============================================================
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma     = new PrismaClient({});
const app        = express();
const PORT       = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nexcare-secret-2024';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ──────────────────────────────────────────────────
const norm   = (s) => (s || '').trim().toLowerCase();
const badReq = (res, msg) => res.status(400).json({ error: msg });

// ── DEPARTMENTS ───────────────────────────────────────────────
app.get('/api/departments', async (_req, res) => {
  res.json(await prisma.department.findMany({ orderBy: { name: 'asc' } }));
});

app.post('/api/departments', async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return badReq(res, 'Department name is required.');

  const all = await prisma.department.findMany({ select: { name: true } });
  if (all.some(d => norm(d.name) === norm(name)))
    return res.status(409).json({ error: `Department "${name}" already exists.` });

  res.status(201).json(await prisma.department.create({ data: { name } }));
});

// ── PATIENTS ──────────────────────────────────────────────────
app.get('/api/patients', async (_req, res) => {
  res.json(await prisma.patient.findMany({ orderBy: { name: 'asc' } }));
});

app.post('/api/patients', async (req, res) => {
  const trimName    = (req.body.name || '').trim();
  const trimContact = (req.body.contactDetails || '').trim();
  if (!trimName) return badReq(res, 'Patient name is required.');

  const all = await prisma.patient.findMany({ select: { id: true, name: true, contactDetails: true } });
  const dup = all.find(p =>
    norm(p.name) === norm(trimName) &&
    norm(p.contactDetails || '') === norm(trimContact)
  );
  if (dup) return res.status(409).json({
    error: `Patient "${trimName}" with the same contact already exists (ID: ${dup.id}).`
  });

  res.status(201).json(await prisma.patient.create({
    data: { name: trimName, contactDetails: trimContact || null, address: (req.body.address || '').trim() || null }
  }));
});

// ── DOCTORS ───────────────────────────────────────────────────
app.get('/api/doctors', async (_req, res) => {
  res.json(await prisma.doctor.findMany({ include: { department: true }, orderBy: { name: 'asc' } }));
});

app.post('/api/doctors', async (req, res) => {
  const trimName = (req.body.name || '').trim();
  const trimSpec  = (req.body.specialty || '').trim();
  if (!trimName)        return badReq(res, 'Doctor name is required.');
  if (!req.body.departmentId) return badReq(res, 'Department is required.');

  const deptId = parseInt(req.body.departmentId, 10);
  const dept   = await prisma.department.findUnique({ where: { id: deptId } });
  if (!dept) return badReq(res, 'Selected department does not exist.');

  const all = await prisma.doctor.findMany({ where: { departmentId: deptId }, select: { name: true, specialty: true } });
  const dup = all.find(d => norm(d.name) === norm(trimName) && norm(d.specialty || '') === norm(trimSpec));
  if (dup) return res.status(409).json({
    error: `Dr. "${trimName}" (${trimSpec || 'no specialty'}) is already in ${dept.name}.`
  });

  res.status(201).json(await prisma.doctor.create({
    data: { name: trimName, specialty: trimSpec || null, contactInformation: (req.body.contactInformation || '').trim() || null, departmentId: deptId }
  }));
});

// ── STAFF ─────────────────────────────────────────────────────
app.get('/api/staff', async (_req, res) => {
  res.json(await prisma.staff.findMany({ include: { department: true }, orderBy: { name: 'asc' } }));
});

app.post('/api/staff', async (req, res) => {
  const trimName = (req.body.name || '').trim();
  const trimPos  = (req.body.position || '').trim();
  if (!trimName) return badReq(res, 'Staff name is required.');
  if (!trimPos)  return badReq(res, 'Position/Role is required.');
  if (!req.body.departmentId) return badReq(res, 'Department is required.');

  const deptId = parseInt(req.body.departmentId, 10);
  const all = await prisma.staff.findMany({ where: { departmentId: deptId }, select: { name: true, position: true } });
  const dup = all.find(s => norm(s.name) === norm(trimName) && norm(s.position || '') === norm(trimPos));
  if (dup) return res.status(409).json({ error: `"${trimName}" as ${trimPos} already exists in this department.` });

  res.status(201).json(await prisma.staff.create({
    data: { name: trimName, position: trimPos, contactDetails: (req.body.contactDetails || '').trim() || null, departmentId: deptId }
  }));
});

// ── APPOINTMENTS ──────────────────────────────────────────────
app.get('/api/appointments', async (_req, res) => {
  res.json(await prisma.appointment.findMany({ include: { doctor: true, patients: true }, orderBy: { appointmentDate: 'asc' } }));
});

app.post('/api/appointments', async (req, res) => {
  const { appointmentDate, doctorId, patientIds, notes } = req.body;
  if (!appointmentDate)  return badReq(res, 'Appointment date is required.');
  if (!doctorId)         return badReq(res, 'Doctor is required.');
  if (!patientIds?.length) return badReq(res, 'Patient is required.');

  const apptDate = new Date(appointmentDate);
  if (isNaN(apptDate.getTime())) return badReq(res, 'Invalid date.');
  if (apptDate < new Date())     return badReq(res, 'Appointment must be in the future.');

  const docId = parseInt(doctorId, 10);
  const patId = parseInt(patientIds[0], 10);
  const W0 = new Date(apptDate.getTime() - 30 * 60000);
  const W1 = new Date(apptDate.getTime() + 30 * 60000);

  const docConflict = await prisma.appointment.findFirst({ where: { doctorId: docId, appointmentDate: { gte: W0, lte: W1 } } });
  if (docConflict) return res.status(409).json({ error: 'This doctor is already booked within ±30 minutes of this slot.' });

  const patConflict = await prisma.appointment.findFirst({ where: { appointmentDate: { gte: W0, lte: W1 }, patients: { some: { id: patId } } } });
  if (patConflict) return res.status(409).json({ error: 'This patient already has an appointment within ±30 minutes.' });

  res.status(201).json(await prisma.appointment.create({
    data: { appointmentDate: apptDate, doctorId: docId, notes: (notes || '').trim() || null, patients: { connect: [{ id: patId }] } }
  }));
});

// ── RECORDS (EHR) ─────────────────────────────────────────────
app.get('/api/records', async (_req, res) => {
  res.json(await prisma.medicalRecord.findMany({ include: { patient: true }, orderBy: { createdAt: 'desc' } }));
});

app.get('/api/records/patient/:patientId', async (req, res) => {
  const record = await prisma.medicalRecord.findUnique({
    where: { patientId: parseInt(req.params.patientId, 10) }, include: { patient: true }
  });
  res.json(record || null);
});

app.post('/api/records', async (req, res) => {
  const { patientId, doctorId, diagnosis, treatment, notes } = req.body;
  if (!patientId)         return badReq(res, 'Patient is required.');
  if (!diagnosis?.trim()) return badReq(res, 'Diagnosis is required.');
  if (!treatment?.trim()) return badReq(res, 'Treatment plan is required.');

  const patId = parseInt(patientId, 10);
  const patient = await prisma.patient.findUnique({ where: { id: patId } });
  if (!patient) return badReq(res, 'Patient not found.');

  const record = await prisma.medicalRecord.upsert({
    where:  { patientId: patId },
    update: { doctorId: doctorId ? parseInt(doctorId, 10) : null, diagnosis: diagnosis.trim(), treatment: treatment.trim(), notes: (notes || '').trim() || null },
    create: { patientId: patId, doctorId: doctorId ? parseInt(doctorId, 10) : null, diagnosis: diagnosis.trim(), treatment: treatment.trim(), notes: (notes || '').trim() || null }
  });
  res.status(200).json({ ...record, updated: true });
});

// ── INVENTORY ─────────────────────────────────────────────────
app.get('/api/inventory', async (_req, res) => {
  res.json(await prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } }));
});

app.post('/api/inventory', async (req, res) => {
  const trimName = (req.body.name || '').trim();
  const trimCat  = (req.body.category || '').trim();
  const qty      = parseInt(req.body.quantity, 10);
  const price    = parseFloat(req.body.unitPrice) || 0;
  const threshold = parseInt(req.body.minThreshold, 10) || 10;

  if (!trimName)          return badReq(res, 'Item name is required.');
  if (isNaN(qty) || qty < 0) return badReq(res, 'Quantity must be ≥ 0.');
  if (price < 0)          return badReq(res, 'Unit price cannot be negative.');

  const all = await prisma.inventoryItem.findMany({ select: { id: true, name: true, category: true, quantity: true } });
  const existing = all.find(i => norm(i.name) === norm(trimName) && norm(i.category || '') === norm(trimCat));
  if (existing) {
    const updated = await prisma.inventoryItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + qty } });
    return res.status(200).json({ ...updated, restocked: true, message: `Added ${qty} units — new total: ${updated.quantity}.` });
  }

  res.status(201).json(await prisma.inventoryItem.create({
    data: { name: trimName, category: trimCat || null, quantity: qty, minThreshold: threshold, unitPrice: price }
  }));
});

// ── BILLING ───────────────────────────────────────────────────
app.get('/api/billing', async (_req, res) => {
  res.json(await prisma.invoice.findMany({ include: { patient: true }, orderBy: { createdAt: 'desc' } }));
});

app.get('/api/billing/patient/:patientId', async (req, res) => {
  res.json(await prisma.invoice.findMany({ where: { patientId: parseInt(req.params.patientId, 10) }, orderBy: { createdAt: 'desc' } }));
});

app.post('/api/billing', async (req, res) => {
  const { patientId, totalAmount, status } = req.body;
  if (!patientId) return badReq(res, 'Patient is required.');
  const amount = parseFloat(totalAmount);
  if (isNaN(amount) || amount <= 0) return badReq(res, 'Amount must be a positive number.');
  if (!['Unpaid', 'Partial', 'Paid'].includes(status)) return badReq(res, 'Invalid status.');

  const patId = parseInt(patientId, 10);
  const patient = await prisma.patient.findUnique({ where: { id: patId } });
  if (!patient) return badReq(res, 'Patient not found.');

  if (status !== 'Paid') {
    const active = await prisma.invoice.findFirst({ where: { patientId: patId, status: { in: ['Unpaid', 'Partial'] } } });
    if (active) return res.status(409).json({
      error: `${patient.name} has an active invoice (#${active.id}) for $${active.totalAmount.toFixed(2)} [${active.status}]. Settle it first, or create a new "Paid" invoice.`
    });
  }

  res.status(201).json(await prisma.invoice.create({ data: { patientId: patId, totalAmount: amount, status } }));
});

app.patch('/api/billing/:id', async (req, res) => {
  const { status } = req.body;
  if (!['Unpaid', 'Partial', 'Paid'].includes(status)) return badReq(res, 'Invalid status.');
  try {
    res.json(await prisma.invoice.update({ where: { id: parseInt(req.params.id, 10) }, data: { status } }));
  } catch { res.status(404).json({ error: 'Invoice not found.' }); }
});

// ── AUTH ──────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username?.trim() || !password) return badReq(res, 'Username and password are required.');
  const userRole = ['Admin', 'Doctor', 'Receptionist'].includes(role) ? role : 'Receptionist';
  try {
    const user = await prisma.user.create({ data: { username: username.trim(), password: await bcrypt.hash(password, 10), role: userRole } });
    res.status(201).json({ message: 'Registered', userId: user.id });
  } catch { res.status(409).json({ error: 'Username already exists.' }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return badReq(res, 'Username and password required.');
  const user = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ error: 'Invalid password.' });
  const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, role: user.role, username: user.username });
});

// ── SEED & START ──────────────────────────────────────────────
async function seedAdmin() {
  const exists = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!exists) {
    await prisma.user.create({ data: { username: 'admin', password: await bcrypt.hash('admin123', 10), role: 'Admin' } });
    console.log('\n┌─────────────────────────────────┐');
    console.log('│   Default Admin Account Created  │');
    console.log('│   Username : admin               │');
    console.log('│   Password : admin123            │');
    console.log('└─────────────────────────────────┘\n');
  }
}


seedAdmin().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ NexCare HMS running on port ${PORT}`);
  });
});
