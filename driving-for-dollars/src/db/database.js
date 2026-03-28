const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'properties.db');

let db;

function getDb() {
  if (!db) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function init() {
  const conn = getDb();

  conn.exec(`
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
    );

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
    );

    CREATE TABLE IF NOT EXISTS driving_sessions (
      id TEXT PRIMARY KEY,
      name TEXT,
      started_at TIMESTAMP,
      ended_at TIMESTAMP,
      route_points TEXT DEFAULT '[]',
      distance_miles REAL DEFAULT 0,
      properties_added INTEGER DEFAULT 0,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#3b82f6',
      property_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

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
    );

    CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
    CREATE INDEX IF NOT EXISTS idx_properties_list ON properties(list_id);
    CREATE INDEX IF NOT EXISTS idx_properties_session ON properties(session_id);
    CREATE INDEX IF NOT EXISTS idx_properties_created ON properties(created_at);
    CREATE INDEX IF NOT EXISTS idx_owners_property ON owners(property_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_property ON contact_log(property_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_started ON driving_sessions(started_at);
  `);

  console.log('[DB] Database initialized');
}

// ─── Properties ──────────────────────────────────────────────

const _addProperty = () => getDb().prepare(`
  INSERT OR IGNORE INTO properties (id, address, city, state, zip, lat, lng, status, distress_indicators, notes, added_from, session_id, list_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'new', '[]', '', ?, ?, ?)
`);

function addProperty(prop) {
  return _addProperty().run(
    prop.id, prop.address, prop.city || null, prop.state || null, prop.zip || null,
    prop.lat || null, prop.lng || null, prop.added_from || 'driving',
    prop.session_id || null, prop.list_id || null
  );
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

  return getDb().prepare(sql).all(...params);
}

function getProperty(id) {
  return getDb().prepare('SELECT * FROM properties WHERE id = ?').get(id);
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

  return getDb().prepare(`UPDATE properties SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

function deleteProperty(id) {
  return getDb().prepare('DELETE FROM properties WHERE id = ?').run(id);
}

function getPropertyCount() {
  return getDb().prepare('SELECT COUNT(*) as count FROM properties').get().count;
}

// ─── Owners ──────────────────────────────────────────────────

function getOwner(propertyId) {
  return getDb().prepare('SELECT * FROM owners WHERE property_id = ?').get(propertyId);
}

function upsertOwner(owner) {
  const existing = getDb().prepare('SELECT id FROM owners WHERE property_id = ?').get(owner.property_id);

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
    getDb().prepare(`UPDATE owners SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return getDb().prepare('SELECT * FROM owners WHERE id = ?').get(existing.id);
  } else {
    getDb().prepare(`
      INSERT INTO owners (id, property_id, name, mailing_address, mailing_city, mailing_state, mailing_zip,
        phone1, phone2, phone3, email1, email2, skip_traced_at, skip_trace_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      owner.id, owner.property_id, owner.name || null,
      owner.mailing_address || null, owner.mailing_city || null,
      owner.mailing_state || null, owner.mailing_zip || null,
      owner.phone1 || null, owner.phone2 || null, owner.phone3 || null,
      owner.email1 || null, owner.email2 || null,
      owner.skip_traced_at || null, owner.skip_trace_source || null
    );
    return getDb().prepare('SELECT * FROM owners WHERE id = ?').get(owner.id);
  }
}

// ─── Driving Sessions ────────────────────────────────────────

function createSession(session) {
  getDb().prepare(`
    INSERT INTO driving_sessions (id, name, started_at, route_points)
    VALUES (?, ?, ?, '[]')
  `).run(session.id, session.name || null, session.started_at || new Date().toISOString());
  return getDb().prepare('SELECT * FROM driving_sessions WHERE id = ?').get(session.id);
}

function endSession(id, data) {
  getDb().prepare(`
    UPDATE driving_sessions SET ended_at = ?, route_points = ?, distance_miles = ?, properties_added = ?, notes = ?
    WHERE id = ?
  `).run(
    data.ended_at || new Date().toISOString(),
    data.route_points || '[]',
    data.distance_miles || 0,
    data.properties_added || 0,
    data.notes || null,
    id
  );
  return getDb().prepare('SELECT * FROM driving_sessions WHERE id = ?').get(id);
}

function getSessions(limit = 50) {
  return getDb().prepare('SELECT * FROM driving_sessions ORDER BY started_at DESC LIMIT ?').all(limit);
}

function getSession(id) {
  return getDb().prepare('SELECT * FROM driving_sessions WHERE id = ?').get(id);
}

// ─── Lists ───────────────────────────────────────────────────

function getLists() {
  const lists = getDb().prepare('SELECT * FROM lists ORDER BY created_at DESC').all();
  for (const list of lists) {
    list.property_count = getDb().prepare('SELECT COUNT(*) as c FROM properties WHERE list_id = ?').get(list.id).c;
  }
  return lists;
}

function createList(list) {
  getDb().prepare('INSERT INTO lists (id, name, description, color) VALUES (?, ?, ?, ?)').run(
    list.id, list.name, list.description || null, list.color || '#3b82f6'
  );
  return getDb().prepare('SELECT * FROM lists WHERE id = ?').get(list.id);
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
  getDb().prepare(`UPDATE lists SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return getDb().prepare('SELECT * FROM lists WHERE id = ?').get(id);
}

// ─── Contact Log ─────────────────────────────────────────────

function addContact(entry) {
  getDb().prepare(`
    INSERT INTO contact_log (property_id, owner_id, type, outcome, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(entry.property_id, entry.owner_id || null, entry.type, entry.outcome || null, entry.notes || null);

  // Update owner contact count
  if (entry.owner_id) {
    getDb().prepare(`
      UPDATE owners SET contact_count = contact_count + 1, last_contacted = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(entry.owner_id);
  }

  return getDb().prepare('SELECT * FROM contact_log WHERE property_id = ? ORDER BY created_at DESC').all(entry.property_id);
}

function getContacts(propertyId) {
  return getDb().prepare('SELECT * FROM contact_log WHERE property_id = ? ORDER BY created_at DESC').all(propertyId);
}

// ─── Stats ───────────────────────────────────────────────────

function getStats() {
  const conn = getDb();
  const total = conn.prepare('SELECT COUNT(*) as c FROM properties').get().c;
  const byStatus = conn.prepare(`
    SELECT status, COUNT(*) as count FROM properties GROUP BY status
  `).all();
  const thisWeek = conn.prepare(`
    SELECT COUNT(*) as c FROM contact_log WHERE created_at >= datetime('now', '-7 days')
  `).get().c;
  const totalSessions = conn.prepare('SELECT COUNT(*) as c FROM driving_sessions').get().c;
  const totalMiles = conn.prepare('SELECT COALESCE(SUM(distance_miles), 0) as m FROM driving_sessions').get().m;
  const skipTraced = conn.prepare('SELECT COUNT(*) as c FROM owners WHERE skip_traced_at IS NOT NULL').get().c;

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
  // Properties
  addProperty, getProperties, getProperty, updateProperty, deleteProperty, getPropertyCount,
  // Owners
  getOwner, upsertOwner,
  // Sessions
  createSession, endSession, getSessions, getSession,
  // Lists
  getLists, createList, updateList,
  // Contacts
  addContact, getContacts,
  // Stats
  getStats
};
