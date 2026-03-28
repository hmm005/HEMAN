// ─── Map View (Leaflet + GPS Tracking) ─────────────────────
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
  tappedLatLng: null,
  tappedPopup: null,

  init() {
    this.map = L.map('map-container', {
      zoomControl: false,
      attributionControl: false
    }).setView([33.5186, -86.8104], 13); // Birmingham, AL default

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.map);

    // Locate user on load
    this.map.locate({ setView: true, maxZoom: 16 });
    this.map.on('locationfound', (e) => this.onLocationFound(e));

    // Tap to get address
    this.map.on('click', (e) => this.onMapTap(e));

    // Bind buttons
    document.getElementById('btn-drive').addEventListener('click', () => this.toggleDriving());
    document.getElementById('btn-locate').addEventListener('click', () => this.locateUser());
    document.getElementById('btn-add-manual').addEventListener('click', () => this.showAddManual());
  },

  invalidateSize() {
    if (this.map) setTimeout(() => this.map.invalidateSize(), 100);
  },

  onLocationFound(e) {
    if (this.userMarker) {
      this.userMarker.setLatLng(e.latlng);
    } else {
      this.userMarker = L.circleMarker(e.latlng, {
        radius: 8,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        color: '#fff',
        weight: 3
      }).addTo(this.map);
    }
  },

  locateUser() {
    this.map.locate({ setView: true, maxZoom: 17 });
  },

  // ── GPS Driving ────────────────────────────────────────

  async toggleDriving() {
    if (this.isDriving) {
      this.stopDriving();
    } else {
      this.startDriving();
    }
  },

  async startDriving() {
    if (!navigator.geolocation) {
      showToast('GPS not available on this device', 'error');
      return;
    }

    this.isDriving = true;
    this.routePoints = [];
    this.propertiesAdded = 0;
    this.startTime = Date.now();

    // Create session on server
    try {
      const session = await api('/api/sessions', {
        method: 'POST',
        body: { started_at: new Date().toISOString() }
      });
      this.sessionId = session.id;
    } catch (err) {
      console.error('Failed to create session:', err);
    }

    // Start route line
    this.routeLine = L.polyline([], {
      color: '#3b82f6',
      weight: 4,
      opacity: 0.8
    }).addTo(this.map);

    // Start watching position
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.onGpsUpdate(pos),
      (err) => console.error('GPS error:', err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    // Update UI
    const btn = document.getElementById('btn-drive');
    btn.classList.add('driving');
    btn.innerHTML = '<span>&#9632;</span> Stop';
    document.querySelector('.drive-stats').classList.add('visible');

    this.updateDriveStats();
    showToast('Driving started! Tap properties to add them.');
  },

  async stopDriving() {
    this.isDriving = false;

    // Stop GPS watch
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    // Calculate distance
    const miles = this.calculateDistance();

    // Save session
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
        console.error('Failed to save session:', err);
      }
    }

    // Update UI
    const btn = document.getElementById('btn-drive');
    btn.classList.remove('driving');
    btn.innerHTML = '<span>&#9654;</span> Drive';
    document.querySelector('.drive-stats').classList.remove('visible');

    showToast(`Drive saved! ${miles.toFixed(1)} mi, ${this.propertiesAdded} properties`);
    App.loadData();
  },

  onGpsUpdate(pos) {
    const latlng = [pos.coords.latitude, pos.coords.longitude];

    // Update user marker
    if (this.userMarker) {
      this.userMarker.setLatLng(latlng);
    } else {
      this.userMarker = L.circleMarker(latlng, {
        radius: 8, fillColor: '#3b82f6', fillOpacity: 1, color: '#fff', weight: 3
      }).addTo(this.map);
    }

    // Add to route
    this.routePoints.push({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      ts: Date.now()
    });

    if (this.routeLine) {
      this.routeLine.addLatLng(latlng);
    }

    // Pan map to follow user
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

  // ── Tap to Add Property ────────────────────────────────

  async onMapTap(e) {
    const { lat, lng } = e.latlng;
    this.tappedLatLng = { lat, lng };

    // Remove previous popup
    if (this.tappedPopup) {
      this.map.closePopup(this.tappedPopup);
    }

    // Show loading popup
    this.tappedPopup = L.popup()
      .setLatLng(e.latlng)
      .setContent('<div class="property-popup"><p>Looking up address...</p></div>')
      .openOn(this.map);

    // Reverse geocode
    try {
      const geo = await api('/api/geocode', {
        method: 'POST',
        body: { lat, lng }
      });

      if (geo) {
        const content = `
          <div class="property-popup">
            <h3>${geo.address || 'Unknown Address'}</h3>
            <p>${[geo.city, geo.state, geo.zip].filter(Boolean).join(', ')}</p>
            <button class="popup-btn" onclick="MapView.addPropertyFromTap('${geo.address}', '${geo.city}', '${geo.state}', '${geo.zip}')">
              + Add Property
            </button>
          </div>
        `;
        this.tappedPopup.setContent(content);
      }
    } catch (err) {
      this.tappedPopup.setContent('<div class="property-popup"><p>Could not find address</p></div>');
    }
  },

  async addPropertyFromTap(address, city, state, zip) {
    try {
      const prop = await api('/api/properties', {
        method: 'POST',
        body: {
          address: address,
          city: city !== 'undefined' ? city : '',
          state: state !== 'undefined' ? state : '',
          zip: zip !== 'undefined' ? zip : '',
          lat: this.tappedLatLng.lat,
          lng: this.tappedLatLng.lng,
          added_from: this.isDriving ? 'driving' : 'manual',
          session_id: this.sessionId || null
        }
      });

      this.map.closePopup();
      this.propertiesAdded++;
      this.addMarker(prop);
      showToast(`Added: ${address}`);

      App.properties.push(prop);
      if (this.isDriving) this.updateDriveStats();
    } catch (err) {
      showToast('Failed to add property', 'error');
    }
  },

  showAddManual() {
    const overlay = document.getElementById('add-property-modal');
    overlay.classList.add('open');
  },

  // ── Property Markers ───────────────────────────────────

  loadPropertyMarkers(properties) {
    // Clear existing
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
      radius: 7,
      fillColor: color,
      fillOpacity: 0.9,
      color: '#fff',
      weight: 2
    }).addTo(this.map);

    marker.bindPopup(`
      <div class="property-popup">
        <h3>${prop.address}</h3>
        <p>${[prop.city, prop.state].filter(Boolean).join(', ')}</p>
        <button class="popup-btn" onclick="PropertiesView.openDetail('${prop.id}')">View Details</button>
      </div>
    `);

    this.propertyMarkers.push(marker);
  }
};

// ─── Haversine Distance (miles) ────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
