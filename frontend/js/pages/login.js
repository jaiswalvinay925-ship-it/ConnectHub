/* =============================================
   RUBHI - Login Page
   ============================================= */

Router.register('login', () => {
  const { escapeHtml, showToast } = RubhiUtils;

  const form      = document.getElementById('login-form');
  const identEl   = document.getElementById('login-identifier');
  const passEl    = document.getElementById('login-password');
  const errEl     = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');
  const toggleBtn = document.getElementById('login-toggle-pw');

  if (!form) return;

  // Password toggle
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isText = passEl.type === 'text';
      passEl.type = isText ? 'password' : 'text';
      toggleBtn.innerHTML = isText ? eyeIcon() : eyeOffIcon();
    });
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    errEl.style.display = 'none';

    const identifier = identEl.value.trim();
    const password   = passEl.value;

    if (!identifier || !password) {
      showError('Please fill in all fields.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner spinner-sm"></span> Signing in...`;

    const res = await api.login({ identifier, password });

    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Sign In';

    if (res.ok) {
      api.setToken(res.data.token);
      Auth.setUser(res.data.user);
      showToast('Welcome back!', 'success');

      if (res.data.user.role === 'admin') {
        Router.navigate('admin');
      } else {
        Router.navigate('home');
      }
    } else {
      showError(res.data.error || res.data.errors?.[0]?.msg || 'Login failed.');
    }
  };

  function showError(msg) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
    identEl.classList.add('error');
    passEl.classList.add('error');
    identEl.addEventListener('input', clearError, { once: true });
    passEl.addEventListener('input', clearError, { once: true });
  }

  function clearError() {
    errEl.textContent = '';
    errEl.style.display = 'none';
    identEl.classList.remove('error');
    passEl.classList.remove('error');
  }
});

function eyeIcon() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

function eyeOffIcon() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}
