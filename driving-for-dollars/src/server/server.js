const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const database = require('../db/database');
const { reverseGeocode, forwardGeocode } = require('../services/geocoder');
const { skipTrace } = require('../services/skipTrace');
const { lookupProperty } = require('../services/propertyLookup');

function createServer() {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // ─── Properties ──────────────────────────────────────────

  app.get('/api/properties', (req, res) => {
    const { status, list_id, search, limit, offset } = req.query;
    const properties = database.getProperties({
      status: status || undefined,
      list_id: list_id || undefined,
      search: search || undefined,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });
    res.json(properties);
  });

  app.post('/api/properties', (req, res) => {
    const id = uuidv4();
    const prop = { id, ...req.body };
    database.addProperty(prop);
    const saved = database.getProperty(id);
    res.status(201).json(saved);
  });

  app.get('/api/properties/:id', (req, res) => {
    const prop = database.getProperty(req.params.id);
    if (!prop) return res.status(404).json({ error: 'Property not found' });

    const owner = database.getOwner(req.params.id);
    const contacts = database.getContacts(req.params.id);
    res.json({ ...prop, owner, contacts });
  });

  app.patch('/api/properties/:id', (req, res) => {
    const prop = database.getProperty(req.params.id);
    if (!prop) return res.status(404).json({ error: 'Property not found' });

    database.updateProperty(req.params.id, req.body);
    const updated = database.getProperty(req.params.id);
    res.json(updated);
  });

  app.delete('/api/properties/:id', (req, res) => {
    database.deleteProperty(req.params.id);
    res.json({ ok: true });
  });

  // ─── Owners / Skip Trace ────────────────────────────────

  app.get('/api/owners/:propertyId', (req, res) => {
    const owner = database.getOwner(req.params.propertyId);
    res.json(owner || null);
  });

  app.patch('/api/owners/:id', (req, res) => {
    const owner = database.upsertOwner({ id: req.params.id, ...req.body });
    res.json(owner);
  });

  app.post('/api/skip-trace', async (req, res) => {
    const { name, address, city, state, zip, property_id } = req.body;

    const result = await skipTrace({ name, address, city, state, zip });

    // If paid API returned results, save to database
    if (result.paidResult && property_id) {
      const ownerId = uuidv4();
      const ownerData = {
        id: ownerId,
        property_id,
        name: result.paidResult.name,
        mailing_address: result.paidResult.mailing_address,
        mailing_city: result.paidResult.mailing_city,
        mailing_state: result.paidResult.mailing_state,
        mailing_zip: result.paidResult.mailing_zip,
        phone1: result.paidResult.phones?.[0] || null,
        phone2: result.paidResult.phones?.[1] || null,
        phone3: result.paidResult.phones?.[2] || null,
        email1: result.paidResult.emails?.[0] || null,
        email2: result.paidResult.emails?.[1] || null,
        skip_traced_at: new Date().toISOString(),
        skip_trace_source: 'tracerfy'
      };
      database.upsertOwner(ownerData);
    }

    res.json(result);
  });

  // ─── Driving Sessions ───────────────────────────────────

  app.get('/api/sessions', (req, res) => {
    const sessions = database.getSessions(parseInt(req.query.limit) || 50);
    res.json(sessions);
  });

  app.post('/api/sessions', (req, res) => {
    const id = uuidv4();
    const session = database.createSession({ id, ...req.body });
    res.status(201).json(session);
  });

  app.patch('/api/sessions/:id', (req, res) => {
    const session = database.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const updated = database.endSession(req.params.id, req.body);
    res.json(updated);
  });

  app.get('/api/sessions/:id', (req, res) => {
    const session = database.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  });

  // ─── Lists ──────────────────────────────────────────────

  app.get('/api/lists', (req, res) => {
    res.json(database.getLists());
  });

  app.post('/api/lists', (req, res) => {
    const id = uuidv4();
    const list = database.createList({ id, ...req.body });
    res.status(201).json(list);
  });

  app.patch('/api/lists/:id', (req, res) => {
    const updated = database.updateList(req.params.id, req.body);
    res.json(updated);
  });

  // ─── Contact Log ────────────────────────────────────────

  app.post('/api/contacts', (req, res) => {
    const contacts = database.addContact(req.body);
    res.status(201).json(contacts);
  });

  app.get('/api/contacts/:propertyId', (req, res) => {
    res.json(database.getContacts(req.params.propertyId));
  });

  // ─── Instant Lookup (tap on map → get everything) ────────

  app.post('/api/lookup', async (req, res) => {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    // Step 1: Reverse geocode to get address
    const geo = await reverseGeocode(lat, lng);
    if (!geo) return res.json({
      address: null, city: null, state: null, zip: null, lat, lng,
      error: 'Could not find address for this location',
      skipTrace: { freeLinks: [] }
    });

    // Step 2: Check if we already have this property
    const existing = database.findPropertyByAddress(geo.address, geo.city, geo.state);

    // Step 3: Get property data from RentCast (if API key configured)
    let propertyData = null;
    try {
      propertyData = await lookupProperty(geo.address, geo.city, geo.state, geo.zip);
    } catch (e) { /* optional */ }

    // Step 4: Generate skip trace links
    const ownerName = propertyData?.owner_name || existing?.ownerName || null;
    const traceResult = await skipTrace({
      name: ownerName,
      address: geo.address,
      city: geo.city,
      state: geo.state,
      zip: geo.zip
    });

    res.json({
      address: geo.address,
      city: geo.city,
      state: geo.state,
      zip: geo.zip,
      lat: geo.lat,
      lng: geo.lng,
      county: geo.county,
      // Property data (if available)
      owner_name: propertyData?.owner_name || null,
      beds: propertyData?.beds || null,
      baths: propertyData?.baths || null,
      sqft: propertyData?.sqft || null,
      year_built: propertyData?.year_built || null,
      estimated_value: propertyData?.estimated_value || null,
      assessed_value: propertyData?.assessed_value || null,
      property_type: propertyData?.property_type || null,
      last_sale_price: propertyData?.last_sale_price || null,
      last_sale_date: propertyData?.last_sale_date || null,
      // Skip trace
      skipTrace: traceResult,
      // Already saved?
      existingId: existing?.id || null,
      existingStatus: existing?.status || null
    });
  });

  // ─── Utilities ──────────────────────────────────────────

  app.post('/api/geocode', async (req, res) => {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const result = await reverseGeocode(lat, lng);
    if (!result) return res.status(404).json({ error: 'Could not geocode location' });
    res.json(result);
  });

  app.post('/api/geocode/forward', async (req, res) => {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'address required' });

    const result = await forwardGeocode(address);
    if (!result) return res.status(404).json({ error: 'Address not found' });
    res.json(result);
  });

  app.get('/api/property-data/:propertyId', async (req, res) => {
    const prop = database.getProperty(req.params.propertyId);
    if (!prop) return res.status(404).json({ error: 'Property not found' });

    const data = await lookupProperty(prop.address, prop.city, prop.state, prop.zip);
    if (!data) return res.json({ message: 'No property data available. Configure RENTCAST_API_KEY for property details.' });

    database.updateProperty(prop.id, {
      beds: data.beds, baths: data.baths, sqft: data.sqft,
      year_built: data.year_built, lot_size: data.lot_size,
      property_type: data.property_type, assessed_value: data.assessed_value,
      estimated_value: data.estimated_value, last_sale_price: data.last_sale_price,
      last_sale_date: data.last_sale_date
    });

    if (data.owner_name) {
      database.upsertOwner({
        id: uuidv4(),
        property_id: prop.id,
        name: data.owner_name,
        mailing_address: data.owner_address,
        skip_trace_source: 'rentcast'
      });
    }

    res.json(data);
  });

  app.get('/api/stats', (req, res) => {
    res.json(database.getStats());
  });

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  return app;
}

module.exports = { createServer };
