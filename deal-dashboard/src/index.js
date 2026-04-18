require('dotenv').config();

const { startServer, setScanFunction, setStatusFunction } = require('./dashboard/server');
const { startScheduler, doScan, getStatus } = require('./scheduler');
const { startOutreachScheduler } = require('./outreach/scheduler');

console.log(`
╔══════════════════════════════════════════════╗
║          🚨 DEAL ALERT DASHBOARD 🚨          ║
║     Heman McCray | Elevate Home Solutions    ║
╚══════════════════════════════════════════════╝
`);

// Wire up scan trigger from dashboard
setScanFunction(doScan);
setStatusFunction(getStatus);

// Start Express dashboard
const port = process.env.PORT || 3000;
startServer(port);

// Start scan scheduler
startScheduler();

// Start outreach campaign scheduler (daily 7am)
startOutreachScheduler();
