/* =============================================
   RUBHI - Client-Side Router
   ============================================= */

const Router = {
  routes: {},
  current: null,

  register(name, handler) {
    this.routes[name] = handler;
  },

  navigate(name, params = {}) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // Update sidebar active state
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === name);
    });
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === name);
    });

    this.current = name;

    // Auth guard
    const publicPages = ['login', 'register'];
    const adminPages  = ['admin', 'admin-users', 'admin-posts', 'admin-comments',
                         'admin-stories', 'admin-messages', 'admin-verification',
                         'admin-reports', 'admin-settings'];

    if (!publicPages.includes(name) && !Auth.isLoggedIn()) {
      return this.navigate('login');
    }

    if (adminPages.includes(name) && !Auth.isAdmin()) {
      RubhiUtils.showToast('Access denied.', 'error');
      return this.navigate('home');
    }

    // Show/hide sidebar and mobile nav
    const sidebar = document.getElementById('main-sidebar');
    const mobileNav = document.getElementById('mobile-nav');
    const topbar = document.getElementById('main-topbar');

    if (publicPages.includes(name)) {
      if (sidebar)    sidebar.style.display = 'none';
      if (mobileNav)  mobileNav.style.display = 'none';
      if (topbar)     topbar.style.display = 'none';
    } else if (adminPages.includes(name)) {
      if (sidebar)    sidebar.style.display = 'none';
      if (mobileNav)  mobileNav.style.display = 'none';
      if (topbar)     topbar.style.display = 'none';
    } else {
      if (sidebar)    sidebar.style.display = '';
      if (mobileNav)  mobileNav.style.display = '';
      if (topbar)     topbar.style.display = '';
    }

    // Show page
    const pageEl = document.getElementById(`page-${name}`);
    if (pageEl) pageEl.classList.add('active');

    // Call handler
    if (this.routes[name]) {
      this.routes[name](params);
    }

    // Update URL
    const urlMap = {
      'home': '/', 'search': '/search', 'messages': '/messages',
      'notifications': '/notifications', 'profile': '/profile',
      'create-post': '/create-post', 'login': '/login', 'register': '/register',
      'admin': '/admin', 'admin-users': '/admin/users',
      'admin-posts': '/admin/posts', 'admin-comments': '/admin/comments',
      'admin-stories': '/admin/stories', 'admin-messages': '/admin/messages',
      'admin-verification': '/admin/verification', 'admin-reports': '/admin/reports',
      'admin-settings': '/admin/settings',
    };

    const url = urlMap[name] || '/';
    history.pushState({ page: name, params }, '', url);
  },

  handlePopState(e) {
    if (e.state?.page) {
      this.navigate(e.state.page, e.state.params || {});
    }
  },

  init() {
    window.addEventListener('popstate', (e) => this.handlePopState(e));

    // Route based on current path
    const path = window.location.pathname;
    const pathRouteMap = {
      '/':                     'home',
      '/search':               'search',
      '/messages':             'messages',
      '/notifications':        'notifications',
      '/profile':              'profile',
      '/create-post':          'create-post',
      '/login':                'login',
      '/register':             'register',
      '/admin':                'admin',
      '/admin/users':          'admin-users',
      '/admin/posts':          'admin-posts',
      '/admin/comments':       'admin-comments',
      '/admin/stories':        'admin-stories',
      '/admin/messages':       'admin-messages',
      '/admin/verification':   'admin-verification',
      '/admin/reports':        'admin-reports',
      '/admin/settings':       'admin-settings',
    };

    let startPage = pathRouteMap[path] || 'home';

    if (!Auth.isLoggedIn()) {
      startPage = (path === '/register') ? 'register' : 'login';
    } else if (startPage === 'login' || startPage === 'register') {
      startPage = Auth.isAdmin() ? 'admin' : 'home';
    }

    this.navigate(startPage);
  }
};

window.Router = Router;
