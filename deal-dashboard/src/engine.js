const fs = require('fs');
const path = require('path');
const database = require('./db/database');
const { matchesWatchlist, scoreListing } = require('./alerts/matcher');
const { sendBatchAlerts } = require('./alerts/twilio');

const craigslist = require('./scrapers/craigslist');
const ebay = require('./scrapers/ebay');
const autotrader = require('./scrapers/autotrader');
const cargurus = require('./scrapers/cargurus');
const cars_com = require('./scrapers/cars_com');
const auctions = require('./scrapers/auctions');
const othercars = require('./scrapers/othercars');
const business = require('./scrapers/business');

const SCRAPERS = {
  craigslist,
  ebay,
  autotrader,
  cargurus,
  cars_com,
  carsforsale: othercars,
  hemmings: othercars,
  truckpaper: othercars,
  carsdirect: othercars,
  copart: auctions,
  iaai: auctions,
  govplanet: auctions,
  publicsurplus: auctions,
  bizbuy: business,
  bizquest: business,
};

// Track which composite scrapers we've already run for a given watchlist scan
const COMPOSITE_SCRAPERS = new Set(['carsforsale', 'hemmings', 'truckpaper', 'carsdirect', 'copart', 'iaai', 'govplanet', 'publicsurplus', 'bizbuy', 'bizquest']);

function loadWatchlists() {
  const configPath = path.join(__dirname, '../config/watchlists.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8')).filter((w) => w.active);
}

async function scanWatchlist(watchlist) {
  console.log(`\n🔍 Scanning: ${watchlist.name}`);
  const allListings = [];
  const scrapedModules = new Set();

  for (const source of watchlist.sources) {
    const scraper = SCRAPERS[source];
    if (!scraper) {
      console.log(`  [${source}] No scraper available — skipping`);
      continue;
    }

    // Avoid running composite scrapers (auctions, othercars, business) multiple times
    const scraperKey = scraper === auctions ? 'auctions' :
                       scraper === othercars ? 'othercars' :
                       scraper === business ? 'business' : source;

    if (scrapedModules.has(scraperKey)) continue;
    scrapedModules.add(scraperKey);

    try {
      const results = await scraper.scrape(watchlist);
      const matched = results.filter((listing) => matchesWatchlist(listing, watchlist));

      // Score and tag each listing
      const scored = matched.map((listing) => ({
        ...listing,
        watchlist_id: watchlist.id,
        score: scoreListing(listing, watchlist),
        auction_end: listing.auction_end || null,
        image_url: listing.image_url || null,
      }));

      allListings.push(...scored);
      database.logScan(watchlist.id, scraperKey, results.length, scored.length);
    } catch (err) {
      console.error(`  [${source}] Scan error: ${err.message}`);
      database.logScan(watchlist.id, source, 0, 0, err.message);
    }
  }

  // Store in database
  const newCount = database.addListings(allListings);
  console.log(`  ✅ ${watchlist.name}: ${allListings.length} matched, ${newCount} new`);

  // Send alerts for new listings
  if (newCount > 0) {
    const unnotified = database.getUnnotified(watchlist.id);
    if (unnotified.length > 0) {
      const maxAlerts = parseInt(process.env.MAX_ALERTS_PER_SCAN) || 5;
      const sent = await sendBatchAlerts(unnotified, watchlist, maxAlerts);
      for (const listing of unnotified.slice(0, maxAlerts)) {
        database.markNotified(listing.id);
      }
      console.log(`  📱 Sent ${sent} SMS alerts`);
    }
  }

  return { total: allListings.length, new: newCount };
}

async function runFullScan() {
  const watchlists = loadWatchlists();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Starting full scan — ${watchlists.length} watchlists`);
  console.log(`   ${new Date().toLocaleString()}`);
  console.log('='.repeat(60));

  const results = {};
  for (const watchlist of watchlists) {
    results[watchlist.id] = await scanWatchlist(watchlist);
    // Pause between watchlists to be respectful
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ Full scan complete');
  for (const [id, r] of Object.entries(results)) {
    console.log(`   ${id}: ${r.total} matched, ${r.new} new`);
  }
  console.log('='.repeat(60));

  return results;
}

module.exports = { runFullScan, scanWatchlist, loadWatchlists };
