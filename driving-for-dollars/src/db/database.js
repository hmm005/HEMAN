const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'properties.db');

let db;
let saveTimer = null;

// sql.js returns arrays — this converts to objects
function rowsToObjects(stmt) {
  const cols = stmt.getColumnNames();
  const results = [];
  while (stmt.step()) {
    const row = stmt.get();
    const obj = {};
    for (let i = 0; i < cols.length; i++) {
      obj[cols[i]] = row[i];
    }
    results.push(obj);
  }
  stmt.free();
  return results;
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  return rowsToObjects(stmt);
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params = []) {
  db.run(sql, params);
  scheduleSave();
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
      console.error('[DB] Save failed:', err.message);
    }
  }, 500);
}

function saveNow() {
  if (saveTimer) clearTimeout(saveTimer);
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('[DB] Save failed:', err.message);
  }
}

async function init() {
  const SQL = await initSqlJs();

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      city TEXT,
      state TEXT,
      zip TEXT,
      lat REAL,
      lng REAL,
      beds INTEGER,
      baths REAL,
      sqft INTEGER,
      year_built INTEGER,
      lot_size TEXT,
      property_type TEXT,
      assessed_value REAL,
      estimated_value REAL,
      last_sale_price REAL,
      last_sale_date TEXT,
      status TEXT DEFAULT 'new',
      distress_indicators TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      photo_url TEXT,
      street_view_url TEXT,
      list_id TEXT,
      added_from TEXT DEFAULT 'driving',
      session_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS owners (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      name TEXT,
      mailing_address TEXT,
      mailing_city TEXT,
      mailing_state TEXT,
      mailing_zip TEXT,
      phone1 TEXT,
      phone2 TEXT,
      phone3 TEXT,
      email1 TEXT,
      email2 TEXT,
      last_contacted TIMESTAMP,
      contact_count INTEGER DEFAULT 0,
      skip_traced_at TIMESTAMP,
      skip_trace_source TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS driving_sessions (
      id TEXT PRIMARY KEY,
      name TEXT,
      started_at TIMESTAMP,
      ended_at TIMESTAMP,
      route_points TEXT DEFAULT '[]',
      distance_miles REAL DEFAULT 0,
      properties_added INTEGER DEFAULT 0,
      notes TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#3b82f6',
      property_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contact_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id TEXT NOT NULL,
      owner_id TEXT,
      type TEXT,
      outcome TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE SET NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_properties_list ON properties(list_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_properties_session ON properties(session_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_properties_created ON properties(created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_owners_property ON owners(property_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_contacts_property ON contact_log(property_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sessions_started ON driving_sessions(started_at)');

  saveNow();
  console.log('[DB] Database initialized');
}

// ─── Properties ──────────────────────────────────────────────

function addProperty(prop) {
  run(`
    INSERT OR IGNORE INTO properties (id, address, city, state, zip, lat, lng, status, distress_indicators, notes, added_from, session_id, list_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'new', '[]', '', ?, ?, ?)
  `, [
    prop.id, prop.address, prop.city || null, prop.state || null, prop.zip || null,
    prop.lat || null, prop.lng || null, prop.added_from || 'driving',
    prop.session_id || null, prop.list_id || null
  ]);
}

function getProperties({ status, list_id, search, limit = 50, offset = 0 } = {}) {
  let sql = 'SELECT * FROM properties WHERE 1=1';
  const params = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (list_id) {
    sql += ' AND list_id = ?';
    params.push(list_id);
  }
  if (search) {
    sql += ' AND (address LIKE ? OR city LIKE ? OR notes LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return queryAll(sql, params);
}

function getProperty(id) {
  return queryOne('SELECT * FROM properties WHERE id = ?', [id]);
}

function updateProperty(id, updates) {
  const allowed = [
    'address', 'city', 'state', 'zip', 'lat', 'lng',
    'beds', 'baths', 'sqft', 'year_built', 'lot_size', 'property_type',
    'assessed_value', 'estimated_value', 'last_sale_price', 'last_sale_date',
    'status', 'distress_indicators', 'notes', 'photo_url', 'street_view_url',
    'list_id'
  ];

  const sets = [];
  const params = [];

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`${key} = ?`);
      params.push(updates[key]);
    }
  }

  if (sets.length === 0) return null;

  sets.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  run(`UPDATE properties SET ${sets.join(', ')} WHERE id = ?`, params);
}

function deleteProperty(id) {
  run('DELETE FROM properties WHERE id = ?', [id]);
}

function getPropertyCount() {
  return queryOne('SELECT COUNT(*) as count FROM properties').count;
}

// ─── Owners ──────────────────────────────────────────────────

function getOwner(propertyId) {
  return queryOne('SELECT * FROM owners WHERE property_id = ?', [propertyId]);
}

function upsertOwner(owner) {
  const existing = queryOne('SELECT id FROM owners WHERE property_id = ?', [owner.property_id]);

  if (existing) {
    const sets = [];
    const params = [];
    const fields = ['name', 'mailing_address', 'mailing_city', 'mailing_state', 'mailing_zip',
      'phone1', 'phone2', 'phone3', 'email1', 'email2',
      'skip_traced_at', 'skip_trace_source'];

    for (const f of fields) {
      if (owner[f] !== undefined) {
        sets.push(`${f} = ?`);
        params.push(owner[f]);
      }
    }
    if (sets.length === 0) return existing;
    params.push(existing.id);
    run(`UPDATE owners SET ${sets.join(', ')} WHERE id = ?`, params);
    return queryOne('SELECT * FROM owners WHERE id = ?', [existing.id]);
  } else {
    run(`
      INSERT INTO owners (id, property_id, name, mailing_address, mailing_city, mailing_state, mailing_zip,
        phone1, phone2, phone3, email1, email2, skip_traced_at, skip_trace_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      owner.id, owner.property_id, owner.name || null,
      owner.mailing_address || null, owner.mailing_city || null,
      owner.mailing_state || null, owner.mailing_zip || null,
      owner.phone1 || null, owner.phone2 || null, owner.phone3 || null,
      owner.email1 || null, owner.email2 || null,
      owner.skip_traced_at || null, owner.skip_trace_source || null
    ]);
    return queryOne('SELECT * FROM owners WHERE id = ?', [owner.id]);
  }
}

// ─── Driving Sessions ────────────────────────────────────────

function createSession(session) {
  run(`
    INSERT INTO driving_sessions (id, name, started_at, route_points)
    VALUES (?, ?, ?, '[]')
  `, [session.id, session.name || null, session.started_at || new Date().toISOString()]);
  return queryOne('SELECT * FROM driving_sessions WHERE id = ?', [session.id]);
}

function endSession(id, data) {
  run(`
    UPDATE driving_sessions SET ended_at = ?, route_points = ?, distance_miles = ?, properties_added = ?, notes = ?
    WHERE id = ?
  `, [
    data.ended_at || new Date().toISOString(),
    data.route_points || '[]',
    data.distance_miles || 0,
    data.properties_added || 0,
    data.notes || null,
    id
  ]);
  return queryOne('SELECT * FROM driving_sessions WHERE id = ?', [id]);
}

function getSessions(limit = 50) {
  return queryAll('SELECT * FROM driving_sessions ORDER BY started_at DESC LIMIT ?', [limit]);
}

function getSession(id) {
  return queryOne('SELECT * FROM driving_sessions WHERE id = ?', [id]);
}

// ─── Lists ───────────────────────────────────────────────────

function getLists() {
  const lists = queryAll('SELECT * FROM lists ORDER BY created_at DESC');
  for (const list of lists) {
    list.property_count = queryOne('SELECT COUNT(*) as c FROM properties WHERE list_id = ?', [list.id]).c;
  }
  return lists;
}

function createList(list) {
  run('INSERT INTO lists (id, name, description, color) VALUES (?, ?, ?, ?)', [
    list.id, list.name, list.description || null, list.color || '#3b82f6'
  ]);
  return queryOne('SELECT * FROM lists WHERE id = ?', [list.id]);
}

function updateList(id, updates) {
  const sets = [];
  const params = [];
  for (const key of ['name', 'description', 'color']) {
    if (updates[key] !== undefined) {
      sets.push(`${key} = ?`);
      params.push(updates[key]);
    }
  }
  if (sets.length === 0) return null;
  params.push(id);
  run(`UPDATE lists SET ${sets.join(', ')} WHERE id = ?`, params);
  return queryOne('SELECT * FROM lists WHERE id = ?', [id]);
}

// ─── Contact Log ─────────────────────────────────────────────

function addContact(entry) {
  run(`
    INSERT INTO contact_log (property_id, owner_id, type, outcome, notes)
    VALUES (?, ?, ?, ?, ?)
  `, [entry.property_id, entry.owner_id || null, entry.type, entry.outcome || null, entry.notes || null]);

  if (entry.owner_id) {
    run(`
      UPDATE owners SET contact_count = contact_count + 1, last_contacted = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [entry.owner_id]);
  }

  return queryAll('SELECT * FROM contact_log WHERE property_id = ? ORDER BY created_at DESC', [entry.property_id]);
}

function getContacts(propertyId) {
  return queryAll('SELECT * FROM contact_log WHERE property_id = ? ORDER BY created_at DESC', [propertyId]);
}

// ─── Stats ───────────────────────────────────────────────────

function getStats() {
  const total = queryOne('SELECT COUNT(*) as c FROM properties').c;
  const byStatus = queryAll('SELECT status, COUNT(*) as count FROM properties GROUP BY status');
  const thisWeek = queryOne("SELECT COUNT(*) as c FROM contact_log WHERE created_at >= datetime('now', '-7 days')").c;
  const totalSessions = queryOne('SELECT COUNT(*) as c FROM driving_sessions').c;
  const totalMiles = queryOne('SELECT COALESCE(SUM(distance_miles), 0) as m FROM driving_sessions').m;
  const skipTraced = queryOne('SELECT COUNT(*) as c FROM owners WHERE skip_traced_at IS NOT NULL').c;

  const statusMap = {};
  for (const row of byStatus) {
    statusMap[row.status] = row.count;
  }

  return {
    totalProperties: total,
    byStatus: statusMap,
    contactsThisWeek: thisWeek,
    totalSessions,
    totalMiles: Math.round(totalMiles * 10) / 10,
    skipTraced
  };
}

module.exports = {
  init,
  addProperty, getProperties, getProperty, updateProperty, deleteProperty, getPropertyCount,
  getOwner, upsertOwner,
  createSession, endSession, getSessions, getSession,
  getLists, createList, updateList,
  addContact, getContacts,
  getStats
};
