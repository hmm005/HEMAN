require('dotenv').config();
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { runFullScan } = require('./engine');

const WATCHLISTS_PATH = path.join(__dirname, '../config/watchlists.json');
const loadWatchlists = () => JSON.parse(fs.readFileSync(WATCHLISTS_PATH, 'utf8'));
const scan = async () => { const wl = loadWatchlists(); if (wl.length) await runFullScan(wl); };

if (process.argv.includes('--once')) {
  scan().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else {
  const mins = parseInt(process.env.SCAN_INTERVAL_MINUTES)||30;
  console.log(`⏰ Scheduler started — scanning every ${mins} minutes`);
  scan();
  cron.schedule(`*/${mins} * * * *`, scan);
}
