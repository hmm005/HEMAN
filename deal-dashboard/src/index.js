require('dotenv').config();
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { runFullScan } = require('./engine');
require('./dashboard/server');

const WATCHLISTS_PATH = path.join(__dirname, '../config/watchlists.json');
const loadWatchlists = () => JSON.parse(fs.readFileSync(WATCHLISTS_PATH, 'utf8'));
const scan = async () => { const wl = loadWatchlists(); if (wl.length) await runFullScan(wl); };

const mins = parseInt(process.env.SCAN_INTERVAL_MINUTES)||30;
const active = loadWatchlists().filter(w=>w.active!==false).map(w=>w.name);

console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║        DEAL DASHBOARD — ELEVATE HOME SOLUTIONS       ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log(`\n  Dashboard:  http://localhost:${process.env.PORT||3000}`);
console.log(`  Scan every: ${mins} minutes`);
console.log(`  Watching:   ${active.join(', ')||'none'}`);
console.log('  Twilio:     '+(process.env.TWILIO_ACCOUNT_SID?.startsWith('AC')?'✅ Ready':'⚠️  Add to .env'));
console.log('  eBay API:   '+(process.env.EBAY_APP_ID&&!process.env.EBAY_APP_ID.includes('YourApp')?'✅ Ready':'⚠️  Add to .env'));
console.log('\n');

scan();
cron.schedule(`*/${mins} * * * *`, scan);
