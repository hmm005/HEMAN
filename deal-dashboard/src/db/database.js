const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'deals.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS seen_listings (
    id TEXT PRIMARY KEY,
    watchlist_id TEXT NOT NULL,
    source TEXT NOT NULL,
    title TEXT,
    price REAL,
    url TEXT,
    location TEXT,
    mileage INTEGER,
    year INTEGER,
    score REAL DEFAULT 0,
    auction_end TEXT,
    image_url TEXT,
    first_seen TEXT DEFAULT (datetime('now')),
    notified INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS scan_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watchlist_id TEXT,
    source TEXT,
    results_found INTEGER DEFAULT 0,
    new_results INTEGER DEFAULT 0,
    scan_time TEXT DEFAULT (datetime('now')),
    error TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_seen_source ON seen_listings(source);
  CREATE INDEX IF NOT EXISTS idx_seen_watchlist ON seen_listings(watchlist_id);
  CREATE INDEX IF NOT EXISTS idx_seen_first_seen ON seen_listings(first_seen);
  CREATE INDEX IF NOT EXISTS idx_scan_time ON scan_logs(scan_time);
`);

const insertListing = db.prepare(`
  INSERT OR IGNORE INTO seen_listings
    (id, watchlist_id, source, title, price, url, location, mileage, year, score, auction_end, image_url)
  VALUES
    (@id, @watchlist_id, @source, @title, @price, @url, @location, @mileage, @year, @score, @auction_end, @image_url)
`);

const markNotified = db.prepare(`UPDATE seen_listings SET notified = 1 WHERE id = ?`);
const isSeenStmt = db.prepare(`SELECT 1 FROM seen_listings WHERE id = ?`);
const logScan = db.prepare(`
  INSERT INTO scan_logs (watchlist_id, source, results_found, new_results, error)
  VALUES (?, ?, ?, ?, ?)
`);

module.exports = {
  db,

  isSeen(id) {
    return !!isSeenStmt.get(id);
  },

  addListing(listing) {
    return insertListing.run(listing);
  },

  addListings(listings) {
    const tx = db.transaction((items) => {
      let newCount = 0;
      for (const item of items) {
        const result = insertListing.run(item);
        if (result.changes > 0) newCount++;
      }
      return newCount;
    });
    return tx(listings);
  },

  markNotified(id) {
    markNotified.run(id);
  },

  logScan(watchlistId, source, found, newCount, error = null) {
    logScan.run(watchlistId, source, found, newCount, error);
  },

  getRecentListings(limit = 100, offset = 0, source = null, watchlistId = null) {
    let sql = 'SELECT * FROM seen_listings WHERE 1=1';
    const params = [];

    if (source) {
      sql += ' AND source = ?';
      params.push(source);
    }
    if (watchlistId) {
      sql += ' AND watchlist_id = ?';
      params.push(watchlistId);
    }

    sql += ' ORDER BY first_seen DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.prepare(sql).all(...params);
  },

  getStats() {
    const total = db.prepare('SELECT COUNT(*) as count FROM seen_listings').get().count;
    const today = db.prepare(
      "SELECT COUNT(*) as count FROM seen_listings WHERE date(first_seen) = date('now')"
    ).get().count;
    const bySource = db.prepare(
      'SELECT source, COUNT(*) as count FROM seen_listings GROUP BY source ORDER BY count DESC'
    ).all();
    const byWatchlist = db.prepare(
      'SELECT watchlist_id, COUNT(*) as count FROM seen_listings GROUP BY watchlist_id ORDER BY count DESC'
    ).all();
    const recentScans = db.prepare(
      'SELECT * FROM scan_logs ORDER BY scan_time DESC LIMIT 20'
    ).all();

    return { total, today, bySource, byWatchlist, recentScans };
  },

  getUnnotified(watchlistId) {
    return db.prepare(
      'SELECT * FROM seen_listings WHERE watchlist_id = ? AND notified = 0 ORDER BY score DESC'
    ).all(watchlistId);
  }
};
