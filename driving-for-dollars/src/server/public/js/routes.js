// ─── Routes / Driving History View ──────────────────────────
const RoutesView = {
  render() {
    const container = document.getElementById('routes-content');
    const sessions = App.sessions;

    if (!sessions || sessions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🚗</div>
          <h3>No driving sessions</h3>
          <p>Go to the Map tab and tap "Drive" to start tracking your route through neighborhoods.</p>
        </div>
      `;
      return;
    }

    // Total stats
    const totalMiles = sessions.reduce((sum, s) => sum + (s.distance_miles || 0), 0);
    const totalProps = sessions.reduce((sum, s) => sum + (s.properties_added || 0), 0);

    container.innerHTML = `
      <div class="stats-grid mb-16">
        <div class="stat-card">
          <div class="stat-number">${sessions.length}</div>
          <div class="stat-label">Sessions</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${totalMiles.toFixed(1)}</div>
          <div class="stat-label">Miles Driven</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${totalProps}</div>
          <div class="stat-label">Properties Found</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${sessions.length > 0 ? (totalProps / sessions.length).toFixed(1) : 0}</div>
          <div class="stat-label">Avg / Session</div>
        </div>
      </div>

      ${sessions.map(s => {
        const duration = s.ended_at && s.started_at
          ? Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 60000)
          : 0;
        return `
          <div class="session-card" onclick="RoutesView.showRoute('${s.id}')">
            <div class="session-date">${formatDate(s.started_at)}</div>
            <div class="session-meta">
              <span>🕐 ${duration}m</span>
              <span>📏 ${(s.distance_miles || 0).toFixed(1)} mi</span>
              <span>🏠 ${s.properties_added || 0} properties</span>
            </div>
          </div>
        `;
      }).join('')}
    `;
  },

  async showRoute(sessionId) {
    try {
      const session = await api(`/api/sessions/${sessionId}`);
      const points = JSON.parse(session.route_points || '[]');

      if (points.length === 0) {
        showToast('No route data for this session');
        return;
      }

      // Switch to map view and draw the route
      App.switchView('map');

      // Remove any previous route overlay
      if (this._routeOverlay) {
        MapView.map.removeLayer(this._routeOverlay);
      }

      // Draw route in orange to distinguish from active driving (blue)
      const latlngs = points.map(p => [p.lat, p.lng]);
      this._routeOverlay = L.polyline(latlngs, {
        color: '#f59e0b',
        weight: 4,
        opacity: 0.7,
        dashArray: '8, 8'
      }).addTo(MapView.map);

      // Fit map to route bounds
      MapView.map.fitBounds(this._routeOverlay.getBounds(), { padding: [40, 40] });

      showToast(`Showing route from ${formatDate(session.started_at)}`);

      // Auto-remove after 30 seconds
      setTimeout(() => {
        if (this._routeOverlay) {
          MapView.map.removeLayer(this._routeOverlay);
          this._routeOverlay = null;
        }
      }, 30000);
    } catch (err) {
      showToast('Failed to load route', 'error');
    }
  }
};

// ─── Dashboard / Stats View ─────────────────────────────────
const DashboardView = {
  async render() {
    try {
      const stats = await api('/api/stats');
      const container = document.getElementById('dashboard-content');

      const statusColors = {
        new: '#3b82f6',
        contacted: '#eab308',
        negotiating: '#22c55e',
        under_contract: '#a855f7',
        dead: '#ef4444'
      };

      const maxCount = Math.max(...Object.values(stats.byStatus || {}), 1);

      container.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">${stats.totalProperties}</div>
            <div class="stat-label">Total Properties</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.contactsThisWeek}</div>
            <div class="stat-label">Contacts This Week</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.skipTraced}</div>
            <div class="stat-label">Skip Traced</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.totalMiles}</div>
            <div class="stat-label">Miles Driven</div>
          </div>
        </div>

        <div class="pipeline">
          <h3>Property Pipeline</h3>
          ${['new', 'contacted', 'negotiating', 'under_contract', 'dead'].map(status => {
            const count = stats.byStatus?.[status] || 0;
            const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
            return `
              <div class="pipeline-row">
                <span class="pipeline-label">
                  <span class="status-badge status-${status}">${status.replace('_', ' ')}</span>
                </span>
                <div class="pipeline-bar">
                  <div class="fill" style="width:${pct}%; background:${statusColors[status]}"></div>
                </div>
                <span class="pipeline-count">${count}</span>
              </div>
            `;
          }).join('')}
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">${stats.totalSessions}</div>
            <div class="stat-label">Drive Sessions</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.totalProperties > 0 ? Math.round(stats.skipTraced / stats.totalProperties * 100) : 0}%</div>
            <div class="stat-label">Skip Trace Rate</div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error('Dashboard render error:', err);
    }
  }
};
