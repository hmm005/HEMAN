// ─── Map View (Leaflet + GPS + Instant Property Lookup) ────
const MapView = {
  map: null,
  userMarker: null,
  routeLine: null,
  propertyMarkers: [],
  routePoints: [],
  isDriving: false,
  watchId: null,
  sessionId: null,
  startTime: null,
  propertiesAdded: 0,
  currentPopup: null,
  currentLookup: null, // stores the last lookup result
  isSatellite: false,
  streetLayer: null,
  satelliteLayer: null,

  init() {
    // Street tiles
    this.streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
    });

    // Satellite/aerial tiles (Esri - free, no API key)
    this.satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      attribution: 'Esri'
    });

    this.map = L.map('map-container', {
      zoomControl: false,
      attributionControl: false,
      maxZoom: 20
    }).setView([33.5186, -86.8104], 15); // Birmingham AL, zoomed in close

    this.streetLayer.addTo(this.map);

    // Try to get user location immediately with high accuracy
    this.locateUser();

    // Tap to lookup property
    this.map.on('click', (e) => this.onMapTap(e));

    // Bind buttons
    document.getElementById('btn-drive').addEventListener('click', () => this.toggleDriving());
    document.getElementById('btn-locate').addEventListener('click', () => this.locateUser());
    document.getElementById('btn-satellite').addEventListener('click', () => this.toggleSatellite());
    document.getElementById('btn-add-manual').addEventListener('click', () => this.showAddManual());
  },

  invalidateSize() {
    if (this.map) setTimeout(() => this.map.invalidateSize(), 100);
  },

  // ── Satellite Toggle ───────────────────────────────────

  toggleSatellite() {
    const btn = document.getElementById('btn-satellite');
    if (this.isSatellite) {
      this.map.removeLayer(this.satelliteLayer);
      this.streetLayer.addTo(this.map);
      btn.textContent = '🛰️';
      this.isSatellite = false;
    } else {
      this.map.removeLayer(this.streetLayer);
      this.satelliteLayer.addTo(this.map);
      btn.textContent = '🗺️';
      this.isSatellite = true;
    }
  },

  // ── GPS Location ───────────────────────────────────────

  locateUser() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = [pos.coords.latitude, pos.coords.longitude];
        this.map.setView(latlng, Math.max(this.map.getZoom(), 17));
        this.updateUserMarker(latlng);
      },
      (err) => console.error('GPS error:', err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  },

  updateUserMarker(latlng) {
    if (this.userMarker) {
      this.userMarker.setLatLng(latlng);
    } else {
      this.userMarker = L.circleMarker(latlng, {
        radius: 10,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        color: '#fff',
        weight: 3
      }).addTo(this.map);
    }
  },

  // ── Driving Mode ───────────────────────────────────────

  async toggleDriving() {
    if (this.isDriving) {
      this.stopDriving();
    } else {
      this.startDriving();
    }
  },

  async startDriving() {
    if (!navigator.geolocation) {
      showToast('GPS not available', 'error');
      return;
    }

    this.isDriving = true;
    this.routePoints = [];
    this.propertiesAdded = 0;
    this.startTime = Date.now();

    try {
      const session = await api('/api/sessions', {
        method: 'POST',
        body: { started_at: new Date().toISOString() }
      });
      this.sessionId = session.id;
    } catch (err) {
      console.error('Session create failed:', err);
    }

    this.routeLine = L.polyline([], {
      color: '#3b82f6',
      weight: 5,
      opacity: 0.8
    }).addTo(this.map);

    // High accuracy GPS tracking
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.onGpsUpdate(pos),
      (err) => console.error('GPS watch error:', err),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );

    const btn = document.getElementById('btn-drive');
    btn.classList.add('driving');
    btn.innerHTML = '⬛ STOP';
    document.querySelector('.drive-stats').classList.add('visible');

    this.updateDriveStats();
    showToast('Driving! Tap any property to look it up.');
  },

  async stopDriving() {
    this.isDriving = false;

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    const miles = this.calculateDistance();

    if (this.sessionId) {
      try {
        await api(`/api/sessions/${this.sessionId}`, {
          method: 'PATCH',
          body: {
            ended_at: new Date().toISOString(),
            route_points: JSON.stringify(this.routePoints),
            distance_miles: miles,
            properties_added: this.propertiesAdded
          }
        });
      } catch (err) {
        console.error('Session save failed:', err);
      }
    }

    const btn = document.getElementById('btn-drive');
    btn.classList.remove('driving');
    btn.innerHTML = '▶ DRIVE';
    document.querySelector('.drive-stats').classList.remove('visible');

    showToast(`Done! ${miles.toFixed(1)} mi, ${this.propertiesAdded} properties`);
    App.loadData();
  },

  onGpsUpdate(pos) {
    const latlng = [pos.coords.latitude, pos.coords.longitude];
    this.updateUserMarker(latlng);

    this.routePoints.push({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      ts: Date.now()
    });

    if (this.routeLine) {
      this.routeLine.addLatLng(latlng);
    }

    this.map.panTo(latlng, { animate: true });
    this.updateDriveStats();
  },

  updateDriveStats() {
    const elapsed = Date.now() - (this.startTime || Date.now());
    const mins = Math.floor(elapsed / 60000);
    const miles = this.calculateDistance();

    document.getElementById('drive-time').textContent = `${mins}m`;
    document.getElementById('drive-miles').textContent = `${miles.toFixed(1)}`;
    document.getElementById('drive-props').textContent = this.propertiesAdded;
  },

  calculateDistance() {
    let total = 0;
    for (let i = 1; i < this.routePoints.length; i++) {
      total += haversine(
        this.routePoints[i - 1].lat, this.routePoints[i - 1].lng,
        this.routePoints[i].lat, this.routePoints[i].lng
      );
    }
    return total;
  },

  // ── TAP TO LOOKUP (the core DealMachine-like feature) ──

  async onMapTap(e) {
    const { lat, lng } = e.latlng;

    // Close previous popup
    if (this.currentPopup) this.map.closePopup(this.currentPopup);

    // Show loading popup immediately
    this.currentPopup = L.popup({ maxWidth: 320, minWidth: 280, className: 'lookup-popup' })
      .setLatLng(e.latlng)
      .setContent(`
        <div class="lp-loading">
          <div class="lp-spinner"></div>
          <div>Looking up property...</div>
        </div>
      `)
      .openOn(this.map);

    try {
      // ONE API call does everything: geocode + property data + skip trace
      const data = await api('/api/lookup', { method: 'POST', body: { lat, lng } });
      this.currentLookup = data;

      // Build the instant popup
      const alreadySaved = data.existingId ? `<div class="lp-saved">Already saved (${data.existingStatus})</div>` : '';

      const ownerSection = data.owner_name
        ? `<div class="lp-owner"><span class="lp-owner-label">OWNER</span> ${data.owner_name}</div>`
        : '';

      const valueSection = data.estimated_value
        ? `<div class="lp-value">Est. $${Number(data.estimated_value).toLocaleString()}</div>`
        : '';

      const detailsSection = (data.beds || data.sqft)
        ? `<div class="lp-details">${data.beds ? data.beds + ' bd' : ''} ${data.baths ? '/ ' + data.baths + ' ba' : ''} ${data.sqft ? '/ ' + data.sqft.toLocaleString() + ' sqft' : ''} ${data.year_built ? '/ ' + data.year_built : ''}</div>`
        : '';

      // Skip trace links
      const links = data.skipTrace?.freeLinks || [];
      const topLink = links.find(l => l.source === 'TruePeopleSearch (Address)') || links[0];

      const content = `
        <div class="lp-card">
          <div class="lp-address">${data.address || 'Unknown'}</div>
          <div class="lp-city">${[data.city, data.state, data.zip].filter(Boolean).join(', ')}</div>
          ${ownerSection}
          ${valueSection}
          ${detailsSection}
          ${alreadySaved}
          <div class="lp-actions">
            ${!data.existingId ? `<button class="lp-btn lp-btn-add" onclick="MapView.addFromLookup()">+ ADD LEAD</button>` : ''}
            <button class="lp-btn lp-btn-skip" onclick="MapView.openSkipTrace()">🔍 FIND OWNER</button>
          </div>
          ${topLink ? `<a href="${topLink.url}" target="_blank" class="lp-quick-link">Quick: Search ${topLink.source} →</a>` : ''}
        </div>
      `;

      this.currentPopup.setContent(content);
    } catch (err) {
      this.currentPopup.setContent(`
        <div class="lp-card">
          <div class="lp-address">Could not look up property</div>
          <div class="lp-city">Tap again or try a different spot</div>
        </div>
      `);
    }
  },

  async addFromLookup() {
    const data = this.currentLookup;
    if (!data) return;

    try {
      const prop = await api('/api/properties', {
        method: 'POST',
        body: {
          address: data.address,
          city: data.city || '',
          state: data.state || '',
          zip: data.zip || '',
          lat: data.lat,
          lng: data.lng,
          added_from: this.isDriving ? 'driving' : 'manual',
          session_id: this.sessionId || null
        }
      });

      // If we got property data, save it
      if (data.beds || data.estimated_value) {
        await api(`/api/properties/${prop.id}`, {
          method: 'PATCH',
          body: {
            beds: data.beds, baths: data.baths, sqft: data.sqft,
            year_built: data.year_built, property_type: data.property_type,
            estimated_value: data.estimated_value, assessed_value: data.assessed_value,
            last_sale_price: data.last_sale_price, last_sale_date: data.last_sale_date
          }
        });
      }

      // If we got owner name, save it
      if (data.owner_name) {
        await api(`/api/owners/${prop.id}`, {
          method: 'PATCH',
          body: {
            property_id: prop.id,
            name: data.owner_name,
            skip_trace_source: 'rentcast'
          }
        });
      }

      this.map.closePopup();
      this.propertiesAdded++;
      this.addMarker(prop);
      showToast(`Added: ${data.address}`);

      App.properties.push(prop);
      if (this.isDriving) this.updateDriveStats();
    } catch (err) {
      showToast('Failed to add property', 'error');
    }
  },

  openSkipTrace() {
    const data = this.currentLookup;
    if (!data) return;
    this.map.closePopup();

    // Open skip trace modal pre-filled
    SkipTraceView.open(
      data.existingId || null,
      data.address,
      data.city,
      data.state,
      data.zip
    );
  },

  showAddManual() {
    document.getElementById('add-property-modal').classList.add('open');
  },

  // ── Property Markers ───────────────────────────────────

  loadPropertyMarkers(properties) {
    this.propertyMarkers.forEach(m => this.map.removeLayer(m));
    this.propertyMarkers = [];
    properties.forEach(p => this.addMarker(p));
  },

  addMarker(prop) {
    if (!prop.lat || !prop.lng) return;

    const colors = {
      new: '#3b82f6',
      contacted: '#eab308',
      negotiating: '#22c55e',
      under_contract: '#a855f7',
      dead: '#ef4444'
    };

    const color = colors[prop.status] || colors.new;

    const marker = L.circleMarker([prop.lat, prop.lng], {
      radius: 8,
      fillColor: color,
      fillOpacity: 0.9,
      color: '#fff',
      weight: 2
    }).addTo(this.map);

    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      PropertiesView.openDetail(prop.id);
    });

    this.propertyMarkers.push(marker);
  }
};

// ─── Haversine Distance (miles) ────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
