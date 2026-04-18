const express = require('express');
const path = require('path');
const fs = require('fs');
const database = require('../db/database');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Get listings
app.get('/api/listings', (req, res) => {
  const { limit = 100, offset = 0, source, watchlist } = req.query;
  const listings = database.getRecentListings(
    parseInt(limit),
    parseInt(offset),
    source || null,
    watchlist || null
  );
  res.json(listings);
});

// API: Get stats
app.get('/api/stats', (req, res) => {
  res.json(database.getStats());
});

// API: Get watchlists
app.get('/api/watchlists', (req, res) => {
  const configPath = path.join(__dirname, '../../config/watchlists.json');
  const watchlists = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  res.json(watchlists);
});

// API: Add watchlist
app.post('/api/watchlists', (req, res) => {
  const configPath = path.join(__dirname, '../../config/watchlists.json');
  const watchlists = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const newWatchlist = {
    id: req.body.id || req.body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    active: true,
    ...req.body,
  };
  watchlists.push(newWatchlist);
  fs.writeFileSync(configPath, JSON.stringify(watchlists, null, 2));
  res.json({ ok: true, watchlist: newWatchlist });
});

// API: Toggle watchlist active state
app.patch('/api/watchlists/:id', (req, res) => {
  const configPath = path.join(__dirname, '../../config/watchlists.json');
  const watchlists = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const idx = watchlists.findIndex((w) => w.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  Object.assign(watchlists[idx], req.body);
  fs.writeFileSync(configPath, JSON.stringify(watchlists, null, 2));
  res.json({ ok: true, watchlist: watchlists[idx] });
});

// API: Get leads
app.get('/api/leads', (req, res) => {
  const { status } = req.query;
  res.json(database.getLeads(status || null));
});

// API: Mark lead replied
app.post('/api/leads/:id/replied', (req, res) => {
  database.updateLeadStatus(req.params.id, 'replied');
  res.json({ ok: true });
});

// API: Mark lead DNC
app.post('/api/leads/:id/dnc', (req, res) => {
  database.updateLeadStatus(req.params.id, 'dnc');
  res.json({ ok: true });
});

// API: Get pending call reminders
app.get('/api/call-reminders', (req, res) => {
  res.json(database.getPendingCallReminders());
});

// API: Dismiss call reminder
app.post('/api/call-reminders/:id/done', (req, res) => {
  database.dismissCallReminder(parseInt(req.params.id));
  res.json({ ok: true });
});

// API: Lead stats
app.get('/api/lead-stats', (req, res) => {
  res.json(database.getLeadStats());
});

// API: Trigger scan
let scanFn = null;
app.post('/api/scan', async (req, res) => {
  if (!scanFn) return res.status(503).json({ error: 'Scanner not initialized' });
  res.json({ ok: true, message: 'Scan triggered' });
  scanFn();
});

// API: Scheduler status
let statusFn = null;
app.get('/api/status', (req, res) => {
  const status = statusFn ? statusFn() : { isScanning: false };
  res.json(status);
});

function setScanFunction(fn) {
  scanFn = fn;
}

function setStatusFunction(fn) {
  statusFn = fn;
}

function startServer(port) {
  const p = port || process.env.PORT || 3000;
  app.listen(p, () => {
    console.log(`\n🖥️  Dashboard running at http://localhost:${p}`);
  });
  return app;
}

// If run directly
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  startServer();
}

module.exports = { app, startServer, setScanFunction, setStatusFunction };
