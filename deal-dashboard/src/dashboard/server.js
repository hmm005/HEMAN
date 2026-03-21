require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { runFullScan } = require('../engine');

const app = express();
const PORT = process.env.PORT || 3000;
const WATCHLISTS_PATH = path.join(__dirname, '../../config/watchlists.json');
const loadWL = () => JSON.parse(fs.readFileSync(WATCHLISTS_PATH, 'utf8'));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/stats', (_, res) => res.json(db.getStats()));
app.get('/api/alerts', (req, res) => {
  const { limit=100, watchlist } = req.query;
  res.json(watchlist ? db.getAlertsByWatchlist(watchlist, +limit) : db.getRecentAlerts(+limit));
});
app.get('/api/watchlists', (_, res) => res.json(loadWL()));
app.post('/api/watchlists', (req, res) => {
  try {
    const wl = loadWL();
    const item = { ...req.body, id: Date.now().toString(), active: true };
    wl.push(item);
    fs.writeFileSync(WATCHLISTS_PATH, JSON.stringify(wl, null, 2));
    res.json({ success: true, watchlist: item });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/watchlists/:id', (req, res) => {
  try {
    const wl = loadWL();
    const i = wl.findIndex(w => w.id === req.params.id);
    if (i===-1) return res.status(404).json({ error:'Not found' });
    wl[i] = { ...wl[i], ...req.body };
    fs.writeFileSync(WATCHLISTS_PATH, JSON.stringify(wl, null, 2));
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/watchlists/:id', (req, res) => {
  try {
    const wl = loadWL().filter(w => w.id !== req.params.id);
    fs.writeFileSync(WATCHLISTS_PATH, JSON.stringify(wl, null, 2));
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/scan', (_, res) => {
  res.json({ message: 'Scan started' });
  runFullScan(loadWL()).catch(console.error);
});
app.delete('/api/alerts/clear', (_, res) => { db.clearAll(); res.json({ success: true }); });

app.listen(PORT, () => console.log(`🖥️  Dashboard → http://localhost:${PORT}`));
module.exports = app;
