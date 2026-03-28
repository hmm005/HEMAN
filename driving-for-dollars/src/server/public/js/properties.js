// ─── Properties List & Detail View ──────────────────────────
const PropertiesView = {
  currentFilter: 'all',
  searchQuery: '',

  render() {
    let props = App.properties;

    // Filter by status
    if (this.currentFilter !== 'all') {
      props = props.filter(p => p.status === this.currentFilter);
    }

    // Filter by search
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      props = props.filter(p =>
        p.address?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.notes?.toLowerCase().includes(q)
      );
    }

    // Render filter pills
    this.renderFilters();

    // Render list
    const list = document.getElementById('property-list');
    if (props.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏠</div>
          <h3>No properties yet</h3>
          <p>Go to the Map tab and tap on properties while driving to add them here.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = props.map(p => {
      const distress = JSON.parse(p.distress_indicators || '[]');
      return `
        <div class="property-card" onclick="PropertiesView.openDetail('${p.id}')">
          <div class="card-header">
            <div>
              <div class="card-address">${p.address || 'Unknown Address'}</div>
              <div class="card-city">${[p.city, p.state, p.zip].filter(Boolean).join(', ')}</div>
            </div>
            <span class="status-badge status-${p.status}">${p.status.replace('_', ' ')}</span>
          </div>
          ${distress.length > 0 ? `
            <div class="card-tags">
              ${distress.map(d => `<span class="distress-tag">${d}</span>`).join('')}
            </div>
          ` : ''}
          <div class="card-city mt-8">${timeAgo(p.created_at)} &bull; ${p.added_from}</div>
        </div>
      `;
    }).join('');
  },

  renderFilters() {
    const filters = ['all', 'new', 'contacted', 'negotiating', 'under_contract', 'dead'];
    const bar = document.getElementById('filter-bar');
    bar.innerHTML = filters.map(f => `
      <button class="filter-pill ${this.currentFilter === f ? 'active' : ''}"
              onclick="PropertiesView.setFilter('${f}')">
        ${f === 'all' ? 'All' : f.replace('_', ' ')}
        ${f !== 'all' ? `(${App.properties.filter(p => p.status === f).length})` : `(${App.properties.length})`}
      </button>
    `).join('');
  },

  setFilter(filter) {
    this.currentFilter = filter;
    this.render();
  },

  setSearch(query) {
    this.searchQuery = query;
    this.render();
  },

  // ── Property Detail ────────────────────────────────────

  async openDetail(id) {
    const detail = document.getElementById('property-detail');
    detail.classList.add('open');

    try {
      const data = await api(`/api/properties/${id}`);
      this.renderDetail(data);
    } catch (err) {
      showToast('Failed to load property', 'error');
    }
  },

  closeDetail() {
    document.getElementById('property-detail').classList.remove('open');
    App.refreshProperties();
  },

  renderDetail(data) {
    const body = document.getElementById('detail-body');
    const distress = JSON.parse(data.distress_indicators || '[]');

    const allDistressOptions = [
      'Vacant', 'Overgrown Yard', 'Boarded Up', 'Damaged Roof',
      'Mail Piling Up', 'Code Violations', 'Fire Damage', 'Peeling Paint',
      'Broken Windows', 'Trash/Debris', 'No Curtains', 'Tall Grass'
    ];

    body.innerHTML = `
      <!-- Address -->
      <div class="detail-section">
        <h3>Address</h3>
        <div style="font-size:16px; font-weight:600; margin-bottom:4px;">${data.address}</div>
        <div class="text-muted">${[data.city, data.state, data.zip].filter(Boolean).join(', ')}</div>
      </div>

      <!-- Status -->
      <div class="detail-section">
        <h3>Status</h3>
        <select class="status-select" onchange="PropertiesView.updateStatus('${data.id}', this.value)">
          ${['new', 'contacted', 'negotiating', 'under_contract', 'dead'].map(s =>
            `<option value="${s}" ${data.status === s ? 'selected' : ''}>${s.replace('_', ' ')}</option>`
          ).join('')}
        </select>
      </div>

      <!-- Action Buttons -->
      <div class="action-btns">
        <button class="action-btn primary" onclick="SkipTraceView.open('${data.id}', '${data.address}', '${data.city}', '${data.state}', '${data.zip}')">
          🔍 Skip Trace
        </button>
        <button class="action-btn" onclick="PropertiesView.lookupPropertyData('${data.id}')">
          📊 Property Data
        </button>
        ${data.owner?.phone1 ? `
          <a href="tel:${data.owner.phone1}" class="action-btn" style="text-decoration:none;">
            📞 Call Owner
          </a>
        ` : `
          <button class="action-btn" disabled style="opacity:0.5;">📞 No Phone</button>
        `}
        <button class="action-btn" onclick="PropertiesView.showContactLog('${data.id}', '${data.owner?.id || ''}')">
          📝 Log Contact
        </button>
      </div>

      <!-- Owner Info -->
      <div class="detail-section">
        <h3>Owner</h3>
        ${data.owner ? `
          <div class="owner-card">
            <div class="owner-name">${data.owner.name || 'Unknown'}</div>
            ${data.owner.phone1 ? `
              <div class="owner-detail">📞 <a href="tel:${data.owner.phone1}">${data.owner.phone1}</a></div>
            ` : ''}
            ${data.owner.phone2 ? `
              <div class="owner-detail">📞 <a href="tel:${data.owner.phone2}">${data.owner.phone2}</a></div>
            ` : ''}
            ${data.owner.email1 ? `
              <div class="owner-detail">✉️ <a href="mailto:${data.owner.email1}">${data.owner.email1}</a></div>
            ` : ''}
            ${data.owner.mailing_address ? `
              <div class="owner-detail">📮 ${[data.owner.mailing_address, data.owner.mailing_city, data.owner.mailing_state, data.owner.mailing_zip].filter(Boolean).join(', ')}</div>
            ` : ''}
            ${data.owner.skip_traced_at ? `
              <div class="owner-detail text-muted">Skip traced ${formatDate(data.owner.skip_traced_at)} via ${data.owner.skip_trace_source}</div>
            ` : ''}
          </div>
        ` : `
          <p class="text-muted">No owner info yet. Tap "Skip Trace" to look up the owner.</p>
        `}
      </div>

      <!-- Property Details -->
      ${data.beds || data.sqft || data.estimated_value ? `
        <div class="detail-section">
          <h3>Property Details</h3>
          ${data.beds ? `<div class="detail-row"><span class="label">Beds</span><span class="value">${data.beds}</span></div>` : ''}
          ${data.baths ? `<div class="detail-row"><span class="label">Baths</span><span class="value">${data.baths}</span></div>` : ''}
          ${data.sqft ? `<div class="detail-row"><span class="label">Sq Ft</span><span class="value">${data.sqft.toLocaleString()}</span></div>` : ''}
          ${data.year_built ? `<div class="detail-row"><span class="label">Year Built</span><span class="value">${data.year_built}</span></div>` : ''}
          ${data.property_type ? `<div class="detail-row"><span class="label">Type</span><span class="value">${data.property_type}</span></div>` : ''}
          ${data.estimated_value ? `<div class="detail-row"><span class="label">Est. Value</span><span class="value">$${data.estimated_value.toLocaleString()}</span></div>` : ''}
          ${data.assessed_value ? `<div class="detail-row"><span class="label">Assessed</span><span class="value">$${data.assessed_value.toLocaleString()}</span></div>` : ''}
          ${data.last_sale_price ? `<div class="detail-row"><span class="label">Last Sale</span><span class="value">$${data.last_sale_price.toLocaleString()} (${data.last_sale_date || ''})</span></div>` : ''}
        </div>
      ` : ''}

      <!-- Distress Indicators -->
      <div class="detail-section">
        <h3>Distress Indicators</h3>
        <div class="distress-chips">
          ${allDistressOptions.map(d => `
            <button class="distress-chip ${distress.includes(d) ? 'selected' : ''}"
                    onclick="PropertiesView.toggleDistress('${data.id}', '${d}', this)">
              ${d}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Notes -->
      <div class="detail-section">
        <h3>Notes</h3>
        <textarea class="notes-area" id="notes-${data.id}"
                  placeholder="Add notes about this property..."
                  onblur="PropertiesView.saveNotes('${data.id}')">${data.notes || ''}</textarea>
      </div>

      <!-- Contact History -->
      <div class="detail-section">
        <h3>Contact History</h3>
        ${data.contacts && data.contacts.length > 0 ? `
          <ul class="contact-timeline">
            ${data.contacts.map(c => `
              <li>
                <span class="contact-icon">${{call:'📞',text:'💬',mail:'📮',email:'✉️',door_knock:'🚪'}[c.type] || '📌'}</span>
                <div class="contact-info">
                  <div class="contact-type">${c.type} — ${c.outcome || 'no outcome'}</div>
                  ${c.notes ? `<div class="text-muted">${c.notes}</div>` : ''}
                  <div class="contact-date">${formatDate(c.created_at)} ${formatTime(c.created_at)}</div>
                </div>
              </li>
            `).join('')}
          </ul>
        ` : `<p class="text-muted">No contacts logged yet.</p>`}
      </div>

      <!-- Delete -->
      <div class="detail-section">
        <button class="action-btn danger" style="width:100%;" onclick="PropertiesView.deleteProperty('${data.id}')">
          🗑 Delete Property
        </button>
      </div>
    `;

    // Update header
    document.getElementById('detail-title').textContent = data.address || 'Property Detail';
  },

  async updateStatus(id, status) {
    await api(`/api/properties/${id}`, { method: 'PATCH', body: { status } });
    showToast(`Status: ${status.replace('_', ' ')}`);
  },

  async toggleDistress(id, indicator, btn) {
    const prop = App.properties.find(p => p.id === id);
    if (!prop) return;

    const distress = JSON.parse(prop.distress_indicators || '[]');
    const idx = distress.indexOf(indicator);
    if (idx >= 0) {
      distress.splice(idx, 1);
      btn.classList.remove('selected');
    } else {
      distress.push(indicator);
      btn.classList.add('selected');
    }

    const updated = JSON.stringify(distress);
    prop.distress_indicators = updated;
    await api(`/api/properties/${id}`, { method: 'PATCH', body: { distress_indicators: updated } });
  },

  async saveNotes(id) {
    const notes = document.getElementById(`notes-${id}`)?.value || '';
    await api(`/api/properties/${id}`, { method: 'PATCH', body: { notes } });
  },

  async lookupPropertyData(id) {
    showToast('Looking up property data...');
    try {
      const data = await api(`/api/property-data/${id}`);
      if (data.message) {
        showToast(data.message, 'error');
      } else {
        showToast('Property data loaded!');
        this.openDetail(id); // Refresh detail view
      }
    } catch (err) {
      showToast('Lookup failed', 'error');
    }
  },

  async deleteProperty(id) {
    if (!confirm('Delete this property?')) return;
    await api(`/api/properties/${id}`, { method: 'DELETE' });
    this.closeDetail();
    showToast('Property deleted');
  },

  showContactLog(propertyId, ownerId) {
    const modal = document.getElementById('contact-log-modal');
    modal.classList.add('open');
    modal.dataset.propertyId = propertyId;
    modal.dataset.ownerId = ownerId;
  },

  async saveContactLog() {
    const modal = document.getElementById('contact-log-modal');
    const type = document.getElementById('contact-type').value;
    const outcome = document.getElementById('contact-outcome').value;
    const notes = document.getElementById('contact-notes').value;

    await api('/api/contacts', {
      method: 'POST',
      body: {
        property_id: modal.dataset.propertyId,
        owner_id: modal.dataset.ownerId || null,
        type, outcome, notes
      }
    });

    modal.classList.remove('open');
    document.getElementById('contact-notes').value = '';
    showToast('Contact logged');

    // Refresh detail
    this.openDetail(modal.dataset.propertyId);
  }
};

// ─── Add Property Manually ─────────────────────────────────
async function addPropertyManual() {
  const address = document.getElementById('manual-address').value.trim();
  if (!address) return showToast('Enter an address', 'error');

  showToast('Looking up address...');

  try {
    // Forward geocode to get lat/lng
    const geo = await api('/api/geocode/forward', {
      method: 'POST',
      body: { address }
    });

    const prop = await api('/api/properties', {
      method: 'POST',
      body: {
        address: geo.address || address,
        city: geo.city || '',
        state: geo.state || '',
        zip: geo.zip || '',
        lat: geo.lat,
        lng: geo.lng,
        added_from: 'manual'
      }
    });

    document.getElementById('manual-address').value = '';
    document.getElementById('add-property-modal').classList.remove('open');
    showToast(`Added: ${prop.address}`);
    App.refreshProperties();
    MapView.addMarker(prop);
  } catch (err) {
    showToast('Could not find address', 'error');
  }
}
