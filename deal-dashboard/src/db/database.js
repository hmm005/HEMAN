const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'deals.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS seen_listings (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    watchlist_id TEXT NOT NULL,
    watchlist_name TEXT,
    title TEXT,
    price INTEGER,
    url TEXT,
    location TEXT,
    year INTEGER,
    mileage TEXT,
    image_url TEXT,
    posted_at TEXT,
    alerted_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_auction INTEGER DEFAULT 0,
    auction_end TEXT
  );
  CREATE TABLE IF NOT EXISTS scan_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scanned_at TEXT DEFAULT CURRENT_TIMESTAMP,
    watchlist_id TEXT,
    source TEXT,
    found_count INTEGER DEFAULT 0,
    new_count INTEGER DEFAULT 0,
    error TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_watchlist ON seen_listings(watchlist_id);
  CREATE INDEX IF NOT EXISTS idx_alerted ON seen_listings(alerted_at);
  CREATE INDEX IF NOT EXISTS idx_source ON seen_listings(source);
`);

module.exports = {
  hasSeenListing: (id) => !!db.prepare('SELECT id FROM seen_listings WHERE id = ?').get(id),

  markSeen: (listing) => {
    db.prepare(`
      INSERT OR IGNORE INTO seen_listings
        (id,source,watchlist_id,watchlist_name,title,price,url,location,year,mileage,image_url,posted_at,is_auction,auction_end)
      VALUES
        (@id,@source,@watchlistId,@watchlistName,@title,@price,@url,@location,@year,@mileage,@imageUrl,@postedAt,@isAuction,@auctionEnd)
    `).run({
      id: listing.id, source: listing.source, watchlistId: listing.watchlistId,
      watchlistName: listing.watchlistName||'', title: listing.title||'',
      price: listing.price||0, url: listing.url||'', location: listing.location||'',
      year: listing.year||null, mileage: listing.mileage||'', imageUrl: listing.imageUrl||'',
      postedAt: listing.postedAt||new Date().toISOString(),
      isAuction: listing.isAuction?1:0, auctionEnd: listing.auctionEnd||null
    });
  },

  logScan: (log) => db.prepare(
    'INSERT INTO scan_logs (watchlist_id,source,found_count,new_count,error) VALUES (@watchlistId,@source,@foundCount,@newCount,@error)'
  ).run(log),

  getRecentAlerts: (limit=100) => db.prepare('SELECT * FROM seen_listings ORDER BY alerted_at DESC LIMIT ?').all(limit),
  getAlertsByWatchlist: (wid, limit=50) => db.prepare('SELECT * FROM seen_listings WHERE watchlist_id=? ORDER BY alerted_at DESC LIMIT ?').all(wid, limit),

  getStats: () => ({
    total: db.prepare('SELECT COUNT(*) as c FROM seen_listings').get().c,
    today: db.prepare("SELECT COUNT(*) as c FROM seen_listings WHERE date(alerted_at)=date('now')").get().c,
    bySource: db.prepare('SELECT source, COUNT(*) as c FROM seen_listings GROUP BY source ORDER BY c DESC').all(),
    byWatchlist: db.prepare('SELECT watchlist_name, COUNT(*) as c FROM seen_listings GROUP BY watchlist_id ORDER BY c DESC').all(),
    recentScans: db.prepare('SELECT * FROM scan_logs ORDER BY scanned_at DESC LIMIT 20').all()
  }),

  clearAll: () => db.prepare('DELETE FROM seen_listings').run()
};
