// ─── App State & Router ────────────────────────────────────
const App = {
  currentView: 'map',
  properties: [],
  sessions: [],
  lists: [],
  stats: {},
  currentFilter: 'all',
  searchQuery: '',

  init() {
    this.bindTabs();
    this.switchView('map');
    MapView.init();
    this.loadData();
  },

  bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchView(btn.dataset.view));
    });
  },

  switchView(view) {
    this.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const viewEl = document.getElementById(`${view}-view`);
    const tabBtn = document.querySelector(`.tab-btn[data-view="${view}"]`);
    if (viewEl) viewEl.classList.add('active');
    if (tabBtn) tabBtn.classList.add('active');

    // Refresh data for the view
    if (view === 'properties') PropertiesView.render();
    if (view === 'routes') RoutesView.render();
    if (view === 'dashboard') DashboardView.render();
    if (view === 'map') MapView.invalidateSize();
  },

  async loadData() {
    try {
      const [props, sessions, lists, stats] = await Promise.all([
        api('/api/properties?limit=200'),
        api('/api/sessions'),
        api('/api/lists'),
        api('/api/stats')
      ]);
      this.properties = props;
      this.sessions = sessions;
      this.lists = lists;
      this.stats = stats;

      // Load property markers on map
      MapView.loadPropertyMarkers(this.properties);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  },

  async refreshProperties() {
    this.properties = await api('/api/properties?limit=200');
    MapView.loadPropertyMarkers(this.properties);
    if (this.currentView === 'properties') PropertiesView.render();
  },

  async refreshStats() {
    this.stats = await api('/api/stats');
    if (this.currentView === 'dashboard') DashboardView.render();
  }
};

// ─── API Helper ────────────────────────────────────────────
async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ─── Toast Notifications ───────────────────────────────────
function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ─── Utility ───────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
