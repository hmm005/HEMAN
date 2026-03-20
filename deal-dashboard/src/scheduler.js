require('dotenv').config();
const cron = require('node-cron');
const { runFullScan } = require('./engine');

const intervalMinutes = parseInt(process.env.SCAN_INTERVAL_MINUTES) || 30;
let isScanning = false;
let lastScanTime = null;
let lastScanResults = null;

async function doScan() {
  if (isScanning) {
    console.log('⏳ Scan already in progress — skipping');
    return null;
  }

  isScanning = true;
  try {
    lastScanResults = await runFullScan();
    lastScanTime = new Date();
    return lastScanResults;
  } catch (err) {
    console.error('❌ Scan failed:', err.message);
    return null;
  } finally {
    isScanning = false;
  }
}

function startScheduler() {
  console.log(`\n📅 Scheduler started — scanning every ${intervalMinutes} minutes`);
  console.log(`   Next scan at: ${new Date(Date.now() + intervalMinutes * 60000).toLocaleString()}\n`);

  // Run every N minutes
  const cronExpr = `*/${intervalMinutes} * * * *`;
  cron.schedule(cronExpr, doScan);

  // Run immediately on start
  doScan();
}

function getStatus() {
  return {
    isScanning,
    lastScanTime,
    lastScanResults,
    intervalMinutes,
  };
}

// If run directly: single scan then exit
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--once')) {
    doScan().then(() => {
      console.log('\nSingle scan complete. Exiting.');
      process.exit(0);
    });
  } else {
    startScheduler();
  }
}

module.exports = { startScheduler, doScan, getStatus };
