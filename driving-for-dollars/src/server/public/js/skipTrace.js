// ─── Skip Trace View ────────────────────────────────────────
const SkipTraceView = {
  currentPropertyId: null,

  open(propertyId, address, city, state, zip) {
    this.currentPropertyId = propertyId;
    const modal = document.getElementById('skip-trace-modal');
    modal.classList.add('open');

    // Pre-fill address info
    document.getElementById('st-address').value = address || '';
    document.getElementById('st-city').value = (city && city !== 'undefined') ? city : '';
    document.getElementById('st-state').value = (state && state !== 'undefined') ? state : '';
    document.getElementById('st-zip').value = (zip && zip !== 'undefined') ? zip : '';
    document.getElementById('st-name').value = '';

    // Clear previous results
    document.getElementById('skip-results').innerHTML = '';
  },

  close() {
    document.getElementById('skip-trace-modal').classList.remove('open');
  },

  async run() {
    const name = document.getElementById('st-name').value.trim();
    const address = document.getElementById('st-address').value.trim();
    const city = document.getElementById('st-city').value.trim();
    const state = document.getElementById('st-state').value.trim();
    const zip = document.getElementById('st-zip').value.trim();

    if (!address && !name) {
      showToast('Enter a name or address', 'error');
      return;
    }

    const results = document.getElementById('skip-results');
    results.innerHTML = '<p class="text-muted">Searching...</p>';

    try {
      const data = await api('/api/skip-trace', {
        method: 'POST',
        body: {
          name, address, city, state, zip,
          property_id: this.currentPropertyId
        }
      });

      this.renderResults(data);
    } catch (err) {
      results.innerHTML = '<p class="text-muted">Skip trace failed. Try again.</p>';
    }
  },

  renderResults(data) {
    const results = document.getElementById('skip-results');
    let html = '';

    // Paid API results (if available)
    if (data.paidResult) {
      html += `
        <div class="detail-section">
          <h3>Skip Trace Results</h3>
          <div class="owner-card">
            <div class="owner-name">${data.paidResult.name || 'Unknown'}</div>
            ${data.paidResult.phones?.map(p => `
              <div class="owner-detail">📞 <a href="tel:${p}">${p}</a></div>
            `).join('') || ''}
            ${data.paidResult.emails?.map(e => `
              <div class="owner-detail">✉️ <a href="mailto:${e}">${e}</a></div>
            `).join('') || ''}
            ${data.paidResult.mailing_address ? `
              <div class="owner-detail">📮 ${[data.paidResult.mailing_address, data.paidResult.mailing_city, data.paidResult.mailing_state].filter(Boolean).join(', ')}</div>
            ` : ''}
          </div>
        </div>
      `;
    }

    // Free lookup links (always available)
    if (data.freeLinks && data.freeLinks.length > 0) {
      html += `
        <div class="detail-section">
          <h3>Free Lookup Links</h3>
          <p class="text-muted mb-16">Tap a link below to search for the property owner. These are free sites — no account needed.</p>
          <div class="skip-links">
            ${data.freeLinks.map(link => `
              <a href="${link.url}" target="_blank" rel="noopener" class="skip-link">
                <div>
                  <div class="link-source">${link.source}</div>
                  <div class="text-muted" style="font-size:12px;">${link.description}</div>
                </div>
                <span class="link-arrow">→</span>
              </a>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Manual entry section
    html += `
      <div class="detail-section">
        <h3>Manual Entry</h3>
        <p class="text-muted mb-16">Found the owner info? Enter it here to save it.</p>
        <label>Owner Name</label>
        <input type="text" id="manual-owner-name" placeholder="John Smith">
        <label>Phone 1</label>
        <input type="tel" id="manual-phone1" placeholder="(555) 123-4567">
        <label>Phone 2</label>
        <input type="tel" id="manual-phone2" placeholder="(555) 987-6543">
        <label>Email</label>
        <input type="email" id="manual-email1" placeholder="owner@email.com">
        <label>Mailing Address</label>
        <input type="text" id="manual-mailing" placeholder="123 Main St">
        <div class="modal-actions mt-8">
          <button class="btn-confirm" onclick="SkipTraceView.saveManualOwner()">Save Owner Info</button>
        </div>
      </div>
    `;

    if (!data.hasPaidApi) {
      html += `
        <div class="detail-section">
          <p class="text-muted" style="font-size:12px; text-align:center;">
            For automatic skip tracing, configure TRACERFY_API_KEY in your .env file ($0.005/trace).
          </p>
        </div>
      `;
    }

    results.innerHTML = html;
  },

  async saveManualOwner() {
    if (!this.currentPropertyId) return;

    const name = document.getElementById('manual-owner-name').value.trim();
    const phone1 = document.getElementById('manual-phone1').value.trim();
    const phone2 = document.getElementById('manual-phone2').value.trim();
    const email1 = document.getElementById('manual-email1').value.trim();
    const mailing = document.getElementById('manual-mailing').value.trim();

    if (!name && !phone1) {
      showToast('Enter at least a name or phone number', 'error');
      return;
    }

    try {
      await api('/api/skip-trace', {
        method: 'POST',
        body: { property_id: this.currentPropertyId }
      });

      // Use the owners endpoint to upsert
      const existingOwner = await api(`/api/owners/${this.currentPropertyId}`);

      if (existingOwner) {
        await api(`/api/owners/${existingOwner.id}`, {
          method: 'PATCH',
          body: {
            property_id: this.currentPropertyId,
            name: name || existingOwner.name,
            phone1: phone1 || existingOwner.phone1,
            phone2: phone2 || existingOwner.phone2,
            email1: email1 || existingOwner.email1,
            mailing_address: mailing || existingOwner.mailing_address,
            skip_traced_at: new Date().toISOString(),
            skip_trace_source: 'manual'
          }
        });
      } else {
        // Create new owner via upsert
        const { v4 } = await import('/js/uuid-helper.js').catch(() => ({ v4: () => crypto.randomUUID() }));
        const ownerId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

        await api(`/api/owners/${ownerId}`, {
          method: 'PATCH',
          body: {
            property_id: this.currentPropertyId,
            name, phone1, phone2, email1,
            mailing_address: mailing,
            skip_traced_at: new Date().toISOString(),
            skip_trace_source: 'manual'
          }
        });
      }

      showToast('Owner info saved!');
      this.close();
      PropertiesView.openDetail(this.currentPropertyId);
    } catch (err) {
      showToast('Failed to save owner info', 'error');
    }
  }
};
