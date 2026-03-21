require('dotenv').config();
const pLimit = require('p-limit');
const db = require('./db/database');
const { filterAndScore } = require('./alerts/matcher');
const { sendBatchAlerts } = require('./alerts/twilio');

const { searchCraigslist } = require('./scrapers/craigslist');
const { searchEbay } = require('./scrapers/ebay');
const { searchAutoTrader } = require('./scrapers/autotrader');
const { searchCarGurus } = require('./scrapers/cargurus');
const { searchCarsDotCom } = require('./scrapers/cars_com');
const { searchCopart, searchIAAI, searchGovPlanet, searchPublicSurplus } = require('./scrapers/auctions');
const { searchCarsForSale, searchHemmings, searchTruckPaper, searchCarsDirect } = require('./scrapers/othercars');
const { searchBizBuySell, searchBizQuest } = require('./scrapers/business');

const SCRAPERS = {
  craigslist:searchCraigslist, ebay:searchEbay, autotrader:searchAutoTrader,
  cargurus:searchCarGurus, cars_com:searchCarsDotCom,
  copart:searchCopart, iaai:searchIAAI, govplanet:searchGovPlanet, publicsurplus:searchPublicSurplus,
  carsforsale:searchCarsForSale, hemmings:searchHemmings, truckpaper:searchTruckPaper, carsdirect:searchCarsDirect,
  bizbuysell:searchBizBuySell, bizquest:searchBizQuest
};

const limit = pLimit(3);

async function runFullScan(watchlists) {
  console.log(`\n${'═'.repeat(55)}\n🚀 SCAN — ${new Date().toLocaleString()}\n${'═'.repeat(55)}`);
  let totalNew = 0;

  for (const watchlist of watchlists.filter(w => w.active !== false)) {
    console.log(`\n🔍 ${watchlist.name}`);
    const tasks = (watchlist.sources||[]).map(src => limit(async () => {
      const scraper = SCRAPERS[src.toLowerCase()];
      if (!scraper) return [];
      try {
        console.log(`  → ${src}...`);
        const raw = await scraper(watchlist);
        const matched = filterAndScore(raw, watchlist);
        console.log(`     ${src}: ${raw.length} found, ${matched.length} matched`);
        return matched;
      } catch(e) { console.error(`  ✗ ${src}:`, e.message); return []; }
    }));

    const allMatched = (await Promise.allSettled(tasks))
      .filter(r => r.status==='fulfilled').flatMap(r => r.value);

    // Deduplicate
    const seen = new Set();
    const unique = allMatched.filter(l => { if(seen.has(l.id)) return false; seen.add(l.id); return true; });

    // Find new ones
    const newListings = unique.filter(l => !db.hasSeenListing(l.id));
    newListings.forEach(l => db.markSeen(l));

    console.log(`  ✅ ${newListings.length} NEW`);
    if (newListings.length > 0) {
      await sendBatchAlerts(newListings, watchlist, parseInt(process.env.MAX_ALERTS_PER_SCAN)||5);
    }
    totalNew += newListings.length;
  }

  console.log(`\n📊 Done — ${totalNew} new total | ${db.getStats().total} tracked\n${'═'.repeat(55)}\n`);
  return totalNew;
}

module.exports = { runFullScan };
