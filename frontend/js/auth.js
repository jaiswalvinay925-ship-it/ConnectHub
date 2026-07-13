/* =============================================
   RUBHI - Auth State Management
   ============================================= */

const Auth = {
  _user: null,

  get user() { return this._user; },

  init() {
    const stored = localStorage.getItem('rubhi_user');
    if (stored) {
      try { this._user = JSON.parse(stored); } catch (e) { this._user = null; }
    }
    const token = localStorage.getItem('rubhi_token');
    if (token) api.setToken(token);
  },

  async refresh() {
    const res = await api.getMe();
    if (res.ok) {
      this.setUser(res.data.user);
      return res.data.user;
    }
    return null;
  },

  setUser(user) {
    this._user = user;
    if (user) {
      localStorage.setItem('rubhi_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('rubhi_user');
    }
  },

  isLoggedIn() {
    return !!(this._user && api.token);
  },

  isAdmin() {
    return this._user?.role === 'admin';
  },

  async logout() {
    await api.logout().catch(() => {});
    this._user = null;
    api.setToken(null);
    localStorage.removeItem('rubhi_user');
    Router.navigate('login');
  }
};

window.Auth = Auth;

// ---- Listen for forced logout ----
window.addEventListener('auth:logout', () => {
  Auth._user = null;
  localStorage.removeItem('rubhi_user');
  Router.navigate('login');
  RubhiUtils.showToast('Session expired. Please log in again.', 'warning');
});
