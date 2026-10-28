import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const SEED_FILE = path.join(DATA_DIR, 'seed.json');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure DB file exists
function getDb() {
  if (!fs.existsSync(DB_FILE)) {
    if (fs.existsSync(SEED_FILE)) {
      fs.copyFileSync(SEED_FILE, DB_FILE);
    } else {
      throw new Error('Seed file missing');
    }
  }
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(raw);
}

function saveDb(data: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

const app = express();
app.use(cors());
app.use(express.json());

// Helper to calculate need metrics
function calculateNeedMetrics(need: any, db: any) {
  const camp = db.camps.find((c: any) => c.id === need.camp_id);
  const item = db.inventory.find((i: any) => i.id === need.inventory_item_id);

  // Sum pending and in-transit dispatches for this need
  const relevantDispatches = db.dispatches.filter(
    (d: any) => d.need_id === need.id && (d.status === 'Pending' || d.status === 'In Transit')
  );
  const reserved_quantity = relevantDispatches.reduce((acc: number, d: any) => acc + d.quantity, 0);

  const fulfilled_quantity = Number(need.fulfilled_quantity || 0);
  const required_quantity = Number(need.required_quantity || 0);

  const unallocated = Math.max(0, required_quantity - fulfilled_quantity - reserved_quantity);

  const delivered_pct = required_quantity > 0 ? Math.min(100, Math.round((fulfilled_quantity / required_quantity) * 100)) : 0;
  const committed_pct = required_quantity > 0 ? Math.min(100 - delivered_pct, Math.round((reserved_quantity / required_quantity) * 100)) : 0;
  const unallocated_pct = Math.max(0, 100 - delivered_pct - committed_pct);

  // Determine suggested next action
  let suggested_action = '';
  let action_type: 'allocate' | 'source' | 'followup' | 'gap' | 'fulfilled' = 'allocate';

  const stock = item ? Number(item.stock) : 0;
  const unit = item ? item.unit : 'units';

  if (delivered_pct >= 100) {
    suggested_action = 'Fulfilment complete';
    action_type = 'fulfilled';
  } else if (unallocated === 0 && reserved_quantity > 0) {
    suggested_action = `Follow up ${reserved_quantity} ${unit} in transit/pending`;
    action_type = 'followup';
  } else if (stock >= unallocated && unallocated > 0) {
    suggested_action = `Dispatch ${unallocated} ${unit} from warehouse`;
    action_type = 'allocate';
  } else if (stock > 0 && unallocated > 0) {
    suggested_action = `Reserve ${stock} ${unit} in warehouse`;
    action_type = 'gap';
  } else {
    suggested_action = `Source ${unallocated} ${unit} with suppliers`;
    action_type = 'source';
  }

  return {
    ...need,
    camp,
    item,
    reserved_quantity,
    unallocated,
    delivered_pct,
    committed_pct,
    unallocated_pct,
    suggested_action,
    action_type,
  };
}

// ---------------------------------------------------------------------
// HEALTH & RESET
// ---------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    mode: 'development_mock_api',
    persistent: true,
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/reset', (req, res) => {
  if (fs.existsSync(SEED_FILE)) {
    fs.copyFileSync(SEED_FILE, DB_FILE);
    const db = getDb();
    return res.json({ message: 'Database reset to verified seed dataset successfully', stats: db });
  }
  res.status(500).json({ error: 'Seed data file not found' });
});

// ---------------------------------------------------------------------
// STATS / KPI AGGREGATION
// ---------------------------------------------------------------------
app.get('/api/stats', (req, res) => {
  const db = getDb();
  const districtFilter = req.query.district as string;

  let camps = db.camps;
  if (districtFilter && districtFilter !== 'all') {
    camps = camps.filter((c: any) => c.district.toLowerCase() === districtFilter.toLowerCase());
  }

  const campIds = new Set(camps.map((c: any) => c.id));

  const activeCamps = camps.filter((c: any) => c.status === 'Active' || c.status === 'Full');
  const familiesSheltered = activeCamps.reduce((sum: number, c: any) => sum + Number(c.current_families || 0), 0);
  const totalCapacity = activeCamps.reduce((sum: number, c: any) => sum + Number(c.capacity || 0), 0);

  // Relevant needs
  const relevantNeeds = db.needs
    .filter((n: any) => campIds.has(n.camp_id))
    .map((n: any) => calculateNeedMetrics(n, db));

  const avgFulfilment =
    relevantNeeds.length > 0
      ? Math.round(relevantNeeds.reduce((sum: number, n: any) => sum + n.delivered_pct, 0) / relevantNeeds.length)
      : 0;

  // Inventory stats
  const lowStockItems = db.inventory.filter((i: any) => Number(i.stock) <= Number(i.reorder_level));
  const lowStockCategories = new Set(lowStockItems.map((i: any) => i.category)).size;

  // Volunteers deployed
  const volunteers = db.volunteers;
  const deployedVolunteers = volunteers.filter((v: any) => v.camp_id && campIds.has(v.camp_id));

  // Dispatches summary
  const dispatches = db.dispatches.filter((d: any) => campIds.has(d.camp_id));
  const dispatchSummary = {
    total: dispatches.length,
    delivered: dispatches.filter((d: any) => d.status === 'Delivered').length,
    in_transit: dispatches.filter((d: any) => d.status === 'In Transit').length,
    pending: dispatches.filter((d: any) => d.status === 'Pending').length,
    cancelled: dispatches.filter((d: any) => d.status === 'Cancelled').length,
  };

  // Category fulfilment breakdown
  const categories = [
    'Food & Nutrition',
    'Water & Sanitation',
    'Shelter & NFIs',
    'Medical Supplies',
    'Hygiene Kits',
    'Other',
  ];

  const categoryFulfilment = categories.map((cat) => {
    const catNeeds = relevantNeeds.filter((n: any) => n.item && n.item.category === cat);
    if (catNeeds.length === 0) {
      return {
        category: cat,
        delivered_pct: 0,
        committed_pct: 0,
        unallocated_pct: 0,
        needs_count: 0,
      };
    }
    const avgDelivered = Math.round(catNeeds.reduce((acc: number, n: any) => acc + n.delivered_pct, 0) / catNeeds.length);
    const avgCommitted = Math.round(catNeeds.reduce((acc: number, n: any) => acc + n.committed_pct, 0) / catNeeds.length);
    const avgUnallocated = Math.max(0, 100 - avgDelivered - avgCommitted);

    return {
      category: cat,
      delivered_pct: avgDelivered,
      committed_pct: avgCommitted,
      unallocated_pct: avgUnallocated,
      needs_count: catNeeds.length,
    };
  });

  const uniqueDistricts = new Set(db.camps.map((c: any) => c.district)).size;

  res.json({
    active_camps: activeCamps.length,
    total_camps: camps.length,
    families_sheltered: familiesSheltered,
    total_capacity: totalCapacity,
    avg_need_fulfilment: avgFulfilment,
    low_stock_items: lowStockItems.length,
    low_stock_categories: lowStockCategories,
    volunteers_deployed: deployedVolunteers.length,
    total_volunteers: volunteers.length,
    districts_active: uniqueDistricts,
    dispatch_summary: dispatchSummary,
    category_fulfilment: categoryFulfilment,
  });
});

// ---------------------------------------------------------------------
// CAMPS CRUD
// ---------------------------------------------------------------------
app.get('/api/camps', (req, res) => {
  const db = getDb();
  let list = db.camps;

  const { search, district, status } = req.query;
  if (district && district !== 'all') {
    list = list.filter((c: any) => c.district.toLowerCase() === (district as string).toLowerCase());
  }
  if (status && status !== 'all') {
    list = list.filter((c: any) => c.status.toLowerCase() === (status as string).toLowerCase());
  }
  if (search) {
    const q = (search as string).toLowerCase();
    list = list.filter((c: any) => c.name.toLowerCase().includes(q) || c.district.toLowerCase().includes(q));
  }

  res.json(list);
});

app.get('/api/camps/:id', (req, res) => {
  const db = getDb();
  const camp = db.camps.find((c: any) => c.id === req.params.id);
  if (!camp) return res.status(404).json({ error: 'Camp not found' });

  const needs = db.needs
    .filter((n: any) => n.camp_id === camp.id)
    .map((n: any) => calculateNeedMetrics(n, db));

  const dispatches = db.dispatches
    .filter((d: any) => d.camp_id === camp.id)
    .map((d: any) => ({
      ...d,
      item: db.inventory.find((i: any) => i.id === d.inventory_item_id),
    }));

  const volunteers = db.volunteers.filter((v: any) => v.camp_id === camp.id);

  res.json({
    ...camp,
    needs,
    dispatches,
    volunteers,
  });
});

app.post('/api/camps', (req, res) => {
  const db = getDb();
  const { name, district, capacity, current_families, status, notes } = req.body;

  if (!name || !district) {
    return res.status(400).json({ error: 'Camp name and district are required.' });
  }

  const cap = Number(capacity);
  const fam = Number(current_families || 0);

  if (isNaN(cap) || cap <= 0) {
    return res.status(400).json({ error: 'Camp capacity must be a positive integer.' });
  }

  if (isNaN(fam) || fam < 0) {
    return res.status(400).json({ error: 'Current families cannot be negative.' });
  }

  if (fam > cap) {
    return res.status(400).json({ error: 'Current families cannot exceed total camp capacity.' });
  }

  let finalStatus = status || 'Active';
  if (fam === cap && finalStatus === 'Active') {
    finalStatus = 'Full';
  }

  const newCamp = {
    id: `camp-${Date.now()}`,
    name: name.trim(),
    district: district.trim(),
    capacity: cap,
    current_families: fam,
    status: finalStatus,
    notes: notes || '',
  };

  db.camps.push(newCamp);

  db.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'CAMP_CREATED',
    entity_type: 'camp',
    entity_id: newCamp.id,
    description: `Created new camp "${newCamp.name}" in ${newCamp.district} (Capacity: ${newCamp.capacity}, Families: ${newCamp.current_families}).`,
    actor: req.headers['x-user-role'] || 'Relief Coordinator (Admin)',
  });

  saveDb(db);
  res.status(201).json(newCamp);
});

app.put('/api/camps/:id', (req, res) => {
  const db = getDb();
  const index = db.camps.findIndex((c: any) => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Camp not found' });

  const { name, district, capacity, current_families, status, notes } = req.body;

  const cap = Number(capacity);
  const fam = Number(current_families);

  if (isNaN(cap) || cap <= 0) {
    return res.status(400).json({ error: 'Camp capacity must be positive.' });
  }

  if (isNaN(fam) || fam < 0) {
    return res.status(400).json({ error: 'Current families cannot be negative.' });
  }

  if (fam > cap) {
    return res.status(400).json({ error: 'Current families cannot exceed total camp capacity.' });
  }

  let finalStatus = status;
  if (fam === cap && finalStatus === 'Active') {
    finalStatus = 'Full';
  }

  db.camps[index] = {
    ...db.camps[index],
    name: name?.trim() || db.camps[index].name,
    district: district?.trim() || db.camps[index].district,
    capacity: cap,
    current_families: fam,
    status: finalStatus || db.camps[index].status,
    notes: notes !== undefined ? notes : db.camps[index].notes,
  };

  db.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'CAMP_UPDATED',
    entity_type: 'camp',
    entity_id: req.params.id,
    description: `Updated camp "${db.camps[index].name}". Families: ${fam}/${cap}, Status: ${db.camps[index].status}.`,
    actor: req.headers['x-user-role'] || 'Relief Coordinator (Admin)',
  });

  saveDb(db);
  res.json(db.camps[index]);
});

app.delete('/api/camps/:id', (req, res) => {
  const db = getDb();
  const id = req.params.id;

  const camp = db.camps.find((c: any) => c.id === id);
  if (!camp) return res.status(404).json({ error: 'Camp not found' });

  // Check if camp has active dispatches
  const activeDispatches = db.dispatches.filter(
    (d: any) => d.camp_id === id && (d.status === 'Pending' || d.status === 'In Transit')
  );
  if (activeDispatches.length > 0) {
    return res.status(400).json({
      error: `Cannot delete camp with ${activeDispatches.length} active dispatches. Resolve or cancel them first.`,
    });
  }

  // Remove associated needs & unassign volunteers
  db.needs = db.needs.filter((n: any) => n.camp_id !== id);
  db.volunteers = db.volunteers.map((v: any) => (v.camp_id === id ? { ...v, camp_id: null } : v));
  db.camps = db.camps.filter((c: any) => c.id !== id);

  db.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'CAMP_DELETED',
    entity_type: 'camp',
    entity_id: id,
    description: `Deleted camp "${camp.name}" (${camp.district}). Volunteers unassigned.`,
    actor: req.headers['x-user-role'] || 'Relief Coordinator (Admin)',
  });

  saveDb(db);
  res.json({ message: 'Camp deleted successfully', id });
});

// ---------------------------------------------------------------------
// INVENTORY CRUD
// ---------------------------------------------------------------------
app.get('/api/inventory', (req, res) => {
  const db = getDb();
  let list = db.inventory;

  const { category, low_stock, search } = req.query;

  if (category && category !== 'all') {
    list = list.filter((i: any) => i.category.toLowerCase() === (category as string).toLowerCase());
  }

  if (low_stock === 'true') {
    list = list.filter((i: any) => Number(i.stock) <= Number(i.reorder_level));
  }

  if (search) {
    const q = (search as string).toLowerCase();
    list = list.filter(
      (i: any) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
    );
  }

  res.json(list);
});

app.post('/api/inventory', (req, res) => {
  const db = getDb();
  const { name, category, unit, stock, reorder_level } = req.body;

  if (!name || !category || !unit) {
    return res.status(400).json({ error: 'Name, category, and unit are required.' });
  }

  const s = Number(stock || 0);
  const r = Number(reorder_level || 0);

  if (s < 0 || r < 0) {
    return res.status(400).json({ error: 'Stock and reorder level cannot be negative.' });
  }

  const newItem = {
    id: `item-${Date.now()}`,
    name: name.trim(),
    category,
    unit: unit.trim(),
    stock: s,
    reorder_level: r,
  };

  db.inventory.push(newItem);

  db.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'INVENTORY_CREATED',
    entity_type: 'inventory',
    entity_id: newItem.id,
    description: `Added inventory item "${newItem.name}" (${newItem.category}) with initial stock ${s} ${newItem.unit}.`,
    actor: req.headers['x-user-role'] || 'Relief Coordinator (Admin)',
  });

  saveDb(db);
  res.status(201).json(newItem);
});

app.put('/api/inventory/:id', (req, res) => {
  const db = getDb();
  const index = db.inventory.findIndex((i: any) => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Inventory item not found' });

  const { name, category, unit, stock, reorder_level } = req.body;

  const s = Number(stock);
  const r = Number(reorder_level);

  if (isNaN(s) || s < 0) return res.status(400).json({ error: 'Stock must be non-negative.' });
  if (isNaN(r) || r < 0) return res.status(400).json({ error: 'Reorder level must be non-negative.' });

  const oldStock = db.inventory[index].stock;
  db.inventory[index] = {
    ...db.inventory[index],
    name: name?.trim() || db.inventory[index].name,
    category: category || db.inventory[index].category,
    unit: unit?.trim() || db.inventory[index].unit,
    stock: s,
    reorder_level: r,
  };

  db.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'INVENTORY_UPDATED',
    entity_type: 'inventory',
    entity_id: req.params.id,
    description: `Adjusted inventory "${db.inventory[index].name}". Stock: ${oldStock} -> ${s} ${db.inventory[index].unit}.`,
    actor: req.headers['x-user-role'] || 'Relief Coordinator (Admin)',
  });

  saveDb(db);
  res.json(db.inventory[index]);
});

app.delete('/api/inventory/:id', (req, res) => {
  const db = getDb();
  const id = req.params.id;

  const item = db.inventory.find((i: any) => i.id === id);
  if (!item) return res.status(404).json({ error: 'Inventory item not found' });

  const activeNeeds = db.needs.filter((n: any) => n.inventory_item_id === id);
  if (activeNeeds.length > 0) {
    return res.status(400).json({
      error: `Cannot delete item referenced by ${activeNeeds.length} camp needs. Remove the needs first.`,
    });
  }

  db.inventory = db.inventory.filter((i: any) => i.id !== id);
  saveDb(db);
  res.json({ message: 'Inventory item deleted successfully' });
});

// ---------------------------------------------------------------------
// NEEDS CRUD & ACTION QUEUE
// ---------------------------------------------------------------------
app.get('/api/needs', (req, res) => {
  const db = getDb();
  const { camp_id, priority, critical_only, district } = req.query;

  let needs = db.needs.map((n: any) => calculateNeedMetrics(n, db));

  if (district && district !== 'all') {
    needs = needs.filter((n: any) => n.camp && n.camp.district.toLowerCase() === (district as string).toLowerCase());
  }

  if (camp_id) {
    needs = needs.filter((n: any) => n.camp_id === camp_id);
  }

  if (priority && priority !== 'all') {
    needs = needs.filter((n: any) => n.priority.toLowerCase() === (priority as string).toLowerCase());
  }

  if (critical_only === 'true') {
    // Critical Gap: High-priority needs with delivered fulfilment below 40%
    needs = needs.filter((n: any) => n.priority === 'High' && n.delivered_pct < 40);
    // Sorted from lowest delivered fulfilment first
    needs.sort((a: any, b: any) => a.delivered_pct - b.delivered_pct);
  }

  res.json(needs);
});

app.post('/api/needs', (req, res) => {
  const db = getDb();
  const { camp_id, inventory_item_id, required_quantity, priority, fulfilled_quantity } = req.body;

  const camp = db.camps.find((c: any) => c.id === camp_id);
  if (!camp) return res.status(400).json({ error: 'Valid camp is required.' });

  const item = db.inventory.find((i: any) => i.id === inventory_item_id);
  if (!item) return res.status(400).json({ error: 'Valid inventory item is required.' });

  const reqQty = Number(required_quantity);
  const fulQty = Number(fulfilled_quantity || 0);

  if (isNaN(reqQty) || reqQty <= 0) {
    return res.status(400).json({ error: 'Required quantity must be positive.' });
  }

  if (isNaN(fulQty) || fulQty < 0) {
    return res.status(400).json({ error: 'Fulfilled quantity cannot be negative.' });
  }

  const newNeed = {
    id: `need-${Date.now()}`,
    camp_id,
    inventory_item_id,
    required_quantity: reqQty,
    priority: priority || 'Medium',
    fulfilled_quantity: fulQty,
  };

  db.needs.push(newNeed);
  saveDb(db);

  const calculated = calculateNeedMetrics(newNeed, db);
  res.status(201).json(calculated);
});

// ---------------------------------------------------------------------
// DISPATCHES & STOCK RESERVATIONS
// ---------------------------------------------------------------------
app.get('/api/dispatches', (req, res) => {
  const db = getDb();
  let list = db.dispatches.map((d: any) => {
    const camp = db.camps.find((c: any) => c.id === d.camp_id);
    const need = db.needs.find((n: any) => n.id === d.need_id);
    const item = db.inventory.find((i: any) => i.id === d.inventory_item_id || (need && i.id === need.inventory_item_id));
    return {
      ...d,
      camp,
      need,
      item,
    };
  });

  const { status, camp_id, search, district } = req.query;

  if (district && district !== 'all') {
    list = list.filter((d: any) => d.camp && d.camp.district.toLowerCase() === (district as string).toLowerCase());
  }

  if (status && status !== 'all') {
    list = list.filter((d: any) => d.status.toLowerCase() === (status as string).toLowerCase());
  }

  if (camp_id && camp_id !== 'all') {
    list = list.filter((d: any) => d.camp_id === camp_id);
  }

  if (search) {
    const q = (search as string).toLowerCase();
    list = list.filter(
      (d: any) =>
        (d.camp && d.camp.name.toLowerCase().includes(q)) ||
        (d.item && d.item.name.toLowerCase().includes(q)) ||
        (d.notes && d.notes.toLowerCase().includes(q)) ||
        d.id.toLowerCase().includes(q)
    );
  }

  // Sort by created_at desc
  list.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json(list);
});

// Create dispatch / reserve stock
app.post('/api/dispatches', (req, res) => {
  const db = getDb();
  const { camp_id, need_id, quantity, notes, dispatched_by } = req.body;

  const camp = db.camps.find((c: any) => c.id === camp_id);
  if (!camp) return res.status(400).json({ error: 'Camp not found.' });

  const need = db.needs.find((n: any) => n.id === need_id);
  if (!need) return res.status(400).json({ error: 'Camp need not found.' });

  const itemIndex = db.inventory.findIndex((i: any) => i.id === need.inventory_item_id);
  if (itemIndex === -1) return res.status(400).json({ error: 'Inventory item associated with need not found.' });

  const item = db.inventory[itemIndex];
  const qty = Number(quantity);

  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Proposed dispatch quantity must be greater than 0.' });
  }

  // Calculate current need metrics to check remaining unallocated need
  const needMetrics = calculateNeedMetrics(need, db);
  const remainingUnallocated = needMetrics.unallocated;
  const availableStock = Number(item.stock);

  if (qty > availableStock) {
    return res.status(400).json({
      error: `Proposed quantity (${qty}) exceeds available warehouse stock (${availableStock} ${item.unit}).`,
    });
  }

  if (qty > remainingUnallocated) {
    return res.status(400).json({
      error: `Proposed quantity (${qty}) exceeds remaining unallocated need (${remainingUnallocated} ${item.unit}).`,
    });
  }

  // Deduct available stock
  db.inventory[itemIndex].stock = availableStock - qty;

  const newDispatch = {
    id: `disp-${Date.now()}`,
    camp_id,
    need_id,
    inventory_item_id: item.id,
    quantity: qty,
    status: 'Pending',
    created_at: new Date().toISOString(),
    dispatched_by: dispatched_by || 'Operations Desk',
    notes: notes || '',
  };

  db.dispatches.unshift(newDispatch);

  db.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'DISPATCH_CREATED',
    entity_type: 'dispatch',
    entity_id: newDispatch.id,
    description: `Reserved ${qty} ${item.unit} of "${item.name}" for ${camp.name}. Warehouse stock: ${availableStock} -> ${db.inventory[itemIndex].stock}.`,
    actor: req.headers['x-user-role'] || 'Relief Coordinator (Admin)',
  });

  saveDb(db);

  res.status(201).json({
    dispatch: newDispatch,
    updated_stock: db.inventory[itemIndex].stock,
    message: 'Stock reserved and dispatch created successfully',
  });
});

// Update dispatch status: Mark In Transit, Mark Delivered, Cancel
app.patch('/api/dispatches/:id/status', (req, res) => {
  const db = getDb();
  const { status, notes } = req.body;
  const validStatuses = ['Pending', 'In Transit', 'Delivered', 'Cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid dispatch status.' });
  }

  const dispatchIndex = db.dispatches.findIndex((d: any) => d.id === req.params.id);
  if (dispatchIndex === -1) return res.status(404).json({ error: 'Dispatch not found.' });

  const currentDispatch = db.dispatches[dispatchIndex];
  const oldStatus = currentDispatch.status;

  if (oldStatus === status) {
    return res.status(400).json({ error: `Dispatch is already marked as ${status}.` });
  }

  if (oldStatus === 'Delivered') {
    return res.status(400).json({ error: 'Cannot change status of an already Delivered dispatch.' });
  }

  if (oldStatus === 'Cancelled') {
    return res.status(400).json({ error: 'Cannot change status of a Cancelled dispatch.' });
  }

  const itemIndex = db.inventory.findIndex((i: any) => i.id === currentDispatch.inventory_item_id);
  const needIndex = db.needs.findIndex((n: any) => n.id === currentDispatch.need_id);

  // Status transitions
  if (status === 'In Transit') {
    // Pending -> In Transit: status updates, stock remains reserved
    currentDispatch.status = 'In Transit';
    currentDispatch.updated_at = new Date().toISOString();
    if (notes) currentDispatch.notes = notes;

    db.audit_logs.unshift({
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'DISPATCH_IN_TRANSIT',
      entity_type: 'dispatch',
      entity_id: currentDispatch.id,
      description: `Marked dispatch ${currentDispatch.id} (${currentDispatch.quantity} units) as In Transit.`,
      actor: req.headers['x-user-role'] || 'Relief Coordinator (Admin)',
    });
  } else if (status === 'Delivered') {
    // Pending/In Transit -> Delivered:
    // Delivered physically received: increase need.fulfilled_quantity exactly once!
    // Warehouse stock was already deducted at reservation time, so DO NOT subtract warehouse stock again!
    currentDispatch.status = 'Delivered';
    currentDispatch.updated_at = new Date().toISOString();
    if (notes) currentDispatch.notes = notes;

    if (needIndex !== -1) {
      db.needs[needIndex].fulfilled_quantity =
        Number(db.needs[needIndex].fulfilled_quantity || 0) + Number(currentDispatch.quantity);
    }

    db.audit_logs.unshift({
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'DISPATCH_DELIVERED',
      entity_type: 'dispatch',
      entity_id: currentDispatch.id,
      description: `Confirmed delivery of dispatch ${currentDispatch.id} (${currentDispatch.quantity} units). Need fulfilled quantity updated.`,
      actor: req.headers['x-user-role'] || 'Field Volunteer',
    });
  } else if (status === 'Cancelled') {
    // Pending/In Transit -> Cancelled:
    // Restore warehouse stock exactly once only if the dispatch was undelivered!
    currentDispatch.status = 'Cancelled';
    currentDispatch.updated_at = new Date().toISOString();
    if (notes) currentDispatch.notes = notes;

    if (itemIndex !== -1) {
      const prevStock = Number(db.inventory[itemIndex].stock);
      db.inventory[itemIndex].stock = prevStock + Number(currentDispatch.quantity);

      db.audit_logs.unshift({
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'DISPATCH_CANCELLED',
        entity_type: 'dispatch',
        entity_id: currentDispatch.id,
        description: `Cancelled undelivered dispatch ${currentDispatch.id}. Restored ${currentDispatch.quantity} units to warehouse stock (${prevStock} -> ${db.inventory[itemIndex].stock}).`,
        actor: req.headers['x-user-role'] || 'Relief Coordinator (Admin)',
      });
    }
  }

  saveDb(db);
  res.json({
    dispatch: currentDispatch,
    message: `Dispatch updated to ${status} successfully.`,
  });
});

// ---------------------------------------------------------------------
// DONATIONS (Cash and In-Kind)
// ---------------------------------------------------------------------
app.get('/api/donations', (req, res) => {
  const db = getDb();
  let list = db.donations.map((d: any) => ({
    ...d,
    item: d.item_id ? db.inventory.find((i: any) => i.id === d.item_id) : null,
  }));

  const { type, search } = req.query;

  if (type && type !== 'all') {
    list = list.filter((d: any) => d.type.toLowerCase() === (type as string).toLowerCase());
  }

  if (search) {
    const q = (search as string).toLowerCase();
    list = list.filter(
      (d: any) =>
        (d.donor_name && d.donor_name.toLowerCase().includes(q)) ||
        d.category.toLowerCase().includes(q) ||
        (d.notes && d.notes.toLowerCase().includes(q))
    );
  }

  list.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.json(list);
});

app.post('/api/donations', (req, res) => {
  const db = getDb();
  const { type, amount_or_quantity, item_id, category, donor_name, notes } = req.body;

  if (!type || !category) {
    return res.status(400).json({ error: 'Donation type and category are required.' });
  }

  const val = Number(amount_or_quantity);
  if (isNaN(val) || val <= 0) {
    return res.status(400).json({ error: 'Donation amount or quantity must be positive.' });
  }

  let item = null;
  if (type === 'In-Kind') {
    if (!item_id) {
      return res.status(400).json({ error: 'In-Kind donations require selecting an inventory item.' });
    }
    const itemIndex = db.inventory.findIndex((i: any) => i.id === item_id);
    if (itemIndex === -1) {
      return res.status(400).json({ error: 'Specified inventory item not found.' });
    }
    item = db.inventory[itemIndex];

    // In-Kind donation increases inventory stock exactly once!
    const oldStock = Number(item.stock);
    db.inventory[itemIndex].stock = oldStock + val;

    db.audit_logs.unshift({
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'DONATION_IN_KIND_RECEIVED',
      entity_type: 'inventory',
      entity_id: item.id,
      description: `In-Kind donation of ${val} ${item.unit} of "${item.name}" from ${donor_name || 'Anonymous'}. Warehouse stock: ${oldStock} -> ${db.inventory[itemIndex].stock}.`,
      actor: req.headers['x-user-role'] || 'Relief Coordinator (Admin)',
    });
  } else {
    // Cash donation
    db.audit_logs.unshift({
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'DONATION_CASH_RECEIVED',
      entity_type: 'donation',
      entity_id: `don-${Date.now()}`,
      description: `Cash donation of PKR ${val.toLocaleString()} received for "${category}" from ${donor_name || 'Anonymous'}.`,
      actor: req.headers['x-user-role'] || 'Relief Coordinator (Admin)',
    });
  }

  const newDonation = {
    id: `don-${Date.now()}`,
    type,
    amount_or_quantity: val,
    item_id: type === 'In-Kind' ? item_id : null,
    category: category.trim(),
    donor_name: donor_name?.trim() || 'Anonymous Supporter',
    date: new Date().toISOString(),
    notes: notes || '',
  };

  db.donations.unshift(newDonation);
  saveDb(db);

  res.status(201).json({
    donation: { ...newDonation, item },
    message: 'Donation recorded successfully',
  });
});

// ---------------------------------------------------------------------
// VOLUNTEERS
// ---------------------------------------------------------------------
app.get('/api/volunteers', (req, res) => {
  const db = getDb();
  let list = db.volunteers.map((v: any) => ({
    ...v,
    camp: v.camp_id ? db.camps.find((c: any) => c.id === v.camp_id) : null,
  }));

  const { skill, camp_id, status, search } = req.query;

  if (skill && skill !== 'all') {
    list = list.filter((v: any) => v.skill.toLowerCase() === (skill as string).toLowerCase());
  }

  if (camp_id && camp_id !== 'all') {
    list = list.filter((v: any) => v.camp_id === camp_id);
  }

  if (status === 'assigned') {
    list = list.filter((v: any) => v.camp_id !== null);
  } else if (status === 'unassigned') {
    list = list.filter((v: any) => v.camp_id === null);
  }

  if (search) {
    const q = (search as string).toLowerCase();
    list = list.filter(
      (v: any) =>
        v.name.toLowerCase().includes(q) ||
        v.skill.toLowerCase().includes(q) ||
        (v.camp && v.camp.name.toLowerCase().includes(q))
    );
  }

  res.json(list);
});

app.post('/api/volunteers', (req, res) => {
  const db = getDb();
  const { name, skill, camp_id, phone } = req.body;

  if (!name || !skill) {
    return res.status(400).json({ error: 'Volunteer name and skill are required.' });
  }

  if (camp_id) {
    const targetCamp = db.camps.find((c: any) => c.id === camp_id);
    if (!targetCamp) return res.status(400).json({ error: 'Selected camp does not exist.' });
    if (targetCamp.status === 'Closed') {
      return res.status(400).json({ error: 'Closed camps cannot receive volunteer deployments.' });
    }
  }

  const newVolunteer = {
    id: `vol-${Date.now()}`,
    name: name.trim(),
    skill,
    camp_id: camp_id || null,
    phone: phone || '',
    joined_date: new Date().toISOString().split('T')[0],
  };

  db.volunteers.push(newVolunteer);

  db.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'VOLUNTEER_REGISTERED',
    entity_type: 'volunteer',
    entity_id: newVolunteer.id,
    description: `Registered volunteer "${newVolunteer.name}" (${newVolunteer.skill}).`,
    actor: req.headers['x-user-role'] || 'Relief Coordinator (Admin)',
  });

  saveDb(db);
  res.status(201).json(newVolunteer);
});

app.patch('/api/volunteers/:id/assign', (req, res) => {
  const db = getDb();
  const volunteer = db.volunteers.find((v: any) => v.id === req.params.id);
  if (!volunteer) return res.status(404).json({ error: 'Volunteer not found.' });

  const { camp_id } = req.body;

  if (camp_id) {
    const targetCamp = db.camps.find((c: any) => c.id === camp_id);
    if (!targetCamp) return res.status(400).json({ error: 'Target camp not found.' });
    if (targetCamp.status === 'Closed') {
      return res.status(400).json({ error: 'Closed camps cannot receive new volunteer assignments.' });
    }
    volunteer.camp_id = camp_id;

    db.audit_logs.unshift({
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'VOLUNTEER_ASSIGNED',
      entity_type: 'volunteer',
      entity_id: volunteer.id,
      description: `Assigned volunteer ${volunteer.name} to ${targetCamp.name}.`,
      actor: req.headers['x-user-role'] || 'Relief Coordinator (Admin)',
    });
  } else {
    // Unassign
    const prevCamp = db.camps.find((c: any) => c.id === volunteer.camp_id);
    volunteer.camp_id = null;

    db.audit_logs.unshift({
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'VOLUNTEER_UNASSIGNED',
      entity_type: 'volunteer',
      entity_id: volunteer.id,
      description: `Unassigned volunteer ${volunteer.name} from ${prevCamp?.name || 'camp'}.`,
      actor: req.headers['x-user-role'] || 'Relief Coordinator (Admin)',
    });
  }

  saveDb(db);
  res.json({
    volunteer,
    camp: volunteer.camp_id ? db.camps.find((c: any) => c.id === volunteer.camp_id) : null,
    message: volunteer.camp_id ? 'Volunteer assigned successfully.' : 'Volunteer unassigned.',
  });
});

app.delete('/api/volunteers/:id', (req, res) => {
  const db = getDb();
  const id = req.params.id;
  const index = db.volunteers.findIndex((v: any) => v.id === id);
  if (index === -1) return res.status(404).json({ error: 'Volunteer not found.' });

  const name = db.volunteers[index].name;
  db.volunteers.splice(index, 1);

  db.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'VOLUNTEER_REMOVED',
    entity_type: 'volunteer',
    entity_id: id,
    description: `Removed volunteer record for ${name}.`,
    actor: req.headers['x-user-role'] || 'Relief Coordinator (Admin)',
  });

  saveDb(db);
  res.json({ message: 'Volunteer removed successfully.' });
});

// ---------------------------------------------------------------------
// AUDIT LOGS
// ---------------------------------------------------------------------
app.get('/api/audit-logs', (req, res) => {
  const db = getDb();
  const limit = Number(req.query.limit || 50);
  res.json(db.audit_logs.slice(0, limit));
});

// ---------------------------------------------------------------------
// AI INTELLIGENCE LAYER
// ---------------------------------------------------------------------
import { REGISTERED_AGENTS, processAIQuery } from './ai/orchestrator.js';

app.get('/api/ai/agents', (req, res) => {
  res.json({
    agents: REGISTERED_AGENTS,
    provider: process.env.GEMINI_API_KEY
      ? 'gemini_api'
      : process.env.OPENAI_API_KEY
      ? 'openai_api'
      : 'deterministic_engine',
    mode:
      process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
        ? 'llm_augmented'
        : 'deterministic_rules_engine',
  });
});

app.post('/api/ai/query', async (req, res) => {
  try {
    const { query, district, agentType, context } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query string is required.' });
    }
    const response = await processAIQuery({
      query,
      district,
      agentType,
      context,
    });
    res.json(response);
  } catch (err: any) {
    console.error('AI Processing Error:', err);
    res.status(500).json({ error: err.message || 'AI processing encountered an unexpected issue.' });
  }
});

app.post('/api/ai/agent/:agentId/run', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { district, context } = req.body;
    const response = await processAIQuery({
      query: `Run specialized agent: ${agentId}`,
      district,
      agentType: agentId as any,
      context,
    });
    res.json(response);
  } catch (err: any) {
    console.error('Agent Execution Error:', err);
    res.status(500).json({ error: err.message || 'Agent execution failed.' });
  }
});

// SERVE STATIC ASSETS IN PRODUCTION
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// START SERVER
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ReliefHub API Server running at http://localhost:${PORT}`);
});

